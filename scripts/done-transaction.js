import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { ensureCompletion } from './append-completion.js';
import { withScopeTransactionLock } from './transaction-lock.js';

const REQUIRED_CLOSE_FIELDS = ['projectId', 'planSlug', 'phaseId', 'taskId', 'closedAt'];
const REQUIRED_HANDOFF_FIELDS = [
  'narrative',
  'decisionLog',
  'singleNextAction',
  'verbatimState',
  'uncommittedChanges',
];
const STAGES = new Set(['prepared', 'state-persisted', 'event-persisted', 'checkpointed']);

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireText(record, field, label) {
  if (!hasText(record?.[field])) throw new TypeError(`${label}.${field} is required`);
}

export function buildDoneIdempotencyKey(close = {}) {
  for (const field of REQUIRED_CLOSE_FIELDS) requireText(close, field, 'close');
  if (Number.isNaN(Date.parse(close.closedAt))) {
    throw new TypeError('close.closedAt must be a parseable date-time');
  }
  const scope = ['projectId', 'planSlug', 'phaseId', 'taskId']
    .map((field) => encodeURIComponent(close[field]))
    .join('/');
  return `task-done:${scope}@${encodeURIComponent(close.closedAt)}`;
}

export function doneRecoveryPath(root, idempotencyKey) {
  const digest = createHash('sha256').update(idempotencyKey).digest('hex');
  return join(resolve(root), '.atomic-skills', 'status', 'done-transactions', `${digest}.json`);
}

export function readDoneRecovery(root, idempotencyKey) {
  const path = doneRecoveryPath(root, idempotencyKey);
  if (!existsSync(path)) return null;
  const marker = JSON.parse(readFileSync(path, 'utf8'));
  if (marker?.schemaVersion !== 1 || marker?.idempotencyKey !== idempotencyKey
    || !STAGES.has(marker?.stage) || !marker.bundle
    || marker.bundleDigest !== digestValue(marker.bundle)) {
    throw new Error(`done transaction recovery marker is invalid: ${path}`);
  }
  return marker;
}

