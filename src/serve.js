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
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, unlinkSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = resolve(__dirname, '..')
const DEFAULT_BUNDLE_DIR = join(PACKAGE_ROOT, 'dist', 'dashboard')
const DEMO_FIXTURES_DIR = join(PACKAGE_ROOT, 'assets', 'demo-fixtures')
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
 *   2. ~/.atomic-skills/bin/aideck.mjs (the launcher shim the installer writes,
 *      pointing at the published @henryavila/aideck package — see install.js).
 *   3. The published @henryavila/aideck package's bin, resolved from this
 *      package's node_modules (works before a re-install has staged the shim).
 *   4. ../aideck/dist/cli.js (sibling repo, dev only — may be a feature branch).
 *   5. "aideck" on PATH.
 *
 * The vendored single-file bundle (dist/aideck.mjs) was dropped once aiDeck
 * shipped to npm — atomic-skills now consumes @henryavila/aideck as a real
 * dependency (T-004 / doc 13 Phase D).
 *
 * Returns the string passed to spawn(). The actual existence check for
 * cases 1 and 5 happens lazily when spawn() runs — case 5's PATH lookup
 * is handled by the OS exec loader.
 */
export function resolveAideckBin() {
  if (process.env.AIDECK_BIN) return process.env.AIDECK_BIN
  // Prefer the installed launcher shim (stable, points at the published pkg).
  const installed = join(homedir(), '.atomic-skills', 'bin', 'aideck.mjs')
  if (existsSync(installed)) return installed
  // Resolve the published npm package directly (its deps are hoisted here).
  const pkgDir = resolveAideckPackageDir()
  if (pkgDir) {
    const cli = join(pkgDir, 'dist', 'cli.js')
    if (existsSync(cli)) return cli
  }
  // Sibling repo is last resort — it may be on a feature branch.
  const sibling = resolve(PACKAGE_ROOT, '..', 'aideck', 'dist', 'cli.js')
  if (existsSync(sibling)) return sibling
  return 'aideck'
}

/**
 * Resolves the installed @henryavila/aideck package directory, or null when it
 * is not installed (e.g. before the npm publish lands, or in a stripped
 * checkout). Pure; never throws.
 *
 * Uses a node_modules filesystem walk rather than require.resolve: the
 * published package is ESM-only and its `exports` map exposes neither
 * `./package.json` nor `./dist/cli.js` (and offers no `require` condition), so
 * CJS resolution throws ERR_PACKAGE_PATH_NOT_EXPORTED. Reading the dir off disk
 * sidesteps `exports` entirely — and the launcher shim imports cli.js by
 * absolute path, which `exports` does not gate.
 *
 * @returns {string|null}
 */
export function resolveAideckPackageDir() {
  let dir = PACKAGE_ROOT
  for (;;) {
    const cand = join(dir, 'node_modules', '@henryavila', 'aideck')
    if (existsSync(join(cand, 'package.json'))) return cand
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
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
 * Stages the demo fixtures into a fresh tmp directory and returns its path.
 * Caller is responsible for `rmSync` on cleanup.
 *
 * The fixtures live in `<package-root>/assets/demo-fixtures/.atomic-skills/`.
 * We copy them to a tmp dir (rather than serving directly from the package)
 * because (a) some configurations write inbox/annotations alongside, and
 * (b) the tmp dir becomes aideck's cwd so its watcher sees a clean state.
 */
function stageDemoFixtures() {
  if (!existsSync(DEMO_FIXTURES_DIR)) {
    throw new Error(
      `Demo fixtures not found at ${DEMO_FIXTURES_DIR}. Reinstall atomic-skills or check the package contents.`
    )
  }
  const tmpRoot = mkdtempSync(join(tmpdir(), 'atomic-skills-demo-'))
  cpSync(DEMO_FIXTURES_DIR, tmpRoot, { recursive: true })
  return tmpRoot
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

const AIDECK_ENV_FILE_PATH = join(homedir(), '.aideck', 'env')

function readUrlFromAnyEnvFile() {
  for (const { path, pattern } of [
    { path: ENV_FILE_PATH, pattern: /AS_DASHBOARD_URL='([^']+)'/ },
    { path: AIDECK_ENV_FILE_PATH, pattern: /AIDECK_URL='([^']+)'/ }
  ]) {
    if (!existsSync(path)) continue
    try {
      const content = readFileSync(path, 'utf8')
      const match = content.match(pattern)
      if (match) return match[1]
    } catch { /* unreadable */ }
  }
  return null
}

/**
 * Derive a projectId slug from a directory path, matching the algorithm in
 * aideck's ProjectRegistry: lowercase basename, replace invalid chars with
 * hyphens, strip leading digits/hyphens, truncate to 64 chars.
 */
export function deriveProjectId(rootDir) {
  let id = basename(rootDir)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^[^a-z]+/, '')
    .slice(0, 64)
  return id || 'project'
}

/**
 * Enumerate the projects present on disk under the nested layout
 * `<stateRoot>/projects/<projectId>/<planSlug>/plan.md`. The folder name IS the
 * projectId (Decision #9 / R-ORCH-26) — this on-disk enumeration is the source
 * of truth for "which projects exist", replacing the aiDeck in-memory
 * ProjectRegistry + cwd-basename derivation (R-MIG-13; the aiDeck consumer side
 * lands WITH the rewrite, Inc7). A project is listed only if it contains at
 * least one plan (a `<slug>/plan.md`), mirroring aiDeck's hasContent. Returns []
 * when `projects/` is absent (e.g. a pure flat tree mid-migration).
 *
 * Pure read; honors a redirectable state root (F-D1) so a dogfood copy can be
 * enumerated without touching the live tree.
 *
 * @param {string} [stateRoot] - path to the `.atomic-skills` dir (default './.atomic-skills')
 * @returns {Array<{ projectId: string, plans: string[] }>} sorted by projectId
 */
