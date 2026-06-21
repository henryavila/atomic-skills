import { findInitiative, findPlan, firstUnblockedPendingTask, getInitiatives, tasksFor } from './_lib.js'

// Compute the next recommended action. Ported from aideck
// src/server/projections/next-action.ts (reads the pre-loaded data map instead
// of the filesystem). Read-only — writes nothing.
//
// `projectId` (F-001): every record carries an aiDeck-injected projectId. When
// given, every resolution path is scoped to it — explicit slug lookups, the
// currentPhase match, and the global active-initiative fallback — so a slug
// that collides across projects can't leak a different project's task.
export default async function handler({ args, data }) {
  const { planSlug, initiativeSlug, projectId } = args
  const initiatives = getInitiatives(data)
  const inProject = (r) => projectId == null || r.projectId === projectId

  if (initiativeSlug) {
    // Explicit scope: findInitiative throws on missing (caller error, not a cue to
    // fall back to another initiative) and on a projectId-ambiguous slug.
    const i = findInitiative(data, initiativeSlug, projectId)
    const t = firstUnblockedPendingTask(tasksFor(data, i))
    if (t) {
      return {
        initiativeSlug: i.slug,
        taskId: t.id,
        description: t.title,
        rationale: 'first unblocked pending task in initiative',
      }
    }
    return {
      initiativeSlug: i.slug,
      description: 'No next action — all tasks done or blocked',
      rationale: 'no unblocked pending task remains in this initiative',
    }
  }

  if (planSlug) {
    const plan = findPlan(data, planSlug, projectId)
    if (plan.currentPhase) {
      // Scope the current-phase initiative to the SAME project as the resolved
      // plan — a same-named parentPlan in another project must not match.
      const mi = initiatives.find(
        (i) => i.projectId === plan.projectId && i.parentPlan === plan.slug && i.phaseId === plan.currentPhase,
      )
      if (mi) {
        const t = firstUnblockedPendingTask(tasksFor(data, mi))
        if (t) {
          return {
            planSlug: plan.slug,
            initiativeSlug: mi.slug,
            taskId: t.id,
            description: t.title,
            rationale: `from currentPhase ${plan.currentPhase} of plan ${plan.slug}`,
          }
        }
      }
    }
    // Plan resolved but has no actionable task — stay scoped to the plan instead
    // of falling through to a different plan's active initiative.
    return {
      planSlug: plan.slug,
      description: 'No next action — no unblocked pending task in the plan\'s current phase',
      rationale: plan.currentPhase
        ? `currentPhase ${plan.currentPhase} of plan ${plan.slug} has no unblocked pending task`
        : `plan ${plan.slug} has no currentPhase set`,
    }
  }

  // Scan ALL active initiatives (in scope), not just the first: the first active
  // one may have no actionable task while a later active one does. Stopping at the
  // first would falsely report "no next action" and skip real work.
  for (const active of initiatives.filter((i) => i.status === 'active' && inProject(i))) {
    const t = firstUnblockedPendingTask(tasksFor(data, active))
    if (t) {
      return {
        initiativeSlug: active.slug,
        taskId: t.id,
        description: t.title,
        rationale: `from first active initiative ${active.slug}`,
      }
    }
  }

  return {
    description: 'No next action — no active initiative with unblocked pending tasks',
    rationale: 'all initiatives done, paused, or all tasks blocked',
  }
}
