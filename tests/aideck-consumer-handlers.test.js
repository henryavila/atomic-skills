import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import getNextAction from '../assets/aideck-consumer/handlers/get-next-action.js';
import getDependencies from '../assets/aideck-consumer/handlers/get-dependencies.js';
import health from '../assets/aideck-consumer/handlers/health.js';
import markTaskDone from '../assets/aideck-consumer/handlers/mark-task-done.js';
import verifyExitGate from '../assets/aideck-consumer/handlers/verify-exit-gate.js';
import popFrame from '../assets/aideck-consumer/handlers/pop-frame.js';
import promoteParked from '../assets/aideck-consumer/handlers/promote-parked.js';

// In-memory fixture mirroring what the aiDeck data-source reader hands a handler:
// a Map keyed by dataSource id, each value an array of records (shapes per
// meta/schemas/{initiative,plan,common}.schema.json, plus the injected projectId).
const RECENT = new Date().toISOString(); // active + fresh => never stale
function makeData() {
  const plans = [
    {
      slug: 'plan-a', projectId: 'projA', status: 'active', currentPhase: 'f1',
      phases: [
        { id: 'f1', status: 'active', dependsOn: [], exitGate: { criteria: [{ id: 'c1', status: 'met' }, { id: 'c2', status: 'pending' }] } },
        { id: 'f2', status: 'pending', dependsOn: ['f1'] },
      ],
    },
    // plan-c's current phase initiative has no unblocked task — exercises the
    // scoped no-action path (must NOT leak a different plan's task).
    { slug: 'plan-c', projectId: 'projA', status: 'active', currentPhase: 'f1', phases: [{ id: 'f1', status: 'active' }] },
  ];
  const initiatives = [
    {
      slug: 'init-1', projectId: 'projA', status: 'active', lastUpdated: RECENT,
      parentPlan: 'plan-a', phaseId: 'f1',
      tasks: [
        { id: 't1', title: 'done thing', status: 'done', blockedBy: [] },
        { id: 't2', title: 'next thing', status: 'pending', blockedBy: ['t1'] }, // unblocked (t1 done)
        { id: 't3', title: 'later thing', status: 'pending', blockedBy: ['t2'] }, // blocked (t2 pending)
      ],
      exitGates: [{ id: 'g1', status: 'met' }, { id: 'g2', status: 'pending' }],
      stack: [{ kind: 'detour' }],
      parked: [{ title: 'someday idea' }],
    },
    // second active initiative in a different plan — global fallback / wrong-scope probe
    {
      slug: 'init-2', projectId: 'projA', status: 'active', lastUpdated: '2020-01-01T00:00:00Z',
      parentPlan: 'plan-b', phaseId: 'f1',
      tasks: [{ id: 'tb1', title: 'b task', status: 'pending', blockedBy: [] }],
      exitGates: [], stack: [],
    },
    // active but malformed lastUpdated — fix #8 target
    { slug: 'init-bad-ts', projectId: 'projA', status: 'active', lastUpdated: undefined, parentPlan: 'plan-a', phaseId: 'f2', tasks: [], exitGates: [] },
    // current phase of plan-c, all tasks done — scoped no-action
    { slug: 'init-done', projectId: 'projA', status: 'active', lastUpdated: RECENT, parentPlan: 'plan-c', phaseId: 'f1', tasks: [{ id: 'd1', title: 'd', status: 'done', blockedBy: [] }], exitGates: [] },
  ];
  const inbox = [
    { kind: 'intent', operation: 'mark_task_done' }, // unconsumed
    { kind: 'intent', operation: 'pop_frame', consumed: true }, // consumed
    { kind: 'decision', verdict: 'approve' }, // not an intent
  ];
  return new Map([['plans', plans], ['initiatives', initiatives], ['inbox', inbox]]);
}
function makeFiles() {
  const appended = [];
  return { appended, append: async (path, record) => { appended.push({ path, record }); } };
}
const log = { info: () => {} };

