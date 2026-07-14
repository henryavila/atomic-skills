import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import {
  classifyPhaseDoneCommit,
  classifyPhaseDonePreflight,
} from './lifecycle-order-guard.js';

const REQUIRED_CLOSE_FIELDS = ['projectId', 'planSlug', 'phaseId', 'closedAt'];
const STAGES = new Set(['prepared', 'committed', 'emitted', 'successor-materialized']);
const FULL_GIT_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireText(record, field, label) {
  if (!hasText(record?.[field])) throw new TypeError(`${label}.${field} is required`);
}

export function buildPhaseDoneIdempotencyKey(close = {}) {
  for (const field of REQUIRED_CLOSE_FIELDS) requireText(close, field, 'close');
  if (Number.isNaN(Date.parse(close.closedAt))) {
    throw new TypeError('close.closedAt must be a parseable date-time');
  }
  const scope = ['projectId', 'planSlug', 'phaseId']
    .map((field) => encodeURIComponent(close[field]))
    .join('/');
  return `phase-done:${scope}@${encodeURIComponent(close.closedAt)}`;
}

export function phaseDoneRecoveryPath(root, idempotencyKey) {
  const digest = createHash('sha256').update(idempotencyKey).digest('hex');
  return join(
    resolve(root),
    '.atomic-skills',
    'status',
    'phase-done-transactions',
    `${digest}.json`,
  );
}

function validateCommitValue(value, path) {
  if (!value || typeof value !== 'object' || !FULL_GIT_OID.test(value.closeSha)) {
    throw new Error(`phase-done transaction commit is missing a full closeSha${path ? `: ${path}` : ''}`);
  }
  return value;
}

export function readPhaseDoneRecovery(root, idempotencyKey) {
  const path = phaseDoneRecoveryPath(root, idempotencyKey);
  if (!existsSync(path)) return null;
  const marker = JSON.parse(readFileSync(path, 'utf8'));
  if (marker?.schemaVersion !== 1 || marker?.idempotencyKey !== idempotencyKey
      || !STAGES.has(marker?.stage)
      || buildPhaseDoneIdempotencyKey(marker?.close) !== idempotencyKey) {
    throw new Error(`phase-done transaction recovery marker is invalid: ${path}`);
  }
  if (marker.stage !== 'prepared') validateCommitValue(marker.value, path);
  return marker;
}

function writePhaseDoneRecovery(root, marker) {
  const path = phaseDoneRecoveryPath(root, marker.idempotencyKey);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(
    tmp,
    `${JSON.stringify({ ...marker, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    { mode: 0o600 },
  );
  renameSync(tmp, path);
  return path;
}

function clearPhaseDoneRecovery(root, idempotencyKey) {
  const path = phaseDoneRecoveryPath(root, idempotencyKey);
  if (existsSync(path)) unlinkSync(path);
}

function validateTransactionInput(input) {
  if (!hasText(input.root)) throw new TypeError('root is required');
  const idempotencyKey = buildPhaseDoneIdempotencyKey(input.close);
  if (input.idempotencyKey != null && input.idempotencyKey !== idempotencyKey) {
    throw new TypeError('input.idempotencyKey must equal the derived phase close key');
  }
  if (input.close.planSlug !== input.plan.slug) {
    throw new TypeError('close.planSlug must match plan.slug');
  }
  if (input.close.phaseId !== input.phase.id) {
    throw new TypeError('close.phaseId must match phase.id');
  }
  return idempotencyKey;
}

/**
 * Recoverable phase-close coordinator. Evidence production is allowed only
 * after the pure preflight. Once the commit guard passes, an atomic recovery
 * marker makes commit, idempotent event emission, and successor materialization
 * resumable without silently reporting an absent commit as success.
 */
export async function executePhaseDoneTransaction(input = {}, effects = {}) {
  const preflight = classifyPhaseDonePreflight(input);
  if (!preflight.allowed) {
    return { ok: false, stage: 'preflight', decision: preflight };
  }

  let idempotencyKey;
  let marker = null;
  if (hasText(input.root) && input.close && typeof input.close === 'object') {
    idempotencyKey = validateTransactionInput(input);
    marker = readPhaseDoneRecovery(input.root, idempotencyKey);
  }
  if (marker && !isDeepStrictEqual(marker.close, input.close)) {
    throw new Error(`phase-done transaction close payload conflicts with ${idempotencyKey}`);
  }

  let commitInput = input;
  let commitDecision = null;
  if (!marker || marker.stage === 'prepared') {
    const produced = typeof effects.produceEvidence === 'function'
      ? await effects.produceEvidence(input)
      : {};
    commitInput = {
      ...input,
      ...(produced ?? {}),
      root: input.root,
      close: input.close,
    };
    commitDecision = classifyPhaseDoneCommit(commitInput);
    if (!commitDecision.allowed) {
      return { ok: false, stage: 'commit-guard', decision: commitDecision };
    }
    const validatedKey = validateTransactionInput(commitInput);
    if (idempotencyKey !== undefined && idempotencyKey !== validatedKey) {
      throw new Error('phase-done transaction identity changed during evidence production');
    }
    idempotencyKey = validatedKey;
  }
  for (const name of ['findCommit', 'commit', 'emit', 'assertClean']) {
    if (typeof effects[name] !== 'function') throw new TypeError(`effects.${name} is required`);
  }

  if (!marker) {
    marker = {
      schemaVersion: 1,
      idempotencyKey,
      stage: 'prepared',
      close: structuredClone(commitInput.close),
    };
    writePhaseDoneRecovery(commitInput.root, marker);
  }

  let value = marker.value;
  let transactionInput = { ...commitInput, idempotencyKey };
  if (marker.stage === 'prepared') {
    value = await effects.findCommit(transactionInput, marker);
    if (!value) value = await effects.commit(transactionInput, marker);
    validateCommitValue(value);
    marker = { ...marker, stage: 'committed', value };
    writePhaseDoneRecovery(commitInput.root, marker);
  } else {
    validateCommitValue(value);
    const authenticated = await effects.findCommit(
      { ...transactionInput, closeSha: value.closeSha },
      marker,
    );
    if (!authenticated || authenticated.closeSha !== value.closeSha) {
      throw new Error('phase-done transaction stored closeSha could not be authenticated');
    }
  }

  transactionInput = { ...transactionInput, closeSha: value.closeSha };
  if (marker.stage === 'committed') {
    await effects.emit(transactionInput, value, marker);
    marker = { ...marker, stage: 'emitted' };
    writePhaseDoneRecovery(commitInput.root, marker);
  }

  if (marker.stage === 'emitted' && typeof effects.materializeSuccessor === 'function') {
    await effects.materializeSuccessor(transactionInput, value, marker);
    marker = { ...marker, stage: 'successor-materialized' };
    writePhaseDoneRecovery(commitInput.root, marker);
  }

  const clean = await effects.assertClean({
    idempotencyKey,
    ignorePath: phaseDoneRecoveryPath(commitInput.root, idempotencyKey),
    closeSha: value.closeSha,
    value,
  });
  if (clean !== true) {
    throw new Error('phase-done transaction did not leave a clean transition-owned worktree');
  }
  clearPhaseDoneRecovery(commitInput.root, idempotencyKey);
  return {
    ok: true,
    stage: 'committed',
    decision: commitDecision ?? { allowed: true, recovered: true },
    idempotencyKey,
    closeSha: value.closeSha,
    value,
  };
}
