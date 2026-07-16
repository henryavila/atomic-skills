import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendCompletion, COMPLETION_EVENTS, WEIGHT_BASES } from '../scripts/append-completion.js';

const LOG = (root) => join(root, '.atomic-skills', 'analytics', 'completions.jsonl');
const base = (over = {}) => ({
  event: 'task-done',
  projectId: 'proj',
  planSlug: 'plan',
  phaseId: 'F0',
  taskId: 'T-001',
  ...over,
});

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

test('appendCompletion is idempotent for the same event identity (dedupe key)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-idemp-'));
  try {
    const first = appendCompletion(root, base({ taskId: 'T-001', ts: '2026-06-01T00:00:00Z' }));
    assert.equal(first.appended, true);
    assert.equal(first.idempotent, false);

    const second = appendCompletion(root, base({
      taskId: 'T-001',
      ts: '2026-06-02T00:00:00Z', // different ts must not mint a second line
      weight: 9,
    }));
    assert.equal(second.appended, false);
    assert.equal(second.idempotent, true);
    assert.equal(second.ts, first.ts, 'returns the original frozen line');
    assert.equal(second.weight, first.weight);

    const lines = readFileSync(LOG(root), 'utf8').trim().split('\n');
    assert.equal(lines.length, 1, 'retry → still one line');
    assert.equal(JSON.parse(lines[0]).taskId, 'T-001');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion still appends when taskId/phaseId/event identity differs', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-ac-idemp2-'));
  try {
    appendCompletion(root, base({ taskId: 'T-001', phaseId: 'F0' }));
    appendCompletion(root, base({ taskId: 'T-002', phaseId: 'F0' }));
    appendCompletion(root, base({ taskId: 'T-001', phaseId: 'F1' }));
    appendCompletion(root, base({ event: 'phase-done', taskId: null, phaseId: 'F0' }));

    const lines = readFileSync(LOG(root), 'utf8').trim().split('\n');
    assert.equal(lines.length, 4, 'distinct identities each get a line');

    // phase-done identity also dedupes
    appendCompletion(root, base({ event: 'phase-done', taskId: null, phaseId: 'F0' }));
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 4);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('completionEventKey / dedupeCompletionEvents collapse logical duplicates', async () => {
  const { completionEventKey, dedupeCompletionEvents } = await import('../scripts/append-completion.js');
  const a = base({ taskId: 'T-001', ts: '2026-01-01T00:00:00Z' });
  const b = base({ taskId: 'T-001', ts: '2026-01-02T00:00:00Z', weight: 5 });
  const c = base({ taskId: 'T-002', ts: '2026-01-03T00:00:00Z' });
  assert.equal(completionEventKey(a), completionEventKey(b));
  assert.notEqual(completionEventKey(a), completionEventKey(c));
  const deduped = dedupeCompletionEvents([a, b, c, a]);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].taskId, 'T-001');
  assert.equal(deduped[1].taskId, 'T-002');
});
