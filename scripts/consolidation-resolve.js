/**
 * consolidation-resolve.js — pure typed conflict-resolution classifier for the
 * multi-worktree consolidation path (`project consolidate`, ≥2 live worktrees).
 *
 * This module NEVER runs git, build, or tests. It only DECIDES, over an
 * already-known conflicted path (and already-read file text), which mechanical
 * policy applies — or EJECTS to a human. The git/exec I/O lives in the
 * orchestrator (scripts/consolidate.mjs / project-consolidate.md).
 *
 * Fail-closed (the load-bearing rule): the policy table is a strict ALLOWLIST.
 * A path that is not provably one of the mechanical classes resolves to `eject`
 * — never a silent mechanical sweep. A mis-classification would produce a tree
 * that compiles+tests green while having dropped a side's real work, which the
 * build+test floor cannot catch; the allowlist is what prevents that.
 */

// ── pure guards (prototype-pollution safe; mirror the existing script family) ──
function ownValue(value, key) {
  if (value == null || typeof value !== 'object') return undefined;
  if (!Object.hasOwn(value, key)) return undefined;
  return value[key];
}

function mk(klass, policy, auto, reason) {
  return { class: klass, policy, auto, reason };
}

// Exact-path allowlists. Globs handled by regex below.
const RUNTIME_REGENERABLE = new Set([
  '.atomic-skills/focus.json',
]);
const LEDGER_APPEND = new Set([
  '.atomic-skills/reviews/INDEX.md',
  '.atomic-skills/status/dispatch-log.json',
]);
const POINTWISE_STATE = new Set([
  '.atomic-skills/status/last-review.json',
  '.atomic-skills/status/last-session.json',
]);
const GENERATED_DEFAULT = new Set([
  'src/dashboard/data/skills.generated.ts',
  'assets/aideck-consumer/schema.json',
  'package-lock.json', // lockfile: resolve then `npm install` to relock against the merged package.json
]);
// Additive line-oriented config (ignore lists / attribute rules) union losslessly.
const CONFIG_UNION = new Set([
  '.gitignore',
  '.gitattributes',
]);

const IDEAS_GLOB = /^\.atomic-skills\/projects\/[^/]+\/ideas\.md$/;
const PROJECT_STATUS_GLOB = /(^|\/)PROJECT-STATUS\.md$/;

// Timestamp fields a pointwise/generated JSON may carry, newest wins.
const TIMESTAMP_KEYS = ['lastReviewedAt', 'lastUpdated', 'generatedAt', 'savedAt', 'at'];

/**
 * classifyConflictPath — pure, never-throws, FAIL-CLOSED.
 * @param {string} path  the conflicted repo-relative path.
 * @param {object} [opts]
 * @param {string[]} [opts.generatedPaths]  extra generated-artifact paths (target-repo specific).
 * @returns {{class:string, policy:('take-delete'|'union'|'last-writer-wins'|'take-ours-verify'|'regenerate'|'eject'), auto:boolean, reason:string}}
 */
export function classifyConflictPath(path, opts = {}) {
  const p = typeof path === 'string' ? path : '';
  const extra = Array.isArray(ownValue(opts, 'generatedPaths')) ? opts.generatedPaths : [];

  if (RUNTIME_REGENERABLE.has(p)) {
    return mk('runtime-regenerable', 'take-delete', true, 'runtime view pointer, regenerated from source — never content-merge');
  }
  if (LEDGER_APPEND.has(p) || IDEAS_GLOB.test(p)) {
    return mk('ledger-append', 'union', true, 'append-only ledger; line union is lossless');
  }
  if (CONFIG_UNION.has(p)) {
    return mk('config-union', 'union', true, 'additive line-oriented config (ignore/attribute rules); union is lossless');
  }
  if (POINTWISE_STATE.has(p)) {
    return mk('pointwise-state', 'last-writer-wins', true, 'single-value machine state; newest writer wins');
  }
  if (PROJECT_STATUS_GLOB.test(p)) {
    return mk('narrative-index', 'take-ours-verify', true, 'human-narrative index; take one side + MANDATORY post-merge verify (never silent)');
  }
  if (GENERATED_DEFAULT.has(p) || extra.includes(p)) {
    return mk('generated-artifact', 'regenerate', true, 'generated build artifact; resolve then regenerate from source, then assert-green');
  }
  // FAIL-CLOSED: anything not provably mechanical routes to a human.
  return mk('semantic-or-unknown', 'eject', false, 'not in the mechanical allowlist — route to human (fail-closed)');
}

