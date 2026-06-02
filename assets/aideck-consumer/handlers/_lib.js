// Shared helpers for the atomic-skills aiDeck consumer handlers.
//
// Iron Law: aiDeck never edits entity files. Each mutating handler appends an
// intent record to the repo's `.atomic-skills/bootstrap-drafts/inbox/<day>.jsonl`
// (via the project-scoped `files.append`); the atomic-skills skill tails the
// inbox and applies the mutation to the plan/phase markdown. Read-only handlers
// just compute over the pre-loaded `data` map.
import { randomUUID } from 'node:crypto'

export function getInitiatives(data) {
  return data.get('initiatives') ?? []
}
export function getPlans(data) {
  return data.get('plans') ?? []
}
export function findInitiative(data, slug) {
  return getInitiatives(data).find((i) => i.slug === slug)
}
export function findPlan(data, slug) {
  return getPlans(data).find((p) => p.slug === slug)
}

/**
 * First pending task all of whose blockers resolve to a `done` task.
 * An unknown/misspelled blocker ID counts as BLOCKING (not satisfied): we never
 * recommend a task whose prerequisite cannot be verified complete. Mirrors
 * get-dependencies.js, which likewise reports an unresolved blocker as blocking.
 */
export function firstUnblockedPendingTask(initiative) {
  const tasks = initiative.tasks ?? []
  // Index status by id once (O(n)) so each blocker check is O(1) — an unknown id
  // resolves to `undefined` (≠ 'done' ⇒ BLOCKING), avoiding a full per-blocker scan.
  const statusById = new Map(tasks.map((t) => [t.id, t.status]))
  return tasks
    .filter((t) => t.status === 'pending')
    .find((t) =>
      (t.blockedBy ?? []).every((bid) => statusById.get(bid) === 'done')
    )
}

/** Append an intent to the repo inbox. Returns the receipt. */
export async function appendIntent(files, payload) {
  const now = new Date()
  const day = now.toISOString().slice(0, 10)
  const intentId = `int-${day}-${randomUUID().slice(0, 8)}`
  const record = {
    schemaVersion: '0.1',
    kind: 'intent',
    intentId,
    requestedAt: now.toISOString(),
    ...payload,
  }
  await files.append(`.atomic-skills/bootstrap-drafts/inbox/${day}.jsonl`, record)
  return { intentId, recordedAt: record.requestedAt }
}
