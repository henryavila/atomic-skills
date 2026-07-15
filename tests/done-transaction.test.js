import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildDoneIdempotencyKey,
  doneRecoveryPath,
  executeDoneTransaction,
  readDoneRecovery,
} from '../scripts/done-transaction.js';

const LOG = (root) => join(root, '.atomic-skills', 'analytics', 'completions.jsonl');

function input(root, overrides = {}) {
  const task = { id: 'T-005', status: 'active' };
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

test('same logical close retries to one event, one checkpoint and one complete bundle', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-'));
  try {
    const { state, effects } = harness();
    const request = input(root);
    const idempotencyKey = buildDoneIdempotencyKey(request.close);
    const first = await executeDoneTransaction(request, effects);
    const retry = await executeDoneTransaction(request, effects);
    assert.equal(first.ok, true);
    assert.equal(retry.ok, true);
    assert.equal(first.idempotencyKey, idempotencyKey);
    assert.equal(readFileSync(LOG(root), 'utf8').trim().split('\n').length, 1);
    assert.equal(state.checkpoints.size, 1);
    assert.deepEqual(state.bundles.get(idempotencyKey).handoff, request.handoff);
    assert.equal(existsSync(doneRecoveryPath(root, idempotencyKey)), false);
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
    const idempotencyKey = buildDoneIdempotencyKey(request.close);
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
    const idempotencyKey = buildDoneIdempotencyKey(request.close);
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
    const idempotencyKey = buildDoneIdempotencyKey(request.close);
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
    const request = input(root, {
      task: {
        id: 'T-001', status: 'done', closedAt: '2026-07-14T19:00:00Z',
        weight: 4, weightBasis: 'count',
      },
      initiative: {
        __projectId: 'atomic-skills', slug: 'demo-f4', parentPlan: 'demo', phaseId: 'F4',
        status: 'active', tasks: [{
          id: 'T-001', status: 'done', closedAt: '2026-07-14T19:00:00Z',
          weight: 4, weightBasis: 'count',
        }],
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
    const task = {
      id: 'T-001', status: 'done', closedAt: '2026-07-14T19:00:00Z',
      weight: 4, weightBasis: 'count',
    };
    const request = input(root, {
      task,
      initiative: {
        __projectId: 'atomic-skills', slug: 'demo-f4', parentPlan: 'demo', phaseId: 'F4',
        status: 'active', tasks: [task],
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
    const idempotencyKey = buildDoneIdempotencyKey(request.close);
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
      /prepared close bundle conflicts/i,
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
