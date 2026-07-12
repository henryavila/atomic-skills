import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { refreshState } from '../scripts/refresh-state.js';
import { validateAideckState } from '../scripts/validate-aideck-state.js';

const NOW = Date.parse('2026-01-06T00:00:00Z');

function writeSeedState(dir, { completions = true } = {}) {
  const planDir = join(dir, '.atomic-skills', 'projects', 'projA', 'plan-a');
  mkdirSync(join(planDir, 'phases'), { recursive: true });
  mkdirSync(join(dir, '.atomic-skills', 'analytics'), { recursive: true });

  writeFileSync(
    join(planDir, 'plan.md'),
    '---\nslug: plan-a\ntitle: Plan A\nstatus: active\nstarted: "2026-01-01T00:00:00Z"\ndeadline: "2026-01-11T00:00:00Z"\nlastUpdated: "2026-01-05T00:00:00Z"\ncurrentPhase: F1\nphases:\n  - id: F1\n    title: Phase 1\n    status: active\n---\n',
  );
  writeFileSync(
    join(planDir, 'phases', 'f1.md'),
    '---\nslug: f1\ntitle: Phase 1 work\nstatus: active\nphaseId: F1\nparentPlan: plan-a\nlastUpdated: "2026-01-05T12:00:00Z"\ntasks:\n  - id: T-1\n    title: First\n    status: done\n    weight: 2\n  - id: T-2\n    title: Second\n    status: pending\n    weight: 3\n---\n',
  );
  writeFileSync(
    join(dir, '.atomic-skills', 'projects', 'projA', 'PROJECT-STATUS.md'),
    [
      '---',
      'lastUpdated: 2026-01-01T00:00:00Z',
      'schemaVersion: "0.1"',
      'activePlans: 1',
      'activeInitiatives: 1',
      'archivedCount: 0',
      '---',
      '',
      '# Project Status Index',
      '',
      '### plan-a phases',
      '',
      '| Initiative | Phase | Status | Tasks | Gates |',
      '|------------|-------|--------|-------|-------|',
      '| f1 | F1 | pending | 0/2 | 0/0 |',
      '| unrelated-row | F9 | paused | 7/9 | 1/3 |',
      '',
      'Unrelated prose must survive byte-for-byte.',
      '',
    ].join('\n'),
  );

  if (completions) {
    writeFileSync(
      join(dir, '.atomic-skills', 'analytics', 'completions.jsonl'),
      [
        JSON.stringify({ projectId: 'projA', planSlug: 'plan-a', phaseId: 'F1', taskId: 'T-1', ts: '2026-01-03T10:00:00Z', event: 'task-done', weight: 2, weightBasis: 'proxy' }),
        JSON.stringify({ projectId: 'projA', planSlug: 'plan-a', phaseId: 'F1', taskId: 'T-1', ts: '2026-01-03T11:00:00Z', event: 'task-done', weight: 1, weightBasis: 'count' }),
      ].join('\n') + '\n',
    );
  }
}

