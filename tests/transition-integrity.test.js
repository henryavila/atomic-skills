import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  nextEligiblePhases,
  proposeAdvance,
  validatePhaseDag,
  findPhaseCycles,
  allPhasesTerminal,
  openPhaseIds,
} from '../src/transition.js';
import { isTerminalPhaseStatus } from '../src/state-invariants.js';

// Shorthand builder — mirrors tests/transition.test.js
function mkPlan(phases, { parallelismAllowed = false, currentPhase } = {}) {
  return {
    currentPhase,
    parallelismAllowed,
    phases: phases.map(([id, dependsOn = [], status = 'pending']) => ({
      id,
      slug: id.toLowerCase(),
      title: id,
      goal: 'g',
      dependsOn,
      subPhaseCount: 0,
      exitGate: { summary: 's', criteria: [] },
      status,
    })),
  };
}

describe('isTerminalPhaseStatus (state-invariants)', () => {
  it('classifies done and archived as terminal', () => {
    assert.equal(isTerminalPhaseStatus('done'), true);
    assert.equal(isTerminalPhaseStatus('archived'), true);
  });

  it('classifies open statuses as non-terminal', () => {
    assert.equal(isTerminalPhaseStatus('pending'), false);
    assert.equal(isTerminalPhaseStatus('active'), false);
    assert.equal(isTerminalPhaseStatus('paused'), false);
    assert.equal(isTerminalPhaseStatus(undefined), false);
  });
});

describe('validatePhaseDag / findPhaseCycles', () => {
  it('accepts an acyclic linear chain', () => {
    const plan = mkPlan([
      ['F0', []],
      ['F1', ['F0']],
      ['F2', ['F1']],
    ]);
    const v = validatePhaseDag(plan);
    assert.equal(v.ok, true);
    assert.deepEqual(findPhaseCycles(plan), []);
  });

  it('fails on self-loop', () => {
    const plan = mkPlan([
      ['F0', []],
      ['F1', ['F1']],
    ]);
    const v = validatePhaseDag(plan);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => e.code === 'self-loop' && e.phaseId === 'F1'));
    const cycles = findPhaseCycles(plan);
    // Closed-path form: [id, id]
    assert.ok(cycles.some((c) => c.length === 2 && c[0] === 'F1' && c[1] === 'F1'));
  });

  it('fails on a 2-node cycle', () => {
    const plan = mkPlan([
      ['A', ['B']],
      ['B', ['A']],
    ]);
    const v = validatePhaseDag(plan);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => e.code === 'cycle'));
    const cycles = findPhaseCycles(plan);
    assert.ok(cycles.some((c) => c.includes('A') && c.includes('B')));
  });

  it('fails on a 3-node cycle', () => {
    const plan = mkPlan([
      ['A', ['B']],
      ['B', ['C']],
      ['C', ['A']],
    ]);
    const v = validatePhaseDag(plan);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => e.code === 'cycle'));
    const cycles = findPhaseCycles(plan);
    assert.ok(cycles.some((c) => c.includes('A') && c.includes('B') && c.includes('C')));
  });

  it('fails on unknown dependency', () => {
    const plan = mkPlan([
      ['F0', []],
      ['F1', ['F0', 'F-typo']],
    ]);
    const v = validatePhaseDag(plan);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => e.code === 'unknown-dep' && e.phaseId === 'F1'));
  });
});

