import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import Ajv from 'ajv/dist/2020.js'
import { parse as parseYaml } from 'yaml'
import { decomposePlan, materializeDecomposition } from '../src/decompose.js'
import {
  assertImplementReadyTask,
  classifyImplementPath,
  targetPathsFromTask,
} from '../src/implement-scope.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA_DIR = join(ROOT, 'meta', 'schemas')
const IMPLEMENT = readFileSync(join(ROOT, 'skills', 'core', 'implement.md'), 'utf8')
const INITIATIVE_SCHEMA = JSON.parse(readFileSync(join(SCHEMA_DIR, 'initiative.schema.json'), 'utf8'))

const SPEC_SOURCE = [
  '# Runtime Contract',
  '',
  '## F0 — Bootstrap',
  '',
  'Goal: materialize one implement-ready task.',
  '',
  '### T-001 Resolve the runtime',
  '',
  '- Files: src/runtime-paths.js, src/implement-scope.js',
  '- scopeBoundary: do not touch the consumer src directory; never edit src/consumer-private.js',
  '- acceptance: the installed entrypoint runs outside the source checkout',
  '- verifier: { kind: shell, command: "node --test tests/consumer-runtime-resolution.test.js", expectExitCode: 0 }',
  '',
].join('\n')

const BUSINESS_INTENT = {
  value: 'Admit SPEC tasks into implement with correct targets and exclusions.',
  workflow: 'lintSpec → decompose → schema → implement path admission.',
  rules: 'No Files property; exclusions never allowlist.',
  outOfScope: 'Installer safety, host tiers, Gemini, release.',
  doneWhen: 'outputs are targets; scopeBoundary blocks listed paths.',
}

const FROZEN_DATE = '2026-07-16T12:00:00.000Z'

function section(document, startHeading, endHeading) {
  const start = document.indexOf(startHeading)
  assert.notEqual(start, -1, `missing section: ${startHeading}`)
  const end = document.indexOf(endHeading, start + startHeading.length)
  assert.notEqual(end, -1, `missing section: ${endHeading}`)
  return document.slice(start, end)
}

function buildInitiativeValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false })
  for (const name of ['common.schema.json', 'plan.schema.json', 'initiative.schema.json']) {
    ajv.addSchema(JSON.parse(readFileSync(join(SCHEMA_DIR, name), 'utf8')))
  }
  return ajv.getSchema('https://atomic-skills.henryavila.com/schemas/initiative.schema.json')
}

function runLintSpec(sourcePath) {
  return spawnSync(
    process.execPath,
    [join(ROOT, 'scripts', 'lint-source.js'), sourcePath, '--spec'],
    { encoding: 'utf8', cwd: ROOT },
  )
}

