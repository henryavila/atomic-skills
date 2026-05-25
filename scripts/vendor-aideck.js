#!/usr/bin/env node
/**
 * Bundles the aideck CLI into a single .mjs file (zero external deps).
 * The installer copies this to ~/.atomic-skills/bin/aideck.mjs.
 *
 * Source resolution:
 *   1. $AIDECK_DIST env override (full path to aideck dist/)
 *   2. ../aideck/dist/ (sibling repo — dev mode)
 *   3. Skip with warning (CI without sibling checkout)
 *
 * Requires: aideck must be compiled (tsc) before this runs.
 * Requires: esbuild (devDependency).
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = resolve(__dirname, '..')
const TARGET = join(PACKAGE_ROOT, 'dist', 'aideck.mjs')

function resolveEntry() {
  if (process.env.AIDECK_DIST) {
    const p = resolve(process.env.AIDECK_DIST)
    if (existsSync(join(p, 'cli-entry.js'))) return join(p, 'cli-entry.js')
    console.error(`vendor-aideck: $AIDECK_DIST=${p} does not contain cli-entry.js`)
    process.exit(1)
  }
  const siblingTs = resolve(PACKAGE_ROOT, '..', 'aideck', 'src', 'cli-entry.ts')
  if (existsSync(siblingTs)) return siblingTs
  const siblingJs = resolve(PACKAGE_ROOT, '..', 'aideck', 'dist', 'cli-entry.js')
  if (existsSync(siblingJs)) return siblingJs
  return null
}

const entry = resolveEntry()
if (!entry) {
  console.error('vendor-aideck: aideck dist/ not found (no sibling repo, no $AIDECK_DIST). Skipping.')
  process.exit(0)
}

mkdirSync(dirname(TARGET), { recursive: true })
if (existsSync(TARGET)) rmSync(TARGET)

const esbuildArgs = [
  entry,
  '--bundle',
  '--platform=node',
  '--format=esm',
  '--target=node20',
  `--outfile=${TARGET}`,
  '--external:fsevents',
  '--banner:js=import{createRequire}from"module";const require=createRequire(import.meta.url);'
]

try {
  execSync(`npx esbuild ${esbuildArgs.map(a => `'${a}'`).join(' ')}`, { stdio: 'inherit', cwd: dirname(entry) })
  console.error(`vendor-aideck: bundled ${entry} → ${TARGET}`)
} catch (cause) {
  console.error(`vendor-aideck: esbuild failed: ${cause.message}`)
  process.exit(1)
}
