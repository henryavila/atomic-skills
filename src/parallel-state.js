import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  renameSync,
  openSync,
  closeSync,
  writeSync,
  unlinkSync,
} from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
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
// A lock whose owning process is dead, or that is older than this TTL, is stale
// and reclaimable — so a single crashed writer cannot brick the channel forever.
const LOCK_TTL_MS = 30_000;
// Blocking backoff between lock-acquire attempts (synchronous, no busy-spin), so
// a contender actually waits out a holder's critical section instead of
// exhausting its retries in ~1ms and returning a false `lock-timeout`.
const LOCK_BACKOFF_MS = 20;
const LOCK_RETRIES = 50;

/**
 * sha256 of a file's raw bytes — the optimistic-concurrency revision token.
 * @param {string} filePath
 * @returns {string|null} hex digest, or null when the file is absent
 * @throws {Error} when the path exists but is not a regular file (e.g. a
 *   directory) — a clear error instead of an opaque EISDIR mid-critical-section
 */
export function contentToken(filePath) {
  if (!existsSync(filePath)) return null;
  if (!statSync(filePath).isFile()) {
    throw new Error(`canonical state path is not a regular file: ${filePath}`);
  }
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/** Synchronous block for `ms` without busy-spinning the CPU. */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Is `pid` a live process? `kill(pid, 0)` throws ESRCH for a dead pid. */
function isProcessAlive(pid) {
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM = alive but not ours to signal; ESRCH = dead.
    return err.code === 'EPERM';
  }
}

/** A lock is stale if its owning pid is dead OR it is older than the TTL. */
function isStaleLock(lockPath, now) {
  let info;
  try {
    info = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    // Unreadable/corrupt lock content → treat as stale (reclaimable).
    return true;
  }
  if (!info || typeof info !== 'object') return true;
  if (typeof info.ts === 'number' && now - info.ts > LOCK_TTL_MS) return true;
  return !isProcessAlive(info.pid);
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
 * @param {boolean} [opts.allowCreate] - when false (default), an absent canonical
 *   file is a resolution error, NOT a writable empty state: `readToken: null`
 *   against a missing target returns `{conflict, reason: 'canonical-absent'}`
 *   instead of silently creating state in the wrong place. Pass true only when
 *   the target legitimately may not exist yet (e.g. a fresh sidecar).
 * @returns {{ok: true} | {ok: false, conflict: true, reason: string, token1?: string|null}}
 */
export function atomicWriteback(canonicalFile, { readToken, mutate, retries = LOCK_RETRIES, allowCreate = false }) {
  const lockPath = join(dirname(canonicalFile), LOCK_NAME);
  let acquired = false;
  for (let i = 0; i < retries && !acquired; i++) {
    let fd = null;
    try {
      fd = openSync(lockPath, 'wx');
      // Stamp pid+ts so a later contender can tell a live holder from a crashed one.
      writeSync(fd, JSON.stringify({ pid: process.pid, ts: Date.now() }));
      acquired = true;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // Held by someone. Reclaim it if the holder is dead / the lock is stale
      // (a single crashed writer must not brick the channel forever); otherwise
      // back off and wait out the holder's critical section.
      if (isStaleLock(lockPath, Date.now())) {
        try {
          unlinkSync(lockPath);
        } catch (e) {
          if (e.code !== 'ENOENT') throw e; // another contender reclaimed it first
        }
        continue; // retry immediately without consuming the backoff
      }
      if (i < retries - 1) sleepSync(LOCK_BACKOFF_MS);
    } finally {
      // The lock is the FILE's existence, not a held fd — close it right after stamping.
      if (fd !== null) closeSync(fd);
    }
  }
  if (!acquired) return { ok: false, conflict: true, reason: 'lock-timeout' };

  let tmp = null;
  try {
    const token1 = contentToken(canonicalFile);
    if (token1 !== readToken) {
      // Decision 2/5: the canonical file changed since the child read it.
      return { ok: false, conflict: true, reason: 'token-mismatch', token1 };
    }
    if (token1 === null && !allowCreate) {
      // Absent canonical target (token null on both sides) is a resolution error,
      // not a writable empty state — refuse to create state in the wrong place.
      return { ok: false, conflict: true, reason: 'canonical-absent', token1 };
    }
    const current = existsSync(canonicalFile) ? readFileSync(canonicalFile, 'utf8') : '';
    const next = mutate(current);
    // Unique temp name (pid + random) so a leaked temp or a recycled pid can
    // never collide; temp lives in the SAME dir so the rename is atomic.
    tmp = `${canonicalFile}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
    writeFileSync(tmp, next, 'utf8');
    renameSync(tmp, canonicalFile);
    tmp = null; // renamed away — nothing to clean up
    return { ok: true };
  } finally {
    if (tmp !== null) {
      // write or rename threw; best-effort remove the orphan temp before unwinding.
      try {
        unlinkSync(tmp);
      } catch {
        /* already gone / never created */
      }
    }
    try {
      unlinkSync(lockPath);
    } catch {
      /* lock already reclaimed by a stale-sweep; releasing is best-effort */
    }
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

/**
 * The single conflict-handling writeback entry point: attempt the CAS writeback
 * to the parent's canonical file and, on ANY conflict (token-mismatch /
 * lock-timeout / canonical-absent), durably record the declarative
 * `pendingWriteback` in the CHILD's sidecar BEFORE returning — so the recovery
 * marker exists even if the caller then crashes (the F3 resume loop retries from
 * it). On success, any stale recovery marker is cleared (the link converged).
 *
 * Callers should use this rather than `atomicWriteback` directly, so a conflict
 * can never silently lose the intended writeback (the recording is not left to
 * the caller).
 *
 * @param {object} opts
 * @param {string} opts.canonicalFile - the parent's canonical state file
 * @param {string} opts.childPlanDir - where the recovery marker is written
 * @param {string|null} opts.readToken - token0 captured at read
 * @param {(current: string) => string} opts.mutate
 * @param {boolean} [opts.allowCreate]
 * @param {object} opts.pending - the declarative pending-writeback record (schema-validated on write)
 * @returns {{ok: true} | {ok: false, conflict: true, deferred: true, reason: string}}
 */
export function writebackOrDefer({ canonicalFile, childPlanDir, readToken, mutate, allowCreate = false, pending }) {
  const res = atomicWriteback(canonicalFile, { readToken, mutate, allowCreate });
  if (res.ok) {
    clearPendingWriteback(childPlanDir);
    return res;
  }
  recordPendingWriteback(childPlanDir, pending);
  return { ...res, deferred: true };
}
