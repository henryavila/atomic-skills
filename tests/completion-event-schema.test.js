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

test('completion event validator export is additive to validateAideckState', () => {
  assert.equal(typeof validateAideckState, 'function');
});
