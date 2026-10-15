/**
 * Approved-plan orchestrator board and one tick.
 *
 * The host session is the orchestrator. A tick reads this board (disk is the
 * memory across wakeups), emits dispatch / merge / reverify / close actions,
 * and exits. It does not spawn, merge, run verifiers, or write product files.
 *
 * Not a daemon. The host's recurring wakeup calls the tick again.
 * `userValidatedAt` and `operatorOverride` are never produced here.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizePlanSlug, MAESTRO_CURSOR_DIR, MAX_REDISPATCH } from './maestro-cursor.js';
import { planApprovalAllowsImplement } from './plan-approval.js';

export { MAX_REDISPATCH };

/** Relative directory under statusRoot — same folder as the maestro cursor. */
export const ORCHESTRATOR_BOARD_DIR = MAESTRO_CURSOR_DIR;

const PART_STATUSES = new Set([
  'queued',
  'dispatched',
  'claimed',
  'merged',
  'review',
  'done',
  'blocked-human',
]);

const IN_FLIGHT = new Set(['dispatched', 'claimed', 'merged', 'review']);

/**
 * @param {string} statusRoot
 * @param {string} planSlug
 * @returns {string}
 */
export function boardPath(statusRoot, planSlug) {
  if (typeof statusRoot !== 'string' || statusRoot.trim() === '') {
    throw new Error('orchestrator-board: statusRoot is required');
  }
  const slug = sanitizePlanSlug(planSlug);
  return join(statusRoot, ORCHESTRATOR_BOARD_DIR, `${slug}.board.json`);
}

/**
 * @param {string} statusRoot
 * @param {string} planSlug
 * @returns {object | null}
 */
