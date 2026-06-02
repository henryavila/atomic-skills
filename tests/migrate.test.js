import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import { migrateLegacyInitiative, isMigratedPlaceholder, migrate01to02, planLayoutMigration } from '../src/migrate.js';
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

// ── F-B5: migrate01to02 — the one-shot 0.1 → 0.2 stamp ──
// The whole 0.2 delta is additive-optional, so the ONLY operation is stamping
// schemaVersion. No field backfill, no normalize-coercion.

test('migrate01to02: stamps 0.2 on a 0.1 entity and leaves every other field byte-identical', () => {
  const entity = {
    schemaVersion: '0.1', slug: 'demo-init', title: 'X', goal: 'real goal',
    status: 'active', branch: null, started: '2026-06-01T00:00:00Z',
    lastUpdated: '2026-06-01T00:00:00Z', nextAction: null,
    exitGates: [], stack: [], tasks: [], parked: [], emerged: [],
  };
  const { migrated, frontmatter } = migrate01to02(entity);
  assert.equal(migrated, true);
  assert.equal(frontmatter.schemaVersion, '0.2');
  // Everything except schemaVersion is unchanged (no backfill).
  assert.deepStrictEqual(
    { ...frontmatter, schemaVersion: undefined },
    { ...entity, schemaVersion: undefined },
    'migrate01to02 must change ONLY schemaVersion',
  );
  // Input not mutated (pure function).
  assert.equal(entity.schemaVersion, '0.1', 'input object must not be mutated');
});

test('migrate01to02: idempotent no-op when already 0.2', () => {
  const entity = { schemaVersion: '0.2', slug: 'demo-init', title: 'X' };
  const { migrated, frontmatter } = migrate01to02(entity);
  assert.equal(migrated, false);
  assert.equal(frontmatter, entity, 'no-op returns the same object reference');
});

test('migrate01to02: kind-agnostic — works on a plan-shaped object', () => {
  const plan = { schemaVersion: '0.1', slug: 'p', title: 'Plan', phases: [{ id: 'F0', slug: 'p-f0', status: 'pending' }] };
  const { migrated, frontmatter } = migrate01to02(plan);
  assert.equal(migrated, true);
  assert.equal(frontmatter.schemaVersion, '0.2');
  assert.deepStrictEqual(frontmatter.phases, plan.phases);
});

test('migrate01to02: throws on a legacy (no-version) file — must run migrateLegacyInitiative first', () => {
  assert.throws(() => migrate01to02({ slug: 'foo', status: 'active' }), /unsupported schemaVersion/);
});

test('migrate01to02: throws on an unsupported future version', () => {
  assert.throws(() => migrate01to02({ schemaVersion: '0.3', slug: 'foo' }), /unsupported schemaVersion/);
});

test('migrate01to02: throws on non-object input', () => {
  assert.throws(() => migrate01to02(null), /must be an object/);
  assert.throws(() => migrate01to02([1, 2]), /must be an object/);
});

