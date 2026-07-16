import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendCompletion, dedupeCompletionEvents } from '../scripts/append-completion.js';
import { decideDoneTerminal } from '../scripts/done-transaction.js';
import { buildSeries } from '../scripts/emit-consumer-state.js';
import { validateCompletionEvent } from '../scripts/validate-aideck-state.js';

const LOG = (root) => join(root, '.atomic-skills', 'analytics', 'completions.jsonl');
const base = (over = {}) => ({
  event: 'task-done',
  projectId: 'proj',
  planSlug: 'plan',
  phaseId: 'F0',
  taskId: 'T-001',
  ...over,
});

function readEvents(root) {
  return readFileSync(LOG(root), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
}

function assertAllValid(records) {
  for (const record of records) {
    const result = validateCompletionEvent(record);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
  }
}

test('done transition appends one task-done event', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-eot-'));
  try {
    appendCompletion(root, base({ taskId: 'T-101' }));

    const records = readEvents(root);
    assert.equal(records.length, 1);
    assert.deepEqual(records.map((record) => record.event), ['task-done']);
    assert.equal(records[0].taskId, 'T-101');
    assertAllValid(records);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('phase-done transition appends one task-done per task plus one phase-done event', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-eot-'));
  try {
    const taskIds = ['T-201', 'T-202', 'T-203'];
    for (const taskId of taskIds) {
      appendCompletion(root, base({ phaseId: 'F2', taskId }));
    }
    appendCompletion(root, base({ event: 'phase-done', phaseId: 'F2', taskId: null }));

    const records = readEvents(root);
    assert.equal(records.length, taskIds.length + 1);
    assert.deepEqual(records.map((record) => record.event), [
      'task-done',
      'task-done',
      'task-done',
      'phase-done',
    ]);

    const taskDoneRecords = records.filter((record) => record.event === 'task-done');
    assert.deepEqual(new Set(taskDoneRecords.map((record) => record.taskId)), new Set(taskIds));

    const phaseDoneRecords = records.filter((record) => record.event === 'phase-done');
    assert.equal(phaseDoneRecords.length, 1);
    assert.equal(phaseDoneRecords[0].taskId, null);
    assertAllValid(records);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reconcile transition appends one task-done event for the reconciled task', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-eot-'));
  try {
    appendCompletion(root, base({ taskId: 'T-301' }));

    const records = readEvents(root);
    assert.equal(records.length, 1);
    assert.deepEqual(records.map((record) => record.event), ['task-done']);
    assert.equal(records[0].taskId, 'T-301');
    assertAllValid(records);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('done transition retry does not duplicate analytics lines', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-eot-retry-'));
  try {
    const entry = base({ taskId: 'T-401', ts: '2026-06-10T00:00:00Z', weight: 2, weightBasis: 'proxy' });
    const first = appendCompletion(root, entry);
    assert.equal(first.appended, true);

    // Simulate the done flow re-running after success (same identity, new ts).
    const retry = appendCompletion(root, base({
      taskId: 'T-401',
      ts: '2026-06-11T00:00:00Z',
      weight: 2,
      weightBasis: 'proxy',
    }));
    assert.equal(retry.idempotent, true);
    assert.equal(retry.appended, false);

    const records = readEvents(root);
    assert.equal(records.length, 1, 'retry after success → still one analytics line');
    assert.equal(records[0].taskId, 'T-401');
    assert.equal(records[0].ts, '2026-06-10T00:00:00Z');
    assertAllValid(records);

    const decision = decideDoneTerminal({
      taskId: 'T-401',
      projectId: 'proj',
      planSlug: 'plan',
      phaseId: 'F0',
      task: {
        id: 'T-401',
        status: 'done',
        evidence: { passed: true, closeFingerprint: 'fp-1' },
      },
      fingerprint: 'fp-1',
      closeFingerprint: 'fp-1',
      eventPresent: true,
      handoffPresent: true,
      verifierPassed: true,
    });
    assert.equal(decision.idempotent, true);
    assert.deepEqual(decision.events, []);
    assert.deepEqual(decision.writes, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildSeries earned value collapses duplicate task-done identities', () => {
  const tree = {
    plans: [{
      projectId: 'proj',
      planSlug: 'plan',
      fm: { started: '2026-01-01T00:00:00Z', deadline: '2026-01-11T00:00:00Z' },
    }],
    initiatives: [{
      projectId: 'proj',
      planSlug: 'plan',
      fm: { tasks: [{ id: 'T-001', weight: 1 }, { id: 'T-002', weight: 1 }] },
    }],
  };
  // Two identical identities (retry artifact) + one distinct task.
  const lines = [
    { projectId: 'proj', planSlug: 'plan', phaseId: 'F0', taskId: 'T-001', ts: '2026-01-03T10:00:00Z', event: 'task-done', weight: 1, weightBasis: 'count' },
    { projectId: 'proj', planSlug: 'plan', phaseId: 'F0', taskId: 'T-001', ts: '2026-01-03T11:00:00Z', event: 'task-done', weight: 1, weightBasis: 'count' },
    { projectId: 'proj', planSlug: 'plan', phaseId: 'F0', taskId: 'T-002', ts: '2026-01-04T10:00:00Z', event: 'task-done', weight: 1, weightBasis: 'count' },
  ];
  assert.equal(dedupeCompletionEvents(lines).length, 2);

  const nowMs = Date.parse('2026-01-06T00:00:00Z');
  const { burnup } = buildSeries(tree, lines, nowMs);
  const last = burnup.filter((row) => row.planSlug === 'plan').at(-1);
  assert.ok(last, 'burnup rows for plan');
  // earnedCount must be 2 (T-001 once + T-002 once), not 3 from the retry duplicate.
  assert.equal(last.earnedCount, 2);
});
