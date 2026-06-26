// E.T-003 — cross-repo narrative contract test.
//
// atomic-skills writes plan.template.md / initiative.template.md frontmatter
// to .atomic-skills/{plans,initiatives}/. aiDeck reads those files via its
// parsePlanFile / parseInitiativeFile. If either side drifts (new required
// field, schema bump, narrative-extraction rule change), this test breaks.
//
// The test imports aideck's parser DIRECTLY from a sibling checkout at
// ../aideck. When the sibling isn't present (CI, fresh clone) the test
// skips with a clear message — E.T-009 covers the cross-repo install path.

import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const AIDECK_DIST = resolve(REPO_ROOT, '..', 'aideck', 'dist', 'server', 'parsers', 'project-status.js')

const PLAN_TEMPLATE_PATH = join(
  REPO_ROOT,
  'skills',
  'shared',
  'project-assets',
  'plan.template.md'
)
const INITIATIVE_TEMPLATE_PATH = join(
  REPO_ROOT,
  'skills',
  'shared',
  'project-assets',
  'initiative.template.md'
)
const AIDECK_MANIFEST_PATH = join(REPO_ROOT, 'assets', 'aideck-consumer', 'manifest.yaml')

const HAS_AIDECK = existsSync(AIDECK_DIST)
const SKIP_REASON = HAS_AIDECK ? null : `sibling aideck dist not at ${AIDECK_DIST}`

// Lazy import — only loads the parser when the dist is present.
async function loadParsers() {
  if (!HAS_AIDECK) return null
  return await import(AIDECK_DIST)
}

/**
 * Substitutes REPLACE_* placeholders with provided values. Mirrors the
 * project skill's `new plan` / `new initiative` flow, which the LLM applies
 * literally (not via renderTemplate, which is the install-time machinery).
 *
 * @param {string} raw
 * @param {Record<string,string>} subs
 * @returns {string}
 */
function fillPlaceholders(raw, subs) {
  let out = raw
  for (const [k, v] of Object.entries(subs)) {
    out = out.replaceAll(k, v)
  }
  return out
}

const PLAN_SUBS = {
  REPLACE_SLUG: 'contract-test-plan',
  REPLACE_PLAN_TITLE: 'Contract Test Plan',
  REPLACE_ISO_TIMESTAMP: '2026-05-20T00:00:00Z',
  REPLACE_INITIAL_PHASE_ID: 'F0',
  REPLACE_INITIAL_PHASE_SLUG: 'foundation',
  REPLACE_INITIAL_PHASE_TITLE: 'Foundation',
  REPLACE_INITIAL_PHASE_GOAL: 'Lay the groundwork',
  REPLACE_INITIAL_PHASE_EXIT_SUMMARY: 'All foundation tasks complete',
}

const INITIATIVE_SUBS = {
  REPLACE_SLUG: 'contract-test-initiative',
  REPLACE_INITIATIVE_TITLE: 'Contract Test Initiative',
  REPLACE_INITIATIVE_GOAL: 'Verify cross-repo parser compatibility',
  REPLACE_BRANCH_OR_NULL: 'main',
  REPLACE_ISO_TIMESTAMP: '2026-05-20T00:00:00Z',
  REPLACE_INITIAL_NEXT_ACTION: 'Run the test',
  REPLACE_PARENT_PLAN_SLUG: 'contract-test-plan',
  REPLACE_PHASE_ID: 'F0',
}

