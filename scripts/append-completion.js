#!/usr/bin/env node
/**
 * append-completion.js — the atomic side-effect that turns a `done` / `phase-done`
 * / `reconcile` transition into one immutable, append-only completion event.
 *
 * This is the SOURCE of the earned-value curve (design.md D1/D2): the tracker
 * records its own event at the instant state changes, into a SINGLE GLOBAL log
 * `.atomic-skills/analytics/completions.jsonl` (one line per completion; prior
 * bytes are preserved as an immutable ordered prefix). New transactional closes carry an idempotencyKey;
 * retries read only to find that exact key and return its immutable prior record
 * instead of appending again. It is NOT a parallel hand-maintained file — it is
 * the transition writing its own event. Per-plan series are the consumer's job.
 *
 * Event model (F0/T-003): `event` is one of:
 *   - 'task-done'   one per task closed by `done` or `reconcile`
 *   - 'phase-done'  one per phase closed, carrying the phase's aggregate actuals
 *                   (F4/T-001) ONCE — never duplicated onto the per-task lines
 *   - 'reconcile'   reserved for reconcile-specific bookkeeping
 *
 * Forward-only / immutable capture (P2/P3): the weight is FROZEN here at the
 * completion instant with its `weightBasis` ('count' before proxy weights exist,
 * 'proxy' after F2), never re-derived at render. A missing weight degrades to
 * 1 / 'count' (count-based burn-up), never invented.
 *
 * Pure boundary: this writes ONLY under `.atomic-skills/analytics/` and NEVER
 * mutates `.md` state. It does not compute series or aggregate.
 *
 * CLI:
 *   node scripts/append-completion.js [<root>] --event <e> --project <id>
 *        --plan <slug> --phase <id> [--task <id>] [--weight <n>] [--basis <b>]
 *        [--idempotency-key <logical-close-key>]
 */

import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { readDispatchLog } from './dispatch-log.js';
import { confinedRepositoryDirectory, confinedRepositoryFile } from '../src/confined-path.js';
import { durableAppendFile, fsyncDirectory } from '../src/durable-file.js';
import {
  parseCompletionEventLog,
  validCompletionTimestamp,
  validateCompletionEvent,
} from '../src/completion-event-validator.js';
import {
  currentProcessOwner,
  isProcessOwnerAlive,
  readOwnedFile,
  releaseOwnedFile,
  withProcessClaimGuard,
  writeOwnedFileAtomically,
} from '../src/process-lock-guard.js';

export { parseDispatchLog } from './dispatch-log.js';

/** The closed enum of completion event kinds (mirrors completion-event.schema.json). */
export const COMPLETION_EVENTS = Object.freeze(['task-done', 'phase-done', 'reconcile']);
/** The closed enum of weight bases: 'count' (pre-proxy) vs 'proxy' (post-F2). */
export const WEIGHT_BASES = Object.freeze(['count', 'proxy']);
/** The closed set of optional `actuals` numeric fields (mirrors completion-event.schema.json). */
export const ACTUALS_KEYS = Object.freeze([
  'filesChanged', 'locAdded', 'locRemoved', 'commits', 'attempts', 'durationMs', 'escalations',
]);

const ANALYTICS_DIR = ['.atomic-skills', 'analytics'];
const LOG_FILE = 'completions.jsonl';
const LOCK_FILE = '.completions.lock';
const LOCK_RETRIES = 500;
const LOCK_RETRY_MS = 10;
const LOCK_WAIT = new Int32Array(new SharedArrayBuffer(4));
const GIT_EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const FULL_GIT_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

const hasText = (v) => typeof v === 'string' && v.length > 0;

/**
 * Compute the phase's aggregate actuals from git history since the phase began.
 * The base of the range is resolved in priority order:
 *   1. `sinceCommit` — the immutable commit SHA recorded at phase activation
 *      (`initiative.startedCommit`). Preferred because it is rebase/squash/amend
 *      proof; used only when it resolves to a real ANCESTOR of HEAD.
 *   2. `since` — an ISO timestamp (the phase's `started` field), resolved via the
 *      `--before` committer-date heuristic. FALLBACK ONLY: a history rewrite moves
 *      committer dates, so this can silently pick a base from a prior phase (or the
 *      empty tree) and inflate the actuals — the exact reason the anchor exists.
 * Returns { filesChanged, locAdded, locRemoved, commits } (all finite numbers) on
 * success, or `undefined` on ANY failure (git absent, not a repo, no usable base,
 * unparseable output). NEVER throws — graceful degradation so a phase-done
 * transition is never blocked by missing git (principle P2).
 */