export function listProjects(stateRoot = '.atomic-skills') {
  const projectsDir = join(stateRoot, 'projects')
  if (!existsSync(projectsDir) || !statSync(projectsDir).isDirectory()) return []
  const out = []
  for (const projectId of readdirSync(projectsDir).sort()) {
    const projPath = join(projectsDir, projectId)
    if (!statSync(projPath).isDirectory()) continue
    const plans = []
    for (const slug of readdirSync(projPath).sort()) {
      const planPath = join(projPath, slug)
      if (statSync(planPath).isDirectory() && existsSync(join(planPath, 'plan.md'))) {
        plans.push(slug)
      }
    }
    out.push({ projectId, plans })
  }
  return out
}

/**
 * Idempotent "ensure aiDeck is running". If already healthy, returns the URL.
 * If running with a different rootDir, registers this project instead of
 * killing the existing instance. Otherwise spawns `aideck serve` detached
 * and polls until healthy.
 * Returns the dashboard URL or null on failure.
 */
export async function ensureAideck(opts = {}) {
  const { port, timeoutMs = 10000 } = opts

  // 1. Check if already running via env file (either ~/.atomic-skills/env or ~/.aideck/env)
  const existingUrl = readUrlFromAnyEnvFile()
  if (existingUrl) {
    try {
      const res = await fetch(`${existingUrl}/api/health`)
      if (res.ok) {
        const body = await res.json()
        if (body?.service === 'aideck') {
          const cwd = process.cwd()

          // Always register so this project appears in /api/projects,
          // even when the server was originally started from this rootDir.
          const projectId = deriveProjectId(cwd)
          try {
            const regRes = await fetch(`${existingUrl}/api/projects/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rootDir: cwd, projectId })
            })
            if (regRes.ok) {
              return existingUrl
            }
          } catch { /* registration failed */ }

          // Registration endpoint not available (old aideck) and rootDir
          // matches — still usable as-is.
          if (!body.rootDir || body.rootDir === cwd) return existingUrl

          // rootDir mismatch + old aideck without /api/projects — restart
          process.stderr.write(
            `atomic-skills: aiDeck rootDir mismatch (running: ${body.rootDir}, need: ${cwd}). Restarting.\n`
          )
          try {
            await fetch(`${existingUrl}/api/shutdown`, { method: 'POST' })
            const shutdownDeadline = Date.now() + 5000
            while (Date.now() < shutdownDeadline) {
              try {
                const probe = await fetch(`${existingUrl}/api/health`)
                if (!probe.ok) break
              } catch { break }
              await new Promise(r => setTimeout(r, 300))
            }
          } catch { /* already gone */ }
        }
      }
    } catch { /* stale */ }
    // Stale or registration failed — clean up both env files
    try { unlinkSync(ENV_FILE_PATH) } catch { /* swallow */ }
    try { unlinkSync(AIDECK_ENV_FILE_PATH) } catch { /* swallow */ }
  }

  // 2. Start fresh — spawn detached
  const bin = resolveAideckBin()
  const args = ['serve']
  if (port) args.push(`--port=${port}`)
  if (existsSync(join(DEFAULT_BUNDLE_DIR, 'index.html'))) {
    args.push('--static-dir', DEFAULT_BUNDLE_DIR)
  } else {
    const dashboardDir = join(homedir(), '.atomic-skills', 'dashboard')
    if (existsSync(join(dashboardDir, 'index.html'))) {
      args.push('--static-dir', dashboardDir)
    }
  }

  const isPath = bin.includes('/') || bin.includes('\\')
  const cmd = isPath ? process.execPath : bin
  const cmdArgs = isPath ? [bin, ...args] : args

  const child = spawn(cmd, cmdArgs, {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd()
  })
  child.unref()

  // 3. Poll until healthy (check both env file locations)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const url = readUrlFromAnyEnvFile()
    if (url) {
      try {
        const res = await fetch(`${url}/api/health`)
        if (res.ok) {
          // Register this project with the freshly started server
          const cwd = process.cwd()
          const projectId = deriveProjectId(cwd)
          try {
            await fetch(`${url}/api/projects/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rootDir: cwd, projectId })
            })
          } catch { /* best effort */ }
          return url
        }
      } catch { /* not ready yet */ }
    }
    await new Promise(r => setTimeout(r, 500))
  }
  return null
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
 * @param {boolean} [opts.demo]  Stage demo fixtures and serve from that
 *   tmp dir instead of the current working directory.
 */
export async function serve(opts = {}) {
  const bundleDir = await ensureBundle({ forceBuild: opts.forceBuild })
  const port = parsePort(opts.port ?? '7777')
  const url = `http://127.0.0.1:${port}`

  let demoRoot = null
  let spawnCwd = process.cwd()
  if (opts.demo) {
    demoRoot = stageDemoFixtures()
    spawnCwd = demoRoot
    console.error(`atomic-skills serve: demo fixtures staged at ${demoRoot}`)
  }

  const child = spawnAideck({ bundleDir, port, aideckBin: opts.aideckBin, cwd: spawnCwd })

  let envWritten = false
  let spawnFailed = false

  const cleanup = () => {
    if (envWritten) removeEnvFile()
    if (demoRoot) {
      try {
        rmSync(demoRoot, { recursive: true, force: true })
      } catch {
        /* tmp dir cleanup is best-effort */
      }
    }
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
      if (demoRoot) {
        try {
          rmSync(demoRoot, { recursive: true, force: true })
        } catch {
          /* best effort */
        }
      }
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
