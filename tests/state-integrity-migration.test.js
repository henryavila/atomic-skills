import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';

import {
  applyMigrationAtomically,
  kindFromFile,
  planStateIntegrityMigration,
  projectIdFromPath,
  recoverMigrationTransaction,
} from '../scripts/migrate-state-integrity.js';
import { parseFrontmatter } from '../scripts/validate-state.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function plan(overrides = {}) {
  return {
    slug: 'demo', __projectId: 'proj',
    phases: [{ id: 'F0', slug: 'demo-f0', status: 'active' }],
    ...overrides,
  };
}

function initiative(overrides = {}) {
  return { slug: 'demo-f0', __projectId: 'proj', status: 'active', ...overrides };
}

test('migration proposes missing parentPlan and phaseId only for a unique identity', () => {
  const result = planStateIntegrityMigration(
    new Map([['proj/demo', plan()]]),
    new Map([['proj/demo-f0', initiative()]]),
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.changes.length, 1);
  assert.deepEqual(result.changes[0].patch, { parentPlan: 'demo', phaseId: 'F0' });
});

test('migration fails closed when the same initiative slug has multiple candidate phases', () => {
  const result = planStateIntegrityMigration(
    new Map([
      ['proj/demo-a', plan({ slug: 'demo-a', phases: [{ id: 'F0', slug: 'shared-f0', status: 'active' }] })],
      ['proj/demo-b', plan({ slug: 'demo-b', phases: [{ id: 'F9', slug: 'shared-f0', status: 'active' }] })],
    ]),
    new Map([['proj/shared-f0', initiative({ slug: 'shared-f0' })]]),
  );
  assert.deepEqual(result.changes, []);
  assert.ok(result.errors.some((e) => e.code === 'ambiguous-initiative-identity'));
});

test('migration leaves complete identities byte-neutral', () => {
  const result = planStateIntegrityMigration(
    new Map([['proj/demo', plan()]]),
    new Map([['proj/demo-f0', initiative({ parentPlan: 'demo', phaseId: 'F0' })]]),
  );
  assert.deepEqual(result, { changes: [], errors: [] });
});

test('migration path classification accepts Windows separators', () => {
  const windowsPlan = String.raw`C:\repo\.atomic-skills\projects\proj\demo\plan.md`;
  const windowsInitiative = String.raw`C:\repo\.atomic-skills\projects\proj\demo\phases\demo-f0.md`;
  assert.equal(projectIdFromPath(windowsPlan), 'proj');
  assert.equal(kindFromFile(windowsPlan), 'plan');
  assert.equal(kindFromFile(windowsInitiative), 'initiative');
});

test('migration refuses duplicate phase, task and gate ids before planning writes', () => {
  const result = planStateIntegrityMigration(
    new Map([['proj/demo', plan({
      phases: [
        { id: 'F0', slug: 'demo-f0', status: 'active', exitGate: { criteria: [
          { id: 'G1' }, { id: 'G1' },
        ] } },
        { id: 'F0', slug: 'demo-f1', status: 'pending' },
      ],
    })]]),
    new Map([['proj/demo-f0', initiative({
      parentPlan: 'demo', phaseId: 'F0', tasks: [{ id: 'T1' }, { id: 'T1' }],
      exitGates: [{ id: 'G1' }, { id: 'G1' }],
    })]]),
  );
  assert.deepEqual(result.changes, []);
  assert.deepEqual(
    new Set(result.errors.map((error) => error.code)),
    new Set(['duplicate-phase-id', 'duplicate-task-id', 'duplicate-plan-gate-id', 'duplicate-initiative-gate-id']),
  );
});

