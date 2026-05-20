// Thin client around aiDeck's REST + SSE surface.
// In dev: hits `/api/...` via Vite's proxy (vite.config.ts) which forwards
// to 127.0.0.1:7777. In prod (served by aideck itself), same-origin.

import type { ProjectStatusState, Plan, Initiative } from './types'

const CONSUMER = 'project-status'

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${res.statusText} on ${path}\n${body}`)
  }
  return (await res.json()) as T
}

export async function getState(): Promise<ProjectStatusState> {
  return fetchJson<ProjectStatusState>(`/api/state/${CONSUMER}`)
}

export async function getPlan(slug: string): Promise<Plan> {
  return fetchJson<Plan>(`/api/state/${CONSUMER}/plans/${slug}`)
}

export async function getInitiative(slug: string): Promise<Initiative> {
  return fetchJson<Initiative>(`/api/state/${CONSUMER}/initiatives/${slug}`)
}

export interface StateChangeEvent {
  kind: 'state-change' | 'error'
  consumer?: string
  slug?: string
  entityKind?: 'plan' | 'initiative' | 'annotations-jsonl' | 'highlights-jsonl' | 'inbox-jsonl'
  changeType?: 'add' | 'change' | 'unlink'
}

/**
 * Opens an SSE connection to aideck's `/sse` endpoint and invokes `onChange`
 * for every `state-change` message. Returns the EventSource so callers can
 * `.close()` on unmount.
 */
export function subscribeToChanges(onChange: (evt: StateChangeEvent) => void): EventSource {
  const es = new EventSource('/sse')
  es.addEventListener('state-change', (ev) => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as StateChangeEvent
      onChange(data)
    } catch {
      // Drop malformed payloads; aideck owns the schema and will fix upstream.
    }
  })
  return es
}
