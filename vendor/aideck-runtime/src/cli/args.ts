import { parseArgs } from 'node:util'

export type Subcommand = 'serve' | 'demo' | 'mcp' | 'env'

export interface ParsedArgs {
  subcommand?: Subcommand
  flags: {
    port?: number
    config?: string
    staticDir?: string
    help?: boolean
    version?: boolean
  }
  portExplicit: boolean
}

export class ArgError extends Error {
  constructor(message: string, public readonly hint?: string) {
    super(message)
    this.name = 'ArgError'
  }
}

const SUBCOMMANDS: ReadonlySet<string> = new Set(['serve', 'demo', 'mcp', 'env'])

export function parseCliArgs(argv: string[]): ParsedArgs {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        port: { type: 'string' },
        config: { type: 'string' },
        'static-dir': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' }
      },
      allowPositionals: true,
      strict: true
    })
  } catch (cause) {
    throw new ArgError(
      `invalid usage: ${cause instanceof Error ? cause.message : String(cause)}`,
      'Run `aideck --help` for the supported flags.'
    )
  }

  const sub = parsed.positionals[0]
  if (sub !== undefined && !SUBCOMMANDS.has(sub)) {
    throw new ArgError(
      `unknown subcommand: ${sub}`,
      `Expected one of: ${[...SUBCOMMANDS].join(', ')}`
    )
  }

  let portNum: number | undefined
  if (parsed.values.port !== undefined) {
    portNum = Number(parsed.values.port)
    if (!Number.isInteger(portNum) || portNum < 1024 || portNum > 65535) {
      throw new ArgError(
        `--port=${parsed.values.port} is out of range`,
        'port must be an integer in 1024..65535'
      )
    }
  }

  return {
    subcommand: sub as Subcommand | undefined,
    flags: {
      port: portNum,
      config: parsed.values.config,
      staticDir: parsed.values['static-dir'],
      help: parsed.values.help,
      version: parsed.values.version
    },
    portExplicit: parsed.values.port !== undefined
  }
}
