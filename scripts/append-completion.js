#!/usr/bin/env node
/**
 * append-completion.js — the atomic side-effect that turns a `done` / `phase-done`
 * / `reconcile` transition into one immutable, append-only completion event.
 *
 * This is the SOURCE of the earned-value curve (design.md D1/D2): the tracker
 * records its own event at the instant state changes, into a SINGLE GLOBAL log
 * `.atomic-skills/analytics/completions.jsonl` (one line per completion, never
 * rewritten, never reordered). It is NOT a parallel hand-maintained file — it is
 * the transition writing its own event. Per-plan series are the consumer's job
 * (F3 filters by projectId+planSlug); this helper only appends.
 *
 * Event model (F0/T-003): `event` is one of:
 *   - 'task-done'   one per task closed (a plain `done`, or one per task in a
 *                   `phase-done` bulk-close, or one per reconciled task)
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
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dispatchLogPath, readDispatchLog } from './dispatch-log.js';

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
const GIT_EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

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
    // ancestor of HEAD, else fall back to the (fragile) date heuristic.
    let base = '';
    if (hasText(sinceCommit)) {
      try {
        git(['merge-base', '--is-ancestor', sinceCommit, 'HEAD']); // throws unless ancestor
        base = git(['rev-parse', sinceCommit]);
      } catch { base = ''; }
    }
    if (!base && hasText(since)) {
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

/**
 * Read the Mode-2 dispatch telemetry sidecar and derive this task's execution
 * actuals { attempts, durationMs, escalations }. Reads
 * <root>/.atomic-skills/status/dispatch-log.json as NDJSON (one object per line)
 * via `scripts/dispatch-log.js` — never as a whole-file JSON array.
 *
 * Returns the actuals object built from ONLY the finite fields it can derive, or
 * `undefined` when the file is absent or no record matches (plan+phase+taskId).
 * Absent file is graceful (Mode-1 has no dispatch-log). Malformed NDJSON fails
 * closed with a line-numbered error from `readDispatchLog` (F4/T-007) — corruption
 * is never silently swallowed into "no actuals".
 */
