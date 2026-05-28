import { join } from 'node:path'
import { z } from 'zod'
import type { ErrorResponse, IntentRecord } from '../../schemas/common.js'
import type { Initiative } from '../../schemas/project-status.js'
import { type Result, err, ok } from '../../schemas/validators/index.js'
import { parseInitiativeFile } from '../../server/parsers/project-status.js'
import { appendIntent, type IntentPayload, type IntentReceipt } from '../../server/writers/intents.js'
import { consumerRoot } from '../../server/writers/paths.js'
import type { McpToolContext, RegisteredTool } from '../types.js'

interface MutateReceipt extends IntentReceipt {
  accepted: true
  note: string
  phaseCompleteHint?: { initiativeSlug: string; remaining: number; lastTaskId: string }
  warning?: string
  suggestion?: Record<string, unknown>
}

function defineTool<TIn, TOut>(t: RegisteredTool<TIn, TOut>): RegisteredTool {
  return t as unknown as RegisteredTool
}

async function record(
  ctx: McpToolContext,
  consumer: string,
  intent: IntentPayload,
  extra: Partial<MutateReceipt> = {}
): Promise<Result<MutateReceipt, ErrorResponse>> {
  const receipt = await appendIntent({
    consumerRoot: consumerRoot(ctx.rootDir, consumer),
    consumerId: consumer,
    intent
  })
  return ok({
    ...receipt,
    accepted: true,
    note: 'Intent recorded; consumer skill applies.',
    ...extra
  })
}

async function requireInitiative(
  ctx: McpToolContext,
  consumer: string,
  initiativeSlug: string
): Promise<Result<Initiative, ErrorResponse>> {
  const initPath = join(consumerRoot(ctx.rootDir, consumer), 'initiatives', `${initiativeSlug}.md`)
  return parseInitiativeFile(initPath)
}

const baseTarget = z
  .object({
    consumer: z.string(),
    initiativeSlug: z.string()
  })
  .strict()

const byField = z.enum(['human', 'ai']).default('ai')

type Operation = IntentRecord['operation']

