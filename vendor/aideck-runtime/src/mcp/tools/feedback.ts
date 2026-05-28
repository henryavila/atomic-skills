import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { annotationTargetSchema } from '../../schemas/validators/common.js'
import { ok } from '../../schemas/validators/index.js'
import { appendJsonlLine } from '../../server/writers/jsonl-append.js'
import {
  annotationsPathFor,
  consumerRoot,
  highlightsPathFor,
  inboxPathFor
} from '../../server/writers/paths.js'
import { projectInbox } from '../../server/projections/inbox.js'
import type { RegisteredTool } from '../types.js'

function defineTool<TIn, TOut>(t: RegisteredTool<TIn, TOut>): RegisteredTool {
  return t as unknown as RegisteredTool
}

function nextDailyId(prefix: string): string {
  const day = new Date().toISOString().slice(0, 10)
  return `${prefix}-${day}-${randomUUID().slice(0, 8)}`
}

export const feedbackTools: ReadonlyArray<RegisteredTool> = [
  defineTool({
    name: 'aideck_annotate',
    description: 'Append an Annotation JSONL to the target consumer\'s annotations/.',
    inputSchema: z
      .object({
        target: annotationTargetSchema,
        body: z.string(),
        author: z.enum(['human', 'ai']).default('ai')
      })
      .strict(),
    async handler(input, ctx) {
      const consumer = input.target.consumer
      const path = annotationsPathFor(consumerRoot(ctx.rootDir, consumer))
      const id = nextDailyId('ann')
      const createdAt = new Date().toISOString()
      const annotation = {
        schemaVersion: '0.1' as const,
        id,
        target: input.target,
        body: input.body,
        author: input.author ?? 'ai',
        createdAt
      }
      await appendJsonlLine(path, annotation)
      return ok({ id, createdAt })
    }
  }),

  defineTool({
    name: 'aideck_highlight',
    description: 'Append a Highlight JSONL to the target consumer\'s highlights/.',
    inputSchema: z
      .object({
        target: annotationTargetSchema,
        reason: z.string(),
        severity: z.enum(['info', 'warn', 'critical']),
        source: z.enum(['human', 'ai']).default('ai')
      })
      .strict(),
    async handler(input, ctx) {
      const consumer = input.target.consumer
      const path = highlightsPathFor(consumerRoot(ctx.rootDir, consumer))
      const id = nextDailyId('hl')
      const createdAt = new Date().toISOString()
      const highlight = {
        schemaVersion: '0.1' as const,
        id,
        target: input.target,
        reason: input.reason,
        severity: input.severity,
        source: input.source ?? 'ai',
        createdAt
      }
      await appendJsonlLine(path, highlight)
      return ok({ id, createdAt })
    }
  }),

  defineTool({
    // Routed via inbox/ to honor C6 (allowed write dirs are annotations/,
    // highlights/, inbox/). Decisions remain append-only.
    name: 'aideck_record_decision',
    description: 'Append a Decision JSONL to the consumer\'s inbox/ as a `kind: "decision"` record.',
    inputSchema: z
      .object({
        target: annotationTargetSchema,
        decision: z.enum(['approve', 'reject', 'block', 'defer']),
        reason: z.string().optional(),
        by: z.enum(['human', 'ai']).default('ai')
      })
      .strict(),
    async handler(input, ctx) {
      const consumer = input.target.consumer
      const path = inboxPathFor(consumerRoot(ctx.rootDir, consumer))
      const id = nextDailyId('dec')
      const createdAt = new Date().toISOString()
      const record = {
        schemaVersion: '0.1' as const,
        kind: 'decision' as const,
        id,
        target: input.target,
        decision: input.decision,
        ...(input.reason ? { reason: input.reason } : {}),
        by: input.by ?? 'ai',
        createdAt
      }
      await appendJsonlLine(path, record)
      return ok({ id, createdAt })
    }
  }),

  defineTool({
    name: 'aideck_inbox',
    description: 'Read aggregated inbox (annotations + highlights + decisions, with resolutions/acks applied).',
    inputSchema: z
      .object({
        consumer: z.string().optional(),
        since: z.string().optional(),
        limit: z.number().int().positive().max(500).optional()
      })
      .strict(),
    async handler(input, ctx) {
      const proj = await projectInbox(ctx.rootDir, {
        consumer: input.consumer,
        since: input.since,
        limit: input.limit
      })
      return ok(proj)
    }
  })
]
