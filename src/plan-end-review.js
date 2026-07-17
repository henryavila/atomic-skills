/**
 * Pure plan-end review and user-validation predicates (design D7, D9, D12).
 *
 * planEndReviewOk =
 *   receipt exists
 *   AND (
 *     (
 *       count(succeeded family-different external legs) ≥ 1
 *       AND non-empty reviewFile
 *       AND mode is 'external-both' | 'both'
 *       AND non-empty verifiedAt (ISO preferred / Date.parse finite)
 *     )
 *     OR explicit skipPlanEndReview with non-empty reason
 *   )
 *
 * A leg counts ONLY when ALL of:
 *   - status === 'succeeded'
 *   - familyDifferent === true (strict boolean; missing is NOT true)
 *   - provider is a known external ('codex' | 'grok')
 *
 * userValidationOk: under automateActive === true, require a non-empty
 * ISO-8601-ish timestamp in userValidatedAt. When automate is not active
 * the gate does not apply (returns true).
 *
 * automatePlanEndGatesOk is fail-closed on the automate stamp: when
 * planExecutionMode (or isAutomateActive signals) imply automate, gates
 * enforce even if automateActive is omitted. Explicit non-automate CLI
 * still overrides stamp via isAutomateActive (design M4). When clearly
 * non-automate, ok is true.
 *
 * Finalize/archive under automate HARD-BLOCK unless BOTH planEndReviewOk
 * and userValidationOk are true (see automatePlanEndGatesOk). Receipt files
 * land under `.atomic-skills/reviews/` and are linked from the plan
 * `## Reviews` section; frontmatter may carry a machine-readable
 * `planEndReview` object (finalize-shaped receipt) plus `userValidatedAt`.
 *
 * No I/O.
 */

import { isAutomateActive } from './implement-mode.js';

const KNOWN_EXTERNAL_PROVIDERS = new Set(['codex', 'grok']);

/** Modes accepted on a non-skip plan-end receipt (host routes may stamp either). */
const PLAN_END_OK_MODES = new Set(['external-both', 'both']);

/**
 * Guided `--skip-plan-end-review` reason taxonomy (non-empty required).
 * Operators may use free-form reasons; these tokens are the recommended
 * vocabulary when zero family-different providers remain or residual risk
 * is accepted — never strand a plan without a durable reason.
 */
export const SKIP_PLAN_END_REASON_TAXONOMY = Object.freeze([
  'no-family-different-provider',
  'external-providers-unavailable',
  'operator-accepted-residual-risk',
  'single-external-leg-already-reviewed-at-phase',
]);

/**
 * Basic ISO-8601-ish: full date (YYYY-MM-DD) optionally with time (T...).
 * Rejects bare words like "ok"/"yes" and pure numeric strings.
 */
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}(?:[Tt ][\d:.+-Zz]+)?$/;

/**
 * @typedef {{
 *   provider?: 'codex' | 'grok' | string,
 *   status: 'succeeded' | 'failed' | 'skipped' | string,
 *   familyDifferent?: boolean,
 * }} PlanEndReviewLeg
 *
 * Finalize-shaped receipt: durable machine fields plus optional metadata
 * written by finalize/plan-end (`reviewFile`, `mode`, `range`, `verifiedAt`).
 * Extra keys are ignored by planEndReviewOk.
 *
 * @typedef {{
 *   legs?: PlanEndReviewLeg[],
 *   skipPlanEndReview?: boolean,
 *   skipReason?: string,
 *   reviewFile?: string,
 *   mode?: string,
 *   range?: string,
 *   verifiedAt?: string,
 * }} PlanEndReviewReceipt
 */

/**
 * Whether a single external review leg counts toward planEndReviewOk.
 * Fail-closed: requires succeeded + familyDifferent === true + known external provider.
 * @param {PlanEndReviewLeg | null | undefined} leg
 * @returns {boolean}
 */
function legCountsAsSucceededFamilyDifferent(leg) {
  if (leg == null || typeof leg !== 'object') return false;
  if (leg.status !== 'succeeded') return false;
  if (leg.familyDifferent !== true) return false;
  const provider = leg.provider != null ? String(leg.provider).trim().toLowerCase() : '';
  if (!KNOWN_EXTERNAL_PROVIDERS.has(provider)) return false;
  return true;
}

/**
 * Non-skip success path requires durable receipt shape fields.
 * @param {PlanEndReviewReceipt} receipt
 * @returns {boolean}
 */
function receiptShapeOk(receipt) {
  const reviewFile =
    receipt.reviewFile != null ? String(receipt.reviewFile).trim() : '';
  if (reviewFile === '') return false;

  const mode =
    receipt.mode != null ? String(receipt.mode).trim().toLowerCase() : '';
  if (!PLAN_END_OK_MODES.has(mode)) return false;

  const verifiedAt =
    receipt.verifiedAt != null ? String(receipt.verifiedAt).trim() : '';
  if (verifiedAt === '') return false;
  // ISO preferred; accept non-empty with finite Date.parse (v1).
  if (isIsoTimestamp(verifiedAt)) return true;
  return Number.isFinite(Date.parse(verifiedAt));
}

