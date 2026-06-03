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

// Resolve a single record by slug, scoped by projectId (F-001).
//
// aiDeck injects every dataSource capture as a field on every record
// (data-source-reader.ts:199-211), so each record already carries `.projectId`
// (and `.planSlug`). A slug is only unique WITHIN a project, so in a repo with
// ≥2 `projects/<id>/` a slug can collide. We therefore:
//   - filter candidates by slug, then (if given) by projectId;
//   - 0 candidates  → throw not-found (naming projectId when one was passed);
//   - exactly 1     → return it (zero friction for the common 1-project case —
//                     no projectId needed);
//   - >1 (ambiguous slug, no/insufficient projectId) → throw, listing the
//     colliding projects, so the caller is forced to disambiguate rather than
//     silently mutating the wrong project.
function resolveBySlug(records, slug, projectId, entity) {
  let candidates = records.filter((r) => r.slug === slug)
  if (projectId != null) candidates = candidates.filter((r) => r.projectId === projectId)
  if (candidates.length === 0) {
    const scope = projectId != null ? ` in project '${projectId}'` : ''
    throw new Error(`${entity} not found: ${slug}${scope}`)
  }
  if (candidates.length > 1) {
    const projects = [...new Set(candidates.map((r) => r.projectId ?? '(unknown)'))].sort()
    if (projects.length === 1) {
      // Same slug duplicated WITHIN one project — a data-integrity problem, not a
      // scoping ambiguity; passing projectId cannot disambiguate it.
      throw new Error(
        `duplicate slug '${slug}' (${candidates.length} records) within project '${projects[0]}' — data integrity issue`
      )
    }
    throw new Error(
      `ambiguous slug '${slug}' across projects: [${projects.join(', ')}] — pass projectId to disambiguate`
    )
  }
  return candidates[0]
}

export function findInitiative(data, slug, projectId) {
  return resolveBySlug(getInitiatives(data), slug, projectId, 'initiative')
}
export function findPlan(data, slug, projectId) {
  return resolveBySlug(getPlans(data), slug, projectId, 'plan')
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
