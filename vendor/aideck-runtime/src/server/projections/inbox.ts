import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  Acknowledgement,
  Annotation,
  Decision,
  Highlight,
  InboxItem,
  IsoTimestamp,
  Resolution
} from '../../schemas/common.js'
import {
  parseAnnotation,
  parseDecision,
  parseHighlight
} from '../../schemas/validators/index.js'
import { parseJsonlFile, parseInboxLine } from '../parsers/jsonl.js'
import { consumerRoot } from '../writers/paths.js'
import { listConsumers } from './consumers.js'

export interface InboxQuery {
  consumer?: string
  since?: IsoTimestamp
  limit?: number
}

export interface InboxProjection {
  items: InboxItem[]
  nextCursor?: IsoTimestamp
}

interface CollectedRecords {
  annotations: Annotation[]
  highlights: Highlight[]
  decisions: Decision[]
  resolutions: Resolution[]
  acknowledgements: Acknowledgement[]
}

async function listJsonlFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.jsonl')).map((f) => join(dir, f))
  } catch {
    return []
  }
}

async function collectFromConsumer(rootDir: string, consumerId: string): Promise<CollectedRecords> {
  const dir = consumerRoot(rootDir, consumerId)
  const annPaths = await listJsonlFiles(join(dir, 'annotations'))
  const hlPaths = await listJsonlFiles(join(dir, 'highlights'))
  const decisionPaths = await listJsonlFiles(join(dir, 'decisions'))
  const inboxPaths = await listJsonlFiles(join(dir, 'inbox'))

  const out: CollectedRecords = {
    annotations: [],
    highlights: [],
    decisions: [],
    resolutions: [],
    acknowledgements: []
  }

  for (const p of annPaths) {
    const { items } = await parseJsonlFile(p, parseAnnotation, () => {})
    out.annotations.push(...items)
  }
  for (const p of hlPaths) {
    const { items } = await parseJsonlFile(p, parseHighlight, () => {})
    out.highlights.push(...items)
  }
  for (const p of decisionPaths) {
    const { items } = await parseJsonlFile(p, parseDecision, () => {})
    out.decisions.push(...items)
  }
  for (const p of inboxPaths) {
    const { items } = await parseJsonlFile(p, parseInboxLine, () => {})
    for (const item of items) {
      switch (item.kind) {
        case 'annotation':
          out.annotations.push(item.value)
          break
        case 'highlight':
          out.highlights.push(item.value)
          break
        case 'decision':
          out.decisions.push(item.value)
          break
        case 'resolution':
          out.resolutions.push(item.value)
          break
        case 'acknowledgement':
          out.acknowledgements.push(item.value)
          break
        default:
          break
      }
    }
  }
  return out
}

export async function projectInbox(
  rootDir: string,
  query: InboxQuery = {}
): Promise<InboxProjection> {
  const consumerIds = query.consumer
    ? [query.consumer]
    : (await listConsumers(rootDir)).map((c) => c.id)

  const aggregated: CollectedRecords = {
    annotations: [],
    highlights: [],
    decisions: [],
    resolutions: [],
    acknowledgements: []
  }
  const byConsumer: Record<string, CollectedRecords> = {}
  for (const id of consumerIds) {
    const c = await collectFromConsumer(rootDir, id)
    byConsumer[id] = c
    aggregated.annotations.push(...c.annotations)
    aggregated.highlights.push(...c.highlights)
    aggregated.decisions.push(...c.decisions)
    aggregated.resolutions.push(...c.resolutions)
    aggregated.acknowledgements.push(...c.acknowledgements)
  }

  const resolvedByConsumer = new Map<string, Set<string>>()
  const ackedByConsumer = new Map<string, Set<string>>()
  for (const id of consumerIds) {
    const c = byConsumer[id]
    resolvedByConsumer.set(id, new Set(c.resolutions.map((r) => r.refId)))
    ackedByConsumer.set(id, new Set(c.acknowledgements.map((a) => a.refId)))
  }

  const items: InboxItem[] = []
  for (const id of consumerIds) {
    const c = byConsumer[id]
    const resolved = resolvedByConsumer.get(id) ?? new Set<string>()
    const acked = ackedByConsumer.get(id) ?? new Set<string>()
    for (const a of c.annotations) {
      items.push({
        schemaVersion: '0.1',
        id: `inb-ann-${a.id}`,
        consumer: id,
        kind: 'annotation',
        payload: resolved.has(a.id) ? { ...a, resolved: true } : a,
        createdAt: a.createdAt
      })
    }
    for (const h of c.highlights) {
      items.push({
        schemaVersion: '0.1',
        id: `inb-hl-${h.id}`,
        consumer: id,
        kind: 'highlight',
        payload: acked.has(h.id) ? { ...h, acknowledged: true } : h,
        createdAt: h.createdAt
      })
    }
    for (const d of c.decisions) {
      items.push({
        schemaVersion: '0.1',
        id: `inb-dec-${d.id}`,
        consumer: id,
        kind: 'decision',
        payload: d,
        createdAt: d.createdAt
      })
    }
  }

  const since = query.since
  const filtered = since ? items.filter((it) => it.createdAt > since) : items
  filtered.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))

  const limit = query.limit ?? 50
  const sliced = filtered.slice(0, limit)
  return {
    items: sliced,
    nextCursor: sliced.length === limit && sliced.length > 0
      ? sliced[sliced.length - 1].createdAt
      : undefined
  }
}
