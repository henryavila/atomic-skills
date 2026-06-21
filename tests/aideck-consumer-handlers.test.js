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
// a Map keyed by dataSource id, each value a FLAT array of records (the emitter's
// denormalized state/*.json — tasks/gates/stack/parked are sibling sources, each
// row carrying its join keys: initiativeId|planSlug + projectId).
const RECENT = new Date().toISOString(); // active + fresh => never stale
function makeData() {
  const plans = [
    { slug: 'plan-a', projectId: 'projA', status: 'active', currentPhase: 'f1' },
    // plan-c's current phase initiative has no unblocked task — exercises the
    // scoped no-action path (must NOT leak a different plan's task).
    { slug: 'plan-c', projectId: 'projA', status: 'active', currentPhase: 'f1' },
  ];
  const phases = [
    { planSlug: 'plan-a', projectId: 'projA', id: 'f1', status: 'active', dependsOn: [] },
    { planSlug: 'plan-a', projectId: 'projA', id: 'f2', status: 'pending', dependsOn: ['f1'] },
    { planSlug: 'plan-c', projectId: 'projA', id: 'f1', status: 'active', dependsOn: [] },
  ];
  const phaseGates = [
    { planSlug: 'plan-a', projectId: 'projA', phaseId: 'f1', id: 'c1', status: 'met' },
    { planSlug: 'plan-a', projectId: 'projA', phaseId: 'f1', id: 'c2', status: 'pending' },
  ];
  const initiatives = [
    { slug: 'init-1', projectId: 'projA', status: 'active', lastUpdated: RECENT, parentPlan: 'plan-a', phaseId: 'f1' },
    // second active initiative in a different plan — global fallback / wrong-scope probe
    { slug: 'init-2', projectId: 'projA', status: 'active', lastUpdated: '2020-01-01T00:00:00Z', parentPlan: 'plan-b', phaseId: 'f1' },
    // active but malformed lastUpdated — fix #8 target
    { slug: 'init-bad-ts', projectId: 'projA', status: 'active', lastUpdated: undefined, parentPlan: 'plan-a', phaseId: 'f2' },
    // current phase of plan-c, all tasks done — scoped no-action
    { slug: 'init-done', projectId: 'projA', status: 'active', lastUpdated: RECENT, parentPlan: 'plan-c', phaseId: 'f1' },
  ];
  const tasks = [
    { initiativeId: 'init-1', projectId: 'projA', id: 't1', title: 'done thing', status: 'done', blockedBy: [] },
    { initiativeId: 'init-1', projectId: 'projA', id: 't2', title: 'next thing', status: 'pending', blockedBy: ['t1'] }, // unblocked (t1 done)
    { initiativeId: 'init-1', projectId: 'projA', id: 't3', title: 'later thing', status: 'pending', blockedBy: ['t2'] }, // blocked (t2 pending)
    { initiativeId: 'init-2', projectId: 'projA', id: 'tb1', title: 'b task', status: 'pending', blockedBy: [] },
    { initiativeId: 'init-done', projectId: 'projA', id: 'd1', title: 'd', status: 'done', blockedBy: [] },
  ];
  const gates = [
    { initiativeId: 'init-1', projectId: 'projA', id: 'g1', status: 'met' },
    { initiativeId: 'init-1', projectId: 'projA', id: 'g2', status: 'pending' },
  ];
  const stack = [{ initiativeId: 'init-1', projectId: 'projA', index: 0, id: 1, title: 'detour' }];
  const parked = [{ initiativeId: 'init-1', projectId: 'projA', index: 0, title: 'someday idea' }];
  const inbox = [
    { kind: 'intent', operation: 'mark_task_done' }, // unconsumed
    { kind: 'intent', operation: 'pop_frame', consumed: true }, // consumed
    { kind: 'decision', verdict: 'approve' }, // not an intent
  ];
  return new Map([
    ['plans', plans], ['phases', phases], ['phaseGates', phaseGates], ['initiatives', initiatives],
    ['tasks', tasks], ['gates', gates], ['stack', stack], ['parked', parked], ['inbox', inbox],
  ]);
}
// F-001 fixture: two projects sharing a plan slug ('shared') AND an initiative
// slug ('dup'). aiDeck injects projectId onto every record, so the consumer must
// scope by it; resolving by slug alone would hit the wrong project.
function makeMultiProjectData() {
  const plans = [
    { slug: 'shared', projectId: 'projA', status: 'active', currentPhase: 'f1' },
    { slug: 'shared', projectId: 'projB', status: 'active', currentPhase: 'f1' },
  ];
  const phases = [
    { planSlug: 'shared', projectId: 'projA', id: 'f1', status: 'active', dependsOn: [] },
    { planSlug: 'shared', projectId: 'projB', id: 'f1', status: 'active', dependsOn: [] },
  ];
  const initiatives = [
    { slug: 'dup', projectId: 'projA', status: 'active', lastUpdated: RECENT, parentPlan: 'shared', phaseId: 'f1' },
    { slug: 'dup', projectId: 'projB', status: 'active', lastUpdated: RECENT, parentPlan: 'shared', phaseId: 'f1' },
  ];
  const tasks = [
    { initiativeId: 'dup', projectId: 'projA', id: 'a1', title: 'A task', status: 'pending', blockedBy: [] },
    { initiativeId: 'dup', projectId: 'projB', id: 'b1', title: 'B task', status: 'pending', blockedBy: [] },
  ];
  const stack = [
    { initiativeId: 'dup', projectId: 'projA', index: 0, id: 1, title: 'dA' },
    { initiativeId: 'dup', projectId: 'projB', index: 0, id: 1, title: 'dB' },
  ];
  const parked = [
    { initiativeId: 'dup', projectId: 'projA', index: 0, title: 'pA' },
    { initiativeId: 'dup', projectId: 'projB', index: 0, title: 'pB' },
  ];
  return new Map([
    ['plans', plans], ['phases', phases], ['initiatives', initiatives],
    ['tasks', tasks], ['stack', stack], ['parked', parked], ['inbox', []],
  ]);
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

  it('global fallback scans PAST a blocked first active initiative to an actionable later one', async () => {
    // Mutation that breaks this: `initiatives.find(i => i.status === 'active')` instead of
    // iterating — it would stop at init-blocked and return the global no-action result.
    const data = new Map([
      ['plans', []],
      ['initiatives', [
        { slug: 'init-blocked', status: 'active' },
        { slug: 'init-open', status: 'active' },
      ]],
      ['tasks', [
        { initiativeId: 'init-blocked', id: 'a1', title: 'blocked', status: 'pending', blockedBy: ['ghost'] },
        { initiativeId: 'init-open', id: 'b1', title: 'go', status: 'pending', blockedBy: [] },
      ]],
    ]);
    const r = await getNextAction({ args: {}, data });
    assert.equal(r.initiativeSlug, 'init-open');
    assert.equal(r.taskId, 'b1');
  });

  it('stays scoped with a no-currentPhase rationale when the plan has no currentPhase', async () => {
    // Exercises the previously-untested ternary else arm in the plan-scoped return.
    const data = new Map([
      ['plans', [{ slug: 'plan-np', status: 'active', currentPhase: null, phases: [] }]],
      ['initiatives', []],
    ]);
    const r = await getNextAction({ args: { planSlug: 'plan-np' }, data });
    assert.equal(r.planSlug, 'plan-np');
    assert.equal(r.taskId, undefined);
    assert.match(r.rationale, /has no currentPhase set/);
  });
});

