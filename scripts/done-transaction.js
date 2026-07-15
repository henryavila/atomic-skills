import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import {
  completionDuplicateRepair,
  ensureCompletion,
  normalizeCompletionActuals,
  normalizeCompletionRecord,
  readDispatchActuals,
  reconcilesExactDuplicates,
  withCompletionLedgerLock,
} from './append-completion.js';
import { withScopeTransactionLock } from './transaction-lock.js';
import { durableReplace, durableUnlink } from '../src/durable-file.js';
import { confinedRepositoryDirectory, confinedRepositoryFile } from '../src/confined-path.js';

const REQUIRED_CLOSE_FIELDS = ['projectId', 'planSlug', 'phaseId', 'taskId', 'closedAt'];
const REQUIRED_HANDOFF_FIELDS = [
  'narrative',
  'decisionLog',
  'singleNextAction',
  'verbatimState',
  'uncommittedChanges',
];
const TASK_COMPLETION_ACTUALS_KEYS = new Set(['attempts', 'durationMs', 'escalations']);
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
  if (close.generation !== undefined) {
    if (!Number.isInteger(close.generation) || close.generation < 1) {
      throw new TypeError('close.generation must be a positive integer');
    }
    return `task-done:${scope}#${close.generation}`;
  }
  return `task-done:${scope}@${encodeURIComponent(close.closedAt)}`;
}

export function doneRecoveryPath(root, idempotencyKey) {
  const digest = createHash('sha256').update(idempotencyKey).digest('hex');
  return confinedRepositoryFile(
    root,
    ['.atomic-skills', 'status', 'done-transactions'],
    `${digest}.json`,
  );
}

export function readDoneRecovery(root, idempotencyKey) {
  const path = doneRecoveryPath(root, idempotencyKey);
  if (!existsSync(path)) return null;
  const marker = JSON.parse(readFileSync(path, 'utf8'));
  if (marker?.schemaVersion !== 1 || marker?.idempotencyKey !== idempotencyKey
    || !STAGES.has(marker?.stage) || !marker.bundle
    || marker.bundleDigest !== digestValue(marker.bundle)
    || buildDoneIdempotencyKey(marker.close) !== idempotencyKey
    || marker.bundle?.task?.id !== marker.close.taskId) {
    throw new Error(`done transaction recovery marker is invalid: ${path}`);
  }
  return marker;
}

export function assertPhaseTaskClosesComplete(root, close = {}, tasks = []) {
  for (const field of ['projectId', 'planSlug', 'phaseId']) requireText(close, field, 'close');
  const parts = ['.atomic-skills', 'status', 'done-transactions'];
  const dir = confinedRepositoryDirectory(root, parts);
  const markerNames = existsSync(dir)
    ? readdirSync(dir).filter((entry) => entry.endsWith('.json'))
    : [];
  for (const name of markerNames) {
    const path = confinedRepositoryFile(root, parts, name);
    let candidate;
    try {
      candidate = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      throw new Error(`task-close transaction marker is invalid: ${path}: ${error.message}`);
    }
    if (!hasText(candidate?.idempotencyKey)
        || doneRecoveryPath(root, candidate.idempotencyKey) !== path) {
      throw new Error(`task-close transaction marker path does not match its identity: ${path}`);
    }
    const marker = readDoneRecovery(root, candidate.idempotencyKey);
    const sameScope = ['projectId', 'planSlug', 'phaseId']
      .every((field) => marker.close[field] === close[field]);
    if (sameScope) {
      throw new Error(
        `phase has an incomplete task-close transaction for ${marker.close.taskId} at stage ${marker.stage}`,
      );
    }
  }
  const generatedTasks = tasks.filter((task) => task?.status === 'done'
    && task.completionGeneration !== undefined);
  if (generatedTasks.length === 0) return;
  withCompletionLedgerLock(root, (ledger) => {
    const records = ledger.readRecords();
    for (const task of generatedTasks) {
      if (!Number.isInteger(task.completionGeneration) || task.completionGeneration < 1
          || !hasText(task.id) || !hasText(task.closedAt)) {
        throw new Error(`task ${task?.id ?? '<unknown>'} has invalid completion generation state`);
      }
      const taskClose = {
        projectId: close.projectId,
        planSlug: close.planSlug,
        phaseId: close.phaseId,
        taskId: task.id,
        closedAt: task.closedAt,
        generation: task.completionGeneration,
      };
      const idempotencyKey = buildDoneIdempotencyKey(taskClose);
      const matches = records.filter((record) => (
        record?.event === 'task-done'
        && record.projectId === close.projectId
        && record.planSlug === close.planSlug
        && record.phaseId === close.phaseId
        && record.taskId === task.id
        && record.generation === task.completionGeneration
        && record.idempotencyKey === idempotencyKey
      ));
      if (matches.length === 0) {
        throw new Error(
          `task ${task.id} completion generation ${task.completionGeneration} is missing from the completion ledger`,
        );
      }
      let record = matches[0];
      if (matches.length > 1) {
        if (!reconcilesExactDuplicates(matches, records)) {
          throw new Error(
            `task ${task.id} completion generation ${task.completionGeneration} is duplicated without reconciliation`,
          );
        }
        record = completionDuplicateRepair(matches).canonicalRecord;
      }
      const weight = authoritativeTaskWeight(task);
      if (record.weight !== weight) {
        throw new Error(
          `task ${task.id} completion generation ${task.completionGeneration} weight conflicts with authoritative state`,
        );
      }
    }
  });
}

