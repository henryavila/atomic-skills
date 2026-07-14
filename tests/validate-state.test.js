import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { parseFrontmatter, validateFile, crossValidate, collectPlanDependencyErrors, checkMetInvariant, checkReviewGate, checkClosedAtHardening, collectTargets, collectRoutingConfigs, validateRouting } from '../scripts/validate-state.js';
import Ajv from 'ajv/dist/2020.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const FIXTURES = join(REPO_ROOT, 'tests', 'fixtures', 'state');
const SCHEMA_DIR = join(REPO_ROOT, 'meta', 'schemas');

function buildValidators() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const name of ['common.schema.json', 'plan.schema.json', 'initiative.schema.json', 'routing.schema.json', 'lesson.schema.json']) {
    const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, name), 'utf8'));
    ajv.addSchema(schema);
  }
  return {
    validatePlan: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/plan.schema.json'),
    validateInitiative: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/initiative.schema.json'),
    validateRouting: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/routing.schema.json'),
    validateLesson: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/lesson.schema.json'),
  };
}

test('parseFrontmatter extracts YAML + body', () => {
  const raw = `---\nslug: foo\ntitle: 'Bar'\n---\n# Hello\n\nbody`;
  const out = parseFrontmatter(raw);
  assert.equal(out.error, undefined);
  assert.deepEqual(out.frontmatter, { slug: 'foo', title: 'Bar' });
  assert.equal(out.body, '# Hello\n\nbody');
});

test('parseFrontmatter rejects file without opening fence', () => {
  const out = parseFrontmatter('no fence here\n');
  assert.match(out.error || '', /does not start with `---`/);
});

test('parseFrontmatter rejects file with no closing fence', () => {
  const out = parseFrontmatter('---\nslug: foo\nno closing fence ever\n');
  assert.match(out.error || '', /no closing `---`/);
});

test('parseFrontmatter rejects non-object frontmatter', () => {
  const out = parseFrontmatter('---\n- just\n- a\n- list\n---\nbody');
  assert.match(out.error || '', /not a YAML object/);
});

/**
 * Walk the canonical positive-fixture directories. NOT recursive — by
 * design `invalid/` (negative tests) and `legacy/` (migration source
 * fixtures) live deeper and are not picked up.
 */
function listCanonicalFixtures() {
  const out = [];
  for (const sub of ['plans', 'initiatives']) {
    const dir = join(FIXTURES, sub);
    try {
      for (const entry of readdirSync(dir)) {
        if (entry.endsWith('.md')) out.push(join(dir, entry));
      }
    } catch {
      // dir may not exist (e.g. if a future fixture restructure happens) — skip.
    }
  }
  return out;
}

test('every canonical fixture under tests/fixtures/state/{plans,initiatives}/ passes schema (codex F-002 regression)', () => {
  const validators = buildValidators();
  const files = listCanonicalFixtures();
  assert.ok(files.length >= 2, `expected at least 2 canonical fixtures, found ${files.length}`);
  for (const file of files) {
    const result = validateFile(file, validators);
    assert.equal(
      result.ok,
      true,
      `fixture ${file} must validate (kind ${result.kind}); errors: ${JSON.stringify(result.errors)}`,
    );
  }
});

test('v3-redesign plan has 9 phases (real sda-v2 shape)', () => {
  const raw = readFileSync(join(FIXTURES, 'plans', 'v3-redesign.md'), 'utf8');
  const { frontmatter } = parseFrontmatter(raw);
  assert.equal(frontmatter.phases.length, 9);
  assert.equal(frontmatter.phases[0].id, 'F0');
  assert.equal(frontmatter.phases[8].id, 'F8');
});

test('ExitCriterion accepts the optional evidence block (B.T-006)', () => {
  const validators = buildValidators();
  const initiativeWithEvidence = {
    schemaVersion: '0.1',
    slug: 'v3-f0-foundation-repair',
    title: 'F0 — Foundation Repair',
    goal: 'Foundation repair',
    status: 'active',
    branch: 'v2-rebuild',
    started: '2026-05-19T10:00:00Z',
    lastUpdated: '2026-05-19T18:42:00Z',
    nextAction: null,
    exitGates: [
      {
        id: 'F0-G1',
        description: 'Tag git core-v2 created',
        verifier: { kind: 'shell', command: 'git tag | grep core-v2', expectExitCode: 0 },
        status: 'met',
        metAt: '2026-05-19T20:00:00Z',
        evidence: {
          verifierKind: 'shell',
          verifiedAt: '2026-05-19T20:00:00Z',
          passed: true,
          exitCode: 0,
          outputSummary: 'core-v2',
        },
      },
      {
        id: 'F0-G2',
        description: 'No duplicates',
        verifier: { kind: 'query', sql: 'SELECT COUNT(*) FROM v_song_duplicates', expectRowCount: 0 },
        status: 'met',
        metAt: '2026-05-19T20:05:00Z',
        evidence: {
          verifierKind: 'query',
          verifiedAt: '2026-05-19T20:05:00Z',
          passed: true,
          rowCount: 0,
          outputSummary: 'verified via psql',
        },
      },
      {
        id: 'F0-G3',
        description: 'Visual review complete',
        verifier: { kind: 'manual', description: 'Visual review per Resource' },
        status: 'deferred',
        deferredReason: 'Postponed to next sprint',
        evidence: {
          verifierKind: 'manual',
          verifiedAt: '2026-05-19T20:10:00Z',
          passed: false,
          outputSummary: 'reviewer unavailable; defer',
        },
      },
    ],
    stack: [{ id: 1, title: 'F0 kickoff', type: 'task', openedAt: '2026-05-19T10:00:00Z' }],
    tasks: [],
    parked: [],
    emerged: [],
  };
  const ok = validators.validateInitiative(initiativeWithEvidence);
  assert.equal(ok, true, `evidence block should validate: ${JSON.stringify(validators.validateInitiative.errors)}`);
});

test('evidence block requires verifierKind + verifiedAt', () => {
  const validators = buildValidators();
  const badInitiative = {
    schemaVersion: '0.1',
    slug: 'bad',
    title: 'bad',
    goal: 'bad',
    status: 'active',
    branch: null,
    started: '2026-05-19T10:00:00Z',
    lastUpdated: '2026-05-19T10:00:00Z',
    nextAction: null,
    exitGates: [{
      id: 'G1',
      description: 'desc',
      status: 'met',
      evidence: { passed: true },  // missing verifierKind + verifiedAt
    }],
    stack: [],
    tasks: [],
    parked: [],
    emerged: [],
  };
  const ok = validators.validateInitiative(badInitiative);
  assert.equal(ok, false);
  const errText = (validators.validateInitiative.errors || []).map((e) => e.message).join('; ');
  assert.match(errText, /verifierKind|verifiedAt/);
});

test('initiative with missing required fields fails validation', () => {
  const validators = buildValidators();
  const result = validateFile(join(FIXTURES, 'invalid', 'initiatives', 'missing-required.md'), validators);
  assert.equal(result.ok, false);
  assert.equal(result.kind, 'initiative');
  const errText = result.errors.join('\n');
  // Missing required fields should each surface as a `required` error.
  assert.match(errText, /goal|started|lastUpdated|nextAction|stack|tasks/);
});

test('task with provenance but no context fails validation (conditional required)', () => {
  const validators = buildValidators();
  const init = {
    schemaVersion: '0.1',
    slug: 'ii', title: 'X', goal: 'Y', status: 'active', branch: null,
    started: '2026-05-20T00:00:00Z', lastUpdated: '2026-05-20T00:00:00Z',
    nextAction: null, exitGates: [], stack: [],
    tasks: [{
      id: 'T-001', title: 'foo', status: 'pending',
      lastUpdated: '2026-05-20T00:00:00Z',
      provenance: { surfacedAt: '2026-05-20T18:14:16Z', surfacedBy: 'human' }
      // context: MISSING — must trigger the if/then constraint
    }],
    parked: [], emerged: []
  };
  const ok = validators.validateInitiative(init);
  assert.equal(ok, false, 'task with provenance must require context');
  const errText = (validators.validateInitiative.errors || []).map((e) => e.message + ' ' + JSON.stringify(e.params)).join('; ');
  assert.match(errText, /context/, `expected error to name 'context' missing — got: ${errText}`);
});

