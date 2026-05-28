import type { NextActionProjection, Initiative, Task } from '../../schemas/project-status.js'
import { buildAllForConsumer, buildForSlug } from './state.js'

function firstUnblockedPendingTask(initiative: Initiative): Task | undefined {
  const pending = initiative.tasks.filter((t) => t.status === 'pending')
  const taskIds = new Set(initiative.tasks.map((t) => t.id))
  return pending.find((t) => {
    if (!t.blockedBy || t.blockedBy.length === 0) return true
    return t.blockedBy.every((bid) => {
      if (!taskIds.has(bid)) return true
      const blocker = initiative.tasks.find((x) => x.id === bid)
      return blocker?.status === 'done'
    })
  })
}

export async function projectNextAction(
  rootDir: string,
  query: { consumer: string; planSlug?: string; initiativeSlug?: string }
): Promise<NextActionProjection> {
  const consumerId = query.consumer

  if (query.initiativeSlug) {
    const res = await buildForSlug(rootDir, consumerId, query.initiativeSlug)
    if (res.ok && 'tasks' in res.value) {
      const initiative = res.value as Initiative
      const t = firstUnblockedPendingTask(initiative)
      if (t) {
        return {
          consumer: 'project-status',
          initiativeSlug: initiative.slug,
          taskId: t.id,
          description: t.title,
          rationale: 'first unblocked pending task in initiative'
        }
      }
      return {
        consumer: 'project-status',
        initiativeSlug: initiative.slug,
        description: 'No next action — all tasks done or blocked',
        rationale: 'no unblocked pending task remains in this initiative'
      }
    }
  }

  const all = await buildAllForConsumer(rootDir, consumerId)
  if (!all.ok) {
    return {
      consumer: 'project-status',
      description: 'No next action — consumer unreadable',
      rationale: all.error.message
    }
  }

  if (query.planSlug) {
    const plan = all.value.plans.find((p) => p.slug === query.planSlug)
    if (plan && plan.currentPhase) {
      const matchingInitiative = all.value.initiatives.find(
        (i) => i.parentPlan === plan.slug && i.phaseId === plan.currentPhase
      )
      if (matchingInitiative) {
        const t = firstUnblockedPendingTask(matchingInitiative)
        if (t) {
          return {
            consumer: 'project-status',
            planSlug: plan.slug,
            initiativeSlug: matchingInitiative.slug,
            taskId: t.id,
            description: t.title,
            rationale: `from currentPhase ${plan.currentPhase} of plan ${plan.slug}`
          }
        }
      }
    }
  }

  const active = all.value.initiatives.find((i) => i.status === 'active')
  if (active) {
    const t = firstUnblockedPendingTask(active)
    if (t) {
      return {
        consumer: 'project-status',
        initiativeSlug: active.slug,
        taskId: t.id,
        description: t.title,
        rationale: `from first active initiative ${active.slug}`
      }
    }
  }

  return {
    consumer: 'project-status',
    description: 'No next action — no active initiative with unblocked pending tasks',
    rationale: 'all initiatives done, paused, or all tasks blocked'
  }
}
