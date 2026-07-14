import { describe, it, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
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

// The published @henryavila/aideck can be stale or broken while the new aiDeck
// version isn't published yet. A developer must be able to point `serve` at a
// LOCAL aiDeck build. From a plan worktree the auto-detected sibling (../aideck)
// resolves to the wrong path, so the explicit override commands are the only
// reliable escape hatch. These guard that those commands stay wired.
describe('local aiDeck escape hatch (published build may be unpublished/broken)', () => {
  it('persistent command: `npm run dev:aideck` wires the local-aiDeck orchestrator', () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'))
    const script = pkg.scripts?.['dev:aideck']
    assert.ok(
      typeof script === 'string' && script.includes('dev-aideck.mjs'),
      '`npm run dev:aideck` (link/unlink/status) must invoke scripts/dev-aideck.mjs',
    )
    assert.ok(
      existsSync(join(import.meta.dirname, '..', 'scripts', 'dev-aideck.mjs')),
      'scripts/dev-aideck.mjs must exist',
    )
  })

  it('one-shot command: `serve --aideck-bin <path>` is exposed by the CLI', () => {
    const help = execFileSync(
      process.execPath,
      [join(import.meta.dirname, '..', 'bin', 'cli.js'), '--help'],
      { encoding: 'utf8' },
    )
    assert.ok(
      help.includes('--aideck-bin'),
      'serve must expose --aideck-bin so an operator can point at a local aiDeck build',
    )
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

  it('DEFAULT_BUNDLE_DIR points at the staged aiDeck client (~/.atomic-skills/dashboard)', () => {
    // The dashboard is the aiDeck Vue client staged by the installer, not a
    // bundle atomic-skills builds. serve() passes it via --static-dir only
    // when present; otherwise aideck serves its own bundled client.
    assert.match(serve.__testing.DEFAULT_BUNDLE_DIR, /\.atomic-skills\/dashboard$/)
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

  it('ignores empty project folders when resolving the sole registered project', () => {
    const root = mkdtempSync(join(tmpdir(), 'as-listproj-'))
    try {
      const stateRoot = join(root, '.atomic-skills')
      const planDir = join(stateRoot, 'projects', 'real-project', 'plan-a')
      mkdirSync(planDir, { recursive: true })
      writeFileSync(join(planDir, 'plan.md'), '---\nslug: plan-a\n---\n')
      mkdirSync(join(stateRoot, 'projects', 'empty-sibling'), { recursive: true })

      assert.deepEqual(serve.listProjects(stateRoot), [
        { projectId: 'real-project', plans: ['plan-a'] },
      ])
      assert.equal(serve.resolveRegisteredProjectId(root), 'real-project')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('returns [] when projects/ contains only empty project folders', () => {
    const dir = mkdtempSync(join(tmpdir(), 'as-listproj-'))
    try {
      mkdirSync(join(dir, 'projects', 'empty-project'), { recursive: true })
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

describe('ensureAideck dashboard state freshness', () => {
  it('regenerates the aiDeck project projection before registering a project', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-serve-home-'))
    const repo = mkdtempSync(join(tmpdir(), 'as-serve-repo-'))
    try {
      const planDir = join(repo, '.atomic-skills', 'projects', 'demo', 'plan-a')
      mkdirSync(join(planDir, 'phases'), { recursive: true })
      writeFileSync(
        join(planDir, 'plan.md'),
        '---\nslug: plan-a\ntitle: Plan A\nstatus: active\nstarted: "2026-01-01T00:00:00Z"\nlastUpdated: "2026-01-02T00:00:00Z"\ncurrentPhase: F1\nphases:\n  - id: F1\n    title: Phase 1\n    status: active\n---\n',
      )
      writeFileSync(
        join(planDir, 'phases', 'f1.md'),
        '---\nslug: f1\ntitle: Phase 1\nstatus: active\nphaseId: F1\nparentPlan: plan-a\ntasks:\n  - id: T-1\n    title: First\n    status: pending\n---\n',
      )

      const child = `
        import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
        import { join } from 'node:path';
        const repo = process.env.TEST_REPO;
        mkdirSync(join(process.env.HOME, '.atomic-skills'), { recursive: true });
        writeFileSync(join(process.env.HOME, '.atomic-skills', 'env'), "export AS_DASHBOARD_URL='http://127.0.0.1:7777'\\n");
        globalThis.fetch = async (url, init = {}) => {
          const href = String(url);
          if (href.endsWith('/api/health')) {
            return new Response(JSON.stringify({ service: 'aideck' }), { status: 200, headers: { 'content-type': 'application/json' } });
          }
          if (href.endsWith('/api/projects/register')) {
            const body = JSON.parse(init.body);
            if (body.rootDir !== repo) throw new Error('registered wrong rootDir: ' + body.rootDir);
            return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
          }
          return new Response(JSON.stringify({}), { status: 404, headers: { 'content-type': 'application/json' } });
        };
        const { ensureAideck } = await import('./src/serve.js');
        process.chdir(repo);
        const url = await ensureAideck({ timeoutMs: 500 });
        if (url !== 'http://127.0.0.1:7777') throw new Error('unexpected url: ' + url);
        const plansPath = join(repo, '.atomic-skills', '.aideck', 'state', 'plans.json');
        if (!existsSync(plansPath)) throw new Error('missing emitted plans.json');
        const plans = JSON.parse(readFileSync(plansPath, 'utf8'));
        if (!Array.isArray(plans) || plans[0]?.slug !== 'plan-a') throw new Error('bad emitted plans: ' + JSON.stringify(plans));
      `

      execFileSync(process.execPath, ['--input-type=module', '-e', child], {
        cwd: join(import.meta.dirname, '..'),
        env: { ...process.env, HOME: home, TEST_REPO: realpathSync(repo) },
        encoding: 'utf8',
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
      rmSync(repo, { recursive: true, force: true })
    }
  })

  it('uses the single nested project folder as the registered project id', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-serve-home-'))
    const repo = mkdtempSync(join(tmpdir(), 'as-serve-repo-'))
    try {
      const planDir = join(repo, '.atomic-skills', 'projects', 'demo', 'plan-a')
      mkdirSync(join(planDir, 'phases'), { recursive: true })
      writeFileSync(
        join(planDir, 'plan.md'),
        '---\nslug: plan-a\ntitle: Plan A\nstatus: active\ncurrentPhase: F0\nphases:\n  - id: F0\n    title: Phase 0\n    status: active\n---\n',
      )

      const child = `
        import { mkdirSync, writeFileSync } from 'node:fs';
        import { join } from 'node:path';
        const repo = process.env.TEST_REPO;
        const registeredProjectIds = [];
        mkdirSync(join(process.env.HOME, '.atomic-skills'), { recursive: true });
        writeFileSync(join(process.env.HOME, '.atomic-skills', 'env'), "export AS_DASHBOARD_URL='http://127.0.0.1:7777'\\n");
        globalThis.fetch = async (url, init = {}) => {
          const href = String(url);
          if (href.endsWith('/api/health')) {
            return new Response(JSON.stringify({ service: 'aideck' }), { status: 200, headers: { 'content-type': 'application/json' } });
          }
          if (href.endsWith('/api/projects/register')) {
            const body = JSON.parse(init.body);
            registeredProjectIds.push(body.projectId);
            if (body.rootDir !== repo) throw new Error('registered wrong rootDir: ' + body.rootDir);
            return new Response(JSON.stringify({ schemaVersion: '0.1', project: { projectId: body.projectId, rootDir: repo } }), { status: 201, headers: { 'content-type': 'application/json' } });
          }
          return new Response(JSON.stringify({}), { status: 404, headers: { 'content-type': 'application/json' } });
        };
        const { ensureAideck } = await import('./src/serve.js');
        process.chdir(repo);
        const url = await ensureAideck({ timeoutMs: 500 });
        if (url !== 'http://127.0.0.1:7777') throw new Error('unexpected url: ' + url);
        if (registeredProjectIds.join(',') !== 'demo') throw new Error('registered wrong projectIds: ' + registeredProjectIds.join(','));
      `

      execFileSync(process.execPath, ['--input-type=module', '-e', child], {
        cwd: join(import.meta.dirname, '..'),
        env: { ...process.env, HOME: home, TEST_REPO: realpathSync(repo) },
        encoding: 'utf8',
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
      rmSync(repo, { recursive: true, force: true })
    }
  })

  it('replaces an existing basename registration for the same rootDir', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-serve-home-'))
    const repo = mkdtempSync(join(tmpdir(), 'as-serve-repo-'))
    try {
      const planDir = join(repo, '.atomic-skills', 'projects', 'demo', 'plan-a')
      mkdirSync(join(planDir, 'phases'), { recursive: true })
      writeFileSync(
        join(planDir, 'plan.md'),
        '---\nslug: plan-a\ntitle: Plan A\nstatus: active\ncurrentPhase: F0\nphases:\n  - id: F0\n    title: Phase 0\n    status: active\n---\n',
      )

      const child = `
        import { mkdirSync, writeFileSync } from 'node:fs';
        import { join } from 'node:path';
        const repo = process.env.TEST_REPO;
        let registerCalls = 0;
        let deleteCalls = 0;
        mkdirSync(join(process.env.HOME, '.atomic-skills'), { recursive: true });
        writeFileSync(join(process.env.HOME, '.atomic-skills', 'env'), "export AS_DASHBOARD_URL='http://127.0.0.1:7777'\\n");
        globalThis.fetch = async (url, init = {}) => {
          const href = String(url);
          if (href.endsWith('/api/health')) {
            return new Response(JSON.stringify({ service: 'aideck' }), { status: 200, headers: { 'content-type': 'application/json' } });
          }
          if (href.endsWith('/api/projects/register')) {
            registerCalls++;
            const body = JSON.parse(init.body);
            if (body.projectId !== 'demo') throw new Error('registered wrong projectId: ' + body.projectId);
            const projectId = registerCalls === 1 ? 'plan-dependencies' : 'demo';
            const status = registerCalls === 1 ? 200 : 201;
            return new Response(JSON.stringify({ schemaVersion: '0.1', project: { projectId, rootDir: repo } }), { status, headers: { 'content-type': 'application/json' } });
          }
          if (href.endsWith('/api/projects/plan-dependencies') && init.method === 'DELETE') {
            deleteCalls++;
            return new Response(JSON.stringify({ schemaVersion: '0.1', status: 'unregistered' }), { status: 200, headers: { 'content-type': 'application/json' } });
          }
          return new Response(JSON.stringify({}), { status: 404, headers: { 'content-type': 'application/json' } });
        };
        const { ensureAideck } = await import('./src/serve.js');
        process.chdir(repo);
        const url = await ensureAideck({ timeoutMs: 500 });
        if (url !== 'http://127.0.0.1:7777') throw new Error('unexpected url: ' + url);
        if (registerCalls !== 2) throw new Error('expected two register calls, saw ' + registerCalls);
        if (deleteCalls !== 1) throw new Error('expected one delete call, saw ' + deleteCalls);
      `

      execFileSync(process.execPath, ['--input-type=module', '-e', child], {
        cwd: join(import.meta.dirname, '..'),
        env: { ...process.env, HOME: home, TEST_REPO: realpathSync(repo) },
        encoding: 'utf8',
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
      rmSync(repo, { recursive: true, force: true })
    }
  })
})
