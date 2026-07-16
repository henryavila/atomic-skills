import { after, before, describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE_ROOT = join(SOURCE_ROOT, 'tests', 'fixtures', 'consumer-runtime')
const SENTINEL = 'CONSUMER_NORMALIZE_SENTINEL_LOADED'
const TOOL_TEMPLATE = /{{(?:ARG_VAR|ASSETS_PATH|BASH_TOOL|READ_TOOL|WRITE_TOOL|REPLACE_TOOL|GREP_TOOL|GLOB_TOOL|INVESTIGATOR_TOOL|ASK_USER_QUESTION_TOOL)}}/

function isInside(child, parent) {
  const rel = relative(parent, child)
  return rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel)
}

function listFiles(root) {
  if (!existsSync(root)) return []
  const files = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

describe('packed consumer runtime works without the source checkout', { concurrency: false }, () => {
  let root
  let home
  let consumer
  let packageRoot
  let markerPath
  let dependentFiles
  const transcript = []
  const installedText = new Map()

  function run(command, args, { cwd = consumer, env = {} } = {}) {
    const result = spawnSync(command, args, {
      cwd,
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        npm_config_audit: 'false',
        npm_config_fund: 'false',
        npm_config_update_notifier: 'false',
        npm_config_cache: process.env.npm_config_cache || join(homedir(), '.npm'),
        ...env,
      },
      encoding: 'utf8',
    })
    transcript.push(`${result.stdout ?? ''}\n${result.stderr ?? ''}`)
    return result
  }

  function mustRun(command, args, options) {
    const result = run(command, args, options)
    assert.equal(
      result.status,
      0,
      `${command} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    )
    return result
  }

  function runInstalled(relativePath, ...args) {
    return mustRun(process.execPath, [join(packageRoot, relativePath), ...args])
  }

  function persistMaterialized(files) {
    for (const file of files) {
      const destination = resolve(consumer, file.relativePath)
      assert.ok(isInside(destination, consumer), `materialized path escaped consumer: ${file.relativePath}`)
      mkdirSync(dirname(destination), { recursive: true })
      writeFileSync(destination, file.content)
    }
  }

  before(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'atomic-skills-consumer-install-')))
    home = join(root, 'home')
    consumer = join(root, 'consumer')
    const packs = join(root, 'packs')
    mkdirSync(home, { recursive: true })
    mkdirSync(packs, { recursive: true })
    cpSync(FIXTURE_ROOT, consumer, { recursive: true })

    mustRun('git', ['init', '-q'])
    const packed = mustRun(
      'npm',
      ['pack', '--json', '--ignore-scripts', '--pack-destination', packs],
      { cwd: SOURCE_ROOT },
    )
    const [manifest] = JSON.parse(packed.stdout)
    const tarball = join(packs, manifest.filename)
    assert.ok(existsSync(tarball), `npm pack did not create ${tarball}`)

    mustRun('npm', [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      '--no-save',
      tarball,
    ])

    packageRoot = join(consumer, 'node_modules', '@henryavila', 'atomic-skills')
    mustRun(process.execPath, [
      join(packageRoot, 'bin', 'cli.js'),
      'install',
      '--yes',
      '--project',
      '--ide',
      'codex',
      '--lang',
      'en',
    ])
    markerPath = join(home, '.atomic-skills', 'package-root')
  })

  after(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it('installs the tgz and records its extracted runtime root', () => {
    assert.ok(existsSync(markerPath), 'installed CLI did not write the package-root marker')
    assert.ok(existsSync(join(packageRoot, 'scripts', 'decompose-plan.js')))
    assert.ok(existsSync(join(packageRoot, 'meta', 'schemas', 'plan.schema.json')))
    assert.equal(lstatSync(packageRoot).isSymbolicLink(), false, 'npm install must extract, not link, the package')

    const recordedRoot = realpathSync(readFileSync(markerPath, 'utf8').trim())
    const extractedRoot = realpathSync(packageRoot)
    const checkoutRoot = realpathSync(SOURCE_ROOT)
    assert.equal(recordedRoot, extractedRoot)
    assert.ok(isInside(recordedRoot, realpathSync(join(consumer, 'node_modules'))))
    assert.notEqual(recordedRoot, checkoutRoot, 'package-root leaked back to the source checkout')
  })

  it('executes decompose, discover, depend, normalize, and verify from the installed root', () => {
    const source = join(consumer, 'source.md')
    writeFileSync(source, [
      '# Consumer Runtime Plan',
      '',
      'Proves an installed tarball can operate without its source checkout.',
      '',
      '## F0 — Runtime Proof',
      '',
      'Goal: execute the package-owned runtime from a consumer.',
      '',
      '### T-001 Exercise installed commands',
      '',
      '```yaml',
      'exit_gate:',
      '  - id: F0-G1',
      '    description: Runtime remains package-relative',
      '    verifier: { kind: manual, description: E2E observation }',
      '```',
      '',
    ].join('\n'))
    const businessIntent = JSON.stringify({
      value: 'Prove the packed runtime executes from a consumer.',
      workflow: 'Pack, install, materialize, normalize, and validate.',
      rules: 'Never resolve package code through the consumer cwd.',
      outOfScope: 'Using the atomic-skills source checkout at runtime.',
      doneWhen: 'Every installed command exits successfully.',
    })

    const materialize = (slug) => {
      const result = runInstalled(
        'scripts/decompose-plan.js',
        'materialize',
        '--source', source,
        '--slug', slug,
        '--project-id', 'consumer',
        '--branch', `plan/${slug}`,
        '--business-intent', businessIntent,
      )
      const files = JSON.parse(result.stdout)
      assert.ok(files.some((file) => file.kind === 'plan'))
      assert.ok(files.some((file) => file.kind === 'initiative'))
      persistMaterialized(files)
      return files
    }

    dependentFiles = materialize('dependent')
    materialize('prerequisite')

    const signals = join(consumer, 'signals.json')
    writeFileSync(signals, JSON.stringify([{
      slug: 'packed-runtime',
      source_type: 'git-branch',
      last_activity: '2026-07-11T00:00:00Z',
    }]))
    const discovered = runInstalled('scripts/bootstrap-project.js', 'cluster', '--signals', signals)
    const clusters = JSON.parse(discovered.stdout)
    assert.equal(clusters.clusters[0].canonical.slug, 'packed-runtime')

    const dependentDir = join(consumer, '.atomic-skills', 'projects', 'consumer', 'dependent')
    for (let attempt = 0; attempt < 2; attempt += 1) {
      runInstalled('scripts/plan-dependencies.js', 'add', dependentDir, 'prerequisite')
    }
    const dependentPlan = readFileSync(join(dependentDir, 'plan.md'), 'utf8')
    assert.equal((dependentPlan.match(/plan: prerequisite/g) ?? []).length, 1)

    const initiative = dependentFiles.find((file) => file.kind === 'initiative')
    const initiativePath = join(consumer, initiative.relativePath)
    const validInitiative = readFileSync(initiativePath, 'utf8')
    const invalidInitiative = validInitiative.replace(
      /(id: F0-G1[\s\S]*?\n\s+status:) pending/,
      '$1 active',
    )
    assert.notEqual(invalidInitiative, validInitiative, 'fixture failed to inject invalid gate status')
    writeFileSync(initiativePath, invalidInitiative)

    const normalized = runInstalled('src/normalize.js', join(consumer, '.atomic-skills'))
    assert.match(normalized.stdout, /normalized 1 file\(s\), 1 change\(s\)/)
    assert.doesNotMatch(`${normalized.stdout}\n${normalized.stderr}`, new RegExp(SENTINEL))
    assert.match(readFileSync(initiativePath, 'utf8'), /id: F0-G1[\s\S]*?status: pending/)

    const verified = runInstalled('scripts/validate-state.js', join(consumer, '.atomic-skills'))
    assert.match(verified.stdout, /All \d+ file\(s\) valid/)
  })

  it('loads lazy helpers from rendered installed skill references', () => {
    const skillPaths = [
      join(consumer, '.agents', 'skills', 'atomic-skills', 'implement', 'SKILL.md'),
      join(consumer, '.agents', 'skills', 'atomic-skills', 'project', 'SKILL.md'),
    ]
    const helperRefs = new Set()
    for (const path of skillPaths) {
      const content = readFileSync(path, 'utf8')
      installedText.set(path, content)
      for (const match of content.matchAll(/\.agents\/atomic-skills\/_assets\/[A-Za-z0-9_.-]+\.md/g)) {
        helperRefs.add(match[0])
      }
    }
    assert.ok(helperRefs.size >= 10, `expected lazy helper references, found ${helperRefs.size}`)

    for (const ref of helperRefs) {
      const path = join(consumer, ref)
      assert.ok(existsSync(path), `installed lazy helper is missing: ${ref}`)
      assert.ok(statSync(path).size > 0, `installed lazy helper is empty: ${ref}`)
      const content = readFileSync(path, 'utf8')
      installedText.set(path, content)
      assert.doesNotMatch(content, TOOL_TEMPLATE, `unrendered tool variable in ${ref}`)
      assert.doesNotMatch(content, /skills\/shared\//, `source-tree reference in ${ref}`)
    }

    const closure = runInstalled('scripts/validate-runtime-closure.js')
    assert.match(closure.stdout, /Runtime closure valid:/)
  })

  it('contains no absolute source-checkout path in the installed runtime evidence', () => {
    const textRoots = [
      join(consumer, '.agents'),
      join(consumer, '.atomic-skills'),
    ]
    for (const rootPath of textRoots) {
      for (const path of listFiles(rootPath)) {
        installedText.set(path, readFileSync(path, 'utf8'))
      }
    }
    for (const relativePath of [
      'package.json',
      'scripts/decompose-plan.js',
      'scripts/bootstrap-project.js',
      'scripts/plan-dependencies.js',
      'scripts/validate-state.js',
      'scripts/validate-runtime-closure.js',
      'src/runtime-paths.js',
      'src/normalize.js',
      'meta/schemas/plan.schema.json',
      'meta/schemas/initiative.schema.json',
    ]) {
      const path = join(packageRoot, relativePath)
      installedText.set(path, readFileSync(path, 'utf8'))
    }

    const checkoutRoot = realpathSync(SOURCE_ROOT)
    for (const [path, content] of installedText) {
      assert.equal(
        content.includes(checkoutRoot),
        false,
        `${path} contains the absolute source-checkout path`,
      )
    }
    assert.doesNotMatch(transcript.join('\n'), new RegExp(checkoutRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.doesNotMatch(transcript.join('\n'), new RegExp(SENTINEL))
  })
})
