import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
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

test('duplicate completion is repairable only with one close identity and closeSha', () => {
  const state = createHistoryFixture();
  try {
    const duplicate = { ...state.event, ts: '2026-07-14T20:00:01Z' };
    writeFileSync(state.completionLogPath,
      `${JSON.stringify(state.event)}\n${JSON.stringify(duplicate)}\n`);
    assert.equal(reconcileMaterializationHistory(state.options).classification, 'repairable');
    const applied = reconcileMaterializationHistory({ ...state.options, apply: true });
    assert.equal(readFileSync(state.completionLogPath, 'utf8').trim().split('\n').length, 1);
    assert.equal(readFileSync(applied.backups.completionLog, 'utf8').trim().split('\n').length, 2);
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
