import type { RuntimeEvent } from './events/types.js'

export interface EventBusOptions {
  retentionMs?: number
  now?: () => number
}

export type EventDraft = RuntimeEvent extends infer E
  ? E extends RuntimeEvent
    ? Omit<E, 'id' | 'emittedAt'> & { id?: number; emittedAt?: string }
    : never
  : never

export interface EventBus {
  emit(event: EventDraft): RuntimeEvent
  subscribe(listener: (event: RuntimeEvent) => void): () => void
  replaySince(lastEventId: number): RuntimeEvent[]
  size(): number
  clear(): void
}

export function createEventBus(opts: EventBusOptions = {}): EventBus {
  const retentionMs = opts.retentionMs ?? 60_000
  const now = opts.now ?? (() => Date.now())
  const buffer: RuntimeEvent[] = []
  const listeners = new Set<(event: RuntimeEvent) => void>()
  let lastId = 0

  function trim(currentNow: number): void {
    const cutoff = currentNow - retentionMs
    while (buffer.length > 0 && buffer[0].id < cutoff) {
      buffer.shift()
    }
  }

  return {
    emit(partial) {
      const tNow = now()
      const id = Math.max(tNow, lastId + 1)
      lastId = id
      const event = {
        ...partial,
        id: partial.id ?? id,
        emittedAt: partial.emittedAt ?? new Date(tNow).toISOString()
      } as RuntimeEvent
      buffer.push(event)
      trim(tNow)
      for (const l of listeners) {
        try {
          l(event)
        } catch {
          // listeners are not allowed to throw out of the bus
        }
      }
      return event
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    replaySince(lastEventId) {
      trim(now())
      return buffer.filter((e) => e.id > lastEventId)
    },
    size() {
      trim(now())
      return buffer.length
    },
    clear() {
      buffer.length = 0
    }
  }
}