test('migrate01to02: chains after legacy migration and the result still validates', () => {
  const { legacy, body } = loadLegacy();
  const v01 = migrateLegacyInitiative(legacy, { nowIso: '2026-05-19T10:00:00Z' });
  assert.equal(v01.frontmatter.schemaVersion, '0.1');
  const v02 = migrate01to02(v01.frontmatter);
  assert.equal(v02.frontmatter.schemaVersion, '0.2');

  const dir = mkdtempSync(join(tmpdir(), 'migrate0102-'));
  try {
    mkdirSync(join(dir, 'initiatives'), { recursive: true });
    const file = join(dir, 'initiatives', 'sample-legacy.md');
    writeFileSync(file, `---\n${stringifyYaml(v02.frontmatter)}---\n${body}`);
    const result = validateFile(file, buildValidators());
    assert.equal(result.ok, true, `migrated-to-0.2 initiative failed schema: ${JSON.stringify(result.errors)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── R-MIG-20: flat → nested LAYOUT migration (planLayoutMigration + migrate-layout.js) ──

const MIGRATE_LAYOUT = join(REPO_ROOT, 'scripts', 'migrate-layout.js');
const VALIDATE_STATE = join(REPO_ROOT, 'scripts', 'validate-state.js');

function planFm({ slug, phases, currentPhase, status = 'active' }) {
  return {
    schemaVersion: '0.1', slug, title: `Plan ${slug}`, version: '1.0', status,
    started: '2026-05-01T00:00:00Z', lastUpdated: '2026-05-02T00:00:00Z',
    currentPhase, parallelismAllowed: false, phases, references: [],
  };
}
function phaseDescriptor({ id, slug, status = 'pending', criteria = [] }) {
  return {
    id, slug, title: `Phase ${id}`, goal: `Goal for ${id}`, dependsOn: [], subPhaseCount: 0,
    exitGate: { summary: criteria.length ? `${criteria.length} criteria to meet` : 'no criteria', criteria }, status,
  };
}
function initFm({ slug, parentPlan, phaseId, status = 'active', tasks = [], exitGates = [] }) {
  const fm = {
    schemaVersion: '0.1', slug, title: `Init ${slug}`, goal: `Goal ${slug}`, status, branch: null,
    started: '2026-05-01T00:00:00Z', lastUpdated: '2026-05-02T00:00:00Z', nextAction: null,
    exitGates, stack: [{ id: 1, title: 'frame', type: 'task', openedAt: '2026-05-01T00:00:00Z' }],
    tasks, parked: [], emerged: [],
  };
  if (parentPlan) fm.parentPlan = parentPlan;
  if (phaseId) fm.phaseId = phaseId;
  return fm;
}
function writeUnit(stateDir, sub, fileSlug, fm, body = '# body\n') {
  const dir = join(stateDir, sub);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${fileSlug}.md`), `---\n${stringifyYaml(fm)}---\n\n${body}`);
}
function lastJsonLine(out) {
  const lines = out.trim().split('\n').filter(Boolean);
  return JSON.parse(lines[lines.length - 1]);
}

// — pure planner —

test('planLayoutMigration: multi-phase plan → plan.md + stripped phase filenames (verbatim copy)', () => {
  const units = {
    plans: [{ slug: 'demo', frontmatter: { slug: 'demo' }, body: '', sourceRel: 'plans/demo.md' }],
    initiatives: [
      { slug: 'demo-f0-alpha', frontmatter: { slug: 'demo-f0-alpha', parentPlan: 'demo', phaseId: 'F0' }, body: '', sourceRel: 'initiatives/demo-f0-alpha.md' },
      { slug: 'demo-f1-beta', frontmatter: { slug: 'demo-f1-beta', parentPlan: 'demo', phaseId: 'F1' }, body: '', sourceRel: 'initiatives/demo-f1-beta.md' },
    ],
  };
  const { outputs, deletes, orphans } = planLayoutMigration(units, { projectId: 'proj' });
  assert.deepEqual(orphans, []);
  const byTo = Object.fromEntries(outputs.map((o) => [o.relPath, o]));
  assert.equal(byTo['projects/proj/demo/plan.md']?.verbatim, true);
  assert.equal(byTo['projects/proj/demo/plan.md'].sourceRel, 'plans/demo.md');
  assert.equal(byTo['projects/proj/demo/phases/f0-alpha.md']?.verbatim, true);
  assert.equal(byTo['projects/proj/demo/phases/f1-beta.md']?.verbatim, true);
  assert.deepEqual([...deletes].sort(), ['initiatives/demo-f0-alpha.md', 'initiatives/demo-f1-beta.md', 'plans/demo.md']);
});

test('planLayoutMigration: orphan → degenerate 1-phase plan (phase slug == orphan slug; parentPlan+F0 added)', () => {
  const orphan = { slug: 'lone', title: 'Lone', goal: 'do', status: 'active', started: '2026-05-01T00:00:00Z', lastUpdated: '2026-05-02T00:00:00Z', exitGates: [{ id: 'G-1', description: 'x', status: 'pending' }], tasks: [] };
  const { outputs, orphans, deletes } = planLayoutMigration(
    { plans: [], initiatives: [{ slug: 'lone', frontmatter: orphan, body: 'B', sourceRel: 'initiatives/lone.md' }] },
    { projectId: 'proj' },
  );
  assert.deepEqual(orphans, ['lone']);
  const synth = outputs.find((o) => o.relPath === 'projects/proj/lone/plan.md');
  assert.equal(synth.verbatim, false);
  assert.equal(synth.frontmatter.currentPhase, 'F0');
  assert.equal(synth.frontmatter.phases.length, 1);
  assert.equal(synth.frontmatter.phases[0].slug, 'lone'); // crossValidate pairs phase↔init by slug
  assert.equal(synth.frontmatter.phases[0].id, 'F0');
  const phase = outputs.find((o) => o.relPath === 'projects/proj/lone/phases/lone.md');
  assert.equal(phase.frontmatter.parentPlan, 'lone');
  assert.equal(phase.frontmatter.phaseId, 'F0');
  assert.equal(phase.frontmatter.slug, 'lone'); // slug NEVER renamed
  assert.deepEqual(deletes, ['initiatives/lone.md']);
});

test('planLayoutMigration: requires projectId', () => {
  assert.throws(() => planLayoutMigration({ plans: [], initiatives: [] }, {}), /projectId is required/);
});

test('planLayoutMigration: idempotent — no flat units → empty plan', () => {
  const { outputs, deletes, orphans } = planLayoutMigration({ plans: [], initiatives: [] }, { projectId: 'proj' });
  assert.deepEqual(outputs, []);
  assert.deepEqual(deletes, []);
  assert.deepEqual(orphans, []);
});

test('planLayoutMigration: orphan slug colliding with a plan slug throws (no silent overwrite)', () => {
  assert.throws(() => planLayoutMigration({
    plans: [{ slug: 'x', frontmatter: { slug: 'x' }, body: '', sourceRel: 'plans/x.md' }],
    initiatives: [{ slug: 'x', frontmatter: { slug: 'x' /* no parentPlan → orphan */ }, body: '', sourceRel: 'initiatives/x.md' }],
  }, { projectId: 'proj' }), /collides with a flat plan/);
});

test('planLayoutMigration: initiative whose parentPlan is absent is migrated as an orphan + warns', () => {
  const { orphans, warnings } = planLayoutMigration({
    plans: [],
    initiatives: [{ slug: 'dangling', frontmatter: { slug: 'dangling', parentPlan: 'ghost' }, body: '', sourceRel: 'initiatives/dangling.md' }],
  }, { projectId: 'proj' });
  assert.deepEqual(orphans, ['dangling']);
  assert.ok(warnings.some((w) => w.includes("parentPlan 'ghost'")));
});

// — CLI executor: copy-verify-delete on a real temp tree (the acceptance) —

test('migrate-layout --apply: flat tree migrates to nested, validates, flat removed, idempotent re-run', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'layout-'));
  try {
    // A multi-phase plan with a DONE phase (exercises crossValidate through the move) + an orphan.
    writeUnit(stateDir, 'plans', 'mp', planFm({
      slug: 'mp', currentPhase: 'F0',
      phases: [
        phaseDescriptor({ id: 'F0', slug: 'mp-f0-alpha', status: 'done', criteria: [{ id: 'F0-G1', description: 'done gate', status: 'met' }] }),
        phaseDescriptor({ id: 'F1', slug: 'mp-f1-beta', status: 'pending' }),
      ],
    }));
    writeUnit(stateDir, 'initiatives', 'mp-f0-alpha', initFm({
      slug: 'mp-f0-alpha', parentPlan: 'mp', phaseId: 'F0', status: 'done',
      tasks: [{ id: 'T-1', title: 'done task', status: 'done', lastUpdated: '2026-05-02T00:00:00Z' }],
      exitGates: [{ id: 'F0-G1', description: 'done gate', status: 'met' }],
    }));
    writeUnit(stateDir, 'initiatives', 'mp-f1-beta', initFm({ slug: 'mp-f1-beta', parentPlan: 'mp', phaseId: 'F1', status: 'pending' }));
    writeUnit(stateDir, 'initiatives', 'lone', initFm({ slug: 'lone', status: 'active', exitGates: [{ id: 'G-1', description: 'x', status: 'pending' }] }));

    // The FLAT fixtures must validate first — else a fixture bug, not the migration, is the failure.
    execFileSync('node', [VALIDATE_STATE, stateDir], { stdio: 'pipe' });

    const res = lastJsonLine(execFileSync('node', [MIGRATE_LAYOUT, '--root', stateDir, '--project-id', 'tp', '--apply', '--json'], { encoding: 'utf8' }));
    assert.equal(res.migrated, true);
    assert.equal(res.finalValidateOk, true);

    for (const rel of ['projects/tp/mp/plan.md', 'projects/tp/mp/phases/f0-alpha.md', 'projects/tp/mp/phases/f1-beta.md', 'projects/tp/lone/plan.md', 'projects/tp/lone/phases/lone.md']) {
      assert.ok(existsSync(join(stateDir, rel)), `expected nested file ${rel}`);
    }
    assert.ok(!existsSync(join(stateDir, 'plans')), 'flat plans/ removed');
    assert.ok(!existsSync(join(stateDir, 'initiatives')), 'flat initiatives/ removed');

    // The whole migrated tree validates on its own.
    execFileSync('node', [VALIDATE_STATE, stateDir], { stdio: 'pipe' });

    // Re-running is a no-op (nothing flat left).
    const res2 = lastJsonLine(execFileSync('node', [MIGRATE_LAYOUT, '--root', stateDir, '--project-id', 'tp', '--apply', '--json'], { encoding: 'utf8' }));
    assert.equal(res2.migrated, false);
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test('migrate-layout --apply: a failed VERIFY aborts WITHOUT deleting the flat originals (data-safety)', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'layout-fail-'));
  try {
    // A structurally invalid plan (missing required `version`) → the verbatim nested
    // copy fails validate-state → the cut-over MUST abort before any delete.
    const bad = planFm({ slug: 'bad', currentPhase: 'F0', phases: [phaseDescriptor({ id: 'F0', slug: 'bad-f0', status: 'pending' })] });
    delete bad.version;
    writeUnit(stateDir, 'plans', 'bad', bad);
    writeUnit(stateDir, 'initiatives', 'bad-f0', initFm({ slug: 'bad-f0', parentPlan: 'bad', phaseId: 'F0' }));

    let threw = false;
    try {
      execFileSync('node', [MIGRATE_LAYOUT, '--root', stateDir, '--project-id', 'tp', '--apply', '--json'], { stdio: 'pipe' });
    } catch { threw = true; }
    assert.equal(threw, true, 'apply must exit non-zero when the migrated tree fails validation');

    // The invariant that matters: flat originals survive a failed verify.
    assert.ok(existsSync(join(stateDir, 'plans/bad.md')), 'flat plan must survive a failed verify');
    assert.ok(existsSync(join(stateDir, 'initiatives/bad-f0.md')), 'flat initiative must survive a failed verify');
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test('migrate-layout (dry-run default): writes nothing, reports the plan', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'layout-dry-'));
  try {
    writeUnit(stateDir, 'initiatives', 'solo', initFm({ slug: 'solo', status: 'active' }));
    const res = lastJsonLine(execFileSync('node', [MIGRATE_LAYOUT, '--root', stateDir, '--project-id', 'tp', '--json'], { encoding: 'utf8' }));
    assert.equal(res.migrated, false);
    assert.ok(!existsSync(join(stateDir, 'projects')), 'dry-run must not create projects/');
    assert.ok(existsSync(join(stateDir, 'initiatives/solo.md')), 'dry-run must not delete flat');
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
});

