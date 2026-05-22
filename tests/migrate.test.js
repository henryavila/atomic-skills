import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import { migrateLegacyInitiative, isMigratedPlaceholder } from '../src/migrate.js';
import { parseFrontmatter, validateFile } from '../scripts/validate-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const LEGACY_PATH = join(REPO_ROOT, 'tests', 'fixtures', 'state', 'legacy', 'initiatives', 'sample-legacy.md');
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

function loadLegacy() {
  const raw = readFileSync(LEGACY_PATH, 'utf8');
  const parsed = parseFrontmatter(raw);
  assert.equal(parsed.error, undefined);
  return { legacy: parsed.frontmatter, body: parsed.body };
}

test('migrates legacy fixture into a frontmatter that passes schema validation (standalone)', () => {
  const { legacy, body } = loadLegacy();
  const { migrated, frontmatter } = migrateLegacyInitiative(legacy, { nowIso: '2026-05-19T10:00:00Z' });
  assert.equal(migrated, true);

  // Write to temp file and run the full validator pipeline.
  const dir = mkdtempSync(join(tmpdir(), 'migrate-'));
  try {
    mkdirSync(join(dir, 'initiatives'), { recursive: true });
    const file = join(dir, 'initiatives', 'sample-legacy.md');
    writeFileSync(file, `---\n${stringifyYaml(frontmatter)}---\n${body}`);
    const validators = buildValidators();
    const result = validateFile(file, validators);
    assert.equal(result.ok, true, `migrated standalone initiative failed schema: ${JSON.stringify(result.errors)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('migrated standalone initiative has no parentPlan/phaseId', () => {
  const { legacy } = loadLegacy();
  const { frontmatter } = migrateLegacyInitiative(legacy);
  assert.equal(frontmatter.parentPlan, undefined);
  assert.equal(frontmatter.phaseId, undefined);
});

test('migrated in-plan initiative carries parentPlan + phaseId', () => {
  const { legacy } = loadLegacy();
  const { frontmatter } = migrateLegacyInitiative(legacy, { parentPlan: 'v3-redesign', phaseId: 'F0' });
  assert.equal(frontmatter.parentPlan, 'v3-redesign');
  assert.equal(frontmatter.phaseId, 'F0');
});

test('idempotency: running on an already-migrated frontmatter is a no-op', () => {
  const { legacy } = loadLegacy();
  const first = migrateLegacyInitiative(legacy, { nowIso: '2026-05-19T10:00:00Z' });
  const second = migrateLegacyInitiative(first.frontmatter);
  assert.equal(second.migrated, false);
  assert.deepStrictEqual(second.frontmatter, first.frontmatter);
});

test('throws on unsupported future schemaVersion', () => {
  assert.throws(
    () => migrateLegacyInitiative({ schemaVersion: '0.2', slug: 'foo' }),
    /unsupported schemaVersion/,
  );
});

test('throws when input has no initiative_id / slug', () => {
  assert.throws(
    () => migrateLegacyInitiative({ status: 'active' }),
    /no `initiative_id` or `slug`/,
  );
});

test('field mapping: initiative_id → slug, last_updated → lastUpdated, etc.', () => {
  const { legacy } = loadLegacy();
  const { frontmatter } = migrateLegacyInitiative(legacy, { nowIso: '2026-05-19T10:00:00Z' });
  assert.equal(frontmatter.slug, 'sample-legacy');
  assert.equal(frontmatter.lastUpdated, '2026-04-23T15:30:00Z');
  assert.equal(frontmatter.nextAction, 'Resume T-002: finish core impl');
  // legacy: started: 2026-04-01 (bare date) → normalized to ISO timestamp
  assert.equal(frontmatter.started, '2026-04-01T00:00:00Z');
});

test('scope_paths array → scope.paths', () => {
  const { legacy } = loadLegacy();
  const { frontmatter } = migrateLegacyInitiative(legacy);
  assert.deepEqual(frontmatter.scope, { paths: ['src/sample/**', 'tests/sample/**'] });
});

test('tasks map → tasks array; field mapping closed_at → closedAt, blocked_by → blockedBy', () => {
  const { legacy } = loadLegacy();
  const { frontmatter } = migrateLegacyInitiative(legacy);
  assert.ok(Array.isArray(frontmatter.tasks));
  assert.equal(frontmatter.tasks.length, 3);
  const t1 = frontmatter.tasks.find((t) => t.id === 'T-001');
  assert.equal(t1.status, 'done');
  assert.equal(t1.closedAt, '2026-04-10T09:00:00Z');
  assert.equal(t1.title, 'Set up scaffolding');
  const t3 = frontmatter.tasks.find((t) => t.id === 'T-003');
  assert.deepEqual(t3.blockedBy, ['T-002']);
});

test('stack frame field mapping: opened_at → openedAt, type initiative → task', () => {
  const { legacy } = loadLegacy();
  const { frontmatter } = migrateLegacyInitiative(legacy);
  assert.equal(frontmatter.stack.length, 2);
  assert.equal(frontmatter.stack[0].openedAt, '2026-04-01T10:00:00Z');
  // Legacy `type: initiative` is not in the new enum; mapped to `task`.
  assert.equal(frontmatter.stack[0].type, 'task');
  assert.equal(frontmatter.stack[1].type, 'research');
});

test('parked surfaced_at + from_frame mapped to camelCase', () => {
  const { legacy } = loadLegacy();
  const { frontmatter } = migrateLegacyInitiative(legacy);
  assert.equal(frontmatter.parked.length, 1);
  assert.equal(frontmatter.parked[0].surfacedAt, '2026-04-15T11:30:00Z');
  assert.equal(frontmatter.parked[0].fromFrame, 2);
});

test('emerged surfaced_at mapped to surfacedAt; promoted preserved', () => {
  const { legacy } = loadLegacy();
  const { frontmatter } = migrateLegacyInitiative(legacy);
  assert.equal(frontmatter.emerged.length, 1);
  assert.equal(frontmatter.emerged[0].surfacedAt, '2026-04-16T09:00:00Z');
  assert.equal(frontmatter.emerged[0].promoted, false);
});

test('plan_link (free-form) is folded into references[] not dropped', () => {
  const { legacy } = loadLegacy();
  const { frontmatter } = migrateLegacyInitiative(legacy);
  assert.ok(Array.isArray(frontmatter.references));
  const ref = frontmatter.references[0];
  assert.equal(ref.kind, 'file');
  assert.equal(ref.path, 'docs/plans/sample.md');
  assert.equal(ref.label, 'Planning doc (legacy plan_link)');
});

test('dropped fields (worktree, wip_limit) are absent in the output', () => {
  const { legacy } = loadLegacy();
  const { frontmatter } = migrateLegacyInitiative(legacy);
  assert.equal(frontmatter.worktree, undefined);
  assert.equal(frontmatter.wip_limit, undefined);
  assert.equal(frontmatter.plan_link, undefined);
});

test('all required 0.1 fields are populated', () => {
  const { legacy } = loadLegacy();
  const { frontmatter } = migrateLegacyInitiative(legacy);
  for (const key of [
    'schemaVersion', 'slug', 'title', 'goal', 'status', 'branch',
    'started', 'lastUpdated', 'nextAction', 'exitGates',
    'stack', 'tasks', 'parked', 'emerged',
  ]) {
    assert.notEqual(frontmatter[key], undefined, `required field missing: ${key}`);
  }
});

test('schemaVersion stamped to 0.1', () => {
  const { legacy } = loadLegacy();
  const { frontmatter } = migrateLegacyInitiative(legacy);
  assert.equal(frontmatter.schemaVersion, '0.1');
});

test('goal falls back to first stack frame title when legacy file has none', () => {
  const minimal = {
    initiative_id: 'mini',
    status: 'active',
    started: '2026-04-01',
    last_updated: '2026-04-01T10:00:00Z',
    stack: [{ id: 1, title: 'Mini work', type: 'initiative', opened_at: '2026-04-01T10:00:00Z' }],
    tasks: {},
    parked: [],
    emerged: [],
    next_action: 'Pick a real goal',
  };
  const { frontmatter } = migrateLegacyInitiative(minimal);
  assert.equal(frontmatter.goal, 'Mini work');
});

test('isMigratedPlaceholder detects placeholder from migrationContext', () => {
  const legacy = {
    initiative_id: 'demo',
    started: '2026-05-01',
    last_updated: '2026-05-01',
    stack: [{ id: 1, title: 'work', type: 'task', opened_at: '2026-05-01T00:00:00Z' }],
    parked: [{ title: 'sample', surfaced_at: '2026-05-01T00:00:00Z', from_frame: 1 }],
    emerged: [],
  };
  const result = migrateLegacyInitiative(legacy);
  assert.equal(isMigratedPlaceholder(result.frontmatter.parked[0].context), true);
});

test('isMigratedPlaceholder rejects ratified context', () => {
  assert.equal(
    isMigratedPlaceholder({
      solves: 'Real problem articulated by user.',
      trigger: 'Real trigger.',
      ratifiedAt: '2026-05-21T08:00:00Z',
    }),
    false,
  );
});

test('isMigratedPlaceholder rejects malformed input', () => {
  assert.equal(isMigratedPlaceholder(null), false);
  assert.equal(isMigratedPlaceholder({}), false);
  assert.equal(isMigratedPlaceholder({ solves: null }), false);
  assert.equal(isMigratedPlaceholder({ solves: 'not a placeholder' }), false);
});

test('isMigratedPlaceholder rejects user-edited solves that only matches the prefix', () => {
  // Regression for codex F-001: prefix-only detection misclassified legitimate
  // ratified content whose articulation happens to start with the prefix.
  assert.equal(
    isMigratedPlaceholder({
      solves: '(migrated from legacy schema) but this is my real explanation of why we kept it.',
      trigger: 'Real trigger after re-ratify.',
      ratifiedAt: '2026-05-22T08:00:00Z',
    }),
    false,
  );
});

test('isMigratedPlaceholder rejects solves that only matches the suffix', () => {
  // Symmetric to the prefix-only case — both anchors are required.
  assert.equal(
    isMigratedPlaceholder({
      solves: 'Operator must re-ratify to articulate the real problem this addresses.',
      trigger: 'Real trigger.',
      ratifiedAt: '2026-05-22T08:00:00Z',
    }),
    false,
  );
});

test('re-bootstrap idempotence: detector skips items already replaced', () => {
  // Simulates the post-re-bootstrap state: 1 item still placeholder (both
  // anchors present), 1 already ratified.
  const initiative = {
    parked: [
      { title: 'item A', context: { solves: '(migrated from legacy schema) Original parked entry — re-ratify to articulate the real problem this addresses.', trigger: '...', ratifiedAt: '2026-05-21T08:00:00Z' } },
      { title: 'item B', context: { solves: 'Real articulation by user', trigger: 'Real trigger', ratifiedAt: '2026-05-21T09:00:00Z' } },
    ],
  };
  const targets = initiative.parked.filter((p) => isMigratedPlaceholder(p.context));
  assert.equal(targets.length, 1);
  assert.equal(targets[0].title, 'item A');
});
