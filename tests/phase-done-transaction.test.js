import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ensureCompletion } from '../scripts/append-completion.js';
import {
  buildDoneIdempotencyKey,
  executeDoneTransaction,
} from '../scripts/done-transaction.js';
import {
  buildPhaseDoneIdempotencyKey,
  executePhaseDoneTransaction,
  phaseDoneRecoveryPath,
  readPhaseDoneRecovery,
} from '../scripts/phase-done-transaction.js';
import { successorPublicationEvidence } from '../scripts/successor-manifest.js';

const SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const REVIEW_FILE = '.atomic-skills/reviews/demo-f4.md';
const LOG = (root) => join(root, '.atomic-skills', 'analytics', 'completions.jsonl');
const firstGenerationKey = (close) => buildPhaseDoneIdempotencyKey({ ...close, generation: 1 });

function successorFixture(root) {
  const planContent = 'published successor plan\n';
  const initiativeContent = 'published successor initiative\n';
  const successor = {
    phaseId: 'F3',
    planPath: 'plan.md',
    initiativePath: 'phases/f3.md',
    planHash: createHash('sha256').update(planContent).digest('hex'),
    initiativeHash: createHash('sha256').update(initiativeContent).digest('hex'),
  };
  return {
    successor,
    publish() {
      mkdirSync(join(root, 'phases'), { recursive: true });
      writeFileSync(join(root, successor.planPath), planContent, 'utf8');
      writeFileSync(join(root, successor.initiativePath), initiativeContent, 'utf8');
    },
  };
}

