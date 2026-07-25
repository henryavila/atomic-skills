/**
 * Build complexTasks[] for canDoneFromAutomateClaims from initiative tasks
 * + optional receipts map (assert-automate-gate --gate done auto-load).
 *
 * No I/O. Receipts come from receiptsByTaskId or task.reviewReceipt /
 * task.complexReview on the initiative task object.
 */

import { isComplexTask } from './complex-task.js';

/**
 * @param {unknown} tasks
 * @returns {object[]}
 */
function asTaskList(tasks) {
  return Array.isArray(tasks) ? tasks.filter((t) => t != null && typeof t === 'object') : [];
}

/**
 * Resolve receipt for a task id from map or task fields.
 * @param {object} task
 * @param {Record<string, object> | null | undefined} receiptsByTaskId
 * @returns {object | null}
 */
export function receiptForTask(task, receiptsByTaskId) {
  const id = task.id != null ? String(task.id).trim() : '';
  if (id && receiptsByTaskId != null && typeof receiptsByTaskId === 'object') {
    const r = receiptsByTaskId[id];
    if (r != null && typeof r === 'object') return r;
  }
  if (task.reviewReceipt != null && typeof task.reviewReceipt === 'object') {
    return task.reviewReceipt;
  }
  if (task.complexReview != null && typeof task.complexReview === 'object') {
    return task.complexReview;
  }
  return null;
}

/**
 * Build complexTasks array for canDoneFromAutomateClaims.
 *
 * When claimTaskIds is provided, only those task ids are considered (claim
 * report tasks). Otherwise all initiative tasks are scanned.
 *
 * @param {{
 *   tasks?: unknown,
 *   claimTaskIds?: string[] | null,
 *   receiptsByTaskId?: Record<string, object> | null,
 *   complexOptions?: { threshold?: number | string },
 * }} [input]
 * @returns {Array<{
 *   task: object,
 *   reviewReceipt: object | null,
 *   taskId?: string,
 * }>}
 */
export function buildComplexTasksFromInitiative(input = {}) {
  const tasks = asTaskList(input.tasks);
  const idFilter =
    Array.isArray(input.claimTaskIds) && input.claimTaskIds.length > 0
      ? new Set(input.claimTaskIds.map((x) => String(x).trim()).filter(Boolean))
      : null;

  /** @type {Array<{ task: object, reviewReceipt: object | null, taskId?: string }>} */
  const out = [];
  for (const task of tasks) {
    const id = task.id != null ? String(task.id).trim() : '';
    if (idFilter && id && !idFilter.has(id)) continue;
    if (idFilter && !id) continue;

    if (!isComplexTask(task, input.complexOptions)) continue;

    const receipt = receiptForTask(task, input.receiptsByTaskId);
    out.push({
      task,
      reviewReceipt: receipt,
      ...(id ? { taskId: id } : {}),
    });
  }
  return out;
}

/**
 * Extract task ids from a claim report (envelope or tasks array).
 * @param {unknown} claimReport
 * @returns {string[]}
 */
export function claimTaskIdsFromReport(claimReport) {
  if (claimReport == null || typeof claimReport !== 'object') return [];
  const r = /** @type {Record<string, unknown>} */ (claimReport);
  const list = Array.isArray(r.tasks) ? r.tasks : Array.isArray(claimReport) ? claimReport : [];
  /** @type {string[]} */
  const ids = [];
  for (const t of list) {
    if (t == null || typeof t !== 'object') continue;
    const id = /** @type {Record<string, unknown>} */ (t).taskId;
    if (id != null && String(id).trim() !== '') ids.push(String(id).trim());
  }
  return ids;
}