/**
 * unionLines — pure line-union (ours order preserved, then theirs lines not in ours).
 * Mirrors git's `merge=union` driver. Lossless for append-only ledgers / NDJSON.
 * @returns {string}
 */
export function unionLines(oursText, theirsText) {
  const ours = typeof oursText === 'string' ? oursText : '';
  const theirs = typeof theirsText === 'string' ? theirsText : '';
  const trailing = ours.endsWith('\n') || theirs.endsWith('\n') ? '\n' : '';
  const oursLines = ours.length ? ours.replace(/\n$/, '').split('\n') : [];
  const theirsLines = theirs.length ? theirs.replace(/\n$/, '').split('\n') : [];
  const seen = new Set(oursLines);
  const out = [...oursLines];
  for (const line of theirsLines) {
    if (!seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }
  return out.join('\n') + trailing;
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function timestampOf(obj) {
  if (obj == null || typeof obj !== 'object') return undefined;
  for (const key of TIMESTAMP_KEYS) {
    if (Object.hasOwn(obj, key) && typeof obj[key] === 'string') return obj[key];
  }
  return undefined;
}

/**
 * pickNewerByTimestamp — pure, never-throws. Compares an in-file ISO timestamp
 * on two JSON snapshots and returns the newer side. Returns null when it cannot
 * decide (unparseable / no comparable timestamp) so the caller FAILS CLOSED.
 * @returns {{side:('ours'|'theirs'), text:string}|null}
 */
export function pickNewerByTimestamp(oursText, theirsText) {
  const ours = parseJsonSafe(oursText);
  const theirs = parseJsonSafe(theirsText);
  if (ours === undefined || theirs === undefined) return null;
  const to = timestampOf(ours);
  const tt = timestampOf(theirs);
  if (typeof to !== 'string' || typeof tt !== 'string') return null;
  // ISO-8601 strings compare lexicographically iff same offset; normalize to epoch.
  const eo = Date.parse(to);
  const et = Date.parse(tt);
  if (Number.isNaN(eo) || Number.isNaN(et)) return null;
  return et >= eo ? { side: 'theirs', text: theirsText } : { side: 'ours', text: oursText };
}

/**
 * classifyBranchIntegration — pure. Decides how a candidate branch enters the
 * integration tip, distinguishing the merged-then-reverted (no-op) case.
 * @param {object} [input]
 * @param {number} [input.aheadCount]  commits the branch has that the base lacks.
 * @param {(string|null)} [input.revertOfMergeSha]  sha of a `git revert` of this branch's prior merge on the base, if any.
 * @returns {{action:('merge'|'revert-of-revert'|'skip-noop'), reason:string, revertSha:(string|null)}}
 */
export function classifyBranchIntegration(input = {}) {
  const safe = input == null || typeof input !== 'object' ? {} : input;
  const ahead = typeof safe.aheadCount === 'number' ? safe.aheadCount : null;
  const revertSha = typeof safe.revertOfMergeSha === 'string' && safe.revertOfMergeSha ? safe.revertOfMergeSha : null;

  if (ahead === 0) {
    // Already in history. If a revert of its merge exists, the feature was
    // merged-then-reverted → restore via revert-of-revert (clean, single-parent).
    if (revertSha) return { action: 'revert-of-revert', reason: 'branch merged then reverted on base; re-merge is a no-op', revertSha };
    return { action: 'skip-noop', reason: 'branch already integrated (ahead=0) and not reverted', revertSha: null };
  }
  return { action: 'merge', reason: 'branch is ahead of base; standard merge', revertSha: null };
}
