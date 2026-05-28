import type { ErrorResponse } from '../schemas/common.js'
import type { Result } from '../schemas/validators/index.js'
import type { z } from 'zod'

export interface McpToolContext {
  rootDir: string
  version: string
}

export type McpResult<T> = Result<T, ErrorResponse>

export interface RegisteredTool<TIn = unknown, TOut = unknown> {
  name: string
  description: string
  inputSchema: z.ZodType<TIn>
  handler: (input: TIn, ctx: McpToolContext) => Promise<McpResult<TOut>> | McpResult<TOut>
}
