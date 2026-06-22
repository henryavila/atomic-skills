import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter } from '../scripts/validate-state.js';
import { hardenClosedAt, computeGrandfathered } from '../scripts/harden-closedat.js';

const taskYaml = (tasks) => tasks
  .map((t) => `  - id: ${t.id}\n    status: ${t.status}${t.closedAt ? `\n    closedAt: ${t.closedAt}` : ''}`)
  .join('\n');

// Nested layout: <root>/plan.md + <root>/phases/<file>.md (+ phases/archive/).
// phases: { <fileSlug>: { dir: 'phases'|'archive', phaseId, tasks } }
function seedPlan(phases) {
  const root = mkdtempSync(join(tmpdir(), 'harden-'));
  mkdirSync(join(root, 'phases', 'archive'), { recursive: true });
  writeFileSync(join(root, 'plan.md'), `---\nslug: p\ntitle: P\n---\n\n# P\n`);
  for (const [file, { dir, phaseId, tasks }] of Object.entries(phases)) {
    const base = dir === 'archive' ? join(root, 'phases', 'archive') : join(root, 'phases');
    writeFileSync(
      join(base, `${file}.md`),
      `---\nslug: ${file}\nparentPlan: p\nphaseId: ${phaseId}\ntasks:\n${taskYaml(tasks)}\n---\n\n# ${file}\n`,
    );
  }
  return root;
}

test('computeGrandfathered collects PHASE-SCOPED keys for done tasks WITHOUT closedAt (phases + archive)', () => {
  const root = seedPlan({
    'p-f0': { dir: 'archive', phaseId: 'F0', tasks: [{ id: 'T-009', status: 'done' }] },
    'p-f1': { dir: 'phases', phaseId: 'F1', tasks: [
      { id: 'T-001', status: 'done', closedAt: '2026-06-19T10:00:00Z' },
      { id: 'T-002', status: 'done' },
      { id: 'T-003', status: 'pending' },
    ] },
  });
  try {
    // F0/T-009 + F1/T-002 only: T-001 has closedAt; T-003 is not done.
    assert.deepEqual(computeGrandfathered(root, 'p'), ['F0/T-009', 'F1/T-002']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('computeGrandfathered keys the SAME taskId in different phases as DISTINCT keys (F-001)', () => {
  const root = seedPlan({
    'p-f0': { dir: 'archive', phaseId: 'F0', tasks: [{ id: 'T-001', status: 'done' }] },
    'p-f1': { dir: 'phases', phaseId: 'F1', tasks: [{ id: 'T-001', status: 'done' }] },
  });
  try {
    assert.deepEqual(computeGrandfathered(root, 'p'), ['F0/T-001', 'F1/T-001']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('computeGrandfathered handles the legacy FLAT layout (plans/ + shared initiatives/) filtered by parentPlan (F-002)', () => {
  const root = mkdtempSync(join(tmpdir(), 'harden-flat-'));
  try {
    mkdirSync(join(root, 'plans'), { recursive: true });
    mkdirSync(join(root, 'initiatives'), { recursive: true });
    writeFileSync(join(root, 'plans', 'p.md'), `---\nslug: p\ntitle: P\n---\n\n# P\n`);
    writeFileSync(join(root, 'initiatives', 'f0.md'),
      `---\nslug: f0\nparentPlan: p\nphaseId: F0\ntasks:\n${taskYaml([{ id: 'T-001', status: 'done' }])}\n---\n\n# f0\n`);
    // A different plan's initiative in the shared dir must NOT be grandfathered for p.
    writeFileSync(join(root, 'initiatives', 'q0.md'),
      `---\nslug: q0\nparentPlan: q\nphaseId: F0\ntasks:\n${taskYaml([{ id: 'T-001', status: 'done' }])}\n---\n\n# q0\n`);
    assert.deepEqual(computeGrandfathered(join(root, 'plans'), 'p'), ['F0/T-001']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hardenClosedAt writes closedAtHardening with enforcedFrom + phase-scoped grandfathered keys', () => {
  const root = seedPlan({
    'p-f1': { dir: 'phases', phaseId: 'F1', tasks: [
      { id: 'T-001', status: 'done', closedAt: '2026-06-19T10:00:00Z' },
      { id: 'T-002', status: 'done' },
    ] },
  });
  try {
    const r = hardenClosedAt(join(root, 'plan.md'), '2026-06-19T19:00:00Z');
    assert.equal(r.changed, true);
    assert.equal(r.enforcedFrom, '2026-06-19T19:00:00Z');
    assert.deepEqual(r.grandfatheredTaskIds, ['F1/T-002']);

    const fm = parseFrontmatter(readFileSync(join(root, 'plan.md'), 'utf8')).frontmatter;
    assert.equal(fm.closedAtHardening.enforcedFrom, '2026-06-19T19:00:00Z');
    assert.deepEqual(fm.closedAtHardening.grandfatheredTaskIds, ['F1/T-002']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hardenClosedAt is idempotent — rerun does not change the set nor rewrite enforcedFrom', () => {
  const root = seedPlan({
    'p-f1': { dir: 'phases', phaseId: 'F1', tasks: [{ id: 'T-002', status: 'done' }] },
  });
  try {
    const first = hardenClosedAt(join(root, 'plan.md'), '2026-06-19T19:00:00Z');
    assert.equal(first.changed, true);

    const second = hardenClosedAt(join(root, 'plan.md'), '2027-01-01T00:00:00Z');
    assert.equal(second.changed, false);
    assert.equal(second.enforcedFrom, '2026-06-19T19:00:00Z');

    const fm = parseFrontmatter(readFileSync(join(root, 'plan.md'), 'utf8')).frontmatter;
    assert.equal(fm.closedAtHardening.enforcedFrom, '2026-06-19T19:00:00Z');
    assert.deepEqual(fm.closedAtHardening.grandfatheredTaskIds, ['F1/T-002']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hardenClosedAt never invents closedAt on any task (P3)', () => {
  const root = seedPlan({
    'p-f1': { dir: 'phases', phaseId: 'F1', tasks: [{ id: 'T-002', status: 'done' }] },
  });
  try {
    hardenClosedAt(join(root, 'plan.md'), '2026-06-19T19:00:00Z');
    const fm = parseFrontmatter(readFileSync(join(root, 'phases', 'p-f1.md'), 'utf8')).frontmatter;
    const t = fm.tasks.find((x) => x.id === 'T-002');
    assert.equal('closedAt' in t, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
