/**
 * Pure / fs-scoped decision log for automate pure-maestro (F1).
 *
 * Append-only JSONL per phase under the plan tree. Agents append decision
 * entries only — no API stamps decision-review PASS (operator-only hardgate).
 * No network I/O. No secrets in entries (caller discipline + reject empty decision).
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** @type {readonly string[]} */
export const DECISION_CATEGORIES = Object.freeze([
  'routing',
  'tradeoff',
  'review-disposition',
  'scope-exit',
  'manual-gate-delegation',
  'env',
]);

/** @type {readonly string[]} */
export const REQUIRED_DECISION_FIELDS = Object.freeze([
  'id',
  'category',
  'decision',
  'why',
  'evidencePath',
  'impact',
  'at',
]);

/**
 * @typedef {{
 *   id: string,
 *   category: string,
 *   decision: string,
 *   why: string,
 *   evidencePath: string,
 *   impact: string,
 *   at: string,
 *   phaseId?: string,
 *   taskId?: string,
 *   actor?: string,
 *   relatedCommitShas?: string[],
 *   notes?: string,
 * }} DecisionEntry
 */

/**
 * Resolve durable decision log path for a phase.
 *
 * Layout:
 *   <statusRoot>/projects/<projectId>/<planSlug>/decisions/<phaseId>.jsonl
 *
 * @param {{
 *   statusRoot?: string | null,
 *   projectId: string,
 *   planSlug: string,
 *   phaseId: string,
 * }} parts
 * @returns {string}
 */
export function decisionLogPath(parts) {
  if (parts == null || typeof parts !== 'object') {
    throw new Error('decisionLogPath: parts object required');
  }
  const projectId = String(parts.projectId ?? '').trim();
  const planSlug = String(parts.planSlug ?? '').trim();
  const phaseId = String(parts.phaseId ?? '').trim();
  if (!projectId || !planSlug || !phaseId) {
    throw new Error(
      'decisionLogPath: projectId, planSlug, and phaseId are required',
    );
  }
  // Reject path segments that would escape the decisions dir
  for (const [name, value] of [
    ['projectId', projectId],
    ['planSlug', planSlug],
    ['phaseId', phaseId],
  ]) {
    if (
      value.includes('..') ||
      value.includes('/') ||
      value.includes('\\') ||
      value.includes('\0')
    ) {
      throw new Error(`decisionLogPath: invalid ${name}`);
    }
  }
  const root = parts.statusRoot != null && String(parts.statusRoot).trim()
    ? String(parts.statusRoot).trim()
    : join(process.cwd(), '.atomic-skills');
  return join(root, 'projects', projectId, planSlug, 'decisions', `${phaseId}.jsonl`);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Normalize and validate an entry. Throws on invalid input.
 * Never accepts or sets decisionReview PASS.
 *
 * @param {Partial<DecisionEntry> & Record<string, unknown>} raw
 * @returns {DecisionEntry}
 */
export function validateDecisionEntry(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('decision entry must be a non-null object');
  }

  // Fence: append APIs must never stamp decision-review PASS
  if (
    Object.prototype.hasOwnProperty.call(raw, 'decisionReview') ||
    Object.prototype.hasOwnProperty.call(raw, 'decisionReviewStatus')
  ) {
    throw new Error(
      'appendDecision rejects decisionReview fields — only the operator writes decision-review PASS',
    );
  }

  if (!isNonEmptyString(raw.category)) {
    throw new Error('decision entry missing category');
  }
  if (!isNonEmptyString(raw.decision)) {
    throw new Error('decision entry empty or missing decision');
  }

  const category = String(raw.category).trim();
  const decision = String(raw.decision).trim();

  const id = isNonEmptyString(raw.id) ? String(raw.id).trim() : randomUUID();
  const why = raw.why != null ? String(raw.why) : '';
  const evidencePath =
    raw.evidencePath != null && String(raw.evidencePath).trim()
      ? String(raw.evidencePath).trim()
      : 'none';
  const impact = raw.impact != null ? String(raw.impact) : '';
  const at =
    isNonEmptyString(raw.at) && !Number.isNaN(Date.parse(String(raw.at)))
      ? String(raw.at).trim()
      : new Date().toISOString();

  if (Number.isNaN(Date.parse(at))) {
    throw new Error('decision entry at must be a valid ISO timestamp');
  }

  /** @type {DecisionEntry} */
  const entry = {
    id,
    category,
    decision,
    why,
    evidencePath,
    impact,
    at,
  };

  if (raw.phaseId != null && isNonEmptyString(raw.phaseId)) {
    entry.phaseId = String(raw.phaseId).trim();
  }
  if (raw.taskId != null && isNonEmptyString(raw.taskId)) {
    entry.taskId = String(raw.taskId).trim();
  }
  if (raw.actor != null && isNonEmptyString(raw.actor)) {
    entry.actor = String(raw.actor).trim();
  }
  if (Array.isArray(raw.relatedCommitShas)) {
    entry.relatedCommitShas = raw.relatedCommitShas.map((s) => String(s));
  }
  if (raw.notes != null) {
    entry.notes = String(raw.notes);
  }

  return entry;
}

