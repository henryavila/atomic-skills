/**
 * Pure phase work-order builder for implement --mode=automate (Layer 3).
 *
 * Builds a self-contained work-order from a phase initiative (frontmatter object
 * or already-parsed tasks list). Only **pending** / **active** SPEC-admitted
 * tasks of the phase are included. Fail closed if a candidate task is missing
 * required SPEC fields.
 *
 * No I/O. No git. No spawn.
 */

/** Open task statuses eligible for the work-order. */
const OPEN_TASK_STATUSES = new Set(['pending', 'active']);

/**
 * @typedef {{
 *   taskId: string,
 *   title?: string,
 *   status?: string,
 *   paths: string[],
 *   scopeBoundary: string[],
 *   acceptance: string[],
 *   verifier: { kind?: string, command?: string, expectExitCode?: number, [k: string]: unknown } | null,
 *   weight?: number | null,
 *   tags?: string[] | null,
 * }} WorkOrderTask
 *
 * @typedef {{
 *   planSlug: string,
 *   phaseId: string,
 *   initiativePath?: string | null,
 *   tasks: WorkOrderTask[],
 *   worktreePath?: string | null,
 *   writerBranch?: string | null,
 *   baseRef?: string | null,
 *   decisionLogPath?: string | null,
 *   projectId?: string | null,
 * }} PhaseWorkOrder
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function text(value) {
  return value != null && String(value).trim() !== '' ? String(value).trim() : '';
}

/**
 * @param {unknown} value
 * @returns {unknown[]}
 */
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Extract paths from task outputs[] or paths[].
 * @param {Record<string, unknown>} task
 * @returns {string[]}
 */
export function pathsFromTask(task) {
  if (task == null || typeof task !== 'object') return [];
  if (Array.isArray(task.paths)) {
    return task.paths
      .map((p) => (p != null && typeof p === 'object' && 'path' in p ? text(/** @type {{path?: unknown}} */ (p).path) : text(p)))
      .filter(Boolean);
  }
  const outputs = asArray(task.outputs);
  const out = [];
  for (const o of outputs) {
    if (o == null) continue;
    if (typeof o === 'string') {
      const p = text(o);
      if (p) out.push(p);
      continue;
    }
    if (typeof o === 'object' && 'path' in o) {
      const p = text(/** @type {{ path?: unknown }} */ (o).path);
      if (p) out.push(p);
    }
  }
  return out;
}

/**
 * Normalize scopeBoundary to string[].
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeScopeBoundary(raw) {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    const t = text(raw);
    return t ? [t] : [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => text(x)).filter(Boolean);
}

/**
 * Normalize acceptance to string[].
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeAcceptance(raw) {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    const t = text(raw);
    return t ? [t] : [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => {
    if (x != null && typeof x === 'object' && 'text' in /** @type {object} */ (x)) {
      return text(/** @type {{ text?: unknown }} */ (x).text);
    }
    return text(x);
  }).filter(Boolean);
}

/**
 * Normalize verifier object. Accepts string command or { kind, command, ... }.
 * @param {unknown} raw
 * @returns {{ kind?: string, command?: string, expectExitCode?: number, [k: string]: unknown } | null}
 */
export function normalizeVerifier(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const command = text(raw);
    return command ? { kind: 'shell', command } : null;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const kind = text(obj.kind) || 'shell';
  const command =
    text(obj.command) ||
    text(obj.runner) ||
    text(obj.pattern) ||
    '';
  /** @type {{ kind: string, command?: string, expectExitCode?: number, [k: string]: unknown }} */
  const out = { kind };
  if (command) out.command = command;
  if (obj.expectExitCode != null && Number.isFinite(Number(obj.expectExitCode))) {
    out.expectExitCode = Number(obj.expectExitCode);
  }
  // Preserve extra fields without mutating input
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'kind' || k === 'command' || k === 'expectExitCode') continue;
    if (!(k in out)) out[k] = v;
  }
  return out;
}

