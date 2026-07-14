import test from 'node:test';
import assert from 'node:assert/strict';

import { executePhaseDoneTransaction } from '../scripts/phase-done-transaction.js';

const SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const REVIEW_FILE = '.atomic-skills/reviews/demo-f4.md';

function base(overrides = {}) {
  const phase = { id: 'F4', slug: 'demo-f4', status: 'active' };
  const initiative = {
    slug: 'demo-f4', parentPlan: 'demo', phaseId: 'F4', status: 'active',
    tasks: [{ id: 'T-1', status: 'done' }],
    exitGates: [{
      id: 'F4-G1', status: 'met', evidence: { passed: true, verifiedCommit: SHA },
    }],
  };
  return {
    plan: { slug: 'demo', phases: [phase] },
    phase,
    initiative,
    tasks: initiative.tasks,
    exitGates: initiative.exitGates,
    reviewGate: { status: 'passed', at: SHA, mode: 'local', reviewFile: REVIEW_FILE },
    currentHead: SHA,
    reviewCommitExists: true,
    reviewFileMatches: true,
    worktreeDirty: false,
    requireLessons: true,
    lessonsState: 'recorded',
    ...overrides,
  };
}

test('open task blocks before verifiers, review, writes or events', async () => {
  const calls = [];
  const input = base({ tasks: [{ id: 'T-1', status: 'pending' }] });
  const result = await executePhaseDoneTransaction(input, {
    produceEvidence: async () => calls.push('evidence'),
    commit: async () => calls.push('commit'),
    emit: async () => calls.push('emit'),
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'preflight');
  assert.equal(result.decision.code, 'phase-done-open-task');
  assert.deepEqual(calls, []);
});

test('preflight permits evidence production, then commit guard closes exactly once', async () => {
  const calls = [];
  const input = base({
    exitGates: [{ id: 'F4-G1', status: 'pending' }],
    reviewGate: undefined,
  });
  const result = await executePhaseDoneTransaction(input, {
    produceEvidence: async () => {
      calls.push('evidence');
      return {
        exitGates: [{
          id: 'F4-G1', status: 'met', evidence: { passed: true, verifiedCommit: SHA },
        }],
        reviewGate: { status: 'passed', at: SHA, mode: 'local', reviewFile: REVIEW_FILE },
        currentHead: SHA,
        reviewCommitExists: true,
        reviewFileMatches: true,
        worktreeDirty: false,
        lessonsState: 'recorded',
      };
    },
    commit: async () => { calls.push('commit'); return { closeSha: SHA }; },
    emit: async () => calls.push('emit'),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ['evidence', 'commit', 'emit']);
  assert.deepEqual(result.value, { closeSha: SHA });
});

test('commit guard rejects a changed review fingerprint after evidence without terminal effects', async () => {
  const calls = [];
  const result = await executePhaseDoneTransaction(base({
    reviewGate: undefined,
    exitGates: [{ id: 'F4-G1', status: 'pending' }],
  }), {
    produceEvidence: async () => ({
      exitGates: [{
        id: 'F4-G1', status: 'met', evidence: { passed: true, verifiedCommit: SHA },
      }],
      reviewGate: {
        status: 'passed', at: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        mode: 'local', reviewFile: REVIEW_FILE,
      },
      currentHead: SHA,
      reviewCommitExists: true,
      reviewFileMatches: true,
      worktreeDirty: false,
      lessonsState: 'recorded',
    }),
    commit: async () => calls.push('commit'),
    emit: async () => calls.push('emit'),
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'commit-guard');
  assert.equal(result.decision.code, 'phase-done-review-stale');
  assert.deepEqual(calls, []);
});

test('review fixes that change HEAD invalidate gate evidence until verifiers rerun', async () => {
  const reviewedHead = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const calls = [];
  const result = await executePhaseDoneTransaction(base({
    exitGates: [{
      id: 'F4-G1', status: 'met',
      evidence: { passed: true, verifiedCommit: SHA },
    }],
    reviewGate: {
      status: 'passed', at: reviewedHead, mode: 'local',
      reviewFile: '.atomic-skills/reviews/f4.md',
    },
    currentHead: reviewedHead,
    reviewCommitExists: true,
    reviewFileMatches: true,
  }), {
    commit: async () => calls.push('commit'),
    emit: async () => calls.push('emit'),
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'commit-guard');
  assert.equal(result.decision.code, 'phase-done-gate-evidence-stale');
  assert.deepEqual(calls, []);
});

test('commit guard rejects arbitrary review identifiers before terminal effects', async () => {
  const calls = [];
  const result = await executePhaseDoneTransaction(base({
    reviewGate: {
      status: 'passed', at: 'working-tree', mode: 'local',
      reviewFile: '.atomic-skills/reviews/f4.md',
    },
    reviewCommitExists: false,
    reviewFileMatches: false,
  }), {
    commit: async () => calls.push('commit'),
    emit: async () => calls.push('emit'),
  });
  assert.equal(result.ok, false);
  assert.equal(result.decision.code, 'phase-done-review-sha-invalid');
  assert.deepEqual(calls, []);
});
