import { describe, it, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const serve = await import('../src/serve.js')

describe('parsePort', () => {
  it('returns the port as a string for valid integers in range', () => {
    assert.equal(serve.parsePort('7777'), '7777')
    assert.equal(serve.parsePort(7777), '7777')
    assert.equal(serve.parsePort('1'), '1')
    assert.equal(serve.parsePort('65535'), '65535')
  })

  it('rejects non-integers', () => {
    assert.throws(() => serve.parsePort('abc'), /Invalid port/)
    assert.throws(() => serve.parsePort('7777.5'), /Invalid port/)
    assert.throws(() => serve.parsePort(''), /Invalid port/)
  })

  it('rejects out-of-range integers', () => {
    assert.throws(() => serve.parsePort('0'), /Invalid port/)
    assert.throws(() => serve.parsePort('65536'), /Invalid port/)
    assert.throws(() => serve.parsePort('-1'), /Invalid port/)
  })

  it('is also exposed on __testing for convenience', () => {
    assert.equal(serve.__testing.parsePort, serve.parsePort)
  })
})

describe('resolveAideckBin', () => {
  const originalEnv = process.env.AIDECK_BIN

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.AIDECK_BIN
    else process.env.AIDECK_BIN = originalEnv
  })

  it('honors AIDECK_BIN env override', () => {
    process.env.AIDECK_BIN = '/custom/path/to/aideck'
    assert.equal(serve.resolveAideckBin(), '/custom/path/to/aideck')
  })

  it('returns a string fallback when no override is set', () => {
    delete process.env.AIDECK_BIN
    const result = serve.resolveAideckBin()
    assert.ok(typeof result === 'string' && result.length > 0)
  })
})

describe('__testing surface (Codex F-004)', () => {
  it('exposes ONLY pure helpers + path constants', () => {
    // The set must not include FS-mutating helpers (writeEnvFile,
    // removeEnvFile) — Codex F-004 noted that src/ ships in the npm
    // package and exposing those let consumers mutate the user's $HOME
    // via the production module.
    const expected = new Set(['parsePort', 'resolveAideckBin', 'ENV_FILE_PATH', 'DEFAULT_BUNDLE_DIR'])
    const actual = new Set(Object.keys(serve.__testing))
    assert.deepEqual(actual, expected, `__testing keys drifted: ${[...actual].join(',')}`)
  })

  it('is frozen so additions to the testing surface require a code change', () => {
    assert.ok(Object.isFrozen(serve.__testing))
  })
})

describe('serve constants', () => {
  it('ENV_FILE_PATH points at $HOME/.atomic-skills/env', () => {
    assert.match(serve.__testing.ENV_FILE_PATH, /\.atomic-skills\/env$/)
  })

  it('DEFAULT_BUNDLE_DIR resolves to <pkg>/dist/dashboard', () => {
    assert.match(serve.__testing.DEFAULT_BUNDLE_DIR, /atomic-skills\/dist\/dashboard$/)
  })

  it('the dashboard bundle has been built (E.T-005 prerequisite)', () => {
    assert.ok(
      existsSync(join(serve.__testing.DEFAULT_BUNDLE_DIR, 'index.html')),
      'dist/dashboard/index.html missing — run `npm run build:dashboard`'
    )
  })
})
