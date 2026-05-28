import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ErrorResponse } from '../schemas/common.js'
import { err } from '../schemas/validators/index.js'
import { UnsafeConsumerIdError } from '../server/writers/paths.js'
import type { McpToolContext, RegisteredTool } from './types.js'

export interface ToolListEntry {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ToolCallResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>()

  register<TIn, TOut>(tool: RegisteredTool<TIn, TOut>): void {
    if (!tool.name.startsWith('aideck_')) {
      throw new Error(`MCP tool name must start with 'aideck_' (got ${tool.name})`)
    }
    if (this.tools.has(tool.name)) {
      throw new Error(`MCP tool already registered: ${tool.name}`)
    }
    this.tools.set(tool.name, tool as RegisteredTool)
  }

  list(): ToolListEntry[] {
    return Array.from(this.tools.values())
      .map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: zodToJsonSchema(t.inputSchema, { target: 'jsonSchema7' }) as Record<string, unknown>
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  count(): number {
    return this.tools.size
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  async invoke(name: string, rawArgs: unknown, ctx: McpToolContext): Promise<ToolCallResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return errorResult({
        code: 'path_not_found',
        message: `unknown MCP tool: ${name}`,
        suggestion: `Call tools/list to discover available tools (current count: ${this.tools.size})`
      })
    }
    const parsed = tool.inputSchema.safeParse(rawArgs)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      const path = first?.path.join('.') ?? ''
      return errorResult({
        code: 'invalid_input',
        message: path ? `${path}: ${first?.message ?? 'invalid input'}` : (first?.message ?? 'invalid input'),
        details: { path, code: first?.code }
      })
    }
    try {
      const result = await tool.handler(parsed.data, ctx)
      if (result.ok) {
        return {
          content: [{ type: 'text', text: JSON.stringify(result.value) }]
        }
      }
      return errorResult(result.error)
    } catch (cause) {
      if (cause instanceof UnsafeConsumerIdError) {
        return errorResult({ code: 'invalid_input', message: cause.message })
      }
      return errorResult({
        code: 'internal_error',
        message: `tool ${name} threw: ${cause instanceof Error ? cause.message : String(cause)}`
      })
    }
  }
}

function errorResult(e: ErrorResponse): ToolCallResult {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ schemaVersion: '0.1', error: e }) }]
  }
}

export { err }
