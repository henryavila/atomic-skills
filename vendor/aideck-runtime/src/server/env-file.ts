/**
 * ~/.aideck/env writer/reader.
 *
 * Atomicity & permissions: applied via open(O_CREAT | O_WRONLY | O_EXCL, 0o600).
 * Avoids the writeFile-then-chmod window (certbot #6936, acme.sh #3127,
 * KeePassXC #2575). If a stale env file is present, it is unlinked first.
 * Parent dir is created with mode 0o700 when missing; existing directories
 * with looser permissions are NOT silently downgraded.
 */
import { constants, promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export interface EnvFileOverride {
  dir?: string
}

export function envFilePath(override: EnvFileOverride = {}): string {
  return join(override.dir ?? join(homedir(), '.aideck'), 'env')
}

export interface EnvFileContent {
  url: string
  port: number
}

/**
 * Quote a string for safe inclusion in a POSIX shell single-quoted string.
 * Single-quoted strings in POSIX shells suppress all interpretation EXCEPT
 * the closing single-quote itself, so the standard escape is to close the
 * quote, emit a literal escaped single-quote, then re-open: 'foo'\''bar'.
 */
function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export async function writeEnvFile(content: EnvFileContent, override: EnvFileOverride = {}): Promise<string> {
  const path = envFilePath(override)
  const dir = dirname(path)
  if (!Number.isInteger(content.port) || content.port < 1 || content.port > 65535) {
    throw new Error(`writeEnvFile: invalid port ${content.port}`)
  }
  try {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  } catch (cause) {
    throw new Error(`writeEnvFile: failed to create ${dir}: ${cause instanceof Error ? cause.message : String(cause)}`)
  }

  try {
    await fs.unlink(path)
  } catch {
    // not present — fine
  }

  const body = `# aiDeck environment — generated, do not edit
export AIDECK_URL=${shellSingleQuote(content.url)}
export AIDECK_PORT=${content.port}
`
  const handle = await fs.open(path, constants.O_CREAT | constants.O_WRONLY | constants.O_EXCL, 0o600)
  try {
    await handle.writeFile(body, 'utf8')
  } finally {
    await handle.close()
  }
  return path
}

export async function removeEnvFile(override: EnvFileOverride = {}): Promise<void> {
  const path = envFilePath(override)
  try {
    await fs.unlink(path)
  } catch {
    // missing → already removed
  }
}

export async function readEnvFile(override: EnvFileOverride = {}): Promise<string | null> {
  const path = envFilePath(override)
  try {
    return await fs.readFile(path, 'utf8')
  } catch {
    return null
  }
}
