/**
 * `atomic-skills serve` — build dashboard + spawn aideck pointed at the
 * built bundle. Writes ~/.atomic-skills/env so the SessionStart hook can
 * surface the URL.
 *
 * Dependencies:
 * - aiDeck CLI must be installed somewhere resolvable (npx, npm-global,
 *   sibling repo via `node ../aideck/dist/cli.js`). We probe a few common
 *   locations; the user can override with `--aideck-bin <path>`.
 * - Vite dev/build is invoked via the local `node_modules/.bin/vite` script
 *   that ships with the package's devDependencies. When atomic-skills is
 *   consumed via npm install, the dist/dashboard/ bundle is already shipped
 *   by `prepublishOnly`, so the build step is skipped unless --force-build.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = resolve(__dirname, '..')
const DEFAULT_BUNDLE_DIR = join(PACKAGE_ROOT, 'dist', 'dashboard')
const ENV_FILE_PATH = join(homedir(), '.atomic-skills', 'env')

/**
 * Returns the absolute path to the dashboard bundle, building it on demand.
 *
 * @param {object} opts
 * @param {boolean} [opts.forceBuild]
 * @returns {Promise<string>}
 */
async function ensureBundle(opts = {}) {
  const indexHtml = join(DEFAULT_BUNDLE_DIR, 'index.html')
  if (!opts.forceBuild && existsSync(indexHtml)) return DEFAULT_BUNDLE_DIR

  console.error('atomic-skills serve: building dashboard…')
  await runStreaming('npm', ['run', 'build:dashboard'], { cwd: PACKAGE_ROOT })
  if (!existsSync(indexHtml)) {
    throw new Error(
      `Build completed but ${indexHtml} not found. Check vite.config.ts outDir.`
    )
  }
  return DEFAULT_BUNDLE_DIR
}

/**
 * Spawns aideck pointed at `bundleDir`. Returns the child process so the
 * caller can stream signals.
 *
 * @param {object} opts
 * @param {string} opts.bundleDir
 * @param {string} [opts.aideckBin]
 * @param {string} [opts.port]
 * @param {string} [opts.cwd]
 * @returns {import('node:child_process').ChildProcess}
 */
function spawnAideck(opts) {
  const bin = opts.aideckBin ?? resolveAideckBin()
  const args = ['serve', '--static-dir', opts.bundleDir]
  if (opts.port) args.push('--port', opts.port)
  const cwd = opts.cwd ?? process.cwd()

  // The aideck binary is either:
  //   1. A direct executable (npm global install): spawn it.
  //   2. A `node <path>.js` invocation (sibling dist): use node.
  let cmd
  let cmdArgs
  if (bin.endsWith('.js') || bin.endsWith('.mjs')) {
    cmd = 'node'
    cmdArgs = [bin, ...args]
  } else {
    cmd = bin
    cmdArgs = args
  }

  const child = spawn(cmd, cmdArgs, { cwd, stdio: 'inherit' })
  return child
}

/**
 * Tries common locations for the aideck executable:
 *   1. `AIDECK_BIN` environment variable.
 *   2. `aideck` on PATH (npm global / brew).
 *   3. Sibling repo at `../aideck/dist/cli.js`.
 * Throws if none resolves.
 */
function resolveAideckBin() {
  if (process.env.AIDECK_BIN) return process.env.AIDECK_BIN
  const sibling = resolve(PACKAGE_ROOT, '..', 'aideck', 'dist', 'cli.js')
  if (existsSync(sibling)) return sibling
  // Fall back to PATH resolution — `spawn('aideck', …)` will fail later if
  // it's not there, with a clearer error than throwing here.
  return 'aideck'
}

/**
 * Writes ~/.atomic-skills/env with the dashboard URL so the SessionStart
 * hook can pick it up. Mirrors aideck's env-file.ts convention.
 *
 * @param {string} url
 */
function writeEnvFile(url) {
  const dir = dirname(ENV_FILE_PATH)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  // POSIX single-quoted, escape only `'` characters.
  const quoted = `'${url.replace(/'/g, `'\\''`)}'`
  const body = `# atomic-skills dashboard — generated, do not edit\nexport AS_DASHBOARD_URL=${quoted}\n`
  // Best-effort atomic replace: unlink then write.
  try {
    unlinkSync(ENV_FILE_PATH)
  } catch {
    /* not present */
  }
  writeFileSync(ENV_FILE_PATH, body, { mode: 0o600 })
}

function removeEnvFile() {
  try {
    unlinkSync(ENV_FILE_PATH)
  } catch {
    /* swallow */
  }
}

function runStreaming(cmd, args, opts) {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts })
    child.on('error', rejectP)
    child.on('exit', (code) => {
      if (code === 0) resolveP()
      else rejectP(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

/**
 * Main entry: build (if needed) + spawn aideck + write env file. Returns
 * after the aideck child exits.
 *
 * @param {object} opts
 * @param {string} [opts.port]
 * @param {boolean} [opts.forceBuild]
 * @param {string} [opts.aideckBin]
 */
export async function serve(opts = {}) {
  const bundleDir = await ensureBundle({ forceBuild: opts.forceBuild })
  const port = opts.port ?? '7777'
  const url = `http://127.0.0.1:${port}`

  writeEnvFile(url)
  console.error(`atomic-skills serve: dashboard at ${url}`)

  const child = spawnAideck({ bundleDir, port, aideckBin: opts.aideckBin })

  const cleanup = () => {
    removeEnvFile()
    if (!child.killed) child.kill('SIGINT')
  }
  process.once('SIGINT', cleanup)
  process.once('SIGTERM', cleanup)

  await new Promise((resolveP) => {
    child.on('exit', (code, signal) => {
      removeEnvFile()
      if (signal === 'SIGINT' || signal === 'SIGTERM') process.exit(0)
      process.exit(code ?? 0)
      resolveP(undefined)
    })
  })
}

// Exported for unit tests.
export const __testing = {
  ensureBundle,
  resolveAideckBin,
  writeEnvFile,
  removeEnvFile,
  ENV_FILE_PATH,
  DEFAULT_BUNDLE_DIR,
  /** Validates that a string is a safe port — for CLI input. */
  parsePort(input) {
    const n = Number(input)
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      throw new Error(`Invalid port: ${input}`)
    }
    return String(n)
  },
}

