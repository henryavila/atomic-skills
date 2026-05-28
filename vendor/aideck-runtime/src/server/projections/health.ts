import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { HealthReport } from '../../schemas/project-status.js'
import { parseJsonlFile } from '../parsers/jsonl.js'
import { parseHighlight } from '../../schemas/validators/index.js'
import { consumerRoot } from '../writers/paths.js'
import { buildAllForConsumer } from './state.js'
import { listConsumers } from './consumers.js'
import { listPendingIntents } from './intents.js'

const DAY_MS = 24 * 60 * 60 * 1000

async function listJsonlFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.jsonl')).map((f) => join(dir, f))
  } catch {
    return []
  }
}

export async function buildHealthReport(
  rootDir: string,
  consumerId?: string,
  staleDays = 7
): Promise<HealthReport> {
  const consumerIds = consumerId
    ? [consumerId]
    : (await listConsumers(rootDir)).map((c) => c.id)

  const now = Date.now()
  const staleInitiatives: HealthReport['staleInitiatives'] = []
  const unmetGates: HealthReport['unmetGates'] = []
  const openHighlights: HealthReport['openHighlights'] = []
  let inboxUnconsumed = 0

  for (const id of consumerIds) {
    const aggregate = await buildAllForConsumer(rootDir, id)
    if (aggregate.ok) {
      for (const initiative of aggregate.value.initiatives) {
        const ts = Date.parse(initiative.lastUpdated)
        if (Number.isFinite(ts) && initiative.status === 'active') {
          const days = (now - ts) / DAY_MS
          if (days > staleDays) {
            staleInitiatives.push({ slug: initiative.slug, daysStale: Math.floor(days) })
          }
        }
        for (const c of initiative.exitGates) {
          if (c.status !== 'met') {
            unmetGates.push({ target: `initiative:${initiative.slug}`, criterion: c.id })
          }
        }
      }
      for (const plan of aggregate.value.plans) {
        for (const phase of plan.phases) {
          for (const c of phase.exitGate.criteria) {
            if (c.status !== 'met') {
              unmetGates.push({ target: `plan:${plan.slug}/phase:${phase.id}`, criterion: c.id })
            }
          }
        }
      }
    }

    const consumerDir = consumerRoot(rootDir, id)
    const hlPaths = await listJsonlFiles(join(consumerDir, 'highlights'))
    for (const path of hlPaths) {
      const { items } = await parseJsonlFile(path, parseHighlight, () => {})
      for (const h of items) {
        if (h.acknowledged !== true) {
          openHighlights.push({ id: h.id, target: `${h.target.consumer}:${h.target.path}`, severity: h.severity })
        }
      }
    }

    const pending = await listPendingIntents(consumerDir)
    inboxUnconsumed += pending.length
  }

  return {
    schemaVersion: '0.1',
    generatedAt: new Date().toISOString(),
    staleInitiatives,
    unmetGates,
    openHighlights,
    inboxUnconsumed
  }
}
