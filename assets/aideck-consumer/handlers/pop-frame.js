import { appendIntent, findInitiative } from './_lib.js'

// Record an intent to pop the top stack frame. Ported from aideck mutate.ts.
export default async function handler({ args, data, files }) {
  const { initiativeSlug, destination, by = 'ai' } = args
  const initiative = findInitiative(data, initiativeSlug)
  if (!initiative) throw new Error(`initiative not found: ${initiativeSlug}`)
  if ((initiative.stack ?? []).length === 0) {
    throw new Error(`stack is empty for ${initiativeSlug} — nothing to pop`)
  }

  const { intentId, recordedAt } = await appendIntent(files, {
    operation: 'pop_frame',
    target: { initiativeSlug },
    args: destination ? { destination } : {},
    by,
  })
  return { accepted: true, intentId, recordedAt, note: 'Intent recorded; consumer skill applies.' }
}