describe('implement-ready task contract', () => {
  it('lintSpec → decompose → schema produces outputs, exclusions, acceptance, verifier (no Files)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'implement-ready-'))
    try {
      const sourcePath = join(dir, 'source.md')
      writeFileSync(sourcePath, SPEC_SOURCE)

      const lint = runLintSpec(sourcePath)
      assert.equal(lint.status, 0, `lintSpec failed: ${lint.stdout}\n${lint.stderr}`)

      const result = decomposePlan(SPEC_SOURCE, { planSlug: 'runtime-contract' })
      const task = result.initiatives[0].tasks[0]

      assert.deepEqual(task.outputs, [
        { kind: 'file', path: 'src/runtime-paths.js' },
        { kind: 'file', path: 'src/implement-scope.js' },
      ])
      assert.deepEqual(task.scopeBoundary, [
        'do not touch the consumer src directory; never edit src/consumer-private.js',
      ])
      assert.deepEqual(task.acceptance, [
        'the installed entrypoint runs outside the source checkout',
      ])
      assert.deepEqual(task.verifier, {
        kind: 'shell',
        command: 'node --test tests/consumer-runtime-resolution.test.js',
        expectExitCode: 0,
      })
      assert.equal(Object.hasOwn(task, 'Files'), false)

      const ready = assertImplementReadyTask(task)
      assert.equal(ready.ok, true, ready.violations.join('; '))

      const files = materializeDecomposition(result, {
        planSlug: 'runtime-contract',
        projectId: 'demo',
        businessIntent: BUSINESS_INTENT,
        branch: 'plan/runtime-contract',
        now: FROZEN_DATE,
      })
      const initFile = files.find((f) => f.kind === 'initiative')
      assert.ok(initFile, 'F0 initiative must materialize')
      const fm = parseYaml(initFile.content.split('---\n')[1])
      const validate = buildInitiativeValidator()
      assert.equal(validate(fm), true, JSON.stringify(validate.errors, null, 2))
      assert.equal(Object.hasOwn(fm.tasks[0], 'Files'), false)
      assert.ok(Array.isArray(fm.tasks[0].outputs) && fm.tasks[0].outputs.length >= 1)
      assert.ok(Array.isArray(fm.tasks[0].scopeBoundary) && fm.tasks[0].scopeBoundary.length >= 1)
      assert.ok(fm.tasks[0].verifier)
      assert.ok(Array.isArray(fm.tasks[0].acceptance) && fm.tasks[0].acceptance.length >= 1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('implement admits targets within outputs and blocks any path listed in scopeBoundary', () => {
    const task = decomposePlan(SPEC_SOURCE, { planSlug: 'runtime-contract' }).initiatives[0].tasks[0]

    assert.deepEqual(targetPathsFromTask(task), [
      'src/runtime-paths.js',
      'src/implement-scope.js',
    ])

    const ok = classifyImplementPath(task, 'src/runtime-paths.js')
    assert.equal(ok.admitted, true, ok.reason)
    assert.equal(ok.code, 'admitted')

    const ok2 = classifyImplementPath(task, 'src/implement-scope.js')
    assert.equal(ok2.admitted, true, ok2.reason)

    const excluded = classifyImplementPath(task, 'src/consumer-private.js')
    assert.equal(excluded.admitted, false)
    assert.equal(excluded.code, 'scope-boundary-exclusion')

    const outside = classifyImplementPath(task, 'src/other.js')
    assert.equal(outside.admitted, false)
    assert.equal(outside.code, 'not-a-target')

    const withFiles = classifyImplementPath(
      { ...task, Files: ['src/runtime-paths.js'] },
      'src/runtime-paths.js',
    )
    assert.equal(withFiles.admitted, false)
    assert.equal(withFiles.code, 'invalid-files-property')
  })

  it('initiative schema has no Files property on Task', () => {
    const taskDef = INITIATIVE_SCHEMA.$defs?.task
    assert.ok(taskDef, 'task $def exists')
    assert.equal(taskDef.additionalProperties, false)
    assert.equal(Object.hasOwn(taskDef.properties || {}, 'Files'), false)
    assert.ok(taskDef.properties.outputs, 'outputs is the target property')
    assert.ok(taskDef.properties.scopeBoundary, 'scopeBoundary is the exclusion property')
    assert.match(
      String(taskDef.properties.scopeBoundary.description || ''),
      /must NOT|exclusion/i,
    )
  })

  it('admits outputs[].path as targets instead of requiring Files', () => {
    const step1 = section(
      IMPLEMENT,
      '### Step 1 — Load the admitted tasks',
      '### Step 2 — Execute one task',
    )

    assert.match(step1, /`outputs\[\]\.path`/)
    assert.doesNotMatch(step1, /exact `Files`|carries the SPEC interior:.*`Files`/s)
    assert.match(step1, /`scopeBoundary\[\]`.*(?:exclusions|DO-NOT)/is)
  })

  it('orients on output targets and treats scopeBoundary as explicit exclusions', () => {
    const step2 = section(
      IMPLEMENT,
      '### Step 2 — Execute one task',
      '### Step 3 — Phase boundary',
    )

    assert.match(step2, /Read the task's `outputs\[\]\.path`/)
    assert.match(step2, /targets/i)
    assert.match(step2, /`scopeBoundary\[\]`.*(?:explicit exclusions|DO-NOT)/is)
    assert.doesNotMatch(step2, /a change outside `scopeBoundary\[\]` is a scope exit/)
  })
})
