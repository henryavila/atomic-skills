import { describe, it, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

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

describe('derive projectId', () => {
  it('lowercases and sanitizes basename', () => {
    assert.equal(serve.deriveProjectId('/home/user/MyProject'), 'myproject')
  })

  it('replaces non-alphanumeric chars with hyphens', () => {
    assert.equal(serve.deriveProjectId('/home/user/my_project.v2'), 'my-project-v2')
  })

  it('strips leading digits and hyphens', () => {
    assert.equal(serve.deriveProjectId('/home/user/123-project'), 'project')
  })

  it('returns "project" for fully invalid basenames', () => {
    assert.equal(serve.deriveProjectId('/home/user/123'), 'project')
  })

  it('validates as a slug (matches projectId regex)', () => {
    const id = serve.deriveProjectId('/home/user/Atomic-Skills')
    assert.match(id, /^[a-z][a-z0-9-]{0,63}$/)
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

describe('listProjects (Inc2: R-MIG-13 / R-ORCH-26 — folder name = projectId)', () => {
  it('returns [] when projects/ is absent (pure flat tree)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'as-listproj-'))
    try {
      mkdirSync(join(dir, 'plans'), { recursive: true })
      assert.deepEqual(serve.listProjects(dir), [])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('enumerates projects/<id>/ folders, each with its plan slugs, sorted', () => {
    const dir = mkdtempSync(join(tmpdir(), 'as-listproj-'))
    try {
      // two projects; project "beta" has two plans, "alpha" has one
      for (const [proj, slugs] of [['beta', ['migration', 'cleanup']], ['alpha', ['ui-v1']]]) {
        for (const slug of slugs) {
          const p = join(dir, 'projects', proj, slug)
          mkdirSync(p, { recursive: true })
          writeFileSync(join(p, 'plan.md'), '---\nslug: x\n---\n')
        }
      }
      const out = serve.listProjects(dir)
      assert.deepEqual(out.map((p) => p.projectId), ['alpha', 'beta'], 'projectIds sorted')
      assert.deepEqual(out.find((p) => p.projectId === 'beta').plans, ['cleanup', 'migration'], 'plans sorted')
      assert.deepEqual(out.find((p) => p.projectId === 'alpha').plans, ['ui-v1'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('lists a project even if a subfolder lacks plan.md (plans only counts <slug>/plan.md)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'as-listproj-'))
    try {
      const withPlan = join(dir, 'projects', 'p', 'real')
      mkdirSync(withPlan, { recursive: true })
      writeFileSync(join(withPlan, 'plan.md'), '---\nslug: x\n---\n')
      // a stray subfolder with no plan.md must not count as a plan
      mkdirSync(join(dir, 'projects', 'p', 'stray'), { recursive: true })
      const out = serve.listProjects(dir)
      assert.equal(out.length, 1)
      assert.deepEqual(out[0].plans, ['real'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