// ── Adversarial-review regression tests (Inc6 hardening) ──

test('planLayoutMigration: a pending orphan becomes a PAUSED plan (not active) with a pending phase (finding 8)', () => {
  const orphan = { slug: 'pend', title: 'P', goal: 'g', status: 'pending', started: '2026-05-01T00:00:00Z', lastUpdated: '2026-05-02T00:00:00Z', exitGates: [], tasks: [] };
  const { outputs } = planLayoutMigration({ plans: [], initiatives: [{ slug: 'pend', frontmatter: orphan, body: '', sourceRel: 'initiatives/pend.md' }] }, { projectId: 'proj' });
  const synth = outputs.find((o) => o.relPath === 'projects/proj/pend/plan.md');
  assert.equal(synth.frontmatter.status, 'paused', 'pending orphan must NOT become an active plan');
  assert.equal(synth.frontmatter.phases[0].status, 'pending');
});

test('planLayoutMigration: two flat plans sharing a slug throws — never a silent drop (finding 11)', () => {
  assert.throws(() => planLayoutMigration({
    plans: [
      { slug: 'dup', frontmatter: { slug: 'dup' }, body: '', sourceRel: 'plans/a.md' },
      { slug: 'dup', frontmatter: { slug: 'dup' }, body: '', sourceRel: 'plans/b.md' },
    ], initiatives: [],
  }, { projectId: 'proj' }), /two flat plan files share slug/);
});

