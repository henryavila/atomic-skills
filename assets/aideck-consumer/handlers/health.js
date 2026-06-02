import { getInitiatives, getPlans } from './_lib.js'

// Cross-entity health report: stale active initiatives, unmet exit gates, and
// unconsumed inbox intents. Ported from aideck src/server/projections/health.ts
// (reads the pre-loaded data map). Read-only.
const DAY_MS = 24 * 60 * 60 * 1000

export default async function handler({ args, data }) {
  const staleDays = typeof args.staleDays === 'number' ? args.staleDays : 7
  const now = Date.now()
  const staleInitiatives = []
  const unmetGates = []

  for (const i of getInitiatives(data)) {
    const ts = Date.parse(i.lastUpdated)
    if (Number.isFinite(ts) && i.status === 'active') {
      const days = (now - ts) / DAY_MS
      if (days > staleDays) staleInitiatives.push({ slug: i.slug, daysStale: Math.floor(days) })
    }
    for (const c of i.exitGates ?? []) {
      if (c.status !== 'met') unmetGates.push({ target: `initiative:${i.slug}`, criterion: c.id })
    }
  }

  for (const p of getPlans(data)) {
    for (const ph of p.phases ?? []) {
      for (const c of ph.exitGate?.criteria ?? []) {
        if (c.status !== 'met') unmetGates.push({ target: `plan:${p.slug}/phase:${ph.id}`, criterion: c.id })
      }
    }
  }

  const inbox = data.get('inbox') ?? []
  const inboxUnconsumed = inbox.filter((r) => r.kind === 'intent' && !r.consumed).length

  return {
    generatedAt: new Date().toISOString(),
    staleInitiatives,
    unmetGates,
    inboxUnconsumed,
  }
}
