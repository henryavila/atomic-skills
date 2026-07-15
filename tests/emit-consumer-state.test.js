import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  humanizeId,
  relTime,
  buildState,
  emitConsumerState,
} from '../scripts/emit-consumer-state.js';

const NOW = Date.parse('2026-06-16T20:00:00Z');

describe('humanizeId', () => {
  it('title-cases a hyphen/underscore slug', () => {
    assert.equal(humanizeId('atomic-skills'), 'Atomic Skills');
    assert.equal(humanizeId('my_cool_repo'), 'My Cool Repo');
  });
  it('handles a single token and empty input', () => {
    assert.equal(humanizeId('arch'), 'Arch');
    assert.equal(humanizeId(''), '');
  });
});

describe('relTime', () => {
  it('buckets ages into compact units vs now', () => {
    assert.equal(relTime('2026-06-16T19:00:00Z', NOW), '1h');
    assert.equal(relTime('2026-06-14T20:00:00Z', NOW), '2d');
    assert.equal(relTime('2026-06-16T19:59:30Z', NOW), '30s');
  });
  it('returns "" for an unparseable timestamp', () => {
    assert.equal(relTime('not-a-date', NOW), '');
    assert.equal(relTime(undefined, NOW), '');
  });
});

// A minimal two-plan tree: one active multi-phase plan with a current
// initiative, one archived plan. Shaped like readTree()'s output.
function fixtureTree() {
  return {
    plans: [
      {
        projectId: 'demo',
        planSlug: 'big',
        fm: {
          slug: 'big',
          title: 'Big Plan',
          status: 'active',
          branch: 'main',
          lastUpdated: '2026-06-16T18:00:00Z',
          currentPhase: 'F1',
          phases: [
            { id: 'F0', title: 'Foundation', status: 'done', dependsOn: [], summary: 'laid' },
            {
              id: 'F1', title: 'Build', status: 'active', dependsOn: ['F0'], summary: 'building',
              exitGate: { criteria: [
                { id: 'PG-1', description: 'phase gate met', status: 'met', verifier: { kind: 'manual' } },
                { id: 'PG-2', description: 'phase gate pending', status: 'pending', verifier: { kind: 'manual' } },
              ] },
            },
            { id: 'F2', title: 'Ship', status: 'pending', dependsOn: ['F1'], summary: 'later' },
          ],
        },
      },
      {
        projectId: 'demo',
        planSlug: 'old',
        fm: { slug: 'old', title: 'Old Plan', status: 'archived', currentPhase: 'F0', phases: [{ id: 'F0', title: 'x', status: 'done' }] },
      },
    ],
    initiatives: [
      {
        projectId: 'demo',
        planSlug: 'big',
        fm: {
          slug: 'big-f1',
          title: 'Build initiative',
          status: 'active',
          phaseId: 'F1',
          parentPlan: 'big',
          tasksDone: 3,
          tasksTotal: 4,
          weightDone: 5,
          weightTotal: 8,
          gatesMet: 0,
          gatesTotal: 2,
          nextAction: 'do the thing',
          lastUpdated: '2026-06-16T18:00:00Z',
          stack: [{ id: 1, title: 'detour', type: 'research', openedAt: '2026-06-16T10:00:00Z' }],
          parked: [{ title: 'someday idea', surfacedAt: '2026-06-15T00:00:00Z' }],
          emerged: [{ title: 'follow-up', surfacedAt: '2026-06-15T00:00:00Z', promoted: false }],
          tasks: [
            {
              id: 'T-1',
              title: 'a',
              status: 'done',
              weight: 2,
              closedAt: '2026-06-16T17:45:00Z',
              lastUpdated: '2026-06-16T17:45:00Z',
            },
            { id: 'T-2', title: 'b', status: 'blocked', weight: 3, blockedBy: ['D-1'] },
          ],
          exitGates: [{ id: 'G-1', description: 'gate', status: 'pending', verifier: { kind: 'manual' } }],
        },
      },
    ],
  };
}

