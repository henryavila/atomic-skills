/**
 * sidecar-age.js — opt-in revalidation prompt for old/large sidecars at materialize.
 * Age: capturedAt (ISO) → mtime of .source.json → plan.started.
 */

import { existsSync, statSync, readFileSync } from 'node:fs';

export const DEFAULT_MAX_AGE_DAYS = 14;
export const DEFAULT_MAX_TASKS = 12;

/**
 * @param {{ sidecarPath: string, planStarted?: string|null, now?: number, maxAgeDays?: number, maxTasks?: number }} opts
 * @returns {{ shouldPrompt: boolean, reasons: string[], ageDays: number|null, taskCount: number }}
 */
export function evaluateSidecarAge(opts) {
  const maxAgeDays = opts.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const maxTasks = opts.maxTasks ?? DEFAULT_MAX_TASKS;
  const now = opts.now ?? Date.now();
  const reasons = [];
  let ageDays = null;
  let taskCount = 0;
  let capturedMs = null;

  if (opts.sidecarPath && existsSync(opts.sidecarPath)) {
    try {
      const raw = JSON.parse(readFileSync(opts.sidecarPath, 'utf8'));
      taskCount = Array.isArray(raw.tasks) ? raw.tasks.length : 0;
      if (raw.capturedAt) {
        const t = Date.parse(raw.capturedAt);
        if (!Number.isNaN(t)) capturedMs = t;
      }
    } catch {
      /* ignore parse */
    }
    if (capturedMs == null) {
      try {
        capturedMs = statSync(opts.sidecarPath).mtimeMs;
      } catch {
        /* */
      }
    }
  }

  if (capturedMs == null && opts.planStarted) {
    const t = Date.parse(opts.planStarted);
    if (!Number.isNaN(t)) capturedMs = t;
  }

  if (capturedMs != null) {
    ageDays = (now - capturedMs) / (86400 * 1000);
    if (ageDays > maxAgeDays) {
      reasons.push(`age ${ageDays.toFixed(1)}d > ${maxAgeDays}d`);
    }
  }

  if (taskCount > maxTasks) {
    reasons.push(`taskCount ${taskCount} > ${maxTasks}`);
  }

  return {
    shouldPrompt: reasons.length > 0,
    reasons,
    ageDays,
    taskCount,
  };
}
