import { getInitiatives, getGates, getPhaseGates } from './_lib.js'

// Cross-entity health report: stale active initiatives, unmet exit gates, and
// unconsumed inbox intents. Ported from aideck src/server/projections/health.ts
// (reads the pre-loaded data map). Read-only. Reads the flat emitted sources:
// initiatives (for staleness), gates (initiative exit gates) + phaseGates
// (plan-phase exit criteria) — each gate row carries its own join keys.
const DAY_MS = 24 * 60 * 60 * 1000

export default async function handler({ args, data }) {
  const staleDays = typeof args.staleDays === 'number' ? args.staleDays : 7
  const now = Date.now()
  const staleInitiatives = []
  const unmetGates = []

  for (const i of getInitiatives(data)) {
    if (i.status !== 'active') continue
    const ts = Date.parse(i.lastUpdated)
    if (Number.isFinite(ts)) {
      const days = (now - ts) / DAY_MS
      if (days > staleDays) staleInitiatives.push({ slug: i.slug, daysStale: Math.floor(days) })
    } else {
      // An active initiative with a missing/unparseable lastUpdated is exactly
      // the data most likely to be neglected — surface it, don't drop it.
      staleInitiatives.push({ slug: i.slug, daysStale: null, malformed: true })
    }
  }

  for (const g of getGates(data)) {
    if (g.status !== 'met') unmetGates.push({ target: `initiative:${g.initiativeId}`, criterion: g.id })
  }
  for (const g of getPhaseGates(data)) {
    if (g.status !== 'met') unmetGates.push({ target: `plan:${g.planSlug}/phase:${g.phaseId}`, criterion: g.id })
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
