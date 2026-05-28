import { z } from 'zod'
import { ok } from '../../schemas/validators/index.js'
import { listConsumers } from '../../server/projections/consumers.js'
import { buildHealthReport } from '../../server/projections/health.js'
import type { RegisteredTool } from '../types.js'

function defineTool<TIn, TOut>(t: RegisteredTool<TIn, TOut>): RegisteredTool {
  return t as unknown as RegisteredTool
}

export const META_TOOL_COUNT = 24

export const metaTools: ReadonlyArray<RegisteredTool> = [
  defineTool({
    name: 'aideck_list_consumers',
    description: 'List discovered consumers under .atomic-skills/ with their state (active|empty|error).',
    inputSchema: z.object({}),
    async handler(_input, ctx) {
      const consumers = await listConsumers(ctx.rootDir)
      return ok({ consumers })
    }
  }),

  defineTool({
    name: 'aideck_schema_version',
    description: 'Return aiDeck schema version, API version, MCP tool count, and compatible schema list.',
    inputSchema: z.object({}),
    async handler() {
      return ok({
        schemaVersion: '0.1',
        apiVersion: '0.1',
        toolCount: META_TOOL_COUNT,
        compatibleSchemas: ['0.1']
      })
    }
  }),

  defineTool({
    name: 'aideck_health',
    description: 'Return HealthReport with stale initiatives, unmet gates, open highlights, and inbox unread count.',
    inputSchema: z.object({
      consumer: z.string().optional(),
      staleDays: z.number().int().positive().optional()
    }),
    async handler(input, ctx) {
      const report = await buildHealthReport(ctx.rootDir, input.consumer, input.staleDays)
      return ok(report)
    }
  })
]