function writeDoneRecovery(root, marker) {
  const digest = createHash('sha256').update(marker.idempotencyKey).digest('hex');
  const path = confinedRepositoryFile(
    root,
    ['.atomic-skills', 'status', 'done-transactions'],
    `${digest}.json`,
    { createParents: true },
  );
  durableReplace(path, `${JSON.stringify({ ...marker, updatedAt: new Date().toISOString() }, null, 2)}\n`);
  return path;
}

function clearDoneRecovery(root, idempotencyKey) {
  durableUnlink(doneRecoveryPath(root, idempotencyKey));
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
  const task = matches[0];
  const live = initiative.status === 'active' || initiative.status === 'paused';
  const terminalRepair = (initiative.status === 'done' || initiative.status === 'archived')
    && task.status === 'done';
  if (!live && !terminalRepair) {
    throw new TypeError('authoritative initiative must remain live unless repairing an already-done task');
  }
  return task;
}

function authoritativeTaskWeight(task) {
  const weight = task.weight ?? 1;
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
    throw new TypeError('authoritative task weight must be a finite number >= 0');
  }
  return weight;
}

function taskCloseGeneration(task) {
  const persisted = task.completionGeneration;
  if (persisted !== undefined && (!Number.isInteger(persisted) || persisted < 1)) {
    throw new TypeError('authoritative task completionGeneration must be a positive integer');
  }
  if (task.status === 'done') return persisted ?? null;
  return (persisted ?? 0) + 1;
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
  const actuals = normalizeCompletionActuals(input.actuals);
  for (const field of Object.keys(actuals ?? {})) {
    if (!TASK_COMPLETION_ACTUALS_KEYS.has(field)) {
      throw new RangeError(`task completion actuals cannot contain ${JSON.stringify(field)}`);
    }
  }
  const completionProvenance = {
    nextAction: input.nextAction,
    handoff: structuredClone(handoff),
    ...(actuals !== undefined ? { actuals: structuredClone(actuals) } : {}),
  };
  return {
    task: {
      ...task,
      status: 'done',
      closedAt: close.closedAt,
      lastUpdated: close.closedAt,
      ...(close.generation !== undefined ? { completionGeneration: close.generation } : {}),
      weight: close.weight,
      evidence: structuredClone(evidence),
      completionProvenance,
    },
    evidence: structuredClone(evidence),
    nextAction: input.nextAction,
    handoff: structuredClone(handoff),
    ...(actuals !== undefined ? { actuals: structuredClone(actuals) } : {}),
  };
}

/**
 * Recoverable task-close coordinator. Effects own the initiative write,
 * refresh, and explicit-path git checkpoint; this authority owns ordering,
 * marker durability, and the exactly-once completion append.
 */