/**
 * Machine-checkable plan-end external review predicate (HARD-BLOCK finalize/archive).
 *
 * Accepts a bare receipt or a finalize-shaped object.
 * CLI flag name in skill prose: `--skip-plan-end-review` maps to
 * `skipPlanEndReview: true` + non-empty `skipReason` on the durable receipt.
 *
 * Non-skip path requires ≥1 succeeded family-different known-provider leg
 * AND non-empty reviewFile + mode in {external-both, both} + non-empty verifiedAt.
 * Skip path needs only skipPlanEndReview + non-empty reason (legs/shape optional).
 *
 * @param {PlanEndReviewReceipt | null | undefined} receipt
 * @returns {boolean}
 */
export function planEndReviewOk(receipt) {
  if (receipt == null || typeof receipt !== 'object') {
    return false;
  }

  if (receipt.skipPlanEndReview === true) {
    const reason = receipt.skipReason;
    if (reason != null && String(reason).trim() !== '') {
      return true;
    }
  }

  const legs = Array.isArray(receipt.legs) ? receipt.legs : [];
  const succeededCount = legs.filter(legCountsAsSucceededFamilyDifferent).length;
  if (succeededCount >= 1 && receiptShapeOk(receipt)) {
    return true;
  }

  return false;
}

/**
 * Whether a string is a usable ISO-8601-ish timestamp for userValidatedAt.
 * @param {string} s
 * @returns {boolean}
 */
function isIsoTimestamp(s) {
  if (typeof s !== 'string') return false;
  const trimmed = s.trim();
  if (trimmed === '') return false;
  if (!ISO_TIMESTAMP_RE.test(trimmed)) return false;
  return Number.isFinite(Date.parse(trimmed));
}

/**
 * Resolve whether automate plan-end gates apply.
 * Fail-closed on stamp: planExecutionMode automate (via isAutomateActive)
 * enforces even when automateActive is omitted. Explicit --mode=1 / clear
 * still overrides stamp. Legacy automateActive: true alone still activates.
 *
 * @param {{
 *   automateActive?: boolean,
 *   planExecutionMode?: string | null,
 *   cliMode?: string | null,
 *   clearExecutionMode?: boolean,
 * }} input
 * @returns {boolean}
 */
function resolveAutomateActiveForGates(input = {}) {
  if (input.clearExecutionMode === true) {
    return false;
  }
  if (input.automateActive === true) {
    return true;
  }
  const hasModeSignals =
    (input.planExecutionMode != null && String(input.planExecutionMode).trim() !== '') ||
    (input.cliMode != null && String(input.cliMode).trim() !== '');
  if (hasModeSignals) {
    return isAutomateActive({
      cliMode: input.cliMode,
      planExecutionMode: input.planExecutionMode,
      clearExecutionMode: input.clearExecutionMode,
    });
  }
  return false;
}

/**
 * Operator validation gate before finalize/archive under automate.
 *
 * When automate is not active, returns true (gate does not apply).
 * Activation: automateActive === true, OR planExecutionMode/cliMode via
 * isAutomateActive (stamp alone fail-closes). Under automate, userValidatedAt
 * must be a non-empty ISO-8601-ish timestamp.
 *
 * @param {{
 *   automateActive?: boolean,
 *   planExecutionMode?: string | null,
 *   cliMode?: string | null,
 *   clearExecutionMode?: boolean,
 *   userValidatedAt?: string | null,
 *   validatorId?: string | null,
 * }} [input]
 * @returns {boolean}
 */
export function userValidationOk(input = {}) {
  if (!resolveAutomateActiveForGates(input)) {
    return true;
  }

  const at = input.userValidatedAt;
  if (at == null) return false;
  if (typeof at !== 'string') return false;
  return isIsoTimestamp(at);
}

/**
 * Combined finalize/archive gate under automate (design D7 + D9 + D12).
 *
 * When automate is not active, both sub-gates are inactive → ok: true.
 * Under automate (explicit automateActive or stamp/CLI via isAutomateActive),
 * HARD-BLOCK unless planEndReviewOk(receipt) AND userValidationOk.
 *
 * @param {{
 *   automateActive?: boolean,
 *   planExecutionMode?: string | null,
 *   cliMode?: string | null,
 *   clearExecutionMode?: boolean,
 *   receipt?: PlanEndReviewReceipt | null,
 *   userValidatedAt?: string | null,
 *   validatorId?: string | null,
 * }} [input]
 * @returns {{
 *   ok: boolean,
 *   planEndReviewOk: boolean,
 *   userValidationOk: boolean,
 * }}
 */
export function automatePlanEndGatesOk(input = {}) {
  if (!resolveAutomateActiveForGates(input)) {
    return {
      ok: true,
      planEndReviewOk: true,
      userValidationOk: true,
    };
  }

  const pe = planEndReviewOk(input.receipt);
  const uv = userValidationOk({
    automateActive: true,
    userValidatedAt: input.userValidatedAt,
    validatorId: input.validatorId,
  });
  return {
    ok: pe && uv,
    planEndReviewOk: pe,
    userValidationOk: uv,
  };
}