test('task with provenance + complete context passes validation', () => {
  const validators = buildValidators();
  const init = {
    schemaVersion: '0.1',
    slug: 'ii', title: 'X', goal: 'Y', status: 'active', branch: null,
    started: '2026-05-20T00:00:00Z', lastUpdated: '2026-05-20T00:00:00Z',
    nextAction: null, exitGates: [], stack: [],
    tasks: [{
      id: 'T-001', title: 'foo', status: 'pending',
      lastUpdated: '2026-05-20T00:00:00Z',
      provenance: { surfacedAt: '2026-05-20T18:14:16Z', surfacedBy: 'human' },
      context: {
        solves: 'real problem statement here',
        trigger: 'concrete trigger that surfaced this',
        ratifiedAt: '2026-05-20T18:15:00Z',
        ratifiedBy: 'human'
      }
    }],
    parked: [], emerged: []
  };
  const ok = validators.validateInitiative(init);
  assert.equal(ok, true, `should pass; errors: ${JSON.stringify(validators.validateInitiative.errors)}`);
});

test('parked entry without context fails validation (always required)', () => {
  const validators = buildValidators();
  const init = {
    schemaVersion: '0.1',
    slug: 'ii', title: 'X', goal: 'Y', status: 'active', branch: null,
    started: '2026-05-20T00:00:00Z', lastUpdated: '2026-05-20T00:00:00Z',
    nextAction: null, exitGates: [], stack: [],
    tasks: [],
    parked: [{
      title: 'untriaged item',
      surfacedAt: '2026-05-20T18:14:16Z',
      fromFrame: 1
      // context: MISSING
    }],
    emerged: []
  };
  const ok = validators.validateInitiative(init);
  assert.equal(ok, false, 'parked entries must always carry context');
  const errText = (validators.validateInitiative.errors || []).map((e) => e.message).join('; ');
  assert.match(errText, /context/);
});

test('plan with wrong schemaVersion fails validation', () => {
  const validators = buildValidators();
  const result = validateFile(join(FIXTURES, 'invalid', 'plans', 'wrong-schema-version.md'), validators);
  assert.equal(result.ok, false);
  assert.equal(result.kind, 'plan');
  const errText = result.errors.join('\n');
  assert.match(errText, /schemaVersion/);
});

test('round-trip: parse → stringify → parse produces structurally identical frontmatter (plan)', () => {
  const raw = readFileSync(join(FIXTURES, 'plans', 'v3-redesign.md'), 'utf8');
  const { frontmatter: fm1 } = parseFrontmatter(raw);
  const restringified = stringifyYaml(fm1);
  const fm2 = parseYaml(restringified);
  assert.deepStrictEqual(fm2, fm1, 'plan frontmatter must round-trip without data loss');
});

test('round-trip: parse → stringify → parse produces structurally identical frontmatter (initiative)', () => {
  const raw = readFileSync(join(FIXTURES, 'initiatives', 'v3-f0-foundation-repair.md'), 'utf8');
  const { frontmatter: fm1 } = parseFrontmatter(raw);
  const restringified = stringifyYaml(fm1);
  const fm2 = parseYaml(restringified);
  assert.deepStrictEqual(fm2, fm1, 'initiative frontmatter must round-trip without data loss');
});

/**
 * Substitute REPLACE_* markers in a template with realistic values that
 * satisfy the schema. Used by the template-validation tests below.
 */
function fillTemplate(raw, kind) {
  const ts = '2026-05-19T10:00:00Z';
  const common = {
    REPLACE_ISO_TIMESTAMP: ts,
    REPLACE_SLUG: 'my-initiative',
    REPLACE_BRANCH_OR_NULL: 'feat/my-initiative',
  };
  const initiative = {
    ...common,
    REPLACE_INITIATIVE_TITLE: 'My initiative title',
    REPLACE_INITIATIVE_GOAL: 'Ship X by next milestone',
    REPLACE_INITIAL_NEXT_ACTION: 'Read the docs',
    REPLACE_PARENT_PLAN_SLUG: 'v3-redesign',
    REPLACE_PHASE_ID: 'F0',
  };
  const plan = {
    ...common,
    REPLACE_PLAN_TITLE: 'My plan title',
    REPLACE_INITIAL_PHASE_SLUG: 'my-initiative-f0',
    REPLACE_INITIAL_PHASE_ID: 'F0',
    REPLACE_INITIAL_PHASE_TITLE: 'Foundation',
    REPLACE_INITIAL_PHASE_GOAL: 'Establish foundation',
    REPLACE_INITIAL_PHASE_EXIT_SUMMARY: 'Foundation set',
  };
  const subs = kind === 'plan' ? plan : initiative;
  let out = raw;
  for (const [marker, value] of Object.entries(subs)) {
    out = out.replaceAll(marker, value);
  }
  return out;
}

