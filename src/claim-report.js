/**
 * Pure claim-report parse + validation for automate phase writers (design D6 / F2).
 *
 * A claim is confidence from the code-only phase writer — never closure.
 * Orchestrator validates each task claim before re-verify / complex review / done.
 * Under durable automate, **claim-bound done** is gated by
 * `canDoneFromAutomateClaims` / `canCloseTasksFromClaims` in
 * `src/automate-orchestrator-gates.js` (required claim report + reachability
 * default true for automate done) plus `complexTaskAllowsDone` for complex tasks.
 *
 * Required per-task fields:
 *   - taskId (empty/missing → validation error; not silently dropped — F6)
 *   - status: claimed-pass | claimed-fail | blocked | skipped | omit
 *     (unknown statuses like done/pass/ok are validation errors, not silent non-open)
 *   - commit identity: non-empty commitShas[] OR (base + head) range
 *   - paths (array; for open claims claimed-pass/claimed-fail: ≥1 non-empty path — F7)
 *   - verifierCommand
 *   - exitCode (number or null; claimed-pass requires exitCode === 0 — F8)
 *   - transcript (string; may be empty)
 *
 * Multi-task exclusivity (HARD / F9):
 *   Each open claim needs an exclusive commit range or a SHA list that is NOT
 *   shared across other open claims. Range endpoints (base, head) contribute to
 *   the exclusivity pool as SHA-like tokens — reject if any open claim's
 *   base/head appears in another claim's commitShas or endpoints. Identical
 *   base+head pairs are also rejected.
 *
 *   Pure-helper limit: full commit-graph overlap (ancestors between base..head)
 *   needs git expand post-merge; this helper only checks token/endpoint identity.
 *
 * Reachability (validateClaimReachability):
 *   Exact case-insensitive SHA equality only — no free prefix/startsWith match.
 *
 * No I/O.
 */

/** @typedef {'claimed-pass' | 'claimed-fail' | 'blocked' | 'skipped'} ClaimStatus */

/** Allowed claim statuses (unknown values are validation errors, not silent non-open). */
const ALLOWED_CLAIM_STATUSES = new Set([
  'claimed-pass',
  'claimed-fail',
  'blocked',
  'skipped',
]);

/**
 * @typedef {{
 *   taskId: string,
 *   status?: ClaimStatus,
 *   commitShas?: string[] | null,
 *   base?: string | null,
 *   head?: string | null,
 *   paths?: string[] | null,
 *   verifierCommand?: string | null,
 *   exitCode?: number | null,
 *   transcript?: string | null,
 *   notes?: string | null,
 * }} TaskClaim
 *
 * @typedef {{
 *   planSlug?: string,
 *   phaseId?: string,
 *   worktreePath?: string,
 *   writerBranch?: string,
 *   finishedAt?: string,
 *   tasks: TaskClaim[],
 * }} ClaimReport
 *
 * @typedef {{
 *   ok: boolean,
 *   errors: string[],
 *   tasks?: Array<{ taskId: string, ok: boolean, errors: string[], range?: ClaimRange }>,
 * }} ClaimValidationResult
 *
 * @typedef {{
 *   kind: 'shas' | 'range',
 *   commitShas?: string[],
 *   base?: string,
 *   head?: string,
 * }} ClaimRange
 */

/**
 * Normalize a free-form claim report (array of tasks or envelope with tasks[]).
 * Pure — does not validate. Preserves invalid task entries (empty taskId, etc.)
 * so validation can report errors (F6).
 *
 * @param {unknown} raw
 * @returns {ClaimReport | null}
 */
