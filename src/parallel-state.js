import {
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
  openSync,
  closeSync,
  unlinkSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { readLinks, writeLinks } from './links-sidecar.js';

/**
 * Cross-worktree state protocol for `fork-plan --mode parallel` (plan-fork F2).
 *
 * `.atomic-skills/` is git-tracked, so each worktree (one per `plan/<slug>`
 * branch) carries its own working-tree copy of the state. Under `parallel` the
 * parent runs in its worktree and the child in another; when the child writes
 * back to the parent's state, two divergent copies contend. The protocol
 * (spec: docs/design/plan-fork-parallel-state.md) makes that write safe:
 *
 *   1. Canonical owner = the parent's OWN worktree (resolved from the parent's
 *      `branch:` + `git worktree list`).
 *   2. Revision token = sha256 content-hash of the canonical file (no plan.md
 *      schema change, no git dependency).
 *   3. Conflict = the content-hash changed since the child read it → abort and
 *      record a durable, declarative `pendingWriteback` in the CHILD's sidecar
 *      (no lost update; the F3 resume loop retries against fresh state).
 *
 * This module is pure-core where it can be (parsing, hashing, find) and thin IO
 * at the edges (the compare-and-swap write, the sidecar recorder). It never
 * touches `pause` mode.
 */

const LOCK_NAME = '.links.lock';

/**
 * sha256 of a file's raw bytes — the optimistic-concurrency revision token.
 * @param {string} filePath
 * @returns {string|null} hex digest, or null when the file is absent
 */
export function contentToken(filePath) {
  if (!existsSync(filePath)) return null;
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/**
 * Parse `git worktree list --porcelain` into `{ path, branch }[]`. A detached
 * worktree has `branch: null`. Pure.
 * @param {string} porcelain
 * @returns {Array<{path: string, branch: string|null}>}
 */
export function parseWorktrees(porcelain) {
  const out = [];
  let cur = {};
  for (const line of String(porcelain ?? '').split('\n')) {
    if (line === '') {
      if (cur.path) out.push(cur);
      cur = {};
      continue;
    }
    if (line.startsWith('worktree ')) cur.path = line.slice('worktree '.length);
    else if (line.startsWith('branch ')) {
      cur.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
    } else if (line === 'detached') cur.branch = null;
  }
  if (cur.path) out.push(cur);
  return out;
}

/**
 * Find the single worktree on `branch`. Pure.
 * @param {Array<{path: string, branch: string|null}>} worktrees
 * @param {string} branch
 * @returns {string|null} the worktree path, or null when none matches
 * @throws {Error} when more than one worktree claims the branch (ambiguous —
 *   never guess a canonical target)
 */
export function findWorktreeByBranch(worktrees, branch) {
  const matches = (worktrees ?? []).filter((w) => w.branch === branch);
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new Error(`ambiguous canonical resolution: ${matches.length} worktrees on branch ${branch}`);
  }
  return matches[0].path;
}

/**
 * Resolve the parent plan's canonical directory in the parent's own worktree
 * (nested layout). Pure given the parsed worktrees.
 * @param {object} args
 * @param {string} args.parentSlug
 * @param {string} args.parentBranch - the parent plan's `branch:` (stable across the fork)
 * @param {string} args.projectId
 * @param {Array<{path: string, branch: string|null}>} args.worktrees - parsed `git worktree list --porcelain`
 * @param {string} [args.stateRoot]
 * @returns {string} the parent plan dir (caller checks plan.md existence)
 * @throws {Error} when no worktree is on the parent branch, or the branch is empty
 */
export function resolveCanonicalParentDir({ parentSlug, parentBranch, projectId, worktrees, stateRoot = '.atomic-skills' }) {
  if (!parentBranch) {
    throw new Error(`parallel mode requires the parent plan '${parentSlug}' to live on a named branch (branch: is null)`);
  }
  const wtPath = findWorktreeByBranch(worktrees, parentBranch);
  if (!wtPath) {
    throw new Error(`no worktree found on parent branch '${parentBranch}' for plan '${parentSlug}'`);
  }
  return join(wtPath, stateRoot, 'projects', projectId, parentSlug);
}

/**
 * Compare-and-swap writeback to a canonical file. Acquires a short advisory
 * lock (O_EXCL) so the re-read/compare/write is serialized, then aborts on a
 * content-hash mismatch (a concurrent writer changed the file since the child's
 * read). On success the new content is written atomically (temp file in the
 * same dir + rename). The lock is always released.
 *
 * @param {string} canonicalFile - the parent's canonical state file
 * @param {object} opts
 * @param {string|null} opts.readToken - the content-hash captured when the child read (token0)
 * @param {(current: string) => string} opts.mutate - applied to the current content; returns the next content
 * @param {number} [opts.retries] - lock-acquire attempts before treating it as a conflict
 * @returns {{ok: true} | {ok: false, conflict: true, reason: string, token1?: string|null}}
 */
export function atomicWriteback(canonicalFile, { readToken, mutate, retries = 50 }) {
  const lockPath = join(dirname(canonicalFile), LOCK_NAME);
  let fd = null;
  for (let i = 0; i < retries && fd === null; i++) {
    try {
      fd = openSync(lockPath, 'wx');
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // lock held by another writer; bounded retry, then treat as conflict
    }
  }
  if (fd === null) return { ok: false, conflict: true, reason: 'lock-timeout' };

  try {
    const token1 = contentToken(canonicalFile);
    if (token1 !== readToken) {
      // Decision 2/5: the canonical file changed since the child read it.
      return { ok: false, conflict: true, reason: 'token-mismatch', token1 };
    }
    const current = existsSync(canonicalFile) ? readFileSync(canonicalFile, 'utf8') : '';
    const next = mutate(current);
    const tmp = `${canonicalFile}.tmp-${process.pid}`;
    writeFileSync(tmp, next, 'utf8');
    renameSync(tmp, canonicalFile);
    return { ok: true };
  } finally {
    closeSync(fd);
    unlinkSync(lockPath);
  }
}

/**
 * Record a durable, declarative pending-writeback on the CHILD's own sidecar
 * (no cross-worktree write — the child writes its own state). Validated against
 * links.schema.json at the write boundary, so an invalid `op`/`target` throws.
 * @param {string} childPlanDir
 * @param {{target: string, parent: string, op: string, args?: object, readToken: string, detectedAt: string, reason?: string}} pending
 * @returns {object} the updated links object
 */
export function recordPendingWriteback(childPlanDir, pending) {
  const data = readLinks(childPlanDir);
  data.pendingWriteback = pending;
  writeLinks(childPlanDir, data);
  return data;
}

/**
 * Clear the pending-writeback after a successful retry. Idempotent.
 * @param {string} childPlanDir
 * @returns {object} the updated links object
 */
export function clearPendingWriteback(childPlanDir) {
  const data = readLinks(childPlanDir);
  if ('pendingWriteback' in data) {
    delete data.pendingWriteback;
    writeLinks(childPlanDir, data);
  }
  return data;
}
