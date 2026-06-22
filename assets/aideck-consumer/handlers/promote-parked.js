import { appendIntent, findInitiative, parkedFor } from './_lib.js'

// Record an intent to promote a parked item to a task. `parkedTitleOrIndex` is
// either the parked item's title (string) or its index (number). Ported from
// aideck mutate.ts.
export default async function handler({ args, data, files }) {
  const { initiativeSlug, parkedTitleOrIndex, projectId, by = 'ai' } = args
  const initiative = findInitiative(data, initiativeSlug, projectId)

  // Flat parked rows for this initiative, in original order (emitter preserves
  // the array index), so a numeric index lookup matches the source ordering.
  const parked = parkedFor(data, initiative)
  const found =
    typeof parkedTitleOrIndex === 'number'
      ? parked[parkedTitleOrIndex]
      : parked.find((p) => p.title === parkedTitleOrIndex)
  if (!found) throw new Error(`parked item not found: ${parkedTitleOrIndex}`)

  const { intentId, recordedAt } = await appendIntent(files, {
    operation: 'promote_parked',
    target: { projectId: initiative.projectId, initiativeSlug },
    args: { parkedTitle: found.title },
    by,
  })
  return { accepted: true, intentId, recordedAt, note: 'Intent recorded; consumer skill applies.' }
}
