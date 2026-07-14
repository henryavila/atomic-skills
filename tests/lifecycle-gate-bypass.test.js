import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyPhaseDoneCommit,
  classifyPhaseDonePreflight,
} from '../scripts/lifecycle-order-guard.js';
import { executePhaseDoneTransaction } from '../scripts/phase-done-transaction.js';

const SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function input(overrides = {}) {
  const phase = { id: 'F4', slug: 'demo-f4', status: 'active' };
  const initiative = {
    slug: 'demo-f4', parentPlan: 'demo', phaseId: 'F4', status: 'active',
    tasks: [{ id: 'T-1', status: 'done' }],
  };
  return {
    plan: { slug: 'demo', phases: [phase] },
    phase,
    initiative,
    tasks: initiative.tasks,
    exitGates: [{
      id: 'F4-G3', status: 'met', evidence: { passed: true, verifiedCommit: SHA },
    }],
    reviewGate: {
      status: 'passed', at: SHA, mode: 'local',
      reviewFile: '.atomic-skills/reviews/f4.md',
    },
    currentHead: SHA,
    reviewCommitExists: true,
    reviewFileMatches: true,
    historyReceiptCurrent: true,
    worktreeDirty: false,
    lessonsState: 'recorded',
    requireLessons: true,
    ...overrides,
  };
}

test('preflight fails closed when authoritative identity inputs are absent', () => {
  const result = classifyPhaseDonePreflight({ tasks: [] });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'phase-done-identity-missing');
});

test('preflight checks tasks but intentionally does not require gate/review evidence yet', () => {
  const result = classifyPhaseDonePreflight(input({
    exitGates: [{ id: 'F4-G3', status: 'pending' }],
    reviewGate: undefined,
  }));
  assert.equal(result.allowed, true);
});

test('deferred, skipped, failed and evidence-less gates cannot reach terminal commit', () => {
  const cases = [
    { status: 'deferred', deferredReason: 'later' },
    { status: 'skipped' },
    { status: 'failed', evidence: { passed: false } },
    { status: 'met' },
    { status: 'met', evidence: { passed: false } },
  ];
  for (const gate of cases) {
    const result = classifyPhaseDoneCommit(input({ exitGates: [{ id: 'F4-G3', ...gate }] }));
    assert.equal(result.allowed, false, JSON.stringify(gate));
    assert.match(result.code, /phase-done-(open-gate|gate-evidence)/);
  }
});

test('skipped review cannot bypass the commit guard', () => {
  const result = classifyPhaseDoneCommit(input({
    reviewGate: { status: 'skipped', reason: 'operator override' },
  }));
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'phase-done-review-open');
});

test('pending F4-G3 produces zero close write, event or successor materialization', async () => {
  const calls = [];
  const result = await executePhaseDoneTransaction(input({
    exitGates: [{ id: 'F4-G3', status: 'pending' }],
  }), {
    produceEvidence: async () => ({
      exitGates: [{ id: 'F4-G3', status: 'pending', evidence: { passed: false } }],
    }),
    commit: async () => calls.push('write'),
    emit: async () => calls.push('event'),
    materializeSuccessor: async () => calls.push('materialize'),
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'commit-guard');
  assert.deepEqual(calls, []);
});

test('F4-G3 cannot close or activate its successor without a current history receipt', async () => {
  const calls = [];
  const result = await executePhaseDoneTransaction(input({
    historyReceiptCurrent: false,
  }), {
    commit: async () => calls.push('write'),
    emit: async () => calls.push('event'),
    materializeSuccessor: async () => calls.push('materialize'),
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'commit-guard');
  assert.equal(result.decision.code, 'phase-done-history-receipt-stale');
  assert.deepEqual(calls, []);
});
