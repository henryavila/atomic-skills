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

// F7/T-003 — patch-id squash ORACLE: dedup must survive a squash (commit SHA rewritten,
// patch-id stable) and must RE-review whenever the patch-id cannot positively prove a match.
const preSquash = {
  commitSha: 'pre-squash-sha',
  patchId: 'stable-pid',
  mode: 'codex',
  reviewedAt: '2026-06-19T10:00:00.000Z',
  reviewFile: 'reviews/pre.md',
};

test('oracle: a squash-merged surface (SHA rewritten, patch-id stable) is recognized as reviewed', () => {
  const content = `${JSON.stringify(preSquash)}\n`;
  // post-squash the commit SHA differs, but the stable patch-id still matches the record
  assert.equal(
    alreadyReviewed(content, { commitSha: 'post-squash-sha', patchId: 'stable-pid' }, 'codex'),
    true,
  );
});

test('oracle: a non-matching patch-id re-reviews (fail-safe)', () => {
  const content = `${JSON.stringify(preSquash)}\n`;
  assert.equal(
    alreadyReviewed(content, { commitSha: 'post-squash-sha', patchId: 'different-pid' }, 'codex'),
    false,
  );
});

test('oracle: a rewritten SHA with no usable patch-id re-reviews (fail-safe)', () => {
  const content = `${JSON.stringify(preSquash)}\n`;
  // query carries only a rewritten SHA, no patch-id to fall back on → must re-review
  assert.equal(alreadyReviewed(content, { commitSha: 'post-squash-sha' }, 'codex'), false);
  // and when the LEDGER record itself carries no patch-id, a rewritten-SHA query can't match
  const noPid = { commitSha: 'pre-squash-sha', mode: 'codex', reviewedAt: 'x', reviewFile: 'y' };
  assert.equal(
    alreadyReviewed(`${JSON.stringify(noPid)}\n`, { commitSha: 'post-squash-sha', patchId: 'stable-pid' }, 'codex'),
    false,
  );
});

// F7 phase-done review fixes (C1–C4 / L4):

// C1 — recordReview preserves the existing bytes EXACTLY (incl. trailing whitespace on the
// last line), independently of the trimEnd oracle, so concurrent appends stay union-lossless.
test('recordReview preserves prior bytes exactly, even a last line with trailing spaces', () => {
  const original = `${JSON.stringify(firstRecord)}\n${JSON.stringify(secondRecord)}   \n`;
  const result = recordReview(original, newRecord);
  assert.equal(result.startsWith(original), true);
  assert.equal(result, `${original}${JSON.stringify(newRecord)}\n`);
});

// C2 — a complete one-line record carrying a lastReviewedCommit field is read as a record,
// NOT misclassified as a legacy pointer.
test('readLedger does not misclassify a complete one-line record carrying lastReviewedCommit', () => {
  const rec = { commitSha: 'a', patchId: 'p', mode: 'local', reviewedAt: 't', reviewFile: 'f', lastReviewedCommit: 'x' };
  const content = `${JSON.stringify(rec)}\n`;
  assert.equal(readLedger(content).length, 1);
  assert.equal(alreadyReviewed(content, { commitSha: 'a' }, 'local'), true);
});

// C3 — a partial/corrupt record (missing patchId) is NOT positive proof → re-review.
test('alreadyReviewed does not treat a partial record (missing patchId) as proof', () => {
  const partial = `${JSON.stringify({ mode: 'local', commitSha: 'abc' })}\n`;
  assert.equal(alreadyReviewed(partial, { commitSha: 'abc' }, 'local'), false);
});

// C4 — never-throws even when the range exposes a throwing getter.
test('alreadyReviewed never throws on a range with a throwing getter', () => {
  const hostile = {};
  Object.defineProperty(hostile, 'commitSha', {
    get() { throw new Error('boom'); },
    enumerable: true,
  });
  let result;
  assert.doesNotThrow(() => {
    result = alreadyReviewed(`${JSON.stringify(firstRecord)}\n`, hostile, 'local');
  });
  assert.equal(result, false);
});

// L4 — non-object record → safe {} line; whitespace-only content → []; a single malformed
// line collapses the ledger fail-safe; empty/non-string mode never matches.
test('recordReview tolerates a non-object record and readLedger ignores whitespace-only content', () => {
  assert.equal(recordReview(null, 42), '{}\n');
  assert.deepEqual(readLedger('   \n  \n'), []);
});

test('a single malformed line collapses the ledger to empty (fail-safe)', () => {
  const content = `${JSON.stringify(firstRecord)}\nnot-json\n`;
  assert.deepEqual(readLedger(content), []);
  assert.equal(alreadyReviewed(content, { commitSha: 'abc123' }, 'local'), false);
});

test('alreadyReviewed returns false for empty or non-string mode', () => {
  const content = `${JSON.stringify(firstRecord)}\n`;
  assert.equal(alreadyReviewed(content, { commitSha: 'abc123' }, ''), false);
  assert.equal(alreadyReviewed(content, { commitSha: 'abc123' }, null), false);
});