/**
 * Resolve log file path from statusRoot+locator or a direct path.
 *
 * @param {string | {
 *   statusRoot?: string,
 *   projectId?: string,
 *   planSlug?: string,
 *   phaseId?: string,
 *   path?: string,
 * }} statusRootOrPath
 * @param {{ projectId?: string, planSlug?: string, phaseId?: string, path?: string }} [locator]
 * @returns {string}
 */
function resolveLogPath(statusRootOrPath, locator = {}) {
  if (statusRootOrPath != null && typeof statusRootOrPath === 'object') {
    if (isNonEmptyString(statusRootOrPath.path)) {
      return String(statusRootOrPath.path);
    }
    return decisionLogPath({
      statusRoot: statusRootOrPath.statusRoot,
      projectId: statusRootOrPath.projectId ?? locator.projectId,
      planSlug: statusRootOrPath.planSlug ?? locator.planSlug,
      phaseId: statusRootOrPath.phaseId ?? locator.phaseId,
    });
  }

  const asString = String(statusRootOrPath ?? '').trim();
  if (!asString) {
    throw new Error('appendDecision/listDecisions: path or statusRoot required');
  }

  if (isNonEmptyString(locator.path)) {
    return String(locator.path);
  }

  // Direct file path: absolute, ends with .jsonl, or already a decisions path
  if (
    isAbsolute(asString) ||
    asString.endsWith('.jsonl') ||
    asString.includes(`${join('decisions', '')}`) ||
    /decisions[/\\][^/\\]+\.jsonl$/i.test(asString)
  ) {
    return asString;
  }

  // Treat as statusRoot when locator has project/plan/phase
  if (locator.projectId && locator.planSlug && locator.phaseId) {
    return decisionLogPath({
      statusRoot: asString,
      projectId: locator.projectId,
      planSlug: locator.planSlug,
      phaseId: locator.phaseId,
    });
  }

  // Bare path string used as the log file itself
  return asString;
}

/**
 * Append a validated decision entry to the phase log.
 * Never stamps decision-review PASS.
 *
 * @param {string | {
 *   statusRoot?: string,
 *   projectId?: string,
 *   planSlug?: string,
 *   phaseId?: string,
 *   path?: string,
 * }} statusRootOrPath
 * @param {Partial<DecisionEntry> & Record<string, unknown>} entry
 * @param {{ projectId?: string, planSlug?: string, phaseId?: string, path?: string }} [locator]
 * @returns {{ ok: true, path: string, entry: DecisionEntry } | { ok: false, error: string }}
 */
export function appendDecision(statusRootOrPath, entry, locator) {
  try {
    const validated = validateDecisionEntry(entry);
    const path = resolveLogPath(statusRootOrPath, locator ?? {});
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(validated)}\n`, 'utf8');
    return { ok: true, path, entry: validated };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * List decision entries from a phase log (missing file → []).
 *
 * @param {string | {
 *   statusRoot?: string,
 *   projectId?: string,
 *   planSlug?: string,
 *   phaseId?: string,
 *   path?: string,
 * }} statusRootOrPath
 * @param {{
 *   projectId?: string,
 *   planSlug?: string,
 *   phaseId?: string,
 *   path?: string,
 *   category?: string,
 * }} [opts]
 * @returns {DecisionEntry[]}
 */
export function listDecisions(statusRootOrPath, opts = {}) {
  const path = resolveLogPath(statusRootOrPath, opts);
  if (!existsSync(path)) return [];

  const categoryFilter =
    opts.category != null && String(opts.category).trim()
      ? String(opts.category).trim().toLowerCase()
      : null;

  /** @type {DecisionEntry[]} */
  const out = [];
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj == null || typeof obj !== 'object') continue;
      // Never surface forged decisionReview as part of list contract
      if (
        Object.prototype.hasOwnProperty.call(obj, 'decisionReview') ||
        Object.prototype.hasOwnProperty.call(obj, 'decisionReviewStatus')
      ) {
        // Drop forbidden fields from returned view (read resilience)
        const {
          decisionReview: _dr,
          decisionReviewStatus: _drs,
          ...rest
        } = obj;
        if (categoryFilter) {
          const cat =
            rest.category != null
              ? String(rest.category).trim().toLowerCase()
              : '';
          if (cat !== categoryFilter) continue;
        }
        out.push(/** @type {DecisionEntry} */ (rest));
        continue;
      }
      if (categoryFilter) {
        const cat =
          obj.category != null ? String(obj.category).trim().toLowerCase() : '';
        if (cat !== categoryFilter) continue;
      }
      out.push(/** @type {DecisionEntry} */ (obj));
    } catch {
      /* skip corrupt lines */
    }
  }
  return out;
}
