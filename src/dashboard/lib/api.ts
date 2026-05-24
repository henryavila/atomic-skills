// Thin client around aiDeck's REST + SSE surface.
//
// Dev (Vite dev server): requests to `/api/...` and `/sse` hit Vite's proxy
// (see vite.config.ts) which forwards to 127.0.0.1:7777.
// Production (served by aideck with --static-dir): same-origin, no proxy.

import type {
  Annotation,
  DiscoverCandidate,
  DiscoverDecision,
  DiscoverRun,
  Highlight,
  Initiative,
  Plan,
  ProjectStatusState,
} from './types'

const CONSUMER = 'project-status'

interface StateResponse {
  schemaVersion: string
  state: ProjectStatusState
}

interface EntityResponse {
  schemaVersion: string
  entity: Plan | Initiative
}

interface InboxResponse {
  schemaVersion: string
  items: Array<Annotation | Highlight | Record<string, unknown>>
  nextSince?: string
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} on ${path}\n${body}`)
  }
  return (await res.json()) as T
}

export async function getState(): Promise<ProjectStatusState> {
  const r = await fetchJson<StateResponse>(`/api/state/${CONSUMER}`)
  return r.state
}

/**
 * aiDeck's `/api/state/:consumer/:slug` resolves the slug against both
 * `plans/<slug>.md` and `initiatives/<slug>.md` (plan wins on conflict).
 * The route does NOT differentiate by URL — the caller decides which one
 * it is from context.
 */
export async function getEntityBySlug(slug: string): Promise<Plan | Initiative> {
  const r = await fetchJson<EntityResponse>(`/api/state/${CONSUMER}/${slug}`)
  return r.entity
}

export async function getPlan(slug: string): Promise<Plan> {
  const entity = await getEntityBySlug(slug)
  if (!('phases' in entity)) {
    throw new Error(`Expected plan at slug "${slug}" but got an initiative`)
  }
  return entity
}

export async function getInitiative(slug: string): Promise<Initiative> {
  const entity = await getEntityBySlug(slug)
  if (!('tasks' in entity)) {
    throw new Error(`Expected initiative at slug "${slug}" but got a plan`)
  }
  return entity
}

export async function getInbox(): Promise<InboxResponse> {
  return fetchJson<InboxResponse>(`/api/inbox?consumer=${CONSUMER}&limit=50`)
}

// ── Discover-run API ──────────────────────────────────────────────────────

const DISCOVER_CONSUMER = 'bootstrap-drafts'

interface DiscoverStateResponse {
  schemaVersion: string
  state: DiscoverRun
}

interface DiscoverInboxResponse {
  schemaVersion: string
  items: Array<{ kind: string; payload?: DiscoverDecision } & Record<string, unknown>>
  nextCursor?: string
}

export async function getDiscoverState(): Promise<DiscoverRun> {
  const r = await fetchJson<DiscoverStateResponse>(`/api/state/${DISCOVER_CONSUMER}`)
  return r.state
}

export async function postDecision(
  candidate: DiscoverCandidate,
  decision: 'approve' | 'reject',
  reason?: string
): Promise<{ id: string; createdAt: string }> {
  const res = await fetch('/api/decision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      target: { consumer: DISCOVER_CONSUMER, slug: candidate.slug, path: candidate.draftPath },
      decision,
      by: 'human' as const,
      ...(reason ? { reason } : {}),
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} on POST /api/decision\n${body}`)
  }
  return (await res.json()) as { id: string; createdAt: string }
}

export async function getDiscoverDecisions(slugs: string[]): Promise<DiscoverDecision[]> {
  const slugSet = new Set(slugs)
  const decisions: DiscoverDecision[] = []
  let cursor: string | undefined
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({ consumer: DISCOVER_CONSUMER, limit: '500' })
    if (cursor) params.set('since', cursor)
    const r = await fetchJson<DiscoverInboxResponse>(`/api/inbox?${params}`)
    for (const item of r.items) {
      if (item.kind === 'decision' && item.payload && slugSet.has(item.payload.target?.slug ?? '')) {
        decisions.push(item.payload)
      }
    }
    if (!r.nextCursor || r.items.length === 0) break
    cursor = r.nextCursor
  }
  return decisions
}

export interface RuntimeEvent {
  kind: 'state-change' | 'error' | 'health-tick'
  id?: number
  consumer?: string
  slug?: string
  entityKind?: 'plan' | 'initiative' | 'discover-run' | 'annotations-jsonl' | 'highlights-jsonl' | 'inbox-jsonl'
  changeType?: 'add' | 'change' | 'unlink'
}

/**
 * Opens an SSE connection to aideck's `/sse`. The server emits named events
 * (`event: state-change`, `event: error`, `event: health-tick`). We forward
 * the parsed payload to `onEvent`. Callers `.close()` on unmount.
 *
 * Reconnection: EventSource auto-reconnects with `Last-Event-ID`; aideck's
 * SSE replays since that id. No client-side bookkeeping needed.
 */
export function subscribeToEvents(onEvent: (evt: RuntimeEvent) => void): EventSource {
  const es = new EventSource('/sse')
  for (const name of ['state-change', 'error', 'health-tick'] as const) {
    es.addEventListener(name, (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as RuntimeEvent
        onEvent(data)
      } catch {
        // Drop malformed payloads; aideck owns the schema.
      }
    })
  }
  return es
}