test('multi-file migration rolls every source back byte-for-byte after a mid-publish fault', () => {
  const dir = mkdtempSync(join(tmpdir(), 'state-integrity-atomic-'));
  try {
    const first = join(dir, 'first.md');
    const second = join(dir, 'second.md');
    writeFileSync(first, 'first-original\n');
    writeFileSync(second, 'second-original\n');
    assert.throws(() => applyMigrationAtomically([
      { filePath: first, content: 'first-new\n' },
      { filePath: second, content: 'second-new\n' },
    ], {
      faultAt: ({ point, index }) => {
        if (point === 'after-publish' && index === 0) throw new Error('injected publish fault');
      },
    }), /injected publish fault/);
    assert.equal(readFileSync(first, 'utf8'), 'first-original\n');
    assert.equal(readFileSync(second, 'utf8'), 'second-original\n');
    assert.equal(readdirSync(dir).some((name) => name.includes('.migration-transaction')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('migration startup recovers a persisted partial-publication manifest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'state-integrity-recovery-'));
  try {
    const first = join(dir, 'first.md');
    const second = join(dir, 'second.md');
    const firstBackup = `${first}.bak`;
    const secondBackup = `${second}.bak`;
    const firstTemp = `${first}.migration-tmp`;
    const secondTemp = `${second}.migration-tmp`;
    writeFileSync(first, 'partially-published\n');
    writeFileSync(second, 'second-original\n');
    writeFileSync(firstBackup, 'first-original\n');
    writeFileSync(secondBackup, 'second-original\n');
    writeFileSync(firstTemp, 'unused-first-temp\n');
    writeFileSync(secondTemp, 'unused-second-temp\n');
    writeFileSync(join(dir, '.state-integrity-migration-transaction.json'), `${JSON.stringify({
      version: 1,
      operations: [
        { filePath: first, backupPath: firstBackup, tempPath: firstTemp },
        { filePath: second, backupPath: secondBackup, tempPath: secondTemp },
      ],
    })}\n`);
    assert.equal(recoverMigrationTransaction(dir), true);
    assert.equal(readFileSync(first, 'utf8'), 'first-original\n');
    assert.equal(readFileSync(second, 'utf8'), 'second-original\n');
    assert.equal(readdirSync(dir).some((name) => name.includes('.migration-transaction')), false);
    assert.equal(existsSync(firstTemp), false);
    assert.equal(existsSync(secondTemp), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('migration copies authoritative deterministic gate evidence from plan to initiative', () => {
  const authoritativeEvidence = {
    verifierKind: 'shell', verifiedAt: '2026-01-02T00:00:00Z', passed: true,
    exitCode: 0, outputSummary: 'authoritative plan receipt',
  };
  const result = planStateIntegrityMigration(
    new Map([['proj/demo', plan({
      phases: [{
        id: 'F0', slug: 'demo-f0', status: 'done',
        exitGate: { criteria: [{
          id: 'G-1', status: 'met', verifier: { kind: 'shell', command: 'true' },
          evidence: authoritativeEvidence,
        }] },
      }],
    })]]),
    new Map([['proj/demo-f0', initiative({
      parentPlan: 'demo', phaseId: 'F0', status: 'done',
      exitGates: [{
        id: 'G-1', status: 'met', verifier: { kind: 'shell', command: 'true' },
        evidence: { ...authoritativeEvidence, outputSummary: 'stale initiative receipt' },
      }],
    })]]),
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.changes.length, 1);
  assert.deepEqual(result.changes[0].patch.exitGates[0].evidence, authoritativeEvidence);
});

test('CLI dry-run writes nothing; --apply creates a byte-identical backup and fills only identity fields', () => {
  const dir = mkdtempSync(join(tmpdir(), 'state-integrity-migration-'));
  try {
    const stateRoot = join(dir, '.atomic-skills');
    const planDir = join(stateRoot, 'projects', 'proj', 'demo');
    const phasesDir = join(planDir, 'phases');
    mkdirSync(phasesDir, { recursive: true });
    const planPath = join(planDir, 'plan.md');
    const phasePath = join(phasesDir, 'f0-demo.md');
    const planBytes = `---\n${stringifyYaml({ schemaVersion: '0.1', slug: 'demo', title: 'Demo', version: '1', status: 'active', started: '2026-01-01T00:00:00Z', lastUpdated: '2026-01-01T00:00:00Z', currentPhase: 'F0', phases: [{ id: 'F0', slug: 'demo-f0', title: 'F0', goal: 'g', dependsOn: [], subPhaseCount: 0, exitGate: { summary: 's', criteria: [] }, status: 'active' }] })}---\n\nplan body\n`;
    const phaseBytes = `---\n${stringifyYaml({ schemaVersion: '0.1', slug: 'demo-f0', title: 'F0', goal: 'g', status: 'active', branch: null, started: '2026-01-01T00:00:00Z', lastUpdated: '2026-01-01T00:00:00Z', nextAction: null, exitGates: [], stack: [], tasks: [], parked: [], emerged: [] })}---\n\nphase body\n`;
    writeFileSync(planPath, planBytes);
    writeFileSync(phasePath, phaseBytes);

    const dry = spawnSync(process.execPath, [join(ROOT, 'scripts', 'migrate-state-integrity.js'), stateRoot], { encoding: 'utf8' });
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /DRY-RUN.*1 change/);
    assert.equal(readFileSync(phasePath, 'utf8'), phaseBytes);

    const apply = spawnSync(process.execPath, [join(ROOT, 'scripts', 'migrate-state-integrity.js'), stateRoot, '--apply'], { encoding: 'utf8' });
    assert.equal(apply.status, 0, apply.stderr);
    const backups = readdirSync(phasesDir).filter((name) => name.startsWith('f0-demo.md.bak'));
    assert.equal(backups.length, 1);
    assert.equal(readFileSync(join(phasesDir, backups[0]), 'utf8'), phaseBytes);
    const migrated = parseFrontmatter(readFileSync(phasePath, 'utf8')).frontmatter;
    assert.equal(migrated.parentPlan, 'demo');
    assert.equal(migrated.phaseId, 'F0');
    assert.equal(migrated.slug, 'demo-f0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI aborts before writes when duplicate initiative identities resolve to two files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'state-integrity-duplicate-'));
  try {
    const stateRoot = join(dir, '.atomic-skills');
    const planDir = join(stateRoot, 'projects', 'proj', 'demo');
    const phasesDir = join(planDir, 'phases');
    const archiveDir = join(phasesDir, 'archive');
    mkdirSync(archiveDir, { recursive: true });
    const planPath = join(planDir, 'plan.md');
    const livePath = join(phasesDir, 'demo-f0.md');
    const archivedPath = join(archiveDir, '2026-07-demo-f0.md');
    const planBytes = `---\n${stringifyYaml({
      schemaVersion: '0.1', slug: 'demo', title: 'Demo', version: '1', status: 'active',
      started: '2026-01-01T00:00:00Z', lastUpdated: '2026-01-01T00:00:00Z',
      phases: [{
        id: 'F0', slug: 'demo-f0', title: 'F0', goal: 'g', dependsOn: [],
        subPhaseCount: 0, exitGate: { summary: 's', criteria: [] }, status: 'active',
      }],
    })}---\n`;
    const initiativeBytes = `---\n${stringifyYaml({
      schemaVersion: '0.1', slug: 'demo-f0', title: 'F0', goal: 'g', status: 'active',
      started: '2026-01-01T00:00:00Z', lastUpdated: '2026-01-01T00:00:00Z',
      nextAction: null, exitGates: [], stack: [], tasks: [], parked: [], emerged: [],
    })}---\n`;
    writeFileSync(planPath, planBytes);
    writeFileSync(livePath, initiativeBytes);
    writeFileSync(archivedPath, initiativeBytes);

    const result = spawnSync(process.execPath, [
      join(ROOT, 'scripts', 'migrate-state-integrity.js'), stateRoot, '--apply',
    ], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /duplicate.*initiative.*demo-f0/i);
    assert.equal(readFileSync(livePath, 'utf8'), initiativeBytes);
    assert.equal(readFileSync(archivedPath, 'utf8'), initiativeBytes);
    assert.equal(readdirSync(phasesDir).some((name) => name.includes('.bak')), false);
    assert.equal(readdirSync(archiveDir).some((name) => name.includes('.bak')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