test('initiative.template.md (standalone mode, with plan-membership-block stripped) passes schema', () => {
  const validators = buildValidators();
  const tplPath = join(REPO_ROOT, 'skills', 'shared', 'project-assets', 'initiative.template.md');
  let raw = readFileSync(tplPath, 'utf8');
  // Standalone mode: strip the plan-membership-block (between sentinels, inclusive).
  raw = raw.replace(
    /# === plan-membership-block[\s\S]*?# === \/plan-membership-block ===\n/,
    '',
  );
  const filled = fillTemplate(raw, 'initiative');

  const dir = mkdtempSync(join(tmpdir(), 'atomic-skills-tpl-'));
  try {
    mkdirSync(join(dir, 'initiatives'), { recursive: true });
    const tmpFile = join(dir, 'initiatives', 'my-initiative.md');
    writeFileSync(tmpFile, filled);
    const result = validateFile(tmpFile, validators);
    assert.equal(result.ok, true, `standalone initiative template failed: ${JSON.stringify(result.errors)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('initiative.template.md (in-plan mode, REPLACE_* filled) passes schema', () => {
  const validators = buildValidators();
  const tplPath = join(REPO_ROOT, 'skills', 'shared', 'project-assets', 'initiative.template.md');
  let raw = readFileSync(tplPath, 'utf8');
  // In-plan mode: keep parentPlan/phaseId lines but drop sentinel comments.
  raw = raw.replace(/# === plan-membership-block.*\n/, '');
  raw = raw.replace(/# === \/plan-membership-block ===\n/, '');
  const filled = fillTemplate(raw, 'initiative');

  const dir = mkdtempSync(join(tmpdir(), 'atomic-skills-tpl-'));
  try {
    mkdirSync(join(dir, 'initiatives'), { recursive: true });
    const tmpFile = join(dir, 'initiatives', 'my-initiative.md');
    writeFileSync(tmpFile, filled);
    const result = validateFile(tmpFile, validators);
    assert.equal(result.ok, true, `in-plan initiative template failed: ${JSON.stringify(result.errors)}`);
    // Confirm parentPlan + phaseId were preserved.
    const { frontmatter } = parseFrontmatter(filled);
    assert.equal(frontmatter.parentPlan, 'v3-redesign');
    assert.equal(frontmatter.phaseId, 'F0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('plan.template.md (REPLACE_* filled) passes schema', () => {
  const validators = buildValidators();
  const tplPath = join(REPO_ROOT, 'skills', 'shared', 'project-assets', 'plan.template.md');
  const raw = readFileSync(tplPath, 'utf8');
  const filled = fillTemplate(raw, 'plan');

  const dir = mkdtempSync(join(tmpdir(), 'atomic-skills-tpl-'));
  try {
    mkdirSync(join(dir, 'plans'), { recursive: true });
    const tmpFile = join(dir, 'plans', 'my-initiative.md');
    writeFileSync(tmpFile, filled);
    const result = validateFile(tmpFile, validators);
    assert.equal(result.ok, true, `plan template failed: ${JSON.stringify(result.errors)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('round-trip: parsed plan passes schema after re-serialization', () => {
  const validators = buildValidators();
  const raw = readFileSync(join(FIXTURES, 'plans', 'v3-redesign.md'), 'utf8');
  const { frontmatter: fm1, body } = parseFrontmatter(raw);

  // Write to a temp file, then validate the temp file (proves write→parse→validate cycle is clean).
  const dir = mkdtempSync(join(tmpdir(), 'atomic-skills-roundtrip-'));
  try {
    mkdirSync(join(dir, 'plans'), { recursive: true });
    const tmpFile = join(dir, 'plans', 'v3-redesign.md');
    const out = `---\n${stringifyYaml(fm1)}---\n${body}`;
    writeFileSync(tmpFile, out);
    const result = validateFile(tmpFile, validators);
    assert.equal(result.ok, true, `re-serialized plan failed: ${JSON.stringify(result.errors)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function basePlan(overrides = {}) {
  return {
    schemaVersion: '0.2',
    slug: 'parent-plan',
    title: 'Parent plan',
    version: '1.0',
    status: 'active',
    started: '2026-06-01T00:00:00Z',
    lastUpdated: '2026-06-01T00:00:00Z',
    branch: 'plan/parent-plan',
    currentPhase: 'F0',
    parallelismAllowed: false,
    phases: [{
      id: 'F0',
      slug: 'parent-plan-f0',
      title: 'F0',
      goal: 'Do the first phase',
      dependsOn: [],
      subPhaseCount: 1,
      exitGate: { summary: 'done', criteria: [] },
      status: 'active',
    }],
    ...overrides,
  };
}

function planErrorText(errors) {
  return (errors || [])
    .map((e) => `${e.instancePath} ${e.message} ${JSON.stringify(e.params)}`)
    .join('\n');
}

test('plan schema: dependsOnPlans is optional for legacy plans', () => {
  const validators = buildValidators();
  assert.equal(
    validators.validatePlan(basePlan({ schemaVersion: '0.1' })),
    true,
    `legacy plan without dependsOnPlans must validate: ${planErrorText(validators.validatePlan.errors)}`,
  );
});

test('plan schema: dependsOnPlans accepts fork-plan and manual dependency edges', () => {
  const validators = buildValidators();
  const plan = basePlan({
    dependsOnPlans: [
      {
        plan: 'child-plan',
        createdBy: 'fork-plan',
        origin: { phaseId: 'F2', taskId: 'T-004', mode: 'pause' },
        release: { archived: 'blocked' },
      },
      {
        plan: 'manual-prereq',
        createdBy: 'manual',
      },
    ],
  });
  assert.equal(
    validators.validatePlan(plan),
    true,
    `valid dependsOnPlans edges must pass: ${planErrorText(validators.validatePlan.errors)}`,
  );
});

test('plan schema: dependsOnPlans rejects malformed edges with named errors', () => {
  const validators = buildValidators();
  const cases = [
    {
      name: 'missing plan',
      dependsOnPlans: [{ createdBy: 'manual' }],
      pattern: /plan/,
    },
    {
      name: 'fork-plan without origin',
      dependsOnPlans: [{ plan: 'child-plan', createdBy: 'fork-plan' }],
      pattern: /origin/,
    },
    {
      name: 'invalid origin mode',
      dependsOnPlans: [{ plan: 'child-plan', createdBy: 'fork-plan', origin: { phaseId: 'F2', mode: 'merge' } }],
      pattern: /\/origin\/mode/,
    },
    {
      name: 'invalid archived release policy',
      dependsOnPlans: [{ plan: 'child-plan', createdBy: 'manual', release: { archived: 'complete' } }],
      pattern: /\/release\/archived/,
    },
    {
      name: 'unknown edge property',
      dependsOnPlans: [{ plan: 'child-plan', createdBy: 'manual', unexpected: true }],
      pattern: /additional properties|unexpected/,
    },
    {
      name: 'duplicate exact edge',
      dependsOnPlans: [
        { plan: 'child-plan', createdBy: 'manual' },
        { plan: 'child-plan', createdBy: 'manual' },
      ],
      pattern: /uniqueItems|duplicate/,
    },
  ];

  for (const c of cases) {
    assert.equal(validators.validatePlan(basePlan({ dependsOnPlans: c.dependsOnPlans })), false, c.name);
    assert.match(planErrorText(validators.validatePlan.errors), c.pattern, c.name);
  }
});

test('crossValidate: done phase + done initiative with done tasks → no errors', () => {
  const plans = new Map([['p', {
    slug: 'p',
    stateIntegrityHardening: { enforcedFrom: '2026-07-14T19:36:31Z' },
    phases: [{
      id: 'F0', slug: 'p-f0', status: 'done',
      exitGate: { criteria: [{ id: 'F0-G1', status: 'met' }] },
    }],
  }]]);
  const inits = new Map([['p-f0', {
    slug: 'p-f0', status: 'done',
    tasks: [{ id: 'T-001', status: 'done' }],
    exitGates: [{ id: 'F0-G1', status: 'met' }],
  }]]);
  const errors = crossValidate(plans, inits);
  assert.equal(errors.length, 0);
});

test('crossValidate: done phase + active initiative with pending tasks → errors', () => {
  const plans = new Map([['p', {
    slug: 'p',
    phases: [{
      id: 'F0', slug: 'p-f0', status: 'done',
      exitGate: { criteria: [{ id: 'F0-G1', status: 'met' }] },
    }],
  }]]);
  const inits = new Map([['p-f0', {
    slug: 'p-f0', status: 'active',
    tasks: [{ id: 'T-001', status: 'pending' }, { id: 'T-002', status: 'pending' }],
    exitGates: [{ id: 'F0-G1', status: 'pending' }],
  }]]);
  const errors = crossValidate(plans, inits);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].phaseId, 'F0');
  assert.ok(errors[0].errors.some((e) => e.includes('initiative status')));
  assert.ok(errors[0].errors.some((e) => e.includes('2 initiative task(s) not done')));
  assert.ok(errors[0].errors.some((e) => e.includes('F0-G1')));
});

test('crossValidate: nested done phase resolves project-scoped initiative keys', () => {
  const plans = new Map([['proj/p', {
    slug: 'p',
    __projectId: 'proj',
    phases: [{
      id: 'F0', slug: 'p-f0', status: 'done',
      exitGate: { criteria: [{ id: 'F0-G1', status: 'met' }] },
    }],
  }]]);
  const inits = new Map([['proj/p-f0', {
    slug: 'p-f0',
    __projectId: 'proj',
    status: 'active',
    tasks: [{ id: 'T-001', status: 'pending' }],
    exitGates: [{ id: 'F0-G1', status: 'pending' }],
  }]]);
  const errors = crossValidate(plans, inits);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].planSlug, 'p');
  assert.equal(errors[0].initiativeSlug, 'p-f0');
  assert.ok(errors[0].errors.some((e) => e.includes('initiative status')));
  assert.ok(errors[0].errors.some((e) => e.includes('1 initiative task(s) not done')));
  assert.ok(errors[0].errors.some((e) => e.includes('F0-G1')));
});

test('crossValidate: done phase + no matching initiative → stable missing-initiative error', () => {
  const plans = new Map([['p', {
    slug: 'p',
    stateIntegrityHardening: { enforcedFrom: '2026-07-14T19:36:31Z' },
    phases: [{
      id: 'F0', slug: 'p-f0', status: 'done',
      exitGate: { criteria: [{ id: 'F0-G1', status: 'met' }] },
    }],
  }]]);
  const inits = new Map();
  const errors = crossValidate(plans, inits);
  assert.equal(errors.length, 1);
  assert.match(errors[0].errors.join('\n'), /\[missing-initiative\]/);
});

test('crossValidate: met plan criterion + pending initiative gate → error', () => {
  const plans = new Map([['p', {
    slug: 'p',
    phases: [{
      id: 'F0', slug: 'p-f0', status: 'done',
      exitGate: { criteria: [
        { id: 'F0-G1', status: 'met' },
        { id: 'F0-G2', status: 'met' },
      ] },
    }],
  }]]);
  const inits = new Map([['p-f0', {
    slug: 'p-f0', status: 'done',
    tasks: [{ id: 'T-001', status: 'done' }],
    exitGates: [
      { id: 'F0-G1', status: 'met' },
      { id: 'F0-G2', status: 'pending' },
    ],
  }]]);
  const errors = crossValidate(plans, inits);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].errors.some((e) => e.includes('F0-G2') && e.includes('pending')));
});

// C2#2 — GATE-R2 must not be splittable across the plan↔initiative mirror.
// checkMetInvariant gates evidence per-FILE; phase-done step 8b mirrors the exit
// gate into initiative.exitGates[]. An operator validating one file at a time
// (or a model stamping 'met' with evidence on only one surface) can leave the
// met-invariant divided between two files. crossValidate must co-validate the
// evidence, not just the status.
const EV = (passed, testsCollected) => ({ passed, ...(testsCollected != null ? { testsCollected } : {}) });

test('crossValidate: met criterion, deterministic verifier, matching evidence on BOTH → no error', () => {
  const plans = new Map([['p', {
    slug: 'p',
    phases: [{
      id: 'F0', slug: 'p-f0', status: 'done',
      exitGate: { criteria: [
        { id: 'F0-G1', status: 'met', verifier: { kind: 'test' }, evidence: EV(true, 11) },
      ] },
    }],
  }]]);
  const inits = new Map([['p-f0', {
    slug: 'p-f0', status: 'done',
    tasks: [{ id: 'T-001', status: 'done' }],
    exitGates: [{ id: 'F0-G1', status: 'met', verifier: { kind: 'test' }, evidence: EV(true, 11) }],
  }]]);
  const errors = crossValidate(plans, inits);
  assert.equal(errors.length, 0);
});

test('crossValidate: met criterion, evidence on initiative mirror ONLY → error (split invariant)', () => {
  const plans = new Map([['p', {
    slug: 'p',
    phases: [{
      id: 'F0', slug: 'p-f0', status: 'done',
      exitGate: { criteria: [
        { id: 'F0-G1', status: 'met', verifier: { kind: 'test' } },
      ] },
    }],
  }]]);
  const inits = new Map([['p-f0', {
    slug: 'p-f0', status: 'done',
    tasks: [{ id: 'T-001', status: 'done' }],
    exitGates: [{ id: 'F0-G1', status: 'met', verifier: { kind: 'test' }, evidence: EV(true, 11) }],
  }]]);
  const errors = crossValidate(plans, inits);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].errors.some((e) => e.includes('F0-G1') && /only one surface/.test(e)));
});

test('crossValidate: met criterion, contradicting evidence.passed across surfaces → error', () => {
  const plans = new Map([['p', {
    slug: 'p',
    phases: [{
      id: 'F0', slug: 'p-f0', status: 'done',
      exitGate: { criteria: [
        { id: 'F0-G1', status: 'met', verifier: { kind: 'shell' }, evidence: EV(true) },
      ] },
    }],
  }]]);
  const inits = new Map([['p-f0', {
    slug: 'p-f0', status: 'done',
    tasks: [{ id: 'T-001', status: 'done' }],
    exitGates: [{ id: 'F0-G1', status: 'met', verifier: { kind: 'shell' }, evidence: EV(false) }],
  }]]);
  const errors = crossValidate(plans, inits);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].errors.some((e) => e.includes('F0-G1') && /disagrees/.test(e)));
});

test('crossValidate: manual verifier (not deterministic) → no evidence cross-check', () => {
  const plans = new Map([['p', {
    slug: 'p',
    phases: [{
      id: 'F0', slug: 'p-f0', status: 'done',
      exitGate: { criteria: [
        { id: 'F0-G1', status: 'met', verifier: { kind: 'manual' }, evidence: EV(true) },
      ] },
    }],
  }]]);
  const inits = new Map([['p-f0', {
    slug: 'p-f0', status: 'done',
    tasks: [{ id: 'T-001', status: 'done' }],
    exitGates: [{ id: 'F0-G1', status: 'met', verifier: { kind: 'manual' } }],
  }]]);
  const errors = crossValidate(plans, inits);
  assert.equal(errors.length, 0);
});

test('crossValidate: pending phase + pending initiative → no cross-check', () => {
  const plans = new Map([['p', {
    slug: 'p',
    phases: [{
      id: 'F0', slug: 'p-f0', status: 'pending',
      exitGate: { criteria: [{ id: 'F0-G1', status: 'pending' }] },
    }],
  }]]);
  const inits = new Map([['p-f0', {
    slug: 'p-f0', status: 'pending',
    tasks: [{ id: 'T-001', status: 'pending' }],
    exitGates: [{ id: 'F0-G1', status: 'pending' }],
  }]]);
  const errors = crossValidate(plans, inits);
  assert.equal(errors.length, 0);
});

test('plan dependency validation: legacy plans without dependsOnPlans pass', () => {
  const plans = new Map([
    ['parent', { slug: 'parent', __projectId: 'proj', spawnedFrom: { plan: 'root', phaseId: 'F0', mode: 'pause' } }],
    ['child', { slug: 'child', __projectId: 'proj' }],
  ]);
  assert.deepEqual(collectPlanDependencyErrors(plans), []);
});

test('plan dependency validation rejects self-edge and orphan prerequisite', () => {
  const plans = new Map([
    ['parent', {
      slug: 'parent',
      __projectId: 'proj',
      dependsOnPlans: [
        { plan: 'parent', createdBy: 'manual' },
        { plan: 'missing', createdBy: 'manual' },
      ],
    }],
  ]);
  const errors = collectPlanDependencyErrors(plans);
  assert.equal(errors.length, 1);
  assert.match(errors[0].errors.join('\n'), /self-dependency/);
  assert.match(errors[0].errors.join('\n'), /unknown-prerequisite/);
});

test('plan dependency validation rejects direct and transitive cycles', () => {
  const direct = collectPlanDependencyErrors(new Map([
    ['a', { slug: 'a', __projectId: 'proj', dependsOnPlans: [{ plan: 'b', createdBy: 'manual' }] }],
    ['b', { slug: 'b', __projectId: 'proj', dependsOnPlans: [{ plan: 'a', createdBy: 'manual' }] }],
  ]));
  assert.match(direct[0].errors.join('\n'), /dependency-cycle/);
  assert.match(direct[0].errors.join('\n'), /a -> b -> a/);

  const transitive = collectPlanDependencyErrors(new Map([
    ['a', { slug: 'a', __projectId: 'proj', dependsOnPlans: [{ plan: 'b', createdBy: 'manual' }] }],
    ['b', { slug: 'b', __projectId: 'proj', dependsOnPlans: [{ plan: 'c', createdBy: 'manual' }] }],
    ['c', { slug: 'c', __projectId: 'proj', dependsOnPlans: [{ plan: 'a', createdBy: 'manual' }] }],
  ]));
  assert.match(transitive[0].errors.join('\n'), /dependency-cycle/);
  assert.match(transitive[0].errors.join('\n'), /a -> b -> c -> a/);
});

test('plan dependency validation rejects dependencies that resolve only in another project', () => {
  const plans = new Map([
    ['proj-a/parent', { slug: 'parent', __projectId: 'proj-a', dependsOnPlans: [{ plan: 'shared', createdBy: 'manual' }] }],
    ['proj-b/shared', { slug: 'shared', __projectId: 'proj-b' }],
  ]);
  const errors = collectPlanDependencyErrors(plans);
  assert.equal(errors.length, 1);
  assert.match(errors[0].errors.join('\n'), /cross-project-dependency/);
  assert.match(errors[0].errors.join('\n'), /proj-a/);
  assert.match(errors[0].errors.join('\n'), /proj-b/);
});

// ── R-XAGENT-08: kind inference for the nested projects/<id>/<slug>/ layout ──
// The nested layout is a *relocation* (Decision #9 / F-B3): plan.md validates
// against plan.schema.json, phases/fN-*.md against initiative.schema.json — no
// 4th content schema. These tests prove the new kindFromPath branches AND that
// the flat-tree walk is byte-unaffected (the live tree must keep validating
// during the dogfood window).

test('kind inference (nested): projects/<id>/<slug>/plan.md → plan and validates', () => {
  const validators = buildValidators();
  const content = readFileSync(join(FIXTURES, 'plans', 'v3-redesign.md'), 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'atomic-skills-nested-'));
  try {
    const planDir = join(dir, 'projects', 'atomic-skills', 'migration-self-host');
    mkdirSync(planDir, { recursive: true });
    const tmpFile = join(planDir, 'plan.md');
    writeFileSync(tmpFile, content);
    const result = validateFile(tmpFile, validators);
    assert.equal(result.kind, 'plan', 'plan.md under projects/*/*/ must infer kind=plan');
    assert.equal(result.ok, true, `nested plan.md must validate: ${JSON.stringify(result.errors)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('kind inference (nested): projects/<id>/<slug>/phases/fN-*.md → initiative and validates', () => {
  const validators = buildValidators();
  const content = readFileSync(join(FIXTURES, 'initiatives', 'v3-f0-foundation-repair.md'), 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'atomic-skills-nested-'));
  try {
    const phasesDir = join(dir, 'projects', 'atomic-skills', 'migration-self-host', 'phases');
    mkdirSync(phasesDir, { recursive: true });
    const tmpFile = join(phasesDir, 'f0-foundation-repair.md');
    writeFileSync(tmpFile, content);
    const result = validateFile(tmpFile, validators);
    assert.equal(result.kind, 'initiative', 'phases/fN-*.md must infer kind=initiative');
    assert.equal(result.ok, true, `nested phase initiative must validate: ${JSON.stringify(result.errors)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('kind inference (nested): archived phase under phases/archive/ → initiative', () => {
  const validators = buildValidators();
  const content = readFileSync(join(FIXTURES, 'initiatives', 'v3-f0-foundation-repair.md'), 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'atomic-skills-nested-'));
  try {
    const archiveDir = join(dir, 'projects', 'atomic-skills', 'migration-self-host', 'phases', 'archive');
    mkdirSync(archiveDir, { recursive: true });
    const tmpFile = join(archiveDir, 'f0-foundation-repair.md');
    writeFileSync(tmpFile, content);
    const result = validateFile(tmpFile, validators);
    assert.equal(result.kind, 'initiative', 'archived phase must still infer kind=initiative');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('kind inference (flat regression): flat plans/ + initiatives/ still infer correctly', () => {
  const validators = buildValidators();
  const planResult = validateFile(join(FIXTURES, 'plans', 'v3-redesign.md'), validators);
  assert.equal(planResult.kind, 'plan', 'flat plans/<slug>.md must still infer plan');
  const initResult = validateFile(join(FIXTURES, 'initiatives', 'v3-f0-foundation-repair.md'), validators);
  assert.equal(initResult.kind, 'initiative', 'flat initiatives/<slug>.md must still infer initiative');
});

test('kind inference: path under no recognised layout → kind null + named error', () => {
  const validators = buildValidators();
  const dir = mkdtempSync(join(tmpdir(), 'atomic-skills-nokind-'));
  try {
    const tmpFile = join(dir, 'random', 'notes.md');
    mkdirSync(dirname(tmpFile), { recursive: true });
    writeFileSync(tmpFile, '---\nslug: x\n---\n');
    const result = validateFile(tmpFile, validators);
    assert.equal(result.kind, null);
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /cannot infer kind/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('kind inference: a plain plan.md NOT under projects/ does not infer plan', () => {
  // Guard against the projects-check over-firing: plan.md must require a
  // `projects` ancestor, else it falls through to kind=null.
  const validators = buildValidators();
  const dir = mkdtempSync(join(tmpdir(), 'atomic-skills-nokind-'));
  try {
    const tmpFile = join(dir, 'docs', 'plan.md');
    mkdirSync(dirname(tmpFile), { recursive: true });
    writeFileSync(tmpFile, '---\nslug: x\n---\n');
    const result = validateFile(tmpFile, validators);
    assert.equal(result.kind, null, 'plan.md outside projects/ must not infer plan');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── F-B5 / F-B4: the 0.1 → 0.2 additive-optional schema bump ──
// Every 0.2 addition must be OPTIONAL (existing 0.1 files still validate) and
// guarded by additionalProperties:false (so the field must be declared, not
// just written). schemaVersion is an enum so 0.1 and 0.2 coexist during the
// copy-verify-delete window.

function baseInitiative(overrides = {}) {
  return {
    schemaVersion: '0.2',
    slug: 'demo-init', title: 'X', goal: 'a real goal', status: 'active', branch: null,
    started: '2026-06-01T00:00:00Z', lastUpdated: '2026-06-01T00:00:00Z',
    nextAction: null, exitGates: [], stack: [], tasks: [], parked: [], emerged: [],
    ...overrides,
  };
}

test('0.2: schemaVersion 0.1 and 0.2 both validate (coexistence)', () => {
  const validators = buildValidators();
  assert.equal(validators.validateInitiative(baseInitiative({ schemaVersion: '0.1' })), true,
    `0.1 must still validate: ${JSON.stringify(validators.validateInitiative.errors)}`);
  assert.equal(validators.validateInitiative(baseInitiative({ schemaVersion: '0.2' })), true,
    `0.2 must validate: ${JSON.stringify(validators.validateInitiative.errors)}`);
  assert.equal(validators.validateInitiative(baseInitiative({ schemaVersion: '0.3' })), false,
    '0.3 must be rejected by the enum');
});

test('0.2: task.evidence (F-B4) with mutation + testsCollected validates', () => {
  const validators = buildValidators();
  const init = baseInitiative({
    tasks: [{
      id: 'T-001', title: 't', status: 'done', lastUpdated: '2026-06-01T00:00:00Z',
      verifier: { kind: 'test', runner: 'node --test', pattern: 'tests/x.test.js' },
      evidence: {
        verifierKind: 'test', verifiedAt: '2026-06-01T00:00:00Z', passed: true,
        testsCollected: 12, outputSummary: '12 pass',
        mutation: {
          target: 'src/x.js:42', change: 'flip > to <',
          killedBy: ['x asserts boundary'], killTranscript: 'RED on mutate, GREEN on revert',
        },
      },
    }],
  });
  const ok = validators.validateInitiative(init);
  assert.equal(ok, true, `task.evidence 0.2 must validate: ${JSON.stringify(validators.validateInitiative.errors)}`);
});

test('0.2: task.evidence reuses the exitCriterion.evidence shape (verifierKind required)', () => {
  const validators = buildValidators();
  const init = baseInitiative({
    tasks: [{
      id: 'T-001', title: 't', status: 'done', lastUpdated: '2026-06-01T00:00:00Z',
      evidence: { passed: true },  // missing verifierKind + verifiedAt — same shape as exitCriterion
    }],
  });
  assert.equal(validators.validateInitiative(init), false, 'task.evidence must enforce the shared required fields');
  const errText = (validators.validateInitiative.errors || []).map((e) => e.message).join('; ');
  assert.match(errText, /verifierKind|verifiedAt/);
});

test('0.2: kind:manual gains optional demo/acceptance fields; prose-only manual still validates', () => {
  const validators = buildValidators();
  const withFields = baseInitiative({
    exitGates: [{
      id: 'G1', description: 'demo works', status: 'pending',
      verifier: {
        kind: 'manual', description: 'user confirms',
        demoCommand: 'npm run demo', fallbackKind: 'ui',
        steps: ['open page'], expected: ['renders'], data: 'seed=1',
      },
    }],
  });
  assert.equal(validators.validateInitiative(withFields), true,
    `manual 0.2 fields must validate: ${JSON.stringify(validators.validateInitiative.errors)}`);
  const proseOnly = baseInitiative({
    exitGates: [{ id: 'G1', description: 'm', status: 'pending', verifier: { kind: 'manual', description: 'visual review' } }],
  });
  assert.equal(validators.validateInitiative(proseOnly), true, 'prose-only manual verifier must still validate');
  const badFallback = baseInitiative({
    exitGates: [{ id: 'G1', description: 'm', status: 'pending', verifier: { kind: 'manual', description: 'x', fallbackKind: 'gui' } }],
  });
  assert.equal(validators.validateInitiative(badFallback), false, 'fallbackKind must be constrained to the enum');
});

test('0.2: unknown evidence field still rejected (additionalProperties:false intact)', () => {
  const validators = buildValidators();
  const init = baseInitiative({
    exitGates: [{
      id: 'G1', description: 'd', status: 'met', metAt: '2026-06-01T00:00:00Z',
      verifier: { kind: 'shell', command: 'true', expectExitCode: 0 },
      evidence: { verifierKind: 'shell', verifiedAt: '2026-06-01T00:00:00Z', passed: true, bogus: 1 },
    }],
  });
  assert.equal(validators.validateInitiative(init), false, 'additionalProperties:false must reject unknown evidence fields');
});

// ── GATE-R2: the met-invariant + R-XAGENT-07 paranoid false-green REDs ──
// checkMetInvariant is the one place a markdown "passed" claim becomes
// non-self-graded. These prove the three false-green guards plus the
// not-gated cases (manual / verifier-absent) and the task-level (F-B4) path.

const metGate = (verifier, evidence) =>
  baseInitiative({ exitGates: [{ id: 'G1', description: 'd', status: 'met', metAt: '2026-06-01T00:00:00Z', verifier, evidence }] });

test('GATE-R2 RED (a): non-zero exit ≠ met — shell verifier with evidence.passed:false', () => {
  const fm = metGate(
    { kind: 'shell', command: 'npm test', expectExitCode: 0 },
    { verifierKind: 'shell', verifiedAt: '2026-06-01T00:00:00Z', passed: false, exitCode: 1, outputSummary: '1 failing' },
  );
  const v = checkMetInvariant(fm);
  assert.ok(v.length >= 1, 'a met shell criterion with passed:false must violate');
  assert.match(v.join('\n'), /passed is not true/);
});

test('GATE-R2 RED (b): 0 tests collected ≠ met — test verifier with testsCollected:0', () => {
  const fm = metGate(
    { kind: 'test', runner: 'node --test', pattern: 'tests/none.test.js' },
    { verifierKind: 'test', verifiedAt: '2026-06-01T00:00:00Z', passed: true, testsCollected: 0, outputSummary: '0 tests' },
  );
  const v = checkMetInvariant(fm);
  assert.ok(v.length >= 1, 'a met test criterion that collected 0 tests must violate even with passed:true');
  assert.match(v.join('\n'), /testsCollected > 0/);
});

test('GATE-R2 RED (b2): missing testsCollected ≠ met (test verifier)', () => {
  const fm = metGate(
    { kind: 'test', runner: 'node --test', pattern: 'tests/x.test.js' },
    { verifierKind: 'test', verifiedAt: '2026-06-01T00:00:00Z', passed: true, outputSummary: 'green' },
  );
  assert.match(checkMetInvariant(fm).join('\n'), /testsCollected > 0/);
});

test('GATE-R2 RED (c): runner-not-found ≠ met — met with a verifier but NO evidence block', () => {
  const fm = metGate({ kind: 'test', runner: 'jest', pattern: 'x' }, undefined);
  const v = checkMetInvariant(fm);
  assert.ok(v.length >= 1, 'a met criterion with a verifier and no evidence must violate');
  assert.match(v.join('\n'), /NO evidence block/);
});

test('GATE-R2 RED (query): kind:query met without a numeric rowCount', () => {
  const fm = metGate(
    { kind: 'query', sql: 'SELECT count(*)', expectRowCount: 0 },
    { verifierKind: 'query', verifiedAt: '2026-06-01T00:00:00Z', passed: true, outputSummary: 'ran' },
  );
  assert.match(checkMetInvariant(fm).join('\n'), /numeric evidence.rowCount/);
});

test('GATE-R2 GREEN: met with passed:true + (test) testsCollected>0 → no violation', () => {
  const shellOk = metGate(
    { kind: 'shell', command: 'true', expectExitCode: 0 },
    { verifierKind: 'shell', verifiedAt: '2026-06-01T00:00:00Z', passed: true, exitCode: 0 },
  );
  assert.deepEqual(checkMetInvariant(shellOk), []);
  const testOk = metGate(
    { kind: 'test', runner: 'node --test', pattern: 'tests/x.test.js' },
    { verifierKind: 'test', verifiedAt: '2026-06-01T00:00:00Z', passed: true, testsCollected: 12 },
  );
  assert.deepEqual(checkMetInvariant(testOk), []);
  const queryOk = metGate(
    { kind: 'query', sql: 'SELECT 1', expectRowCount: 0 },
    { verifierKind: 'query', verifiedAt: '2026-06-01T00:00:00Z', passed: true, rowCount: 0 },
  );
  assert.deepEqual(checkMetInvariant(queryOk), []);
});

test('GATE-R2: manual verifier and verifier-absent met criteria are NOT gated', () => {
  const manual = metGate({ kind: 'manual', description: 'visual review' }, undefined);
  assert.deepEqual(checkMetInvariant(manual), [], 'manual met without evidence must be allowed (user-override / manual gate)');
  const noVerifier = baseInitiative({ exitGates: [{ id: 'G1', description: 'd', status: 'met', metAt: '2026-06-01T00:00:00Z' }] });
  assert.deepEqual(checkMetInvariant(noVerifier), [], 'a met criterion with no verifier is not gated by GATE-R2');
});

test('GATE-R2: pending/deferred criteria are never gated', () => {
  const pending = baseInitiative({ exitGates: [{ id: 'G1', description: 'd', status: 'pending', verifier: { kind: 'test', runner: 'x', pattern: 'y' } }] });
  assert.deepEqual(checkMetInvariant(pending), []);
  const deferred = baseInitiative({ exitGates: [{ id: 'G1', description: 'd', status: 'deferred', deferredReason: 'no DB', verifier: { kind: 'query', sql: 'x' } }] });
  assert.deepEqual(checkMetInvariant(deferred), []);
});

test('GATE-R2 (F-B4 task level): done task with a verifier but no evidence violates; with evidence passes', () => {
  const bad = baseInitiative({
    tasks: [{ id: 'T-001', title: 't', status: 'done', lastUpdated: '2026-06-01T00:00:00Z', verifier: { kind: 'shell', command: 'true' } }],
  });
  assert.match(checkMetInvariant(bad).join('\n'), /task T-001/);
  const good = baseInitiative({
    tasks: [{
      id: 'T-001', title: 't', status: 'done', lastUpdated: '2026-06-01T00:00:00Z',
      verifier: { kind: 'shell', command: 'true' },
      evidence: { verifierKind: 'shell', verifiedAt: '2026-06-01T00:00:00Z', passed: true, exitCode: 0 },
    }],
  });
  assert.deepEqual(checkMetInvariant(good), []);
});

test('GATE-R2 (plan level): met phase criterion with a verifier but no evidence violates', () => {
  const plan = {
    schemaVersion: '0.2', slug: 'p', title: 'P',
    phases: [{ id: 'F0', slug: 'p-f0', status: 'done', exitGate: { criteria: [
      { id: 'F0-G1', description: 'tests pass', status: 'met', verifier: { kind: 'test', runner: 'node --test', pattern: 'x' } },
    ] } }],
  };
  assert.match(checkMetInvariant(plan).join('\n'), /phase F0 criterion F0-G1/);
});

// checkReviewGate (GATE-R3): the review-code phase gate is a hard precondition
// for closing a phase. A 'done' phase carrying a reviewGate block must be HONEST
// — a 'passed' claim needs an `at` sha anchor; a 'skipped' needs a `reason`.
// Like GATE-R2, the conditional lives in JS (not the schema) to keep the aiDeck
// mirror additive; an ABSENT block on a legacy 'done' phase is tolerated.

const donePlan = (reviewGate) => ({
  schemaVersion: '0.2', slug: 'p', title: 'P',
  phases: [{ id: 'F0', slug: 'p-f0', status: 'done', exitGate: { criteria: [] }, ...(reviewGate ? { reviewGate } : {}) }],
});

test('GATE-R3 RED (a): done phase with reviewGate status:passed but NO `at` sha violates', () => {
  const v = checkReviewGate(donePlan({ status: 'passed' }));
  assert.ok(v.length >= 1, 'a passed review claim with no reviewed-sha anchor must violate');
  assert.match(v.join('\n'), /phase F0/);
  assert.match(v.join('\n'), /at/);
});

test('GATE-R3 RED (b): done phase with reviewGate status:skipped but NO reason violates', () => {
  const v = checkReviewGate(donePlan({ status: 'skipped' }));
  assert.ok(v.length >= 1, 'a skipped review with no reason must violate');
  assert.match(v.join('\n'), /reason/);
});

test('GATE-R3 GREEN: passed+at and skipped+reason both pass', () => {
  assert.deepEqual(checkReviewGate(donePlan({ status: 'passed', at: 'a3f1c2d', mode: 'both' })), []);
  assert.deepEqual(checkReviewGate(donePlan({ status: 'skipped', reason: 'docs-only phase, no code diff' })), []);
});

test('GATE-R3: a done phase with NO reviewGate block is TOLERATED (legacy / GATE-R2-consistent)', () => {
  assert.deepEqual(checkReviewGate(donePlan(undefined)), [], 'absent reviewGate on a done phase is not hard-failed');
});

test('GATE-R3: a non-done phase is never gated even with a malformed reviewGate', () => {
  const plan = {
    schemaVersion: '0.2', slug: 'p', title: 'P',
    phases: [{ id: 'F0', slug: 'p-f0', status: 'active', exitGate: { criteria: [] }, reviewGate: { status: 'passed' } }],
  };
  assert.deepEqual(checkReviewGate(plan), [], 'only a DONE phase is gated on review honesty');
});

test('GATE-R3 wiring: validateFile REJECTS a schema-valid plan whose done phase claims passed without an `at`', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atomic-skills-r3-'));
  try {
    const planDir = join(dir, 'projects', 'atomic-skills', 'sample');
    mkdirSync(planDir, { recursive: true });
    const plan = {
      schemaVersion: '0.2', slug: 'sample', title: 'Sample', version: '1', status: 'active',
      started: '2026-06-01T00:00:00Z', lastUpdated: '2026-06-01T00:00:00Z',
      currentPhase: 'F0', parallelismAllowed: false,
      phases: [{
        id: 'F0', slug: 'sample-f0', title: 'F0', goal: 'do a thing', dependsOn: [], subPhaseCount: 0,
        status: 'done', exitGate: { summary: 's', criteria: [] },
        reviewGate: { status: 'passed' }, // dishonest: passed with no `at` anchor
      }],
    };
    const planMd = join(planDir, 'plan.md');
    writeFileSync(planMd, `---\n${stringifyYaml(plan).trimEnd()}\n---\n`);
    const validators = buildValidators();
    const result = validateFile(planMd, validators);
    assert.equal(result.ok, false, 'GATE-R3 must reject a passed-without-anchor done phase even when the schema passes');
    assert.match(result.errors.join('\n'), /at/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Lessons file (Spec 2 / G1): a per-initiative lessons file under
// projects/<id>/<slug>/lessons/<initiative-slug>.md. validate-state must infer
// the 'lesson' kind, validate against lesson.schema.json, and collect it.

const baseLessonFile = (overrides = {}) => ({
  schemaVersion: '0.2', slug: 'alpha-f1', projectId: 'proj', parentPlan: 'alpha',
  lessons: [
    {
      id: 'L-001',
      statement: 'decommission checked code refs but not data in polymorphic columns',
      corrective: 'for any drop/decommission, scan polymorphic/FK/enum columns for value-refs and decide disposition before deleting',
      scope: 'reusable', appliesTo: [], status: 'open', confidence: 2,
      createdAt: '2026-06-15T00:00:00Z',
    },
  ],
  ...overrides,
});

test('lesson schema: a well-formed lessons file validates', () => {
  const validators = buildValidators();
  assert.equal(validators.validateLesson(baseLessonFile()), true,
    `valid lessons file must pass: ${JSON.stringify(validators.validateLesson.errors)}`);
});

test('lesson schema: a lesson missing `corrective` (locus+fix) fails', () => {
  const validators = buildValidators();
  const bad = baseLessonFile({ lessons: [{ id: 'L-001', statement: 'something went wrong here', scope: 'reusable', status: 'open', confidence: 2, createdAt: '2026-06-15T00:00:00Z' }] });
  assert.equal(validators.validateLesson(bad), false, 'a lesson without a corrective action must fail (Self-Refine actionable shape)');
});

test('lesson schema: an unknown lesson field is rejected (additionalProperties:false)', () => {
  const validators = buildValidators();
  const bad = baseLessonFile();
  bad.lessons[0].madeUpField = true;
  assert.equal(validators.validateLesson(bad), false);
});

test('kind inference (nested): projects/<id>/<slug>/lessons/<init>.md → lesson and validates', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atomic-skills-lesson-'));
  try {
    const lessonMd = join(dir, 'projects', 'proj', 'alpha', 'lessons', 'alpha-f1.md');
    mkdirSync(dirname(lessonMd), { recursive: true });
    writeFileSync(lessonMd, `---\n${stringifyYaml(baseLessonFile()).trimEnd()}\n---\n`);
    const validators = buildValidators();
    const result = validateFile(lessonMd, validators);
    assert.equal(result.kind, 'lesson', `expected kind 'lesson', got '${result.kind}'`);
    assert.equal(result.ok, true, `lessons file must validate: ${result.errors.join('; ')}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('collectTargets: a dir arg also walks projects/<id>/<slug>/lessons/', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atomic-skills-lesson-collect-'));
  try {
    const planDir = join(dir, 'projects', 'proj', 'alpha');
    mkdirSync(join(planDir, 'lessons'), { recursive: true });
    writeFileSync(join(planDir, 'plan.md'), '---\nslug: alpha\n---\n');
    writeFileSync(join(planDir, 'lessons', 'alpha-f1.md'), `---\n${stringifyYaml(baseLessonFile()).trimEnd()}\n---\n`);
    const found = collectTargets([dir]).map((p) => p.split('/').slice(-2).join('/'));
    assert.ok(found.includes('lessons/alpha-f1.md'), `lessons file not collected: ${found.join(', ')}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('collectTargets (Inc2 R-XAGENT-05): a dir arg walks BOTH flat and nested projects/*/*/ layouts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atomic-skills-collect-'));
  try {
    // flat
    mkdirSync(join(dir, 'plans'), { recursive: true });
    writeFileSync(join(dir, 'plans', 'flatplan.md'), '---\nslug: flatplan\n---\n');
    mkdirSync(join(dir, 'initiatives', 'archive'), { recursive: true });
    writeFileSync(join(dir, 'initiatives', 'flatinit.md'), '---\nslug: flatinit\n---\n');
    writeFileSync(join(dir, 'initiatives', 'archive', 'oldinit.md'), '---\nslug: oldinit\n---\n');
    // nested
    const planDir = join(dir, 'projects', 'atomic-skills', 'sample');
    mkdirSync(join(planDir, 'phases', 'archive'), { recursive: true });
    writeFileSync(join(planDir, 'plan.md'), '---\nslug: sample\n---\n');
    writeFileSync(join(planDir, 'phases', 'f0-foundation.md'), '---\nslug: sample-f0\n---\n');
    writeFileSync(join(planDir, 'phases', 'archive', 'f0-old.md'), '---\nslug: sample-f0-old\n---\n');

    const found = collectTargets([dir]).map((p) => p.split('/').slice(-2).join('/'));
    // flat still found
    assert.ok(found.includes('plans/flatplan.md'));
    assert.ok(found.includes('initiatives/flatinit.md'));
    assert.ok(found.includes('archive/oldinit.md'));
    // nested now found
    assert.ok(found.includes('sample/plan.md'), `nested plan.md not collected: ${found.join(', ')}`);
    assert.ok(found.includes('phases/f0-foundation.md'), 'nested phase not collected');
    assert.ok(found.includes('archive/f0-old.md'), 'nested archived phase not collected');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('GATE-R2 wiring: validateFile REJECTS a schema-valid file whose met criterion lacks evidence', () => {
  const validators = buildValidators();
  const fm = metGate(
    { kind: 'test', runner: 'node --test', pattern: 'tests/x.test.js' },
    undefined,
  );
  const dir = mkdtempSync(join(tmpdir(), 'atomic-skills-gater2-'));
  try {
    mkdirSync(join(dir, 'initiatives'), { recursive: true });
    const file = join(dir, 'initiatives', 'fabricated-met.md');
    writeFileSync(file, `---\n${stringifyYaml(fm)}---\n# body\n`);
    const result = validateFile(file, validators);
    assert.equal(result.ok, false, 'a fabricated-met file must FAIL validateFile via GATE-R2 even though its schema is valid');
    assert.match(result.errors.join('\n'), /NO evidence block/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// R-XAGENT-10 / R-EXEC-41 — Mode 2 routing config (status/routing.json)
// ---------------------------------------------------------------------------

/** Write a routing.json under <root>/status/ and return the file path. */
function writeRouting(root, config) {
  const statusDir = join(root, 'status');
  mkdirSync(statusDir, { recursive: true });
  const p = join(statusDir, 'routing.json');
  writeFileSync(p, typeof config === 'string' ? config : JSON.stringify(config, null, 2));
  return p;
}

test('routing: empty object {} is valid (all defaults ⇒ Mode-1)', () => {
  const validators = buildValidators();
  const dir = mkdtempSync(join(tmpdir(), 'routing-'));
  try {
    const p = writeRouting(dir, {});
    const result = validateRouting(p, validators);
    assert.equal(result.ok, true, result.errors.join('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('routing: a fully-specified enabled config validates', () => {
  const validators = buildValidators();
  const dir = mkdtempSync(join(tmpdir(), 'routing-'));
  try {
    const p = writeRouting(dir, {
      mode2Enabled: true,
      tierMap: { cheap: 'claude-haiku-4-5', standard: 'claude-sonnet-4-6' },
      codexLane: { enabled: true, model: 'gpt-5-codex', timeoutSeconds: 600, sandbox: 'workspace-write' },
      thresholds: { minBatchTasks: 3, requireDeterministicVerifier: true },
      ideOverrides: { gemini: { subagentExecutor: false } },
    });
    const result = validateRouting(p, validators);
    assert.equal(result.ok, true, result.errors.join('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('routing: Opus is REJECTED as an executor tier target (R-EXEC-41)', () => {
  const validators = buildValidators();
  const dir = mkdtempSync(join(tmpdir(), 'routing-'));
  try {
    const p = writeRouting(dir, { tierMap: { cheap: 'claude-opus-4-8' } });
    const result = validateRouting(p, validators);
    assert.equal(result.ok, false, 'a tierMap value naming an Opus model must be rejected');
    assert.match(result.errors.join('\n'), /tierMap\/cheap/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('routing: Opus rejected case-insensitively (Opus / OPUS)', () => {
  const validators = buildValidators();
  const dir = mkdtempSync(join(tmpdir(), 'routing-'));
  try {
    for (const name of ['Opus-X', 'OPUS', 'claude-OPUS-4']) {
      const p = writeRouting(dir, { tierMap: { standard: name } });
      const result = validateRouting(p, validators);
      assert.equal(result.ok, false, `'${name}' must be rejected as an executor target`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('routing: codexLane.sandbox is locked to "workspace-write"', () => {
  const validators = buildValidators();
  const dir = mkdtempSync(join(tmpdir(), 'routing-'));
  try {
    const p = writeRouting(dir, { codexLane: { sandbox: 'read-only' } });
    const result = validateRouting(p, validators);
    assert.equal(result.ok, false, 'sandbox other than workspace-write must be rejected');
    assert.match(result.errors.join('\n'), /sandbox/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('routing: unknown top-level keys are rejected (additionalProperties:false)', () => {
  const validators = buildValidators();
  const dir = mkdtempSync(join(tmpdir(), 'routing-'));
  try {
    const p = writeRouting(dir, { costPerToken: 0.003 });
    const result = validateRouting(p, validators);
    assert.equal(result.ok, false, '$/token framing has no field by design; unknown keys rejected');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('routing: wrong types are rejected', () => {
  const validators = buildValidators();
  const dir = mkdtempSync(join(tmpdir(), 'routing-'));
  try {
    const p = writeRouting(dir, { mode2Enabled: 'yes', thresholds: { minBatchTasks: 0 } });
    const result = validateRouting(p, validators);
    assert.equal(result.ok, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('routing: malformed JSON is a HARD failure, not a silent Mode-1 fallback', () => {
  const validators = buildValidators();
  const dir = mkdtempSync(join(tmpdir(), 'routing-'));
  try {
    const p = writeRouting(dir, '{ "mode2Enabled": true, ');
    const result = validateRouting(p, validators);
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /JSON parse error/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('routing: collectRoutingConfigs finds status/routing.json under a dir arg, ignores absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'routing-'));
  const dirNoConfig = mkdtempSync(join(tmpdir(), 'routing-'));
  try {
    const p = writeRouting(dir, {});
    const found = collectRoutingConfigs([dir, dirNoConfig]);
    assert.deepEqual(found, [p], 'only the dir with a config yields a path; absent config is not an error');
    // file args are not state roots
    assert.deepEqual(collectRoutingConfigs([p]), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(dirNoConfig, { recursive: true, force: true });
  }
});

// --- closedAt forward-only hard-gate (F4/T-003) -----------------------------

test('checkClosedAtHardening: non-grandfathered done task without closedAt → violation', () => {
  const init = { phaseId: 'F4', tasks: [{ id: 'T-005', status: 'done' }] };
  const v = checkClosedAtHardening(init, new Set());
  assert.equal(v.length, 1);
  assert.ok(v[0].includes('T-005'));
  assert.ok(v[0].includes('closedAt'));
});

test('checkClosedAtHardening: grandfathered (phase-scoped) done task without closedAt → no violation', () => {
  const init = { phaseId: 'F4', tasks: [{ id: 'T-005', status: 'done' }] };
  assert.deepEqual(checkClosedAtHardening(init, new Set(['F4/T-005'])), []);
});

test('checkClosedAtHardening: a SAME-id grandfather from ANOTHER phase does NOT exempt this phase', () => {
  // F0/T-001 grandfathered; this is F1/T-001 (new) → must still be gated (the F-001 bug).
  const init = { phaseId: 'F1', tasks: [{ id: 'T-001', status: 'done' }] };
  const v = checkClosedAtHardening(init, new Set(['F0/T-001']));
  assert.equal(v.length, 1);
  assert.ok(v[0].includes('T-001'));
});

test('checkClosedAtHardening: done task WITH closedAt → no violation', () => {
  const init = { phaseId: 'F4', tasks: [{ id: 'T-005', status: 'done', closedAt: '2026-06-19T10:00:00Z' }] };
  assert.deepEqual(checkClosedAtHardening(init, new Set()), []);
});

test('checkClosedAtHardening: pending task without closedAt → no violation', () => {
  const init = { phaseId: 'F4', tasks: [{ id: 'T-005', status: 'pending' }] };
  assert.deepEqual(checkClosedAtHardening(init, new Set()), []);
});

test('checkClosedAtHardening: accepts a plain array of phase-scoped grandfathered keys', () => {
  const init = { phaseId: 'F4', tasks: [{ id: 'T-005', status: 'done' }, { id: 'T-006', status: 'done' }] };
  assert.deepEqual(checkClosedAtHardening(init, ['F4/T-005', 'F4/T-006']), []);
});

test('crossValidate: plan with closedAtHardening + non-grandfathered done task missing closedAt → error', () => {
  const plans = new Map([['p', {
    slug: 'p',
    closedAtHardening: { enforcedFrom: '2026-06-19T19:00:00Z', grandfatheredTaskIds: ['F4/T-002'] },
    phases: [{ id: 'F4', slug: 'p-f4', status: 'active' }],
  }]]);
  const inits = new Map([['p-f4', {
    slug: 'p-f4', parentPlan: 'p', phaseId: 'F4', status: 'active',
    tasks: [
      { id: 'T-002', status: 'done' },                                  // grandfathered (F4/T-002) → ok
      { id: 'T-003', status: 'done', closedAt: '2026-06-19T20:00:00Z' }, // has closedAt → ok
      { id: 'T-004', status: 'done' },                                  // NEW done, no closedAt → violation
    ],
  }]]);
  const errors = crossValidate(plans, inits);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].initiativeSlug, 'p-f4');
  assert.ok(errors[0].errors.some((e) => e.includes('T-004')));
  assert.ok(!errors[0].errors.some((e) => e.includes('T-002')));
  assert.ok(!errors[0].errors.some((e) => e.includes('T-003')));
});

test('crossValidate: plan WITHOUT closedAtHardening → soft (no closedAt error)', () => {
  const plans = new Map([['p', {
    slug: 'p',
    phases: [{ id: 'F4', slug: 'p-f4', status: 'active' }],
  }]]);
  const inits = new Map([['p-f4', {
    slug: 'p-f4', parentPlan: 'p', phaseId: 'F4', status: 'active',
    tasks: [{ id: 'T-004', status: 'done' }], // no closedAt, but no hardening → not gated
  }]]);
  assert.equal(crossValidate(plans, inits).length, 0);
});

test('crossValidate: closedAtHardening does not scan same-slug initiatives from another project', () => {
  const plans = new Map([
    ['proj-a/p', {
      slug: 'p',
      __projectId: 'proj-a',
      closedAtHardening: { enforcedFrom: '2026-06-19T19:00:00Z', grandfatheredTaskIds: [] },
      phases: [{ id: 'F4', slug: 'p-f4', status: 'active' }],
    }],
    ['proj-b/p', {
      slug: 'p',
      __projectId: 'proj-b',
      phases: [{ id: 'F4', slug: 'p-f4', status: 'active' }],
    }],
  ]);
  const inits = new Map([
    ['proj-a/p-f4', {
      slug: 'p-f4', __projectId: 'proj-a', parentPlan: 'p', phaseId: 'F4', status: 'active',
      tasks: [{ id: 'T-001', status: 'done', closedAt: '2026-06-19T20:00:00Z' }],
    }],
    ['proj-b/p-f4', {
      slug: 'p-f4', __projectId: 'proj-b', parentPlan: 'p', phaseId: 'F4', status: 'active',
      tasks: [{ id: 'T-002', status: 'done' }],
    }],
  ]);

  assert.deepEqual(crossValidate(plans, inits), []);
});
