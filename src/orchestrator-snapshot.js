/**
 * Build an orchestrator tick snapshot from a plan and its phase initiatives.
 * Pure. Does not read the disk. The CLI does that and passes the pieces in.
 */

import { catalogFromTasks } from './orchestrator-board.js';

/**
 * @param {object | null | undefined} frontmatter initiative frontmatter
 * @returns {object[]}
 */
export function tasksFromInitiativeFrontmatter(frontmatter) {
  const tasks = Array.isArray(frontmatter?.tasks) ? frontmatter.tasks : [];
  const out = [];
  for (const task of tasks) {
    if (!task || typeof task.id !== 'string' || task.id.trim() === '') continue;
    const paths = [];
    for (const output of task.outputs ?? []) {
      if (output && typeof output.path === 'string' && output.path.trim() !== '') {
        paths.push(output.path);
      }
    }
    out.push({
      id: task.id,
      status: task.status ?? 'pending',
      deps: Array.isArray(task.blockedBy) ? task.blockedBy.map(String) : [],
      paths,
      verifier: task.verifier ?? null,
      acceptance: Array.isArray(task.acceptance) ? task.acceptance : [],
      scopeBoundary: Array.isArray(task.scopeBoundary) ? task.scopeBoundary : [],
    });
  }
  return out;
}

/**
 * @param {{
 *   plan?: { planApprovedAt?: string | null } | null,
 *   tasks?: object[],
 *   board?: { parts?: object[], agents?: object[] } | null,
 *   lease?: { status?: string } | null,
 * }} input
 */
export function buildOrchestratorSnapshot(input) {
  const tasks = [];
  const seen = new Set();
  for (const task of input?.tasks ?? []) {
    if (!task || seen.has(task.id)) continue;
    seen.add(task.id);
    tasks.push(task);
  }

  const parts = catalogFromTasks(tasks);
  const byId = new Map(parts.map((part) => [part.id, part]));
  for (const task of tasks) {
    const part = byId.get(task.id);
    if (!part) continue;
    part.verifier = task.verifier ?? null;
    if (task.status === 'done') {
      part.status = 'done';
      part.blockedReason = null;
    } else if (task.status === 'blocked') {
      part.status = 'blocked-human';
      part.blockedReason = 'task-blocked';
    }
  }

  for (const saved of input?.board?.parts ?? []) {
    const part = byId.get(saved?.id);
    if (!part || part.status === 'done') continue;
    if (part.blockedReason === 'task-blocked') continue;
    if (typeof saved.status === 'string') part.status = saved.status;
    if (typeof saved.redispatchCount === 'number') part.redispatchCount = saved.redispatchCount;
    part.verifierPassed = saved.verifierPassed === true;
    part.blockedReason = saved.blockedReason ?? part.blockedReason ?? null;
  }

  const agents = [];
  for (const agent of input?.board?.agents ?? []) {
    const part = byId.get(agent?.partId);
    if (!part || part.status === 'done') continue;
    agents.push({ ...agent });
  }

  if (input?.lease?.status === 'active') {
    for (const agent of agents) {
      if (agent.kind !== 'implement' && agent.kind !== 'fix') continue;
      agent.lease = true;
      if (agent.alive == null) agent.alive = true;
    }
  }

  return {
    planApprovedAt: input?.plan?.planApprovedAt ?? null,
    parts,
    agents,
    human: {},
  };
}
