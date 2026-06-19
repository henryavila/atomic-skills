import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import {
  buildSeries,
  emitConsumerState,
} from '../scripts/emit-consumer-state.js';
import { validateAideckState } from '../scripts/validate-aideck-state.js';

const NOW = Date.parse('2026-01-06T00:00:00Z');
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function seriesTree() {
  return {
    plans: [
      {
        projectId: 'projA',
        planSlug: 'plan-a',
        fm: { started: '2026-01-01T00:00:00Z', deadline: '2026-01-11T00:00:00Z' },
      },
      {
        projectId: 'projA',
        planSlug: 'plan-b',
        fm: { started: '2026-01-01T00:00:00Z', deadline: '2026-01-21T00:00:00Z' },
      },
      {
        projectId: 'projA',
        planSlug: 'plan-c',
        fm: { started: '2026-01-01T00:00:00Z' },
      },
    ],
    initiatives: [
      {
        projectId: 'projA',
        planSlug: 'plan-a',
        fm: { tasks: [{ id: 'T-1', weight: 2 }, { id: 'T-2', weight: 3 }, { id: 'T-3', weight: 5 }] },
      },
      {
        projectId: 'projA',
        planSlug: 'plan-b',
        fm: { tasks: [{ id: 'T-1', weight: 1 }, { id: 'T-2', weight: 1 }] },
      },
      {
        projectId: 'projA',
        planSlug: 'plan-c',
        fm: { tasks: [{ id: 'T-1' }] },
      },
    ],
  };
}

const completionLines = [
  { projectId: 'projA', planSlug: 'plan-a', ts: '2026-01-03T10:00:00Z', event: 'task-done', weight: 2, weightBasis: 'proxy' },
  { projectId: 'projA', planSlug: 'plan-a', ts: '2026-01-03T11:00:00Z', event: 'task-done', weight: 1, weightBasis: 'count' },
  { projectId: 'projA', planSlug: 'plan-a', ts: '2026-01-05T09:00:00Z', event: 'task-done', weight: 3, weightBasis: 'proxy' },
  { projectId: 'projA', planSlug: 'plan-b', ts: '2026-01-04T09:00:00Z', event: 'task-done', weight: 1, weightBasis: 'count' },
  // phase-done aggregate event (taskId null; producer defaults weight 1 / basis count
  // per project-transitions.md): must be EXCLUDED from earned — the per-task task-done
  // events already account for the work; summing it would double-count earned weight.
  { projectId: 'projA', planSlug: 'plan-a', ts: '2026-01-05T13:00:00Z', event: 'phase-done', weight: 1, weightBasis: 'count' },
];

describe('buildSeries', () => {
  it('builds per-plan burn-up buckets and SPI without mixing plans or emitting non-finite numbers', () => {
    const { burnup, spi } = buildSeries(seriesTree(), completionLines, NOW);

    const planA = burnup.filter((r) => r.planSlug === 'plan-a');
    const planB = burnup.filter((r) => r.planSlug === 'plan-b');
    const planC = burnup.filter((r) => r.planSlug === 'plan-c');

    assert.equal(planA.length, 2);
    assert.deepEqual(planA.map((r) => r.date), ['2026-01-03', '2026-01-05']);
    assert.equal(planB.length, 1);
    assert.equal(planB[0].date, '2026-01-04');
    assert.equal(planB[0].earnedProxy, 0);
    assert.equal(planB[0].earnedCount, 1);

    assert.equal(planA[0].earnedProxy, 2);
    assert.equal(planA[0].earnedCount, 1);
    assert.equal(planA[0].plannedValue, 2);
    assert.equal(planA[1].earnedProxy, 5);
    // double-count guard (finding #1): the 2026-01-05 phase-done aggregate event
    // (weight 1/count) must be excluded from earned. Drop the `event === 'task-done'`
    // filter in buildSeries and earnedCount here becomes 2 (task-done + phase-done) — RED.
    assert.equal(planA[1].earnedCount, 1);
    assert.equal(planA[1].plannedValue, 4);
    assert.ok(planA[1].plannedValue > planA[0].plannedValue);

    const planASpi = spi.find((r) => r.planSlug === 'plan-a');
    assert.equal(planASpi.spiProxy, 1);
    assert.ok(Math.abs(planASpi.spiCount - (1 / 1.5)) < 1e-9);

    assert.ok(planC.every((r) => r.plannedValue === null));
    const planCSpi = spi.find((r) => r.planSlug === 'plan-c');
    assert.equal(planCSpi.spiProxy, null);
    assert.equal(planCSpi.spiCount, null);

    for (const row of burnup) {
      for (const field of ['plannedValue', 'earnedCount', 'earnedProxy']) {
        assert.ok(row[field] === null || Number.isFinite(row[field]), `${field} must be finite or null`);
      }
    }
    for (const row of spi) {
      for (const field of ['spiProxy', 'spiCount']) {
        assert.ok(row[field] === null || Number.isFinite(row[field]), `${field} must be finite or null`);
      }
    }
  });
});