export async function executeDoneTransaction(input = {}, effects = {}) {
  buildDoneIdempotencyKey(input.close);
  for (const name of [
    'loadInitiative', 'persistClose', 'refresh', 'findCheckpoint', 'checkpoint', 'assertClean',
  ]) {
    if (typeof effects[name] !== 'function') throw new TypeError(`effects.${name} is required`);
  }
  const scope = ['projectId', 'planSlug', 'phaseId'].map((field) => input.close[field]);
  return withScopeTransactionLock(input.root, 'phase-state', scope, async () => {
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
    const taskWeight = authoritativeTaskWeight(currentTask);
    if (input.close.weight !== undefined
        && (typeof input.close.weight !== 'number'
          || !Number.isFinite(input.close.weight) || input.close.weight < 0)) {
      throw new TypeError('close.weight must be a finite number >= 0');
    }
    if (input.close.weight !== undefined && input.close.weight !== taskWeight) {
      throw new Error(
        `close weight ${input.close.weight} conflicts with authoritative task weight ${taskWeight}`,
      );
    }
    transactionInput = {
      ...transactionInput,
      close: { ...transactionInput.close, weight: taskWeight },
    };
    const generation = taskCloseGeneration(currentTask);
    const reused = currentTask.status === 'done';
    if (currentTask.status === 'done') {
      if (!hasText(currentTask.closedAt)) {
        throw new TypeError('a done authoritative task must retain its immutable closedAt');
      }
      const completionProvenance = currentTask.completionProvenance;
      const persisted = {
        evidence: currentTask.evidence,
        nextAction: completionProvenance?.nextAction,
        handoff: completionProvenance?.handoff,
        ...(completionProvenance?.actuals !== undefined
          ? { actuals: normalizeCompletionActuals(completionProvenance.actuals) }
          : {}),
      };
      if (!persisted.evidence || persisted.evidence.passed !== true
          || !hasText(persisted.nextAction)
          || !persisted.handoff || typeof persisted.handoff !== 'object') {
        throw new TypeError('already-done reuse requires complete persisted close provenance');
      }
      if (!isDeepStrictEqual(input.evidence, persisted.evidence)
          || input.nextAction !== persisted.nextAction
          || !isDeepStrictEqual(input.handoff, persisted.handoff)) {
        throw new Error('caller provenance conflicts with persisted close provenance');
      }
      transactionInput = {
        ...transactionInput,
        close: {
          ...input.close,
          closedAt: currentTask.closedAt,
          ...(generation !== null ? { generation } : {}),
          ...(currentTask.weight !== undefined ? { weight: currentTask.weight } : {}),
        },
        ...structuredClone(persisted),
      };
      if (persisted.actuals === undefined) delete transactionInput.actuals;
    } else {
      transactionInput = {
        ...transactionInput,
        close: { ...transactionInput.close, generation },
      };
    }
    const idempotencyKey = buildDoneIdempotencyKey(transactionInput.close);
    if (input.idempotencyKey != null && input.idempotencyKey !== idempotencyKey) {
      throw new TypeError('input.idempotencyKey must equal the derived close key');
    }
    let marker = readDoneRecovery(input.root, idempotencyKey);
    if (marker?.bundle?.actuals !== undefined) {
      transactionInput.actuals = structuredClone(marker.bundle.actuals);
    } else if (!marker && !reused) {
      const actuals = readDispatchActuals(input.root, {
        planSlug: transactionInput.close.planSlug,
        phaseId: transactionInput.close.phaseId,
        taskId: transactionInput.close.taskId,
      });
      if (actuals !== undefined) transactionInput.actuals = actuals;
    } else if (marker) {
      delete transactionInput.actuals;
    }
    const prospectiveCompletion = normalizeCompletionRecord({
      event: 'task-done',
      projectId: transactionInput.close.projectId,
      planSlug: transactionInput.close.planSlug,
      phaseId: transactionInput.close.phaseId,
      taskId: transactionInput.close.taskId,
      ...(transactionInput.close.generation !== undefined
        ? { generation: transactionInput.close.generation }
        : {}),
      weight: transactionInput.close.weight,
      weightBasis: transactionInput.close.weightBasis,
      idempotencyKey,
      ts: transactionInput.close.closedAt,
      ...(transactionInput.actuals !== undefined ? { actuals: transactionInput.actuals } : {}),
    });
    transactionInput = {
      ...transactionInput,
      close: {
        ...transactionInput.close,
        weight: prospectiveCompletion.weight,
        weightBasis: prospectiveCompletion.weightBasis,
      },
    };
    let bundle = buildBundle(transactionInput);
    const bundleDigest = digestValue(bundle);
    if (!marker) {
      marker = {
        schemaVersion: 1,
        idempotencyKey,
        stage: reused ? 'state-persisted' : 'prepared',
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

    if (marker.stage === 'state-persisted'
        || marker.stage === 'event-persisted'
        || marker.stage === 'checkpointed') {
      const ensure = effects.ensureCompletion ?? ensureCompletion;
      const authenticatedCompletion = await ensure(input.root, {
        event: 'task-done',
        projectId: transactionInput.close.projectId,
        planSlug: transactionInput.close.planSlug,
        phaseId: transactionInput.close.phaseId,
        taskId: transactionInput.close.taskId,
        ...(transactionInput.close.generation !== undefined
          ? { generation: transactionInput.close.generation }
          : {}),
        weight: transactionInput.close.weight,
        weightBasis: transactionInput.close.weightBasis,
        idempotencyKey,
        ts: transactionInput.close.closedAt,
        ...(bundle.actuals !== undefined
          ? { actuals: bundle.actuals }
          : (marker.completion?.record?.actuals !== undefined
            ? { actuals: marker.completion.record.actuals }
            : {})),
      });
      if (marker.completion !== undefined
          && (!marker.completion?.record
            || !isDeepStrictEqual(marker.completion.record, authenticatedCompletion?.record))) {
        throw new Error('done transaction stored completion could not be authenticated');
      }
      completion = authenticatedCompletion;
      if (marker.stage === 'state-persisted') {
        marker = { ...marker, stage: 'event-persisted', completion };
        writeDoneRecovery(input.root, marker);
      }
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
    return { ok: true, reused, idempotencyKey, bundle, completion, checkpoint };
  });
}