describe('aideck cross-repo contract', () => {
  it('parsePlanFile accepts the filled plan.template.md', { skip: !HAS_AIDECK && SKIP_REASON }, async () => {
    const parsers = await loadParsers()
    assert.ok(parsers, 'parsers should be loaded when aideck is present')

    const raw = readFileSync(PLAN_TEMPLATE_PATH, 'utf8')
    const filled = fillPlaceholders(raw, PLAN_SUBS)

    const tmp = mkdtempSync(join(tmpdir(), 'as-contract-plan-'))
    const path = join(tmp, 'contract-test-plan.md')
    writeFileSync(path, filled)

    try {
      const result = await parsers.parsePlanFile(path)
      assert.equal(
        result.ok,
        true,
        `parsePlanFile failed: ${result.ok ? '' : JSON.stringify(result.error, null, 2)}`
      )
      if (result.ok) {
        assert.equal(result.value.slug, 'contract-test-plan')
        assert.equal(result.value.title, 'Contract Test Plan')
        assert.equal(result.value.status, 'active')
        assert.equal(result.value.currentPhase, 'F0')
        assert.ok(Array.isArray(result.value.phases), 'phases must be an array')
        assert.equal(result.value.phases.length, 1, 'template ships one phase')
        assert.equal(result.value.phases[0].id, 'F0')
        // narrative is the markdown body below the second `---` — aideck
        // extracts it; the field must be a string (even if empty).
        assert.equal(typeof result.value.narrative, 'string')
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('parseInitiativeFile accepts the filled initiative.template.md (in-plan mode)', { skip: !HAS_AIDECK && SKIP_REASON }, async () => {
    const parsers = await loadParsers()
    assert.ok(parsers)

    const raw = readFileSync(INITIATIVE_TEMPLATE_PATH, 'utf8')
    const filled = fillPlaceholders(raw, INITIATIVE_SUBS)

    const tmp = mkdtempSync(join(tmpdir(), 'as-contract-init-'))
    const path = join(tmp, 'contract-test-initiative.md')
    writeFileSync(path, filled)

    try {
      const result = await parsers.parseInitiativeFile(path)
      assert.equal(
        result.ok,
        true,
        `parseInitiativeFile failed: ${result.ok ? '' : JSON.stringify(result.error, null, 2)}`
      )
      if (result.ok) {
        assert.equal(result.value.slug, 'contract-test-initiative')
        assert.equal(result.value.title, 'Contract Test Initiative')
        assert.equal(result.value.status, 'active')
        assert.equal(result.value.parentPlan, 'contract-test-plan')
        assert.equal(result.value.phaseId, 'F0')
        assert.ok(Array.isArray(result.value.stack), 'stack must be an array')
        assert.ok(Array.isArray(result.value.tasks), 'tasks must be an array')
        assert.equal(result.value.stack.length, 1, 'template ships one initial frame')
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('parseInitiativeFile preserves context on populated parked/emerged', { skip: !HAS_AIDECK && SKIP_REASON }, async () => {
    const parsers = await loadParsers()
    assert.ok(parsers)

    const raw = readFileSync(INITIATIVE_TEMPLATE_PATH, 'utf8')
    let filled = fillPlaceholders(raw, INITIATIVE_SUBS)

    // Replace the empty parked/emerged arrays with populated entries that include
    // a complete context block (mirrors meta/schemas/common.schema.json $defs.context).
    filled = filled.replace(
      /^parked: \[\]$/m,
      `parked:
  - title: 'sample parked item with context'
    surfacedAt: '2026-05-20T18:00:00Z'
    fromFrame: null
    context:
      solves: 'concrete problem solved here'
      trigger: 'concrete trigger description'
      assumesStillValid: []
      ratifiedAt: '2026-05-20T18:15:00Z'
      ratifiedBy: human`
    )
    filled = filled.replace(
      /^emerged: \[\]$/m,
      `emerged:
  - title: 'sample emerged item with context'
    surfacedAt: '2026-05-20T19:00:00Z'
    promoted: false
    context:
      solves: 'another concrete problem here'
      trigger: 'another concrete trigger description'
      assumesStillValid: []
      ratifiedAt: '2026-05-20T19:15:00Z'
      ratifiedBy: human
      lastReviewedAt: '2026-04-15T10:00:00Z'`
    )

    const tmp = mkdtempSync(join(tmpdir(), 'as-contract-init-ctx-'))
    const path = join(tmp, 'with-context.md')
    writeFileSync(path, filled)

    try {
      const result = await parsers.parseInitiativeFile(path)
      assert.equal(
        result.ok,
        true,
        `parseInitiativeFile failed: ${result.ok ? '' : JSON.stringify(result.error, null, 2)}`
      )
      if (result.ok) {
        assert.equal(result.value.parked.length, 1)
        assert.ok(result.value.parked[0].context, 'parked[0].context must be present')
        assert.equal(result.value.parked[0].context.solves, 'concrete problem solved here')
        assert.equal(result.value.emerged.length, 1)
        assert.ok(result.value.emerged[0].context, 'emerged[0].context must be present')
        assert.equal(result.value.emerged[0].context.lastReviewedAt, '2026-04-15T10:00:00Z')
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('parseInitiativeFile accepts standalone mode (no parentPlan/phaseId)', { skip: !HAS_AIDECK && SKIP_REASON }, async () => {
    const parsers = await loadParsers()
    assert.ok(parsers)

    // Standalone: strip the plan-membership-block sentinels (per the
    // template's instruction: "delete entire block + sentinels if standalone").
    const raw = readFileSync(INITIATIVE_TEMPLATE_PATH, 'utf8')
    const standalone = raw.replace(
      /# === plan-membership-block[\s\S]*?# === \/plan-membership-block ===\n/m,
      ''
    )
    const filled = fillPlaceholders(standalone, {
      ...INITIATIVE_SUBS,
      // Strip subs no longer relevant
      REPLACE_PARENT_PLAN_SLUG: '',
      REPLACE_PHASE_ID: '',
    })

    const tmp = mkdtempSync(join(tmpdir(), 'as-contract-init-standalone-'))
    const path = join(tmp, 'standalone.md')
    writeFileSync(path, filled)

    try {
      const result = await parsers.parseInitiativeFile(path)
      assert.equal(
        result.ok,
        true,
        `parseInitiativeFile failed (standalone): ${result.ok ? '' : JSON.stringify(result.error, null, 2)}`
      )
      if (result.ok) {
        // Standalone: parentPlan and phaseId must be absent or undefined.
        assert.ok(!result.value.parentPlan, 'standalone initiative must not have parentPlan')
        assert.ok(!result.value.phaseId, 'standalone initiative must not have phaseId')
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

describe('aideck consumer plan dependency contract', () => {
  it('publishes planEdges and separates execution path from plan relations', () => {
    const manifest = YAML.parse(readFileSync(AIDECK_MANIFEST_PATH, 'utf8'))
    const byId = new Map(manifest.dataSources.map((d) => [d.id, d]))
    assert.deepEqual(byId.get('planEdges'), {
      id: 'planEdges',
      path: '.atomic-skills/.aideck/state/planEdges.json',
      format: 'json',
      root: 'project',
    })

    const planPage = manifest.pages.find((p) => p.slug === 'plan')
    const execution = planPage.sections.find((s) => s.title === 'Caminho de execucao')
    assert.ok(execution, 'plan page must expose execution path')
    assert.deepEqual(
      execution.widgets.map((w) => w.source?.filter?.executionLane),
      ['ready', 'running', 'blocked', 'completed'],
    )

    const relations = planPage.sections.find((s) => s.title === 'Relacoes do plano')
    assert.ok(relations, 'plan page must expose selected-plan relations')
    const host = relations.widgets.find((w) => w.widget === 'collection-grid')
    const edgeFilters = host.slots.body.map((w) => w.source.filter)
    assert.deepEqual(edgeFilters, [
      { projectId: '$parent.projectId', type: 'origin', toPlan: '$parent.slug' },
      { projectId: '$parent.projectId', type: 'dependency', fromPlan: '$parent.slug' },
      { projectId: '$parent.projectId', type: 'dependency', toPlan: '$parent.slug' },
    ])
  })
})

// ── Discover-run contract ──────────────────────────────────────────────────

const AIDECK_DISCOVER_PARSER = resolve(REPO_ROOT, '..', 'aideck', 'dist', 'server', 'parsers', 'discover-run.js')
const HAS_DISCOVER_PARSER = existsSync(AIDECK_DISCOVER_PARSER)
const DISCOVER_FIXTURE = join(REPO_ROOT, 'assets', 'fixtures', 'discover-run.fixture.json')

async function loadDiscoverParser() {
  if (!HAS_DISCOVER_PARSER) return null
  return await import(AIDECK_DISCOVER_PARSER)
}

describe('aideck cross-repo contract — discover-run', () => {
  it('canonical fixture parses through aiDeck discover-run parser', { skip: !HAS_DISCOVER_PARSER && `discover parser not at ${AIDECK_DISCOVER_PARSER}` }, async () => {
    const { parseDiscoverRunFile } = await loadDiscoverParser()
    const result = await parseDiscoverRunFile(DISCOVER_FIXTURE)
    assert.ok(result.ok, `expected ok, got: ${JSON.stringify(result.error ?? {})}`)
    assert.strictEqual(result.value.runId, 'disc-20260524-103000')
    assert.ok(result.value.candidates.length >= 2, 'fixture should have at least 2 candidates')
    assert.ok(result.value.orphanSignals.length >= 1, 'fixture should have at least 1 orphan signal')
    assert.ok(result.value.relationships.length >= 1, 'fixture should have at least 1 relationship')
  })

  it('rejects fixture with extra fields (strict mode)', { skip: !HAS_DISCOVER_PARSER && `discover parser not at ${AIDECK_DISCOVER_PARSER}` }, async () => {
    const { parseDiscoverRunFile } = await loadDiscoverParser()
    const tmp = mkdtempSync(join(tmpdir(), 'discover-contract-'))
    try {
      const data = JSON.parse(readFileSync(DISCOVER_FIXTURE, 'utf8'))
      data.extraField = 'should fail'
      const tmpFile = join(tmp, 'discover-run.json')
      writeFileSync(tmpFile, JSON.stringify(data))
      const result = await parseDiscoverRunFile(tmpFile)
      assert.ok(!result.ok, 'strict mode should reject extra fields')
      assert.strictEqual(result.error.code, 'invalid_input')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

describe('aideck cross-repo contract — meta', () => {
  it('reports whether the contract test ran or skipped', () => {
    // Visibility-only: makes the skip reason explicit in test output so a
    // reviewer can tell whether the contract was actually verified or not.
    if (!HAS_AIDECK) {
      console.error(`  contract-test skipped: ${SKIP_REASON}`)
    }
  })
})
