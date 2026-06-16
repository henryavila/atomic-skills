/**
 * plan-branch-policy.js — deterministic branch policy for plan creation.
 *
 * A plan branch is focus-bookkeeping, not a feature branch. Solo plan creation
 * keeps `branch: null` in the current tree; a new `plan/<slug>` branch is born
 * only when at least one other active plan already exists.
 */

/** Return true when a new plan is born into an already-active concurrent front. */
export function shouldForkPlanBranch(activePlans) {
  return Array.isArray(activePlans) && activePlans.length >= 1;
}

/** Return the canonical bookkeeping branch name for a plan slug. */
export function planBranchName(slug) {
  if (!slug) throw new Error('plan-branch-policy: <slug> is required');
  return `plan/${slug}`;
}