export const mutateTools: ReadonlyArray<RegisteredTool> = [
  defineTool({
    name: 'aideck_mark_task_done',
    description: 'Record an intent to mark a task done. aiDeck never edits the file; a consumer skill applies.',
    inputSchema: baseTarget.extend({
      taskId: z.string(),
      verifierResultId: z.string().optional(),
      by: byField
    }).strict(),
    async handler(input, ctx) {
      let phaseCompleteHint: MutateReceipt['phaseCompleteHint'] | undefined
      const initiativeRes = await requireInitiative(ctx, input.consumer, input.initiativeSlug)
      if (!initiativeRes.ok) return initiativeRes
      const initiative = initiativeRes.value
      const remaining = initiative.tasks.filter((t) => t.status !== 'done' && t.id !== input.taskId).length
      if (remaining === 0) {
        phaseCompleteHint = {
          initiativeSlug: input.initiativeSlug,
          remaining,
          lastTaskId: input.taskId
        }
      }
      return record(
        ctx,
        input.consumer,
        {
          operation: 'mark_task_done' satisfies Operation,
          target: { initiativeSlug: input.initiativeSlug, taskId: input.taskId },
          args: input.verifierResultId ? { verifierResultId: input.verifierResultId } : {},
          by: input.by ?? 'ai'
        },
        phaseCompleteHint ? { phaseCompleteHint } : {}
      )
    }
  }),

  defineTool({
    name: 'aideck_update_initiative_status',
    description: 'Record an intent to change an Initiative status (pending|active|paused|done|archived).',
    inputSchema: baseTarget.extend({
      status: z.enum(['pending', 'active', 'paused', 'done', 'archived']),
      reason: z.string().optional(),
      by: byField
    }).strict(),
    async handler(input, ctx) {
      const initiativeRes = await requireInitiative(ctx, input.consumer, input.initiativeSlug)
      if (!initiativeRes.ok) return initiativeRes
      return record(
        ctx,
        input.consumer,
        {
          operation: 'update_initiative_status',
          target: { initiativeSlug: input.initiativeSlug },
          args: { status: input.status, ...(input.reason ? { reason: input.reason } : {}) },
          by: input.by ?? 'ai'
        }
      )
    }
  }),

  defineTool({
    name: 'aideck_update_next_action',
    description: 'Record an intent to update Initiative.nextAction.',
    inputSchema: baseTarget.extend({
      nextAction: z.string().nullable(),
      by: byField
    }).strict(),
    async handler(input, ctx) {
      const initiativeRes = await requireInitiative(ctx, input.consumer, input.initiativeSlug)
      if (!initiativeRes.ok) return initiativeRes
      return record(
        ctx,
        input.consumer,
        {
          operation: 'update_next_action',
          target: { initiativeSlug: input.initiativeSlug },
          args: { nextAction: input.nextAction },
          by: input.by ?? 'ai'
        }
      )
    }
  }),

  defineTool({
    name: 'aideck_push_frame',
    description: 'Record an intent to push a new stack frame (task|research|validation|discussion).',
    inputSchema: baseTarget.extend({
      title: z.string(),
      type: z.enum(['task', 'research', 'validation', 'discussion']),
      by: byField
    }).strict(),
    async handler(input, ctx) {
      const initiativeRes = await requireInitiative(ctx, input.consumer, input.initiativeSlug)
      if (!initiativeRes.ok) return initiativeRes
      const initiative = initiativeRes.value
      const warning = initiative.stack.length >= 5
        ? `stack depth is ${initiative.stack.length}; consider popping a frame before pushing another`
        : undefined
      return record(
        ctx,
        input.consumer,
        {
          operation: 'push_frame',
          target: { initiativeSlug: input.initiativeSlug },
          args: { title: input.title, type: input.type },
          by: input.by ?? 'ai'
        },
        warning ? { warning } : {}
      )
    }
  }),

  defineTool({
    name: 'aideck_pop_frame',
    description: 'Record an intent to pop the top stack frame. Precondition: stack non-empty.',
    inputSchema: baseTarget.extend({
      destination: z.string().optional(),
      by: byField
    }).strict(),
    async handler(input, ctx): Promise<Result<MutateReceipt, ErrorResponse>> {
      const initiativeRes = await requireInitiative(ctx, input.consumer, input.initiativeSlug)
      if (!initiativeRes.ok) return initiativeRes
      const initiative = initiativeRes.value
      if (initiative.stack.length === 0) {
        return err({
          code: 'precondition_failed',
          message: 'cannot pop from an empty stack',
          suggestion: 'push a frame first or check current state via aideck_get_initiative'
        })
      }
      return record(
        ctx,
        input.consumer,
        {
          operation: 'pop_frame',
          target: { initiativeSlug: input.initiativeSlug },
          args: input.destination ? { destination: input.destination } : {},
          by: input.by ?? 'ai'
        }
      )
    }
  }),

  defineTool({
    name: 'aideck_park_item',
    description: 'Record an intent to park a lateral item (out-of-scope but worth remembering).',
    inputSchema: baseTarget.extend({
      title: z.string(),
      by: byField
    }).strict(),
    async handler(input, ctx) {
      const initiativeRes = await requireInitiative(ctx, input.consumer, input.initiativeSlug)
      if (!initiativeRes.ok) return initiativeRes
      return record(
        ctx,
        input.consumer,
        {
          operation: 'park_item',
          target: { initiativeSlug: input.initiativeSlug },
          args: { title: input.title },
          by: input.by ?? 'ai'
        }
      )
    }
  }),

  defineTool({
    name: 'aideck_emerge_item',
    description: 'Record an intent to log an emerged item (work that surfaced during execution).',
    inputSchema: baseTarget.extend({
      title: z.string(),
      by: byField
    }).strict(),
    async handler(input, ctx) {
      const initiativeRes = await requireInitiative(ctx, input.consumer, input.initiativeSlug)
      if (!initiativeRes.ok) return initiativeRes
      const slug = input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      return record(
        ctx,
        input.consumer,
        {
          operation: 'emerge_item',
          target: { initiativeSlug: input.initiativeSlug },
          args: { title: input.title },
          by: input.by ?? 'ai'
        },
        { suggestion: { newInitiativeSlug: slug } }
      )
    }
  }),

  defineTool({
    name: 'aideck_promote_parked',
    description: 'Record an intent to promote a parked item to a real task or initiative.',
    inputSchema: baseTarget.extend({
      parkedTitleOrIndex: z.union([z.string(), z.number().int().nonnegative()]),
      by: byField
    }).strict(),
    async handler(input, ctx): Promise<Result<MutateReceipt, ErrorResponse>> {
      const initiativeRes = await requireInitiative(ctx, input.consumer, input.initiativeSlug)
      if (!initiativeRes.ok) return initiativeRes
      const initiative = initiativeRes.value
      const found = typeof input.parkedTitleOrIndex === 'number'
        ? input.parkedTitleOrIndex < initiative.parked.length
        : initiative.parked.some((p) => p.title === input.parkedTitleOrIndex)
      if (!found) {
        return err({
          code: 'precondition_failed',
          message: `parked item not found: ${JSON.stringify(input.parkedTitleOrIndex)}`,
          suggestion: `current parked count: ${initiative.parked.length}`
        })
      }
      return record(
        ctx,
        input.consumer,
        {
          operation: 'promote_parked',
          target: { initiativeSlug: input.initiativeSlug },
          args: { parked: input.parkedTitleOrIndex },
          by: input.by ?? 'ai'
        }
      )
    }
  }),

  defineTool({
    name: 'aideck_add_task',
    description: 'Record an intent to add a new task to an Initiative. Consumer assigns the final task id.',
    inputSchema: baseTarget.extend({
      title: z.string(),
      description: z.string().optional(),
      verifier: z.unknown().optional(),
      by: byField
    }).strict(),
    async handler(input, ctx) {
      const initiativeRes = await requireInitiative(ctx, input.consumer, input.initiativeSlug)
      if (!initiativeRes.ok) return initiativeRes
      const args: { title: string; description?: string; verifier?: unknown } = { title: input.title }
      if (input.description) args.description = input.description
      if (input.verifier) args.verifier = input.verifier
      return record(
        ctx,
        input.consumer,
        {
          operation: 'add_task',
          target: { initiativeSlug: input.initiativeSlug },
          args,
          by: input.by ?? 'ai'
        }
      )
    }
  })
]
