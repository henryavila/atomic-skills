/**
 * Pure complex-task predicate for automate-mode review gates (design D6).
 *
 * complex = weight >= threshold (default 3)
 *        OR tags ∩ {destructive, decommission, drop, complex} ≠ ∅
 *        OR destructiveDiff === true
 *
 * No I/O. Shared by implement, phase-done hooks, and transitions.
 */

/** Default weight threshold for complex classification under automate. */
export const DEFAULT_COMPLEX_WEIGHT_THRESHOLD = 3;

/**
 * Tags that force complex classification (case-insensitive match).
 * @type {readonly string[]}
 */
export const COMPLEX_TAGS = Object.freeze([
  'destructive',
  'decommission',
  'drop',
  'complex',
]);

const COMPLEX_TAG_SET = new Set(COMPLEX_TAGS);

/**
 * Whether a task is "complex" and requires CROSS-MODEL REVIEW before close
 * under automate mode.
 *
 * @param {{
 *   weight?: number | null,
 *   tags?: string[] | null,
 *   destructiveDiff?: boolean | null,
 * } | null | undefined} task
 * @param {{ threshold?: number }} [options]
 * @returns {boolean}
 */
export function isComplexTask(task, options = {}) {
  if (task == null || typeof task !== 'object') {
    return false;
  }

  const threshold =
    options.threshold != null && Number.isFinite(Number(options.threshold))
      ? Number(options.threshold)
      : DEFAULT_COMPLEX_WEIGHT_THRESHOLD;

  if (task.destructiveDiff === true) {
    return true;
  }

  if (Array.isArray(task.tags)) {
    for (const raw of task.tags) {
      if (raw == null) continue;
      const tag = String(raw).trim().toLowerCase();
      if (COMPLEX_TAG_SET.has(tag)) {
        return true;
      }
    }
  }

  const weight = task.weight;
  if (weight != null && typeof weight === 'number' && Number.isFinite(weight)) {
    if (weight >= threshold) {
      return true;
    }
  }

  return false;
}
