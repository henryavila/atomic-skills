import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { findMissingSummaries } from '../scripts/find-missing-summaries.js';

function writeFm(path, obj) {
  writeFileSync(path, `---\n${stringifyYaml(obj).trimEnd()}\n---\n`);
}

test('findMissingSummaries reports descriptor + initiative gaps, skips summarized phases', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-summ-'));
  try {
    const plan = join(root, '.atomic-skills', 'projects', 'proj', 'alpha');
    mkdirSync(join(plan, 'phases'), { recursive: true });
    writeFm(join(plan, 'plan.md'), {
      slug: 'alpha', status: 'active', currentPhase: 'F1',
      phases: [
        { id: 'F0', status: 'done', summary: 'has one' }, // fully covered
        { id: 'F1', status: 'active' },                     // descriptor missing
      ],
    });
    // F0 initiative missing summary; F1 initiative present (so F1 only misses the descriptor).
    writeFm(join(plan, 'phases', 'f0.md'), { slug: 'a-f0', phaseId: 'F0', status: 'done' });
    writeFm(join(plan, 'phases', 'f1.md'), { slug: 'a-f1', phaseId: 'F1', status: 'active', summary: 'init has it' });

    const report = findMissingSummaries(root);
    assert.equal(report.length, 1, 'one plan with gaps');
    const slots = report[0].missing.map((m) => `${m.phaseId}:${m.where}`).sort();
    assert.deepEqual(slots, ['F0:initiative', 'F1:descriptor'], 'exactly the two real gaps');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findMissingSummaries also scans flat legacy plans/*.md + initiatives/*.md', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-summ-flat-'));
  try {
    const flat = join(root, '.atomic-skills');
    mkdirSync(join(flat, 'plans'), { recursive: true });
    mkdirSync(join(flat, 'initiatives'), { recursive: true });
    // flat plan: F0 descriptor has summary, F1 descriptor missing
    writeFm(join(flat, 'plans', 'gamma.md'), {
      slug: 'gamma', status: 'active', currentPhase: 'F0',
      phases: [{ id: 'F0', status: 'active', summary: 'ok' }, { id: 'F1', status: 'pending' }],
    });
    // flat initiative missing its own summary
    writeFm(join(flat, 'initiatives', 'gamma-f1.md'), { slug: 'gamma-f1', phaseId: 'F1', status: 'pending' });
    // flat initiative that HAS a summary → not reported
    writeFm(join(flat, 'initiatives', 'gamma-f0.md'), { slug: 'gamma-f0', phaseId: 'F0', status: 'active', summary: 'present' });

    const report = findMissingSummaries(root);
    const flatEntries = report.filter((r) => r.projectId === '(flat)');
    assert.equal(flatEntries.length, 2, 'descriptor gap + initiative gap both surfaced');
    const labels = flatEntries.map((r) => `${r.planSlug}:${r.missing.map((m) => m.where).join(',')}`).sort();
    assert.deepEqual(labels, ['gamma:descriptor', 'initiatives/gamma-f1:initiative']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findMissingSummaries returns empty when every phase is summarized', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-summ-ok-'));
  try {
    const plan = join(root, '.atomic-skills', 'projects', 'proj', 'beta');
    mkdirSync(join(plan, 'phases'), { recursive: true });
    writeFm(join(plan, 'plan.md'), { slug: 'beta', status: 'active', currentPhase: 'F0', phases: [{ id: 'F0', status: 'active', summary: 'x' }] });
    writeFm(join(plan, 'phases', 'f0.md'), { slug: 'b-f0', phaseId: 'F0', status: 'active', summary: 'y' });
    assert.deepEqual(findMissingSummaries(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
