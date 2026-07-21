/**
 * Pure complex-task predicate for automate-mode review gates (design D6).
 *
 * complex = weight >= threshold (default 3)
 *        OR tags ∩ {destructive, decommission, drop, complex} ≠ ∅
 *        OR destructiveDiff === true
 *
 * Under automate, callers compute `destructiveDiff` from the **validated claim
 * commit range** (`src/claim-report.js` → `validatedRangeForDone` / base+head
 * or exclusive commitShas) using the review-code DESTRUCTIVE heuristic, then
 * pass the boolean here. Do not invent destructiveDiff without a pinned range.
 *
 * No I/O. Shared by implement, phase-done hooks, and transitions.
 */

/** Default weight threshold for complex classification under automate. */
export const DEFAULT_COMPLEX_WEIGHT_THRESHOLD = 3;

/**
 * Tags that force complex classification (case-insensitive match).
 * @type {readonly string[]}
 */
export const COMPLEX_TAGS = Object.freeze([
  'destructive',
  'decommission',
  'drop',
  'complex',
]);

const COMPLEX_TAG_SET = new Set(COMPLEX_TAGS);

/**
 * Whether a task is "complex" and requires CROSS-MODEL REVIEW before close
 * under automate mode.
 *
 * @param {{
 *   weight?: number | string | null,
 *   tags?: string[] | null,
 *   destructiveDiff?: boolean | null,
 * } | null | undefined} task
 * @param {{ threshold?: number | string }} [options]
 * @returns {boolean}
 */
export function isComplexTask(task, options = {}) {
  if (task == null || typeof task !== 'object') {
    return false;
  }

  const threshold =
    options.threshold != null && Number.isFinite(Number(options.threshold))
      ? Number(options.threshold)
      : DEFAULT_COMPLEX_WEIGHT_THRESHOLD;

  if (task.destructiveDiff === true) {
    return true;
  }

  if (Array.isArray(task.tags)) {
    for (const raw of task.tags) {
      if (raw == null) continue;
      const tag = String(raw).trim().toLowerCase();
      if (COMPLEX_TAG_SET.has(tag)) {
        return true;
      }
    }
  }

  // Coerce finite numeric strings the same way as threshold (e.g. weight: '3').
  if (task.weight != null && task.weight !== '') {
    const weight = Number(task.weight);
    if (Number.isFinite(weight) && weight >= threshold) {
      return true;
    }
  }

  return false;
}

/** Modes accepted on a durable complex-task review receipt (per-task both). */
const COMPLEX_DONE_BOTH_MODES = new Set([
  'both',
  'both-codex',
  'both-grok',
  'both-claude',
]);

const COMPLEX_DONE_DISPOSITIONS = new Set(['accept', 'defer', 'fix']);

/**
 * Complex-before-done gate under automate (design D6 / F2 claim-bound close).
 *
 * - **Non-complex** → verifier-only path (`ok`, no receipt required).
 * - **Complex** → requires a durable review receipt with mode `both` (or
 *   both-*) and a non-empty `reviewFile`, **or** an operator-recorded skip
 *   (`operatorSkip` / receipt skip) with disposition `accept|defer|fix` and
 *   a non-empty reason.
 *
 * Pure — does not spawn review-code, does not force complex both on
 * non-automate callers (orchestrator only invokes this under stamp).
 *
 * @param {{
 *   task?: {
 *     weight?: number | string | null,
 *     tags?: string[] | null,
 *     destructiveDiff?: boolean | null,
 *   } | null,
 *   reviewReceipt?: {
 *     mode?: string | null,
 *     reviewFile?: string | null,
 *     receiptPath?: string | null,
 *     path?: string | null,
 *     verifiedAt?: string | null,
 *     operatorSkip?: boolean | null,
 *     skipReview?: boolean | null,
 *     disposition?: string | null,
 *     reason?: string | null,
 *     skipReason?: string | null,
 *     maxSeverity?: string | null,
 *     severity?: string | null,
 *   } | null,
 *   operatorSkip?: boolean | null,
 *   disposition?: string | null,
 *   reason?: string | null,
 *   complexOptions?: { threshold?: number | string },
 * }} [input]
 * @returns {{
 *   ok: boolean,
 *   complex: boolean,
 *   path?: 'verifier-only' | 'both-receipt' | 'operator-disposition',
 *   reason?: string,
 * }}
 */
export function complexTaskAllowsDone(input = {}) {
  const complex = isComplexTask(input.task, input.complexOptions);
  if (!complex) {
    return { ok: true, complex: false, path: 'verifier-only' };
  }

  const receipt =
    input.reviewReceipt != null && typeof input.reviewReceipt === 'object'
      ? input.reviewReceipt
      : null;

  const operatorSkip =
    input.operatorSkip === true ||
    (receipt != null &&
      (receipt.operatorSkip === true || receipt.skipReview === true));

  const dispositionRaw =
    input.disposition != null
      ? input.disposition
      : receipt != null
        ? receipt.disposition
        : null;
  const disposition =
    dispositionRaw != null ? String(dispositionRaw).trim().toLowerCase() : '';

  const reasonRaw =
    input.reason != null
      ? input.reason
      : receipt != null
        ? (receipt.reason ?? receipt.skipReason)
        : null;
  const reason = reasonRaw != null ? String(reasonRaw).trim() : '';

  if (operatorSkip) {
    if (!COMPLEX_DONE_DISPOSITIONS.has(disposition)) {
      return {
        ok: false,
        complex: true,
        reason:
          'complex task operator skip requires disposition accept|defer|fix before done',
      };
    }
    if (reason === '') {
      return {
        ok: false,
        complex: true,
        reason:
          'complex task operator skip requires non-empty reason with disposition',
      };
    }
    return { ok: true, complex: true, path: 'operator-disposition' };
  }

  if (receipt == null) {
    return {
      ok: false,
      complex: true,
      reason:
        'complex task requires durable review receipt mode both (or operator disposition skip) before done',
    };
  }

  const mode =
    receipt.mode != null ? String(receipt.mode).trim().toLowerCase() : '';
  if (!COMPLEX_DONE_BOTH_MODES.has(mode)) {
    return {
      ok: false,
      complex: true,
      reason: `complex task requires review receipt mode both (got ${mode || 'missing'})`,
    };
  }

  const reviewFileRaw =
    receipt.reviewFile ?? receipt.receiptPath ?? receipt.path;
  const reviewFile =
    reviewFileRaw != null ? String(reviewFileRaw).trim() : '';
  if (reviewFile === '') {
    return {
      ok: false,
      complex: true,
      reason:
        'complex task requires non-empty reviewFile on durable both-mode receipt',
    };
  }

  // Severity gate when present on receipt (optional shape).
  const severityRaw = receipt.maxSeverity ?? receipt.severity;
  if (severityRaw != null && String(severityRaw).trim() !== '') {
    const sev = String(severityRaw).trim().toLowerCase();
    if (sev === 'blocker' || sev === 'critical' || sev === 'major') {
      if (!COMPLEX_DONE_DISPOSITIONS.has(disposition)) {
        return {
          ok: false,
          complex: true,
          reason: `complex review severity ${sev} blocks done without disposition accept|defer|fix`,
        };
      }
    }
  }

  return { ok: true, complex: true, path: 'both-receipt' };
}
