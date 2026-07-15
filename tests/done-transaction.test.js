import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildDoneIdempotencyKey,
  doneRecoveryPath,
  executeDoneTransaction,
  readDoneRecovery,
} from '../scripts/done-transaction.js';
import { ensureCompletion } from '../scripts/append-completion.js';
import { appendDispatchRecord } from '../scripts/dispatch-log.js';

const LOG = (root) => join(root, '.atomic-skills', 'analytics', 'completions.jsonl');
const firstGenerationKey = (close) => buildDoneIdempotencyKey({ ...close, generation: 1 });

function input(root, overrides = {}) {
  const task = { id: 'T-005', status: 'active', weight: 4 };
  return {
    root,
    task,
    initiative: {
      __projectId: 'atomic-skills', slug: 'demo-f4', parentPlan: 'demo', phaseId: 'F4',
      status: 'active', tasks: [task],
    },
    close: {
      projectId: 'atomic-skills', planSlug: 'demo', phaseId: 'F4', taskId: 'T-005',
      closedAt: '2026-07-14T20:00:00Z', weight: 4, weightBasis: 'count',
    },
    evidence: { verifierKind: 'shell', verifiedAt: '2026-07-14T20:00:00Z', passed: true },
    nextAction: 'Run `done T-006` after implementing recovery.',
    handoff: {
      narrative: 'T-005 is closed through the durable transaction.',
      decisionLog: 'One close key owns state, event, handoff, and checkpoint.',
      singleNextAction: 'Run `done T-006` after implementing recovery.',
      verbatimState: 'node --test tests/done-transaction.test.js',
      uncommittedChanges: 'clean tree',
    },
    ...overrides,
  };
}

function persistedCloseProvenance(request, actuals) {
  return {
    nextAction: request.nextAction,
    handoff: structuredClone(request.handoff),
    ...(actuals !== undefined ? { actuals: structuredClone(actuals) } : {}),
  };
}