export function readBoard(statusRoot, planSlug) {
  const path = boardPath(statusRoot, planSlug);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * @param {string} statusRoot
 * @param {string} planSlug
 * @param {object} board
 */
export function writeBoard(statusRoot, planSlug, board) {
  const path = boardPath(statusRoot, planSlug);
  mkdirSync(join(statusRoot, ORCHESTRATOR_BOARD_DIR), { recursive: true });
  writeFileSync(path, `${JSON.stringify(board, null, 2)}\n`);
  return path;
}

/**
 * Build the part catalog from tasks the plan already has.
 * Does not invent ids. A task without paths and a verifier is not admitted.
 *
 * @param {Array<{
 *   id: string,
 *   deps?: string[],
 *   paths?: string[],
 *   verifier?: unknown,
 *   acceptance?: unknown[],
 *   scopeBoundary?: unknown[],
 * }> | null | undefined} tasks
 */
export function catalogFromTasks(tasks) {
  const parts = [];
  for (const task of tasks ?? []) {
    if (!task || typeof task.id !== 'string' || task.id.trim() === '') continue;
    const paths = Array.isArray(task.paths) ? task.paths.map(String) : [];
    const acceptance = Array.isArray(task.acceptance) ? task.acceptance : [];
    const scopeBoundary = Array.isArray(task.scopeBoundary) ? task.scopeBoundary : [];
    const verifier = task.verifier;
    const admitted = paths.length > 0
      && verifier != null
      && verifier !== ''
      && acceptance.length > 0
      && scopeBoundary.length > 0;
    parts.push({
      id: task.id,
      deps: Array.isArray(task.deps) ? task.deps.map(String) : [],
      paths,
      admitted,
      status: 'queued',
      redispatchCount: 0,
      verifierPassed: false,
      blockedReason: null,
    });
  }
  return parts;
}

/**
 * Exact text the user copies into a new session. One line: `/loop `, then
 * the whole orchestrator prompt. No interval. No newlines.
 *
 * @param {{ slug?: string, worktree?: string }} input
 */
export function orchestratorCard(input) {
  const slug = String(input?.slug ?? '').replace(/[\r\n]+/g, ' ');
  const worktree = String(input?.worktree ?? '').replace(/[\r\n]+/g, ' ');
  return `/loop You are the orchestrator for plan ${slug} in worktree ${worktree}. Read skills/shared/implement-orchestrator-tick.md and run one tick with scripts/orchestrator-tick.js. Dispatch only the printed actions. Do not edit product source. Do not write userValidatedAt. Do not print another /loop command. Exit when the tick finishes.`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normPath(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function pathsOverlap(a, b) {
  const as = (a ?? []).map(normPath).filter(Boolean);
  const bs = (b ?? []).map(normPath).filter(Boolean);
  for (const x of as) {
    for (const y of bs) {
      if (x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`)) return true;
    }
  }
  return false;
}

function partById(parts, id) {
  return parts.find((p) => p.id === id) ?? null;
}

function agentsFor(agents, partId) {
  return agents.filter((a) => a.partId === partId);
}

function occupiedPathLists(parts) {
  return parts
    .filter((p) => IN_FLIGHT.has(p.status))
    .map((p) => p.paths);
}

/**
 * @param {object} input
 * @returns {{
 *   ok: boolean,
 *   blocked: string | null,
 *   actions: object[],
 *   board: { parts: object[], agents: object[] },
 * }}
 */
export function orchestratorTick(input) {
  const planApprovedAt = input?.planApprovedAt ?? input?.plan?.planApprovedAt ?? null;
  const approval = planApprovalAllowsImplement({ planApprovedAt });
  const partsIn = Array.isArray(input?.parts) ? input.parts : null;
  const agentsIn = Array.isArray(input?.agents) ? input.agents : [];
  const human = input?.human && typeof input.human === 'object' ? input.human : {};

  if (!approval.ok) {
    return {
      ok: false,
      blocked: 'plan-not-approved',
      actions: [],
      board: {
        parts: partsIn ? clone(partsIn) : [],
        agents: clone(agentsIn),
      },
    };
  }
  if (!partsIn) {
    return {
      ok: false,
      blocked: 'invalid-snapshot',
      actions: [],
      board: { parts: [], agents: [] },
    };
  }

  const parts = clone(partsIn);
  const agents = clone(agentsIn);
  const actions = [];

  for (const part of parts) {
    if (!PART_STATUSES.has(part.status)) part.status = 'queued';
    if (typeof part.redispatchCount !== 'number') part.redispatchCount = 0;
    if (!Array.isArray(part.deps)) part.deps = [];
    if (!Array.isArray(part.paths)) part.paths = [];
    if (typeof part.admitted !== 'boolean') part.admitted = true;
  }

  if (human.tradeoff === true || human.scopeExit === true) {
    if (human.decisionReviewPassed !== true) {
      actions.push({ type: 'blocked-human', reason: 'decision-review' });
      return finish(true, 'decision-review', actions, parts, agents);
    }
  }
  if (human.openMajor === true && human.majorDisposition !== true) {
    actions.push({ type: 'blocked-human', reason: 'review-disposition' });
    return finish(true, 'review-disposition', actions, parts, agents);
  }

  const mergeCandidates = [];

  for (const part of parts) {
    if (part.status === 'done' || part.status === 'blocked-human') continue;
    const mine = agentsFor(agents, part.id);
    const worker = mine.find((a) => a.kind === 'implement' || a.kind === 'fix');
    const reviewer = mine.find((a) => a.kind === 'review');

    const dead = worker
      && worker.lease === true
      && worker.alive !== true
      && worker.claim !== true
      && (part.status === 'dispatched' || part.status === 'claimed');

    if (dead) {
      redispOrBlock(part, agents, actions, worker.kind === 'fix' ? 'fix' : 'implement', 'previous agent died without a claim');
      continue;
    }

    if (!worker && part.status === 'dispatched') {
      redispOrBlock(part, agents, actions, 'implement', 'dispatched part has no agent');
      continue;
    }

    if (worker && worker.claim === true && (part.status === 'dispatched' || part.status === 'claimed')) {
      mergeCandidates.push({ part, agent: worker });
      continue;
    }

    if (part.status === 'merged' || part.status === 'review') {
      if (!reviewer) {
        dispatch(part, agents, actions, 'review', 'Review the merged part. Do not edit product source.');
        part.status = 'review';
        continue;
      }
      const reviewUnobserved = reviewer.review == null
        && !(reviewer.lease === true && reviewer.alive !== true);
      if (reviewUnobserved) continue;
      if (reviewer.lease === true && reviewer.alive !== true && reviewer.review == null) {
        redispOrBlock(part, agents, actions, 'review', 'review agent died without a result');
        continue;
      }
      if (reviewer.review === 'clean' && part.verifierPassed !== true) {
        actions.push({ type: 'reverify', partId: part.id, verifier: part.verifier ?? null });
        continue;
      }
      if (reviewer.review === 'clean' && part.verifierPassed === true) {
        part.status = 'done';
        part.blockedReason = null;
        actions.push({ type: 'close', partId: part.id });
        continue;
      }
      if (reviewer.review === 'finding') {
        const text = typeof reviewer.finding === 'string' && reviewer.finding.trim() !== ''
          ? reviewer.finding.trim()
          : 'review finding';
        dropAgents(agents, part.id, 'review');
        redispOrBlock(part, agents, actions, 'fix', text);
      }
    }
  }

  mergeCandidates.sort((a, b) => (a.part.id < b.part.id ? -1 : a.part.id > b.part.id ? 1 : 0));
  if (mergeCandidates.length > 0) {
    const first = mergeCandidates[0];
    first.part.status = 'claimed';
    actions.push({ type: 'merge', partId: first.part.id, agentId: first.agent.id });
  }

  const chosen = [];
  const queued = parts
    .filter((p) => p.status === 'queued')
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const part of queued) {
    if (part.admitted === false || part.paths.length === 0) {
      part.status = 'blocked-human';
      part.blockedReason = 'part-not-admitted';
      actions.push({ type: 'blocked-human', reason: 'part-not-admitted', partId: part.id });
      continue;
    }
    const missingDep = part.deps.find((id) => !partById(parts, id));
    if (missingDep) {
      part.status = 'blocked-human';
      part.blockedReason = 'unknown-dep';
      actions.push({ type: 'blocked-human', reason: 'unknown-dep', partId: part.id, dep: missingDep });
      continue;
    }
    const depsDone = part.deps.every((id) => partById(parts, id)?.status === 'done');
    if (!depsDone) continue;
    const occupied = occupiedPathLists(parts).concat(chosen.map((p) => p.paths));
    if (occupied.some((paths) => pathsOverlap(paths, part.paths))) continue;
    dispatch(part, agents, actions, 'implement', `Implement part ${part.id}. Paths: ${part.paths.join(', ')}.`);
    part.status = 'dispatched';
    chosen.push(part);
  }

  if (parts.length > 0 && parts.every((p) => p.status === 'done')) {
    actions.push({ type: 'blocked-human', reason: 'await-user-validation' });
    return finish(true, 'await-user-validation', actions, parts, agents);
  }

  const blocked = actions.some((a) => a.type === 'blocked-human') ? 'blocked-human' : null;
  return finish(true, blocked, actions, parts, agents);
}

function redispOrBlock(part, agents, actions, kind, instruction) {
  if (part.redispatchCount >= MAX_REDISPATCH) {
    part.status = 'blocked-human';
    part.blockedReason = kind === 'fix' ? 'review-finding' : 'agent-dead';
    actions.push({
      type: 'blocked-human',
      reason: part.blockedReason,
      partId: part.id,
    });
    return;
  }
  part.redispatchCount += 1;
  dropAgents(agents, part.id, kind === 'review' ? 'review' : null);
  dispatch(part, agents, actions, kind, instruction);
  part.status = kind === 'review' ? 'review' : 'dispatched';
}

function dispatch(part, agents, actions, kind, instruction) {
  const agentId = `${kind}:${part.id}:${part.redispatchCount}`;
  agents.push({
    id: agentId,
    kind,
    partId: part.id,
    lease: false,
    alive: false,
    claim: false,
    review: null,
    finding: null,
  });
  actions.push({
    type: 'dispatch',
    kind,
    partId: part.id,
    agentId,
    instruction,
  });
}

function dropAgents(agents, partId, kind) {
  for (let i = agents.length - 1; i >= 0; i -= 1) {
    if (agents[i].partId !== partId) continue;
    if (kind && agents[i].kind !== kind) continue;
    agents.splice(i, 1);
  }
}

function finish(ok, blocked, actions, parts, agents) {
  return {
    ok,
    blocked,
    actions,
    board: { parts, agents },
  };
}
