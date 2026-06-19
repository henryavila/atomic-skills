import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter } from '../scripts/validate-state.js';
import { hardenClosedAt, computeGrandfathered } from '../scripts/harden-closedat.js';

// Build a temp plan dir: <root>/plan.md + <root>/phases/*.md (+ phases/archive/*.md).
function seedPlan(tasksByPhase) {
  const root = mkdtempSync(join(tmpdir(), 'harden-'));
  mkdirSync(join(root, 'phases', 'archive'), { recursive: true });
  writeFileSync(join(root, 'plan.md'), `---\nslug: p\ntitle: P\n---\n\n# P\n`);
  for (const [file, { dir, tasks }] of Object.entries(tasksByPhase)) {
    const base = dir === 'archive' ? join(root, 'phases', 'archive') : join(root, 'phases');
    const fm = { slug: file, parentPlan: 'p', tasks };
    const yaml = tasks
      .map((t) => `  - id: ${t.id}\n    status: ${t.status}${t.closedAt ? `\n    closedAt: ${t.closedAt}` : ''}`)
      .join('\n');
    writeFileSync(join(base, `${file}.md`), `---\nslug: ${file}\nparentPlan: p\ntasks:\n${yaml}\n---\n\n# ${file}\n`);
    void fm;
  }
  return root;
}

test('computeGrandfathered collects done tasks WITHOUT closedAt across phases + archive', () => {
  const root = seedPlan({
    'p-f0': { dir: 'archive', tasks: [{ id: 'T-009', status: 'done' }] },
    'p-f1': { dir: 'phases', tasks: [
      { id: 'T-001', status: 'done', closedAt: '2026-06-19T10:00:00Z' },
      { id: 'T-002', status: 'done' },
      { id: 'T-003', status: 'pending' },
    ] },
  });
  try {
    const ids = computeGrandfathered(root).sort();
    assert.deepEqual(ids, ['T-002', 'T-009']); // T-001 has closedAt; T-003 not done
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hardenClosedAt writes closedAtHardening with enforcedFrom + grandfathered ids', () => {
  const root = seedPlan({
    'p-f1': { dir: 'phases', tasks: [
      { id: 'T-001', status: 'done', closedAt: '2026-06-19T10:00:00Z' },
      { id: 'T-002', status: 'done' },
    ] },
  });
  try {
    const r = hardenClosedAt(join(root, 'plan.md'), '2026-06-19T19:00:00Z');
    assert.equal(r.changed, true);
    assert.equal(r.enforcedFrom, '2026-06-19T19:00:00Z');
    assert.deepEqual(r.grandfatheredTaskIds, ['T-002']);

    const fm = parseFrontmatter(readFileSync(join(root, 'plan.md'), 'utf8')).frontmatter;
    assert.equal(fm.closedAtHardening.enforcedFrom, '2026-06-19T19:00:00Z');
    assert.deepEqual(fm.closedAtHardening.grandfatheredTaskIds, ['T-002']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hardenClosedAt is idempotent — rerun does not change the set nor rewrite enforcedFrom', () => {
  const root = seedPlan({
    'p-f1': { dir: 'phases', tasks: [{ id: 'T-002', status: 'done' }] },
  });
  try {
    const first = hardenClosedAt(join(root, 'plan.md'), '2026-06-19T19:00:00Z');
    assert.equal(first.changed, true);

    // A second run with a DIFFERENT timestamp must be a no-op.
    const second = hardenClosedAt(join(root, 'plan.md'), '2027-01-01T00:00:00Z');
    assert.equal(second.changed, false);
    assert.equal(second.enforcedFrom, '2026-06-19T19:00:00Z'); // unchanged

    const fm = parseFrontmatter(readFileSync(join(root, 'plan.md'), 'utf8')).frontmatter;
    assert.equal(fm.closedAtHardening.enforcedFrom, '2026-06-19T19:00:00Z');
    assert.deepEqual(fm.closedAtHardening.grandfatheredTaskIds, ['T-002']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hardenClosedAt never invents closedAt on any task (P3)', () => {
  const root = seedPlan({
    'p-f1': { dir: 'phases', tasks: [{ id: 'T-002', status: 'done' }] },
  });
  try {
    hardenClosedAt(join(root, 'plan.md'), '2026-06-19T19:00:00Z');
    const fm = parseFrontmatter(readFileSync(join(root, 'phases', 'p-f1.md'), 'utf8')).frontmatter;
    const t = fm.tasks.find((x) => x.id === 'T-002');
    assert.equal('closedAt' in t, false); // still no closedAt — grandfathered, not backfilled
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