export function computePhaseActuals(since, { cwd = process.cwd(), sinceCommit } = {}) {
  if (!hasText(since) && !hasText(sinceCommit)) return undefined;
  try {
    const git = (a) => execFileSync('git', a, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    // Prefer the immutable commit anchor; accept it only when it is a real
    // ancestor of HEAD. A recorded-but-unusable anchor is corrupt provenance,
    // so omit actuals rather than silently substituting the date heuristic.
    let base = '';
    if (hasText(sinceCommit)) {
      try {
        git(['merge-base', '--is-ancestor', sinceCommit, 'HEAD']); // throws unless ancestor
        base = git(['rev-parse', sinceCommit]);
      } catch { return undefined; }
    } else if (hasText(since)) {
      base = git(['rev-list', '-1', `--before=${since}`, 'HEAD']);
    }
    const commits = Number(base
      ? git(['rev-list', '--count', `${base}..HEAD`])
      : git(['rev-list', '--count', 'HEAD']));
    const diffBase = base || GIT_EMPTY_TREE;
    const shortstat = git(['diff', '--shortstat', diffBase, 'HEAD']);
    const filesChanged = Number((shortstat.match(/(\d+)\s+files?\s+changed/) || [])[1] || 0);
    const locAdded = Number((shortstat.match(/(\d+)\s+insertions?\(\+\)/) || [])[1] || 0);
    const locRemoved = Number((shortstat.match(/(\d+)\s+deletions?\(-\)/) || [])[1] || 0);
    const out = { filesChanged, locAdded, locRemoved, commits };
    return Object.values(out).every((value) => Number.isFinite(value)) ? out : undefined;
  } catch {
    return undefined;
  }
}

function dispatchRecordTime(record) {
  const finished = Date.parse(record.finishedAt);
  if (Number.isFinite(finished)) return finished;
  const started = Date.parse(record.startedAt);
  return Number.isFinite(started) ? started : Number.NEGATIVE_INFINITY;
}

function newestDispatchRecord(records) {
  return records.reduce((latest, candidate) => {
    const latestTime = dispatchRecordTime(latest);
    const candidateTime = dispatchRecordTime(candidate);
    if (candidateTime !== latestTime) return candidateTime > latestTime ? candidate : latest;
    const latestHasFinished = Number.isFinite(Date.parse(latest.finishedAt));
    const candidateHasFinished = Number.isFinite(Date.parse(candidate.finishedAt));
    if (candidateHasFinished !== latestHasFinished) {
      return candidateHasFinished ? candidate : latest;
    }
    const latestAttempt = Number.isFinite(latest.attempt) ? latest.attempt : Number.NEGATIVE_INFINITY;
    const candidateAttempt = Number.isFinite(candidate.attempt)
      ? candidate.attempt
      : Number.NEGATIVE_INFINITY;
    if (candidateAttempt !== latestAttempt) {
      return candidateAttempt > latestAttempt ? candidate : latest;
    }
    const latestEscalations = Number.isFinite(latest.escalationCount)
      ? latest.escalationCount
      : Number.NEGATIVE_INFINITY;
    const candidateEscalations = Number.isFinite(candidate.escalationCount)
      ? candidate.escalationCount
      : Number.NEGATIVE_INFINITY;
    if (candidateEscalations !== latestEscalations) {
      return candidateEscalations > latestEscalations ? candidate : latest;
    }
    const latestStarted = Date.parse(latest.startedAt);
    const candidateStarted = Date.parse(candidate.startedAt);
    const latestStartedTime = Number.isFinite(latestStarted)
      ? latestStarted
      : Number.NEGATIVE_INFINITY;
    const candidateStartedTime = Number.isFinite(candidateStarted)
      ? candidateStarted
      : Number.NEGATIVE_INFINITY;
    if (candidateStartedTime !== latestStartedTime) {
      return candidateStartedTime > latestStartedTime ? candidate : latest;
    }
    return candidate;
  });
}

/**
 * Read the Mode-2 dispatch telemetry sidecar and derive this task's execution
 * actuals { attempts, durationMs, escalations }. Reads canonical NDJSON and the
 * legacy array/hybrid forms accepted by `parseDispatchLog`.
 * Returns the actuals object built from ONLY the finite fields it can derive, or
 * `undefined` when the file is absent or no record matches (plan+phase+taskId).
 * Malformed present input throws with its physical line; missing Mode-1 telemetry
 * remains graceful and is not an error.
 */
export function readDispatchActuals(root, { planSlug, phaseId, taskId } = {}) {
  if (!hasText(taskId)) return undefined;
  const log = readDispatchLog(root);
  const matching = log.filter((r) => (
    r.plan === planSlug && r.phase === phaseId && r.taskId === taskId
  ));
  if (matching.length === 0) return undefined;
  const rec = newestDispatchRecord(matching);
  const out = {};
  if (Number.isFinite(rec.attempt)) out.attempts = rec.attempt;
  if (Number.isFinite(rec.escalationCount)) out.escalations = rec.escalationCount;
  const a = Date.parse(rec.startedAt);
  const b = Date.parse(rec.finishedAt);
  if (Number.isFinite(a) && Number.isFinite(b) && (b - a) >= 0) {
    out.durationMs = b - a;
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

/**
 * Validate an optional `actuals` sub-object against the same closed numeric shape
 * the schema enforces, BEFORE it is frozen into the append-only log. Returns the
 * object unchanged when valid, undefined when absent; throws (writing nothing) on
 * an unknown key or a non-finite value — so the writer can never emit a line that
 * its own schema (completion-event.schema.json) would later reject.
 */
export function normalizeCompletionActuals(actuals) {
  if (actuals == null) return undefined;
  if (typeof actuals !== 'object' || Array.isArray(actuals)) {
    throw new TypeError('appendCompletion: actuals must be an object');
  }
  for (const [key, value] of Object.entries(actuals)) {
    if (!ACTUALS_KEYS.includes(key)) {
      throw new RangeError(`appendCompletion: unknown actuals field ${JSON.stringify(key)} (allowed: ${ACTUALS_KEYS.join(', ')})`);
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`appendCompletion: actuals.${key} must be a finite number (got ${JSON.stringify(value)})`);
    }
  }
  return actuals;
}

function normalizeReconciliation(event, reconciliation) {
  if (reconciliation == null) return undefined;
  if (event !== 'reconcile' || typeof reconciliation !== 'object' || Array.isArray(reconciliation)) {
    throw new TypeError('appendCompletion: reconciliation is allowed only on a reconcile object');
  }
  const keys = Object.keys(reconciliation).sort();
  const expected = ['action', 'canonicalDigest', 'duplicateDigests', 'eventIdentity'];
  if (!isDeepStrictEqual(keys, expected)) {
    throw new TypeError(`appendCompletion: reconciliation fields must be ${expected.join(', ')}`);
  }
  if (reconciliation.action !== 'ignore-duplicate-completion') {
    throw new RangeError('appendCompletion: unsupported reconciliation action');
  }
  for (const field of ['eventIdentity', 'canonicalDigest']) {
    if (!hasText(reconciliation[field])) {
      throw new TypeError(`appendCompletion: reconciliation.${field} is required`);
    }
  }
  if (!/^[a-f0-9]{64}$/.test(reconciliation.canonicalDigest)
      || !Array.isArray(reconciliation.duplicateDigests)
      || reconciliation.duplicateDigests.length === 0
      || reconciliation.duplicateDigests.some((digest) => !/^[a-f0-9]{64}$/.test(digest))) {
    throw new TypeError('appendCompletion: reconciliation digests must be lowercase sha256 values');
  }
  return structuredClone(reconciliation);
}

/**
 * Validate + normalize one completion entry into the persisted record shape.
 * Throws (writing nothing) on an invalid enum or a missing required scope field.
 */
export function normalizeCompletionRecord(entry) {
  if (entry == null || typeof entry !== 'object') {
    throw new TypeError('appendCompletion: entry must be an object');
  }
  if (!COMPLETION_EVENTS.includes(entry.event)) {
    throw new RangeError(`appendCompletion: event must be one of ${COMPLETION_EVENTS.join(', ')} (got ${JSON.stringify(entry.event)})`);
  }
  for (const field of ['projectId', 'planSlug', 'phaseId']) {
    if (!hasText(entry[field])) throw new TypeError(`appendCompletion: ${field} is required`);
  }
  const weightBasis = entry.weightBasis ?? 'count';
  if (!WEIGHT_BASES.includes(weightBasis)) {
    throw new RangeError(`appendCompletion: weightBasis must be one of ${WEIGHT_BASES.join(', ')} (got ${JSON.stringify(entry.weightBasis)})`);
  }
  const weight = entry.weight ?? 1;
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
    throw new TypeError(`appendCompletion: weight must be a finite number >= 0 (got ${JSON.stringify(entry.weight)})`);
  }
  // A 'task-done' event must attribute to a task; only 'phase-done'/'reconcile'
  // bookkeeping may carry a null taskId (P4: the event is the task's own effect).
  if (entry.event === 'task-done' && !hasText(entry.taskId)) {
    throw new TypeError("appendCompletion: a 'task-done' event requires a non-empty taskId");
  }
  if (entry.event === 'phase-done' && entry.taskId != null) {
    throw new TypeError("appendCompletion: a 'phase-done' event requires taskId to be null");
  }
  if (entry.event === 'reconcile' && entry.reconciliation == null) {
    throw new TypeError("appendCompletion: reconciliation metadata is required for a 'reconcile' event");
  }
  if (entry.event === 'reconcile' && entry.taskId != null) {
    throw new TypeError("appendCompletion: a 'reconcile' event requires taskId to be null");
  }
  // A caller-supplied ts is frozen immutably (P2) under the shared state timestamp contract.
  if (entry.ts !== undefined && !validCompletionTimestamp(entry.ts)) {
    throw new RangeError(
      `appendCompletion: ts must be an ISO date-time with an explicit offset (got ${JSON.stringify(entry.ts)})`,
    );
  }
  if (entry.generation !== undefined
      && (!Number.isInteger(entry.generation) || entry.generation < 1)) {
    throw new TypeError('appendCompletion: generation must be a positive integer');
  }
  if (entry.closeSha != null && !FULL_GIT_OID.test(entry.closeSha)) {
    throw new TypeError('appendCompletion: closeSha must be a full lowercase git object id');
  }
  const actuals = normalizeCompletionActuals(entry.actuals);
  const reconciliation = normalizeReconciliation(entry.event, entry.reconciliation);
  return {
    ts: hasText(entry.ts) ? entry.ts : new Date().toISOString(),
    event: entry.event,
    projectId: entry.projectId,
    planSlug: entry.planSlug,
    phaseId: entry.phaseId,
    taskId: hasText(entry.taskId) ? entry.taskId : null,
    ...(entry.generation !== undefined ? { generation: entry.generation } : {}),
    ...(hasText(entry.idempotencyKey) ? { idempotencyKey: entry.idempotencyKey } : {}),
    ...(hasText(entry.closeSha) ? { closeSha: entry.closeSha } : {}),
    weight,
    weightBasis,
    ...(actuals !== undefined ? { actuals } : {}),
    ...(reconciliation !== undefined ? { reconciliation } : {}),
  };
}

function readCompletionRecords(path) {
  if (!existsSync(path)) return [];
  return parseCompletionEventLog(readFileSync(path, 'utf8'), { source: path });
}

export function sameLogicalCompletion(existing, candidate) {
  const withoutTimestamp = (record) => {
    const copy = structuredClone(record);
    delete copy.ts;
    if (Number.isInteger(copy.generation) && copy.generation > 0 && copy.event !== 'reconcile') {
      delete copy.closeSha;
    }
    return copy;
  };
  return isDeepStrictEqual(withoutTimestamp(existing), withoutTimestamp(candidate));
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

export function completionDigest(record) {
  return createHash('sha256').update(JSON.stringify(canonicalize(record))).digest('hex');
}

function completionEventIdentity(record) {
  const generation = Number.isInteger(record?.generation) && record.generation > 0
    ? `#${record.generation}`
    : '';
  return `${record?.event ?? '<unknown>'}:${record?.taskId ?? '<phase>'}${generation}`;
}

export function completionDuplicateRepair(records) {
  if (!Array.isArray(records) || records.length < 2) return null;
  if (records.some((record) => !sameLogicalCompletion(records[0], record))) return null;
  const ordered = records.map((record) => ({ record, digest: completionDigest(record) }))
    .sort((left, right) => left.digest.localeCompare(right.digest));
  return {
    identity: completionEventIdentity(ordered[0].record),
    canonicalRecord: ordered[0].record,
    canonicalDigest: ordered[0].digest,
    duplicateDigests: ordered.slice(1).map(({ digest }) => digest),
  };
}

function legacyDuplicateRepair(records) {
  return {
    identity: `${records[0]?.event ?? '<unknown>'}:${records[0]?.taskId ?? '<phase>'}`,
    canonicalDigest: completionDigest(records[0]),
    duplicateDigests: records.slice(1).map(completionDigest),
  };
}

function canonicalReconciliationRecords(records) {
  const selected = new Set();
  const keyed = new Map();
  for (const record of records.filter((candidate) => candidate?.event === 'reconcile')) {
    if (!validateCompletionEvent(record).ok) {
      throw new Error('completion ledger contains a schema-invalid reconciliation tombstone');
    }
    if (!hasText(record.idempotencyKey)) {
      selected.add(record);
      continue;
    }
    const group = keyed.get(record.idempotencyKey) ?? [];
    group.push(record);
    keyed.set(record.idempotencyKey, group);
  }
  for (const [idempotencyKey, group] of keyed) {
    if (group.some((record) => !sameLogicalCompletion(group[0], record))) {
      throw new Error(`completion ledger has conflicting reconciliation payloads for ${idempotencyKey}`);
    }
    const canonical = [...group].sort((left, right) => (
      completionDigest(left).localeCompare(completionDigest(right))
    ))[0];
    selected.add(canonical);
  }
  return selected;
}

function markerMatchesRepair(record, canonical, repair) {
  return record?.event === 'reconcile'
    && record?.projectId === canonical.projectId
    && record?.planSlug === canonical.planSlug
    && record?.phaseId === canonical.phaseId
    && record?.reconciliation?.action === 'ignore-duplicate-completion'
    && record.reconciliation.eventIdentity === repair.identity
    && record.reconciliation.canonicalDigest === repair.canonicalDigest
    && isDeepStrictEqual(record.reconciliation.duplicateDigests, repair.duplicateDigests);
}

export function reconcilesExactDuplicates(records, allRecords) {
  if (records.length < 2) return false;
  const stable = completionDuplicateRepair(records);
  if (!stable) return false;
  const legacy = legacyDuplicateRepair(records);
  const tombstones = canonicalReconciliationRecords(allRecords);
  return [...tombstones].some((record) => (
    markerMatchesRepair(record, stable.canonicalRecord, stable)
    || markerMatchesRepair(record, records[0], legacy)
  ));
}

export function canonicalCompletionRecords(records) {
  if (!Array.isArray(records)) throw new TypeError('completion records must be an array');
  const canonicalTombstones = canonicalReconciliationRecords(records);
  const grouped = new Map();
  for (const record of records) {
    if (record?.event === 'reconcile' || !hasText(record?.idempotencyKey)) continue;
    const group = grouped.get(record.idempotencyKey) ?? [];
    group.push(record);
    grouped.set(record.idempotencyKey, group);
  }
  for (const [idempotencyKey, group] of grouped) {
    if (group.length > 1 && !reconcilesExactDuplicates(group, records)) {
      throw new Error(`completion ledger has an unneutralized duplicate idempotency key: ${idempotencyKey}`);
    }
  }
  const canonicalByKey = new Map([...grouped].map(([idempotencyKey, group]) => [
    idempotencyKey,
    group.length > 1 ? completionDuplicateRepair(group).canonicalRecord : group[0],
  ]));
  return records.filter((record) => {
    if (record?.event === 'reconcile') return canonicalTombstones.has(record);
    if (!hasText(record?.idempotencyKey)) return true;
    return canonicalByKey.get(record.idempotencyKey) === record;
  });
}

function readLockOwner(path) {
  return readOwnedFile(path, 'completion ledger lock');
}

function acquireCompletionLock(dir) {
  const path = join(dir, LOCK_FILE);
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt += 1) {
    const lock = withProcessClaimGuard(`${path}.guard`, () => {
      const owner = readLockOwner(path);
      if (owner && isProcessOwnerAlive(owner)) return null;
      if (owner) releaseOwnedFile(path, owner.token, 'completion ledger lock');
      const token = randomUUID();
      writeOwnedFileAtomically(path, currentProcessOwner(token));
      return { path, token };
    }, {
      label: 'completion ledger lock guard',
      retries: LOCK_RETRIES,
      retryMs: LOCK_RETRY_MS,
    });
    if (lock) return lock;
    if (attempt < LOCK_RETRIES - 1) Atomics.wait(LOCK_WAIT, 0, 0, LOCK_RETRY_MS);
  }
  throw new Error('completion ledger lock timed out while held by a live process');
}

function releaseCompletionLock(lock) {
  withProcessClaimGuard(`${lock.path}.guard`, () => {
    releaseOwnedFile(lock.path, lock.token, 'completion ledger lock');
  }, {
    label: 'completion ledger lock guard',
    retries: LOCK_RETRIES,
    retryMs: LOCK_RETRY_MS,
  });
}

function syncCompletionLog(path, { beforeFileSync } = {}) {
  const fd = openSync(path, 'r+');
  try {
    if (typeof beforeFileSync === 'function') beforeFileSync();
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  fsyncDirectory(dirname(path));
}

function appendCompletionRecord(path, record, options = {}) {
  const raw = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (raw !== '') readCompletionRecords(path);
  const separator = raw !== '' && !raw.endsWith('\n') ? '\n' : '';
  durableAppendFile(path, `${separator}${JSON.stringify(record)}\n`, {
    faultAt: options.appendFaultAt,
    beforeFileSync: options.beforeFileSync,
  });
}

/**
 * Exclusive authority for completion-ledger reads and writes. The callback is
 * synchronous so the lock cannot escape across an unawaited promise boundary.
 */
export function withCompletionLedgerLock(root, operation) {
  if (typeof operation !== 'function') throw new TypeError('completion ledger operation is required');
  const dir = confinedRepositoryDirectory(root, ANALYTICS_DIR, { create: true });
  const path = confinedRepositoryFile(root, ANALYTICS_DIR, LOG_FILE, { createParents: true });
  const lock = acquireCompletionLock(dir);
  try {
    const ledger = {
      path,
      readRecords: () => readCompletionRecords(path),
      readRaw: () => (existsSync(path) ? readFileSync(path, 'utf8') : ''),
      append: (entry) => {
        const record = normalizeCompletionRecord(entry);
        appendCompletionRecord(path, record);
        return record;
      },
      appendRecord: (record, options) => appendCompletionRecord(path, record, options),
      sync: (options) => syncCompletionLog(path, options),
    };
    ledger.ensure = (entry, options) => ensureCompletionLocked(root, entry, ledger, options);
    const result = operation(ledger);
    if (result && typeof result.then === 'function') {
      throw new TypeError('completion ledger operation must be synchronous');
    }
    return result;
  } finally {
    releaseCompletionLock(lock);
  }
}

/**
 * Ensure exactly one append-only record for a caller-supplied logical close.
 * Existing legacy events remain untouched; idempotency is forward-only.
 */
function ensureCompletionLocked(root, entry, ledger, {
  beforeAppend,
  beforeFileSync,
  appendFaultAt,
} = {}) {
  if (!hasText(entry?.idempotencyKey)) {
    throw new TypeError('ensureCompletion: idempotencyKey is required');
  }
  const suppliedCandidate = normalizeCompletionRecord(entry);
  const records = ledger.readRecords();
  const matches = records.filter((record) => (
    record.idempotencyKey === suppliedCandidate.idempotencyKey
  ));
  if (matches.length > 0) {
    const candidate = entry.actuals == null && matches[0].actuals !== undefined
      ? normalizeCompletionRecord({ ...entry, actuals: matches[0].actuals })
      : suppliedCandidate;
    if (!sameLogicalCompletion(matches[0], candidate)) {
      throw new Error(
        `ensureCompletion: idempotency key conflict for ${JSON.stringify(candidate.idempotencyKey)}`,
      );
    }
    if (matches.length > 1 && candidate.event === 'reconcile') {
      canonicalReconciliationRecords(records);
    } else if (matches.length > 1 && !reconcilesExactDuplicates(matches, records)) {
      throw new Error(
        `ensureCompletion: duplicate idempotency records require exactly one reconciliation for ${JSON.stringify(candidate.idempotencyKey)}`,
      );
    }
    // A prior attempt can append the line and fail at fsync. Re-sync both the
    // file and its parent before authenticating that visible record as durable.
    ledger.sync({ beforeFileSync });
    return { record: matches[0], appended: false };
  }
  let effectiveEntry = entry;
  if (entry.event === 'task-done' && entry.actuals == null) {
    const derived = readDispatchActuals(root, {
      planSlug: entry.planSlug, phaseId: entry.phaseId, taskId: entry.taskId,
    });
    if (derived !== undefined) effectiveEntry = { ...entry, actuals: derived };
  }
  const candidate = normalizeCompletionRecord(effectiveEntry);
  if (typeof beforeAppend === 'function') beforeAppend();
  ledger.appendRecord(candidate, { beforeFileSync, appendFaultAt });
  return { record: candidate, appended: true };
}

export function ensureCompletion(root, entry, options = {}) {
  return withCompletionLedgerLock(root, (ledger) => (
    ensureCompletionLocked(root, entry, ledger, options)
  ));
}

/**
 * Append exactly one completion event to `<root>/.atomic-skills/analytics/completions.jsonl`,
 * creating the `analytics/` dir idempotently. Returns the written record.
 * Logically append-only: the exact existing byte prefix is preserved and a
 * complete replacement is atomically published, so prior lines are never
 * changed/reordered and a crash cannot expose a partial final JSON record.
 *
 * Task-actuals auto-capture (F4/T-002): a `task-done` entry with no explicit
 * `actuals` derives them from the dispatch-log sidecar here, so BOTH callers —
 * the CLI and the direct programmatic `appendCompletion(root, {...})` path the
 * transition prose also offers — capture attempts/durationMs/escalations. An
 * explicit `actuals` (e.g. phase actuals on a phase-done event) is never
 * overwritten; absence of a dispatch-log degrades to no actuals (graceful).
 */
export function appendCompletion(root, entry) {
  if (hasText(entry?.idempotencyKey)) return ensureCompletion(root, entry).record;
  let effectiveEntry = entry;
  if (entry && entry.event === 'task-done' && entry.actuals == null) {
    const derived = readDispatchActuals(root, {
      planSlug: entry.planSlug, phaseId: entry.phaseId, taskId: entry.taskId,
    });
    if (derived !== undefined) effectiveEntry = { ...entry, actuals: derived };
  }
  const record = normalizeCompletionRecord(effectiveEntry); // validate BEFORE touching the filesystem
  return withCompletionLedgerLock(root, (ledger) => {
    ledger.appendRecord(record);
    return record;
  });
}

// CLI
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const positional = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
  const root = positional || process.cwd();
  try {
    // Phase actuals are an explicit opt-in flag; task-done dispatch actuals are
    // auto-derived inside appendCompletion (covers this CLI AND the programmatic path).
    const actuals = (args.includes('--actuals-since') || args.includes('--actuals-since-commit'))
      ? computePhaseActuals(flag('actuals-since'), { cwd: root, sinceCommit: flag('actuals-since-commit') })
      : undefined;
    const rec = appendCompletion(root, {
      event: flag('event'),
      projectId: flag('project'),
      planSlug: flag('plan'),
      phaseId: flag('phase'),
      taskId: flag('task'),
      idempotencyKey: flag('idempotency-key'),
      weight: flag('weight') != null ? Number(flag('weight')) : undefined,
      weightBasis: flag('basis'),
      ...(actuals !== undefined ? { actuals } : {}),
    });
    console.log(`append-completion: ${rec.event} ${rec.projectId}/${rec.planSlug}/${rec.phaseId}${rec.taskId ? `/${rec.taskId}` : ''} weight=${rec.weight}(${rec.weightBasis}) ✓`);
  } catch (err) {
    console.error(`append-completion: ${err.message}`);
    process.exit(1);
  }
}