export function readDispatchActuals(root, { planSlug, phaseId, taskId } = {}) {
  if (!hasText(taskId)) return undefined;
  const path = dispatchLogPath(root);
  if (!existsSync(path)) return undefined;
  const log = readDispatchLog(root); // throws on corrupt line (fail-closed)
  const matching = log.filter((r) => (
    r && r.plan === planSlug && r.phase === phaseId && r.taskId === taskId
  ));
  if (matching.length === 0) return undefined;
  const rec = matching[matching.length - 1];
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
function normalizeActuals(actuals) {
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

/**
 * Validate + normalize one completion entry into the persisted record shape.
 * Throws (writing nothing) on an invalid enum or a missing required scope field.
 */
function normalize(entry) {
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
  // A caller-supplied ts is frozen immutably (P2); reject one a date parser cannot read.
  if (hasText(entry.ts) && Number.isNaN(Date.parse(entry.ts))) {
    throw new RangeError(`appendCompletion: ts must be a parseable date-time (got ${JSON.stringify(entry.ts)})`);
  }
  const actuals = normalizeActuals(entry.actuals);
  return {
    ts: hasText(entry.ts) ? entry.ts : new Date().toISOString(),
    event: entry.event,
    projectId: entry.projectId,
    planSlug: entry.planSlug,
    phaseId: entry.phaseId,
    taskId: hasText(entry.taskId) ? entry.taskId : null,
    weight,
    weightBasis,
    ...(actuals !== undefined ? { actuals } : {}),
  };
}

/**
 * Logical identity for one completion event (F4/T-005 idempotency / dedupe key).
 *
 * Key = event + projectId + planSlug + phaseId + taskId (empty string when null).
 * Weight/ts/actuals are intentionally excluded so a retry of the same close does
 * not mint a second line with a different timestamp. Returns null when the entry
 * lacks the fields required to form a stable identity (incomplete/legacy lines).
 *
 * @param {object|null|undefined} entry
 * @returns {string|null}
 */
export function completionEventKey(entry) {
  if (entry == null || typeof entry !== 'object') return null;
  const event = entry.event;
  const projectId = entry.projectId;
  const planSlug = entry.planSlug;
  const phaseId = entry.phaseId;
  if (!hasText(event) || !hasText(projectId) || !hasText(planSlug) || !hasText(phaseId)) {
    return null;
  }
  if (event === 'task-done' && !hasText(entry.taskId)) return null;
  const taskPart = hasText(entry.taskId) ? entry.taskId : '';
  return `${event}\0${projectId}\0${planSlug}\0${phaseId}\0${taskPart}`;
}

/**
 * Read completions.jsonl as parsed objects (skips blank/corrupt lines).
 * Pure-ish boundary helper used by dedupe and by pure done-transaction decisions.
 *
 * @param {string} root
 * @returns {object[]}
 */
export function readCompletionLog(root) {
  const path = join(resolve(root), ...ANALYTICS_DIR, LOG_FILE);
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, 'utf8');
    if (!raw.trim()) return [];
    const out = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) out.push(obj);
      } catch {
        // Skip corrupt lines — never throw from a read path used by idempotent retry.
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * First log line whose logical identity matches `entry` (or key), else undefined.
 *
 * @param {string} root
 * @param {object|string} entryOrKey entry fields or a precomputed completionEventKey
 * @returns {object|undefined}
 */
export function findCompletionByKey(root, entryOrKey) {
  const key = typeof entryOrKey === 'string' ? entryOrKey : completionEventKey(entryOrKey);
  if (!hasText(key)) return undefined;
  for (const rec of readCompletionLog(root)) {
    if (completionEventKey(rec) === key) return rec;
  }
  return undefined;
}

/**
 * Collapse an array of completion records to the first occurrence of each
 * logical identity. Records with no stable key are kept (not collapsed).
 * Used by analytics consumers so historical duplicate lines cannot double-count.
 *
 * @param {object[]} records
 * @returns {object[]}
 */
export function dedupeCompletionEvents(records) {
  if (!Array.isArray(records)) return [];
  const seen = new Set();
  const out = [];
  for (const rec of records) {
    const key = completionEventKey(rec);
    if (key != null) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(rec);
  }
  return out;
}

/**
 * Append exactly one completion event to `<root>/.atomic-skills/analytics/completions.jsonl`,
 * creating the `analytics/` dir idempotently. Returns the written (or prior) record.
 *
 * Idempotent (F4/T-005): a second call with the same event identity
 * (`completionEventKey`) returns the existing line and writes nothing. Prior
 * lines are never rewritten or reordered — only scanned for the dedupe key.
 *
 * Task-actuals auto-capture (F4/T-002): a `task-done` entry with no explicit
 * `actuals` derives them from the dispatch-log sidecar here, so BOTH callers —
 * the CLI and the direct programmatic `appendCompletion(root, {...})` path the
 * transition prose also offers — capture attempts/durationMs/escalations. An
 * explicit `actuals` (e.g. phase actuals on a phase-done event) is never
 * overwritten; absence of a dispatch-log degrades to no actuals (graceful).
 *
 * Non-enumerable metadata on the return value:
 *   - `appended`   {boolean} true iff a new line was written
 *   - `idempotent` {boolean} true iff an existing identity was reused
 */
export function appendCompletion(root, entry) {
  let effectiveEntry = entry;
  if (entry && entry.event === 'task-done' && entry.actuals == null) {
    const derived = readDispatchActuals(root, {
      planSlug: entry.planSlug, phaseId: entry.phaseId, taskId: entry.taskId,
    });
    if (derived !== undefined) effectiveEntry = { ...entry, actuals: derived };
  }
  const record = normalize(effectiveEntry); // validate BEFORE touching the filesystem
  const key = completionEventKey(record);
  const existing = key != null ? findCompletionByKey(root, key) : undefined;
  if (existing !== undefined) {
    return Object.defineProperties({ ...existing }, {
      appended: { value: false, enumerable: false },
      idempotent: { value: true, enumerable: false },
    });
  }
  const dir = join(resolve(root), ...ANALYTICS_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, LOG_FILE), `${JSON.stringify(record)}\n`);
  return Object.defineProperties({ ...record }, {
    appended: { value: true, enumerable: false },
    idempotent: { value: false, enumerable: false },
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
      weight: flag('weight') != null ? Number(flag('weight')) : undefined,
      weightBasis: flag('basis'),
      ...(actuals !== undefined ? { actuals } : {}),
    });
    const tag = rec.idempotent ? 'idempotent' : 'appended';
    console.log(`append-completion: ${rec.event} ${rec.projectId}/${rec.planSlug}/${rec.phaseId}${rec.taskId ? `/${rec.taskId}` : ''} weight=${rec.weight}(${rec.weightBasis}) ${tag} ✓`);
  } catch (err) {
    console.error(`append-completion: ${err.message}`);
    process.exit(1);
  }
}
