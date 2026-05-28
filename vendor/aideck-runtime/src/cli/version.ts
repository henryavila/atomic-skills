import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

let cached: string | null = null

export function readVersion(): string {
  if (cached) return cached
  // dist layout: dist/cli/version.js -> dist/../package.json. src layout: src/cli/version.ts -> src/../package.json.
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(here, '..', '..', 'package.json'),
    join(here, '..', 'package.json'),
    join(process.cwd(), 'package.json')
  ]
  for (const candidate of candidates) {
    try {
      const raw = readFileSync(candidate, 'utf8')
      const pkg = JSON.parse(raw) as { name?: string; version?: string }
      if (pkg.version && (pkg.name === '@henryavila/aideck' || pkg.name === 'aideck' || pkg.name === undefined)) {
        cached = pkg.version
        return pkg.version
      }
    } catch {
      continue
    }
  }
  cached = '0.0.0'
  return cached
}
