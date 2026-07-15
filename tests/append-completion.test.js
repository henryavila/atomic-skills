import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  appendFileSync, mkdtempSync, rmSync, readFileSync, existsSync, readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendCompletion,
  ensureCompletion,
  COMPLETION_EVENTS,
  WEIGHT_BASES,
} from '../scripts/append-completion.js';

const LOG = (root) => join(root, '.atomic-skills', 'analytics', 'completions.jsonl');
const base = (over = {}) => ({
  event: 'task-done',
  projectId: 'proj',
  planSlug: 'plan',
  phaseId: 'F0',
  taskId: 'T-001',
  ...over,
});

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

test('append-completion: enums are the three events + two bases', () => {
  assert.deepEqual([...COMPLETION_EVENTS].sort(), ['phase-done', 'reconcile', 'task-done']);
  assert.deepEqual([...WEIGHT_BASES].sort(), ['count', 'proxy']);
});

test('appendCompletion writes exactly one valid JSON line with defaults', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    appendCompletion(root, base());
    assert.ok(existsSync(LOG(root)), 'log created');
    const lines = readFileSync(LOG(root), 'utf8').trim().split('\n');
    assert.equal(lines.length, 1, 'one call → one line');
    const rec = JSON.parse(lines[0]);
    assert.equal(rec.event, 'task-done');
    assert.equal(rec.weight, 1, 'weight defaults to 1');
    assert.equal(rec.weightBasis, 'count', 'weightBasis defaults to count');
    assert.ok(typeof rec.ts === 'string' && rec.ts.length > 0, 'ts present');
    assert.equal(rec.taskId, 'T-001');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('analytics/ created idempotently; appends never rewrite/reorder prior lines', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    appendCompletion(root, base({ taskId: 'T-001', ts: '2026-06-01T00:00:00Z' }));
    const firstLine = readFileSync(LOG(root), 'utf8').trim();
    appendCompletion(root, base({ taskId: 'T-002', ts: '2026-06-02T00:00:00Z' }));
    appendCompletion(root, base({ taskId: 'T-003', ts: '2026-06-03T00:00:00Z' }));
    const lines = readFileSync(LOG(root), 'utf8').trim().split('\n');
    assert.equal(lines.length, 3, 'three appends → three lines');
    assert.equal(lines[0], firstLine, 'first line byte-identical (never rewritten)');
    assert.deepEqual(lines.map((l) => JSON.parse(l).taskId), ['T-001', 'T-002', 'T-003'], 'order preserved');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion carries an explicit proxy weight/basis', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    appendCompletion(root, base({ weight: 5, weightBasis: 'proxy' }));
    const rec = JSON.parse(readFileSync(LOG(root), 'utf8').trim());
    assert.equal(rec.weight, 5);
    assert.equal(rec.weightBasis, 'proxy');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion allows a phase-done event with no taskId', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    appendCompletion(root, { event: 'phase-done', projectId: 'proj', planSlug: 'plan', phaseId: 'F0' });
    const rec = JSON.parse(readFileSync(LOG(root), 'utf8').trim());
    assert.equal(rec.event, 'phase-done');
    assert.equal(rec.taskId, null, 'taskId defaults to null when absent');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('completion lock ownership includes process-start identity', () => {
  const root = mkdtempSync(join(tmpdir(), 'completion-lock-identity-'));
  try {
    ensureCompletion(root, {
      event: 'task-done', projectId: 'p', planSlug: 'plan', phaseId: 'F0',
      taskId: 'T-1', idempotencyKey: 'task-done:p/plan/F0/T-1@close',
      ts: '2026-07-14T20:00:00Z',
    }, {
      beforeAppend: () => {
        const owner = JSON.parse(readFileSync(
          join(root, '.atomic-skills', 'analytics', '.completions.lock'),
          'utf8',
        ));
        assert.match(owner.processIdentity, /:/);
      },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion rejects an event outside the enum and writes nothing', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    assert.throws(() => appendCompletion(root, base({ event: 'bogus' })), /event/);
    assert.ok(!existsSync(LOG(root)), 'nothing written on rejection');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion rejects a weightBasis outside the enum', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    assert.throws(() => appendCompletion(root, base({ weightBasis: 'guess' })), /weightBasis/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion requires projectId/planSlug/phaseId', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    assert.throws(() => appendCompletion(root, { event: 'task-done', planSlug: 'p', phaseId: 'F0' }), /projectId/);
    assert.throws(() => appendCompletion(root, { event: 'task-done', projectId: 'p', phaseId: 'F0' }), /planSlug/);
    assert.throws(() => appendCompletion(root, { event: 'task-done', projectId: 'p', planSlug: 'p' }), /phaseId/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion writes ONLY under .atomic-skills/analytics/ (never a .md)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    appendCompletion(root, base());
    const asDir = join(root, '.atomic-skills');
    assert.deepEqual(readdirSync(asDir), ['analytics'], 'only analytics/ created under .atomic-skills');
    assert.deepEqual(readdirSync(join(asDir, 'analytics')), ['completions.jsonl']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion rejects a task-done event with no taskId and writes nothing', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    // valid scope fields so the throw is the taskId guard, not a scope check
    assert.throws(() => appendCompletion(root, { event: 'task-done', projectId: 'p', planSlug: 'p', phaseId: 'F0' }), /taskId/);
    assert.throws(() => appendCompletion(root, base({ taskId: '' })), /taskId/);
    assert.ok(!existsSync(LOG(root)), 'nothing written on rejection');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion rejects actuals with an unknown key and writes nothing', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    assert.throws(
      () => appendCompletion(root, { event: 'phase-done', projectId: 'p', planSlug: 'p', phaseId: 'F0', actuals: { filesChanged: 2, reviewer: 1 } }),
      /unknown actuals field/,
    );
    assert.ok(!existsSync(LOG(root)), 'nothing written on rejection');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion rejects actuals with a non-number value', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    assert.throws(
      () => appendCompletion(root, { event: 'phase-done', projectId: 'p', planSlug: 'p', phaseId: 'F0', actuals: { filesChanged: 'lots' } }),
      /finite number/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion writes a valid actuals sub-object verbatim', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    appendCompletion(root, { event: 'phase-done', projectId: 'p', planSlug: 'p', phaseId: 'F0', actuals: { filesChanged: 3, locAdded: 40, commits: 1 } });
    const rec = JSON.parse(readFileSync(LOG(root), 'utf8').trim());
    assert.deepEqual(rec.actuals, { filesChanged: 3, locAdded: 40, commits: 1 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion rejects an unparseable ts and writes nothing', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    assert.throws(() => appendCompletion(root, base({ ts: 'not-a-date' })), /parseable date-time/);
    assert.ok(!existsSync(LOG(root)), 'nothing written on rejection');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion requires reconcile events to carry a null-task tombstone', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    assert.throws(
      () => appendCompletion(root, {
        event: 'reconcile', projectId: 'p', planSlug: 'p', phaseId: 'F0', taskId: null,
      }),
      /reconciliation.*required/i,
    );
    assert.throws(
      () => appendCompletion(root, {
        event: 'reconcile', projectId: 'p', planSlug: 'p', phaseId: 'F0', taskId: 'T-1',
        reconciliation: {
          action: 'ignore-duplicate-completion',
          eventIdentity: 'phase-done:p/p/F0@2026-07-14T20:00:00Z',
          canonicalDigest: 'a'.repeat(64),
          duplicateDigests: ['b'.repeat(64)],
        },
      }),
      /taskId.*null/i,
    );
    assert.ok(!existsSync(LOG(root)), 'nothing written on rejection');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ensureCompletion retries one idempotency key as one immutable event', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    const first = ensureCompletion(root, base({
      idempotencyKey: 'task-done:proj/plan/F0/T-001@2026-07-14T20:00:00Z',
      ts: '2026-07-14T20:00:00Z',
    }));
    const retry = ensureCompletion(root, base({
      idempotencyKey: 'task-done:proj/plan/F0/T-001@2026-07-14T20:00:00Z',
      ts: '2026-07-14T20:00:01Z',
    }));
    const lines = readFileSync(LOG(root), 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);
    assert.equal(first.appended, true);
    assert.equal(retry.appended, false);
    assert.deepEqual(retry.record, first.record);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ensureCompletion fails closed when one idempotency key changes semantic identity', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    const idempotencyKey = 'task-done:proj/plan/F0/T-001@2026-07-14T20:00:00Z';
    ensureCompletion(root, base({ idempotencyKey }));
    assert.throws(
      () => ensureCompletion(root, base({ idempotencyKey, taskId: 'T-999' })),
      /idempotency key conflict/i,
    );
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ensureCompletion rejects payload drift behind one logical close key', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-'));
  try {
    const idempotencyKey = 'task-done:proj/plan/F0/T-001@2026-07-14T20:00:00Z';
    ensureCompletion(root, base({ idempotencyKey, weight: 1 }));
    assert.throws(
      () => ensureCompletion(root, base({ idempotencyKey, weight: 9 })),
      /idempotency key conflict/i,
    );
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ensureCompletion rejects an unneutralized duplicate for the same idempotency key', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-duplicate-key-'));
  try {
    const idempotencyKey = 'task-done:proj/plan/F0/T-001@2026-07-14T20:00:00Z';
    const first = ensureCompletion(root, base({ idempotencyKey, ts: '2026-07-14T20:00:00Z' }));
    appendFileSync(LOG(root), `${JSON.stringify({ ...first.record, ts: '2026-07-14T20:00:01Z' })}\n`);
    assert.throws(
      () => ensureCompletion(root, base({ idempotencyKey, ts: '2026-07-14T20:00:00Z' })),
      /duplicate.*idempotency|idempotency.*duplicate/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ensureCompletion accepts exact duplicates only with one exact reconciliation tombstone', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-reconciled-key-'));
  try {
    const idempotencyKey = 'task-done:proj/plan/F0/T-001@2026-07-14T20:00:00Z';
    const first = ensureCompletion(root, base({ idempotencyKey, ts: '2026-07-14T20:00:00Z' }));
    const duplicate = { ...first.record, ts: '2026-07-14T20:00:01Z' };
    appendFileSync(LOG(root), `${JSON.stringify(duplicate)}\n`);
    appendCompletion(root, {
      event: 'reconcile', projectId: 'proj', planSlug: 'plan', phaseId: 'F0', taskId: null,
      reconciliation: {
        action: 'ignore-duplicate-completion',
        eventIdentity: 'task-done:T-001',
        canonicalDigest: digest(first.record),
        duplicateDigests: [digest(duplicate)],
      },
    });
    const retry = ensureCompletion(root, base({ idempotencyKey, ts: '2026-07-14T20:00:00Z' }));
    assert.equal(retry.appended, false);
    assert.deepEqual(retry.record, first.record);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