function writeDoneRecovery(root, marker) {
  const path = doneRecoveryPath(root, marker.idempotencyKey);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ ...marker, updatedAt: new Date().toISOString() }, null, 2)}\n`);
  renameSync(tmp, path);
  return path;
}

function clearDoneRecovery(root, idempotencyKey) {
  const path = doneRecoveryPath(root, idempotencyKey);
  if (existsSync(path)) unlinkSync(path);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().flatMap((key) => (
      value[key] === undefined ? [] : [[key, canonicalize(value[key])]]
    )));
  }
  return value;
}

function digestValue(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function authoritativeTask(input) {
  const initiative = input.initiative;
  if (!initiative || typeof initiative !== 'object') {
    throw new TypeError('authoritative initiative is required');
  }
  if (initiative.__projectId !== input.close.projectId) {
    throw new TypeError('close.projectId must match the authoritative initiative projectId');
  }
  if (initiative.parentPlan !== input.close.planSlug) {
    throw new TypeError('close.planSlug must match the authoritative initiative parentPlan');
  }
  if (initiative.phaseId !== input.close.phaseId) {
    throw new TypeError('close.phaseId must match the authoritative initiative phaseId');
  }
  const matches = (Array.isArray(initiative.tasks) ? initiative.tasks : [])
    .filter((task) => task?.id === input.close.taskId);
  if (matches.length !== 1) {
    throw new TypeError(`authoritative initiative must contain exactly one task ${input.close.taskId}`);
  }
  return matches[0];
}

function buildBundle(input) {
  const { close, evidence, handoff } = input;
  const task = authoritativeTask(input);
  if (!input.root) throw new TypeError('root is required');
  if (!evidence || typeof evidence !== 'object' || evidence.passed !== true) {
    throw new TypeError('evidence.passed must be true before task close');
  }
  requireText(input, 'nextAction', 'input');
  for (const field of REQUIRED_HANDOFF_FIELDS) requireText(handoff, field, 'handoff');
  if (handoff.singleNextAction !== input.nextAction) {
    throw new TypeError('handoff.singleNextAction must equal input.nextAction');
  }
  return {
    task: {
      ...task,
      status: 'done',
      closedAt: close.closedAt,
      lastUpdated: close.closedAt,
      evidence: structuredClone(evidence),
    },
    evidence: structuredClone(evidence),
    nextAction: input.nextAction,
    handoff: structuredClone(handoff),
  };
}

/**
 * Recoverable task-close coordinator. Effects own the initiative write,
 * refresh, and explicit-path git checkpoint; this authority owns ordering,
 * marker durability, and the exactly-once completion append.
 */
export async function executeDoneTransaction(input = {}, effects = {}) {
  const requestedKey = buildDoneIdempotencyKey(input.close);
  if (input.idempotencyKey != null && input.idempotencyKey !== requestedKey) {
    throw new TypeError('input.idempotencyKey must equal the derived close key');
  }
  for (const name of [
    'loadInitiative', 'persistClose', 'refresh', 'findCheckpoint', 'checkpoint', 'assertClean',
  ]) {
    if (typeof effects[name] !== 'function') throw new TypeError(`effects.${name} is required`);
  }
  const scope = ['projectId', 'planSlug', 'phaseId', 'taskId'].map((field) => input.close[field]);
  return withScopeTransactionLock(input.root, 'task-done', scope, async () => {
    const initiative = await effects.loadInitiative({
      root: input.root,
      projectId: input.close.projectId,
      planSlug: input.close.planSlug,
      phaseId: input.close.phaseId,
      taskId: input.close.taskId,
      candidate: input.initiative,
    });
    let transactionInput = { ...input, initiative };
    const currentTask = authoritativeTask(transactionInput);
    if (currentTask.status === 'done') {
      if (!hasText(currentTask.closedAt)) {
        throw new TypeError('a done authoritative task must retain its immutable closedAt');
      }
      transactionInput = {
        ...transactionInput,
        close: { ...input.close, closedAt: currentTask.closedAt },
      };
    }
    const idempotencyKey = buildDoneIdempotencyKey(transactionInput.close);
    let marker = readDoneRecovery(input.root, idempotencyKey);
    if (currentTask.status === 'done' && !marker) {
      return {
        ok: true,
        reused: true,
        idempotencyKey,
        bundle: null,
        completion: null,
        checkpoint: null,
      };
    }

    let bundle = buildBundle(transactionInput);
    const bundleDigest = digestValue(bundle);
    if (!marker) {
      marker = {
        schemaVersion: 1,
        idempotencyKey,
        stage: 'prepared',
        close: structuredClone(transactionInput.close),
        bundle: structuredClone(bundle),
        bundleDigest,
      };
      writeDoneRecovery(input.root, marker);
    } else {
      if (!isDeepStrictEqual(marker.close, transactionInput.close)
          || marker.bundleDigest !== bundleDigest) {
        throw new Error(`prepared close bundle conflicts with ${idempotencyKey}`);
      }
      bundle = structuredClone(marker.bundle);
    }

    let completion = marker.completion;
    let checkpoint = marker.checkpoint;
    if (marker.stage === 'prepared') {
      await effects.persistClose({ idempotencyKey, bundle, marker });
      await effects.refresh({ idempotencyKey, bundle, marker });
      marker = { ...marker, stage: 'state-persisted' };
      writeDoneRecovery(input.root, marker);
    }

    if (marker.stage === 'state-persisted') {
      const ensure = effects.ensureCompletion ?? ensureCompletion;
      completion = await ensure(input.root, {
        event: 'task-done',
        projectId: transactionInput.close.projectId,
        planSlug: transactionInput.close.planSlug,
        phaseId: transactionInput.close.phaseId,
        taskId: transactionInput.close.taskId,
        weight: transactionInput.close.weight,
        weightBasis: transactionInput.close.weightBasis,
        idempotencyKey,
        ts: transactionInput.close.closedAt,
      });
      marker = { ...marker, stage: 'event-persisted', completion };
      writeDoneRecovery(input.root, marker);
    }

    if (marker.stage === 'event-persisted') {
      checkpoint = await effects.findCheckpoint({ idempotencyKey, bundle, completion, marker });
      if (!checkpoint) {
        checkpoint = await effects.checkpoint({ idempotencyKey, bundle, completion, marker });
      }
      marker = { ...marker, stage: 'checkpointed', checkpoint };
      writeDoneRecovery(input.root, marker);
    } else if (marker.stage === 'checkpointed') {
      const authenticated = await effects.findCheckpoint({
        idempotencyKey,
        bundle,
        completion,
        checkpoint,
        marker,
      });
      if (!authenticated) {
        throw new Error('done transaction stored checkpoint could not be authenticated');
      }
      checkpoint = authenticated;
    }

    const clean = await effects.assertClean({
      idempotencyKey,
      ignorePath: doneRecoveryPath(input.root, idempotencyKey),
      checkpoint,
    });
    if (clean !== true) {
      throw new Error('done transaction checkpoint did not leave a clean task-owned worktree');
    }
    clearDoneRecovery(input.root, idempotencyKey);
    return { ok: true, reused: false, idempotencyKey, bundle, completion, checkpoint };
  });
}