/**
 * Whether a task has the SPEC interior required for admission into a work-order.
 * Required: taskId, ≥1 path, scopeBoundary (array present — may be empty only if
 * explicitly provided as []), acceptance (≥1), verifier with runnable command.
 *
 * Fail closed: missing fields ⇒ not admitted.
 *
 * @param {unknown} task
 * @returns {{ ok: true, taskId: string } | { ok: false, taskId: string, reason: string }}
 */
export function isSpecAdmittedTask(task) {
  if (task == null || typeof task !== 'object') {
    return { ok: false, taskId: '?', reason: 'task is not an object' };
  }
  const t = /** @type {Record<string, unknown>} */ (task);
  const taskId = text(t.id) || text(t.taskId) || text(t.task_id);
  if (!taskId) {
    return { ok: false, taskId: '?', reason: 'missing taskId' };
  }
  const paths = pathsFromTask(t);
  if (paths.length === 0) {
    return { ok: false, taskId, reason: 'SPEC missing outputs/paths' };
  }
  // scopeBoundary must be present as array (may be empty DO-NOT list)
  if (!Object.prototype.hasOwnProperty.call(t, 'scopeBoundary') && !Object.prototype.hasOwnProperty.call(t, 'scope')) {
    return { ok: false, taskId, reason: 'SPEC missing scopeBoundary' };
  }
  const acceptance = normalizeAcceptance(t.acceptance);
  if (acceptance.length === 0) {
    return { ok: false, taskId, reason: 'SPEC missing acceptance' };
  }
  const verifier = normalizeVerifier(t.verifier);
  if (verifier == null || !text(verifier.command)) {
    return { ok: false, taskId, reason: 'SPEC missing verifier.command' };
  }
  return { ok: true, taskId };
}

/**
 * Task status is open for work-order inclusion.
 * @param {unknown} status
 * @returns {boolean}
 */
export function isOpenTaskStatus(status) {
  const s = text(status).toLowerCase();
  // Missing status treated as pending (common on freshly materialized tasks)
  if (s === '') return true;
  return OPEN_TASK_STATUSES.has(s);
}

/**
 * Build a phase work-order from initiative / options.
 *
 * Fail closed:
 * - missing planSlug / phaseId
 * - any open (pending/active) task that lacks SPEC interior
 * - zero open SPEC-admitted tasks when open tasks exist but none admit (still throws)
 *
 * Done/blocked/skipped tasks are excluded without failing.
 *
 * @param {{
 *   planSlug?: string,
 *   phaseId?: string,
 *   initiativePath?: string | null,
 *   initiative?: { tasks?: unknown[], phaseId?: string, parentPlan?: string, slug?: string, id?: string } | null,
 *   tasks?: unknown[] | null,
 *   worktreePath?: string | null,
 *   writerBranch?: string | null,
 *   baseRef?: string | null,
 *   decisionLogPath?: string | null,
 *   projectId?: string | null,
 * }} [input]
 * @returns {PhaseWorkOrder}
 */