test('planLayoutMigration: a reserved-word slug (phases/initiatives) is rejected (finding 10)', () => {
  assert.throws(() => planLayoutMigration({ plans: [{ slug: 'phases', frontmatter: { slug: 'phases' }, body: '', sourceRel: 'plans/phases.md' }], initiatives: [] }, { projectId: 'proj' }), /reserved slug/);
  assert.throws(() => planLayoutMigration({ plans: [], initiatives: [{ slug: 'initiatives', frontmatter: { slug: 'initiatives' }, body: '', sourceRel: 'initiatives/initiatives.md' }] }, { projectId: 'proj' }), /reserved slug/);
});

test('planLayoutMigration: orphan missing `started` still yields a schema-valid plan via nowIso fallback (finding 9)', () => {
  const orphan = { slug: 'nostart', title: 'N', goal: 'g', status: 'active', lastUpdated: '2026-05-02T00:00:00Z', exitGates: [], tasks: [] }; // no started
  const { outputs } = planLayoutMigration({ plans: [], initiatives: [{ slug: 'nostart', frontmatter: orphan, body: '', sourceRel: 'initiatives/nostart.md' }] }, { projectId: 'proj', nowIso: '2026-06-01T00:00:00Z' });
  const synth = outputs.find((o) => o.relPath === 'projects/proj/nostart/plan.md');
  assert.equal(synth.frontmatter.started, '2026-06-01T00:00:00Z');
});