describe('buildState — derived fields', () => {
  const s = buildState(fixtureTree(), NOW);

  it('emits one record per entity with the right counts', () => {
    assert.equal(s.plans.length, 2);
    assert.equal(s.phases.length, 4); // 3 + 1
    assert.equal(s.initiatives.length, 1);
    assert.equal(s.tasks.length, 2);
    assert.equal(s.gates.length, 1);
    assert.equal(s.phaseGates.length, 2); // F1 has 2 plan-phase criteria
    assert.equal(s.stack.length, 1);
    assert.equal(s.parked.length, 1);
    assert.equal(s.emerged.length, 1);
    assert.equal(s.projects.length, 1);
  });

  it('flattens plan-phase gates, stack, parked, emerged with join keys', () => {
    const pg = s.phaseGates.find((g) => g.id === 'PG-2');
    assert.equal(pg.status, 'pending');
    assert.equal(pg.phaseId, 'F1');
    assert.equal(pg.planSlug, 'big');

    assert.equal(s.stack[0].initiativeId, 'big-f1');
    assert.equal(s.stack[0].title, 'detour');
    assert.equal(s.parked[0].title, 'someday idea');
    assert.equal(s.parked[0].initiativeId, 'big-f1');
    assert.equal(s.emerged[0].promoted, false);
  });

  it('carries lastUpdated onto the initiative record (health staleness needs it)', () => {
    assert.equal(s.initiatives[0].lastUpdated, '2026-06-16T18:00:00Z');
  });

  it('projects weighted task rollups onto the initiative record', () => {
    assert.equal(s.initiatives[0].weightDone, 5);
    assert.equal(s.initiatives[0].weightTotal, 8);
  });

  it('precomputes plan focus + phase rollup text from the current initiative', () => {
    const big = s.plans.find((p) => p.slug === 'big');
    assert.equal(big.currentPhaseText, 'Build');
    assert.equal(big.phasesText, '1/3 fases');
    assert.equal(big.focusTasksText, '3/4');
    assert.equal(big.focusTasksPct, 75);
    assert.equal(big.focusMeta, 'gates 0/2 · 1 frame');
    assert.equal(big.nextText, 'do the thing');
    assert.equal(big.updatedRel, '2h');
  });

  // aiDeck v0.1 now does array-membership filters (status: [paused, blocked])
  // and read-time aggregation, so the emitter no longer precomputes the
  // liveFront/concluded/suspended/bucket helper flags — the manifest filters on
  // `status` directly. Guard that the dropped fields stay dropped (no drift back).
  it('does NOT emit the retired bucket booleans (manifest filters status directly)', () => {
    const big = s.plans.find((p) => p.slug === 'big');
    for (const dead of ['liveFront', 'concluded', 'suspended', 'bucket']) {
      assert.ok(!(dead in big), `retired bucket field ${dead} must not be emitted`);
    }
  });

  it('flags blocked tasks + precomputes blockedByText', () => {
    const t2 = s.tasks.find((t) => t.id === 'T-2');
    assert.equal(t2.blocked, true);
    assert.equal(t2.blockedByText, 'D-1');
    assert.equal(t2.initiativeId, 'big-f1');
  });

  it('projects task closedAt and lastUpdated, using null for legacy missing timestamps', () => {
    const t1 = s.tasks.find((t) => t.id === 'T-1');
    assert.equal(t1.closedAt, '2026-06-16T17:45:00Z');
    assert.equal(t1.lastUpdated, '2026-06-16T17:45:00Z');

    const t2 = s.tasks.find((t) => t.id === 'T-2');
    assert.equal(Object.hasOwn(t2, 'closedAt'), true);
    assert.equal(t2.closedAt, null);
    assert.equal(Object.hasOwn(t2, 'lastUpdated'), true);
    assert.equal(t2.lastUpdated, null);
  });

  // The 4 Panorama totals are now `source.agg` over projects/plans/tasks at read
  // time (count, count+where:{status:active}, count+where:{activeCount:{gt:1}},
  // count+where:{blocked:true}) — so the emitter keeps the per-record fields the
  // aggregate scopes on (activeCount, blocked) but no longer writes a totals file.
  it('rolls up the project (mode/parallel/summary), keeping the agg-scope fields', () => {
    const proj = s.projects[0];
    assert.equal(proj.id, 'demo');
    assert.equal(proj.name, 'Demo');
    assert.equal(proj.totalPlans, 2);
    assert.equal(proj.activeCount, 1); // EM PARALELO aggregates where activeCount > 1
    assert.equal(proj.mode, 'isolado');
    assert.equal(proj.isParallel, false);
    assert.equal(proj.plansSummary, '2 · 1 ✓');
    assert.equal(proj.blockedCount, 1);
  });

  it('does NOT emit the retired precomputed totals projection', () => {
    assert.ok(!('totals' in s), 'totals is now a read-time source.agg, not an emitted file');
  });

  it('marks the current phase and carries dependsOn', () => {
    const f1 = s.phases.find((p) => p.id === 'F1' && p.planSlug === 'big');
    assert.equal(f1.isCurrent, true);
    assert.deepEqual(f1.dependsOn, ['F0']);
    assert.equal(f1.tasksText, '3/4');
  });
});

