import { join } from 'node:path'
import type { ErrorResponse } from '../../schemas/common.js'
import { type Result, err, ok } from '../../schemas/validators/index.js'
import { parseInitiativeFile, parsePlanFile } from '../../server/parsers/project-status.js'
import { consumerRoot } from '../../server/writers/paths.js'

export interface DependencyReport {
  scope: 'phase' | 'task'
  id: string
  resolved: string[]
  blocking: string[]
  blockedBy: string[]
}

export type DependenciesInput =
  | { scope: 'phase'; consumer: string; planSlug: string; phaseId: string }
  | { scope: 'task'; consumer: string; initiativeSlug: string; taskId: string }

export async function resolveDependencies(
  rootDir: string,
  input: DependenciesInput
): Promise<Result<DependencyReport, ErrorResponse>> {
  if (input.scope === 'phase') {
    const planRes = await parsePlanFile(
      join(consumerRoot(rootDir, input.consumer), 'plans', `${input.planSlug}.md`)
    )
    if (!planRes.ok) return planRes
    const plan = planRes.value
    const phase = plan.phases.find((p) => p.id === input.phaseId)
    if (!phase) {
      return err({
        code: 'path_not_found',
        message: `phase ${input.phaseId} not found in plan ${input.planSlug}`
      })
    }
    const doneIds = new Set(plan.phases.filter((p) => p.status === 'done').map((p) => p.id))
    const blockedBy = phase.dependsOn
    const resolved = blockedBy.filter((id) => doneIds.has(id))
    const blocking = blockedBy.filter((id) => !doneIds.has(id))
    return ok({
      scope: 'phase',
      id: phase.id,
      resolved,
      blocking,
      // Always return the full blockedBy list — keeps shape consistent with task mode.
      blockedBy
    })
  }

  // task scope — only parses the initiative; planSlug is NOT required.
  const initRes = await parseInitiativeFile(
    join(consumerRoot(rootDir, input.consumer), 'initiatives', `${input.initiativeSlug}.md`)
  )
  if (!initRes.ok) return initRes
  const initiative = initRes.value
  const task = initiative.tasks.find((t) => t.id === input.taskId)
  if (!task) {
    return err({
      code: 'path_not_found',
      message: `task ${input.taskId} not found in initiative ${input.initiativeSlug}`
    })
  }

  const blockedBy = task.blockedBy ?? []
  const doneIds = new Set(initiative.tasks.filter((t) => t.status === 'done').map((t) => t.id))
  const resolved = blockedBy.filter((id) => doneIds.has(id))
  const blocking = blockedBy.filter((id) => !doneIds.has(id))
  return ok({
    scope: 'task',
    id: task.id,
    resolved,
    blocking,
    blockedBy
  })
}
