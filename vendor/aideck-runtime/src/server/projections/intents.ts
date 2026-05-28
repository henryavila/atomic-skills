import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { IntentApplication, IntentRecord } from '../../schemas/common.js'
import { parseInboxLine, parseJsonlFile } from '../parsers/jsonl.js'

export interface IntentStatus {
  intent: IntentRecord
  appliedBy?: IntentApplication
}

async function listInboxFiles(inboxDir: string): Promise<string[]> {
  try {
    return (await readdir(inboxDir)).filter((f) => f.endsWith('.jsonl')).map((f) => join(inboxDir, f))
  } catch {
    return []
  }
}

export async function listIntents(consumerRoot: string): Promise<IntentStatus[]> {
  const files = await listInboxFiles(join(consumerRoot, 'inbox'))
  const intents = new Map<string, IntentRecord>()
  const applications = new Map<string, IntentApplication>()

  for (const path of files) {
    const { items } = await parseJsonlFile(path, parseInboxLine, () => {})
    for (const item of items) {
      if (item.kind === 'intent') {
        intents.set(item.value.intentId, item.value)
      } else if (item.kind === 'intent_application') {
        applications.set(item.value.refId, item.value)
      }
    }
  }

  const out: IntentStatus[] = []
  for (const [id, intent] of intents) {
    const application = applications.get(id)
    out.push(application ? { intent, appliedBy: application } : { intent })
  }
  return out
}

export async function listPendingIntents(consumerRoot: string): Promise<IntentRecord[]> {
  const all = await listIntents(consumerRoot)
  return all.filter((s) => !s.appliedBy).map((s) => s.intent)
}
