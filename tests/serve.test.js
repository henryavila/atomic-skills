import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'

// Direct-import the testing surface — these are pure helpers, no spawn.
const { __testing } = await import('../src/serve.js')

describe('serve.parsePort', () => {
  it('returns the port as a string for valid integers in range', () => {
    assert.equal(__testing.parsePort('7777'), '7777')
    assert.equal(__testing.parsePort(7777), '7777')
    assert.equal(__testing.parsePort('1'), '1')
    assert.equal(__testing.parsePort('65535'), '65535')
  })

  it('rejects non-integers', () => {
    assert.throws(() => __testing.parsePort('abc'), /Invalid port/)
    assert.throws(() => __testing.parsePort('7777.5'), /Invalid port/)
    assert.throws(() => __testing.parsePort(''), /Invalid port/)
  })

  it('rejects out-of-range integers', () => {
    assert.throws(() => __testing.parsePort('0'), /Invalid port/)
    assert.throws(() => __testing.parsePort('65536'), /Invalid port/)
    assert.throws(() => __testing.parsePort('-1'), /Invalid port/)
  })
})

describe('serve.resolveAideckBin', () => {
  const originalEnv = process.env.AIDECK_BIN

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.AIDECK_BIN
    else process.env.AIDECK_BIN = originalEnv
  })

  it('honors AIDECK_BIN env override', () => {
    process.env.AIDECK_BIN = '/custom/path/to/aideck'
    assert.equal(__testing.resolveAideckBin(), '/custom/path/to/aideck')
  })

  it('falls back to "aideck" on PATH when no override and no sibling repo', () => {
    delete process.env.AIDECK_BIN
    // We can't actually remove the sibling repo, but we can assert that the
    // function returns *something* and that the env override takes precedence.
    // The actual fallback chain is covered in the serve integration smoke
    // test (E.T-009).
    const result = __testing.resolveAideckBin()
    assert.ok(typeof result === 'string' && result.length > 0)
  })
})

describe('serve.writeEnvFile / removeEnvFile', () => {
  let fakeHome
  let originalHome

  beforeEach(() => {
    fakeHome = mkdtempSync(join(tmpdir(), 'atomic-skills-serve-test-'))
    originalHome = process.env.HOME
    process.env.HOME = fakeHome
  })

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME
    else process.env.HOME = originalHome
    rmSync(fakeHome, { recursive: true, force: true })
  })

  it('writes ~/.atomic-skills/env with a shell-quoted URL and 0o600 mode', () => {
    // serve.js captures homedir() at import time. We re-import via a child
    // by calling helpers that compute the path on each call — but since
    // ENV_FILE_PATH is constant-after-import, we instead test that the
    // helper writes to that path with proper format. We simulate by
    // calling writeEnvFile and checking the exposed ENV_FILE_PATH which
    // was bound to the real $HOME at module-load — so we read from there.
    //
    // This test is therefore destructive against the user's real
    // ~/.atomic-skills/env; we back it up and restore.
    const path = __testing.ENV_FILE_PATH
    const backup = existsSync(path) ? readFileSync(path) : null
    try {
      __testing.writeEnvFile('http://127.0.0.1:7777')
      assert.ok(existsSync(path), `env file not created at ${path}`)
      const body = readFileSync(path, 'utf8')
      assert.match(body, /^export AS_DASHBOARD_URL='http:\/\/127\.0\.0\.1:7777'$/m)
      // Check mode (0o600) — only owner read/write.
      const mode = statSync(path).mode & 0o777
      assert.equal(mode, 0o600, `expected 0600, got 0${mode.toString(8)}`)
    } finally {
      __testing.removeEnvFile()
      if (backup !== null) writeFileSync(path, backup)
    }
  })

  it('escapes single quotes in the URL', () => {
    const path = __testing.ENV_FILE_PATH
    const backup = existsSync(path) ? readFileSync(path) : null
    try {
      __testing.writeEnvFile("http://127.0.0.1:7777/quote'in/path")
      const body = readFileSync(path, 'utf8')
      // POSIX shell single-quote escape: close → escaped quote → reopen.
      assert.match(body, /quote'\\''in\/path/)
    } finally {
      __testing.removeEnvFile()
      if (backup !== null) writeFileSync(path, backup)
    }
  })

  it('removeEnvFile is idempotent (no error when file absent)', () => {
    const path = __testing.ENV_FILE_PATH
    const backup = existsSync(path) ? readFileSync(path) : null
    try {
      __testing.removeEnvFile() // ensure absent
      assert.doesNotThrow(() => __testing.removeEnvFile())
    } finally {
      if (backup !== null) writeFileSync(path, backup)
    }
  })
})

describe('serve.DEFAULT_BUNDLE_DIR', () => {
  it('resolves to <pkg>/dist/dashboard', () => {
    assert.match(__testing.DEFAULT_BUNDLE_DIR, /atomic-skills\/dist\/dashboard$/)
  })

  it('has been built (E.T-005 prerequisite)', () => {
    assert.ok(
      existsSync(join(__testing.DEFAULT_BUNDLE_DIR, 'index.html')),
      'dist/dashboard/index.html missing — run `npm run build:dashboard`'
    )
  })
})
