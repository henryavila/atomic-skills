/**
 * tasks-fingerprint.js — canonical hash of initiative/sidecar tasks *core*
 * (SPEC interior). Used by materialize-state to refuse publish when the
 * initiative rewrites core relative to the live sidecar.
 *
 * Core fields: id, title (normalized), files/outputs paths, scopeBoundary,
 * acceptance, verifier (kind+command). Allowlist (summary, weight, status,
 * businessIntent, startedCommit, nextAction, rollups, evidence) is excluded.
 */

import { createHash } from 'node:crypto';

/** Fields that may change at materialize without refuse. */
export const ALLOWLIST_TASK_KEYS = new Set([
  'summary',
  'weight',
  'status',
  'lastUpdated',
  'closedAt',
  'started',
  'evidence',
  'description',
  'notes',
  'tags',
  'blockedBy',
  'blocks',
  'provenance',
  'context',
]);

/**
 * @param {string} title
 * @returns {string}
 */
export function normalizeTitle(title) {
  return String(title ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Extract sorted file paths from a task (outputs[].path or files[] legacy).
 * @param {object} task
 * @returns {string[]}
 */
export function extractFilePaths(task) {
  const paths = [];
  if (Array.isArray(task?.outputs)) {
    for (const o of task.outputs) {
      if (o && typeof o.path === 'string' && o.path.trim()) paths.push(o.path.trim());
    }
  }
  if (Array.isArray(task?.files)) {
    for (const f of task.files) {
      if (typeof f === 'string' && f.trim()) paths.push(f.trim());
      else if (f && typeof f.path === 'string') paths.push(f.path.trim());
    }
  }
  return [...new Set(paths)].sort();
}

function normalizeStringList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => (typeof x === 'string' ? x.trim() : JSON.stringify(x)))
    .filter(Boolean)
    .sort();
}

/**
 * Canonical verifier shape for hashing.
 * @param {object|null|undefined} v
 * @returns {{ kind: string, command: string } | null}
 */
export function canonicalizeVerifier(v) {
  if (!v || typeof v !== 'object') return null;
  const kind = String(v.kind || '').toLowerCase();
  const command = String(v.command || v.cmd || v.pattern || v.sql || '').trim();
  return { kind, command };
}

/**
 * Core projection of one task for hashing.
 * @param {object} task
 * @returns {object}
 */
export function taskCore(task) {
  return {
    id: String(task?.id ?? ''),
    title: normalizeTitle(task?.title),
    files: extractFilePaths(task || {}),
    scopeBoundary: normalizeStringList(task?.scopeBoundary),
    acceptance: normalizeStringList(task?.acceptance),
    verifier: canonicalizeVerifier(task?.verifier),
  };
}

/**
 * Stable JSON for hashing (sorted keys at top level of each core object via fixed order).
 * @param {object[]} tasks
 * @returns {string}
 */
export function canonicalTasksCoreJson(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const cores = list.map(taskCore).sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(cores);
}

/**
 * @param {object[]} tasks
 * @returns {string} hex sha256
 */
export function hashTasksCore(tasks) {
  return createHash('sha256').update(canonicalTasksCoreJson(tasks), 'utf8').digest('hex');
}

/**
 * Compare two task lists on core only.
 * @returns {{ match: boolean, sidecarHash: string, initiativeHash: string }}
 */
export function compareTasksCore(sidecarTasks, initiativeTasks) {
  const sidecarHash = hashTasksCore(sidecarTasks);
  const initiativeHash = hashTasksCore(initiativeTasks);
  return { match: sidecarHash === initiativeHash, sidecarHash, initiativeHash };
}

/**
 * Diff summary for refuse messages (ids that diverge).
 * @returns {string[]}
 */
export function listCoreMismatches(sidecarTasks, initiativeTasks) {
  const a = new Map((sidecarTasks || []).map((t) => [String(t.id), taskCore(t)]));
  const b = new Map((initiativeTasks || []).map((t) => [String(t.id), taskCore(t)]));
  const ids = new Set([...a.keys(), ...b.keys()]);
  const mismatches = [];
  for (const id of [...ids].sort()) {
    const ca = JSON.stringify(a.get(id) ?? null);
    const cb = JSON.stringify(b.get(id) ?? null);
    if (ca !== cb) mismatches.push(id || '(missing-id)');
  }
  return mismatches;
}
