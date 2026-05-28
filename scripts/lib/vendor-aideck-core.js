import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Resolves the aiDeck CLI entrypoint to bundle into dist/aideck.mjs.
 *
 * Supports the vendored aiDeck runtime snapshot by default. External source
 * checkouts are opt-in via AIDECK_SOURCE/AIDECK_DIST so this repo can rebuild
 * without a sibling ../aideck path.
 *
 * @param {object} opts
 * @param {string} opts.packageRoot
 * @param {NodeJS.ProcessEnv|Record<string,string|undefined>} [opts.env]
 * @param {(path: string) => boolean} [opts.exists]
 * @returns {string|null}
 */
export function resolveAideckEntry({ packageRoot, env = process.env, exists = existsSync }) {
  if (env.AIDECK_SOURCE) {
    const p = resolve(env.AIDECK_SOURCE)
    for (const candidate of entryCandidates(p)) {
      if (exists(candidate)) return candidate
    }
    if (exists(p)) return p
    throw new Error(`$AIDECK_SOURCE=${p} does not contain src/cli.ts, src/cli-entry.ts, dist/cli.js, or dist/cli-entry.js`)
  }

  if (env.AIDECK_DIST) {
    const p = resolve(env.AIDECK_DIST)
    for (const name of ['cli.js', 'cli-entry.js']) {
      const candidate = join(p, name)
      if (exists(candidate)) return candidate
    }
    throw new Error(`$AIDECK_DIST=${p} does not contain cli.js or cli-entry.js`)
  }

  const vendoredRoot = resolve(packageRoot, 'vendor', 'aideck-runtime')
  for (const candidate of entryCandidates(vendoredRoot)) {
    if (exists(candidate)) return candidate
  }

  return null
}

function entryCandidates(root) {
  return [
    resolve(root, 'src', 'cli.ts'),
    resolve(root, 'src', 'cli-entry.ts'),
    resolve(root, 'dist', 'cli.js'),
    resolve(root, 'dist', 'cli-entry.js'),
  ]
}

/**
 * esbuild inlines every module into one file, so module-level entrypoint guards
 * that compare `import.meta.url` to `process.argv[1]` become true for internal
 * modules too. Disable the simple direct-file guards used by aiDeck internals;
 * keep the CLI guard that uses pathToFileURL(process.argv[1]).
 *
 * @param {string} code
 * @returns {string}
 */
export function patchBundledEntrypointGuards(code) {
  return code.replaceAll('if (import.meta.url === `file://${process.argv[1]}`) {', 'if (false) {')
}
