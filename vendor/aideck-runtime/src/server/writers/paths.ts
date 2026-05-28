import { join, relative, sep } from 'node:path'

const SAFE_CONSUMER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export class UnsafeConsumerIdError extends Error {
  constructor(consumerId: string) {
    super(`unsafe consumerId: ${JSON.stringify(consumerId)}`)
    this.name = 'UnsafeConsumerIdError'
  }
}

export function assertSafeConsumerId(consumerId: string): void {
  if (!SAFE_CONSUMER_ID.test(consumerId)) {
    throw new UnsafeConsumerIdError(consumerId)
  }
}

export function atomicSkillsRoot(rootDir: string): string {
  return join(rootDir, '.atomic-skills')
}

export function consumerRoot(rootDir: string, consumerId: string): string {
  assertSafeConsumerId(consumerId)
  return join(atomicSkillsRoot(rootDir), consumerId)
}

function isoDay(date: Date): string {
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function annotationsPathFor(consumerDir: string, date: Date = new Date()): string {
  return join(consumerDir, 'annotations', `${isoDay(date)}.jsonl`)
}

export function highlightsPathFor(consumerDir: string, date: Date = new Date()): string {
  return join(consumerDir, 'highlights', `${isoDay(date)}.jsonl`)
}

export function inboxPathFor(consumerDir: string, date: Date = new Date()): string {
  return join(consumerDir, 'inbox', `${isoDay(date)}.jsonl`)
}

/**
 * Entity-directory names that may appear immediately under `.atomic-skills/`
 * in the flat layout (e.g. `.atomic-skills/plans/foo.md`). When the first
 * segment is one of these, the path is treated as belonging to the default
 * `project-status` consumer rather than as a literal consumer id.
 */
export const ENTITY_DIRS = new Set<string>([
  'plans',
  'initiatives',
  'annotations',
  'highlights',
  'inbox'
])

export const DEFAULT_CONSUMER = 'project-status'

/**
 * Given an absolute path under `<rootDir>/.atomic-skills/...`, returns the
 * consumer id, or null if the path is not within the atomic-skills root.
 *
 * Two layouts are supported:
 *   1. Explicit: `.atomic-skills/<consumer>/<entityDir>/...`  → returns `<consumer>`
 *   2. Flat:     `.atomic-skills/<entityDir>/...`             → returns `DEFAULT_CONSUMER`
 *
 * The flat layout exists because atomic-skills' `project-status` skill writes
 * directly under `.atomic-skills/plans/` and `.atomic-skills/initiatives/`
 * without an intermediate consumer-id segment. Treating those entity-dir
 * names as reserved keeps the single-consumer case ergonomic while preserving
 * multi-consumer support via the explicit layout.
 */
export function extractConsumerId(filePath: string, rootDir: string): string | null {
  const rel = relative(atomicSkillsRoot(rootDir), filePath)
  if (rel.startsWith('..') || rel === '') return null
  const head = rel.split(sep)[0]
  if (!head) return null
  if (ENTITY_DIRS.has(head)) return DEFAULT_CONSUMER
  return head
}

export type EntityKind = 'plan' | 'initiative' | 'annotations-jsonl' | 'highlights-jsonl' | 'inbox-jsonl' | 'other'

/**
 * Classifies a path inside `.atomic-skills/`, returning the consumer id, the
 * entity kind, and (for plan/initiative) a slug. Returns null if the path is
 * outside the atomic-skills root.
 *
 * Supports both the explicit layout (`<consumer>/<entityDir>/<file>`) and
 * the flat layout (`<entityDir>/<file>`, attributed to DEFAULT_CONSUMER).
 * For nested initiative archives like `initiatives/archive/<file>.md` the
 * returned slug preserves the nested path (`archive/<file>`).
 */
export function classifyFile(filePath: string, rootDir: string): { consumer: string; kind: EntityKind; slug?: string } | null {
  const relFromAtomic = relative(atomicSkillsRoot(rootDir), filePath)
  if (relFromAtomic.startsWith('..') || relFromAtomic === '') return null
  const parts = relFromAtomic.split(sep).filter((p) => p !== '')
  if (parts.length === 0) return null

  const head = parts[0]
  let consumer: string
  let entityDir: string | undefined
  let entityParts: string[]
  if (ENTITY_DIRS.has(head)) {
    consumer = DEFAULT_CONSUMER
    entityDir = head
    entityParts = parts.slice(1)
  } else {
    consumer = head
    entityDir = parts[1]
    entityParts = parts.slice(2)
  }

  const mdSlug = (): string => {
    const joined = entityParts.join('/')
    return joined.endsWith('.md') ? joined.slice(0, -3) : joined
  }

  switch (entityDir) {
    case 'plans':
      if (entityParts.length === 0) return { consumer, kind: 'other' }
      return { consumer, kind: 'plan', slug: mdSlug() }
    case 'initiatives':
      if (entityParts.length === 0) return { consumer, kind: 'other' }
      return { consumer, kind: 'initiative', slug: mdSlug() }
    case 'annotations':
      return { consumer, kind: 'annotations-jsonl' }
    case 'highlights':
      return { consumer, kind: 'highlights-jsonl' }
    case 'inbox':
      return { consumer, kind: 'inbox-jsonl' }
    default:
      return { consumer, kind: 'other' }
  }
}