function harness() {
  const state = { bundles: new Map(), checkpoints: new Map(), initiative: null };
  const effects = {
    loadInitiative: async ({ candidate }) => {
      if (!state.initiative) state.initiative = structuredClone(candidate);
      return structuredClone(state.initiative);
    },
    persistClose: async ({ idempotencyKey, bundle }) => {
      state.bundles.set(idempotencyKey, structuredClone(bundle));
      state.initiative.tasks = state.initiative.tasks.map((task) => (
        task.id === bundle.task.id ? structuredClone(bundle.task) : task
      ));
      state.initiative.nextAction = bundle.nextAction;
    },
    refresh: async () => {},
    findCheckpoint: async ({ idempotencyKey }) => state.checkpoints.get(idempotencyKey),
    checkpoint: async ({ idempotencyKey, bundle }) => {
      assert.equal(bundle.task.status, 'done');
      assert.equal(bundle.evidence.passed, true);
      assert.equal(typeof bundle.nextAction, 'string');
      assert.equal(bundle.handoff.uncommittedChanges, 'clean tree');
      const checkpoint = { sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
      state.checkpoints.set(idempotencyKey, checkpoint);
      return checkpoint;
    },
    assertClean: async () => true,
  };
  return { state, effects };
}

function appendTaskDispatch(root, {
  attempt,
  escalationCount,
  startedAt,
  finishedAt,
}) {
  appendDispatchRecord(root, {
    taskId: 'T-005', plan: 'demo', phase: 'F4',
    attempt, escalationCount, startedAt, finishedAt,
  });
}

test('task close keys bind to authoritative generations instead of branch-local timestamps', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-generation-key-'));
  try {
    const close = input(root).close;
    const branchA = buildDoneIdempotencyKey({ ...close, closedAt: '2026-07-14T20:00:00Z', generation: 1 });
    const branchB = buildDoneIdempotencyKey({ ...close, closedAt: '2026-07-14T20:05:00Z', generation: 1 });
    const reopened = buildDoneIdempotencyKey({ ...close, closedAt: '2026-07-14T21:00:00Z', generation: 2 });
    assert.equal(branchA, branchB, 'one authoritative generation must have one branch-stable key');
    assert.notEqual(reopened, branchA, 'a real reopen/reclose generation must remain distinct');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('task close persists its first authoritative completion generation in state and analytics', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-generation-state-'));
  try {
    const { state, effects } = harness();
    const result = await executeDoneTransaction(input(root), effects);
    const bundle = state.bundles.get(result.idempotencyKey);
    const completion = JSON.parse(readFileSync(LOG(root), 'utf8').trim());
    assert.equal(bundle.task.completionGeneration, 1);
    assert.equal(completion.generation, 1);
    assert.match(result.idempotencyKey, /#1$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('task close freezes weight from authoritative task state when the caller omits it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-authoritative-weight-'));
  try {
    const request = input(root);
    delete request.close.weight;
    const { state, effects } = harness();
    const result = await executeDoneTransaction(request, effects);
    const completion = JSON.parse(readFileSync(LOG(root), 'utf8').trim());
    assert.equal(result.bundle.task.weight, 4);
    assert.equal(state.initiative.tasks[0].weight, 4);
    assert.equal(completion.weight, 4);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('task close rejects caller weight that conflicts with authoritative task state', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-weight-conflict-'));
  try {
    const request = input(root, {
      close: { ...input(root).close, weight: 9 },
    });
    const { state, effects } = harness();
    await assert.rejects(
      executeDoneTransaction(request, effects),
      /close weight.*authoritative task weight/i,
    );
    assert.equal(state.bundles.size, 0);
    assert.equal(existsSync(LOG(root)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('same logical close retries to one event, one checkpoint and one complete bundle', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-'));
  try {
    const { state, effects } = harness();
    const request = input(root);
    const idempotencyKey = firstGenerationKey(request.close);
    const first = await executeDoneTransaction(request, effects);
    const retry = await executeDoneTransaction(request, effects);
    assert.equal(first.ok, true);
    assert.equal(retry.ok, true);
    assert.equal(first.idempotencyKey, idempotencyKey);
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 1);
    assert.equal(state.checkpoints.size, 1);
    assert.deepEqual(state.bundles.get(idempotencyKey).handoff, request.handoff);
    assert.deepEqual(
      state.bundles.get(idempotencyKey).task.completionProvenance,
      persistedCloseProvenance(request),
    );
    assert.equal(
      Object.hasOwn(state.bundles.get(idempotencyKey).task, 'weightBasis'),
      false,
      'weightBasis belongs only to the completion event, not strict task state',
    );
    assert.equal(existsSync(doneRecoveryPath(root, idempotencyKey)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('task close rejects phase-only actuals before creating recovery state', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-task-actuals-'));
  try {
    const { state, effects } = harness();
    const request = input(root, { actuals: { filesChanged: 1 } });
    const idempotencyKey = firstGenerationKey(request.close);

    await assert.rejects(
      executeDoneTransaction(request, effects),
      /task completion actuals cannot contain "filesChanged"/,
    );
    assert.equal(state.bundles.size, 0);
    assert.equal(existsSync(doneRecoveryPath(root, idempotencyKey)), false);
    assert.equal(existsSync(LOG(root)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('invalid completion weight is rejected before task state or recovery authority advances', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-invalid-weight-'));
  try {
    const { state, effects } = harness();
    const request = input(root, { close: { ...input(root).close, weight: -1 } });
    const idempotencyKey = firstGenerationKey(request.close);

    await assert.rejects(executeDoneTransaction(request, effects), /weight.*finite.*>= 0/i);
    assert.equal(state.bundles.size, 0);
    assert.equal(existsSync(doneRecoveryPath(root, idempotencyKey)), false);
    assert.equal(existsSync(LOG(root)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('invalid completion basis is rejected before task state or recovery authority advances', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-invalid-basis-'));
  try {
    const { state, effects } = harness();
    const request = input(root, {
      close: { ...input(root).close, weightBasis: 'estimate' },
    });
    const idempotencyKey = firstGenerationKey(request.close);

    await assert.rejects(executeDoneTransaction(request, effects), /weightBasis.*count.*proxy/i);
    assert.equal(state.bundles.size, 0);
    assert.equal(existsSync(doneRecoveryPath(root, idempotencyKey)), false);
    assert.equal(existsSync(LOG(root)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('failure after state persistence leaves a marker and resumes without duplicate analytics', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-'));
  try {
    const { effects } = harness();
    let attempts = 0;
    const failing = {
      ...effects,
      ensureCompletion: async () => {
        attempts += 1;
        throw new Error('injected event failure');
      },
    };
    const request = input(root);
    const idempotencyKey = firstGenerationKey(request.close);
    await assert.rejects(executeDoneTransaction(request, failing), /injected event failure/);
    assert.equal(readDoneRecovery(root, idempotencyKey).stage, 'state-persisted');
    assert.equal(attempts, 1);
    const resumed = await executeDoneTransaction(request, effects);
    assert.equal(resumed.ok, true);
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 1);
    assert.equal(readDoneRecovery(root, idempotencyKey), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('marker-backed task recovery remains reachable after the initiative becomes terminal', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-terminal-recovery-'));
  try {
    const { state, effects } = harness();
    const request = input(root);
    const idempotencyKey = firstGenerationKey(request.close);
    await assert.rejects(executeDoneTransaction(request, {
      ...effects,
      ensureCompletion: async () => { throw new Error('injected event failure'); },
    }), /injected event failure/);
    assert.equal(readDoneRecovery(root, idempotencyKey).stage, 'state-persisted');
    state.initiative.status = 'archived';

    const resumed = await executeDoneTransaction(request, effects);
    assert.equal(resumed.ok, true);
    assert.equal(resumed.reused, true);
    assert.equal(readDoneRecovery(root, idempotencyKey), null);
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('completion fsync failure keeps task recovery live until the existing event is durable', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-fsync-'));
  try {
    const { effects } = harness();
    const request = input(root);
    const idempotencyKey = firstGenerationKey(request.close);
    const failing = {
      ...effects,
      ensureCompletion: (ledgerRoot, entry) => ensureCompletion(ledgerRoot, entry, {
        beforeFileSync: () => { throw new Error('injected completion fsync failure'); },
      }),
    };

    await assert.rejects(
      executeDoneTransaction(request, failing),
      /injected completion fsync failure/,
    );
    assert.equal(readDoneRecovery(root, idempotencyKey).stage, 'state-persisted');
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 1);

    const resumed = await executeDoneTransaction(request, effects);
    // Mutation guard: returning before fsync clears this marker during the failing attempt.
    assert.equal(resumed.ok, true);
    assert.equal(readDoneRecovery(root, idempotencyKey), null);
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('task recovery freezes dispatch actuals before its first event attempt', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-actuals-pre-event-'));
  try {
    appendTaskDispatch(root, {
      attempt: 1,
      escalationCount: 0,
      startedAt: '2026-07-14T19:59:50Z',
      finishedAt: '2026-07-14T20:00:00Z',
    });
    const { effects } = harness();
    const request = input(root);
    const idempotencyKey = firstGenerationKey(request.close);
    await assert.rejects(executeDoneTransaction(request, {
      ...effects,
      ensureCompletion: async () => { throw new Error('injected pre-event failure'); },
    }), /injected pre-event failure/);

    const marker = readDoneRecovery(root, idempotencyKey);
    assert.equal(marker.stage, 'state-persisted');
    // Mutation guard: deriving only inside ensureCompletion leaves bundle.actuals absent.
    assert.deepEqual(marker.bundle.actuals, { attempts: 1, escalations: 0, durationMs: 10000 });

    appendTaskDispatch(root, {
      attempt: 2,
      escalationCount: 1,
      startedAt: '2026-07-14T20:00:01Z',
      finishedAt: '2026-07-14T20:00:31Z',
    });
    const resumed = await executeDoneTransaction(request, effects);
    assert.equal(resumed.ok, true);
    const completion = JSON.parse(readFileSync(LOG(root), 'utf8').trim());
    assert.deepEqual(completion.actuals, { attempts: 1, escalations: 0, durationMs: 10000 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkpointed task recovery repairs a missing event with persisted actuals after dispatch drift', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-actuals-repair-'));
  try {
    appendTaskDispatch(root, {
      attempt: 1,
      escalationCount: 0,
      startedAt: '2026-07-14T19:59:55Z',
      finishedAt: '2026-07-14T20:00:00Z',
    });
    const { effects } = harness();
    const request = input(root);
    const idempotencyKey = firstGenerationKey(request.close);
    await assert.rejects(executeDoneTransaction(request, {
      ...effects,
      assertClean: async () => false,
    }), /clean task-owned worktree/);
    assert.equal(readDoneRecovery(root, idempotencyKey).stage, 'checkpointed');

    appendTaskDispatch(root, {
      attempt: 3,
      escalationCount: 2,
      startedAt: '2026-07-14T20:00:02Z',
      finishedAt: '2026-07-14T20:01:02Z',
    });
    unlinkSync(LOG(root));
    const resumed = await executeDoneTransaction(request, effects);
    assert.equal(resumed.ok, true);
    const completion = JSON.parse(readFileSync(LOG(root), 'utf8').trim());
    // Mutation guard: re-deriving during repair would select attempt 3 instead of attempt 1.
    assert.deepEqual(completion.actuals, { attempts: 1, escalations: 0, durationMs: 5000 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('markerless already-done repair uses schema-backed close actuals after dispatch drift', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-markerless-actuals-'));
  try {
    const original = input(root);
    const frozenActuals = { attempts: 1, escalations: 0, durationMs: 5000 };
    const task = {
      id: 'T-005', status: 'done', closedAt: original.close.closedAt,
      weight: original.close.weight, weightBasis: original.close.weightBasis,
      evidence: structuredClone(original.evidence),
      completionProvenance: persistedCloseProvenance(original, frozenActuals),
    };
    const request = input(root, {
      task,
      initiative: {
        ...original.initiative,
        nextAction: original.nextAction,
        tasks: [task],
      },
    });
    appendTaskDispatch(root, {
      attempt: 9,
      escalationCount: 4,
      startedAt: '2026-07-14T20:01:00Z',
      finishedAt: '2026-07-14T20:03:00Z',
    });

    const result = await executeDoneTransaction(request, harness().effects);
    assert.equal(result.reused, true);
    assert.deepEqual(JSON.parse(readFileSync(LOG(root), 'utf8')).actuals, frozenActuals);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('markerless already-done repair cannot inject actuals omitted by persisted provenance', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-markerless-no-actuals-'));
  try {
    const original = input(root);
    const task = {
      id: 'T-005', status: 'done', closedAt: original.close.closedAt,
      weight: original.close.weight, weightBasis: original.close.weightBasis,
      evidence: structuredClone(original.evidence),
      completionProvenance: persistedCloseProvenance(original),
    };
    const request = input(root, {
      task,
      initiative: { ...original.initiative, nextAction: original.nextAction, tasks: [task] },
      actuals: { attempts: 99 },
    });

    await executeDoneTransaction(request, harness().effects);
    assert.equal(Object.hasOwn(JSON.parse(readFileSync(LOG(root), 'utf8')), 'actuals'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('failure after event persistence resumes checkpoint with the same event', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-'));
  try {
    const { effects } = harness();
    let failed = false;
    const failing = {
      ...effects,
      checkpoint: async () => {
        failed = true;
        throw new Error('injected checkpoint failure');
      },
    };
    const request = input(root);
    const idempotencyKey = firstGenerationKey(request.close);
    await assert.rejects(executeDoneTransaction(request, failing), /injected checkpoint failure/);
    assert.equal(failed, true);
    assert.equal(readDoneRecovery(root, idempotencyKey).stage, 'event-persisted');
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 1);
    const resumed = await executeDoneTransaction(request, effects);
    assert.equal(resumed.ok, true);
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 1);
    assert.equal(readDoneRecovery(root, idempotencyKey), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('incomplete handoff fails before creating a recovery marker', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-'));
  try {
    const request = input(root, { handoff: { narrative: 'missing required fields' } });
    const idempotencyKey = firstGenerationKey(request.close);
    await assert.rejects(executeDoneTransaction(request, harness().effects), /handoff.*decisionLog/i);
    assert.equal(existsSync(doneRecoveryPath(root, idempotencyKey)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('caller cannot alias a different close under an arbitrary idempotency key', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-'));
  try {
    const request = input(root, { idempotencyKey: 'task-done:aliased' });
    await assert.rejects(executeDoneTransaction(request, harness().effects), /must equal the derived close key/i);
    assert.equal(existsSync(doneRecoveryPath(root, request.idempotencyKey)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an already-done task repairs and authenticates its original event and checkpoint', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-'));
  try {
    const original = input(root);
    const task = {
      id: 'T-001', status: 'done', closedAt: '2026-07-14T19:00:00Z',
      weight: 4, weightBasis: 'count', evidence: original.evidence,
      completionProvenance: persistedCloseProvenance(original),
    };
    const request = input(root, {
      task,
      initiative: {
        __projectId: 'atomic-skills', slug: 'demo-f4', parentPlan: 'demo', phaseId: 'F4',
        status: 'active', nextAction: original.nextAction, tasks: [task],
      },
      close: {
        projectId: 'atomic-skills', planSlug: 'demo', phaseId: 'F4', taskId: 'T-001',
        closedAt: '2026-07-14T20:00:00Z', weight: 4, weightBasis: 'count',
      },
    });
    const { state, effects } = harness();
    const result = await executeDoneTransaction(request, effects);
    assert.equal(result.reused, true);
    const originalKey = buildDoneIdempotencyKey({
      ...request.close,
      closedAt: '2026-07-14T19:00:00Z',
    });
    assert.equal(result.idempotencyKey, originalKey);
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 1);
    assert.equal(result.completion.record.idempotencyKey, originalKey);
    assert.deepEqual(result.checkpoint, state.checkpoints.get(originalKey));
    assert.equal(state.checkpoints.size, 1);
    assert.equal(existsSync(doneRecoveryPath(root, buildDoneIdempotencyKey(request.close))), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a terminal initiative cannot receive a new task close', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-terminal-'));
  try {
    const request = input(root, {
      initiative: {
        ...input(root).initiative,
        status: 'archived',
      },
    });
    const { effects } = harness();
    await assert.rejects(
      executeDoneTransaction(request, effects),
      /authoritative initiative.*live|active.*paused/i,
    );
    assert.equal(existsSync(LOG(root)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('already-done repair persists recovery state when event authentication fails', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-reuse-recovery-'));
  try {
    const original = input(root);
    const task = {
      id: 'T-001', status: 'done', closedAt: '2026-07-14T19:00:00Z',
      weight: 4, weightBasis: 'count', evidence: original.evidence,
      completionProvenance: persistedCloseProvenance(original),
    };
    const request = input(root, {
      task,
      initiative: {
        __projectId: 'atomic-skills', slug: 'demo-f4', parentPlan: 'demo', phaseId: 'F4',
        status: 'active', nextAction: original.nextAction, tasks: [task],
      },
      close: {
        projectId: 'atomic-skills', planSlug: 'demo', phaseId: 'F4', taskId: 'T-001',
        closedAt: '2026-07-14T20:00:00Z', weight: 4, weightBasis: 'count',
      },
    });
    const originalKey = buildDoneIdempotencyKey({
      ...request.close,
      closedAt: task.closedAt,
    });
    const { effects } = harness();
    await assert.rejects(
      executeDoneTransaction(request, {
        ...effects,
        ensureCompletion: async () => { throw new Error('injected reuse event failure'); },
      }),
      /injected reuse event failure/,
    );
    assert.equal(readDoneRecovery(root, originalKey).stage, 'state-persisted');
    const resumed = await executeDoneTransaction(request, effects);
    assert.equal(resumed.ok, true);
    assert.equal(resumed.reused, true);
    assert.equal(readDoneRecovery(root, originalKey), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('already-done reuse rejects caller provenance that differs from persisted evidence and handoff', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-reuse-provenance-'));
  try {
    const original = input(root);
    const task = {
      ...original.task,
      status: 'done', closedAt: original.close.closedAt, evidence: structuredClone(original.evidence),
      completionProvenance: persistedCloseProvenance(original),
    };
    const request = input(root, {
      task,
      initiative: {
        ...original.initiative,
        tasks: [task],
        nextAction: original.nextAction,
      },
      evidence: { ...original.evidence, verifierKind: 'forged' },
      handoff: { ...original.handoff, decisionLog: 'forged retry provenance' },
    });
    await assert.rejects(
      executeDoneTransaction(request, harness().effects),
      /persisted.*provenance|caller.*provenance/i,
    );
    assert.equal(existsSync(LOG(root)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkpointed recovery repairs a missing completion event before clearing its marker', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-event-repair-'));
  try {
    const { effects } = harness();
    const request = input(root);
    const idempotencyKey = firstGenerationKey(request.close);
    await assert.rejects(executeDoneTransaction(request, {
      ...effects,
      assertClean: async () => false,
    }), /clean task-owned worktree/);
    assert.equal(readDoneRecovery(root, idempotencyKey).stage, 'checkpointed');
    unlinkSync(LOG(root));
    const resumed = await executeDoneTransaction(request, effects);
    assert.equal(resumed.ok, true);
    assert.equal(JSON.parse(readFileSync(LOG(root), 'utf8')).idempotencyKey, idempotencyKey);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkpointed recovery rejects a malformed stored completion instead of trusting it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-completion-marker-'));
  try {
    const { effects } = harness();
    const request = input(root);
    const idempotencyKey = firstGenerationKey(request.close);
    await assert.rejects(executeDoneTransaction(request, {
      ...effects,
      assertClean: async () => false,
    }), /clean task-owned worktree/);
    const markerPath = doneRecoveryPath(root, idempotencyKey);
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    marker.completion = { forged: true };
    writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`);
    await assert.rejects(
      executeDoneTransaction(request, effects),
      /stored completion could not be authenticated/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('different task closes serialize on the shared phase initiative identity', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-phase-lock-'));
  try {
    const initialTasks = [
      { id: 'T-005', status: 'active', weight: 4 },
      { id: 'T-006', status: 'active', weight: 4 },
    ];
    let initiative = {
      __projectId: 'atomic-skills', slug: 'demo-f4', parentPlan: 'demo', phaseId: 'F4',
      status: 'active', tasks: structuredClone(initialTasks),
    };
    let activeLoads = 0;
    let maxConcurrentLoads = 0;
    const checkpoints = new Map();
    const effects = {
      loadInitiative: async () => {
        activeLoads += 1;
        maxConcurrentLoads = Math.max(maxConcurrentLoads, activeLoads);
        const snapshot = structuredClone(initiative);
        await new Promise((resolve) => setTimeout(resolve, 30));
        activeLoads -= 1;
        return snapshot;
      },
      persistClose: async ({ bundle }) => {
        initiative.tasks = initiative.tasks.map((task) => (
          task.id === bundle.task.id ? structuredClone(bundle.task) : task
        ));
        initiative.nextAction = bundle.nextAction;
      },
      refresh: async () => {},
      findCheckpoint: async ({ idempotencyKey }) => checkpoints.get(idempotencyKey),
      checkpoint: async ({ idempotencyKey }) => {
        const checkpoint = { sha: 'a'.repeat(40) };
        checkpoints.set(idempotencyKey, checkpoint);
        return checkpoint;
      },
      assertClean: async () => true,
    };
    const requestFor = (taskId, index) => {
      const nextAction = index === 0 ? 'Run `done T-006`.' : 'Run `phase-done`.';
      const original = input(root);
      return input(root, {
        task: structuredClone(initialTasks[index]),
        initiative: structuredClone(initiative),
        close: {
          ...original.close,
          taskId,
          closedAt: `2026-07-14T20:00:0${index}Z`,
        },
        nextAction,
        handoff: {
          ...original.handoff,
          singleNextAction: nextAction,
          narrative: `${taskId} closed under the phase mutation lock.`,
        },
      });
    };

    await Promise.all([
      executeDoneTransaction(requestFor('T-005', 0), effects),
      executeDoneTransaction(requestFor('T-006', 1), effects),
    ]);

    assert.equal(maxConcurrentLoads, 1);
    assert.deepEqual(initiative.tasks.map((task) => task.status), ['done', 'done']);
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('concurrent closes with different timestamps serialize on authoritative task identity', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-race-'));
  try {
    const first = input(root);
    const second = input(root, {
      close: { ...first.close, closedAt: '2026-07-14T20:00:01Z' },
      task: structuredClone(first.task),
      initiative: structuredClone(first.initiative),
    });
    let authoritative = structuredClone(first.initiative);
    let checkpointCalls = 0;
    const checkpoints = new Map();
    const effects = {
      loadInitiative: async () => structuredClone(authoritative),
      persistClose: async ({ bundle }) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        authoritative.tasks[0] = structuredClone(bundle.task);
        authoritative.nextAction = bundle.nextAction;
      },
      refresh: async () => {},
      findCheckpoint: async ({ idempotencyKey }) => checkpoints.get(idempotencyKey),
      checkpoint: async ({ idempotencyKey }) => {
        checkpointCalls += 1;
        const value = { sha: String(checkpointCalls).padStart(40, 'a') };
        checkpoints.set(idempotencyKey, value);
        return value;
      },
      assertClean: async () => true,
    };

    const results = await Promise.all([
      executeDoneTransaction(first, effects),
      executeDoneTransaction(second, effects),
    ]);
    const lines = readFileSync(LOG(root), 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);
    assert.equal(checkpointCalls, 1);
    assert.equal(results.filter((result) => result.reused === true).length, 1);
    assert.equal(authoritative.tasks[0].closedAt, first.close.closedAt);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkpointed recovery reauthenticates the stored checkpoint before clearing its marker', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-checkpoint-'));
  try {
    const { state, effects } = harness();
    const request = input(root);
    const idempotencyKey = firstGenerationKey(request.close);
    await assert.rejects(executeDoneTransaction(request, {
      ...effects,
      assertClean: async () => false,
    }), /clean task-owned worktree/);
    assert.equal(readDoneRecovery(root, idempotencyKey).stage, 'checkpointed');
    state.checkpoints.delete(idempotencyKey);
    await assert.rejects(
      executeDoneTransaction(request, effects),
      /stored checkpoint could not be authenticated/i,
    );
    assert.equal(readDoneRecovery(root, idempotencyKey).stage, 'checkpointed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('recovery rejects evidence and handoff drift from the prepared close bundle', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-drift-'));
  try {
    const { effects } = harness();
    const request = input(root);
    const failing = {
      ...effects,
      ensureCompletion: async () => { throw new Error('injected event failure'); },
    };
    await assert.rejects(executeDoneTransaction(request, failing), /injected event failure/);
    const drifted = {
      ...request,
      handoff: { ...request.handoff, decisionLog: 'A different recovery payload.' },
    };
    await assert.rejects(
      executeDoneTransaction(drifted, effects),
      /prepared close bundle conflicts|caller provenance conflicts/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('task close scope must match the authoritative initiative identity', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-scope-'));
  try {
    const request = input(root, {
      initiative: {
        ...input(root).initiative,
        __projectId: 'other-project',
      },
    });
    await assert.rejects(
      executeDoneTransaction(request, harness().effects),
      /projectId.*authoritative initiative/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
