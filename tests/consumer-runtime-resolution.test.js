import { afterEach, beforeEach, describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

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
})