export function buildPhaseWorkOrder(input = {}) {
  const planSlug = text(input.planSlug) || text(input.initiative?.parentPlan) || text(input.initiative?.slug);
  const phaseId =
    text(input.phaseId) ||
    text(input.initiative?.phaseId) ||
    text(input.initiative?.id);
  if (!planSlug) {
    throw new Error('buildPhaseWorkOrder: planSlug is required');
  }
  if (!phaseId) {
    throw new Error('buildPhaseWorkOrder: phaseId is required');
  }

  const rawTasks = Array.isArray(input.tasks)
    ? input.tasks
    : asArray(input.initiative?.tasks);

  /** @type {WorkOrderTask[]} */
  const tasks = [];
  /** @type {string[]} */
  const specErrors = [];

  for (const raw of rawTasks) {
    if (raw == null || typeof raw !== 'object') continue;
    const t = /** @type {Record<string, unknown>} */ (raw);
    const status = text(t.status).toLowerCase();
    if (!isOpenTaskStatus(status)) continue;

    const admitted = isSpecAdmittedTask(t);
    if (!admitted.ok) {
      specErrors.push(`${admitted.taskId}: ${admitted.reason}`);
      continue;
    }

    const paths = pathsFromTask(t);
    const scopeBoundary = normalizeScopeBoundary(
      Object.prototype.hasOwnProperty.call(t, 'scopeBoundary') ? t.scopeBoundary : t.scope,
    );
    const acceptance = normalizeAcceptance(t.acceptance);
    const verifier = normalizeVerifier(t.verifier);

    /** @type {WorkOrderTask} */
    const row = {
      taskId: admitted.taskId,
      paths,
      scopeBoundary,
      acceptance,
      verifier,
    };
    const title = text(t.title) || text(t.summary);
    if (title) row.title = title;
    if (status) row.status = status;
    if (t.weight != null && Number.isFinite(Number(t.weight))) {
      row.weight = Number(t.weight);
    }
    if (Array.isArray(t.tags)) {
      row.tags = t.tags.map((x) => text(x)).filter(Boolean);
    }
    tasks.push(row);
  }

  if (specErrors.length > 0) {
    throw new Error(
      `buildPhaseWorkOrder: open tasks missing SPEC (fail closed): ${specErrors.join('; ')}`,
    );
  }

  if (tasks.length === 0) {
    throw new Error(
      'buildPhaseWorkOrder: no open SPEC-admitted tasks (fail closed) — nothing to prepare for a phase writer',
    );
  }

  /** @type {PhaseWorkOrder} */
  const order = {
    planSlug,
    phaseId,
    tasks,
  };
  if (input.initiativePath != null && text(input.initiativePath)) {
    order.initiativePath = text(input.initiativePath);
  }
  if (input.worktreePath != null && text(input.worktreePath)) {
    order.worktreePath = text(input.worktreePath);
  }
  if (input.writerBranch != null && text(input.writerBranch)) {
    order.writerBranch = text(input.writerBranch);
  }
  if (input.baseRef != null && text(input.baseRef)) {
    order.baseRef = text(input.baseRef);
  }
  if (input.decisionLogPath != null && text(input.decisionLogPath)) {
    order.decisionLogPath = text(input.decisionLogPath);
  }
  if (input.projectId != null && text(input.projectId)) {
    order.projectId = text(input.projectId);
  }
  return order;
}

/**
 * Fill worktree / branch / baseRef placeholders on an existing work-order (pure).
 * Does not mutate input.
 *
 * @param {PhaseWorkOrder} order
 * @param {{
 *   worktreePath?: string | null,
 *   writerBranch?: string | null,
 *   baseRef?: string | null,
 *   decisionLogPath?: string | null,
 * }} fill
 * @returns {PhaseWorkOrder}
 */
export function withWorkOrderPlacement(order, fill = {}) {
  if (order == null || typeof order !== 'object') {
    throw new Error('withWorkOrderPlacement: order is required');
  }
  return {
    ...order,
    tasks: Array.isArray(order.tasks) ? order.tasks.map((t) => ({ ...t })) : [],
    worktreePath:
      fill.worktreePath != null && text(fill.worktreePath)
        ? text(fill.worktreePath)
        : order.worktreePath,
    writerBranch:
      fill.writerBranch != null && text(fill.writerBranch)
        ? text(fill.writerBranch)
        : order.writerBranch,
    baseRef:
      fill.baseRef != null && text(fill.baseRef)
        ? text(fill.baseRef)
        : order.baseRef,
    decisionLogPath:
      fill.decisionLogPath != null && text(fill.decisionLogPath)
        ? text(fill.decisionLogPath)
        : order.decisionLogPath,
  };
}
