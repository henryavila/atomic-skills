import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';

import { planStateIntegrityMigration } from '../scripts/migrate-state-integrity.js';
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
