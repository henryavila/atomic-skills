/**
 * F4/T-001 — conservative integrity migration (diagnostic + optional --apply).
 *
 * Unambiguous shapes only: backfill missing parentPlan/phaseId when the join
 * by project+slug is unique. Contradictory terminal state and missing
 * initiatives are unmanaged (report only). --apply writes a byte-for-byte
 * backup before mutating.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { stringify as stringifyYaml } from 'yaml';
import {
  STATE_INTEGRITY_CODES,
  classifyIntegrityRepair,
  planIntegrityRepairs,
} from '../src/state-invariants.js';
import {
  migrateStateIntegrity,
  applyIntegrityRepairs,
} from '../scripts/migrate-state-integrity.js';

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

function writeMd(abs, frontmatter, body = '# body\n') {
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, `---\n${stringifyYaml(frontmatter).trimEnd()}\n---\n\n${body}`);
}

function nestedRoot() {
  const root = mkdtempSync(join(tmpdir(), 'state-integrity-mig-'));
  const planDir = join(root, 'projects', 'demo', 'demo-plan');
  mkdirSync(join(planDir, 'phases'), { recursive: true });
  return { root, planDir };
}

const basePlan = (phases) => ({
  schemaVersion: '0.1',
  slug: 'demo-plan',
  title: 'Demo',
  version: '1',
  status: 'active',
  started: '2026-07-01T00:00:00Z',
  lastUpdated: '2026-07-01T00:00:00Z',
  currentPhase: phases[0]?.id ?? 'F0',
  parallelismAllowed: false,
  principles: [{ id: 'P1', title: 'p', body: 'p' }],
  glossary: [],
  phases,
  references: [],
});

const baseInit = (overrides = {}) => ({
  schemaVersion: '0.1',
  slug: 'demo-plan-f0',
  title: 'F0',
  goal: 'g',
  status: 'active',
  branch: 'plan/demo',
  started: '2026-07-01T00:00:00Z',
  lastUpdated: '2026-07-01T00:00:00Z',
  nextAction: null,
  exitGates: [],
  stack: [],
  tasks: [{ id: 'T-001', title: 't', status: 'pending' }],
  parked: [],
  emerged: [],
  ...overrides,
});

// --- pure classification -----------------------------------------------------

test('classifyIntegrityRepair: missing parentPlan/phaseId with unique join → repairable', () => {
  const decision = classifyIntegrityRepair({
    code: STATE_INTEGRITY_CODES.IDENTITY_MISMATCH,
    kind: 'missing-identity-fields',
    planSlug: 'demo-plan',
    phaseId: 'F0',
    phaseSlug: 'demo-plan-f0',
    projectId: 'demo',
    initiative: { slug: 'demo-plan-f0' },
    expected: { parentPlan: 'demo-plan', phaseId: 'F0' },
  });
  assert.equal(decision.disposition, 'repairable');
  assert.equal(decision.repair.kind, 'backfill-identity');
});

test('classifyIntegrityRepair: missing-initiative / terminal-pending-gate / collision → unmanaged', () => {
  for (const code of [
    STATE_INTEGRITY_CODES.MISSING_INITIATIVE,
    STATE_INTEGRITY_CODES.TERMINAL_PENDING_GATE,
    STATE_INTEGRITY_CODES.SLUG_COLLISION,
    STATE_INTEGRITY_CODES.DUPLICATE_PHASE_ID,
  ]) {
    const d = classifyIntegrityRepair({ code, message: 'x' });
    assert.equal(d.disposition, 'unmanaged', code);
  }
});

test('planIntegrityRepairs: only emits backfill when parentPlan/phaseId absent (not wrong)', () => {
  const plans = new Map([['demo/demo-plan', {
    slug: 'demo-plan',
    __projectId: 'demo',
    phases: [{ id: 'F0', slug: 'demo-plan-f0', status: 'active', exitGate: { criteria: [] } }],
  }]]);
  const inits = new Map([['demo/demo-plan-f0', {
    slug: 'demo-plan-f0',
    __projectId: 'demo',
    // missing parentPlan + phaseId — unambiguous backfill
  }]]);
  const plan = planIntegrityRepairs(plans, inits);
  assert.equal(plan.repairs.length, 1);
  assert.equal(plan.repairs[0].kind, 'backfill-identity');
  assert.equal(plan.unmanaged.length, 0);

  const wrong = new Map([['demo/demo-plan-f0', {
    slug: 'demo-plan-f0',
    __projectId: 'demo',
    parentPlan: 'other',
    phaseId: 'FX',
  }]]);
  const plan2 = planIntegrityRepairs(plans, wrong);
  assert.equal(plan2.repairs.length, 0);
  assert.ok(plan2.unmanaged.some((u) => u.code === STATE_INTEGRITY_CODES.IDENTITY_MISMATCH));
});

// --- CLI dry-run / apply -----------------------------------------------------

test('migrateStateIntegrity dry-run: reports repairable + unmanaged without writes', () => {
  const { root, planDir } = nestedRoot();
  try {
    writeMd(join(planDir, 'plan.md'), basePlan([{
      id: 'F0',
      slug: 'demo-plan-f0',
      title: 'F0',
      goal: 'g',
      dependsOn: [],
      subPhaseCount: 1,
      status: 'active',
      exitGate: { summary: 's', criteria: [] },
    }, {
      id: 'F1',
      slug: 'demo-plan-f1',
      title: 'F1',
      goal: 'g',
      dependsOn: ['F0'],
      subPhaseCount: 0,
      status: 'done',
      exitGate: { summary: 's', criteria: [{ id: 'G1', status: 'pending', description: 'x' }] },
    }]));
    // F0 initiative missing identity fields (repairable)
    writeMd(join(planDir, 'phases', 'f0.md'), baseInit({
      slug: 'demo-plan-f0',
      // no parentPlan / phaseId
    }));
    // F1 done + pending gate, no initiative → unmanaged missing-initiative + terminal gate on plan
    // (no f1 initiative file)

    const result = migrateStateIntegrity(root, { apply: false });
    assert.equal(result.apply, false);
    assert.ok(result.repairs.length >= 1, `expected repairs, got ${JSON.stringify(result)}`);
    assert.ok(result.repairs.every((r) => r.kind === 'backfill-identity'));
    assert.ok(result.unmanaged.length >= 1);
    assert.ok(result.unmanaged.some((u) =>
      u.code === STATE_INTEGRITY_CODES.MISSING_INITIATIVE
      || u.code === STATE_INTEGRITY_CODES.TERMINAL_PENDING_GATE));
    // dry-run: initiative file unchanged (still no parentPlan)
    const raw = readFileSync(join(planDir, 'phases', 'f0.md'), 'utf8');
    assert.equal(raw.includes('parentPlan:'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('migrateStateIntegrity --apply: backfills identity with byte-for-byte backup; skips unmanaged', () => {
  const { root, planDir } = nestedRoot();
  try {
    writeMd(join(planDir, 'plan.md'), basePlan([{
      id: 'F0',
      slug: 'demo-plan-f0',
      title: 'F0',
      goal: 'g',
      dependsOn: [],
      subPhaseCount: 1,
      status: 'active',
      exitGate: { summary: 's', criteria: [] },
    }, {
      id: 'F1',
      slug: 'demo-plan-f1',
      title: 'F1',
      goal: 'g',
      dependsOn: ['F0'],
      subPhaseCount: 0,
      status: 'done',
      exitGate: { summary: 's', criteria: [{ id: 'G1', status: 'pending', description: 'x' }] },
    }]));
    const initPath = join(planDir, 'phases', 'f0.md');
    const before = `---\n${stringifyYaml(baseInit({ slug: 'demo-plan-f0' })).trimEnd()}\n---\n\n# F0\n`;
    writeFileSync(initPath, before);
    const beforeHash = sha(before);

    const result = migrateStateIntegrity(root, { apply: true });
    assert.equal(result.apply, true);
    assert.ok(result.applied.length >= 1);
    assert.ok(result.unmanaged.length >= 1);

    const after = readFileSync(initPath, 'utf8');
    assert.match(after, /parentPlan:\s*demo-plan/);
    assert.match(after, /phaseId:\s*F0/);
    assert.notEqual(sha(after), beforeHash);

    // backup is byte-for-byte the pre-image
    const backups = result.applied.map((a) => a.backupPath).filter(Boolean);
    assert.ok(backups.length >= 1);
    for (const b of backups) {
      assert.equal(existsSync(b), true, `backup missing: ${b}`);
      assert.equal(sha(readFileSync(b, 'utf8')), beforeHash);
    }

    // unmanaged phase still has no initiative file (never invented)
    assert.equal(existsSync(join(planDir, 'phases', 'f1.md')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('applyIntegrityRepairs: refuses ambiguous multi-candidate backfill', () => {
  const repairs = [{
    kind: 'backfill-identity',
    path: '/tmp/nope.md',
    parentPlan: 'p',
    phaseId: 'F0',
    // simulated: classifier already filtered, but apply still requires file parse match
  }];
  // applyIntegrityRepairs with empty disk → reports failure, no throw inventing content
  const out = applyIntegrityRepairs(repairs, { apply: true, backupDir: mkdtempSync(join(tmpdir(), 'bak-')) });
  assert.equal(out.applied.length, 0);
  assert.ok(out.failed.length >= 1);
});

test('migrateStateIntegrity dry-run on empty root is clean', () => {
  const root = mkdtempSync(join(tmpdir(), 'state-integrity-empty-'));
  try {
    mkdirSync(join(root, 'projects'), { recursive: true });
    const result = migrateStateIntegrity(root, { apply: false });
    assert.deepEqual(result.repairs, []);
    assert.deepEqual(result.unmanaged, []);
    assert.equal(result.ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
