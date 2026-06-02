import { firstUnblockedPendingTask, getInitiatives, getPlans } from './_lib.js'

// Compute the next recommended action. Ported from aideck
// src/server/projections/next-action.ts (reads the pre-loaded data map instead
// of the filesystem). Read-only — writes nothing.
export default async function handler({ args, data }) {
  const { planSlug, initiativeSlug } = args
  const initiatives = getInitiatives(data)

  if (initiativeSlug) {
    const i = initiatives.find((x) => x.slug === initiativeSlug)
    // Explicit scope: a missing slug is a caller error, NOT a cue to fall back to
    // some other active initiative — that would silently answer for the wrong scope.
    if (!i) throw new Error(`initiative not found: ${initiativeSlug}`)
    const t = firstUnblockedPendingTask(i)
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
    const plan = getPlans(data).find((p) => p.slug === planSlug)
    if (!plan) throw new Error(`plan not found: ${planSlug}`)
    if (plan.currentPhase) {
      const mi = initiatives.find((i) => i.parentPlan === plan.slug && i.phaseId === plan.currentPhase)
      if (mi) {
        const t = firstUnblockedPendingTask(mi)
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

  // Scan ALL active initiatives, not just the first: the first active one may have
  // no actionable task while a later active one does. Stopping at the first would
  // falsely report "no next action" and skip real work.
  for (const active of initiatives.filter((i) => i.status === 'active')) {
    const t = firstUnblockedPendingTask(active)
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
