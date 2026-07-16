/**
 * F4/T-003 — defer / skip / status-edit / direct advance with a pending (or
 * non-met) exit gate must produce zero terminal write, zero completion event,
 * and must not mark the phase terminal or materialize a successor.
 *
 * These are pure decision tests over decidePhaseDoneTerminal + commitGuard;
 * no filesystem mutation is performed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  commitGuardPhaseDone,
  decidePhaseDoneTerminal,
  preflightPhaseDone,
} from '../scripts/lifecycle-order-guard.js';
import { proposeAdvance } from '../src/transition.js';

const FP = 'a1b2c3d4e5f6789012345678abcdef0123456789';

function f4Slice(overrides = {}) {
  return {
    parentPlan: 'integrity-remediation',
    phaseId: 'F4',
    phase: {
      parentPlan: 'integrity-remediation',
      phaseId: 'F4',
      status: 'active',
      lessonsState: 'recorded',
      tasks: [
        { id: 'T-001', status: 'done' },
        { id: 'T-002', status: 'done' },
        { id: 'T-003', status: 'done' },
      ],
      exitGates: [
        { id: 'F4-G1', status: 'met' },
        { id: 'F4-G2', status: 'met' },
        { id: 'F4-G3', status: 'pending' },
      ],
    },
    plan: {
      currentPhase: 'F4',
      parallelismAllowed: false,
      phases: [
        phase('F0', [], 'done'),
        phase('F4', ['F0'], 'active'),
        phase('F3', ['F4'], 'pending'),
        phase('F1', ['F3'], 'pending'),
      ],
    },
    tasks: [
      { id: 'T-001', status: 'done' },
      { id: 'T-002', status: 'done' },
      { id: 'T-003', status: 'done' },
    ],
    exitGates: [
      { id: 'F4-G1', status: 'met' },
      { id: 'F4-G2', status: 'met' },
      { id: 'F4-G3', status: 'pending' },
    ],
    reviewGate: { status: 'passed', at: FP, mode: 'local' },
    lessonsState: 'recorded',
    fingerprint: FP,
    expectedFingerprint: FP,
    ...overrides,
  };
}

function phase(id, dependsOn, status) {
  return {
    id,
    slug: id.toLowerCase(),
    title: id,
    goal: 'g',
    dependsOn,
    subPhaseCount: 0,
    exitGate: { summary: 's', criteria: [] },
    status,
  };
}

function assertZeroTerminal(decision) {
  assert.equal(decision.allowed, false);
  assert.equal(decision.blocked, true);
  assert.equal(decision.terminal, false);
  assert.deepEqual(decision.writes, []);
  assert.deepEqual(decision.events, []);
  assert.deepEqual(decision.commits, []);
}

test('defer of pending F4-G3 produces zero terminal write/event (not a close path)', () => {
  // Operator "defers" the remaining gate and tries to close anyway.
  const deferredAttempt = f4Slice({
    exitGates: [
      { id: 'F4-G1', status: 'met' },
      { id: 'F4-G2', status: 'met' },
      { id: 'F4-G3', status: 'deferred', deferredReason: 'will fix later' },
    ],
  });

  const decision = decidePhaseDoneTerminal(deferredAttempt);
  assertZeroTerminal(decision);
  assert.equal(decision.code, 'phase-done-gate-deferred');
  // Phase remains non-terminal in the input snapshot
  assert.equal(deferredAttempt.phase.status, 'active');
  assert.equal(deferredAttempt.plan.phases.find((p) => p.id === 'F4').status, 'active');
});

test('skip / pending F4-G3 produces zero terminal write/event', () => {
  const pending = decidePhaseDoneTerminal(f4Slice());
  assertZeroTerminal(pending);
  assert.equal(pending.code, 'phase-done-open-gate');
  assert.match(pending.reason, /F4-G3/);

  const failed = decidePhaseDoneTerminal(f4Slice({
    exitGates: [
      { id: 'F4-G1', status: 'met' },
      { id: 'F4-G2', status: 'met' },
      { id: 'F4-G3', status: 'failed' },
    ],
  }));
  assertZeroTerminal(failed);
  assert.equal(failed.code, 'phase-done-open-gate');
});

test('status-edit of phase to done while F4-G3 pending is rejected by commit guard', () => {
  // A hand-edit that pretends the phase is already done still fails the guard
  // when re-read gates are not all met — no terminal effects authorized.
  const handEdited = f4Slice({
    phase: {
      parentPlan: 'integrity-remediation',
      phaseId: 'F4',
      status: 'done', // illicit status-edit
      lessonsState: 'recorded',
    },
  });

  const guard = commitGuardPhaseDone(handEdited);
  assert.equal(guard.blocked, true);
  assert.equal(guard.code, 'phase-done-open-gate');

  const decision = decidePhaseDoneTerminal(handEdited);
  assertZeroTerminal(decision);
});

test('direct proposeAdvance with pending F4-G3 does not authorize terminal close', () => {
  const input = f4Slice();
  // Advisory advance may describe a successor, but terminal decision is empty.
  const proposal = proposeAdvance(input.plan, 'F4');
  assert.equal(proposal.kind, 'single');
  assert.equal(proposal.next, 'F3');

  const decision = decidePhaseDoneTerminal(input);
  assertZeroTerminal(decision);
  // Successor must not be treated as materialized / activated by the decision
  assert.ok(!decision.writes.some((w) => /materialize|F3|active/.test(w)));
  assert.equal(input.plan.phases.find((p) => p.id === 'F3').status, 'pending');
});

test('preflight still allows evidence production while F4-G3 is pending', () => {
  const pre = preflightPhaseDone(f4Slice());
  assert.equal(pre.allowed, true);
  assert.equal(pre.blocked, false);
  // Commit remains blocked until the gate is met
  assert.equal(commitGuardPhaseDone(f4Slice()).blocked, true);
});

test('happy path: all gates met authorizes terminal effects without bulk task-done', () => {
  const ok = decidePhaseDoneTerminal(f4Slice({
    exitGates: [
      { id: 'F4-G1', status: 'met' },
      { id: 'F4-G2', status: 'met' },
      { id: 'F4-G3', status: 'met' },
    ],
  }));
  assert.equal(ok.allowed, true);
  assert.equal(ok.terminal, true);
  assert.ok(ok.writes.length > 0);
  assert.ok(ok.events.includes('phase-done:F4'));
  assert.ok(!ok.events.some((e) => e.startsWith('task-done:')));
});
