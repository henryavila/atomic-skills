import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { collectLessons, applicableLessons, lessonStats } from '../scripts/list-lessons.js';

function writeLessons(path, lessons, extra = {}) {
  mkdirSync(dirname(path), { recursive: true });
  const fm = { schemaVersion: '0.2', slug: 'alpha-f1', projectId: 'proj', parentPlan: 'alpha', lessons, ...extra };
  writeFileSync(path, `---\n${stringifyYaml(fm).trimEnd()}\n---\n`);
}

const L = (over = {}) => ({
  id: 'L-001', statement: 'a real lesson statement here', corrective: 'do the corrective thing next time',
  scope: 'reusable', appliesTo: [], status: 'open', confidence: 2, createdAt: '2026-06-15T00:00:00Z', ...over,
});

test('collectLessons gathers every lesson across projects/<id>/<slug>/lessons/', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-lessons-'));
  try {
    writeLessons(join(root, '.atomic-skills', 'projects', 'proj', 'alpha', 'lessons', 'alpha-f1.md'),
      [L(), L({ id: 'L-002', scope: 'local' })]);
    const all = collectLessons(root);
    assert.equal(all.length, 2);
    assert.equal(all[0].projectId, 'proj');
    assert.equal(all[0].planSlug, 'alpha');
    assert.equal(all[0].initiativeSlug, 'alpha-f1');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('applicableLessons returns ONLY reusable+open lessons whose appliesTo matches the phase', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-lessons-app-'));
  try {
    writeLessons(join(root, '.atomic-skills', 'projects', 'proj', 'alpha', 'lessons', 'alpha-f1.md'), [
      L({ id: 'L-001', scope: 'reusable', appliesTo: [], status: 'open' }),      // all future phases → applies
      L({ id: 'L-002', scope: 'reusable', appliesTo: ['F5'], status: 'open' }),  // only F5
      L({ id: 'L-003', scope: 'local', appliesTo: [], status: 'open' }),         // local → never surfaced
      L({ id: 'L-004', scope: 'reusable', appliesTo: [], status: 'closed' }),    // closed → not surfaced
    ]);
    const f2 = applicableLessons(root, { phaseId: 'F2' }).map((l) => l.id).sort();
    assert.deepEqual(f2, ['L-001'], 'F2 sees only the all-phases reusable open lesson');
    const f5 = applicableLessons(root, { phaseId: 'F5' }).map((l) => l.id).sort();
    assert.deepEqual(f5, ['L-001', 'L-002'], 'F5 additionally sees the F5-targeted lesson');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('lessonStats reports identified/open/closed/stale/reusable/recurrence (deterministic burndown)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-lessons-stats-'));
  try {
    writeLessons(join(root, '.atomic-skills', 'projects', 'proj', 'alpha', 'lessons', 'alpha-f1.md'), [
      L({ id: 'L-001', status: 'open', scope: 'reusable' }),
      L({ id: 'L-002', status: 'closed', scope: 'reusable' }),
      L({ id: 'L-003', status: 'closed', scope: 'reusable', staleReason: 'premise no longer holds' }),
      L({ id: 'L-004', status: 'open', scope: 'local', recurrenceOf: 'L-001' }),
    ]);
    const s = lessonStats(root);
    assert.equal(s.identified, 4);
    assert.equal(s.open, 2);
    assert.equal(s.closed, 2);
    assert.equal(s.stale, 1);
    assert.equal(s.reusable, 3);
    assert.equal(s.recurrence, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
