/**
 * Pure claim-report parse + validation for automate phase writers (design D6 / F2 T-008).
 *
 * A claim is confidence from the code-only phase writer — never closure.
 * Orchestrator validates each task claim before re-verify / complex review / done.
 *
 * Required per-task fields:
 *   - taskId
 *   - commit identity: non-empty commitShas[] OR (base + head) range
 *   - paths (array; may be empty only when status is blocked/skipped with notes)
 *   - verifierCommand
 *   - exitCode (number or null)
 *   - transcript (string; may be empty)
 *
 * Multi-task exclusivity (HARD):
 *   Each open claim needs an exclusive commit range or a SHA list that is NOT
 *   shared across other open claims without a base/head pair. Ambiguous
 *   overlapping multi-task SHAs are rejected so review-code / destructiveDiff
 *   cannot pin the wrong range.
 *
 * No I/O.
 */

/** @typedef {'claimed-pass' | 'claimed-fail' | 'blocked' | 'skipped' | string} ClaimStatus */

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

const OPEN_CLAIM_STATUSES = new Set(['claimed-pass', 'claimed-fail', undefined, null, '']);

/**
 * Normalize a free-form claim report (array of tasks or envelope with tasks[]).
 * Pure — does not validate.
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
    return { tasks: raw.map(normalizeTaskClaim).filter(Boolean) };
  }

  if (typeof raw !== 'object') return null;

  const obj = /** @type {Record<string, unknown>} */ (raw);
  const tasksRaw = Array.isArray(obj.tasks)
    ? obj.tasks
    : Array.isArray(obj.claimReport?.tasks)
      ? obj.claimReport.tasks
      : null;

  if (tasksRaw == null) {
    // Single task object with taskId
    if (obj.taskId != null) {
      const task = normalizeTaskClaim(obj);
      return task ? { tasks: [task] } : null;
    }
    return null;
  }

  return {
    planSlug: obj.planSlug != null ? String(obj.planSlug) : undefined,
    phaseId: obj.phaseId != null ? String(obj.phaseId) : undefined,
    worktreePath: obj.worktreePath != null ? String(obj.worktreePath) : undefined,
    writerBranch: obj.writerBranch != null ? String(obj.writerBranch) : undefined,
    finishedAt: obj.finishedAt != null ? String(obj.finishedAt) : undefined,
    tasks: tasksRaw.map(normalizeTaskClaim).filter(Boolean),
  };
}

/**
 * @param {unknown} raw
 * @returns {TaskClaim | null}
 */
function normalizeTaskClaim(raw) {
  if (raw == null || typeof raw !== 'object') return null;
  const t = /** @type {Record<string, unknown>} */ (raw);
  if (t.taskId == null || String(t.taskId).trim() === '') return null;

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
    taskId: String(t.taskId).trim(),
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
 * Whether a task status counts as an "open claim" that must have exclusive range.
 * blocked/skipped may omit exclusive SHAs when no commits were made.
 *
 * @param {TaskClaim} claim
 * @returns {boolean}
 */
function isOpenClaim(claim) {
  const status = claim.status != null ? String(claim.status).trim().toLowerCase() : '';
  if (status === 'blocked' || status === 'skipped') return false;
  return OPEN_CLAIM_STATUSES.has(claim.status) || status === 'claimed-pass' || status === 'claimed-fail' || status === '';
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

  const open = isOpenClaim(claim);
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
 * Detect ambiguous SHA overlap across open claims.
 *
 * Rules:
 * - Tasks with exclusive base+head ranges do not contribute bare SHAs to the
 *   shared pool (they are treated as range-identified).
 * - Tasks with only commitShas must not share any SHA with another open claim's
 *   commitShas list (ambiguous multi-task ownership).
 * - A SHA that appears in two open sha-lists without base/head on either side
 *   is rejected.
 *
 * @param {TaskClaim[]} tasks
 * @returns {string[]} error messages
 */
export function findOverlappingClaimShas(tasks) {
  /** @type {string[]} */
  const errors = [];
  if (!Array.isArray(tasks)) return errors;

  /** @type {Map<string, string[]>} sha -> taskIds that claim it via bare commitShas */
  const shaOwners = new Map();

  for (const claim of tasks) {
    if (claim == null || !isOpenClaim(claim)) continue;
    const range = claimRangeFromTask(claim);
    if (range == null) continue;
    // Exclusive base+head: no bare-SHA exclusivity check against other lists.
    if (range.kind === 'range') continue;

    const tid = String(claim.taskId);
    for (const sha of range.commitShas || []) {
      const key = String(sha);
      const owners = shaOwners.get(key) || [];
      if (!owners.includes(tid)) owners.push(tid);
      shaOwners.set(key, owners);
    }
  }

  for (const [sha, owners] of shaOwners) {
    if (owners.length > 1) {
      errors.push(
        `ambiguous overlapping multi-task SHAs: ${sha} claimed by ${owners.join(', ')} — each task needs an exclusive commitShas list or a base+head range not shared across open claims`,
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
    const tid = claim?.taskId != null ? String(claim.taskId) : '(missing)';
    if (claim?.taskId != null) {
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
    const set = new Set(
      [...reachable].map((s) => String(s).trim()).filter((s) => s !== ''),
    );
    isReachable = (sha) => {
      const key = String(sha).trim();
      if (set.has(key)) return true;
      // Allow prefix match when set holds full SHAs and claims hold short SHAs (or reverse)
      for (const known of set) {
        if (known.startsWith(key) || key.startsWith(known)) return true;
      }
      return false;
    };
  } else {
    return {
      ok: false,
      errors: ['reachable set or predicate is required'],
    };
  }

  for (const claim of report.tasks) {
    if (claim == null || !isOpenClaim(claim)) continue;
    const tid = claim.taskId != null ? String(claim.taskId) : '(missing)';
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
