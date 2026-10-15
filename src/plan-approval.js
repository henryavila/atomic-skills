/**
 * Plan approval stamp — the cut from interactive `project` into the
 * orchestrator tick. Operator-owned. Never writes `userValidatedAt`.
 *
 * `planApprovedAt` is an ISO timestamp on plan frontmatter. Absent or
 * non-ISO means the tick must refuse. Schema: meta/schemas/plan.schema.json.
 */

const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}(?:[Tt ][\d:.+-Zz]+)?$/;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlanApprovalTimestamp(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  if (!ISO_TIMESTAMP_RE.test(trimmed)) return false;
  return Number.isFinite(Date.parse(trimmed));
}

/**
 * @param {{ planApprovedAt?: string | null } | null | undefined} plan
 * @returns {{ ok: true, planApprovedAt: string } | { ok: false, reason: 'plan-not-approved' }}
 */
export function planApprovalAllowsImplement(plan) {
  const at = plan && typeof plan === 'object' ? plan.planApprovedAt : null;
  if (isPlanApprovalTimestamp(at)) {
    return { ok: true, planApprovedAt: String(at).trim() };
  }
  return { ok: false, reason: 'plan-not-approved' };
}

/**
 * Immutable stamp. Does not set or clear `userValidatedAt`.
 * @param {Record<string, unknown>} plan
 * @param {string} at ISO timestamp of the user's plan acceptance
 * @returns {Record<string, unknown>}
 */
export function stampPlanApproval(plan, at) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('stampPlanApproval: plan is required');
  }
  if (!isPlanApprovalTimestamp(at)) {
    throw new Error('stampPlanApproval: planApprovedAt must be an ISO timestamp');
  }
  return { ...plan, planApprovedAt: String(at).trim() };
}

/**
 * Immutable clear of `planApprovedAt`.
 * @param {Record<string, unknown>} plan
 * @returns {Record<string, unknown>}
 */
export function clearPlanApproval(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('clearPlanApproval: plan is required');
  }
  const next = { ...plan };
  delete next.planApprovedAt;
  return next;
}
