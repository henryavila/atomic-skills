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

import { ensureCompletion } from './append-completion.js';

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
    || !STAGES.has(marker?.stage)) {
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

function buildBundle(input) {
  const { close, task, evidence, handoff } = input;
  if (!input.root) throw new TypeError('root is required');
  if (!task || typeof task !== 'object') throw new TypeError('task is required');
  if (task.id !== close.taskId) throw new TypeError('task.id must match close.taskId');
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
  const derivedKey = buildDoneIdempotencyKey(input.close);
  if (input.idempotencyKey != null && input.idempotencyKey !== derivedKey) {
    throw new TypeError('input.idempotencyKey must equal the derived close key');
  }
  const idempotencyKey = derivedKey;
  const bundle = buildBundle(input);
  for (const name of ['persistClose', 'refresh', 'findCheckpoint', 'checkpoint', 'assertClean']) {
    if (typeof effects[name] !== 'function') throw new TypeError(`effects.${name} is required`);
  }

  let marker = readDoneRecovery(input.root, idempotencyKey);
  if (!marker) {
    marker = { schemaVersion: 1, idempotencyKey, stage: 'prepared', close: input.close };
    writeDoneRecovery(input.root, marker);
  }

  let completion = marker.completion;
  let checkpoint = marker.checkpoint;
  if (marker.stage !== 'checkpointed') {
    await effects.persistClose({ idempotencyKey, bundle, marker });
    await effects.refresh({ idempotencyKey, bundle, marker });
    marker = { ...marker, stage: 'state-persisted' };
    writeDoneRecovery(input.root, marker);

    const ensure = effects.ensureCompletion ?? ensureCompletion;
    completion = await ensure(input.root, {
      event: 'task-done',
      projectId: input.close.projectId,
      planSlug: input.close.planSlug,
      phaseId: input.close.phaseId,
      taskId: input.close.taskId,
      weight: input.close.weight,
      weightBasis: input.close.weightBasis,
      idempotencyKey,
      ts: input.close.closedAt,
    });
    marker = { ...marker, stage: 'event-persisted', completion };
    writeDoneRecovery(input.root, marker);

    checkpoint = await effects.findCheckpoint({ idempotencyKey, bundle, completion, marker });
    if (!checkpoint) {
      checkpoint = await effects.checkpoint({ idempotencyKey, bundle, completion, marker });
    }
    marker = { ...marker, stage: 'checkpointed', checkpoint };
    writeDoneRecovery(input.root, marker);
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
  return { ok: true, idempotencyKey, bundle, completion, checkpoint };
}
