import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendCompletion } from '../scripts/append-completion.js';
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