describe('emitConsumerState series round trip', () => {
  it('writes burnup/spi bare arrays and keeps emitted state schema-valid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'emit-series-'));
    try {
      const planDir = join(dir, '.atomic-skills', 'projects', 'projA', 'plan-a');
      mkdirSync(join(planDir, 'phases'), { recursive: true });
      mkdirSync(join(dir, '.atomic-skills', 'analytics'), { recursive: true });

      writeFileSync(
        join(planDir, 'plan.md'),
        '---\nslug: plan-a\ntitle: Plan A\nstatus: active\nstarted: "2026-01-01T00:00:00Z"\ndeadline: "2026-01-11T00:00:00Z"\nlastUpdated: "2026-01-05T00:00:00Z"\ncurrentPhase: F1\nphases:\n  - id: F1\n    title: Phase 1\n    status: active\n---\n',
      );
      writeFileSync(
        join(planDir, 'phases', 'f1-x.md'),
        '---\nslug: f1-x\ntitle: Phase 1 work\nstatus: active\nphaseId: F1\nparentPlan: plan-a\ntasksDone: 1\ntasksTotal: 2\nweightDone: 2\nweightTotal: 5\ntasks:\n  - id: T-1\n    title: First\n    status: done\n    weight: 2\n  - id: T-2\n    title: Second\n    status: pending\n    weight: 3\n---\n',
      );
      writeFileSync(
        join(dir, '.atomic-skills', 'analytics', 'completions.jsonl'),
        [
          JSON.stringify({ projectId: 'projA', planSlug: 'plan-a', phaseId: 'F1', taskId: 'T-1', ts: '2026-01-03T10:00:00Z', event: 'task-done', weight: 2, weightBasis: 'proxy' }),
          JSON.stringify({ projectId: 'projA', planSlug: 'plan-a', phaseId: 'F1', taskId: 'T-1', ts: '2026-01-03T11:00:00Z', event: 'task-done', weight: 1, weightBasis: 'count' }),
        ].join('\n') + '\n',
      );

      emitConsumerState(dir, NOW);

      const burnup = JSON.parse(readFileSync(join(dir, '.atomic-skills', '.aideck', 'state', 'burnup.json'), 'utf8'));
      const spi = JSON.parse(readFileSync(join(dir, '.atomic-skills', '.aideck', 'state', 'spi.json'), 'utf8'));
      assert.ok(Array.isArray(burnup));
      assert.ok(burnup.length > 0);
      assert.ok(Array.isArray(spi));
      assert.ok(spi.length > 0);

      const validation = validateAideckState(dir, { nowMs: NOW });
      assert.equal(validation.ok, true);
      assert.deepEqual(validation.errors, []);

      const schema = JSON.parse(readFileSync(join(repoRoot, 'assets', 'aideck-consumer', 'schema.json'), 'utf8'));
      const ajv = new Ajv({ strict: false, allErrors: false });
      ajv.addSchema(schema);
      for (const [entity, records] of Object.entries({ burnup, spi })) {
        const validate = ajv.getSchema(`${schema.$id}#/definitions/${entity}`);
        assert.ok(validate, `schema definition exists for ${entity}`);
        records.forEach((record, index) => {
          assert.equal(validate(record), true, `${entity}[${index}] schema-valid`);
        });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
