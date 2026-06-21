import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { findUnweightedTasks } from '../scripts/find-unweighted-tasks.js';

function writeFm(path, obj) {
  writeFileSync(path, `---\n${stringifyYaml(obj).trimEnd()}\n---\n`);
}

test('findUnweightedTasks flags tasks lacking a numeric weight, per initiative', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-taskweight-'));
  try {
    const phases = join(root, '.atomic-skills', 'projects', 'proj', 'alpha', 'phases');
    mkdirSync(phases, { recursive: true });
    writeFm(join(phases, 'f5.md'), {
      slug: 'alpha-f5', phaseId: 'F5', status: 'active',
      tasks: [
        { id: 'T-001', title: 'do the thing', weight: 2, status: 'done' }, // has weight
        { id: 'T-002', title: 'fix the table', status: 'active' },          // missing
        { id: 'T-003', title: 'zero weight', weight: 0, status: 'pending' }, // 0 is valid
        { id: 'T-004', title: 'string weight', weight: '2', status: 'pending' }, // non-number
      ],
    });
    const report = findUnweightedTasks(root);
    assert.equal(report.length, 1, 'one initiative reported');
    assert.equal(report[0].projectId, 'proj');
    assert.equal(report[0].planSlug, 'alpha');
    assert.equal(report[0].phaseFile, 'f5.md');
    assert.deepEqual(report[0].missing.map((m) => m.taskId), ['T-002', 'T-004']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findUnweightedTasks also scans flat legacy initiatives/*.md (no false green)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-taskweight-flat-'));
  try {
    const flat = join(root, '.atomic-skills', 'initiatives');
    mkdirSync(join(flat, 'archive'), { recursive: true });
    writeFm(join(flat, 'legacy-init.md'), {
      slug: 'legacy-init', status: 'active',
      tasks: [
        { id: 'T-001', title: 'has one', weight: 1, status: 'done' },
        { id: 'T-002', title: 'no weight', status: 'pending' }, // missing
      ],
    });
    // archived flat initiative must be skipped (not required to have weights)
    writeFm(join(flat, 'archive', 'old.md'), { slug: 'old', status: 'archived', tasks: [{ id: 'T-001', title: 'x', status: 'done' }] });
    const report = findUnweightedTasks(root);
    assert.equal(report.length, 1, 'flat tree is scanned, not silently green');
    assert.equal(report[0].projectId, '(flat)');
    assert.equal(report[0].planSlug, 'initiatives');
    assert.equal(report[0].phaseFile, 'legacy-init.md');
    assert.deepEqual(report[0].missing.map((m) => m.taskId), ['T-002']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findUnweightedTasks returns empty when every task has a numeric weight', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-taskweight-ok-'));
  try {
    const phases = join(root, '.atomic-skills', 'projects', 'proj', 'beta', 'phases');
    mkdirSync(phases, { recursive: true });
    writeFm(join(phases, 'f0.md'), {
      slug: 'beta-f0', phaseId: 'F0', status: 'active',
      tasks: [{ id: 'T-001', title: 'real work', weight: 1, status: 'pending' }],
    });
    // Initiative with no tasks[] at all -> nothing to report.
    writeFm(join(phases, 'f1.md'), { slug: 'beta-f1', phaseId: 'F1', status: 'pending' });
    assert.deepEqual(findUnweightedTasks(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