describe('refreshState consumer series integration', () => {
  it('regenerates burnup/spi while preserving the existing refresh passes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-state-'));
    try {
      writeSeedState(dir);

      const burnupPath = join(dir, '.atomic-skills', '.aideck', 'state', 'burnup.json');
      const spiPath = join(dir, '.atomic-skills', '.aideck', 'state', 'spi.json');
      assert.equal(existsSync(burnupPath), false);

      const summary = refreshState(dir, { nowMs: NOW, branch: null });

      assert.equal(existsSync(burnupPath), true);
      assert.equal(existsSync(spiPath), true);
      const burnup = JSON.parse(readFileSync(burnupPath, 'utf8'));
      const spi = JSON.parse(readFileSync(spiPath, 'utf8'));
      assert.ok(Array.isArray(burnup));
      assert.ok(burnup.length > 0);
      assert.ok(Array.isArray(spi));
      assert.ok(spi.length > 0);

      assert.equal(existsSync(join(dir, '.atomic-skills', 'focus.json')), true);
      assert.equal(Object.hasOwn(summary, 'rollupsChanged'), true);
      assert.equal(Object.hasOwn(summary, 'focusChanged'), true);
      assert.equal(Object.hasOwn(summary, 'digestWritten'), true);
      assert.equal(summary.seriesWritten, 13); // base state series (plans, phases, initiatives, tasks, gates, phaseGates, stack, parked, emerged, projects, planEdges — totals.json retired) + burnup.json + spi.json

      const phases = JSON.parse(readFileSync(join(dir, '.atomic-skills', '.aideck', 'state', 'phases.json'), 'utf8'));
      assert.equal(phases.find((phase) => phase.id === 'F1')?.tasksText, '1/2');

      const validation = validateAideckState(dir, { nowMs: NOW });
      assert.equal(validation.ok, true);
      assert.deepEqual(validation.errors, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns a summary and keeps core outputs when there are zero completion events', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-state-empty-'));
    try {
      writeSeedState(dir, { completions: false });

      const summary = refreshState(dir, { nowMs: NOW, branch: null });

      assert.equal(typeof summary, 'object');
      assert.equal(existsSync(join(dir, '.atomic-skills', 'focus.json')), true);
      const burnup = JSON.parse(readFileSync(join(dir, '.atomic-skills', '.aideck', 'state', 'burnup.json'), 'utf8'));
      const spi = JSON.parse(readFileSync(join(dir, '.atomic-skills', '.aideck', 'state', 'spi.json'), 'utf8'));
      assert.ok(Array.isArray(burnup));
      assert.ok(Array.isArray(spi));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refreshes existing PROJECT-STATUS initiative rows idempotently without touching unrelated content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-state-index-'));
    try {
      writeSeedState(dir);
      const indexPath = join(dir, '.atomic-skills', 'projects', 'projA', 'PROJECT-STATUS.md');
      const shadowInitiativePath = join(
        dir,
        '.atomic-skills',
        'projects',
        'projA',
        'plan-a',
        'phases',
        'completed-plan.md',
      );
      writeFileSync(
        shadowInitiativePath,
        '---\nslug: completed-plan\ntitle: Completed plan phase\nstatus: done\nphaseId: F0\nparentPlan: plan-a\nlastUpdated: "2026-01-04T12:00:00Z"\ntasks:\n  - id: T-1\n    title: Closed\n    status: done\nexitGates:\n  - id: G-1\n    description: Closed gate\n    status: met\n---\n',
      );
      const seededIndex = readFileSync(indexPath, 'utf8').replace(
        'Unrelated prose must survive byte-for-byte.\n',
        [
          'Unrelated prose must survive byte-for-byte.',
          '',
          '## Done Plans (not archived)',
          '',
          '| Slug | Status | Current Phase | Branch | Started | Phases |',
          '|------|--------|---------------|--------|---------|--------|',
          '| completed-plan | done | F0 | plan/completed-plan | 2025-12-01 | 1/1 |',
          '',
        ].join('\n'),
      );
      writeFileSync(indexPath, seededIndex);

      const first = refreshState(dir, { nowMs: NOW, branch: null });
      const once = readFileSync(indexPath, 'utf8');

      assert.match(once, /^lastUpdated: 2026-01-05T12:00:00Z$/m);
      assert.match(once, /^\| f1 \| F1 \| active \| 1\/2 \| 0\/0 \|$/m);
      assert.match(once, /^\| unrelated-row \| F9 \| paused \| 7\/9 \| 1\/3 \|$/m);
      assert.match(
        once,
        /^\| completed-plan \| done \| F0 \| plan\/completed-plan \| 2025-12-01 \| 1\/1 \|$/m,
      );
      assert.match(once, /Unrelated prose must survive byte-for-byte\./);
      assert.equal(first.indexesChanged, 1);

      const second = refreshState(dir, { nowMs: NOW, branch: null });
      const twice = readFileSync(indexPath, 'utf8');
      assert.equal(twice, once);
      assert.equal(second.indexesChanged, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