function base(overrides = {}) {
  const exitGates = [{
    id: 'F4-G1', status: 'met', evidence: { passed: true, verifiedCommit: SHA },
  }];
  const reviewGate = Object.hasOwn(overrides, 'reviewGate')
    ? overrides.reviewGate
    : { status: 'passed', at: SHA, mode: 'local', reviewFile: REVIEW_FILE };
  const phase = {
    id: 'F4', slug: 'demo-f4', status: 'active',
    exitGate: { criteria: structuredClone(exitGates) },
    ...(reviewGate !== undefined ? { reviewGate: structuredClone(reviewGate) } : {}),
  };
  const initiative = {
    __projectId: 'atomic-skills', slug: 'demo-f4', parentPlan: 'demo', phaseId: 'F4', status: 'active',
    tasks: [{ id: 'T-1', status: 'done' }],
    exitGates: structuredClone(exitGates),
  };
  return {
    plan: { __projectId: 'atomic-skills', slug: 'demo', phases: [phase] },
    phase,
    initiative,
    tasks: initiative.tasks,
    exitGates: structuredClone(exitGates),
    ...(reviewGate !== undefined ? { reviewGate: structuredClone(reviewGate) } : {}),
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

const loadStateFor = (request) => async () => structuredClone(request);

function terminalTransactionInput(root, overrides = {}) {
  const request = transactionInput(root, overrides);
  request.phase.status = 'done';
  request.plan.phases[0].status = 'done';
  request.initiative.status = 'archived';
  return request;
}

function recordPhaseCompletion(root, request, closeSha = SHA) {
  const idempotencyKey = buildPhaseDoneIdempotencyKey(request.close);
  return ensureCompletion(root, {
    event: 'phase-done',
    projectId: request.close.projectId,
    planSlug: request.close.planSlug,
    phaseId: request.close.phaseId,
    taskId: null,
    ...(request.close.generation !== undefined ? { generation: request.close.generation } : {}),
    weight: request.close.weight,
    weightBasis: request.close.weightBasis,
    idempotencyKey,
    closeSha,
    ts: request.close.closedAt,
    ...(request.actuals !== undefined ? { actuals: request.actuals } : {}),
  });
}

async function leaveTaskCloseStatePersisted(root) {
  const task = { id: 'T-1', status: 'active', weight: 4 };
  const initiative = {
    __projectId: 'atomic-skills', slug: 'demo-f4', parentPlan: 'demo', phaseId: 'F4',
    status: 'active', tasks: [task],
  };
  const request = {
    root,
    initiative,
    close: {
      projectId: 'atomic-skills', planSlug: 'demo', phaseId: 'F4', taskId: 'T-1',
      closedAt: '2026-07-14T19:59:00Z', weight: 4, weightBasis: 'count',
    },
    evidence: { verifierKind: 'shell', verifiedAt: '2026-07-14T19:59:00Z', passed: true },
    nextAction: 'Close the phase after task recovery.',
    handoff: {
      narrative: 'Task state persisted before the injected failure.',
      decisionLog: 'The task marker remains the recovery authority.',
      singleNextAction: 'Close the phase after task recovery.',
      verbatimState: 'state-persisted',
      uncommittedChanges: 'task marker remains',
    },
  };
  let authoritative = structuredClone(initiative);
  await assert.rejects(executeDoneTransaction(request, {
    loadInitiative: async () => structuredClone(authoritative),
    persistClose: async ({ bundle }) => {
      authoritative.tasks = authoritative.tasks.map((item) => (
        item.id === bundle.task.id ? structuredClone(bundle.task) : item
      ));
    },
    refresh: async () => {},
    ensureCompletion: async () => { throw new Error('injected task event failure'); },
    findCheckpoint: async () => undefined,
    checkpoint: async () => ({ sha: SHA }),
    assertClean: async () => true,
  }), /injected task event failure/);
  return authoritative;
}

test('phase close keys bind to authoritative generations instead of branch-local timestamps', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-generation-key-'));
  try {
    const close = transactionInput(root).close;
    const branchA = buildPhaseDoneIdempotencyKey({ ...close, closedAt: '2026-07-14T20:00:00Z', generation: 1 });
    const branchB = buildPhaseDoneIdempotencyKey({ ...close, closedAt: '2026-07-14T20:05:00Z', generation: 1 });
    const reopened = buildPhaseDoneIdempotencyKey({ ...close, closedAt: '2026-07-14T21:00:00Z', generation: 2 });
    assert.equal(branchA, branchB, 'one authoritative generation must have one branch-stable key');
    assert.notEqual(reopened, branchA, 'a real reopen/reclose generation must remain distinct');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('phase close persists its first authoritative completion generation in both mirrors and analytics', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-generation-state-'));
  let committed;
  try {
    const request = transactionInput(root);
    const result = await executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      findCommit: async () => undefined,
      commit: async (candidate) => { committed = structuredClone(candidate); return { closeSha: SHA }; },
      emit: async () => {},
      assertClean: async () => true,
    });
    const completion = JSON.parse(readFileSync(LOG(root), 'utf8').trim());
    assert.equal(committed.phase.completionGeneration, 1);
    assert.equal(committed.plan.phases[0].completionGeneration, 1);
    assert.equal(committed.initiative.completionGeneration, 1);
    assert.equal(completion.generation, 1);
    assert.match(result.idempotencyKey, /#1$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('open task blocks before verifiers, review, writes or events', async () => {
  const calls = [];
  const input = base();
  input.initiative.tasks = [{ id: 'T-1', status: 'pending' }];
  input.tasks = input.initiative.tasks;
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

test('phase close rejects a done task whose task-close transaction is still incomplete', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-incomplete-task-close-'));
  try {
    const initiative = await leaveTaskCloseStatePersisted(root);
    const request = transactionInput(root);
    request.initiative = { ...initiative, exitGates: structuredClone(request.exitGates) };
    request.tasks = structuredClone(request.initiative.tasks);
    let commitCalls = 0;
    await assert.rejects(executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      findCommit: async () => undefined,
      commit: async () => { commitCalls += 1; return { closeSha: SHA }; },
      emit: async () => {},
      assertClean: async () => true,
    }), /incomplete task close|task-close transaction/i);
    assert.equal(commitCalls, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('phase close rejects a generated done task without its completion event', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-missing-task-completion-'));
  try {
    const request = transactionInput(root);
    request.initiative.tasks[0] = {
      ...request.initiative.tasks[0],
      closedAt: '2026-07-14T19:59:00Z',
      completionGeneration: 1,
      weight: 4,
    };
    request.tasks = structuredClone(request.initiative.tasks);
    await assert.rejects(executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      findCommit: async () => undefined,
      commit: async () => ({ closeSha: SHA }),
      emit: async () => {},
      assertClean: async () => true,
    }), /task T-1.*completion generation 1|completion.*T-1.*missing/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('phase close authenticates a generated done task completion before commit', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-auth-task-completion-'));
  try {
    const request = transactionInput(root);
    const task = {
      ...request.initiative.tasks[0],
      closedAt: '2026-07-14T19:59:00Z',
      completionGeneration: 1,
      weight: 4,
    };
    request.initiative.tasks[0] = task;
    request.tasks = structuredClone(request.initiative.tasks);
    const taskClose = {
      projectId: request.close.projectId,
      planSlug: request.close.planSlug,
      phaseId: request.close.phaseId,
      taskId: task.id,
      closedAt: task.closedAt,
      generation: task.completionGeneration,
    };
    ensureCompletion(root, {
      event: 'task-done', projectId: taskClose.projectId, planSlug: taskClose.planSlug,
      phaseId: taskClose.phaseId, taskId: taskClose.taskId,
      generation: taskClose.generation, weight: task.weight, weightBasis: 'proxy',
      idempotencyKey: buildDoneIdempotencyKey(taskClose), ts: taskClose.closedAt,
    });
    const result = await executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      findCommit: async () => undefined,
      commit: async () => ({ closeSha: SHA }),
      emit: async () => {},
      assertClean: async () => true,
    });
    assert.equal(result.ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('invalid transaction envelope fails before evidence production', async () => {
  const calls = [];
  await assert.rejects(
    executePhaseDoneTransaction(base(), {
      produceEvidence: async () => { calls.push('evidence'); },
    }),
    /root is required/i,
  );
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
      produceEvidence: async (authoritative) => {
        calls.push('evidence');
        const reviewGate = {
          status: 'passed', at: SHA, mode: 'local', reviewFile: REVIEW_FILE,
        };
        const phase = { ...structuredClone(authoritative.phase), reviewGate };
        return {
          plan: { ...structuredClone(authoritative.plan), phases: [phase] },
          phase,
          initiative: structuredClone(authoritative.initiative),
          exitGates: structuredClone(phase.exitGate.criteria),
          reviewGate,
          currentHead: SHA,
          reviewCommitExists: true,
          reviewFileMatches: true,
          worktreeDirty: false,
          lessonsState: 'recorded',
        };
      },
      loadState: loadStateFor(input),
      findCommit: async () => undefined,
      commit: async () => { calls.push('commit'); return { closeSha: SHA }; },
      emit: async () => calls.push('emit'),
      assertClean: async () => true,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ['evidence', 'commit', 'emit']);
    assert.deepEqual(result.value, { closeSha: SHA });
    const completion = JSON.parse(readFileSync(LOG(root), 'utf8').trim());
    assert.equal(completion.event, 'phase-done');
    assert.equal(completion.idempotencyKey, firstGenerationKey(input.close));
    assert.equal(completion.closeSha, SHA);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('phase close persists available aggregate actuals when the event effect is a no-op', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-actuals-fallback-'));
  try {
    const actuals = { filesChanged: 7, locAdded: 91, locRemoved: 12, commits: 3 };
    const request = transactionInput(root, { actuals });
    const result = await executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      findCommit: async () => undefined,
      commit: async () => ({ closeSha: SHA }),
      emit: async () => {},
      assertClean: async () => true,
    });

    assert.equal(result.ok, true);
    const completion = JSON.parse(readFileSync(LOG(root), 'utf8').trim());
    // Mutation guard: omitting marker.actuals from the coordinator candidate drops this payload.
    assert.deepEqual(completion.actuals, actuals);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('phase close authenticates a compliant emitter carrying aggregate actuals', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-actuals-emitter-'));
  try {
    const actuals = { filesChanged: 4, locAdded: 33, locRemoved: 5, commits: 2 };
    const request = transactionInput(root, { actuals });
    const result = await executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      findCommit: async () => undefined,
      commit: async () => ({ closeSha: SHA }),
      emit: async (closeInput) => recordPhaseCompletion(root, closeInput),
      assertClean: async () => true,
    });

    assert.equal(result.ok, true);
    const records = readFileSync(LOG(root), 'utf8').trim().split('\n').map(JSON.parse);
    // Mutation guard: rebuilding the authentication candidate without actuals conflicts here.
    assert.equal(records.length, 1);
    assert.deepEqual(records[0].actuals, actuals);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('phase recovery retains the original aggregate actuals after the event boundary fails', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-actuals-recovery-'));
  try {
    const originalActuals = { filesChanged: 5, locAdded: 44, locRemoved: 6, commits: 2 };
    const request = transactionInput(root, { actuals: originalActuals });
    let failAfterAppend = true;
    const effects = {
      loadState: loadStateFor(request),
      findCommit: async () => ({ closeSha: SHA }),
      commit: async () => ({ closeSha: SHA }),
      emit: async () => {},
      ensureCompletion: (ledgerRoot, entry) => {
        const completion = ensureCompletion(ledgerRoot, entry);
        if (failAfterAppend) {
          failAfterAppend = false;
          throw new Error('injected post-event boundary failure');
        }
        return completion;
      },
      assertClean: async () => true,
    };

    await assert.rejects(
      executePhaseDoneTransaction(request, effects),
      /injected post-event boundary failure/,
    );
    const idempotencyKey = firstGenerationKey(request.close);
    assert.equal(readPhaseDoneRecovery(root, idempotencyKey).stage, 'committed');

    const resumed = await executePhaseDoneTransaction({
      ...request,
      actuals: { filesChanged: 999, locAdded: 999, locRemoved: 999, commits: 999 },
    }, effects);
    assert.equal(resumed.ok, true);
    const completion = JSON.parse(readFileSync(LOG(root), 'utf8').trim());
    // Mutation guard: adopting retry input instead of marker.actuals changes immutable telemetry.
    assert.deepEqual(completion.actuals, originalActuals);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('phase close rejects malformed aggregate actuals before creating recovery state', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-invalid-actuals-'));
  try {
    const request = transactionInput(root, {
      actuals: { filesChanged: 3, source: 'invented' },
    });
    const idempotencyKey = firstGenerationKey(request.close);
    await assert.rejects(
      executePhaseDoneTransaction(request, {}),
      /unknown actuals field/i,
    );
    // Mutation guard: delaying validation until ensureCompletion leaves a prepared marker.
    assert.equal(existsSync(phaseDoneRecoveryPath(root, idempotencyKey)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('evidence production may return an authenticated candidate state bundle for both gate mirrors', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-candidate-'));
  try {
    const pending = [{ id: 'F4-G1', status: 'pending' }];
    const request = transactionInput(root);
    request.phase.exitGate.criteria = structuredClone(pending);
    request.plan.phases[0] = structuredClone(request.phase);
    request.initiative.exitGates = structuredClone(pending);
    request.exitGates = structuredClone(pending);
    delete request.reviewGate;
    let commitCalls = 0;
    const result = await executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      produceEvidence: async (authoritative) => {
        const gates = [{
          id: 'F4-G1', status: 'met', evidence: { passed: true, verifiedCommit: SHA },
        }];
        const phase = {
          ...structuredClone(authoritative.phase),
          exitGate: { criteria: structuredClone(gates) },
          reviewGate: { status: 'passed', at: SHA, mode: 'local', reviewFile: REVIEW_FILE },
        };
        return {
          plan: { ...structuredClone(authoritative.plan), phases: [phase] },
          phase,
          initiative: { ...structuredClone(authoritative.initiative), exitGates: structuredClone(gates) },
          reviewGate: phase.reviewGate,
          currentHead: SHA,
          reviewCommitExists: true,
          reviewFileMatches: true,
          worktreeDirty: false,
          lessonsState: 'recorded',
        };
      },
      findCommit: async () => undefined,
      commit: async () => { commitCalls += 1; return { closeSha: SHA }; },
      emit: async () => {},
      assertClean: async () => true,
    });
    assert.equal(result.ok, true);
    assert.equal(commitCalls, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('allowed close rejects a missing commit effect before creating recovery state', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-tx-'));
  try {
    const input = transactionInput(root);
    const idempotencyKey = firstGenerationKey(input.close);
    await assert.rejects(
      executePhaseDoneTransaction(input, {
        findCommit: async () => undefined,
        emit: async () => {},
        assertClean: async () => true,
        loadState: loadStateFor(input),
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
    const idempotencyKey = firstGenerationKey(input.close);
    await assert.rejects(
      executePhaseDoneTransaction(input, {
        loadState: loadStateFor(input),
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
    const idempotencyKey = firstGenerationKey(input.close);
    let storedCommit;
    let commitCalls = 0;
    let emitCalls = 0;
    const effects = {
      loadState: loadStateFor(input),
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
          generation: closeInput.close.generation,
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

test('phase recovery is discovered by logical scope when a retry supplies a new timestamp', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-scope-recovery-'));
  try {
    const first = transactionInput(root);
    let storedCommit;
    let commitCalls = 0;
    let emitCalls = 0;
    const effects = {
      loadState: async ({ candidate }) => structuredClone(candidate),
      findCommit: async () => storedCommit,
      commit: async () => {
        commitCalls += 1;
        storedCommit = { closeSha: SHA };
        return storedCommit;
      },
      emit: async (request) => {
        emitCalls += 1;
        if (emitCalls === 1) throw new Error('injected post-event failure');
        recordPhaseCompletion(root, request, SHA);
      },
      assertClean: async () => true,
    };
    await assert.rejects(executePhaseDoneTransaction(first, effects), /injected post-event failure/);

    const retry = terminalTransactionInput(root, {
      close: { ...first.close, closedAt: '2026-07-14T21:00:00Z' },
    });
    const result = await executePhaseDoneTransaction(retry, effects);
    assert.equal(result.ok, true);
    assert.equal(result.idempotencyKey, firstGenerationKey(first.close));
    assert.equal(commitCalls, 1);
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 1);
    assert.equal(readPhaseDoneRecovery(root, firstGenerationKey(first.close)), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('committed recovery resumes after HEAD moves without rerunning the new-close guard', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-tx-'));
  try {
    const request = transactionInput(root);
    let storedCommit;
    let evidenceCalls = 0;
    let emitCalls = 0;
    const effects = {
      loadState: loadStateFor(request),
      produceEvidence: async () => { evidenceCalls += 1; return {}; },
      findCommit: async () => storedCommit,
      commit: async () => {
        storedCommit = { closeSha: 'b'.repeat(40) };
        return storedCommit;
      },
      emit: async () => {
        emitCalls += 1;
        if (emitCalls === 1) throw new Error('injected event failure');
      },
      assertClean: async () => true,
    };
    await assert.rejects(executePhaseDoneTransaction(request, effects), /injected event failure/);
    const resumedInput = {
      ...request,
      currentHead: storedCommit.closeSha,
      reviewCommitExists: false,
      reviewFileMatches: false,
      exitGates: request.exitGates.map((gate) => ({
        ...gate,
        evidence: { ...gate.evidence, verifiedCommit: SHA },
      })),
    };
    const resumed = await executePhaseDoneTransaction(resumedInput, effects);
    assert.equal(resumed.ok, true);
    assert.equal(evidenceCalls, 1);
    assert.equal(emitCalls, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('committed recovery fails closed when findCommit cannot authenticate the stored close', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-tx-'));
  try {
    const request = transactionInput(root);
    const firstEffects = {
      loadState: loadStateFor(request),
      findCommit: async () => undefined,
      commit: async () => ({ closeSha: 'b'.repeat(40) }),
      emit: async () => { throw new Error('injected event failure'); },
      assertClean: async () => true,
    };
    await assert.rejects(executePhaseDoneTransaction(request, firstEffects), /injected event failure/);
    await assert.rejects(executePhaseDoneTransaction({
      ...request,
      currentHead: 'b'.repeat(40),
    }, {
      ...firstEffects,
      findCommit: async () => undefined,
      emit: async () => assert.fail('unauthenticated recovery must not emit'),
    }), /stored closeSha could not be authenticated/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('successor failure resumes after the durable event without recommit or re-emit', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-tx-'));
  try {
    const publication = successorFixture(root);
    const input = transactionInput(root, {
      successor: publication.successor,
    });
    const idempotencyKey = firstGenerationKey(input.close);
    let commitCalls = 0;
    let emitCalls = 0;
    let materializeCalls = 0;
    let storedCommit;
    const effects = {
      loadState: loadStateFor(input),
      findCommit: async () => storedCommit,
      commit: async () => {
        commitCalls += 1;
        storedCommit = { closeSha: SHA };
        return storedCommit;
      },
      emit: async () => { emitCalls += 1; },
      materializeSuccessor: async () => {
        materializeCalls += 1;
        if (materializeCalls === 1) throw new Error('injected successor failure');
        publication.publish();
        return { publication: successorPublicationEvidence(input.successor) };
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

test('successor publication without authenticated evidence retains the emitted recovery marker', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-successor-evidence-'));
  try {
    const successor = {
      phaseId: 'F3', planPath: 'plan.md', initiativePath: 'phases/f3.md',
      planHash: 'b'.repeat(64), initiativeHash: 'c'.repeat(64),
    };
    const request = transactionInput(root, { successor });
    const idempotencyKey = firstGenerationKey(request.close);
    let storedCommit;
    await assert.rejects(
      executePhaseDoneTransaction(request, {
        loadState: loadStateFor(request),
        findCommit: async () => storedCommit,
        commit: async () => {
          storedCommit = { closeSha: SHA };
          return storedCommit;
        },
        emit: async () => {},
        materializeSuccessor: async () => undefined,
        assertClean: async () => true,
      }),
      /authenticated successor publication evidence/i,
    );
    assert.equal(readPhaseDoneRecovery(root, idempotencyKey).stage, 'emitted');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('exact-shape forged successor evidence without live publication retains the emitted marker', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-successor-forged-'));
  try {
    const successor = {
      phaseId: 'F3', planPath: 'plan.md', initiativePath: 'phases/f3.md',
      planHash: 'b'.repeat(64), initiativeHash: 'c'.repeat(64),
    };
    const request = transactionInput(root, { successor });
    const idempotencyKey = firstGenerationKey(request.close);
    let storedCommit;
    await assert.rejects(
      executePhaseDoneTransaction(request, {
        loadState: loadStateFor(request),
        findCommit: async () => storedCommit,
        commit: async () => {
          storedCommit = { closeSha: SHA };
          return storedCommit;
        },
        emit: async () => {},
        materializeSuccessor: async () => ({
          publication: successorPublicationEvidence(successor),
        }),
        assertClean: async () => true,
      }),
      /authenticated successor publication evidence/i,
    );
    assert.equal(readPhaseDoneRecovery(root, idempotencyKey).stage, 'emitted');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('successor recovery rejects a changed or omitted successor manifest', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-successor-drift-'));
  try {
    const successor = {
      phaseId: 'F3', planPath: 'plan.md', initiativePath: 'phases/f3.md',
      planHash: 'b'.repeat(64), initiativeHash: 'c'.repeat(64),
    };
    const request = transactionInput(root, { successor });
    let storedCommit;
    const effects = {
      loadState: async () => ({
        plan: request.plan, phase: request.phase, initiative: request.initiative,
        tasks: request.tasks, exitGates: request.exitGates,
      }),
      findCommit: async () => storedCommit,
      commit: async () => {
        storedCommit = { closeSha: SHA };
        return storedCommit;
      },
      emit: async () => {},
      materializeSuccessor: async () => { throw new Error('injected successor failure'); },
      assertClean: async () => true,
    };
    await assert.rejects(executePhaseDoneTransaction(request, effects), /injected successor failure/);
    await assert.rejects(
      executePhaseDoneTransaction({
        ...request,
        successor: { ...successor, phaseId: 'F5' },
      }, {
        ...effects,
        materializeSuccessor: async () => {},
      }),
      /successor manifest conflicts/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('terminal phase reuse fails closed without its canonical completion event', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-terminal-event-'));
  try {
    const request = terminalTransactionInput(root);
    await assert.rejects(
      executePhaseDoneTransaction(request, {
        loadState: loadStateFor(request),
        findCommit: async () => ({ closeSha: SHA }),
        commit: async () => assert.fail('terminal reuse must not recommit'),
        emit: async () => assert.fail('terminal reuse must not emit a replacement event'),
        assertClean: async () => true,
      }),
      /canonical phase-done completion|completion event/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('terminal phase reuse authenticates guard, commit and canonical completion identity', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-terminal-auth-'));
  try {
    const request = terminalTransactionInput(root);
    recordPhaseCompletion(root, request);
    const result = await executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      findCommit: async () => ({ closeSha: SHA }),
      commit: async () => assert.fail('terminal reuse must not recommit'),
      emit: async () => assert.fail('terminal reuse must not re-emit'),
      assertClean: async () => true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.reused, true);
    assert.equal(result.idempotencyKey, buildPhaseDoneIdempotencyKey(request.close));
    assert.equal(result.closeSha, SHA);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('terminal phase reuse never replays a caller-supplied successor effect', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-terminal-read-only-'));
  try {
    const request = terminalTransactionInput(root, {
      successor: {
        phaseId: 'F3', planPath: 'plan.md', initiativePath: 'phases/f3.md',
        planHash: 'b'.repeat(64), initiativeHash: 'c'.repeat(64),
      },
    });
    recordPhaseCompletion(root, request);
    let materializeCalls = 0;
    const result = await executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      findCommit: async () => ({ closeSha: SHA }),
      commit: async () => assert.fail('terminal reuse must not recommit'),
      emit: async () => assert.fail('terminal reuse must not re-emit'),
      materializeSuccessor: async () => { materializeCalls += 1; },
      assertClean: async () => true,
    });
    assert.equal(result.reused, true);
    assert.equal(materializeCalls, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('terminal phase reuse still enforces the close guard', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-terminal-guard-'));
  try {
    const request = terminalTransactionInput(root, { reviewGate: undefined });
    recordPhaseCompletion(root, request);
    const result = await executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      findCommit: async () => ({ closeSha: SHA }),
      commit: async () => assert.fail('invalid terminal state must not recommit'),
      emit: async () => assert.fail('invalid terminal state must not emit'),
      assertClean: async () => true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, 'commit-guard');
    assert.equal(result.decision.code, 'phase-done-review-open');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('terminal phase reuse trusts the persisted descriptor review over a detached caller slice', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-terminal-review-authority-'));
  try {
    const request = terminalTransactionInput(root);
    request.phase.reviewGate = { status: 'pending' };
    request.plan.phases[0].reviewGate = request.phase.reviewGate;
    recordPhaseCompletion(root, request);
    const result = await executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      findCommit: async () => ({ closeSha: SHA }),
      commit: async () => assert.fail('invalid terminal state must not recommit'),
      emit: async () => assert.fail('invalid terminal state must not emit'),
      assertClean: async () => true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, 'commit-guard');
    assert.match(result.decision.code, /^phase-done-review-/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('terminal phase reuse binds the canonical completion to the authenticated commit', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-terminal-close-sha-'));
  try {
    const request = terminalTransactionInput(root);
    recordPhaseCompletion(root, request, SHA);
    await assert.rejects(
      executePhaseDoneTransaction(request, {
        loadState: loadStateFor(request),
        findCommit: async () => ({ closeSha: 'b'.repeat(40) }),
        commit: async () => assert.fail('terminal reuse must not recommit'),
        emit: async () => assert.fail('terminal reuse must not emit'),
        assertClean: async () => true,
      }),
      /completion event does not match.*close commit/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('terminal phase reuse rejects ambiguous generation-less reopen history', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-terminal-reclose-'));
  try {
    const first = terminalTransactionInput(root);
    recordPhaseCompletion(root, first, SHA);
    const second = terminalTransactionInput(root, {
      close: { ...first.close, closedAt: '2026-07-14T21:00:00Z' },
    });
    const latestSha = 'b'.repeat(40);
    recordPhaseCompletion(root, second, latestSha);
    const detachedRetry = terminalTransactionInput(root, {
      close: { ...first.close, closedAt: '2026-07-14T22:00:00Z' },
    });

    await assert.rejects(executePhaseDoneTransaction(detachedRetry, {
      loadState: loadStateFor(detachedRetry),
      findCommit: async () => assert.fail('ambiguous legacy history has no authenticated close'),
      commit: async () => assert.fail('terminal reuse must not recommit'),
      emit: async () => assert.fail('terminal reuse must not re-emit'),
      assertClean: async () => true,
    }), /unambiguous legacy generation.*found 2/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('terminal phase reuse selects the generation mirrored by authoritative state', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-terminal-authoritative-generation-'));
  try {
    const authoritative = terminalTransactionInput(root);
    authoritative.phase.completionGeneration = 1;
    authoritative.plan.phases[0].completionGeneration = 1;
    authoritative.initiative.completionGeneration = 1;
    authoritative.close.generation = 1;
    recordPhaseCompletion(root, authoritative, SHA);

    const stray = terminalTransactionInput(root, {
      close: {
        ...authoritative.close,
        closedAt: '2026-07-14T21:00:00Z',
        generation: 2,
      },
    });
    recordPhaseCompletion(root, stray, 'b'.repeat(40));

    const result = await executePhaseDoneTransaction(authoritative, {
      loadState: loadStateFor(authoritative),
      findCommit: async () => ({ closeSha: SHA }),
      commit: async () => assert.fail('terminal reuse must not recommit'),
      emit: async () => assert.fail('terminal reuse must not emit'),
      assertClean: async () => true,
    });
    assert.equal(result.reused, true);
    assert.equal(result.idempotencyKey, buildPhaseDoneIdempotencyKey(authoritative.close));
    assert.equal(result.closeSha, SHA);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('concurrent phase closes serialize on phase identity instead of closedAt', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-race-'));
  try {
    const first = transactionInput(root);
    const second = transactionInput(root, {
      close: { ...first.close, closedAt: '2026-07-14T20:00:01Z' },
    });
    let state = {
      plan: structuredClone(first.plan),
      phase: structuredClone(first.phase),
      initiative: structuredClone(first.initiative),
      tasks: structuredClone(first.tasks),
      exitGates: structuredClone(first.exitGates),
    };
    let commitCalls = 0;
    let storedCommit;
    const effects = {
      loadState: async () => structuredClone(state),
      findCommit: async () => storedCommit,
      commit: async (request) => {
        commitCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        state.plan = structuredClone(request.plan);
        state.phase = { ...structuredClone(request.phase), status: 'done' };
        state.plan.phases[0] = structuredClone(state.phase);
        state.initiative = { ...structuredClone(request.initiative), status: 'done' };
        state.tasks = structuredClone(state.initiative.tasks);
        state.exitGates = structuredClone(state.phase.exitGate.criteria);
        storedCommit = { closeSha: String(commitCalls).padStart(40, 'a') };
        return storedCommit;
      },
      emit: async (request) => {
        recordPhaseCompletion(root, request, storedCommit.closeSha);
      },
      assertClean: async () => true,
    };
    const results = await Promise.all([
      executePhaseDoneTransaction(first, effects),
      executePhaseDoneTransaction(second, effects),
    ]);
    assert.equal(commitCalls, 1);
    assert.equal(results.filter((result) => result.reused === true).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('different phase scopes in one parallel plan serialize on the shared plan identity', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-plan-race-'));
  try {
    const first = transactionInput(root);
    const second = structuredClone(first);
    second.close = { ...second.close, phaseId: 'F5', closedAt: '2026-07-14T20:00:01Z' };
    second.phase = { ...second.phase, id: 'F5', slug: 'demo-f5' };
    second.initiative = {
      ...second.initiative,
      slug: 'demo-f5',
      phaseId: 'F5',
    };
    const parallelPlan = {
      ...first.plan,
      parallelismAllowed: true,
      phases: [structuredClone(first.phase), structuredClone(second.phase)],
    };
    first.plan = structuredClone(parallelPlan);
    second.plan = structuredClone(parallelPlan);

    let activeLoads = 0;
    let maximumConcurrentLoads = 0;
    const effects = {
      loadState: async ({ candidate }) => {
        activeLoads += 1;
        maximumConcurrentLoads = Math.max(maximumConcurrentLoads, activeLoads);
        await new Promise((resolveWait) => setTimeout(resolveWait, 50));
        activeLoads -= 1;
        return structuredClone(candidate);
      },
      findCommit: async () => undefined,
      commit: async (request) => ({
        closeSha: request.close.phaseId === 'F4' ? 'b'.repeat(40) : 'c'.repeat(40),
      }),
      emit: async () => {},
      assertClean: async () => true,
    };
    const results = await Promise.all([
      executePhaseDoneTransaction(first, effects),
      executePhaseDoneTransaction(second, effects),
    ]);
    assert.equal(results.every((result) => result.ok), true);
    assert.equal(maximumConcurrentLoads, 1, 'different phase locks exposed concurrent plan snapshots');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('commit guard rejects a changed review fingerprint after evidence without terminal effects', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-guard-'));
  try {
    const calls = [];
    const request = transactionInput(root, {
      reviewGate: undefined,
      exitGates: [{ id: 'F4-G1', status: 'pending' }],
    });
    const result = await executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      produceEvidence: async (authoritative) => {
        const reviewGate = {
          status: 'passed', at: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          mode: 'local', reviewFile: REVIEW_FILE,
        };
        const phase = { ...structuredClone(authoritative.phase), reviewGate };
        return {
          plan: { ...structuredClone(authoritative.plan), phases: [phase] },
          phase,
          initiative: structuredClone(authoritative.initiative),
          exitGates: structuredClone(phase.exitGate.criteria),
          reviewGate,
          currentHead: SHA,
          reviewCommitExists: true,
          reviewFileMatches: true,
          worktreeDirty: false,
          lessonsState: 'recorded',
        };
      },
      findCommit: async () => undefined,
      commit: async () => calls.push('commit'),
      emit: async () => calls.push('emit'),
      assertClean: async () => true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, 'commit-guard');
    assert.equal(result.decision.code, 'phase-done-review-stale');
    assert.deepEqual(calls, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('active close cannot inject a detached review absent from the candidate descriptor', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-detached-review-'));
  try {
    const request = transactionInput(root, { reviewGate: undefined });
    const calls = [];
    const result = await executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      produceEvidence: async () => ({
        reviewGate: {
          status: 'passed', at: SHA, mode: 'local', reviewFile: REVIEW_FILE,
        },
        currentHead: SHA,
        reviewCommitExists: true,
        reviewFileMatches: true,
        worktreeDirty: false,
        lessonsState: 'recorded',
      }),
      findCommit: async () => undefined,
      commit: async () => calls.push('commit'),
      emit: async () => calls.push('emit'),
      assertClean: async () => true,
    });

    assert.equal(result.ok, false);
    assert.equal(result.stage, 'commit-guard');
    assert.match(result.decision.code, /^phase-done-review-/);
    assert.deepEqual(calls, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('review fixes that change HEAD invalidate gate evidence until verifiers rerun', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-guard-'));
  try {
    const reviewedHead = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const calls = [];
    const request = transactionInput(root, {
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
    });
    const result = await executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      findCommit: async () => undefined,
      commit: async () => calls.push('commit'),
      emit: async () => calls.push('emit'),
      assertClean: async () => true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, 'commit-guard');
    assert.equal(result.decision.code, 'phase-done-gate-evidence-stale');
    assert.deepEqual(calls, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('commit guard rejects arbitrary review identifiers before terminal effects', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-phase-done-guard-'));
  try {
    const calls = [];
    const request = transactionInput(root, {
      reviewGate: {
        status: 'passed', at: 'working-tree', mode: 'local',
        reviewFile: '.atomic-skills/reviews/f4.md',
      },
      reviewCommitExists: false,
      reviewFileMatches: false,
    });
    const result = await executePhaseDoneTransaction(request, {
      loadState: loadStateFor(request),
      findCommit: async () => undefined,
      commit: async () => calls.push('commit'),
      emit: async () => calls.push('emit'),
      assertClean: async () => true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.decision.code, 'phase-done-review-sha-invalid');
    assert.deepEqual(calls, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