describe('buildState — plan dependency projection', () => {
  it('emits dependency/origin planEdges plus plan-level execution fields', () => {
    const s = buildState({
      plans: [
        {
          projectId: 'demo',
          planSlug: 'parent',
          fm: {
            slug: 'parent',
            title: 'Parent Plan',
            status: 'active',
            currentPhase: 'F1',
            dependsOnPlans: [{
              plan: 'child',
              createdBy: 'fork-plan',
              origin: { phaseId: 'F1', taskId: 'T-9', mode: 'pause' },
            }],
            phases: [{ id: 'F1', title: 'Parent phase', status: 'active', spawnedPlans: ['child'] }],
          },
        },
        {
          projectId: 'demo',
          planSlug: 'child',
          fm: {
            slug: 'child',
            title: 'Child Plan',
            status: 'active',
            currentPhase: 'F0',
            spawnedFrom: { plan: 'parent', phaseId: 'F1', taskId: 'T-9', mode: 'pause' },
            phases: [{ id: 'F0', title: 'Child phase', status: 'active' }],
          },
        },
        {
          projectId: 'demo',
          planSlug: 'blocked',
          fm: {
            slug: 'blocked',
            title: 'Blocked Plan',
            status: 'pending',
            currentPhase: 'F0',
            dependsOnPlans: [{ plan: 'parent', createdBy: 'manual' }],
            phases: [{ id: 'F0', title: 'Blocked phase', status: 'pending' }],
          },
        },
      ],
      initiatives: [],
    }, NOW);

    assert.deepEqual(
      s.planEdges.map((e) => ({ type: e.type, fromPlan: e.fromPlan, toPlan: e.toPlan })),
      [
        { type: 'dependency', fromPlan: 'parent', toPlan: 'child' },
        { type: 'dependency', fromPlan: 'blocked', toPlan: 'parent' },
        { type: 'origin', fromPlan: 'parent', toPlan: 'child' },
      ],
    );

    const parent = s.plans.find((p) => p.slug === 'parent');
    const child = s.plans.find((p) => p.slug === 'child');
    const blocked = s.plans.find((p) => p.slug === 'blocked');

    assert.equal(parent.blockedByPlansText, 'child');
    assert.equal(parent.unblocksPlansText, 'blocked');
    assert.equal(parent.executionLane, 'blocked');
    assert.equal(child.originText, 'Surgiu de parent · F1/T-9');
    assert.equal(child.unblocksPlansText, 'parent');
    assert.equal(child.executionLane, 'running');
    assert.equal(blocked.blockedByPlansText, 'parent');
    assert.equal(blocked.executionLane, 'blocked');
  });

  it('fails invalid dependency graphs before writing planEdges.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'emit-state-invalid-plan-'));
    try {
      const planDir = join(dir, '.atomic-skills', 'projects', 'demo', 'blocked');
      mkdirSync(join(planDir, 'phases'), { recursive: true });
      writeFileSync(
        join(planDir, 'plan.md'),
        [
          '---',
          'slug: blocked',
          'title: Blocked',
          'status: active',
          'currentPhase: F0',
          'dependsOnPlans:',
          '  - plan: missing',
          '    createdBy: manual',
          'phases:',
          '  - id: F0',
          '    title: Build',
          '    status: active',
          '---',
          '',
        ].join('\n'),
      );

      assert.throws(
        () => emitConsumerState(dir, NOW),
        /invalid plan dependency graph: unknown-prerequisite: plan blocked depends on unknown plan missing/,
      );
      assert.equal(existsSync(join(dir, '.atomic-skills', '.aideck', 'state', 'planEdges.json')), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails closed on malformed or schema-invalid completion lines before overwriting projections', () => {
    const cases = [
      { line: '{not-json}\n', expected: /completion.*line 1.*invalid JSON/i },
      {
        line: `${JSON.stringify({
          ts: '2026-06-16T12:00:00Z', event: 'task-done', projectId: 'demo',
          planSlug: 'big', phaseId: 'F0', taskId: 'T-1',
        })}\n`,
        expected: /completion.*line 1.*schema/i,
      },
      {
        line: `${JSON.stringify({
          ts: 'July 14, 2026 20:00:00 UTC', event: 'task-done', projectId: 'demo',
          planSlug: 'big', phaseId: 'F0', taskId: 'T-1', weight: 1, weightBasis: 'count',
        })}\n`,
        expected: /completion.*line 1.*schema/i,
      },
      {
        line: `${JSON.stringify({
          ts: '2026-06-16T12:00:00Z', event: 'phase-done', projectId: 'demo',
          planSlug: 'big', phaseId: 'F0', taskId: 'T-1', weight: 1, weightBasis: 'count',
        })}\n`,
        expected: /completion.*line 1.*schema/i,
      },
    ];

    for (const scenario of cases) {
      const dir = mkdtempSync(join(tmpdir(), 'emit-state-invalid-completion-'));
      try {
        const stateRoot = join(dir, '.atomic-skills');
        const analytics = join(stateRoot, 'analytics');
        const projection = join(stateRoot, '.aideck', 'state');
        mkdirSync(analytics, { recursive: true });
        mkdirSync(projection, { recursive: true });
        writeFileSync(join(analytics, 'completions.jsonl'), scenario.line);
        writeFileSync(join(projection, 'burnup.json'), '[{"sentinel":true}]\n');

        assert.throws(() => emitConsumerState(dir, NOW), scenario.expected);
        assert.equal(
          readFileSync(join(projection, 'burnup.json'), 'utf8'),
          '[{"sentinel":true}]\n',
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });
});

describe('emitConsumerState — round trip on a tmp tree', () => {
  it('writes bare JSON arrays under .atomic-skills/.aideck/state/', () => {
    const dir = mkdtempSync(join(tmpdir(), 'emit-state-'));
    try {
      const planDir = join(dir, '.atomic-skills', 'projects', 'demo', 'big');
      mkdirSync(join(planDir, 'phases'), { recursive: true });
      writeFileSync(
        join(planDir, 'plan.md'),
        '---\nslug: big\ntitle: Big\nstatus: active\ncurrentPhase: F0\nphases:\n  - id: F0\n    title: Found\n    status: active\n---\n',
      );
      writeFileSync(
        join(planDir, 'phases', 'f0.md'),
        '---\nslug: big-f0\ntitle: F0 init\nstatus: active\nphaseId: F0\nparentPlan: big\ntasksDone: 1\ntasksTotal: 2\nweightDone: 2\nweightTotal: 5\ntasks:\n  - id: T-1\n    title: a\n    status: done\n    weight: 2\n    closedAt: "2026-06-16T17:45:00Z"\n    lastUpdated: "2026-06-16T17:45:00Z"\n  - id: T-2\n    title: b\n    status: pending\n    weight: 3\n---\n',
      );

      const { written } = emitConsumerState(dir, NOW);
      assert.equal(written.length, 13); // 12 base − totals.json (retired) + burnup.json + spi.json

      const plans = JSON.parse(readFileSync(join(dir, '.atomic-skills', '.aideck', 'state', 'plans.json'), 'utf8'));
      assert.ok(Array.isArray(plans), 'plans.json is a bare array');
      assert.equal(plans.length, 1);
      assert.equal(plans[0].focusTasksText, '1/2');

      const planEdges = JSON.parse(readFileSync(join(dir, '.atomic-skills', '.aideck', 'state', 'planEdges.json'), 'utf8'));
      assert.ok(Array.isArray(planEdges), 'planEdges.json is a bare array');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // C-4: an un-migrated FLAT tree (plans/*.md + initiatives/*.md, no projects/)
  // must still emit a populated dashboard — the router promises nested-first,
  // flat-fallback, and the sibling readers honor it. Was: readTree bailed to
  // empty when projects/ was absent → blank dashboard for legacy users.
  it('reads a flat legacy tree so the dashboard is not blank pre-migration', () => {
    const dir = mkdtempSync(join(tmpdir(), 'emit-state-flat-'));
    try {
      const asDir = join(dir, '.atomic-skills');
      mkdirSync(join(asDir, 'plans'), { recursive: true });
      mkdirSync(join(asDir, 'initiatives'), { recursive: true });
      writeFileSync(
        join(asDir, 'plans', 'legacy.md'),
        '---\nslug: legacy\ntitle: Legacy\nstatus: active\ncurrentPhase: F0\nphases:\n  - id: F0\n    title: Found\n    status: active\n---\n',
      );
      writeFileSync(
        join(asDir, 'initiatives', 'legacy.md'),
        '---\nslug: legacy\ntitle: Legacy init\nstatus: active\nphaseId: F0\nparentPlan: legacy\ntasksDone: 1\ntasksTotal: 2\ntasks:\n  - id: T-1\n    title: a\n    status: done\n  - id: T-2\n    title: b\n    status: pending\n---\n',
      );

      emitConsumerState(dir, NOW);
      const plans = JSON.parse(readFileSync(join(asDir, '.aideck', 'state', 'plans.json'), 'utf8'));
      const inits = JSON.parse(readFileSync(join(asDir, '.aideck', 'state', 'initiatives.json'), 'utf8'));
      assert.equal(plans.length, 1, 'flat plan must surface in plans.json');
      assert.equal(plans[0].projectId, '(flat)');
      assert.equal(inits.length, 1, 'flat initiative must surface in initiatives.json');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
