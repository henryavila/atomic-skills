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

/**
 * Compose, but never execute, the retroactive worktree-add command for a
 * pre-existing active plan. `baseRef` must be the source-ref captured before
 * the entering plan writes anything, so the retroactive tree is seeded from
 * the pre-mutation ref instead of a post-mutation HEAD.
 */
export function retroactiveWorktreeAdd({ slug, baseRef } = {}) {
  if (!slug) throw new Error('plan-branch-policy: retroactiveWorktreeAdd requires a slug');

  const capturedBaseRef = typeof baseRef === 'string' ? baseRef.trim() : baseRef;
  if (!capturedBaseRef) {
    throw new Error('plan-branch-policy: retroactiveWorktreeAdd requires a captured baseRef from before the entering plan writes anything');
  }

  return `git worktree add -b ${planBranchName(slug)} .worktrees/${slug} ${capturedBaseRef}`;
}
