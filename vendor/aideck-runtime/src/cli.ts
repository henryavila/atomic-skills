#!/usr/bin/env node
import { pathToFileURL } from 'node:url'
import { ArgError, parseCliArgs } from './cli/args.js'
import { HELP_TEXT } from './cli/help.js'
import { readVersion } from './cli/version.js'

export interface CliRunOptions {
  argv?: string[]
  stdout?: NodeJS.WritableStream
  stderr?: NodeJS.WritableStream
  /** Test hook: skip `process.exit` so the runner can assert exit codes. */
  shouldExit?: (code: number) => void
}

function printHelp(stdout: NodeJS.WritableStream): void {
  stdout.write(HELP_TEXT)
}

function printVersion(stdout: NodeJS.WritableStream): void {
  stdout.write(`${readVersion()}\n`)
}

async function dispatchServe(
  parsed: ReturnType<typeof parseCliArgs>,
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream
): Promise<number> {
  const { startServer } = await import('./server/index.js')
  const { resolvePort, PortInUseError } = await import('./server/port-resolver.js')
  const { writeEnvFile, removeEnvFile } = await import('./server/env-file.js')
  const { stat } = await import('node:fs/promises')
  const { resolve } = await import('node:path')
  try {
    let staticDir: string | undefined
    if (parsed.flags.staticDir) {
      const abs = resolve(parsed.flags.staticDir)
      try {
        const st = await stat(abs)
        if (!st.isDirectory()) {
          stderr.write(`aideck serve: --static-dir=${parsed.flags.staticDir} is not a directory\n`)
          return 1
        }
      } catch {
        stderr.write(`aideck serve: --static-dir=${parsed.flags.staticDir} does not exist\n`)
        return 1
      }
      staticDir = abs
    }
    const port = await resolvePort({
      requested: parsed.flags.port,
      isExplicit: parsed.portExplicit
    })
    const running = await startServer({ rootDir: process.cwd(), port, staticDir })
    const url = `http://127.0.0.1:${running.port}`
    await writeEnvFile({ url, port: running.port })
    stdout.write(`aideck serve: listening on ${url}${staticDir ? ` (static: ${staticDir})` : ''}\n`)
    let stopping = false
    const shutdown = async (signal: string) => {
      if (stopping) return
      stopping = true
      stdout.write(`aideck serve: received ${signal}, shutting down\n`)
      await removeEnvFile()
      await running.stop()
      process.exit(0)
    }
    process.on('SIGINT', () => void shutdown('SIGINT'))
    process.on('SIGTERM', () => void shutdown('SIGTERM'))
    return -1 // long-running
  } catch (cause) {
    if (cause instanceof PortInUseError) {
      stderr.write(`aideck serve: ${cause.message}. Try --port=<higher>\n`)
      return 1
    }
    stderr.write(`aideck serve: ${cause instanceof Error ? cause.message : String(cause)}\n`)
    return 1
  }
}

