/**
 * `atomic-skills serve` — build dashboard + spawn aideck pointed at the
 * built bundle. Writes ~/.atomic-skills/env (AS_DASHBOARD_URL) so the
 * SessionStart hook can surface the URL.
 *
 * The env file is only written AFTER aideck responds on /api/health. If
 * aideck cannot start (missing binary, port collision, crash on boot)
 * we never advertise a URL the user can't reach. The file is always
 * removed on SIGINT/SIGTERM/child-exit cleanup.
 *
 * Dependencies:
 * - aiDeck CLI must be installed somewhere resolvable (npx, npm-global,
 *   sibling repo via `node ../aideck/dist/cli.js`). We probe a few common
 *   locations; the user can override with `--aideck-bin <path>`.
 * - Vite build runs via `npm run build:dashboard`. When atomic-skills is
 *   consumed via `npm install`, the dist/dashboard/ bundle is already
 *   shipped by `prepublishOnly`, so the build is skipped unless
 *   --force-build.
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
 * Validates and normalizes a port input (string or number).
 * @param {unknown} input
 * @returns {string} The port as a decimal string, suitable for use in a URL
 *   or as a CLI flag value.
 * @throws {Error} If input is not an integer in 1..65535.
 */
export function parsePort(input) {
  const n = Number(input)
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Invalid port: ${input}`)
  }
  return String(n)
}

/**
 * Probes for the aideck CLI binary. Order:
 *   1. $AIDECK_BIN env override (full path).
 *   2. ../aideck/dist/cli.js (sibling repo, dev).
 *   3. "aideck" on PATH.
 *
 * Returns the string passed to spawn(). The actual existence check for
 * cases 1 and 3 happens lazily when spawn() runs — case 3's PATH lookup
 * is handled by the OS exec loader.
 */
export function resolveAideckBin() {
  if (process.env.AIDECK_BIN) return process.env.AIDECK_BIN
  const sibling = resolve(PACKAGE_ROOT, '..', 'aideck', 'dist', 'cli.js')
  if (existsSync(sibling)) return sibling
  return 'aideck'
}

/**
 * Builds the dashboard bundle on demand. Returns the path to dist/dashboard/.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.forceBuild]
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
 * Spawns aideck pointed at `bundleDir` with --static-dir. Returns the
 * ChildProcess so the caller can attach 'error' / 'exit' handlers and
 * stream signals.
 */
function spawnAideck(opts) {
  const bin = opts.aideckBin ?? resolveAideckBin()
  const args = ['serve', '--static-dir', opts.bundleDir]
  if (opts.port) args.push('--port', opts.port)
  const cwd = opts.cwd ?? process.cwd()

  // aideck binary is either:
  //   - A direct executable (npm global install or PATH): spawn it.
  //   - A `node <path>.js` invocation (sibling dist): use node.
  let cmd
  let cmdArgs
  if (bin.endsWith('.js') || bin.endsWith('.mjs')) {
    cmd = 'node'
    cmdArgs = [bin, ...args]
  } else {
    cmd = bin
    cmdArgs = args
  }

  return spawn(cmd, cmdArgs, { cwd, stdio: 'inherit' })
}

/**
 * Writes ~/.atomic-skills/env with the dashboard URL. POSIX-quoted; mode
 * 0o600. Parent dir created with 0o700.
 *
 * NOT exported from the package surface — only the public `serve()` entry
 * point should mutate the user's $HOME. Pre-Phase-E, this function was on
 * an `__testing` export, which exposed the home-mutation side effect to
 * any consumer who imported the module (Codex F-004). Removed.
 */
function writeEnvFile(url) {
  const dir = dirname(ENV_FILE_PATH)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const quoted = `'${url.replace(/'/g, `'\\''`)}'`
  const body = `# atomic-skills dashboard — generated, do not edit\nexport AS_DASHBOARD_URL=${quoted}\n`
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
 * Polls GET <baseUrl>/api/health until 200 OK or timeout. Returns true on
 * first OK, false on timeout. Used to gate env-file write on actual
 * backend readiness (Codex F-001).
 */
async function pollHealth(baseUrl, { timeoutMs = 5000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`)
      if (res.ok) return true
    } catch {
      /* server not up yet */
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

/**
 * Main entry: build (if needed) → spawn aideck → wait for /api/health →
 * write env file → wait for child exit.
 *
 * @param {object} [opts]
 * @param {string|number} [opts.port]
 * @param {boolean} [opts.forceBuild]
 * @param {string} [opts.aideckBin]
 */
export async function serve(opts = {}) {
  const bundleDir = await ensureBundle({ forceBuild: opts.forceBuild })
  // Validate port BEFORE any side effect or spawn (Codex F-002).
  const port = parsePort(opts.port ?? '7777')
  const url = `http://127.0.0.1:${port}`

  const child = spawnAideck({ bundleDir, port, aideckBin: opts.aideckBin })

  let envWritten = false
  let spawnFailed = false

  const cleanup = () => {
    if (envWritten) removeEnvFile()
    if (!child.killed) child.kill('SIGINT')
  }
  process.once('SIGINT', cleanup)
  process.once('SIGTERM', cleanup)

  child.on('error', (cause) => {
    spawnFailed = true
    process.stderr.write(`atomic-skills serve: spawn failed — ${cause.message}\n`)
    cleanup()
    process.exitCode = 1
  })

  // Background health probe — only writes the env file after aideck
  // actually responds. If spawn fails or health times out, we never
  // advertise a dead URL to SessionStart hooks (Codex F-001).
  ;(async () => {
    if (spawnFailed) return
    const healthy = await pollHealth(url)
    if (!healthy || spawnFailed) return
    writeEnvFile(url)
    envWritten = true
    console.error(`atomic-skills serve: dashboard at ${url}`)
  })().catch(() => {
    /* best effort; child 'exit' handler still runs cleanup */
  })

  await new Promise((resolveP) => {
    child.on('exit', (code, signal) => {
      if (envWritten) removeEnvFile()
      if (signal === 'SIGINT' || signal === 'SIGTERM') process.exit(0)
      process.exit(code ?? process.exitCode ?? 0)
      resolveP(undefined)
    })
  })
}

// Test-only re-exports. PURE helpers and constants only — the FS-mutating
// helpers (writeEnvFile / removeEnvFile) are NOT exposed here, because src/
// ships in the npm package and exporting them would let any consumer mutate
// the user's $HOME via `import { __testing } from '@henryavila/atomic-skills/...'`.
//
// Coverage for the FS-mutating helpers is provided by the e2e smoke test
// (tests/e2e-smoke.test.js) which exercises the public `serve()` entry
// point with a real spawned aideck.
export const __testing = Object.freeze({
  parsePort,
  resolveAideckBin,
  ENV_FILE_PATH,
  DEFAULT_BUNDLE_DIR,
})
