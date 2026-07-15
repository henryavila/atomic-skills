import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import {
  classifyPhaseDoneCommit,
  classifyPhaseDonePreflight,
} from './lifecycle-order-guard.js';
import {
  completionDuplicateRepair,
  ensureCompletion,
  normalizeCompletionActuals,
  normalizeCompletionRecord,
  reconcilesExactDuplicates,
  withCompletionLedgerLock,
} from './append-completion.js';
import { withScopeTransactionLock } from './transaction-lock.js';
import { durableReplace, durableUnlink } from '../src/durable-file.js';
import { confinedRepositoryFile } from '../src/confined-path.js';

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

function samePhaseScope(left, right) {
  return ['projectId', 'planSlug', 'phaseId'].every((field) => left?.[field] === right?.[field]);
}

function authenticateTerminalCompletion(root, close) {
  return withCompletionLedgerLock(root, (ledger) => {
    const records = ledger.readRecords();
    const matches = records.filter((record) => (
      record?.event === 'phase-done'
      && record?.projectId === close.projectId
      && record?.planSlug === close.planSlug
      && record?.phaseId === close.phaseId
      && record?.taskId == null
    ));
    const groups = new Map();
    for (const record of matches) {
      const key = record.idempotencyKey ?? '<missing>';
      const group = groups.get(key) ?? [];
      group.push(record);
      groups.set(key, group);
    }
    const effective = [];
    for (const group of groups.values()) {
      if (group.length > 1 && !reconcilesExactDuplicates(group, records)) {
        throw new Error('terminal phase reuse found an unreconciled duplicate completion identity');
      }
      effective.push(group.length > 1
        ? completionDuplicateRepair(group).canonicalRecord
        : group[0]);
    }
    if (effective.length === 0) {
      throw new Error('terminal phase reuse requires a canonical phase-done completion event');
    }
    const record = [...effective].sort((left, right) => {
      const leftGeneration = Number.isInteger(left.generation) ? left.generation : -1;
      const rightGeneration = Number.isInteger(right.generation) ? right.generation : -1;
      if (leftGeneration !== rightGeneration) return leftGeneration - rightGeneration;
      const timestampOrder = Date.parse(left.ts) - Date.parse(right.ts);
      if (timestampOrder !== 0) return timestampOrder;
      return String(left.idempotencyKey).localeCompare(String(right.idempotencyKey));
    }).at(-1);
    if (!hasText(record.ts) || !FULL_GIT_OID.test(record.closeSha ?? '')) {
      throw new Error('terminal phase reuse completion event lacks immutable timestamp or closeSha');
    }
    const immutableClose = {
      ...close,
      closedAt: record.ts,
      ...(record.generation !== undefined ? { generation: record.generation } : {}),
    };
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
  if (close.generation !== undefined) {
    if (!Number.isInteger(close.generation) || close.generation < 1) {
      throw new TypeError('close.generation must be a positive integer');
    }
    return `phase-done:${scope}#${close.generation}`;
  }
  return `phase-done:${scope}@${encodeURIComponent(close.closedAt)}`;
}

export function phaseDoneRecoveryPath(root, idempotencyKey) {
  const digest = createHash('sha256').update(idempotencyKey).digest('hex');
  return confinedRepositoryFile(
    root,
    ['.atomic-skills', 'status', 'phase-done-transactions'],
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
  if (Object.hasOwn(marker, 'actuals')) normalizeCompletionActuals(marker.actuals);
  if (marker.stage !== 'prepared') validateCommitValue(marker.value, path);
  return marker;
}

function findPhaseDoneRecoveryByScope(root, close) {
  const dir = dirname(phaseDoneRecoveryPath(root, buildPhaseDoneIdempotencyKey(close)));
  if (!existsSync(dir)) return null;
  const matches = [];
  for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.json'))) {
    const path = confinedRepositoryFile(
      root,
      ['.atomic-skills', 'status', 'phase-done-transactions'],
      name,
    );
    let candidate;
    try {
      candidate = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      throw new Error(`phase-done transaction recovery marker is invalid: ${path}: ${error.message}`);
    }
    if (!samePhaseScope(candidate?.close, close)) continue;
    if (phaseDoneRecoveryPath(root, candidate.idempotencyKey) !== path) {
      throw new Error(`phase-done transaction recovery marker path does not match its identity: ${path}`);
    }
    matches.push(readPhaseDoneRecovery(root, candidate.idempotencyKey));
  }
  if (matches.length > 1) {
    throw new Error('phase-done transaction has multiple recovery markers for one logical phase scope');
  }
  return matches[0] ?? null;
}

function withoutKeys(value, keys) {
  const copy = structuredClone(value);
  for (const key of keys) delete copy[key];
  return copy;
}

function authenticatedCandidateBundle(authoritative, produced) {
  const supplied = ['plan', 'phase', 'initiative'].filter((field) => produced?.[field] !== undefined);
  if (supplied.length === 0) {
    return {
      plan: authoritative.plan,
      phase: authoritative.phase,
      initiative: authoritative.initiative,
    };
  }
  if (supplied.length !== 3) {
    throw new TypeError('evidence production must return plan, phase and initiative as one candidate state bundle');
  }
  const candidate = {
    plan: produced.plan,
    phase: produced.phase,
    initiative: produced.initiative,
  };
  validateTransactionInput({ ...authoritative, ...candidate });
  const candidateDescriptors = candidate.plan.phases.filter((item) => (
    item?.id === candidate.phase.id && item?.slug === candidate.phase.slug
  ));
  if (candidateDescriptors.length !== 1 || !isDeepStrictEqual(candidateDescriptors[0], candidate.phase)) {
    throw new Error('candidate phase must be the exact value persisted in the candidate plan descriptor');
  }
  const authoritativeDescriptor = authoritative.plan.phases.find((item) => (
    item?.id === authoritative.phase.id && item?.slug === authoritative.phase.slug
  ));
  const normalizedPlan = structuredClone(candidate.plan);
  normalizedPlan.phases = normalizedPlan.phases.map((item) => (
    item?.id === candidate.phase.id && item?.slug === candidate.phase.slug
      ? structuredClone(authoritativeDescriptor)
      : item
  ));
  if (!isDeepStrictEqual(normalizedPlan, authoritative.plan)
      || !isDeepStrictEqual(
        withoutKeys(candidate.phase, ['exitGate', 'reviewGate']),
        withoutKeys(authoritative.phase, ['exitGate', 'reviewGate']),
      )
      || !isDeepStrictEqual(
        withoutKeys(candidate.initiative, ['exitGates']),
        withoutKeys(authoritative.initiative, ['exitGates']),
      )) {
    throw new Error('evidence production candidate changed fields outside gate and review evidence');
  }
  return candidate;
}

function writePhaseDoneRecovery(root, marker) {
  const digest = createHash('sha256').update(marker.idempotencyKey).digest('hex');
  const path = confinedRepositoryFile(
    root,
    ['.atomic-skills', 'status', 'phase-done-transactions'],
    `${digest}.json`,
    { createParents: true },
  );
  durableReplace(
    path,
    `${JSON.stringify({ ...marker, updatedAt: new Date().toISOString() }, null, 2)}\n`,
  );
  return path;
}

function clearPhaseDoneRecovery(root, idempotencyKey) {
  durableUnlink(phaseDoneRecoveryPath(root, idempotencyKey));
}

function validateTransactionInput(input, { checkIdentity = true } = {}) {
  if (!hasText(input.root)) throw new TypeError('root is required');
  const idempotencyKey = buildPhaseDoneIdempotencyKey(input.close);
  if (checkIdentity && input.idempotencyKey != null && input.idempotencyKey !== idempotencyKey) {
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
  normalizeCompletionActuals(input.actuals);
  return idempotencyKey;
}

function phaseCloseGeneration(input) {
  const descriptor = input.phase?.completionGeneration;
  const initiative = input.initiative?.completionGeneration;
  for (const [label, value] of [['phase', descriptor], ['initiative', initiative]]) {
    if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
      throw new TypeError(`authoritative ${label} completionGeneration must be a positive integer`);
    }
  }
  if ((descriptor !== undefined || initiative !== undefined) && descriptor !== initiative) {
    throw new Error('authoritative phase completionGeneration is inconsistent across mirrors');
  }
  const persisted = descriptor ?? initiative;
  const terminal = terminalStatus(input.phase?.status) || terminalStatus(input.initiative?.status);
  return terminal ? (persisted ?? null) : (persisted ?? 0) + 1;
}

function withPhaseCloseGeneration(input, generation) {
  if (generation === null) return input;
  const phase = { ...input.phase, completionGeneration: generation };
  const plan = {
    ...input.plan,
    phases: input.plan.phases.map((item) => (
      item?.id === phase.id && item?.slug === phase.slug ? structuredClone(phase) : item
    )),
  };
  return {
    ...input,
    plan,
    phase,
    initiative: { ...input.initiative, completionGeneration: generation },
    close: { ...input.close, generation },
  };
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

  const requestedKey = validateTransactionInput(input, { checkIdentity: false });
  for (const name of ['findCommit', 'commit', 'emit', 'assertClean', 'loadState']) {
    if (typeof effects[name] !== 'function') throw new TypeError(`effects.${name} is required`);
  }
  const scope = ['projectId', 'planSlug', 'phaseId'].map((field) => input.close[field]);
  return withScopeTransactionLock(input.root, 'phase-state', scope, async () => {
    const requestedMarker = readPhaseDoneRecovery(input.root, requestedKey);
    const scopeMarker = findPhaseDoneRecoveryByScope(input.root, input.close);
    let marker = requestedMarker ?? scopeMarker;

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
    let authoritativeInput = {
      ...input,
      ...loaded,
      root: input.root,
      close: marker?.close ?? input.close,
    };
    if (marker) {
      if (Object.hasOwn(marker, 'actuals')) {
        authoritativeInput.actuals = structuredClone(marker.actuals);
      } else {
        delete authoritativeInput.actuals;
      }
    }
    const authoritativeGeneration = phaseCloseGeneration(authoritativeInput);
    const generation = marker?.close?.generation ?? authoritativeGeneration;
    if (marker?.close?.generation !== undefined
        && authoritativeGeneration !== null && marker.close.generation !== authoritativeGeneration) {
      throw new Error('phase-done recovery generation conflicts with authoritative phase state');
    }
    authoritativeInput = withPhaseCloseGeneration(authoritativeInput, generation);
    const idempotencyKey = marker?.idempotencyKey
      ?? buildPhaseDoneIdempotencyKey(authoritativeInput.close);
    if (input.idempotencyKey != null && input.idempotencyKey !== idempotencyKey) {
      throw new TypeError('input.idempotencyKey must equal the derived phase close key');
    }
    const prospectiveCompletion = normalizeCompletionRecord({
      event: 'phase-done',
      projectId: authoritativeInput.close.projectId,
      planSlug: authoritativeInput.close.planSlug,
      phaseId: authoritativeInput.close.phaseId,
      taskId: null,
      ...(authoritativeInput.close.generation !== undefined
        ? { generation: authoritativeInput.close.generation }
        : {}),
      weight: authoritativeInput.close.weight,
      weightBasis: authoritativeInput.close.weightBasis,
      idempotencyKey,
      ts: authoritativeInput.close.closedAt,
      ...(authoritativeInput.actuals !== undefined ? { actuals: authoritativeInput.actuals } : {}),
    });
    authoritativeInput = {
      ...authoritativeInput,
      close: {
        ...authoritativeInput.close,
        weight: prospectiveCompletion.weight,
        weightBasis: prospectiveCompletion.weightBasis,
      },
    };
    validateTransactionInput({ ...authoritativeInput, idempotencyKey });
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
      const completion = authenticateTerminalCompletion(input.root, authoritativeInput.close);
      const terminalInput = {
        ...terminalGuardInput,
        close: completion.immutableClose,
        closeSha: completion.record.closeSha,
        idempotencyKey: completion.idempotencyKey,
      };
      // A cleared marker proves the original transaction reached successor
      // publication (when any) and the final clean check. Terminal reuse is
      // therefore authentication-only: caller successor input is untrusted and
      // must never be replayed into a materialization effect.
      delete terminalInput.successor;
      const value = await effects.findCommit(terminalInput, null);
      validateCommitValue(value);
      if (value.closeSha !== completion.record.closeSha) {
        throw new Error('terminal phase reuse completion event does not match the authenticated close commit');
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
      const candidate = authenticatedCandidateBundle(authoritativeInput, produced ?? {});
      commitInput = {
        ...authoritativeInput,
        ...(produced ?? {}),
        root: input.root,
        close: authoritativeInput.close,
        ...candidate,
        tasks: candidate.initiative?.tasks,
        exitGates: candidate.phase?.exitGate?.criteria,
        reviewGate: produced?.reviewGate ?? candidate.phase?.reviewGate ?? authoritativeInput.reviewGate,
      };
      commitDecision = classifyPhaseDoneCommit(commitInput);
      if (!commitDecision.allowed) {
        return { ok: false, stage: 'commit-guard', decision: commitDecision };
      }
      if (validateTransactionInput(commitInput) !== idempotencyKey) {
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
      throw new Error(`phase-done successor manifest conflicts with ${idempotencyKey}`);
    }

    if (!marker) {
      const actuals = normalizeCompletionActuals(commitInput.actuals);
      marker = {
        schemaVersion: 1,
        idempotencyKey,
        stage: 'prepared',
        close: structuredClone(commitInput.close),
        ...(actuals !== undefined ? { actuals: structuredClone(actuals) } : {}),
        successor,
        successorDigest: digestValue(successor),
      };
      writePhaseDoneRecovery(commitInput.root, marker);
    }

    let value = marker.value;
    let transactionInput = {
      ...commitInput,
      successor: structuredClone(marker.successor),
      idempotencyKey,
    };
    if (Object.hasOwn(marker, 'actuals')) {
      transactionInput.actuals = structuredClone(marker.actuals);
    } else {
      delete transactionInput.actuals;
    }
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
    }
    if (marker.stage === 'committed'
        || marker.stage === 'emitted'
        || marker.stage === 'successor-materialized') {
      const ensure = effects.ensureCompletion ?? ensureCompletion;
      const completion = await ensure(input.root, {
        event: 'phase-done',
        projectId: marker.close.projectId,
        planSlug: marker.close.planSlug,
        phaseId: marker.close.phaseId,
        taskId: null,
        ...(marker.close.generation !== undefined
          ? { generation: marker.close.generation }
          : {}),
        weight: marker.close.weight,
        weightBasis: marker.close.weightBasis,
        idempotencyKey,
        closeSha: value.closeSha,
        ts: marker.close.closedAt,
        ...(marker.actuals !== undefined ? { actuals: marker.actuals } : {}),
      });
      if (marker.completion?.record
          && !isDeepStrictEqual(marker.completion.record, completion.record)) {
        throw new Error('phase-done transaction stored completion could not be authenticated');
      }
      marker = {
        ...marker,
        ...(marker.stage === 'committed' ? { stage: 'emitted' } : {}),
        completion,
      };
      writePhaseDoneRecovery(commitInput.root, marker);
    }

    if (marker.stage === 'emitted' && marker.successor !== null) {
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
      reused: false,
      stage: 'committed',
      decision: commitDecision ?? { allowed: true, recovered: true },
      idempotencyKey,
      closeSha: value.closeSha,
      value,
    };
  });
}
