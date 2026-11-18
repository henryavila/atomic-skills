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
        npm_config_cache: process.env.npm_config_cache || join(home, '.npm-cache'),
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
    assert.ok(existsSync(join(packageRoot, 'scripts', 'lint-design.js')))
    assert.ok(existsSync(join(packageRoot, 'meta', 'schemas', 'app-map.schema.json')))
    assert.equal(existsSync(join(packageRoot, 'scripts', 'decompose-plan.js')), false)
    assert.equal(existsSync(join(packageRoot, 'skills', 'core', 'project.md')), false)
    assert.equal(existsSync(join(packageRoot, 'skills', 'core', 'implement.md')), false)
    assert.equal(lstatSync(packageRoot).isSymbolicLink(), false, 'npm install must extract, not link, the package')

    const recordedRoot = realpathSync(readFileSync(markerPath, 'utf8').trim())
    const extractedRoot = realpathSync(packageRoot)
    const checkoutRoot = realpathSync(SOURCE_ROOT)
    assert.equal(recordedRoot, extractedRoot)
    assert.ok(isInside(recordedRoot, realpathSync(join(consumer, 'node_modules'))))
    assert.notEqual(recordedRoot, checkoutRoot, 'package-root leaked back to the source checkout')
  })

  it('ships surviving scripts and omits the removed plan runtime', () => {
    assert.ok(existsSync(join(packageRoot, 'scripts', 'find-plans-missing-ground-truth.js')))
    assert.equal(existsSync(join(packageRoot, 'assets', 'aideck-consumer')), false)
    const closure = runInstalled('scripts/validate-runtime-closure.js')
    assert.match(closure.stdout, /Runtime closure valid:/)
  })

  it('loads lazy helpers from rendered installed skill references', () => {
    const skillPaths = [
      join(consumer, '.agents', 'skills', 'atomic-skills', 'verify-claim', 'SKILL.md'),
      join(consumer, '.agents', 'skills', 'atomic-skills', 'review-plan', 'SKILL.md'),
    ]
    assert.equal(
      existsSync(join(consumer, '.agents', 'skills', 'atomic-skills', 'implement', 'SKILL.md')),
      false,
    )
    assert.equal(
      existsSync(join(consumer, '.agents', 'skills', 'atomic-skills', 'project', 'SKILL.md')),
      false,
    )
    const helperRefs = new Set()
    for (const path of skillPaths) {
      const content = readFileSync(path, 'utf8')
      installedText.set(path, content)
      for (const match of content.matchAll(/\.agents\/atomic-skills\/_assets\/[A-Za-z0-9_.-]+\.md/g)) {
        helperRefs.add(match[0])
      }
    }
    assert.ok(helperRefs.size >= 1, `expected lazy helper references, found ${helperRefs.size}`)
    assert.ok(existsSync(join(consumer, '.agents', 'atomic-skills', '_assets', 'verifier-exec.md')))

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
      'scripts/lint-design.js',
      'scripts/find-plans-missing-ground-truth.js',
      'scripts/validate-runtime-closure.js',
      'src/runtime-paths.js',
      'src/ground-truth-review.js',
      'meta/schemas/app-map.schema.json',
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
