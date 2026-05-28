import chokidar, { type FSWatcher } from 'chokidar'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EventBus } from './event-bus.js'
import { classifyFile, atomicSkillsRoot, type EntityKind as FileEntityKind } from './writers/paths.js'
import { parseInitiativeFile, parsePlanFile } from './parsers/project-status.js'
import { parseJsonlString } from './parsers/jsonl.js'
import {
  parseAnnotation,
  parseHighlight
} from '../schemas/validators/index.js'

export interface WatcherOptions {
  rootDir: string
  eventBus: EventBus
  awaitWriteFinishMs?: number
  ignoreInitial?: boolean
}

export interface Watcher {
  start(): Promise<void>
  stop(): Promise<void>
  ready(): Promise<void>
}

interface JsonlState {
  /** Last seen text length in bytes (utf8). Used as a cheap append cursor. */
  bytes: number
  /** Last seen line count (after final newline trim). */
  lines: number
  /** Pending unterminated trailing fragment (no newline yet). */
  pending: string
}

const WATCHED_SUFFIXES = ['.md', '.yaml', '.jsonl'] as const

function isWatched(path: string): boolean {
  return WATCHED_SUFFIXES.some((s) => path.endsWith(s))
}

export function createWatcher(opts: WatcherOptions): Watcher {
  const root = atomicSkillsRoot(opts.rootDir)
  const awaitMs = opts.awaitWriteFinishMs ?? 50
  const ignoreInitial = opts.ignoreInitial ?? false

  let fsw: FSWatcher | null = null
  const jsonlState = new Map<string, JsonlState>()

  let readyResolver: (() => void) | null = null
  const readyPromise = new Promise<void>((resolve) => {
    readyResolver = resolve
  })

  async function handleMdAdd(path: string, kind: 'plan' | 'initiative', consumer: string, slug: string, changeType: 'add' | 'change'): Promise<void> {
    const parsed = kind === 'plan'
      ? await parsePlanFile(path)
      : await parseInitiativeFile(path)
    if (parsed.ok) {
      opts.eventBus.emit({
        kind: 'state-change',
        consumer,
        slug,
        entityKind: kind,
        changeType,
        entity: parsed.value
      })
    } else {
      opts.eventBus.emit({
        kind: 'error',
        consumer,
        path,
        code: parsed.error.code,
        message: parsed.error.message,
        suggestion: parsed.error.suggestion
      })
    }
  }

  async function handleJsonlChange(path: string, kind: FileEntityKind, consumer: string): Promise<void> {
    let raw: string
    try {
      raw = await readFile(path, 'utf8')
    } catch (cause) {
      opts.eventBus.emit({
        kind: 'error',
        consumer,
        path,
        code: 'io_error',
        message: `failed to read jsonl: ${cause instanceof Error ? cause.message : String(cause)}`
      })
      return
    }
    const prev = jsonlState.get(path) ?? { bytes: 0, lines: 0, pending: '' }
    let slice: string
    if (raw.length < prev.bytes) {
      // truncated/rewritten → resync from scratch
      slice = raw
      prev.pending = ''
    } else {
      slice = prev.pending + raw.slice(prev.bytes)
    }
    // Only advance through newline-terminated lines; keep any trailing fragment
    // for the next change event so partial appends do not lose records.
    const lastNl = slice.lastIndexOf('\n')
    let pending = ''
    if (lastNl === -1) {
      pending = slice
      slice = ''
    } else if (lastNl < slice.length - 1) {
      pending = slice.slice(lastNl + 1)
      slice = slice.slice(0, lastNl + 1)
    }
    jsonlState.set(path, {
      bytes: raw.length,
      lines: prev.lines + countNonEmptyLines(slice),
      pending
    })
    if (slice.trim() === '') return

    if (kind === 'annotations-jsonl') {
      const { items, errors } = parseJsonlString(slice, parseAnnotation, path, () => {})
      for (const annotation of items) {
        opts.eventBus.emit({ kind: 'annotation-added', consumer, annotation })
      }
      for (const e of errors) {
        opts.eventBus.emit({
          kind: 'error',
          consumer,
          path,
          code: e.error.code,
          message: e.error.message,
          suggestion: e.error.suggestion
        })
      }
    } else if (kind === 'highlights-jsonl') {
      const { items, errors } = parseJsonlString(slice, parseHighlight, path, () => {})
      for (const highlight of items) {
        opts.eventBus.emit({ kind: 'highlight-added', consumer, highlight })
      }
      for (const e of errors) {
        opts.eventBus.emit({
          kind: 'error',
          consumer,
          path,
          code: e.error.code,
          message: e.error.message,
          suggestion: e.error.suggestion
        })
      }
    }
    // 'inbox-jsonl' is not surfaced as a wire event in v0.1 — consumers tail it directly.
  }

  function countNonEmptyLines(s: string): number {
    let n = 0
    for (const line of s.split('\n')) {
      if (line.trim() !== '') n++
    }
    return n
  }

  async function dispatch(path: string, changeType: 'add' | 'change' | 'unlink'): Promise<void> {
    const cls = classifyFile(path, opts.rootDir)
    if (!cls) return
    if (cls.kind === 'plan' || cls.kind === 'initiative') {
      if (changeType === 'unlink') {
        opts.eventBus.emit({
          kind: 'state-change',
          consumer: cls.consumer,
          slug: cls.slug ?? '',
          entityKind: cls.kind,
          changeType
        })
      } else {
        await handleMdAdd(path, cls.kind, cls.consumer, cls.slug ?? '', changeType)
      }
    } else if (cls.kind === 'annotations-jsonl' || cls.kind === 'highlights-jsonl' || cls.kind === 'inbox-jsonl') {
      if (changeType === 'unlink') {
        jsonlState.delete(path)
        return
      }
      await handleJsonlChange(path, cls.kind, cls.consumer)
    }
  }

  // Serialize watcher dispatches per path: chokidar can emit multiple events for
  // the same file in quick succession; concurrent dispatch() invocations would
  // race on jsonlState and emit out-of-order events.
  const dispatchChain = new Map<string, Promise<void>>()
  function enqueueDispatch(path: string, changeType: 'add' | 'change' | 'unlink'): void {
    const prev = dispatchChain.get(path) ?? Promise.resolve()
    const next = prev.then(() => dispatch(path, changeType)).catch(() => {})
    dispatchChain.set(path, next)
  }

  return {
    async start() {
      fsw = chokidar.watch(root, {
        ignoreInitial,
        awaitWriteFinish: { stabilityThreshold: awaitMs, pollInterval: Math.max(5, Math.floor(awaitMs / 4)) }
      })
      fsw.on('add', (p) => {
        if (isWatched(p)) enqueueDispatch(p, 'add')
      })
      fsw.on('change', (p) => {
        if (isWatched(p)) enqueueDispatch(p, 'change')
      })
      fsw.on('unlink', (p) => {
        if (isWatched(p)) enqueueDispatch(p, 'unlink')
      })
      fsw.on('ready', () => {
        readyResolver?.()
      })
      await readyPromise
    },
    async stop() {
      if (fsw) {
        await fsw.close()
        fsw = null
      }
      // Drain pending dispatches so stop() never returns mid-emit.
      await Promise.all(Array.from(dispatchChain.values()))
      dispatchChain.clear()
      jsonlState.clear()
    },
    ready() {
      return readyPromise
    }
  }
}
