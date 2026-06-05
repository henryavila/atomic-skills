import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { findLevelConfusedTitles } from '../scripts/lint-task-titles.js';

function writeFm(path, obj) {
  writeFileSync(path, `---\n${stringifyYaml(obj).trimEnd()}\n---\n`);
}

test('findLevelConfusedTitles flags task titles that masquerade as phases', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-titles-'));
  try {
    const phases = join(root, '.atomic-skills', 'projects', 'proj', 'alpha', 'phases');
    mkdirSync(phases, { recursive: true });
    writeFm(join(phases, 'f5.md'), {
      slug: 'alpha-f5', phaseId: 'F5', status: 'active',
      tasks: [
        { id: 'T-001', title: 'Phase A — do the thing', status: 'done' },   // confused
        { id: 'T-002', title: 'fix broken plans table', status: 'done' },     // clean
        { id: 'T-003', title: 'Phase out the legacy parser', status: 'done' },// prose, NOT confused
      ],
    });
    const hits = findLevelConfusedTitles(root);
    assert.equal(hits.length, 1, 'exactly one offender');
    assert.equal(hits[0].taskId, 'T-001');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findLevelConfusedTitles returns empty when all task titles are clean', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-titles-ok-'));
  try {
    const phases = join(root, '.atomic-skills', 'projects', 'proj', 'beta', 'phases');
    mkdirSync(phases, { recursive: true });
    writeFm(join(phases, 'f0.md'), { slug: 'beta-f0', phaseId: 'F0', status: 'active', tasks: [{ id: 'T-001', title: 'real work', status: 'pending' }] });
    assert.deepEqual(findLevelConfusedTitles(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
