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
 * A leg counts if status === 'succeeded' AND (familyDifferent !== false)
 * — missing familyDifferent is treated as true for external legs.
 *
 * userValidationOk: under automate, require non-empty userValidatedAt;
 * when automate is off the gate does not apply (returns true).
 *
 * No I/O.
 */

/**
 * @typedef {{
 *   provider?: 'codex' | 'grok' | string,
 *   status: 'succeeded' | 'failed' | 'skipped' | string,
 *   familyDifferent?: boolean,
 * }} PlanEndReviewLeg
 *
 * @typedef {{
 *   legs?: PlanEndReviewLeg[],
 *   skipPlanEndReview?: boolean,
 *   skipReason?: string,
 * }} PlanEndReviewReceipt
 */

/**
 * Whether a single external review leg counts toward planEndReviewOk.
 * @param {PlanEndReviewLeg | null | undefined} leg
 * @returns {boolean}
 */
function legCountsAsSucceededFamilyDifferent(leg) {
  if (leg == null || typeof leg !== 'object') return false;
  if (leg.status !== 'succeeded') return false;
  // missing familyDifferent ⇒ treat as true for external legs
  if (leg.familyDifferent === false) return false;
  return true;
}

/**
 * Machine-checkable plan-end external review predicate (HARD-BLOCK finalize/archive).
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
 * Operator validation gate before finalize/archive under automate.
 * When automate is inactive, returns true (gate does not apply).
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
  if (at.trim() === '') return false;
  return true;
}
