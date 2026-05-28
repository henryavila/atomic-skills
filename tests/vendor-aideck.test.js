import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { patchBundledEntrypointGuards, resolveAideckEntry } from '../scripts/lib/vendor-aideck-core.js'

describe('resolveAideckEntry', () => {
  it('uses the vendored aideck runtime snapshot by default', () => {
    const root = mkdtempSync(join(tmpdir(), 'as-vendor-aideck-'))
    const packageRoot = join(root, 'atomic-skills')
    const aideckSrc = join(packageRoot, 'vendor', 'aideck-runtime', 'src')
    mkdirSync(packageRoot, { recursive: true })
    mkdirSync(aideckSrc, { recursive: true })
    const entry = join(aideckSrc, 'cli.ts')
    writeFileSync(entry, 'export {}\n')

    try {
      assert.equal(resolveAideckEntry({ packageRoot }), entry)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not implicitly depend on a sibling ../aideck checkout', () => {
    const root = mkdtempSync(join(tmpdir(), 'as-vendor-aideck-sibling-'))
    const packageRoot = join(root, 'atomic-skills')
    const siblingSrc = join(root, 'aideck', 'src')
    mkdirSync(packageRoot, { recursive: true })
    mkdirSync(siblingSrc, { recursive: true })
    writeFileSync(join(siblingSrc, 'cli.ts'), 'export {}\n')

    try {
      assert.equal(resolveAideckEntry({ packageRoot }), null)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('uses $AIDECK_SOURCE as an explicit external source override', () => {
    const root = mkdtempSync(join(tmpdir(), 'as-vendor-aideck-source-'))
    const packageRoot = join(root, 'atomic-skills')
    const externalSrc = join(root, 'external-aideck', 'src')
    mkdirSync(packageRoot, { recursive: true })
    mkdirSync(externalSrc, { recursive: true })
    const entry = join(externalSrc, 'cli.ts')
    writeFileSync(entry, 'export {}\n')

    try {
      assert.equal(
        resolveAideckEntry({
          packageRoot,
          env: { AIDECK_SOURCE: join(root, 'external-aideck') },
        }),
        entry
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('uses $AIDECK_DIST/dist cli.js when provided', () => {
    const root = mkdtempSync(join(tmpdir(), 'as-vendor-aideck-dist-'))
    const dist = join(root, 'dist')
    mkdirSync(dist, { recursive: true })
    const entry = join(dist, 'cli.js')
    writeFileSync(entry, 'export {}\n')

    try {
      assert.equal(resolveAideckEntry({ packageRoot: join(root, 'atomic-skills'), env: { AIDECK_DIST: dist } }), entry)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('patchBundledEntrypointGuards', () => {
  it('disables internal module entry guards but preserves the CLI guard', () => {
    const input = `
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  startServer()
}
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  startStdio()
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli()
}
`

    const output = patchBundledEntrypointGuards(input)

    assert.equal((output.match(/if \(false\) \{/g) ?? []).length, 2)
    assert.match(output, /pathToFileURL\(process\.argv\[1\]\)\.href/)
    assert.equal(output.includes('import.meta.url === `file://${process.argv[1]}`'), false)
  })
})
