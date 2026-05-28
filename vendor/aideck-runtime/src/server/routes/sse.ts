import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { EventBus } from '../event-bus.js'
import type { RuntimeEvent } from '../events/types.js'

export interface SseDeps {
  eventBus: EventBus
  startedAt: number
  healthTickMs?: number
}

export function createSseRouter(deps: SseDeps): Hono {
  const app = new Hono()
  const tickMs = deps.healthTickMs ?? 30_000

  app.get('/sse', (c) => {
    return streamSSE(c, async (stream) => {
      const lastIdHeader = c.req.header('last-event-id')
      const lastId = lastIdHeader !== undefined ? Number(lastIdHeader) : null
      let aborted = false

      const send = async (event: RuntimeEvent) => {
        await stream.writeSSE({
          event: event.kind,
          id: String(event.id),
          data: JSON.stringify(event)
        })
      }

      if (lastId !== null && !Number.isNaN(lastId)) {
        for (const e of deps.eventBus.replaySince(lastId)) {
          await send(e)
        }
      }

      const queue: RuntimeEvent[] = []
      let notify: (() => void) | null = null
      const unsubscribe = deps.eventBus.subscribe((e) => {
        queue.push(e)
        notify?.()
      })

      const tick = setInterval(() => {
        deps.eventBus.emit({
          kind: 'health-tick',
          uptimeMs: Date.now() - deps.startedAt
        })
      }, tickMs)

      stream.onAbort(() => {
        aborted = true
        unsubscribe()
        clearInterval(tick)
        notify?.()
      })

      while (!aborted) {
        while (queue.length > 0 && !aborted) {
          const next = queue.shift()
          if (next) await send(next)
        }
        if (aborted) break
        await new Promise<void>((resolve) => {
          notify = resolve
        })
      }
    })
  })

  return app
}
