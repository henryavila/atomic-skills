import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { parseFrontmatter, validateFile, crossValidate } from '../scripts/validate-state.js';
import Ajv from 'ajv/dist/2020.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const FIXTURES = join(REPO_ROOT, 'tests', 'fixtures', 'state');
const SCHEMA_DIR = join(REPO_ROOT, 'meta', 'schemas');

function buildValidators() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const name of ['common.schema.json', 'plan.schema.json', 'initiative.schema.json']) {
    const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, name), 'utf8'));
    ajv.addSchema(schema);
  }
  return {
    validatePlan: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/plan.schema.json'),
    validateInitiative: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/initiative.schema.json'),
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
  const tplPath = join(REPO_ROOT, 'skills', 'shared', 'project-status-assets', 'initiative.template.md');
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
  const tplPath = join(REPO_ROOT, 'skills', 'shared', 'project-status-assets', 'initiative.template.md');
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
  const tplPath = join(REPO_ROOT, 'skills', 'shared', 'project-status-assets', 'plan.template.md');
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

test('crossValidate: done phase + done initiative with done tasks → no errors', () => {
  const plans = new Map([['p', {
    slug: 'p',
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

test('crossValidate: done phase + no matching initiative → no errors (graceful skip)', () => {
  const plans = new Map([['p', {
    slug: 'p',
    phases: [{
      id: 'F0', slug: 'p-f0', status: 'done',
      exitGate: { criteria: [{ id: 'F0-G1', status: 'met' }] },
    }],
  }]]);
  const inits = new Map();
  const errors = crossValidate(plans, inits);
  assert.equal(errors.length, 0);
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