async function dispatchDemo(parsed: ReturnType<typeof parseCliArgs>, stdout: NodeJS.WritableStream): Promise<number> {
  const { startServer } = await import('./server/index.js')
  const { resolvePort, PortInUseError } = await import('./server/port-resolver.js')
  const { writeEnvFile, removeEnvFile } = await import('./server/env-file.js')
  const { seedDemo } = await import('./demo/seed.js')
  const { createFakeConsumer } = await import('./demo/fake-consumer.js')

  // Track resources in startup order so the catch path can tear them down.
  let env: Awaited<ReturnType<typeof seedDemo>> | null = null
  let running: Awaited<ReturnType<typeof startServer>> | null = null
  let consumer: ReturnType<typeof createFakeConsumer> | null = null
  let envFileWritten = false

  try {
    env = await seedDemo()
    const port = await resolvePort({
      requested: parsed.flags.port,
      isExplicit: parsed.portExplicit
    })
    running = await startServer({ rootDir: env.rootDir, port, demo: true })
    const url = `http://127.0.0.1:${running.port}`
    await writeEnvFile({ url, port: running.port })
    envFileWritten = true
    consumer = createFakeConsumer({ rootDir: env.rootDir })
    await consumer.start()
    stdout.write(`aideck DEMO mode — ${url} (root=${env.rootDir})\n`)

    if (!process.env.AIDECK_DEMO_NO_OPEN) {
      try {
        const { default: open } = await import('open')
        await open(url)
      } catch {
        // Ignore browser-open failures (headless CI).
      }
    }

    let stopping = false
    const startedConsumer = consumer
    const startedRunning = running
    const startedEnv = env
    const shutdown = async (signal: string) => {
      if (stopping) return
      stopping = true
      stdout.write(`aideck demo: received ${signal}, cleaning up\n`)
      if (envFileWritten) await removeEnvFile()
      await startedConsumer.stop()
      await startedRunning.stop()
      await startedEnv.cleanup()
      process.exit(0)
    }
    process.on('SIGINT', () => void shutdown('SIGINT'))
    process.on('SIGTERM', () => void shutdown('SIGTERM'))
    return -1
  } catch (cause) {
    // Best-effort cleanup in reverse startup order.
    if (consumer) {
      try { await consumer.stop() } catch { /* swallow */ }
    }
    if (envFileWritten) {
      try { await removeEnvFile() } catch { /* swallow */ }
    }
    if (running) {
      try { await running.stop() } catch { /* swallow */ }
    }
    if (env) {
      try { await env.cleanup() } catch { /* swallow */ }
    }
    if (cause instanceof PortInUseError) {
      process.stderr.write(`aideck demo: ${cause.message}. Try --port=<higher>\n`)
      return 1
    }
    process.stderr.write(`aideck demo: ${cause instanceof Error ? cause.message : String(cause)}\n`)
    return 1
  }
}

async function dispatchMcp(): Promise<number> {
  const { startStdio } = await import('./mcp/index.js')
  try {
    await startStdio({ rootDir: process.cwd() })
    return -1
  } catch (cause) {
    process.stderr.write(`aideck mcp: ${cause instanceof Error ? cause.message : String(cause)}\n`)
    return 1
  }
}

async function dispatchEnv(stdout: NodeJS.WritableStream): Promise<number> {
  const { runEnvCmd } = await import('./cli/env-cmd.js')
  return runEnvCmd(stdout)
}

export async function runCli(opts: CliRunOptions = {}): Promise<number> {
  const stdout = opts.stdout ?? process.stdout
  const stderr = opts.stderr ?? process.stderr
  const argv = opts.argv ?? process.argv.slice(2)
  let parsed: ReturnType<typeof parseCliArgs>
  try {
    parsed = parseCliArgs(argv)
  } catch (cause) {
    const msg = cause instanceof ArgError
      ? `${cause.message}${cause.hint ? `\n${cause.hint}` : ''}`
      : (cause instanceof Error ? cause.message : String(cause))
    stderr.write(`${msg}\n`)
    return 1
  }

  if (parsed.flags.version) {
    printVersion(stdout)
    return 0
  }
  if (parsed.flags.help || !parsed.subcommand) {
    printHelp(stdout)
    return 0
  }

  switch (parsed.subcommand) {
    case 'serve':
      return dispatchServe(parsed, stdout, stderr)
    case 'demo':
      return dispatchDemo(parsed, stdout)
    case 'mcp':
      return dispatchMcp()
    case 'env':
      return dispatchEnv(stdout)
  }
}

export function placeholder(): void {
  // Kept so prior re-exports remain compatible during transition.
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then(
    (code) => {
      if (code >= 0) process.exit(code)
    },
    (cause) => {
      process.stderr.write(`aideck: ${cause instanceof Error ? cause.message : String(cause)}\n`)
      process.exit(1)
    }
  )
}
