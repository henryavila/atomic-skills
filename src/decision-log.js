/**
 * Pure / fs-scoped decision log for automate pure-maestro (F1).
 *
 * Append-only JSONL per phase under the plan tree. Agents append decision
 * entries only — no API stamps decision-review PASS (operator-only hardgate).
 * No network I/O. High-signal secret shapes are rejected; residual secret
 * hygiene remains caller duty (see secrets fence below).
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
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

/** Allowlist for path id segments (projectId / planSlug / phaseId). */
const PATH_SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

/**
 * High-signal secret shapes only — not a full DLP scanner.
 * Residual duty: callers must still avoid pasting secrets that do not match.
 * @type {readonly RegExp[]}
 */
const SECRET_SHAPE_RES = Object.freeze([
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bBearer\s+[A-Za-z0-9._\-+=/]{16,}\b/i,
  /\bAuthorization\s*:\s*\S+/i,
  /\bapi[_-]?key\s*[=:]\s*\S+/i,
  /\b[a-f0-9]{64}\b/i,
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
 * @param {string} name
 * @param {string} value
 */
function assertPathSegment(name, value) {
  if (
    !value ||
    !PATH_SEGMENT_RE.test(value) ||
    value.includes('..') ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('\0')
  ) {
    throw new Error(`decisionLogPath: invalid ${name}`);
  }
}

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
  assertPathSegment('projectId', projectId);
  assertPathSegment('planSlug', planSlug);
  assertPathSegment('phaseId', phaseId);

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
 * Reject high-signal secret shapes in free-text decision fields.
 * Residual caller duty: do not store secrets that evade these patterns.
 *
 * @param {string} field
 * @param {string} text
 */
function assertNoSecretShapes(field, text) {
  for (const re of SECRET_SHAPE_RES) {
    if (re.test(text)) {
      throw new Error(
        `decision entry ${field} rejected: high-signal secret shape (do not store secrets in the decision log; residual hygiene is caller duty)`,
      );
    }
  }
}

/**
 * Normalize and validate an entry. Throws on invalid input.
 * Never accepts or sets decisionReview PASS.
 *
 * Required (non-empty after trim): category, decision, why, impact.
 * evidencePath defaults to `'none'` only when omitted or null/undefined.
 * Invalid provided `at` throws (never silently replaced).
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
  if (!isNonEmptyString(raw.why)) {
    throw new Error('decision entry empty or missing why');
  }
  if (!isNonEmptyString(raw.impact)) {
    throw new Error('decision entry empty or missing impact');
  }

  const category = String(raw.category).trim();
  const decision = String(raw.decision).trim();
  const why = String(raw.why).trim();
  const impact = String(raw.impact).trim();

  const id = isNonEmptyString(raw.id) ? String(raw.id).trim() : randomUUID();

  // evidencePath defaults to 'none' only when omitted (null/undefined)
  let evidencePath;
  if (raw.evidencePath == null) {
    evidencePath = 'none';
  } else {
    const ep = String(raw.evidencePath).trim();
    if (!ep) {
      throw new Error(
        'decision entry evidencePath empty — omit the field to default to "none", or provide a path/URI',
      );
    }
    evidencePath = ep;
  }

  let at;
  if (Object.prototype.hasOwnProperty.call(raw, 'at') && raw.at != null) {
    const provided = String(raw.at).trim();
    if (!provided || Number.isNaN(Date.parse(provided))) {
      throw new Error('decision entry at must be a valid ISO timestamp');
    }
    at = provided;
  } else {
    at = new Date().toISOString();
  }

  if (Number.isNaN(Date.parse(at))) {
    throw new Error('decision entry at must be a valid ISO timestamp');
  }

  for (const [field, text] of [
    ['decision', decision],
    ['why', why],
    ['impact', impact],
  ]) {
    assertNoSecretShapes(field, text);
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
    const notes = String(raw.notes);
    assertNoSecretShapes('notes', notes);
    entry.notes = notes;
  }

  return entry;
}

/**
 * Ensure resolved file path stays under
 *   <statusRoot>/projects/<id>/<slug>/decisions/<phaseId>.jsonl
 * using absolute join + prefix check (sep-aware).
 *
 * @param {string} filePath
 * @param {string} statusRoot
 * @param {string} projectId
 * @param {string} planSlug
 * @returns {string} absolute resolved path
 */
function confineDecisionsPath(filePath, statusRoot, projectId, planSlug) {
  const absFile = resolve(filePath);
  const decisionsDir = resolve(
    join(statusRoot, 'projects', projectId, planSlug, 'decisions'),
  );
  const boundary = decisionsDir.endsWith(sep) ? decisionsDir : decisionsDir + sep;
  if (absFile !== decisionsDir && !absFile.startsWith(boundary)) {
    throw new Error(
      'resolveLogPath: path escapes decisions/ tree (statusRoot confinement)',
    );
  }
  if (!absFile.endsWith('.jsonl')) {
    throw new Error('resolveLogPath: decision log path must end with .jsonl');
  }
  return absFile;
}

/**
 * Resolve log file path from statusRoot+locator only.
 * Does not accept arbitrary write paths: construct via decisionLogPath
 * segments (projectId / planSlug / phaseId). Explicit `path` overrides that
 * escape the decisions/ tree are rejected.
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
  // Object form: prefer structured segments; reject escaping path overrides
  if (statusRootOrPath != null && typeof statusRootOrPath === 'object') {
    const projectId = statusRootOrPath.projectId ?? locator.projectId;
    const planSlug = statusRootOrPath.planSlug ?? locator.planSlug;
    const phaseId = statusRootOrPath.phaseId ?? locator.phaseId;
    const statusRoot =
      statusRootOrPath.statusRoot != null &&
      String(statusRootOrPath.statusRoot).trim()
        ? String(statusRootOrPath.statusRoot).trim()
        : join(process.cwd(), '.atomic-skills');

    if (projectId && planSlug && phaseId) {
      const expected = decisionLogPath({
        statusRoot,
        projectId,
        planSlug,
        phaseId,
      });
      const confined = confineDecisionsPath(
        expected,
        statusRoot,
        String(projectId).trim(),
        String(planSlug).trim(),
      );

      // Explicit path override only accepted if it resolves to the same confined path
      if (isNonEmptyString(statusRootOrPath.path) || isNonEmptyString(locator.path)) {
        const override = String(
          isNonEmptyString(statusRootOrPath.path)
            ? statusRootOrPath.path
            : locator.path,
        ).trim();
        const absOverride = resolve(override);
        if (absOverride !== confined) {
          throw new Error(
            'resolveLogPath: path override rejected — must match decisions/<phaseId>.jsonl under statusRoot (construct via decisionLogPath segments)',
          );
        }
      }
      return confined;
    }

    // path without full segments: reject (no arbitrary writes)
    if (isNonEmptyString(statusRootOrPath.path) || isNonEmptyString(locator.path)) {
      throw new Error(
        'resolveLogPath: arbitrary path rejected — provide projectId, planSlug, and phaseId (decisionLogPath segments only)',
      );
    }

    throw new Error(
      'appendDecision/listDecisions: projectId, planSlug, and phaseId are required',
    );
  }

  const asString = String(statusRootOrPath ?? '').trim();
  if (!asString) {
    throw new Error('appendDecision/listDecisions: path or statusRoot required');
  }

  // Explicit locator.path without segments is rejected
  if (isNonEmptyString(locator.path) && !(locator.projectId && locator.planSlug && locator.phaseId)) {
    throw new Error(
      'resolveLogPath: arbitrary path rejected — provide projectId, planSlug, and phaseId (decisionLogPath segments only)',
    );
  }

  // statusRoot string + locator segments
  if (locator.projectId && locator.planSlug && locator.phaseId) {
    const expected = decisionLogPath({
      statusRoot: asString,
      projectId: locator.projectId,
      planSlug: locator.planSlug,
      phaseId: locator.phaseId,
    });
    const confined = confineDecisionsPath(
      expected,
      asString,
      String(locator.projectId).trim(),
      String(locator.planSlug).trim(),
    );
    if (isNonEmptyString(locator.path)) {
      const absOverride = resolve(String(locator.path).trim());
      if (absOverride !== confined) {
        throw new Error(
          'resolveLogPath: path override rejected — must match decisions/<phaseId>.jsonl under statusRoot (construct via decisionLogPath segments)',
        );
      }
    }
    return confined;
  }

  // Bare absolute/relative file path without segments — no arbitrary writes
  if (
    isAbsolute(asString) ||
    asString.endsWith('.jsonl') ||
    asString.includes(`${sep}decisions${sep}`) ||
    /decisions[/\\][^/\\]+\.jsonl$/i.test(asString)
  ) {
    throw new Error(
      'resolveLogPath: arbitrary path rejected — provide projectId, planSlug, and phaseId (decisionLogPath segments only)',
    );
  }

  throw new Error(
    'appendDecision/listDecisions: projectId, planSlug, and phaseId are required with statusRoot',
  );
}

/**
 * Create parent dirs and ensure the log file exists with mode 0o600 when new.
 *
 * @param {string} path
 */
function ensureLogFile(path) {
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) {
    const fd = openSync(path, 'wx', 0o600);
    closeSync(fd);
  }
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
    ensureLogFile(path);
    appendFileSync(path, `${JSON.stringify(validated)}\n`, { encoding: 'utf8' });
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
