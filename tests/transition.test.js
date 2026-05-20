import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { nextEligiblePhases, proposeAdvance, unknownDeps } from '../src/transition.js';

// Shorthand builder — keeps each test readable.
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

describe('nextEligiblePhases', () => {
  it('linear chain — closing F0 makes F1 eligible', () => {
    const plan = mkPlan([
      ['F0', [], 'active'],
      ['F1', ['F0']],
      ['F2', ['F1']],
    ]);
    assert.deepEqual(nextEligiblePhases(plan, 'F0'), ['F1']);
  });

  it('diamond — closing F0 unblocks F1 and F2 in parallel, F3 still waiting on F1+F2', () => {
    const plan = mkPlan([
      ['F0', [], 'active'],
      ['F1', ['F0']],
      ['F2', ['F0']],
      ['F3', ['F1', 'F2']],
    ]);
    assert.deepEqual(nextEligiblePhases(plan, 'F0'), ['F1', 'F2']);
  });

  it('preserves declaration order in the output', () => {
    const plan = mkPlan([
      ['B', ['A']],
      ['A', [], 'active'],
      ['C', ['A']],
    ]);
    // After A completes, declaration order is B then C.
    assert.deepEqual(nextEligiblePhases(plan, 'A'), ['B', 'C']);
  });

  it('skips already-done and already-archived phases', () => {
    const plan = mkPlan([
      ['F0', [], 'active'],
      ['F1', ['F0'], 'done'],
      ['F2', ['F0'], 'archived'],
      ['F3', ['F0']],
    ]);
    assert.deepEqual(nextEligiblePhases(plan, 'F0'), ['F3']);
  });

  it('treats unknown deps as unsatisfiable (does not silently promote)', () => {
    const plan = mkPlan([
      ['F0', [], 'active'],
      ['F1', ['F0', 'F-typo']],
    ]);
    assert.deepEqual(nextEligiblePhases(plan, 'F0'), []);
  });

  it('returns [] when the closed phase is the last terminal node', () => {
    const plan = mkPlan([
      ['F0', [], 'done'],
      ['F1', ['F0'], 'done'],
      ['F2', ['F1'], 'active'],
    ]);
    assert.deepEqual(nextEligiblePhases(plan, 'F2'), []);
  });

  it('handles a phase with empty dependsOn (root phase)', () => {
    const plan = mkPlan([
      ['F0', []],
      ['F1', ['F0']],
    ]);
    // Closing a phantom `init` — F0 has no deps, so it should be eligible.
    assert.deepEqual(nextEligiblePhases(plan, 'init'), ['F0']);
  });

  it('null / malformed plan returns []', () => {
    assert.deepEqual(nextEligiblePhases(null, 'F0'), []);
    assert.deepEqual(nextEligiblePhases({}, 'F0'), []);
    assert.deepEqual(nextEligiblePhases({ phases: 'not-an-array' }, 'F0'), []);
  });

  it('skips already-active phases (only `pending` is startable)', () => {
    const plan = mkPlan([
      ['F0', [], 'active'],
      ['F1', ['F0'], 'active'], // already running — must not be re-proposed
      ['F2', ['F0']],
    ]);
    assert.deepEqual(nextEligiblePhases(plan, 'F0'), ['F2']);
  });

  it('skips paused phases (deliberately suspended)', () => {
    const plan = mkPlan([
      ['F0', [], 'active'],
      ['F1', ['F0'], 'paused'], // suspended — resume manually, do not auto-advance
      ['F2', ['F0']],
    ]);
    assert.deepEqual(nextEligiblePhases(plan, 'F0'), ['F2']);
  });
});

describe('unknownDeps', () => {
  it('returns [] when every dep resolves', () => {
    const plan = mkPlan([
      ['F0', []],
      ['F1', ['F0']],
    ]);
    assert.deepEqual(unknownDeps(plan), []);
  });

  it('surfaces typos and missing references', () => {
    const plan = mkPlan([
      ['F0', []],
      ['F1', ['F0', 'F-typo', 'NOTREAL']],
      ['F2', ['F1']],
    ]);
    assert.deepEqual(unknownDeps(plan), [
      { phaseId: 'F1', missing: ['F-typo', 'NOTREAL'] },
    ]);
  });
});

describe('proposeAdvance', () => {
  it('plan-done when nothing is eligible', () => {
    const plan = mkPlan([
      ['F0', [], 'done'],
      ['F1', ['F0'], 'done'],
    ]);
    assert.deepEqual(proposeAdvance(plan, 'F1'), { kind: 'plan-done', eligible: [] });
  });

  it('single-phase advance picks the earliest by declaration order', () => {
    const plan = mkPlan([
      ['F0', [], 'active'],
      ['F1', ['F0']],
      ['F2', ['F0']],
    ]);
    const out = proposeAdvance(plan, 'F0');
    assert.equal(out.kind, 'single');
    assert.equal(out.next, 'F1');
    assert.deepEqual(out.alternatives, ['F2']);
  });

  it('parallelismAllowed surfaces every eligible phase', () => {
    const plan = mkPlan(
      [
        ['F0', [], 'active'],
        ['F1', ['F0']],
        ['F2', ['F0']],
      ],
      { parallelismAllowed: true }
    );
    assert.deepEqual(proposeAdvance(plan, 'F0'), {
      kind: 'parallel-choice',
      eligible: ['F1', 'F2'],
    });
  });
});
