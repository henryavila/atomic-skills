import { appendIntent, findInitiative, stackFor } from './_lib.js'

// Record an intent to pop the top stack frame. Ported from aideck mutate.ts.
export default async function handler({ args, data, files }) {
  const { initiativeSlug, destination, projectId, by = 'ai' } = args
  const initiative = findInitiative(data, initiativeSlug, projectId)
  if (stackFor(data, initiative).length === 0) {
    throw new Error(`stack is empty for ${initiativeSlug} — nothing to pop`)
  }

  const { intentId, recordedAt } = await appendIntent(files, {
    operation: 'pop_frame',
    target: { projectId: initiative.projectId, initiativeSlug },
    args: destination ? { destination } : {},
    by,
  })
  return { accepted: true, intentId, recordedAt, note: 'Intent recorded; consumer skill applies.' }
}