test('planLayoutMigration: a plan declaring a phase with no initiative (flat or nested) is a blocker (finding 3)', () => {
  const plan = { slug: 'mp', phases: [{ id: 'F0', slug: 'mp-f0' }, { id: 'F1', slug: 'mp-f1' }] };
  // only F0 present as a flat phase init
  const { blockers } = planLayoutMigration({
    plans: [{ slug: 'mp', frontmatter: plan, body: '', sourceRel: 'plans/mp.md' }],
    initiatives: [{ slug: 'mp-f0', frontmatter: { slug: 'mp-f0', parentPlan: 'mp' }, body: '', sourceRel: 'initiatives/mp-f0.md' }],
  }, { projectId: 'proj' });
  assert.ok(blockers.some((b) => b.includes("phase F1") && b.includes('incomplete phase set')));
  // ...but an already-nested F1 covers it (recovery): no blocker
  const { blockers: b2 } = planLayoutMigration({
    plans: [{ slug: 'mp', frontmatter: plan, body: '', sourceRel: 'plans/mp.md' }],
    initiatives: [{ slug: 'mp-f0', frontmatter: { slug: 'mp-f0', parentPlan: 'mp' }, body: '', sourceRel: 'initiatives/mp-f0.md' }],
  }, { projectId: 'proj', existingPhaseSlugs: new Set(['mp-f1']) });
  assert.equal(b2.length, 0, 'an already-nested phase must satisfy coverage');
});