describe('aideck-consumer get_next_action', () => {
  it('returns the first unblocked pending task for an explicit initiative', async () => {
    const r = await getNextAction({ args: { initiativeSlug: 'init-1' }, data: makeData() });
    assert.equal(r.taskId, 't2'); // t1 done, t3 blocked by pending t2
  });

  it('THROWS on an explicit-but-missing initiativeSlug instead of falling back globally', async () => {
    // Mutation that breaks this: removing the `if (!i) throw` — handler would fall
    // through and return init-1's task for a slug that does not exist.
    await assert.rejects(
      () => getNextAction({ args: { initiativeSlug: 'does-not-exist' }, data: makeData() }),
      /initiative not found: does-not-exist/,
    );
  });

  it('THROWS on an explicit-but-missing planSlug', async () => {
    await assert.rejects(
      () => getNextAction({ args: { planSlug: 'no-plan' }, data: makeData() }),
      /plan not found: no-plan/,
    );
  });

  it('stays scoped to the plan (no cross-plan leak) when the plan has no actionable task', async () => {
    const r = await getNextAction({ args: { planSlug: 'plan-c' }, data: makeData() });
    // Mutation that breaks this: restoring the global fall-through — r would carry
    // init-2 (a different plan's active task) with no planSlug.
    assert.equal(r.planSlug, 'plan-c');
    assert.equal(r.taskId, undefined);
  });

  it('resolves the current-phase task when the plan IS actionable', async () => {
    const r = await getNextAction({ args: { planSlug: 'plan-a' }, data: makeData() });
    assert.equal(r.planSlug, 'plan-a');
    assert.equal(r.initiativeSlug, 'init-1');
    assert.equal(r.taskId, 't2');
  });

  it('uses the global active fallback only when no scope is given', async () => {
    const r = await getNextAction({ args: {}, data: makeData() });
    assert.equal(r.initiativeSlug, 'init-1');
    assert.match(r.rationale, /first active initiative/);
  });
});

describe('aideck-consumer firstUnblockedPendingTask (F-003: unknown blocker = blocking)', () => {
  // Isolated fixture (not makeData) so these probes can't perturb the shared one.
  // A blocker ID that resolves to no task must be treated as BLOCKING. Mutation
  // that breaks every case here: restoring the `!ids.has(bid) ||` clause in
  // _lib.js firstUnblockedPendingTask (the original F-003 bug).
  function dataWith(tasks) {
    return new Map([
      ['initiatives', [{ slug: 'init-x', status: 'active', parentPlan: 'plan-x', phaseId: 'f1', tasks }]],
      ['plans', []],
    ]);
  }

  it('does NOT recommend a pending task blocked by an unknown/misspelled ID', async () => {
    const r = await getNextAction({
      args: { initiativeSlug: 'init-x' },
      data: dataWith([{ id: 't1', title: 'ghost-blocked', status: 'pending', blockedBy: ['t0-typo'] }]),
    });
    assert.equal(r.taskId, undefined); // unknown blocker => blocking => no action
    assert.match(r.description, /all tasks done or blocked/);
  });

  it('skips the ghost-blocked task and recommends the one whose real blocker is done', async () => {
    const r = await getNextAction({
      args: { initiativeSlug: 'init-x' },
      data: dataWith([
        { id: 't1', title: 'ghost-blocked', status: 'pending', blockedBy: ['nope'] }, // unknown => blocked
        { id: 't2', title: 'real', status: 'pending', blockedBy: ['t0'] },
        { id: 't0', title: 'prereq', status: 'done', blockedBy: [] },
      ]),
    });
    assert.equal(r.taskId, 't2'); // t1 skipped (ghost dep), t2 unblocked (t0 done)
  });

  it('still recommends a task with no blockers at all', async () => {
    const r = await getNextAction({
      args: { initiativeSlug: 'init-x' },
      data: dataWith([{ id: 't1', title: 'free', status: 'pending', blockedBy: [] }]),
    });
    assert.equal(r.taskId, 't1');
  });
});

describe('aideck-consumer get_dependencies', () => {
  it('reports an unmet phase dependency as blocking', async () => {
    const r = await getDependencies({ args: { scope: 'phase', planSlug: 'plan-a', phaseId: 'f2' }, data: makeData() });
    assert.deepEqual(r.blockedBy, ['f1']);
    assert.deepEqual(r.blocking, ['f1']); // f1 is active, not done
    assert.deepEqual(r.resolved, []);
  });

  it('reports an unmet task dependency as blocking', async () => {
    const r = await getDependencies({ args: { scope: 'task', initiativeSlug: 'init-1', taskId: 't3' }, data: makeData() });
    assert.deepEqual(r.blocking, ['t2']); // t2 still pending
  });

  it('throws on unknown plan and on invalid scope', async () => {
    await assert.rejects(() => getDependencies({ args: { scope: 'phase', planSlug: 'nope', phaseId: 'x' }, data: makeData() }), /plan not found/);
    await assert.rejects(() => getDependencies({ args: { scope: 'bogus' }, data: makeData() }), /invalid scope/);
  });
});

