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
import { withCompletionLedgerLock } from './append-completion.js';
import { withScopeTransactionLock } from './transaction-lock.js';

const REQUIRED_CLOSE_FIELDS = ['projectId', 'planSlug', 'phaseId', 'closedAt'];
const STAGES = new Set(['prepared', 'committed', 'emitted', 'successor-materialized']);
const FULL_GIT_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireText(record, field, label) {
  if (!hasText(record?.[field])) throw new TypeError(`${label}.${field} is required`);
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

function terminalStatus(value) {
  return value === 'done' || value === 'archived';
}

function authenticateTerminalCompletion(root, close) {
  return withCompletionLedgerLock(root, (ledger) => {
    const matches = ledger.readRecords().filter((record) => (
      record?.event === 'phase-done'
      && record?.projectId === close.projectId
      && record?.planSlug === close.planSlug
      && record?.phaseId === close.phaseId
      && record?.taskId == null
    ));
    if (matches.length !== 1) {
      throw new Error(`terminal phase reuse requires exactly one canonical phase-done completion event (found ${matches.length})`);
    }
    const record = matches[0];
    if (!hasText(record.ts) || !FULL_GIT_OID.test(record.closeSha ?? '')) {
      throw new Error('terminal phase reuse completion event lacks immutable timestamp or closeSha');
    }
    const immutableClose = { ...close, closedAt: record.ts };
    const idempotencyKey = buildPhaseDoneIdempotencyKey(immutableClose);
    if (record.idempotencyKey !== idempotencyKey) {
      throw new Error('terminal phase reuse completion event has a non-canonical close identity');
    }
    return { record: structuredClone(record), immutableClose, idempotencyKey };
  });
}

function normalizedSuccessor(input) {
  if (input?.successor == null) return null;
  const successor = input.successor;
  if (!successor || typeof successor !== 'object' || Array.isArray(successor)) {
    throw new TypeError('successor manifest must be an object');
  }
  for (const field of ['phaseId', 'planPath', 'initiativePath']) {
    requireText(successor, field, 'successor');
  }
  for (const field of ['planHash', 'initiativeHash']) {
    if (typeof successor[field] !== 'string' || !/^[0-9a-f]{64}$/.test(successor[field])) {
      throw new TypeError(`successor.${field} must be a lowercase sha256 digest`);
    }
  }
  return structuredClone(successor);
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
      || buildPhaseDoneIdempotencyKey(marker?.close) !== idempotencyKey
      || !Object.hasOwn(marker, 'successor')
      || marker.successorDigest !== digestValue(marker.successor)) {
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
  if (input.plan.__projectId !== input.close.projectId
      || input.initiative?.__projectId !== input.close.projectId) {
    throw new TypeError('close.projectId must match the authoritative plan and initiative projectId');
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

  if (!hasText(input.root) || !input.close || typeof input.close !== 'object') {
    const produced = typeof effects.produceEvidence === 'function'
      ? await effects.produceEvidence(input)
      : {};
    const decision = classifyPhaseDoneCommit({ ...input, ...(produced ?? {}) });
    if (!decision.allowed) return { ok: false, stage: 'commit-guard', decision };
    validateTransactionInput(input);
  }

  const requestedKey = validateTransactionInput(input);
  for (const name of ['findCommit', 'commit', 'emit', 'assertClean', 'loadState']) {
    if (typeof effects[name] !== 'function') throw new TypeError(`effects.${name} is required`);
  }
  const scope = ['projectId', 'planSlug', 'phaseId'].map((field) => input.close[field]);
  return withScopeTransactionLock(input.root, 'phase-done', scope, async () => {
    let marker = readPhaseDoneRecovery(input.root, requestedKey);
    if (marker && !isDeepStrictEqual(marker.close, input.close)) {
      throw new Error(`phase-done transaction close payload conflicts with ${requestedKey}`);
    }

    const loaded = await effects.loadState({
      root: input.root,
      projectId: input.close.projectId,
      planSlug: input.close.planSlug,
      phaseId: input.close.phaseId,
      candidate: input,
    });
    if (!loaded || typeof loaded !== 'object') {
      throw new TypeError('effects.loadState must return authoritative phase state');
    }
    const authoritativeInput = {
      ...input,
      ...loaded,
      root: input.root,
      close: input.close,
    };
    validateTransactionInput(authoritativeInput);
    const freshPreflight = classifyPhaseDonePreflight(authoritativeInput);
    if (!freshPreflight.allowed) {
      return { ok: false, stage: 'preflight', decision: freshPreflight };
    }

    const descriptorTerminal = terminalStatus(authoritativeInput.phase?.status);
    const initiativeTerminal = terminalStatus(authoritativeInput.initiative?.status);
    if (!marker && (descriptorTerminal || initiativeTerminal)) {
      if (descriptorTerminal !== initiativeTerminal) {
        throw new Error('authoritative phase terminal state is inconsistent across mirrors');
      }
      const terminalReviewGate = authoritativeInput.phase?.reviewGate
        ?? authoritativeInput.reviewGate;
      const terminalGuardInput = {
        ...authoritativeInput,
        reviewGate: terminalReviewGate,
        currentHead: terminalReviewGate?.at,
        tasks: authoritativeInput.initiative?.tasks,
        exitGates: authoritativeInput.phase?.exitGate?.criteria,
      };
      const terminalDecision = classifyPhaseDoneCommit(terminalGuardInput);
      if (!terminalDecision.allowed) {
        return { ok: false, stage: 'commit-guard', decision: terminalDecision };
      }
      const successor = normalizedSuccessor(authoritativeInput);
      const hasMaterializer = typeof effects.materializeSuccessor === 'function';
      if ((successor !== null) !== hasMaterializer) {
        throw new TypeError(successor === null
          ? 'effects.materializeSuccessor requires a persisted successor manifest'
          : 'effects.materializeSuccessor is required by the successor manifest');
      }
      const completion = authenticateTerminalCompletion(input.root, input.close);
      const terminalInput = {
        ...terminalGuardInput,
        close: completion.immutableClose,
        closeSha: completion.record.closeSha,
        idempotencyKey: completion.idempotencyKey,
        successor,
      };
      const value = await effects.findCommit(terminalInput, null);
      validateCommitValue(value);
      if (value.closeSha !== completion.record.closeSha) {
        throw new Error('terminal phase reuse completion event does not match the authenticated close commit');
      }
      if (successor !== null) {
        await effects.materializeSuccessor(terminalInput, value, {
          schemaVersion: 1,
          idempotencyKey: completion.idempotencyKey,
          stage: 'emitted',
          close: structuredClone(completion.immutableClose),
          successor: structuredClone(successor),
          successorDigest: digestValue(successor),
          value: structuredClone(value),
        });
      }
      const clean = await effects.assertClean({
        idempotencyKey: completion.idempotencyKey,
        closeSha: value.closeSha,
        value,
      });
      if (clean !== true) {
        throw new Error('phase-done terminal reuse did not leave a clean transition-owned worktree');
      }
      return {
        ok: true,
        reused: true,
        stage: 'committed',
        decision: terminalDecision,
        idempotencyKey: completion.idempotencyKey,
        closeSha: value.closeSha,
        value,
      };
    }

    let commitInput = authoritativeInput;
    let commitDecision = null;
    if (!marker || marker.stage === 'prepared') {
      const produced = typeof effects.produceEvidence === 'function'
        ? await effects.produceEvidence(authoritativeInput)
        : {};
      commitInput = {
        ...authoritativeInput,
        ...(produced ?? {}),
        root: input.root,
        close: input.close,
        plan: authoritativeInput.plan,
        phase: authoritativeInput.phase,
        initiative: authoritativeInput.initiative,
        tasks: authoritativeInput.initiative?.tasks,
      };
      commitDecision = classifyPhaseDoneCommit(commitInput);
      if (!commitDecision.allowed) {
        return { ok: false, stage: 'commit-guard', decision: commitDecision };
      }
      if (validateTransactionInput(commitInput) !== requestedKey) {
        throw new Error('phase-done transaction identity changed during evidence production');
      }
    }

    const successor = normalizedSuccessor(commitInput);
    const hasMaterializer = typeof effects.materializeSuccessor === 'function';
    if ((successor !== null) !== hasMaterializer) {
      throw new TypeError(successor === null
        ? 'effects.materializeSuccessor requires a persisted successor manifest'
        : 'effects.materializeSuccessor is required by the successor manifest');
    }
    if (marker && !isDeepStrictEqual(marker.successor, successor)) {
      throw new Error(`phase-done successor manifest conflicts with ${requestedKey}`);
    }

    if (!marker) {
      marker = {
        schemaVersion: 1,
        idempotencyKey: requestedKey,
        stage: 'prepared',
        close: structuredClone(commitInput.close),
        successor,
        successorDigest: digestValue(successor),
      };
      writePhaseDoneRecovery(commitInput.root, marker);
    }

    let value = marker.value;
    let transactionInput = {
      ...commitInput,
      successor: structuredClone(marker.successor),
      idempotencyKey: requestedKey,
    };
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

    if (marker.stage === 'emitted' && marker.successor !== null) {
      await effects.materializeSuccessor(transactionInput, value, marker);
      marker = { ...marker, stage: 'successor-materialized' };
      writePhaseDoneRecovery(commitInput.root, marker);
    }

    const clean = await effects.assertClean({
      idempotencyKey: requestedKey,
      ignorePath: phaseDoneRecoveryPath(commitInput.root, requestedKey),
      closeSha: value.closeSha,
      value,
    });
    if (clean !== true) {
      throw new Error('phase-done transaction did not leave a clean transition-owned worktree');
    }
    clearPhaseDoneRecovery(commitInput.root, requestedKey);
    return {
      ok: true,
      reused: false,
      stage: 'committed',
      decision: commitDecision ?? { allowed: true, recovered: true },
      idempotencyKey: requestedKey,
      closeSha: value.closeSha,
      value,
    };
  });
}
