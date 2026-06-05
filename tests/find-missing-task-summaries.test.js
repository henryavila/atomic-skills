import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { findMissingTaskSummaries } from '../scripts/find-missing-task-summaries.js';

function writeFm(path, obj) {
  writeFileSync(path, `---\n${stringifyYaml(obj).trimEnd()}\n---\n`);
}

test('findMissingTaskSummaries flags tasks lacking a summary, per initiative', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-tasksum-'));
  try {
    const phases = join(root, '.atomic-skills', 'projects', 'proj', 'alpha', 'phases');
    mkdirSync(phases, { recursive: true });
    writeFm(join(phases, 'f5.md'), {
      slug: 'alpha-f5', phaseId: 'F5', status: 'active',
      tasks: [
        { id: 'T-001', title: 'do the thing', summary: 'faz a coisa', status: 'done' }, // has summary
        { id: 'T-002', title: 'fix the table', status: 'active' },                       // missing
        { id: 'T-003', title: 'blank summary', summary: '   ', status: 'pending' },       // blank → missing
      ],
    });
    const report = findMissingTaskSummaries(root);
    assert.equal(report.length, 1, 'one initiative reported');
    assert.equal(report[0].projectId, 'proj');
    assert.equal(report[0].planSlug, 'alpha');
    assert.equal(report[0].phaseFile, 'f5.md');
    assert.deepEqual(report[0].missing.map((m) => m.taskId), ['T-002', 'T-003']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findMissingTaskSummaries also scans flat legacy initiatives/*.md (no false green)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-tasksum-flat-'));
  try {
    const flat = join(root, '.atomic-skills', 'initiatives');
    mkdirSync(join(flat, 'archive'), { recursive: true });
    writeFm(join(flat, 'legacy-init.md'), {
      slug: 'legacy-init', status: 'active',
      tasks: [
        { id: 'T-001', title: 'has one', summary: 'tem resumo', status: 'done' },
        { id: 'T-002', title: 'no summary', status: 'pending' }, // missing
      ],
    });
    // archived flat initiative must be skipped (not required to have summaries)
    writeFm(join(flat, 'archive', 'old.md'), { slug: 'old', status: 'archived', tasks: [{ id: 'T-001', title: 'x', status: 'done' }] });
    const report = findMissingTaskSummaries(root);
    assert.equal(report.length, 1, 'flat tree is scanned, not silently green');
    assert.equal(report[0].projectId, '(flat)');
    assert.equal(report[0].planSlug, 'initiatives');
    assert.equal(report[0].phaseFile, 'legacy-init.md');
    assert.deepEqual(report[0].missing.map((m) => m.taskId), ['T-002']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findMissingTaskSummaries returns empty when every task has a summary', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-tasksum-ok-'));
  try {
    const phases = join(root, '.atomic-skills', 'projects', 'proj', 'beta', 'phases');
    mkdirSync(phases, { recursive: true });
    writeFm(join(phases, 'f0.md'), {
      slug: 'beta-f0', phaseId: 'F0', status: 'active',
      tasks: [{ id: 'T-001', title: 'real work', summary: 'trabalho real', status: 'pending' }],
    });
    // Initiative with no tasks[] at all → nothing to report.
    writeFm(join(phases, 'f1.md'), { slug: 'beta-f1', phaseId: 'F1', status: 'pending' });
    assert.deepEqual(findMissingTaskSummaries(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
