import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decomposePlan } from '../src/decompose.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const IMPLEMENT = readFileSync(join(ROOT, 'skills', 'core', 'implement.md'), 'utf8')

const SPEC_SOURCE = [
  '# Runtime Contract',
  '',
  '## F0 — Bootstrap',
  '',
  'Goal: materialize one implement-ready task.',
  '',
  '### T-001 Resolve the runtime',
  '',
  '- Files: src/runtime-paths.js',
  '- scopeBoundary: do not touch the consumer src directory',
  '- acceptance: the installed entrypoint runs outside the source checkout',
  '- verifier: { kind: shell, command: "node --test tests/consumer-runtime-resolution.test.js", expectExitCode: 0 }',
  '',
].join('\n')

function section(document, startHeading, endHeading) {
  const start = document.indexOf(startHeading)
  assert.notEqual(start, -1, `missing section: ${startHeading}`)
  const end = document.indexOf(endHeading, start + startHeading.length)
  assert.notEqual(end, -1, `missing section: ${endHeading}`)
  return document.slice(start, end)
}

describe('implement-ready task contract', () => {
  it('materializes outputs, exclusions, acceptance, and verifier without a Files property', () => {
    const task = decomposePlan(SPEC_SOURCE, { planSlug: 'runtime-contract' }).initiatives[0].tasks[0]

    assert.deepEqual(task.outputs, [{ kind: 'file', path: 'src/runtime-paths.js' }])
    assert.deepEqual(task.scopeBoundary, ['do not touch the consumer src directory'])
    assert.deepEqual(task.acceptance, ['the installed entrypoint runs outside the source checkout'])
    assert.deepEqual(task.verifier, {
      kind: 'shell',
      command: 'node --test tests/consumer-runtime-resolution.test.js',
      expectExitCode: 0,
    })
    assert.equal(Object.hasOwn(task, 'Files'), false)
  })

  it('admits outputs[].path as targets instead of requiring Files', () => {
    const step1 = section(
      IMPLEMENT,
      '### Step 1 — Load the admitted tasks',
      '### Step 2 — Execute one task'
    )

    assert.match(step1, /`outputs\[\]\.path`/)
    assert.doesNotMatch(step1, /exact `Files`|carries the SPEC interior:.*`Files`/s)
    assert.match(step1, /`scopeBoundary\[\]`.*(?:exclusions|DO-NOT)/is)
  })

  it('orients on output targets and treats scopeBoundary as explicit exclusions', () => {
    const step2 = section(
      IMPLEMENT,
      '### Step 2 — Execute one task',
      '### Step 3 — Phase boundary'
    )

    assert.match(step2, /Read the task's `outputs\[\]\.path`/)
    assert.match(step2, /targets/i)
    assert.match(step2, /`scopeBoundary\[\]`.*(?:explicit exclusions|DO-NOT)/is)
    assert.doesNotMatch(step2, /a change outside `scopeBoundary\[\]` is a scope exit/)
  })
})
