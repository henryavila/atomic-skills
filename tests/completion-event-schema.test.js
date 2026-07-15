import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAideckState,
  validateCompletionEvent,
} from '../scripts/validate-aideck-state.js';

const validEvent = (over = {}) => ({
  ts: '2026-06-16T12:00:00Z',
  event: 'task-done',
  projectId: 'proj',
  planSlug: 'plan',
  phaseId: 'F0',
  taskId: 'T-001',
  weight: 1,
  weightBasis: 'count',
  ...over,
});

test('completion event schema accepts a well-formed line', () => {
  assert.equal(validateCompletionEvent(validEvent()).ok, true);
});

test('completion event schema requires an explicit-offset ISO timestamp', () => {
  assert.equal(validateCompletionEvent(validEvent({ ts: 'July 14, 2026 20:00:00 UTC' })).ok, false);
  assert.equal(validateCompletionEvent(validEvent({ ts: '2026-07-14T20:00:00' })).ok, false);
  assert.equal(validateCompletionEvent(validEvent({ ts: '2026-07-14T20:00:00-03:00' })).ok, true);
});

test('completion event parser rejects regex-shaped but impossible timestamps', () => {
  for (const ts of [
    '2026-13-16T12:00:00Z',
    '2026-02-30T12:00:00Z',
    '2026-06-16T25:00:00Z',
    '2026-06-16T12:00:00+99:99',
  ]) {
    assert.equal(validateCompletionEvent(validEvent({ ts })).ok, false, ts);
  }
});

test('completion event schema rejects empty scope and task identities', () => {
  for (const field of ['projectId', 'planSlug', 'phaseId', 'taskId']) {
    assert.equal(validateCompletionEvent(validEvent({ [field]: '' })).ok, false, field);
  }
});

test('completion event schema accepts a positive close generation', () => {
  assert.equal(validateCompletionEvent(validEvent({ generation: 1 })).ok, true);
  assert.equal(validateCompletionEvent(validEvent({ generation: 0 })).ok, false);
});

test('completion event schema requires ts, event, weight, and weightBasis', () => {
  for (const field of ['ts', 'event', 'weight', 'weightBasis']) {
    const line = validEvent();
    delete line[field];
    const result = validateCompletionEvent(line);
    assert.equal(result.ok, false, `${field} should be required`);
  }
});

test('completion event schema rejects extra top-level fields', () => {
  const result = validateCompletionEvent(validEvent({ source: 'manual' }));
  assert.equal(result.ok, false);
});

test('completion event schema rejects events outside the closed enum', () => {
  const result = validateCompletionEvent(validEvent({ event: 'foo' }));
  assert.equal(result.ok, false);
});

test('completion event schema rejects weightBasis outside the closed enum', () => {
  const result = validateCompletionEvent(validEvent({ weightBasis: 'estimate' }));
  assert.equal(result.ok, false);
});

test('completion event schema accepts valid optional actuals', () => {
  const result = validateCompletionEvent(validEvent({
    actuals: {
      filesChanged: 2,
      locAdded: 30,
      locRemoved: 4,
      commits: 1,
      attempts: 2,
      durationMs: 5000,
      escalations: 0,
    },
  }));
  assert.equal(result.ok, true);
});

test('completion event schema rejects unknown actuals fields', () => {
  const result = validateCompletionEvent(validEvent({
    actuals: {
      filesChanged: 2,
      reviewer: 1,
    },
  }));
  assert.equal(result.ok, false);
});

test('completion event schema rejects a task-done event with null taskId', () => {
  const result = validateCompletionEvent(validEvent({ event: 'task-done', taskId: null }));
  assert.equal(result.ok, false, 'task-done must carry a non-null taskId (if/then)');
});

test('completion event schema accepts a phase-done event with null taskId', () => {
  const result = validateCompletionEvent(validEvent({ event: 'phase-done', taskId: null }));
  assert.equal(result.ok, true, 'phase-done may carry a null taskId');
});

test('completion event schema rejects a task-attributed phase-done event', () => {
  const result = validateCompletionEvent(validEvent({ event: 'phase-done', taskId: 'T-001' }));
  assert.equal(result.ok, false, 'phase-done must carry a null taskId');
});

test('completion event schema binds reconciliation tombstones to reconcile events', () => {
  const reconciliation = {
    action: 'ignore-duplicate-completion',
    eventIdentity: 'phase-done:proj/plan/F0@2026-06-16T12:00:00Z',
    canonicalDigest: 'a'.repeat(64),
    duplicateDigests: ['b'.repeat(64)],
  };
  assert.equal(validateCompletionEvent(validEvent({ reconciliation })).ok, false);
  assert.equal(validateCompletionEvent(validEvent({
    event: 'reconcile', taskId: null, reconciliation,
  })).ok, true);
  assert.equal(validateCompletionEvent(validEvent({ event: 'reconcile', taskId: null })).ok, false);
});

test('completion event validator export is additive to validateAideckState', () => {
  assert.equal(typeof validateAideckState, 'function');
});
