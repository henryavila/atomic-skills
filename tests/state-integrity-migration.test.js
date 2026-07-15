import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

function waitForFile(path, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (existsSync(path)) return resolve();
      if (Date.now() >= deadline) return reject(new Error(`timed out waiting for ${path}`));
      setTimeout(poll, 10);
    };
    poll();
  });
}

function waitForChild(child) {
  return new Promise((resolve) => {
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolve({ status, stderr }));
  });
}

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

test('migration rejects a source reached through a symlinked parent before any write', () => {
  const dir = mkdtempSync(join(tmpdir(), 'state-integrity-symlink-'));
  const outside = mkdtempSync(join(tmpdir(), 'state-integrity-outside-'));
  try {
    const outsideFile = join(outside, 'phase.md');
    writeFileSync(outsideFile, 'outside-original\n');
    symlinkSync(outside, join(dir, 'escaped'));

    assert.throws(() => applyMigrationAtomically([
      { filePath: join(dir, 'escaped', 'phase.md'), content: 'forged\n' },
    ], { transactionRoot: dir }), /symbolic link|symlink/i);
    assert.equal(readFileSync(outsideFile, 'utf8'), 'outside-original\n');
    assert.deepEqual(readdirSync(outside), ['phase.md']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('migration serializes concurrent publishers with one owner-authenticated root lock', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'state-integrity-lock-'));
  try {
    const source = join(dir, 'phase.md');
    const signal = join(dir, 'first-publisher.locked');
    writeFileSync(source, 'original\n');
    const moduleUrl = pathToFileURL(join(ROOT, 'scripts', 'migrate-state-integrity.js')).href;
    const program = `
      import { writeFileSync } from 'node:fs';
      import { applyMigrationAtomically } from ${JSON.stringify(moduleUrl)};
      const [source, root, content, signal] = process.argv.slice(1);
      applyMigrationAtomically([{ filePath: source, content }], {
        transactionRoot: root,
        faultAt: ({ point, index }) => {
          if (signal && point === 'after-publish' && index === 0) {
            writeFileSync(signal, String(process.pid));
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_200);
          }
        },
      });
    `;
    const first = spawn(process.execPath, [
      '--input-type=module', '-e', program, source, dir, 'first\n', signal,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    const firstDone = waitForChild(first);
    await waitForFile(signal);

    const lockPath = join(dir, '.state-integrity-migration.lock');
    assert.equal(existsSync(lockPath), true, 'publisher must hold the root lock during publish');
    const lockOwner = JSON.parse(readFileSync(join(lockPath, 'owner.json'), 'utf8'));
    assert.equal(lockOwner.pid, Number(readFileSync(signal, 'utf8')));
    assert.equal(typeof lockOwner.token, 'string');

    const second = spawn(process.execPath, [
      '--input-type=module', '-e', program, source, dir, 'second\n', '',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    const secondDone = waitForChild(second);
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(
      readdirSync(dir).filter((name) => name.startsWith('phase.md.bak')).length,
      1,
      'the second publisher must not prepare backups while the first owns the lock',
    );

    const [firstResult, secondResult] = await Promise.all([firstDone, secondDone]);
    assert.equal(firstResult.status, 0, firstResult.stderr);
    assert.equal(secondResult.status, 0, secondResult.stderr);
    assert.equal(readFileSync(source, 'utf8'), 'second\n');
    assert.equal(existsSync(lockPath), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('migration lock guard protects a creator paused before owner publication', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'state-integrity-lock-publish-'));
  try {
    const source = join(dir, 'phase.md');
    const signal = join(dir, 'creator-before-owner.signal');
    writeFileSync(source, 'original\n');
    const moduleUrl = pathToFileURL(join(ROOT, 'scripts', 'migrate-state-integrity.js')).href;
    const program = `
      import { writeFileSync } from 'node:fs';
      import { applyMigrationAtomically } from ${JSON.stringify(moduleUrl)};
      const [source, root, content, signal] = process.argv.slice(1);
      applyMigrationAtomically([{ filePath: source, content }], {
        transactionRoot: root,
        lockFaultAt: signal ? ({ point }) => {
          if (point === 'after-lock-directory') {
            writeFileSync(signal, String(process.pid));
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_300);
          }
        } : undefined,
      });
    `;
    const first = spawn(process.execPath, [
      '--input-type=module', '-e', program, source, dir, 'first\n', signal,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    const firstDone = waitForChild(first);
    await waitForFile(signal);

    const second = spawn(process.execPath, [
      '--input-type=module', '-e', program, source, dir, 'second\n', '',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    const secondDone = waitForChild(second);

    const [firstResult, secondResult] = await Promise.all([firstDone, secondDone]);
    assert.equal(firstResult.status, 0, firstResult.stderr);
    assert.equal(secondResult.status, 0, secondResult.stderr);
    assert.equal(readFileSync(source, 'utf8'), 'second\n');
    assert.equal(existsSync(join(dir, '.state-integrity-migration.lock')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('migration startup fails closed on a legacy manifest without authenticated backups', () => {
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
    assert.throws(
      () => recoverMigrationTransaction(dir),
      /version 1|legacy|backup digest|unauthenticated/i,
    );
    assert.equal(readFileSync(first, 'utf8'), 'partially-published\n');
    assert.equal(readFileSync(second, 'utf8'), 'second-original\n');
    assert.equal(existsSync(join(dir, '.state-integrity-migration-transaction.json')), true);
    assert.equal(existsSync(firstTemp), true);
    assert.equal(existsSync(secondTemp), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('migration startup preserves version-2 recovery state with unauthenticated current bytes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'state-integrity-recovery-v2-'));
  try {
    const source = join(dir, 'phase.md');
    const backup = `${source}.bak`;
    const temp = `${source}.migration-tmp`;
    const manifest = join(dir, '.state-integrity-migration-transaction.json');
    const original = 'original\n';
    const current = 'unknown-current-bytes\n';
    writeFileSync(source, current);
    writeFileSync(backup, original);
    writeFileSync(temp, 'prepared\n');
    writeFileSync(manifest, `${JSON.stringify({
      version: 2,
      operations: [{
        filePath: source,
        backupPath: backup,
        tempPath: temp,
        backupDigest: createHash('sha256').update(original).digest('hex'),
      }],
    })}\n`);

    assert.throws(
      () => recoverMigrationTransaction(dir),
      /version 2.*unauthenticated current source bytes/i,
    );
    assert.equal(readFileSync(source, 'utf8'), current);
    assert.equal(existsSync(manifest), true);
    assert.equal(existsSync(temp), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('migration recovery rejects a tampered durable backup before restoring any source', () => {
  const dir = mkdtempSync(join(tmpdir(), 'state-integrity-tamper-'));
  try {
    const source = join(dir, 'phase.md');
    const backup = `${source}.bak`;
    const temp = `${source}.migration-tmp`;
    const original = 'original\n';
    writeFileSync(source, 'partially-published\n');
    writeFileSync(backup, original);
    const target = 'prepared\n';
    writeFileSync(temp, target);
    const backupDigest = createHash('sha256').update(original).digest('hex');
    const targetDigest = createHash('sha256').update(target).digest('hex');
    writeFileSync(join(dir, '.state-integrity-migration-transaction.json'), `${JSON.stringify({
      version: 3,
      operations: [{
        filePath: source,
        backupPath: backup,
        tempPath: temp,
        backupDigest,
        sourceDigest: backupDigest,
        targetDigest,
      }],
    })}\n`);
    writeFileSync(backup, 'tampered\n');

    assert.throws(
      () => recoverMigrationTransaction(dir),
      /migration recovery backup digest mismatch/i,
    );
    assert.equal(readFileSync(source, 'utf8'), 'partially-published\n');
    assert.equal(existsSync(join(dir, '.state-integrity-migration-transaction.json')), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('migration recovery preserves third-party bytes that match neither side of the transaction', () => {
  const dir = mkdtempSync(join(tmpdir(), 'state-integrity-recovery-cas-'));
  try {
    const source = join(dir, 'phase.md');
    const backup = `${source}.bak`;
    const temp = `${source}.migration-tmp`;
    const manifest = join(dir, '.state-integrity-migration-transaction.json');
    const original = 'original\n';
    const target = 'migration-target\n';
    const thirdParty = 'post-crash-third-party-edit\n';
    const digest = (value) => createHash('sha256').update(value).digest('hex');

    writeFileSync(source, thirdParty);
    writeFileSync(backup, original);
    writeFileSync(temp, target);
    writeFileSync(manifest, `${JSON.stringify({
      version: 3,
      operations: [{
        filePath: source,
        backupPath: backup,
        tempPath: temp,
        backupDigest: digest(original),
        sourceDigest: digest(original),
        targetDigest: digest(target),
      }],
    })}\n`);

    assert.throws(
      () => recoverMigrationTransaction(dir),
      /current source digest|outside.*transaction|neither.*source.*target/i,
    );
    assert.equal(readFileSync(source, 'utf8'), thirdParty);
    assert.equal(readFileSync(backup, 'utf8'), original);
    assert.equal(readFileSync(temp, 'utf8'), target);
    assert.equal(existsSync(manifest), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('in-process migration rollback also refuses to overwrite a concurrent third-party edit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'state-integrity-rollback-cas-'));
  try {
    const source = join(dir, 'phase.md');
    const manifest = join(dir, '.state-integrity-migration-transaction.json');
    const thirdParty = 'concurrent-third-party-edit\n';
    writeFileSync(source, 'original\n');

    assert.throws(() => applyMigrationAtomically([
      { filePath: source, content: 'migration-target\n' },
    ], {
      transactionRoot: dir,
      faultAt: ({ point }) => {
        if (point !== 'after-publish') return;
        writeFileSync(source, thirdParty);
        throw new Error('injected failure after concurrent edit');
      },
    }), /current source digest.*neither source nor target/i);

    assert.equal(readFileSync(source, 'utf8'), thirdParty);
    assert.equal(existsSync(manifest), true);
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
