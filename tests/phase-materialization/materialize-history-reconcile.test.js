import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import {
  checkHistoryReceipt,
  reconcileMaterializationHistory,
} from '../../scripts/materialize-state.js';
import { createHistoryFixture } from './history-fixture.js';

function mutateFrontmatter(path, mutate) {
  const raw = readFileSync(path, 'utf8');
  const end = raw.indexOf('\n---', 4);
  const frontmatter = parseYaml(raw.slice(4, end));
  mutate(frontmatter);
  writeFileSync(path, `---\n${stringifyYaml(frontmatter)}---${raw.slice(end + 4)}`);
}

test('consistent F0 projection writes a current canonical receipt', () => {
  const state = createHistoryFixture();
  try {
    const result = reconcileMaterializationHistory({ ...state.options, apply: true });
    assert.equal(result.classification, 'consistent');
    assert.equal(result.receipt.closeSha, state.closeSha);
    assert.equal(result.receipt.reconciledCommit, state.reconciledCommit);
    assert.equal(result.receipt.evidence.length, 1);
    assert.equal(result.receipt.completionEvents.length, 1);
    assert.equal(checkHistoryReceipt({ root: state.root, receiptPath: state.receiptRel }).ok, true);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('uniquely matched stale gate evidence is repairable with byte-identical backups', () => {
  const state = createHistoryFixture();
  try {
    const stale = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    mutateFrontmatter(state.planPath, (plan) => {
      plan.phases[0].exitGate.criteria[0].evidence.verifiedCommit = stale;
    });
    mutateFrontmatter(state.initiativePath, (initiative) => {
      initiative.exitGates[0].evidence.verifiedCommit = stale;
    });
    const beforePlan = readFileSync(state.planPath);
    const beforeInitiative = readFileSync(state.initiativePath);
    const dry = reconcileMaterializationHistory(state.options);
    assert.equal(dry.classification, 'repairable');
    assert.deepEqual(readFileSync(state.planPath), beforePlan);
    const applied = reconcileMaterializationHistory({ ...state.options, apply: true });
    assert.equal(applied.classification, 'repairable');
    assert.deepEqual(readFileSync(applied.backups.plan), beforePlan);
    assert.deepEqual(readFileSync(applied.backups.initiative), beforeInitiative);
    assert.equal(applied.receipt.evidence[0].verifiedCommit, state.reviewedSha);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('history repair rejects a pre-planted symlink at the deterministic backup path', () => {
  const state = createHistoryFixture();
  try {
    const stale = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    mutateFrontmatter(state.planPath, (plan) => {
      plan.phases[0].exitGate.criteria[0].evidence.verifiedCommit = stale;
    });
    const beforePlan = readFileSync(state.planPath);
    const digest = createHash('sha256').update(beforePlan).digest('hex').slice(0, 16);
    const backup = `${state.planPath}.history-backup-${digest}.bak`;
    const plantedTarget = `${state.planPath}.planted-target`;
    writeFileSync(plantedTarget, beforePlan);
    symlinkSync(plantedTarget, backup);

    assert.throws(
      () => reconcileMaterializationHistory({ ...state.options, apply: true }),
      /backup.*symbolic link|symbolic link.*backup/i,
    );
    assert.deepEqual(readFileSync(state.planPath), beforePlan);
    assert.deepEqual(readFileSync(plantedTarget), beforePlan);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('duplicate completion is repairable only with one close identity and closeSha', () => {
  const state = createHistoryFixture();
  try {
    const duplicate = { ...state.event, ts: '2026-07-14T20:00:01Z' };
    writeFileSync(state.completionLogPath,
      `${JSON.stringify(state.event)}\n${JSON.stringify(duplicate)}\n`);
    assert.equal(reconcileMaterializationHistory(state.options).classification, 'repairable');
    const applied = reconcileMaterializationHistory({ ...state.options, apply: true });
    const records = readFileSync(state.completionLogPath, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(records.length, 3, 'two immutable originals plus one reconciliation marker');
    assert.equal(records[0].event, 'task-done');
    assert.equal(records[1].event, 'task-done');
    assert.equal(records[2].event, 'reconcile');
    assert.equal(records[2].reconciliation.action, 'ignore-duplicate-completion');
    assert.equal(readFileSync(applied.backups.completionLog, 'utf8').trim().split('\n').length, 2);
    assert.equal(applied.receipt.completionEvents.length, 2, 'canonical close plus audit marker');
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('same close identity with payload drift is ambiguous and writes nothing', () => {
  const state = createHistoryFixture();
  try {
    const conflicting = { ...state.event, ts: '2026-07-14T20:00:01Z', weight: 9 };
    writeFileSync(state.completionLogPath,
      `${JSON.stringify(state.event)}\n${JSON.stringify(conflicting)}\n`);
    const before = readFileSync(state.completionLogPath);
    const result = reconcileMaterializationHistory({ ...state.options, apply: true });
    assert.equal(result.classification, 'ambiguous');
    assert.deepEqual(readFileSync(state.completionLogPath), before);
    assert.equal(result.writes.length, 0);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('ambiguous duplicate fails closed with zero writes', () => {
  const state = createHistoryFixture();
  try {
    const ambiguous = { ...state.event };
    delete ambiguous.idempotencyKey;
    delete ambiguous.closeSha;
    writeFileSync(state.completionLogPath,
      `${JSON.stringify(state.event)}\n${JSON.stringify(ambiguous)}\n`);
    const before = readFileSync(state.completionLogPath);
    const result = reconcileMaterializationHistory({ ...state.options, apply: true });
    assert.equal(result.classification, 'ambiguous');
    assert.deepEqual(readFileSync(state.completionLogPath), before);
    assert.equal(result.writes.length, 0);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('receipt check detects projection drift after reconciliation', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    mutateFrontmatter(state.initiativePath, (initiative) => {
      initiative.exitGates[0].evidence.outputSummary = 'tampered';
    });
    assert.throws(
      () => checkHistoryReceipt({ root: state.root, receiptPath: state.receiptRel }),
      /history receipt is stale/i,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('receipt check binds self-declared identity and sources to caller expectations', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    assert.throws(() => checkHistoryReceipt({
      root: state.root,
      receiptPath: state.receiptRel,
      expectedIdentity: { projectId: 'proj', planSlug: 'other', phaseId: 'F0' },
      expectedSources: {
        planPath: state.planRel,
        initiativePath: state.initiativeRel,
        creationGatePath: state.creationGateRel,
        completionLogPath: state.completionLogRel,
        sidecarPaths: [state.sidecarRel],
      },
    }), /receipt identity.*planSlug/i);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});
