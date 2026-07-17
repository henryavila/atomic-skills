/**
 * Pure plan-end review and user-validation predicates (design D7, D9, D12).
 *
 * planEndReviewOk =
 *   receipt exists
 *   AND (
 *     count(succeeded family-different external legs) ≥ 1
 *     OR explicit skipPlanEndReview with non-empty reason
 *   )
 *
 * A leg counts ONLY when ALL of:
 *   - status === 'succeeded'
 *   - familyDifferent === true (strict boolean; missing is NOT true)
 *   - provider is a known external ('codex' | 'grok')
 *
 * userValidationOk: under automateActive === true, require a non-empty
 * ISO-8601-ish timestamp in userValidatedAt. When automateActive !== true
 * the gate does not apply (returns true). Callers MUST pass an explicit
 * boolean for automateActive when evaluating automate gates — omission
 * means the gate is inactive (non-automate path), not fail-closed.
 *
 * Finalize/archive under automate HARD-BLOCK unless BOTH planEndReviewOk
 * and userValidationOk are true (see automatePlanEndGatesOk). Receipt files
 * land under `.atomic-skills/reviews/` and are linked from the plan
 * `## Reviews` section; frontmatter may carry a machine-readable
 * `planEndReview` object (finalize-shaped receipt) plus `userValidatedAt`.
 *
 * No I/O.
 */

const KNOWN_EXTERNAL_PROVIDERS = new Set(['codex', 'grok']);

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
 * Machine-checkable plan-end external review predicate (HARD-BLOCK finalize/archive).
 *
 * Accepts a bare receipt or a finalize-shaped object (extra metadata ignored).
 * CLI flag name in skill prose: `--skip-plan-end-review` maps to
 * `skipPlanEndReview: true` + non-empty `skipReason` on the durable receipt.
 *
 * @param {PlanEndReviewReceipt | null | undefined} receipt
 * @returns {boolean}
 */
export function planEndReviewOk(receipt) {
  if (receipt == null || typeof receipt !== 'object') {
    return false;
  }

  const legs = Array.isArray(receipt.legs) ? receipt.legs : [];
  const succeededCount = legs.filter(legCountsAsSucceededFamilyDifferent).length;
  if (succeededCount >= 1) {
    return true;
  }

  if (receipt.skipPlanEndReview === true) {
    const reason = receipt.skipReason;
    if (reason != null && String(reason).trim() !== '') {
      return true;
    }
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
 * Operator validation gate before finalize/archive under automate.
 *
 * When automateActive !== true, returns true (gate does not apply).
 * Callers evaluating automate gates MUST pass automateActive: true explicitly;
 * omitting automateActive (or passing false/undefined) leaves the gate inactive
 * so non-automate paths are not broken by a fail-closed default.
 *
 * Under automateActive === true, userValidatedAt must be a non-empty
 * ISO-8601-ish timestamp (Date.parse finite + basic ISO pattern).
 *
 * @param {{
 *   automateActive?: boolean,
 *   userValidatedAt?: string | null,
 *   validatorId?: string | null,
 * }} [input]
 * @returns {boolean}
 */
export function userValidationOk(input = {}) {
  if (input.automateActive !== true) {
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
 * When automateActive !== true, both sub-gates are inactive → ok: true.
 * Under automate, HARD-BLOCK unless planEndReviewOk(receipt) AND
 * userValidationOk({ automateActive: true, userValidatedAt }).
 *
 * @param {{
 *   automateActive?: boolean,
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
  if (input.automateActive !== true) {
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
