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
  return {
    root,
    task: { id: 'T-005', status: 'active' },
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
  const state = { bundles: new Map(), checkpoints: new Map() };
  const effects = {
    persistClose: async ({ idempotencyKey, bundle }) => {
      state.bundles.set(idempotencyKey, structuredClone(bundle));
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

test('an already-done task cannot be closed again under a different timestamp', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-'));
  try {
    const request = input(root, {
      task: {
        id: 'T-001', status: 'done', closedAt: '2026-07-14T19:00:00Z',
        weight: 4, weightBasis: 'count',
      },
      close: {
        projectId: 'atomic-skills', planSlug: 'demo', phaseId: 'F4', taskId: 'T-001',
        closedAt: '2026-07-14T20:00:00Z', weight: 4, weightBasis: 'count',
      },
    });
    await assert.rejects(executeDoneTransaction(request, harness().effects), /immutable closedAt/i);
    assert.equal(existsSync(doneRecoveryPath(root, buildDoneIdempotencyKey(request.close))), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
