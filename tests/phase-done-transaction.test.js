import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ensureCompletion } from '../scripts/append-completion.js';
import {
  buildPhaseDoneIdempotencyKey,
  executePhaseDoneTransaction,
  phaseDoneRecoveryPath,
  readPhaseDoneRecovery,
} from '../scripts/phase-done-transaction.js';

const SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const REVIEW_FILE = '.atomic-skills/reviews/demo-f4.md';
const LOG = (root) => join(root, '.atomic-skills', 'analytics', 'completions.jsonl');

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

function transactionInput(root, overrides = {}) {
  return base({
    root,
    close: {
      projectId: 'atomic-skills',
      planSlug: 'demo',
      phaseId: 'F4',
      closedAt: '2026-07-14T20:00:00Z',
      weight: 8,
      weightBasis: 'proxy',
    },
    ...overrides,
  });
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
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-tx-'));
  const calls = [];
  try {
    const input = transactionInput(root, {
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
      findCommit: async () => undefined,
      commit: async () => { calls.push('commit'); return { closeSha: SHA }; },
      emit: async () => calls.push('emit'),
      assertClean: async () => true,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ['evidence', 'commit', 'emit']);
    assert.deepEqual(result.value, { closeSha: SHA });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('allowed close rejects a missing commit effect before creating recovery state', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-tx-'));
  try {
    const input = transactionInput(root);
    const idempotencyKey = buildPhaseDoneIdempotencyKey(input.close);
    await assert.rejects(
      executePhaseDoneTransaction(input, {
        findCommit: async () => undefined,
        emit: async () => {},
        assertClean: async () => true,
      }),
      /effects\.commit is required/,
    );
    assert.equal(existsSync(phaseDoneRecoveryPath(root, idempotencyKey)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('commit without a durable closeSha cannot report success', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-tx-'));
  try {
    const input = transactionInput(root);
    const idempotencyKey = buildPhaseDoneIdempotencyKey(input.close);
    await assert.rejects(
      executePhaseDoneTransaction(input, {
        findCommit: async () => undefined,
        commit: async () => undefined,
        emit: async () => assert.fail('emit must remain unreachable'),
        assertClean: async () => true,
      }),
      /missing a full closeSha/i,
    );
    assert.equal(readPhaseDoneRecovery(root, idempotencyKey).stage, 'prepared');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('event failure after commit resumes without recommit or duplicate completion', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-tx-'));
  try {
    const input = transactionInput(root);
    const idempotencyKey = buildPhaseDoneIdempotencyKey(input.close);
    let storedCommit;
    let commitCalls = 0;
    let emitCalls = 0;
    const effects = {
      findCommit: async () => storedCommit,
      commit: async () => {
        commitCalls += 1;
        storedCommit = { closeSha: SHA };
        return storedCommit;
      },
      emit: async (closeInput) => {
        emitCalls += 1;
        ensureCompletion(root, {
          event: 'phase-done',
          projectId: closeInput.close.projectId,
          planSlug: closeInput.close.planSlug,
          phaseId: closeInput.close.phaseId,
          taskId: null,
          weight: closeInput.close.weight,
          weightBasis: closeInput.close.weightBasis,
          idempotencyKey: closeInput.idempotencyKey,
          closeSha: closeInput.closeSha,
          ts: closeInput.close.closedAt,
        });
        if (emitCalls === 1) throw new Error('injected post-event failure');
      },
      assertClean: async () => true,
    };

    await assert.rejects(
      executePhaseDoneTransaction(input, effects),
      /injected post-event failure/,
    );
    assert.equal(readPhaseDoneRecovery(root, idempotencyKey).stage, 'committed');
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 1);

    const resumed = await executePhaseDoneTransaction(input, effects);
    assert.equal(resumed.ok, true);
    assert.equal(commitCalls, 1);
    assert.equal(emitCalls, 2);
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 1);
    assert.equal(readPhaseDoneRecovery(root, idempotencyKey), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('successor failure resumes after the durable event without recommit or re-emit', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-tx-'));
  try {
    const input = transactionInput(root);
    const idempotencyKey = buildPhaseDoneIdempotencyKey(input.close);
    let commitCalls = 0;
    let emitCalls = 0;
    let materializeCalls = 0;
    const effects = {
      findCommit: async () => undefined,
      commit: async () => {
        commitCalls += 1;
        return { closeSha: SHA };
      },
      emit: async () => { emitCalls += 1; },
      materializeSuccessor: async () => {
        materializeCalls += 1;
        if (materializeCalls === 1) throw new Error('injected successor failure');
      },
      assertClean: async () => true,
    };

    await assert.rejects(
      executePhaseDoneTransaction(input, effects),
      /injected successor failure/,
    );
    assert.equal(readPhaseDoneRecovery(root, idempotencyKey).stage, 'emitted');

    const resumed = await executePhaseDoneTransaction(input, effects);
    assert.equal(resumed.ok, true);
    assert.equal(commitCalls, 1);
    assert.equal(emitCalls, 1);
    assert.equal(materializeCalls, 2);
    assert.equal(readPhaseDoneRecovery(root, idempotencyKey), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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
