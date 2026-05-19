import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { parseFrontmatter, validateFile } from '../scripts/validate-state.js';
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

test('valid plan fixture passes schema validation', () => {
  const validators = buildValidators();
  const result = validateFile(join(FIXTURES, 'plans', 'v3-redesign.md'), validators);
  assert.equal(result.ok, true, `expected ok, got errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.kind, 'plan');
});

test('valid initiative fixture passes schema validation', () => {
  const validators = buildValidators();
  const result = validateFile(join(FIXTURES, 'initiatives', 'v3-f0-foundation-repair.md'), validators);
  assert.equal(result.ok, true, `expected ok, got errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.kind, 'initiative');
});

test('v3-redesign plan has 9 phases (real sda-v2 shape)', () => {
  const raw = readFileSync(join(FIXTURES, 'plans', 'v3-redesign.md'), 'utf8');
  const { frontmatter } = parseFrontmatter(raw);
  assert.equal(frontmatter.phases.length, 9);
  assert.equal(frontmatter.phases[0].id, 'F0');
  assert.equal(frontmatter.phases[8].id, 'F8');
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