describe('aideck-consumer health', () => {
  it('reports active initiatives with a malformed lastUpdated instead of skipping them', async () => {
    const r = await health({ args: {}, data: makeData() });
    // Mutation that breaks this: restoring the `Number.isFinite(ts) && active` skip
    // — init-bad-ts would vanish from the report.
    const bad = r.staleInitiatives.find((s) => s.slug === 'init-bad-ts');
    assert.ok(bad, 'init-bad-ts must be surfaced');
    assert.equal(bad.malformed, true);
    assert.equal(bad.daysStale, null);
  });

  it('flags a genuinely stale active initiative and leaves fresh ones out', async () => {
    const r = await health({ args: {}, data: makeData() });
    assert.ok(r.staleInitiatives.some((s) => s.slug === 'init-2' && s.daysStale > 100));
    assert.ok(!r.staleInitiatives.some((s) => s.slug === 'init-1'));
  });

  it('collects only unmet gates and counts only unconsumed intents', async () => {
    const r = await health({ args: {}, data: makeData() });
    assert.ok(r.unmetGates.some((g) => g.target === 'initiative:init-1' && g.criterion === 'g2'));
    assert.ok(r.unmetGates.some((g) => g.target === 'plan:plan-a/phase:f1' && g.criterion === 'c2'));
    assert.ok(!r.unmetGates.some((g) => g.criterion === 'g1')); // g1 is met
    assert.equal(r.inboxUnconsumed, 1); // one intent, unconsumed; consumed intent + decision excluded
  });
});

describe('aideck-consumer mutations append intents (never write entity files)', () => {
  it('mark_task_done records an intent and signals phase completion on the last open task', async () => {
    const filesA = makeFiles();
    const r1 = await markTaskDone({ args: { initiativeSlug: 'init-1', taskId: 't2' }, data: makeData(), files: filesA, log });
    assert.equal(filesA.appended[0].record.operation, 'mark_task_done');
    assert.equal(r1.phaseCompleteHint, undefined); // t3 still open

    const filesB = makeFiles();
    const r2 = await markTaskDone({ args: { initiativeSlug: 'init-2', taskId: 'tb1' }, data: makeData(), files: filesB, log });
    assert.equal(r2.phaseCompleteHint.remaining, 0); // tb1 was the only task
  });

  it('mark_task_done throws on an unknown task', async () => {
    await assert.rejects(() => markTaskDone({ args: { initiativeSlug: 'init-1', taskId: 'nope' }, data: makeData(), files: makeFiles(), log }), /task nope not found/);
  });

  it('verify_exit_gate hints allGatesMet only when every other criterion is met', async () => {
    const f1 = makeFiles();
    const a = await verifyExitGate({ args: { initiativeSlug: 'init-1', criterionId: 'g1', result: 'met' }, data: makeData(), files: f1 });
    assert.equal(f1.appended[0].record.operation, 'verify_exit_gate');
    assert.equal(a.allGatesMet, false); // g2 still pending

    const b = await verifyExitGate({ args: { initiativeSlug: 'init-1', criterionId: 'g2', result: 'met' }, data: makeData(), files: makeFiles() });
    assert.equal(b.allGatesMet, true); // only other gate g1 already met
  });

  it('verify_exit_gate throws on an unknown criterion', async () => {
    await assert.rejects(() => verifyExitGate({ args: { initiativeSlug: 'init-1', criterionId: 'nope', result: 'met' }, data: makeData(), files: makeFiles() }), /criterion nope not found/);
  });

  it('pop_frame records an intent and refuses an empty stack', async () => {
    const f = makeFiles();
    await popFrame({ args: { initiativeSlug: 'init-1' }, data: makeData(), files: f });
    assert.equal(f.appended[0].record.operation, 'pop_frame');
    await assert.rejects(() => popFrame({ args: { initiativeSlug: 'init-2' }, data: makeData(), files: makeFiles() }), /stack is empty/);
  });

  it('promote_parked resolves a parked item by title and by index', async () => {
    const byTitle = makeFiles();
    await promoteParked({ args: { initiativeSlug: 'init-1', parkedTitleOrIndex: 'someday idea' }, data: makeData(), files: byTitle });
    assert.equal(byTitle.appended[0].record.args.parkedTitle, 'someday idea');

    const byIndex = makeFiles();
    await promoteParked({ args: { initiativeSlug: 'init-1', parkedTitleOrIndex: 0 }, data: makeData(), files: byIndex });
    assert.equal(byIndex.appended[0].record.args.parkedTitle, 'someday idea');

    await assert.rejects(() => promoteParked({ args: { initiativeSlug: 'init-1', parkedTitleOrIndex: 'nope' }, data: makeData(), files: makeFiles() }), /parked item not found/);
  });
});
