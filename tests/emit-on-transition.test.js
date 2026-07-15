import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendCompletion } from '../scripts/append-completion.js';
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

function digest(value) {
  const canonicalize = (item) => {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.keys(item).sort().map((key) => [key, canonicalize(item[key])]));
    }
    return item;
  };
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
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

test('phase-done transition appends only its aggregate after tasks closed individually', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-eot-'));
  try {
    appendCompletion(root, base({
      event: 'phase-done', phaseId: 'F2', taskId: null,
      idempotencyKey: 'phase-done:proj/plan/F2@2026-07-14T20:00:00Z',
    }));

    const records = readEvents(root);
    assert.equal(records.length, 1);
    assert.deepEqual(records.map((record) => record.event), ['phase-done']);

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

test('earned rollup counts an exactly reconciled duplicate idempotency key once', () => {
  const idempotencyKey = 'task-done:proj/plan/F0/T-401@2026-07-14T20:00:00Z';
  const event = base({
    taskId: 'T-401', ts: '2026-07-14T20:00:00Z', idempotencyKey,
    weight: 1, weightBasis: 'count',
  });
  const tree = {
    plans: [{
      projectId: 'proj', planSlug: 'plan',
      fm: {
        started: '2026-07-14T00:00:00Z', deadline: '2026-07-16T00:00:00Z',
      },
    }],
    initiatives: [{
      projectId: 'proj', planSlug: 'plan', fm: { tasks: [{ id: 'T-401', weight: 1 }] },
    }],
  };
  const duplicate = { ...event, ts: '2026-07-14T20:00:01Z' };
  const tombstone = {
    event: 'reconcile', projectId: 'proj', planSlug: 'plan', phaseId: 'F0', taskId: null,
    reconciliation: {
      action: 'ignore-duplicate-completion',
      eventIdentity: 'task-done:T-401',
      canonicalDigest: digest(event),
      duplicateDigests: [digest(duplicate)],
    },
  };
  const series = buildSeries(tree, [event, duplicate, tombstone],
    Date.parse('2026-07-15T00:00:00Z'));
  assert.equal(series.burnup.at(-1).earnedCount, 1);
  assert.equal(series.spi[0].spiCount, 2);
});

test('earned rollup rejects a contradictory duplicate idempotency key', () => {
  const idempotencyKey = 'task-done:proj/plan/F0/T-401@2026-07-14T20:00:00Z';
  const event = base({
    taskId: 'T-401', ts: '2026-07-14T20:00:00Z', idempotencyKey,
    weight: 1, weightBasis: 'count',
  });
  const conflicting = { ...event, taskId: 'T-FORGED', weight: 99 };
  const tree = {
    plans: [{
      projectId: 'proj', planSlug: 'plan',
      fm: { started: '2026-07-14T00:00:00Z', deadline: '2026-07-16T00:00:00Z' },
    }],
    initiatives: [{
      projectId: 'proj', planSlug: 'plan', fm: { tasks: [{ id: 'T-401', weight: 1 }] },
    }],
  };

  assert.throws(
    () => buildSeries(tree, [event, conflicting], Date.parse('2026-07-15T00:00:00Z')),
    /duplicate.*idempotency|idempotency.*duplicate/i,
  );
});
