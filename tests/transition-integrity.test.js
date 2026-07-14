import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyPlanProgress, proposeAdvance } from '../src/transition.js';
import { collectPhaseGraphViolations } from '../src/state-invariants.js';

function plan(phases, overrides = {}) {
  return {
    parallelismAllowed: false,
    phases: phases.map(([id, dependsOn = [], status = 'pending']) => ({ id, dependsOn, status })),
    ...overrides,
  };
}

test('zero eligible with an active sibling is blocked, never plan-done', () => {
  const value = plan([
    ['F0', [], 'done'],
    ['F1', ['F0'], 'active'],
    ['F2', ['F1'], 'pending'],
  ]);
  assert.equal(classifyPlanProgress(value, 'F0').kind, 'blocked');
  assert.equal(proposeAdvance(value, 'F0').kind, 'blocked');
});

test('zero eligible with a paused phase is blocked, never plan-done', () => {
  const value = plan([
    ['F0', [], 'done'],
    ['F1', ['F0'], 'paused'],
  ]);
  const result = proposeAdvance(value, 'F0');
  assert.equal(result.kind, 'blocked');
  assert.ok(result.blockers.some((item) => item.code === 'open-phase'));
});

test('only an all-terminal graph is complete', () => {
  const value = plan([
    ['F0', [], 'done'],
    ['F1', ['F0'], 'archived'],
  ]);
  assert.deepEqual(classifyPlanProgress(value, 'F1'), { kind: 'complete', eligible: [], blockers: [] });
  assert.deepEqual(proposeAdvance(value, 'F1'), { kind: 'plan-done', eligible: [] });
});

test('self dependency and two/three-node cycles have stable graph error codes', () => {
  const self = collectPhaseGraphViolations(plan([['F0', ['F0']]]));
  assert.ok(self.some((item) => item.code === 'phase-self-dependency'));

  const direct = collectPhaseGraphViolations(plan([['A', ['B']], ['B', ['A']]]));
  assert.ok(direct.some((item) => item.code === 'phase-dependency-cycle' && /A -> B -> A/.test(item.message)));

  const transitive = collectPhaseGraphViolations(plan([['A', ['B']], ['B', ['C']], ['C', ['A']]]));
  assert.ok(transitive.some((item) => item.code === 'phase-dependency-cycle' && /A -> B -> C -> A/.test(item.message)));
});

test('unknown dependency blocks progress with a named reason', () => {
  const value = plan([['F0', [], 'done'], ['F1', ['missing'], 'pending']]);
  const result = classifyPlanProgress(value, 'F0');
  assert.equal(result.kind, 'blocked');
  assert.ok(result.blockers.some((item) => item.code === 'unknown-phase-dependency'));
});

test('non-numeric DAG advances only by dependsOn: F0→F4→F3→F1→F2→F5→F6', () => {
  const phases = [
    ['F0', [], 'active'],
    ['F1', ['F3'], 'pending'],
    ['F2', ['F1'], 'pending'],
    ['F3', ['F4'], 'pending'],
    ['F4', ['F0'], 'pending'],
    ['F5', ['F2'], 'pending'],
    ['F6', ['F5'], 'pending'],
  ];
  const value = plan(phases);
  const order = [];
  let current = 'F0';
  while (true) {
    const result = proposeAdvance(value, current);
    value.phases.find((phase) => phase.id === current).status = 'done';
    if (result.kind === 'plan-done') break;
    assert.equal(result.kind, 'single', JSON.stringify(result));
    order.push(result.next);
    current = result.next;
    value.phases.find((phase) => phase.id === current).status = 'active';
  }
  assert.deepEqual(order, ['F4', 'F3', 'F1', 'F2', 'F5', 'F6']);
});