export function parseClaimReport(raw) {
  if (raw == null) return null;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    try {
      return parseClaimReport(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }

  if (Array.isArray(raw)) {
    return { tasks: raw.map(normalizeTaskClaim) };
  }

  if (typeof raw !== 'object') return null;

  const obj = /** @type {Record<string, unknown>} */ (raw);
  const tasksRaw = Array.isArray(obj.tasks)
    ? obj.tasks
    : Array.isArray(obj.claimReport?.tasks)
      ? obj.claimReport.tasks
      : null;

  if (tasksRaw == null) {
    // Single task object with taskId (including empty string → preserve for errors)
    if (obj.taskId != null || Object.prototype.hasOwnProperty.call(obj, 'taskId')) {
      const task = normalizeTaskClaim(obj);
      return { tasks: [task] };
    }
    // Non-object-array entries without taskId key still preserve shape when
    // they look like a task-shaped object (status/paths etc.)
    if (
      obj.status != null ||
      obj.commitShas != null ||
      obj.paths != null ||
      obj.verifierCommand != null
    ) {
      return { tasks: [normalizeTaskClaim(obj)] };
    }
    return null;
  }

  return {
    planSlug: obj.planSlug != null ? String(obj.planSlug) : undefined,
    phaseId: obj.phaseId != null ? String(obj.phaseId) : undefined,
    worktreePath: obj.worktreePath != null ? String(obj.worktreePath) : undefined,
    writerBranch: obj.writerBranch != null ? String(obj.writerBranch) : undefined,
    finishedAt: obj.finishedAt != null ? String(obj.finishedAt) : undefined,
    // F6: do not filter null/invalid normalizations — preserve for validation errors
    tasks: tasksRaw.map(normalizeTaskClaim),
  };
}

/**
 * Normalize a single task claim. Always returns a TaskClaim-shaped object
 * (never null) so empty taskId / garbage entries surface in validation (F6).
 *
 * @param {unknown} raw
 * @returns {TaskClaim}
 */
function normalizeTaskClaim(raw) {
  if (raw == null || typeof raw !== 'object') {
    return {
      taskId: '',
      status: undefined,
      paths: undefined,
      verifierCommand: undefined,
      exitCode: undefined,
      transcript: undefined,
    };
  }
  const t = /** @type {Record<string, unknown>} */ (raw);

  /** @type {string[] | undefined} */
  let commitShas;
  if (Array.isArray(t.commitShas)) {
    commitShas = t.commitShas.map((s) => String(s).trim()).filter((s) => s !== '');
  }

  /** @type {string[] | undefined} */
  let paths;
  if (Array.isArray(t.paths)) {
    paths = t.paths.map((s) => String(s));
  }

  return {
    taskId: t.taskId != null ? String(t.taskId).trim() : '',
    status: t.status != null ? String(t.status) : undefined,
    commitShas,
    base: t.base != null && String(t.base).trim() !== '' ? String(t.base).trim() : undefined,
    head: t.head != null && String(t.head).trim() !== '' ? String(t.head).trim() : undefined,
    paths,
    verifierCommand:
      t.verifierCommand != null ? String(t.verifierCommand) : undefined,
    exitCode:
      t.exitCode === null
        ? null
        : t.exitCode !== undefined && Number.isFinite(Number(t.exitCode))
          ? Number(t.exitCode)
          : t.exitCode === undefined
            ? undefined
            : /** @type {any} */ (t.exitCode),
    transcript: t.transcript != null ? String(t.transcript) : undefined,
    notes: t.notes != null ? String(t.notes) : undefined,
  };
}

/**
 * Resolve the validated commit range for a single task claim.
 * Prefers explicit base+head; else non-empty commitShas.
 *
 * @param {TaskClaim | null | undefined} claim
 * @returns {ClaimRange | null}
 */
export function claimRangeFromTask(claim) {
  if (claim == null || typeof claim !== 'object') return null;

  const base =
    claim.base != null && String(claim.base).trim() !== ''
      ? String(claim.base).trim()
      : '';
  const head =
    claim.head != null && String(claim.head).trim() !== ''
      ? String(claim.head).trim()
      : '';
  if (base !== '' && head !== '') {
    return { kind: 'range', base, head };
  }

  if (Array.isArray(claim.commitShas) && claim.commitShas.length > 0) {
    const shas = claim.commitShas.map((s) => String(s).trim()).filter((s) => s !== '');
    if (shas.length > 0) {
      return { kind: 'shas', commitShas: shas };
    }
  }

  return null;
}

/**
 * Normalize claim status for allowlist / open checks.
 * Missing/undefined/empty → open (claimed-pass default).
 *
 * @param {TaskClaim | null | undefined} claim
 * @returns {{ raw: string, known: boolean, open: boolean, claimedPass: boolean }}
 */
function normalizeClaimStatus(claim) {
  const raw =
    claim?.status != null ? String(claim.status).trim().toLowerCase() : '';
  if (raw === '') {
    return { raw: '', known: true, open: true, claimedPass: true };
  }
  if (!ALLOWED_CLAIM_STATUSES.has(raw)) {
    return { raw, known: false, open: false, claimedPass: false };
  }
  if (raw === 'blocked' || raw === 'skipped') {
    return { raw, known: true, open: false, claimedPass: false };
  }
  // claimed-pass | claimed-fail
  return {
    raw,
    known: true,
    open: true,
    claimedPass: raw === 'claimed-pass',
  };
}

/**
 * Whether a task status counts as an "open claim" that must have exclusive range.
 * blocked/skipped may omit exclusive SHAs when no commits were made.
 * Unknown statuses are NOT open (they fail validation separately).
 *
 * @param {TaskClaim} claim
 * @returns {boolean}
 */
function isOpenClaim(claim) {
  return normalizeClaimStatus(claim).open;
}

/**
 * Validate a single task claim's required fields (not multi-task exclusivity).
 *
 * @param {TaskClaim | null | undefined} claim
 * @returns {{ ok: boolean, errors: string[], range: ClaimRange | null }}
 */
export function validateTaskClaim(claim) {
  /** @type {string[]} */
  const errors = [];
  if (claim == null || typeof claim !== 'object') {
    return { ok: false, errors: ['claim is missing or not an object'], range: null };
  }

  if (claim.taskId == null || String(claim.taskId).trim() === '') {
    errors.push('taskId is required');
  }

  const statusInfo = normalizeClaimStatus(claim);
  if (!statusInfo.known) {
    errors.push(
      `unknown claim status ${JSON.stringify(claim.status)} — allowed: claimed-pass, claimed-fail, blocked, skipped (or omit)`,
    );
  }

  const open = statusInfo.open;
  const range = claimRangeFromTask(claim);

  if (open && range == null) {
    errors.push(
      'commit identity required: non-empty commitShas[] OR base+head range',
    );
  }

  // Partial range is invalid
  const hasBase = claim.base != null && String(claim.base).trim() !== '';
  const hasHead = claim.head != null && String(claim.head).trim() !== '';
  if (hasBase !== hasHead) {
    errors.push('base and head must both be set for a range (or use commitShas)');
  }

  if (!Array.isArray(claim.paths)) {
    errors.push('paths must be an array');
  } else if (open) {
    // F7: claimed-pass / claimed-fail (open) require ≥1 non-empty path
    const nonEmpty = claim.paths
      .map((p) => String(p).trim())
      .filter((p) => p !== '');
    if (nonEmpty.length < 1) {
      errors.push(
        'paths must contain at least one non-empty path for claimed-pass/claimed-fail',
      );
    }
  }

  if (claim.verifierCommand == null || String(claim.verifierCommand).trim() === '') {
    if (open) {
      errors.push('verifierCommand is required');
    }
  }

  if (claim.exitCode === undefined) {
    if (open) {
      errors.push('exitCode is required (number or null)');
    }
  } else if (claim.exitCode !== null && !Number.isFinite(Number(claim.exitCode))) {
    errors.push('exitCode must be a finite number or null');
  } else if (statusInfo.claimedPass) {
    // F8: claimed-pass (and omit/default open) requires exitCode === 0
    if (claim.exitCode !== 0) {
      errors.push('claimed-pass requires exitCode === 0 (null not allowed on pass)');
    }
  }

  if (claim.transcript === undefined || claim.transcript === null) {
    if (open) {
      errors.push('transcript is required (string; may be empty)');
    }
  } else if (typeof claim.transcript !== 'string') {
    errors.push('transcript must be a string');
  }

  return { ok: errors.length === 0, errors, range };
}

/**
 * Canonical key for a base+head pair (case-insensitive).
 * @param {string} base
 * @param {string} head
 * @returns {string}
 */
function rangePairKey(base, head) {
  return `${String(base).trim().toLowerCase()}...${String(head).trim().toLowerCase()}`;
}

/**
 * Detect ambiguous SHA/endpoint overlap and identical base+head pairs across open claims (F9).
 *
 * Rules:
 * - Every open claim contributes identity tokens to a shared exclusivity pool:
 *   - base and head endpoints (when set)
 *   - each commitShas entry (when set)
 * - Any token claimed by more than one open task is rejected.
 * - Two open claims with the same base+head pair are rejected (identical ranges).
 *
 * Pure-helper limit: full commit-graph overlap (ancestors between base..head)
 * needs git expand post-merge; this only checks token/endpoint identity equality.
 *
 * @param {TaskClaim[]} tasks
 * @returns {string[]} error messages
 */
export function findOverlappingClaimShas(tasks) {
  /** @type {string[]} */
  const errors = [];
  if (!Array.isArray(tasks)) return errors;

  /** @type {Map<string, string[]>} token -> taskIds that claim it */
  const tokenOwners = new Map();
  /** @type {Map<string, string[]>} rangePairKey -> taskIds */
  const rangeOwners = new Map();

  /**
   * @param {string} token
   * @param {string} tid
   */
  function ownToken(token, tid) {
    const key = String(token).trim().toLowerCase();
    if (key === '') return;
    const owners = tokenOwners.get(key) || [];
    if (!owners.includes(tid)) owners.push(tid);
    tokenOwners.set(key, owners);
  }

  for (const claim of tasks) {
    if (claim == null || !isOpenClaim(claim)) continue;
    const tid = String(claim.taskId || '(missing)');
    const range = claimRangeFromTask(claim);

    // Endpoints always contribute when present (even alongside commitShas)
    const base =
      claim.base != null && String(claim.base).trim() !== ''
        ? String(claim.base).trim()
        : '';
    const head =
      claim.head != null && String(claim.head).trim() !== ''
        ? String(claim.head).trim()
        : '';
    if (base !== '') ownToken(base, tid);
    if (head !== '') ownToken(head, tid);

    if (Array.isArray(claim.commitShas)) {
      for (const sha of claim.commitShas) {
        ownToken(String(sha), tid);
      }
    }

    if (range != null && range.kind === 'range') {
      const key = rangePairKey(
        /** @type {string} */ (range.base),
        /** @type {string} */ (range.head),
      );
      const owners = rangeOwners.get(key) || [];
      if (!owners.includes(tid)) owners.push(tid);
      rangeOwners.set(key, owners);
    }
  }

  for (const [pair, owners] of rangeOwners) {
    if (owners.length > 1) {
      errors.push(
        `identical base+head range ${pair} claimed by ${owners.join(', ')} — each open claim needs a distinct base+head pair`,
      );
    }
  }

  for (const [token, owners] of tokenOwners) {
    if (owners.length > 1) {
      errors.push(
        `ambiguous overlapping multi-task SHAs: ${token} claimed by ${owners.join(', ')} — each task needs exclusive commitShas and non-overlapping base/head endpoints (pure helper; full graph overlap needs git expand post-merge)`,
      );
    }
  }

  return errors;
}

/**
 * Validate a full claim report (per-task fields + multi-task exclusivity).
 *
 * @param {ClaimReport | TaskClaim[] | unknown} reportOrRaw
 * @returns {ClaimValidationResult}
 */
export function validateClaimReport(reportOrRaw) {
  const report =
    reportOrRaw != null &&
    typeof reportOrRaw === 'object' &&
    !Array.isArray(reportOrRaw) &&
    Array.isArray(/** @type {ClaimReport} */ (reportOrRaw).tasks)
      ? /** @type {ClaimReport} */ (reportOrRaw)
      : parseClaimReport(reportOrRaw);

  /** @type {string[]} */
  const errors = [];

  if (report == null || !Array.isArray(report.tasks)) {
    return {
      ok: false,
      errors: ['claim report missing or has no tasks[]'],
    };
  }

  if (report.tasks.length === 0) {
    errors.push('claim report tasks[] is empty');
  }

  /** @type {Set<string>} */
  const seenIds = new Set();
  /** @type {Array<{ taskId: string, ok: boolean, errors: string[], range?: ClaimRange }>} */
  const taskResults = [];

  for (const claim of report.tasks) {
    const tid =
      claim?.taskId != null && String(claim.taskId).trim() !== ''
        ? String(claim.taskId)
        : '(missing)';
    if (claim?.taskId != null && String(claim.taskId).trim() !== '') {
      if (seenIds.has(String(claim.taskId))) {
        errors.push(`duplicate taskId in claim report: ${claim.taskId}`);
      }
      seenIds.add(String(claim.taskId));
    }

    const one = validateTaskClaim(claim);
    taskResults.push({
      taskId: tid,
      ok: one.ok,
      errors: one.errors,
      ...(one.range ? { range: one.range } : {}),
    });
    for (const e of one.errors) {
      errors.push(`${tid}: ${e}`);
    }
  }

  const overlap = findOverlappingClaimShas(report.tasks);
  for (const e of overlap) {
    errors.push(e);
  }

  return {
    ok: errors.length === 0,
    errors,
    tasks: taskResults,
  };
}

/**
 * Whether complex-task review may proceed: claim range is validated and exclusive.
 * Convenience for orchestrator Step E.
 *
 * @param {TaskClaim | null | undefined} claim
 * @param {{ allClaims?: TaskClaim[] }} [options]
 * @returns {{ ok: boolean, range: ClaimRange | null, errors: string[] }}
 */
export function validatedRangeForDone(claim, options = {}) {
  const one = validateTaskClaim(claim);
  /** @type {string[]} */
  const errors = [...one.errors];

  if (Array.isArray(options.allClaims) && options.allClaims.length > 0) {
    const overlap = findOverlappingClaimShas(options.allClaims);
    // Only surface overlaps that involve this taskId
    const tid = claim?.taskId != null ? String(claim.taskId) : '';
    for (const e of overlap) {
      if (tid === '' || e.includes(tid)) {
        errors.push(e);
      }
    }
  }

  return {
    ok: errors.length === 0 && one.range != null,
    range: one.range,
    errors,
  };
}

/**
 * Post-merge reachability gate (pure): every open claim's commit identity must be
 * reachable on the plan branch (ancestors of HEAD / present in the reachable set).
 *
 * Orchestrator should collect reachable SHAs after merge settle, e.g.:
 *   git rev-parse HEAD
 *   git merge-base --is-ancestor <sha> HEAD   (exit 0 ⇒ reachable)
 * then pass a Set of known-good SHAs or a predicate `(sha) => boolean`.
 *
 * Missing or non-ancestor claims are rejected — do not run verifier/`done` until
 * the claim set is reachable on the merged plan tree.
 *
 * @param {ClaimReport | TaskClaim[] | unknown} reportOrRaw
 * @param {Iterable<string> | ((sha: string) => boolean)} reachable
 *   Set/list of reachable object ids, or predicate returning true when a sha is
 *   an ancestor of plan-branch HEAD (or otherwise present on the merged tree).
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateClaimReachability(reportOrRaw, reachable) {
  const report =
    reportOrRaw != null &&
    typeof reportOrRaw === 'object' &&
    !Array.isArray(reportOrRaw) &&
    Array.isArray(/** @type {ClaimReport} */ (reportOrRaw).tasks)
      ? /** @type {ClaimReport} */ (reportOrRaw)
      : parseClaimReport(reportOrRaw);

  /** @type {string[]} */
  const errors = [];

  if (report == null || !Array.isArray(report.tasks)) {
    return {
      ok: false,
      errors: ['claim report missing or has no tasks[]'],
    };
  }

  /** @type {(sha: string) => boolean} */
  let isReachable;
  if (typeof reachable === 'function') {
    isReachable = reachable;
  } else if (reachable != null && typeof reachable[Symbol.iterator] === 'function') {
    // Exact match only (case-insensitive hex equality). No free prefix/startsWith.
    const set = new Set(
      [...reachable]
        .map((s) => String(s).trim().toLowerCase())
        .filter((s) => s !== ''),
    );
    isReachable = (sha) => set.has(String(sha).trim().toLowerCase());
  } else {
    return {
      ok: false,
      errors: ['reachable set or predicate is required'],
    };
  }

  for (const claim of report.tasks) {
    if (claim == null || !isOpenClaim(claim)) continue;
    const tid =
      claim.taskId != null && String(claim.taskId).trim() !== ''
        ? String(claim.taskId)
        : '(missing)';
    const range = claimRangeFromTask(claim);
    if (range == null) {
      // Field validation is separate; reachability only checks known identities
      continue;
    }
    if (range.kind === 'range') {
      for (const [label, sha] of [
        ['base', range.base],
        ['head', range.head],
      ]) {
        if (sha == null || String(sha).trim() === '') continue;
        if (!isReachable(String(sha))) {
          errors.push(
            `${tid}: ${label} ${sha} is not reachable on the plan branch (missing or non-ancestor of HEAD)`,
          );
        }
      }
    } else if (range.kind === 'shas') {
      for (const sha of range.commitShas || []) {
        if (!isReachable(String(sha))) {
          errors.push(
            `${tid}: commit ${sha} is not reachable on the plan branch (missing or non-ancestor of HEAD)`,
          );
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
