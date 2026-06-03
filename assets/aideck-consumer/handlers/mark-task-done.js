import { appendIntent, findInitiative } from './_lib.js'

// Record an intent to mark a task done. Returns phaseCompleteHint when it was the
// last open task in the initiative. Ported from aideck src/mcp/tools/mutate.ts.
export default async function handler({ args, data, files, log }) {
  const { initiativeSlug, taskId, projectId, verifierResultId, by = 'ai' } = args
  const initiative = findInitiative(data, initiativeSlug, projectId)

  const tasks = initiative.tasks ?? []
  const task = tasks.find((t) => t.id === taskId)
  if (!task) throw new Error(`task ${taskId} not found in initiative ${initiativeSlug}`)

  const { intentId, recordedAt } = await appendIntent(files, {
    operation: 'mark_task_done',
    target: { projectId: initiative.projectId, initiativeSlug, taskId },
    args: verifierResultId ? { verifierResultId } : {},
    by,
  })

  const remaining = tasks.filter((t) => t.status !== 'done' && t.id !== taskId).length
  const result = {
    accepted: true,
    intentId,
    recordedAt,
    note: 'Intent recorded; consumer skill applies.',
  }
  if (remaining === 0) result.phaseCompleteHint = { initiativeSlug, remaining, lastTaskId: taskId }
  log.info(`mark_task_done ${initiativeSlug}/${taskId} remaining=${remaining}`)
  return result
}
