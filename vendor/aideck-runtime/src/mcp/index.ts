import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer, type McpServerOptions, type McpBundle } from './server.js'

export { createMcpServer } from './server.js'
export { ToolRegistry } from './registry.js'
export type { McpToolContext, RegisteredTool } from './types.js'

export async function startStdio(opts: McpServerOptions): Promise<McpBundle> {
  const bundle = createMcpServer(opts)
  const transport = new StdioServerTransport()
  await bundle.server.connect(transport)
  return bundle
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startStdio({ rootDir: process.cwd() }).catch((cause) => {
    process.stderr.write(`aideck mcp: ${cause instanceof Error ? cause.message : String(cause)}\n`)
    process.exit(1)
  })
}