describe('aideck-consumer firstUnblockedPendingTask (F-003: unknown blocker = blocking)', () => {
  // Isolated fixture (not makeData) so these probes can't perturb the shared one.
  // A blocker ID that resolves to no task must be treated as BLOCKING. Mutation
  // that breaks every case here: restoring the `!ids.has(bid) ||` clause in
  // _lib.js firstUnblockedPendingTask (the original F-003 bug).
  function dataWith(tasks) {
    return new Map([
      ['initiatives', [{ slug: 'init-x', status: 'active', parentPlan: 'plan-x', phaseId: 'f1' }]],
      ['plans', []],
      ['tasks', tasks.map((t) => ({ initiativeId: 'init-x', ...t }))],
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

  it('blocks a task when ANY blocker is unresolved, even if another blocker IS done', async () => {
    // `.every` must hold for ALL blockers: a done prereq does not rescue an unknown one.
    const r = await getNextAction({
      args: { initiativeSlug: 'init-x' },
      data: dataWith([
        { id: 't0', title: 'prereq', status: 'done', blockedBy: [] },
        { id: 't1', title: 'mixed', status: 'pending', blockedBy: ['t0', 'ghost'] },
      ]),
    });
    assert.equal(r.taskId, undefined); // t0 done but ghost unknown => still blocked
    assert.match(r.description, /all tasks done or blocked/);
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

  it('verify_exit_gate records a deferred result + reason and never hints allGatesMet', async () => {
    // The valid non-met result (a failed verification leaves the criterion pending —
    // it is never recorded as a 'failed' status). Mutation that breaks this:
    // hinting allGatesMet for a non-'met' result, or dropping deferredReason.
    const f = makeFiles();
    const r = await verifyExitGate({ args: { initiativeSlug: 'init-1', criterionId: 'g2', result: 'deferred', deferredReason: 'out of band' }, data: makeData(), files: f });
    assert.equal(f.appended[0].record.args.result, 'deferred');
    assert.equal(f.appended[0].record.args.deferredReason, 'out of band');
    assert.equal(r.allGatesMet, false);
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

describe('aideck-consumer projectId scoping (F-001: slug collision across projects)', () => {
  // (a) Ambiguous slug + no projectId → THROW, never silently pick a project.
  // Mutation that breaks these: dropping the `candidates.length > 1` throw in
  // _lib.js resolveBySlug — it would resolve the first match (wrong project).
  it('THROWS ambiguous on a collided initiative slug with no projectId (read + mutate + deps)', async () => {
    await assert.rejects(
      () => getNextAction({ args: { initiativeSlug: 'dup' }, data: makeMultiProjectData() }),
      /ambiguous slug 'dup' across projects: \[projA, projB\]/,
    );
    await assert.rejects(
      () => markTaskDone({ args: { initiativeSlug: 'dup', taskId: 'a1' }, data: makeMultiProjectData(), files: makeFiles(), log }),
      /ambiguous slug 'dup'/,
    );
    await assert.rejects(
      () => getDependencies({ args: { scope: 'task', initiativeSlug: 'dup', taskId: 'a1' }, data: makeMultiProjectData() }),
      /ambiguous slug 'dup'/,
    );
  });

  it('THROWS ambiguous on a collided plan slug with no projectId', async () => {
    await assert.rejects(
      () => getNextAction({ args: { planSlug: 'shared' }, data: makeMultiProjectData() }),
      /ambiguous slug 'shared' across projects: \[projA, projB\]/,
    );
    await assert.rejects(
      () => getDependencies({ args: { scope: 'phase', planSlug: 'shared', phaseId: 'f1' }, data: makeMultiProjectData() }),
      /ambiguous slug 'shared'/,
    );
  });

  // (b) With projectId → resolves the CORRECT project (not the first match).
  it('resolves the correct project when projectId is given (initiative + plan scope + global fallback)', async () => {
    const a = await getNextAction({ args: { initiativeSlug: 'dup', projectId: 'projA' }, data: makeMultiProjectData() });
    assert.equal(a.taskId, 'a1');
    const b = await getNextAction({ args: { initiativeSlug: 'dup', projectId: 'projB' }, data: makeMultiProjectData() });
    assert.equal(b.taskId, 'b1');

    // plan-scoped currentPhase match must stay within the resolved plan's project
    const pb = await getNextAction({ args: { planSlug: 'shared', projectId: 'projB' }, data: makeMultiProjectData() });
    assert.equal(pb.initiativeSlug, 'dup');
    assert.equal(pb.taskId, 'b1');

    // global fallback (no slug) is also project-scoped. projB is asserted because
    // projA's initiative is the FIRST active one — so the projA assertion alone is
    // tautological (an unscoped scan also returns a1). projB pins the inProject
    // filter: drop `&& inProject(i)` from the global scan and this returns a1 (leak).
    const gfA = await getNextAction({ args: { projectId: 'projA' }, data: makeMultiProjectData() });
    assert.equal(gfA.taskId, 'a1');
    const gfB = await getNextAction({ args: { projectId: 'projB' }, data: makeMultiProjectData() });
    assert.equal(gfB.taskId, 'b1');
  });

  it('THROWS not-found naming the project when the slug exists only in another project', async () => {
    await assert.rejects(
      () => getNextAction({ args: { initiativeSlug: 'dup', projectId: 'projC' }, data: makeMultiProjectData() }),
      /initiative not found: dup in project 'projC'/,
    );
  });

  // (c) Mutation intents carry the resolved projectId in target.
  it('mark_task_done intent target carries the projectId (from the resolved record)', async () => {
    const f = makeFiles();
    await markTaskDone({ args: { initiativeSlug: 'dup', taskId: 'b1', projectId: 'projB' }, data: makeMultiProjectData(), files: f, log });
    // Mutation that breaks this: target back to { initiativeSlug, taskId } without projectId
    assert.equal(f.appended[0].record.target.projectId, 'projB');
    assert.equal(f.appended[0].record.target.initiativeSlug, 'dup');
    assert.equal(f.appended[0].record.target.taskId, 'b1');
  });

  it('verify_exit_gate / pop_frame / promote_parked intent targets carry projectId', async () => {
    const init = { slug: 'dup', projectId: 'projB', status: 'active', lastUpdated: RECENT };
    const data = () => new Map([
      ['plans', []], ['initiatives', [init]],
      ['gates', [{ initiativeId: 'dup', projectId: 'projB', id: 'g1', status: 'pending' }]],
      ['stack', [{ initiativeId: 'dup', projectId: 'projB', index: 0, id: 1, title: 'd' }]],
      ['parked', [{ initiativeId: 'dup', projectId: 'projB', index: 0, title: 'pB' }]],
    ]);

    const fv = makeFiles();
    await verifyExitGate({ args: { initiativeSlug: 'dup', projectId: 'projB', criterionId: 'g1', result: 'met' }, data: data(), files: fv });
    assert.equal(fv.appended[0].record.target.projectId, 'projB');

    const fp = makeFiles();
    await popFrame({ args: { initiativeSlug: 'dup', projectId: 'projB' }, data: data(), files: fp });
    assert.equal(fp.appended[0].record.target.projectId, 'projB');

    const fpr = makeFiles();
    await promoteParked({ args: { initiativeSlug: 'dup', projectId: 'projB', parkedTitleOrIndex: 'pB' }, data: data(), files: fpr });
    assert.equal(fpr.appended[0].record.target.projectId, 'projB');

    // verify_exit_gate's plan+phase branch stamps target.projectId from the
    // RESOLVED plan (not args) — distinct code path from the initiative branch.
    const planData = new Map([
      ['plans', [{ slug: 'shared', projectId: 'projB', status: 'active', currentPhase: 'f1' }]],
      ['phases', [{ planSlug: 'shared', projectId: 'projB', id: 'f1', status: 'active' }]],
      ['phaseGates', [{ planSlug: 'shared', projectId: 'projB', phaseId: 'f1', id: 'c1', status: 'pending' }]],
      ['initiatives', []],
    ]);
    const fvp = makeFiles();
    await verifyExitGate({ args: { planSlug: 'shared', phaseId: 'f1', projectId: 'projB', criterionId: 'c1', result: 'met' }, data: planData, files: fvp });
    assert.equal(fvp.appended[0].record.target.projectId, 'projB');
  });

  // (d) Single-project repo: NO regression — works without passing projectId, and
  // the intent target still carries the projectId derived from the record.
  it('single-project: resolves with no projectId arg and still stamps target.projectId', async () => {
    const f = makeFiles();
    const r = await markTaskDone({ args: { initiativeSlug: 'init-1', taskId: 't2' }, data: makeData(), files: f, log });
    assert.equal(r.accepted, true);
    assert.equal(f.appended[0].record.target.projectId, 'projA'); // injected onto the record by aiDeck
    const na = await getNextAction({ args: { initiativeSlug: 'init-1' }, data: makeData() });
    assert.equal(na.taskId, 't2');
  });
});
