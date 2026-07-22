/**
 * plan-quality-events.js — append-only JSONL for D9 measure (fail-open).
 * kinds: spine_quality_fail | fingerprint_refuse | phase_reopen | task_reopen
 */

import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const EVENT_KINDS = [
  'spine_quality_fail',
  'fingerprint_refuse',
  'phase_reopen',
  'task_reopen',
];

/**
 * @param {string} stateRoot e.g. .atomic-skills
 * @returns {string}
 */
export function defaultEventsPath(stateRoot) {
  return join(stateRoot, 'analytics', 'plan-quality.jsonl');
}

/**
 * @param {{ path?: string, stateRoot?: string, kind: string, planSlug?: string, phaseId?: string, meta?: object }} ev
 * @returns {{ ok: boolean, path?: string, error?: string }}
 */
export function appendPlanQualityEvent(ev) {
  try {
    if (!ev?.kind || !EVENT_KINDS.includes(ev.kind)) {
      return { ok: false, error: `invalid kind ${ev?.kind}` };
    }
    const path =
      ev.path ||
      defaultEventsPath(ev.stateRoot || join(process.cwd(), '.atomic-skills'));
    mkdirSync(dirname(path), { recursive: true });
    const row = {
      kind: ev.kind,
      planSlug: ev.planSlug ?? null,
      phaseId: ev.phaseId ?? null,
      ts: new Date().toISOString(),
      ...(ev.meta && typeof ev.meta === 'object' ? { meta: ev.meta } : {}),
    };
    appendFileSync(path, JSON.stringify(row) + '\n', 'utf8');
    return { ok: true, path };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * @param {string} path
 * @param {{ sinceMs?: number, windowDays?: number }} [opts]
 */
export function readPlanQualityEvents(path, opts = {}) {
  if (!existsSync(path)) return [];
  const windowDays = opts.windowDays ?? 14;
  const since =
    opts.sinceMs ?? Date.now() - windowDays * 86400 * 1000;
  const out = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      const t = Date.parse(obj.ts);
      if (!Number.isNaN(t) && t >= since) out.push(obj);
    } catch {
      /* skip */
    }
  }
  return out;
}

/**
 * @param {object[]} events
 * @returns {Record<string, number>}
 */
export function countByKind(events) {
  const counts = Object.fromEntries(EVENT_KINDS.map((k) => [k, 0]));
  for (const e of events) {
    if (counts[e.kind] != null) counts[e.kind] += 1;
  }
  return counts;
}
