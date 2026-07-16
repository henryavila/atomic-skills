import { afterEach, beforeEach, describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { resolvePackagePath } from '../src/runtime-paths.js'

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function runNode(entrypoint, args, { cwd, home }) {
  return spawnSync(process.execPath, [entrypoint, ...args], {
    cwd,
    env: { ...process.env, HOME: home },
    encoding: 'utf8',
  })
}

describe('consumer resolves package entrypoints from the installed runtime root', () => {
  let root
  let home
  let consumer

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'atomic-skills-consumer-runtime-'))
    home = join(root, 'home')
    consumer = join(root, 'consumer')
    mkdirSync(join(home, '.atomic-skills'), { recursive: true })
    mkdirSync(consumer, { recursive: true })
    writeFileSync(join(home, '.atomic-skills', 'package-root'), `${PACKAGE_ROOT}\n`)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function installedEntry(...parts) {
    const installedRoot = readFileSync(join(home, '.atomic-skills', 'package-root'), 'utf8').trim()
    return join(installedRoot, ...parts)
  }

  it('runs the decompose preview from a consumer with no atomic-skills checkout', () => {
    const source = join(consumer, 'source.md')
    writeFileSync(source, [
      '# Consumer Plan',
      '',
      '## F0 — Bootstrap',
      '',
      'Goal: prove package-root resolution.',
      '',
      '### T-001 Add entrypoint',
      '',
    ].join('\n'))

    const result = runNode(
      installedEntry('scripts', 'decompose-plan.js'),
      ['preview', '--source', source, '--slug', 'consumer-plan'],
      { cwd: consumer, home }
    )

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Consumer Plan/)
    assert.match(result.stdout, /"phaseId":\s*"F0"/)

    const businessIntent = JSON.stringify({
      value: 'Resolve package-owned code from the installed runtime.',
      workflow: 'Preview, materialize, then validate the emitted pair.',
      rules: 'Never import package code from the consumer cwd.',
      outOfScope: 'Writing the returned files in this pure transform test.',
      doneWhen: 'Plan and F0 paths are returned from the installed entrypoint.',
    })
    const materialized = runNode(
      installedEntry('scripts', 'decompose-plan.js'),
      [
        'materialize',
        '--source', source,
        '--slug', 'consumer-plan',
        '--project-id', 'consumer',
        '--branch', 'plan/consumer-plan',
        '--business-intent', businessIntent,
      ],
      { cwd: consumer, home }
    )
    assert.equal(materialized.status, 0, materialized.stderr)
    const files = JSON.parse(materialized.stdout)
    assert.deepEqual(files.map((file) => file.relativePath), [
      '.atomic-skills/projects/consumer/consumer-plan/plan.md',
      '.atomic-skills/projects/consumer/consumer-plan/phases/f0-bootstrap.md',
    ])
  })

  it('clusters normal and empty signal partitions through the bootstrap entrypoint', () => {
    const signals = join(consumer, 'signals.json')
    writeFileSync(signals, JSON.stringify([
      {
        slug: 'runtime-root',
        source_type: 'git-branch',
        last_activity: '2026-07-11T00:00:00Z',
      },
    ]))

    const populated = runNode(
      installedEntry('scripts', 'bootstrap-project.js'),
      ['cluster', '--signals', signals],
      { cwd: consumer, home }
    )
    assert.equal(populated.status, 0, populated.stderr)
    const clustered = JSON.parse(populated.stdout)
    assert.equal(clustered.clusters.length, 1)
    assert.equal(clustered.clusters[0].canonical.slug, 'runtime-root')
    assert.deepEqual(clustered.remainingOrphans, [])

    writeFileSync(signals, '[]\n')
    const empty = runNode(
      installedEntry('scripts', 'bootstrap-project.js'),
      ['cluster', '--signals', signals],
      { cwd: consumer, home }
    )
    assert.equal(empty.status, 0, empty.stderr)
    assert.deepEqual(JSON.parse(empty.stdout), { clusters: [], remainingOrphans: [] })
  })

  it('adds a dependency idempotently through the plan-dependencies entrypoint', () => {
    const planDir = join(consumer, '.atomic-skills', 'projects', 'consumer', 'dependent')
    mkdirSync(planDir, { recursive: true })
    writeFileSync(join(planDir, 'plan.md'), [
      '---',
      'schemaVersion: "0.1"',
      'slug: dependent',
      'status: active',
      'phases:',
      '  - id: F0',
      '    status: active',
      '---',
      '',
      '# Body remains',
      '',
    ].join('\n'))

    const entrypoint = installedEntry('scripts', 'plan-dependencies.js')
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = runNode(entrypoint, ['add', planDir, 'prerequisite'], { cwd: consumer, home })
      assert.equal(result.status, 0, result.stderr)
    }

    const raw = readFileSync(join(planDir, 'plan.md'), 'utf8')
    const frontmatter = parseYaml(raw.split('---\n')[1])
    assert.deepEqual(frontmatter.dependsOnPlans, [{
      plan: 'prerequisite',
      createdBy: 'manual',
      release: { archived: 'blocked' },
    }])
    assert.match(raw, /# Body remains/)
  })

  it('runs the installed normalizer without loading a consumer src/normalize.js sentinel', () => {
    mkdirSync(join(consumer, 'src'), { recursive: true })
    writeFileSync(
      join(consumer, 'src', 'normalize.js'),
      "throw new Error('CONSUMER_NORMALIZE_SENTINEL_LOADED')\n"
    )
    const stateDir = join(consumer, '.atomic-skills')
    const initiatives = join(stateDir, 'initiatives')
    mkdirSync(initiatives, { recursive: true })
    const initiative = join(initiatives, 'broken.md')
    writeFileSync(initiative, [
      '---',
      'slug: broken',
      'status: active',
      'exitGates: []',
      'tasks: []',
      '---',
      '',
      '# Consumer state',
      '',
    ].join('\n'))

    const result = runNode(
      installedEntry('src', 'normalize.js'),
      [stateDir],
      { cwd: consumer, home }
    )

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /CONSUMER_NORMALIZE_SENTINEL_LOADED/)
    assert.match(readFileSync(initiative, 'utf8'), /stack: \[\]/)
  })

  it('documents only the installed normalizer path in create-plan and verify flows', () => {
    const createPlan = readFileSync(
      join(PACKAGE_ROOT, 'skills', 'shared', 'project-assets', 'project-create-plan.md'),
      'utf8'
    )
    const verify = readFileSync(
      join(PACKAGE_ROOT, 'skills', 'shared', 'project-assets', 'project-verify.md'),
      'utf8'
    )

    assert.doesNotMatch(createPlan, /\$PWD\/src\/normalize\.js/)
    assert.match(createPlan, /\$PKG_ROOT\/src\/normalize\.js/)
    assert.doesNotMatch(verify, /same 3-path way/)
    assert.match(verify, /\$ROOT\/src\/normalize\.js/)
  })

  it('rejects missing arguments and invalid signal JSON with actionable errors', () => {
    const missing = runNode(
      installedEntry('scripts', 'decompose-plan.js'),
      ['preview'],
      { cwd: consumer, home }
    )
    assert.notEqual(missing.status, 0)
    assert.match(missing.stderr, /decompose-plan:.*--source/i)

    const signals = join(consumer, 'signals.json')
    writeFileSync(signals, '{not-json}\n')
    const invalid = runNode(
      installedEntry('scripts', 'bootstrap-project.js'),
      ['cluster', '--signals', signals],
      { cwd: consumer, home }
    )
    assert.notEqual(invalid.status, 0)
    assert.match(invalid.stderr, /bootstrap-project:.*valid JSON/i)
  })

  it('F-002: materialize-state resolves via package-root and runs from consumer cwd', async () => {
    // Path is package-owned (not cwd-relative). Residual: full tarball e2e is F6 if needed.
    const materializeAbs = resolvePackagePath('scripts', 'materialize-state.js')
    assert.equal(existsSync(materializeAbs), true)
    assert.equal(materializeAbs, join(PACKAGE_ROOT, 'scripts', 'materialize-state.js'))
    assert.equal(materializeAbs, installedEntry('scripts', 'materialize-state.js'))

    const { validateStagedPair, materializePair } = await import(
      pathToFileURL(materializeAbs).href
    )

    const planContent = [
      '---',
      'schemaVersion: "0.1"',
      'slug: consumer-mat',
      'title: Consumer materialize',
      'status: active',
      'currentPhase: F0',
      'phases:',
      '  - id: F0',
      '    slug: f0-bootstrap',
      '    title: Bootstrap',
      '    status: active',
      '    subPhaseCount: 0',
      '---',
      '',
      '# Plan',
      '',
    ].join('\n')
    const initiativeContent = [
      '---',
      'schemaVersion: "0.1"',
      'slug: f0-bootstrap',
      'title: Bootstrap',
      'status: active',
      'phaseId: F0',
      'parentPlan: consumer-mat',
      'tasks: []',
      'exitGates: []',
      '---',
      '',
      '# Initiative',
      '',
    ].join('\n')

    const validated = validateStagedPair(planContent, initiativeContent)
    assert.equal(validated.initFm.phaseId, 'F0')
    const unboundInitiative = [
      '---',
      'schemaVersion: "0.1"',
      'slug: only-slug',
      'title: Bootstrap',
      'status: active',
      'parentPlan: consumer-mat',
      'tasks: []',
      'exitGates: []',
      '---',
      '',
      '# Initiative without phaseId',
      '',
    ].join('\n')
    assert.throws(
      () => validateStagedPair(planContent, unboundInitiative),
      /missing phaseId/i,
    )

    const planDir = join(consumer, '.atomic-skills', 'projects', 'consumer', 'consumer-mat')
    const phasesDir = join(planDir, 'phases')
    mkdirSync(phasesDir, { recursive: true })
    const planPath = join(planDir, 'plan.md')
    const initiativePath = join(phasesDir, 'f0-bootstrap.md')
    const planBefore = planContent.replace('status: active', 'status: pending')
      .replace('currentPhase: F0', 'currentPhase: null')
      .replace('status: active\n    subPhaseCount: 0', 'status: pending\n    subPhaseCount: 0')
    writeFileSync(planPath, planBefore, 'utf8')

    // Import was package-root absolute; exercise publish under consumer cwd (no monorepo checkout).
    const prevCwd = process.cwd()
    try {
      process.chdir(consumer)
      const result = materializePair({
        planPath,
        initiativePath,
        planContent,
        initiativeContent,
      })
      assert.equal(result.ok, true)
      assert.equal(readFileSync(planPath, 'utf8'), planContent)
      assert.equal(readFileSync(initiativePath, 'utf8'), initiativeContent)
      assert.equal(existsSync(`${planPath}.materialize-tx.json`), false)
    } finally {
      process.chdir(prevCwd)
    }

    // CLI entrypoint also works with cwd = consumer and HOME package-root.
    const planFile = join(consumer, 'staged-plan.md')
    const initFile = join(consumer, 'staged-init.md')
    const plan2Dir = join(consumer, '.atomic-skills', 'projects', 'consumer', 'cli-mat')
    mkdirSync(join(plan2Dir, 'phases'), { recursive: true })
    const plan2 = join(plan2Dir, 'plan.md')
    const init2 = join(plan2Dir, 'phases', 'f0-bootstrap.md')
    writeFileSync(plan2, planBefore, 'utf8')
    writeFileSync(planFile, planContent, 'utf8')
    writeFileSync(initFile, initiativeContent, 'utf8')

    const cli = runNode(
      installedEntry('scripts', 'materialize-state.js'),
      [
        '--plan', plan2,
        '--initiative', init2,
        '--plan-file', planFile,
        '--initiative-file', initFile,
      ],
      { cwd: consumer, home },
    )
    assert.equal(cli.status, 0, cli.stderr)
    assert.match(cli.stdout, /"ok"\s*:\s*true/)
    assert.equal(readFileSync(plan2, 'utf8'), planContent)
    assert.equal(readFileSync(init2, 'utf8'), initiativeContent)
  })
})
