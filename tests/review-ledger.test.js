import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readLedger, recordReview, alreadyReviewed } from '../scripts/review-ledger.js';

function deepFreeze(value) {
  if (value == null || typeof value !== 'object') return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

const firstRecord = {
  commitSha: 'abc123',
  patchId: 'patch-1',
  mode: 'local',
  reviewedAt: '2026-06-19T12:00:00.000Z',
  reviewFile: 'reviews/abc.md',
};

const secondRecord = {
  commitSha: 'def456',
  patchId: 'patch-2',
  mode: 'codex',
  reviewedAt: '2026-06-19T13:00:00.000Z',
  reviewFile: 'reviews/def.md',
};

const newRecord = {
  commitSha: 'fedcba',
  patchId: 'patch-3',
  mode: 'local',
  reviewedAt: '2026-06-19T14:00:00.000Z',
  reviewFile: 'reviews/fed.md',
};

const legacyPointer = JSON.stringify(
  {
    schemaVersion: 1,
    branch: 'feature/surface-ledger',
    lastReviewedCommit: 'abc123',
    lastReviewedAt: '2026-06-19T12:00:00.000Z',
    reviewFile: 'reviews/legacy.md',
    verdict: 'pass',
    counts: { errors: 0, warnings: 0 },
  },
  null,
  2,
);

test('readLedger parses valid NDJSON into record objects', () => {
  const content = `${JSON.stringify(firstRecord)}\n${JSON.stringify(secondRecord)}\n`;

  assert.deepEqual(readLedger(content), [firstRecord, secondRecord]);
});

test('readLedger treats a legacy pointer object as no reviewed surface', () => {
  assert.deepEqual(readLedger(legacyPointer), []);
});

test('readLedger treats empty, null, undefined, and malformed content as empty', () => {
  assert.deepEqual(readLedger(''), []);
  assert.deepEqual(readLedger(null), []);
  assert.deepEqual(readLedger(undefined), []);
  assert.deepEqual(readLedger('not json'), []);
});

test('recordReview appends to valid NDJSON while preserving prior bytes', () => {
  const originalContent = `${JSON.stringify(firstRecord)}  \n${JSON.stringify(secondRecord)}`;
  const expectedPrefix = `${originalContent.trimEnd()}\n`;
  const result = recordReview(originalContent, newRecord);

  assert.equal(result.startsWith(expectedPrefix), true);
  assert.equal(result.endsWith(`${JSON.stringify(newRecord)}\n`), true);
  assert.equal(readLedger(result).length, 3);
});

test('recordReview drops a legacy pointer and starts a fresh ledger', () => {
  const result = recordReview(legacyPointer, newRecord);

  assert.equal(result, `${JSON.stringify(newRecord)}\n`);
  assert.deepEqual(readLedger(result), [newRecord]);
});

test('alreadyReviewed returns true for a same-mode commit SHA match', () => {
  const content = `${JSON.stringify(firstRecord)}\n`;

  assert.equal(alreadyReviewed(content, { commitSha: 'abc123' }, 'local'), true);
});

test('alreadyReviewed treats mode as significant for commit SHA matches', () => {
  const content = `${JSON.stringify(firstRecord)}\n`;

  assert.equal(alreadyReviewed(content, { commitSha: 'abc123' }, 'codex'), false);
});

test('alreadyReviewed returns true for a same-mode patchId match with rewritten SHA', () => {
  const content = `${JSON.stringify(firstRecord)}\n`;

  assert.equal(alreadyReviewed(content, { commitSha: 'rewritten', patchId: 'patch-1' }, 'local'), true);
});

test('alreadyReviewed fails closed without positive same-mode proof', () => {
  const content = `${JSON.stringify(firstRecord)}\n`;

  assert.equal(alreadyReviewed(content, { commitSha: 'missing', patchId: 'missing-patch' }, 'local'), false);
  assert.equal(alreadyReviewed(content, { commitSha: '', patchId: '' }, 'local'), false);
  assert.equal(alreadyReviewed(legacyPointer, { commitSha: 'abc123', patchId: 'patch-1' }, 'local'), false);
  assert.equal(alreadyReviewed(null, { commitSha: 'abc123', patchId: 'patch-1' }, 'local'), false);
});

test('ledger helpers are pure and never throw on frozen inputs or null content', () => {
  const frozenRecord = deepFreeze(structuredClone(newRecord));
  const frozenRange = deepFreeze({ commitSha: 'fedcba', patchId: 'patch-3' });
  const recordBefore = structuredClone(frozenRecord);
  const rangeBefore = structuredClone(frozenRange);

  assert.doesNotThrow(() => readLedger(null));
  assert.doesNotThrow(() => recordReview(null, frozenRecord));
  assert.doesNotThrow(() => alreadyReviewed(null, frozenRange, 'local'));

  assert.deepEqual(readLedger(null), []);
  assert.equal(typeof recordReview(null, frozenRecord), 'string');
  assert.equal(alreadyReviewed(null, frozenRange, 'local'), false);
  assert.deepEqual(frozenRecord, recordBefore);
  assert.deepEqual(frozenRange, rangeBefore);
});
