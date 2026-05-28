#!/usr/bin/env node
/**
 * Bundles the aideck CLI into a single .mjs file (zero external deps).
 * The installer copies this to ~/.atomic-skills/bin/aideck.mjs.
 *
 * Source resolution:
 *   1. $AIDECK_SOURCE env override (external aideck source checkout or entry)
 *   2. $AIDECK_DIST env override (external built aideck dist/)
 *   3. vendor/aideck-runtime/ (temporary snapshot shipped in this repo)
 *   4. Skip with warning (snapshot missing)
 *
 * Requires: aideck snapshot dependencies + esbuild from this repo's devDeps.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { patchBundledEntrypointGuards, resolveAideckEntry } from './lib/vendor-aideck-core.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = resolve(__dirname, '..')
const TARGET = join(PACKAGE_ROOT, 'dist', 'aideck.mjs')

function resolveEntry() {
  try {
    return resolveAideckEntry({ packageRoot: PACKAGE_ROOT })
  } catch (cause) {
    console.error(`vendor-aideck: ${cause instanceof Error ? cause.message : String(cause)}`)
    process.exit(1)
  }
}

const entry = resolveEntry()
if (!entry) {
  console.error('vendor-aideck: vendored aideck runtime not found (set $AIDECK_SOURCE or $AIDECK_DIST to override). Skipping.')
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
  writeFileSync(TARGET, patchBundledEntrypointGuards(readFileSync(TARGET, 'utf8')))
  console.error(`vendor-aideck: bundled ${entry} → ${TARGET}`)
} catch (cause) {
  console.error(`vendor-aideck: esbuild failed: ${cause.message}`)
  process.exit(1)
}