test('migrate-layout --apply: a flat file that does not parse BLOCKS apply (nothing written or deleted) (findings 1/2)', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'layout-skip-'));
  try {
    writeUnit(stateDir, 'initiatives', 'good', initFm({ slug: 'good', status: 'active' }));
    mkdirSync(join(stateDir, 'plans'), { recursive: true });
    writeFileSync(join(stateDir, 'plans', 'broken.md'), '---\nslug: broken\nno closing fence here\n# body'); // unparseable
    let threw = false;
    try { execFileSync('node', [MIGRATE_LAYOUT, '--root', stateDir, '--project-id', 'tp', '--apply', '--json'], { stdio: 'pipe' }); } catch { threw = true; }
    assert.equal(threw, true, 'apply must refuse when any flat file is unparseable');
    assert.ok(!existsSync(join(stateDir, 'projects')), 'nothing written when a flat unit is unreadable');
    assert.ok(existsSync(join(stateDir, 'plans/broken.md')), 'unparseable flat file preserved');
    assert.ok(existsSync(join(stateDir, 'initiatives/good.md')), 'sibling flat file preserved (no partial migration)');
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('migrate-layout --apply: a legacy nested projects/<id>/<slug>/initiative.md is ingested into a 1-phase plan (finding 14)', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'layout-nested-'));
  try {
    const dir = join(stateDir, 'projects', 'tp', 'mode2');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'initiative.md'), `---\n${stringifyYaml(initFm({ slug: 'mode2', status: 'pending' }))}---\n\n# m\n`);
    const res = lastJsonLine(execFileSync('node', [MIGRATE_LAYOUT, '--root', stateDir, '--project-id', 'tp', '--apply', '--json'], { encoding: 'utf8' }));
    assert.equal(res.migrated, true);
    assert.ok(existsSync(join(dir, 'plan.md')), 'synthesized plan.md in place');
    assert.ok(existsSync(join(dir, 'phases', 'mode2.md')), 'phase file in place');
    assert.ok(!existsSync(join(dir, 'initiative.md')), 'legacy initiative.md removed');
    execFileSync('node', [VALIDATE_STATE, stateDir], { stdio: 'pipe' }); // now collectable + valid
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('migrate-layout --apply: a nested initiative.md under a DIFFERENT project blocks apply, preserving it (finding 14)', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'layout-xproj-'));
  try {
    const dir = join(stateDir, 'projects', 'other', 'foo');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'initiative.md'), `---\n${stringifyYaml(initFm({ slug: 'foo', status: 'active' }))}---\n\n# f\n`);
    let threw = false;
    try { execFileSync('node', [MIGRATE_LAYOUT, '--root', stateDir, '--project-id', 'tp', '--apply', '--json'], { stdio: 'pipe' }); } catch { threw = true; }
    assert.equal(threw, true, 'cross-project nested initiative.md must block apply');
    assert.ok(existsSync(join(dir, 'initiative.md')), 'stray nested entity preserved (not stranded silently)');
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('migrate-layout --apply: recovery with the parent plan still flat does NOT spawn spurious standalone plans (finding 5)', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'layout-recover-'));
  try {
    // Simulate the reversed-delete-order crash state: phase F0 already migrated
    // (nested copy present, flat original gone), parent plan + F1 still flat.
    writeUnit(stateDir, 'plans', 'mp', planFm({ slug: 'mp', currentPhase: 'F0', phases: [
      phaseDescriptor({ id: 'F0', slug: 'mp-f0-alpha', status: 'done', criteria: [{ id: 'F0-G1', description: 'g', status: 'met' }] }),
      phaseDescriptor({ id: 'F1', slug: 'mp-f1-beta', status: 'pending' }),
    ] }));
    writeUnit(stateDir, 'initiatives', 'mp-f1-beta', initFm({ slug: 'mp-f1-beta', parentPlan: 'mp', phaseId: 'F1', status: 'pending' }));
    const ph = join(stateDir, 'projects', 'tp', 'mp', 'phases');
    mkdirSync(ph, { recursive: true });
    writeFileSync(join(ph, 'f0-alpha.md'), `---\n${stringifyYaml(initFm({ slug: 'mp-f0-alpha', parentPlan: 'mp', phaseId: 'F0', status: 'done', tasks: [{ id: 'T-1', title: 't', status: 'done', lastUpdated: '2026-05-02T00:00:00Z' }], exitGates: [{ id: 'F0-G1', description: 'g', status: 'met' }] }))}---\n\n# f0\n`);

    const res = lastJsonLine(execFileSync('node', [MIGRATE_LAYOUT, '--root', stateDir, '--project-id', 'tp', '--apply', '--json'], { encoding: 'utf8' }));
    assert.equal(res.migrated, true);
    assert.equal(res.finalValidateOk, true);
    assert.ok(!existsSync(join(stateDir, 'projects/tp/mp-f1-beta')), 'NO spurious standalone plan for the surviving phase');
    assert.ok(!existsSync(join(stateDir, 'projects/tp/mp-f0-alpha')), 'NO spurious standalone plan for the already-nested phase');
    assert.ok(existsSync(join(stateDir, 'projects/tp/mp/plan.md')));
    assert.ok(existsSync(join(stateDir, 'projects/tp/mp/phases/f0-alpha.md')), 'pre-existing nested phase preserved');
    assert.ok(existsSync(join(stateDir, 'projects/tp/mp/phases/f1-beta.md')), 'f1 migrated under its real plan');
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});
