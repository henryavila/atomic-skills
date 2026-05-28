import { randomUUID } from 'node:crypto'
import type { IntentRecord, IsoTimestamp } from '../../schemas/common.js'
import { appendJsonlLine } from './jsonl-append.js'
import { inboxPathFor } from './paths.js'
import type { EventBus } from '../event-bus.js'

export interface IntentReceipt {
  intentId: string
  recordedAt: IsoTimestamp
}

export type IntentPayload = Omit<IntentRecord, 'schemaVersion' | 'kind' | 'intentId' | 'requestedAt'>

export interface AppendIntentInput {
  consumerRoot: string
  consumerId: string
  intent: IntentPayload
  eventBus?: EventBus
  /** Optional clock for tests; defaults to Date.now(). */
  now?: () => Date
}

function nextIntentId(day: string): string {
  return `int-${day}-${randomUUID().slice(0, 8)}`
}

export async function appendIntent(input: AppendIntentInput): Promise<IntentReceipt> {
  const now = input.now ? input.now() : new Date()
  const day = now.toISOString().slice(0, 10)
  const path = inboxPathFor(input.consumerRoot, now)
  const intentId = nextIntentId(day)
  const recordedAt = now.toISOString()
  const intent = {
    schemaVersion: '0.1' as const,
    kind: 'intent' as const,
    intentId,
    requestedAt: recordedAt,
    ...input.intent
  } as IntentRecord
  await appendJsonlLine(path, intent)
  if (input.eventBus) {
    input.eventBus.emit({
      kind: 'state-change',
      consumer: input.consumerId,
      slug: input.intent.target.initiativeSlug,
      entityKind: 'initiative',
      changeType: 'change'
    })
  }
  return { intentId, recordedAt }
}
