import { firstUnblockedPendingTask, getInitiatives, getPlans } from './_lib.js'

// Compute the next recommended action. Ported from aideck
// src/server/projections/next-action.ts (reads the pre-loaded data map instead
// of the filesystem). Read-only — writes nothing.
export default async function handler({ args, data }) {
  const { planSlug, initiativeSlug } = args
  const initiatives = getInitiatives(data)

  if (initiativeSlug) {
    const i = initiatives.find((x) => x.slug === initiativeSlug)
    if (i) {
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
  }

  if (planSlug) {
    const plan = getPlans(data).find((p) => p.slug === planSlug)
    if (plan && plan.currentPhase) {
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
  }

  const active = initiatives.find((i) => i.status === 'active')
  if (active) {
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
