import { findInitiative, findPlan, phasesFor, tasksFor } from './_lib.js'

// Resolve dependencies for a phase or a task. Ported from aideck
// src/mcp/tools/dependencies.ts (reads the pre-loaded data map). Read-only.
export default async function handler({ args, data }) {
  const { scope, projectId } = args

  if (scope === 'phase') {
    const plan = findPlan(data, args.planSlug, projectId)
    const phases = phasesFor(data, plan)
    const phase = phases.find((p) => p.id === args.phaseId)
    if (!phase) throw new Error(`phase ${args.phaseId} not found in plan ${args.planSlug}`)
    const doneIds = new Set(phases.filter((p) => p.status === 'done').map((p) => p.id))
    const blockedBy = phase.dependsOn ?? []
    return {
      scope: 'phase',
      id: phase.id,
      blockedBy,
      resolved: blockedBy.filter((id) => doneIds.has(id)),
      blocking: blockedBy.filter((id) => !doneIds.has(id)),
    }
  }

  if (scope === 'task') {
    const initiative = findInitiative(data, args.initiativeSlug, projectId)
    const tasks = tasksFor(data, initiative)
    const task = tasks.find((t) => t.id === args.taskId)
    if (!task) throw new Error(`task ${args.taskId} not found in initiative ${args.initiativeSlug}`)
    const doneIds = new Set(tasks.filter((t) => t.status === 'done').map((t) => t.id))
    const blockedBy = task.blockedBy ?? []
    return {
      scope: 'task',
      id: task.id,
      blockedBy,
      resolved: blockedBy.filter((id) => doneIds.has(id)),
      blocking: blockedBy.filter((id) => !doneIds.has(id)),
    }
  }

  throw new Error(`invalid scope: ${scope} (expected 'phase' or 'task')`)
}
