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
