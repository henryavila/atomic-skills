import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  classifyPhaseDoneCommit,
  classifyPhaseDonePreflight,
} from '../scripts/lifecycle-order-guard.js';
import { executePhaseDoneTransaction } from '../scripts/phase-done-transaction.js';

const SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function input(overrides = {}) {
  const exitGates = structuredClone(overrides.exitGates ?? [{
    id: 'F4-G3', status: 'met', evidence: { passed: true, verifiedCommit: SHA },
  }]);
  const phase = {
    id: 'F4', slug: 'demo-f4', status: 'active',
    exitGate: { criteria: structuredClone(exitGates) },
  };
  const initiative = {
    slug: 'demo-f4', parentPlan: 'demo', phaseId: 'F4', status: 'active',
    tasks: [{ id: 'T-1', status: 'done' }],
    exitGates: structuredClone(exitGates),
  };
  return {
    plan: { slug: 'demo', phases: [phase] },
    phase,
    initiative,
    tasks: initiative.tasks,
    exitGates: structuredClone(exitGates),
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
    exitGates: structuredClone(exitGates),
  };
}

function transactionInput(root, overrides = {}) {
  const request = input(overrides);
  request.root = root;
  request.plan.__projectId = 'atomic-skills';
  request.initiative.__projectId = 'atomic-skills';
  request.close = {
    projectId: 'atomic-skills', planSlug: 'demo', phaseId: 'F4',
    closedAt: '2026-07-14T20:00:00Z', weight: 1, weightBasis: 'count',
  };
  return request;
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

test('preflight cannot replace authoritative initiative tasks with a detached empty slice', () => {
  const request = input();
  request.initiative.tasks = [{ id: 'T-1', status: 'pending' }];
  request.tasks = [];
  const result = classifyPhaseDonePreflight(request);
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'phase-done-task-slice-mismatch');
});

test('commit guard cannot replace authoritative plan gates with a detached empty slice', () => {
  const request = input();
  request.plan.phases[0].exitGate = {
    criteria: [{ id: 'F4-G3', status: 'pending' }],
  };
  request.phase = request.plan.phases[0];
  request.initiative.exitGates = [{ id: 'F4-G3', status: 'pending' }];
  request.exitGates = [];
  const result = classifyPhaseDoneCommit(request);
  assert.equal(result.allowed, false);
  assert.match(result.code, /phase-done-(gate-slice-mismatch|open-gate)/);
});

test('preflight rejects duplicate phase ids even when one id/slug pair is unique', () => {
  const request = input();
  request.plan.phases.push({ id: 'F4', slug: 'other-f4', status: 'pending' });
  const result = classifyPhaseDonePreflight(request);
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'phase-done-identity-duplicate');
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
  const root = mkdtempSync(join(tmpdir(), 'as-lifecycle-gate-'));
  try {
    const calls = [];
    const request = transactionInput(root, {
      exitGates: [{ id: 'F4-G3', status: 'pending' }],
    });
    const result = await executePhaseDoneTransaction(request, {
      loadState: async () => structuredClone(request),
      produceEvidence: async () => ({
        exitGates: [{ id: 'F4-G3', status: 'pending', evidence: { passed: false } }],
      }),
      findCommit: async () => undefined,
      commit: async () => calls.push('write'),
      emit: async () => calls.push('event'),
      materializeSuccessor: async () => calls.push('materialize'),
      assertClean: async () => true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, 'commit-guard');
    assert.deepEqual(calls, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('F4-G3 cannot close or activate its successor without a current history receipt', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-lifecycle-gate-'));
  try {
    const calls = [];
    const request = transactionInput(root, { historyReceiptCurrent: false });
    const result = await executePhaseDoneTransaction(request, {
      loadState: async () => structuredClone(request),
      findCommit: async () => undefined,
      commit: async () => calls.push('write'),
      emit: async () => calls.push('event'),
      materializeSuccessor: async () => calls.push('materialize'),
      assertClean: async () => true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, 'commit-guard');
    assert.equal(result.decision.code, 'phase-done-history-receipt-stale');
    assert.deepEqual(calls, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