describe('proposeAdvance — complete vs ready vs blocked', () => {
  it('returns plan-done only when every phase is terminal', () => {
    const plan = mkPlan([
      ['F0', [], 'done'],
      ['F1', ['F0'], 'archived'],
    ]);
    assert.deepEqual(proposeAdvance(plan, 'F1'), { kind: 'plan-done', eligible: [] });
    assert.equal(allPhasesTerminal(plan, 'F1'), true);
  });

  it('active sibling → blocked/open, not plan-done', () => {
    // F0 just closed; F1 is already active (parallel sibling) and F2 waits on F1.
    const plan = mkPlan([
      ['F0', [], 'active'],
      ['F1', [], 'active'],
      ['F2', ['F1']],
    ]);
    const out = proposeAdvance(plan, 'F0');
    assert.notEqual(out.kind, 'plan-done');
    assert.equal(out.kind, 'blocked');
    assert.deepEqual(out.eligible, []);
    assert.ok(out.open.includes('F1'));
    assert.ok(out.open.includes('F2'));
    assert.equal(allPhasesTerminal(plan, 'F0'), false);
  });

  it('paused phase → blocked, not plan-done', () => {
    const plan = mkPlan([
      ['F0', [], 'active'],
      ['F1', ['F0'], 'paused'],
    ]);
    const out = proposeAdvance(plan, 'F0');
    assert.equal(out.kind, 'blocked');
    assert.deepEqual(out.eligible, []);
    assert.deepEqual(out.open, ['F1']);
  });

  it('pending phase waiting on unmet deps → blocked (zero eligible ≠ complete)', () => {
    // F0 done, F2 waits on F1 which is still pending (not started, no free root).
    const plan = mkPlan([
      ['F0', [], 'done'],
      ['F1', ['F0'], 'pending'], // would be eligible — so use a harder case:
    ]);
    // Better: F0 closed but F2 depends on F1 which is not yet terminal and not eligible
    // if F1 is active (sibling path covered). Use diamond leftover:
    const diamond = mkPlan([
      ['F0', [], 'done'],
      ['F1', ['F0'], 'done'],
      ['F2', ['F0'], 'active'], // still open
      ['F3', ['F1', 'F2']], // pending, deps incomplete
    ]);
    const out = proposeAdvance(diamond, 'F1');
    assert.equal(out.kind, 'blocked');
    assert.deepEqual(out.eligible, []);
    assert.ok(out.open.includes('F2'));
    assert.ok(out.open.includes('F3'));
  });

  it('self-loop → error (not plan-done)', () => {
    const plan = mkPlan([
      ['F0', [], 'done'],
      ['F1', ['F1']],
    ]);
    const out = proposeAdvance(plan, 'F0');
    assert.equal(out.kind, 'error');
    assert.ok(out.errors.some((e) => e.code === 'self-loop'));
  });

  it('2-node cycle → error', () => {
    const plan = mkPlan([
      ['A', ['B'], 'active'],
      ['B', ['A']],
    ]);
    const out = proposeAdvance(plan, 'A');
    assert.equal(out.kind, 'error');
    assert.ok(out.errors.some((e) => e.code === 'cycle'));
  });

  it('3-node cycle → error', () => {
    const plan = mkPlan([
      ['A', ['B'], 'active'],
      ['B', ['C']],
      ['C', ['A']],
    ]);
    const out = proposeAdvance(plan, 'A');
    assert.equal(out.kind, 'error');
    assert.ok(out.errors.some((e) => e.code === 'cycle'));
  });

  it('unknown dependency → error (not silent plan-done)', () => {
    const plan = mkPlan([
      ['F0', [], 'active'],
      ['F1', ['F0', 'F-typo']],
    ]);
    const out = proposeAdvance(plan, 'F0');
    assert.equal(out.kind, 'error');
    assert.ok(out.errors.some((e) => e.code === 'unknown-dep'));
  });

  it('ready: single next when one pending phase is eligible', () => {
    const plan = mkPlan([
      ['F0', [], 'active'],
      ['F1', ['F0']],
    ]);
    const out = proposeAdvance(plan, 'F0');
    assert.equal(out.kind, 'single');
    assert.equal(out.next, 'F1');
  });
});

describe('non-numeric DAG elects by dependsOn order, not ID sort', () => {
  // Linear chain F0→F4→F3→F1→F2→F5→F6 but phases listed in numeric ID order.
  // After each completion exactly one phase is eligible — the dependsOn successor,
  // never the next numeric id.
  function integrityDag(statuses) {
    // statuses: map id → status; defaults pending except those set
    const chain = [
      ['F0', []],
      ['F1', ['F3']],
      ['F2', ['F1']],
      ['F3', ['F4']],
      ['F4', ['F0']],
      ['F5', ['F2']],
      ['F6', ['F5']],
    ];
    return mkPlan(
      chain.map(([id, deps]) => [id, deps, statuses[id] ?? 'pending'])
    );
  }

  const order = ['F0', 'F4', 'F3', 'F1', 'F2', 'F5', 'F6'];

  it('elects exactly one phase at a time in dependsOn order', () => {
    for (let i = 0; i < order.length - 1; i++) {
      const completed = order[i];
      const expectedNext = order[i + 1];
      const statuses = {};
      for (let j = 0; j <= i; j++) statuses[order[j]] = j === i ? 'active' : 'done';
      // remaining stay pending
      const plan = integrityDag(statuses);
      const eligible = nextEligiblePhases(plan, completed);
      assert.deepEqual(
        eligible,
        [expectedNext],
        `after ${completed} expected only ${expectedNext}, got ${JSON.stringify(eligible)}`
      );
      const out = proposeAdvance(plan, completed);
      assert.equal(out.kind, 'single', `after ${completed}`);
      assert.equal(out.next, expectedNext, `after ${completed}`);
      assert.deepEqual(out.alternatives, []);
    }
  });

  it('never elects by numeric ID order (F0 done does not pick F1)', () => {
    const plan = integrityDag({ F0: 'active' });
    assert.deepEqual(nextEligiblePhases(plan, 'F0'), ['F4']);
    assert.notDeepEqual(nextEligiblePhases(plan, 'F0'), ['F1']);
  });

  it('plan-done only after F6 terminalizes the whole chain', () => {
    const statuses = Object.fromEntries(order.map((id) => [id, 'done']));
    statuses.F6 = 'active'; // just completing
    const plan = integrityDag(statuses);
    assert.equal(allPhasesTerminal(plan, 'F6'), true);
    assert.deepEqual(openPhaseIds(plan, 'F6'), []);
    assert.deepEqual(proposeAdvance(plan, 'F6'), { kind: 'plan-done', eligible: [] });
  });
});
