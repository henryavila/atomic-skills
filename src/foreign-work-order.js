/**
 * foreign-work-order.js — durable sidecar for implement-as-foreign lane.
 *
 * Sidecar is colocated with the source markdown:
 *   docs/cutover.md  →  docs/cutover.implement.yaml
 *
 * Pure helpers + optional fs read/write inject. Skill prose owns the loop;
 * this module owns schema shape, SPEC gap detection, and finalize/archive stamps.
 *
 * Terminal phases FINALIZE and ARCHIVE are first-class phase ids on the work
 * order (not promote-to-AS). Promote is an entry-time AskUserQuestion only.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import {
  foreignPlanBranch,
  slugFromSourcePath,
  workOrderSidecarPath,
} from './implement-target-kind.js';

export const WORK_ORDER_KIND = 'foreign-plan';
export const WORK_ORDER_SCHEMA_VERSION = '0.1';

/** Built-in terminal phase ids (always present after ensureTerminalPhases). */
export const PHASE_FINALIZE = 'FINALIZE';
export const PHASE_ARCHIVE = 'ARCHIVE';

/**
 * @typedef {object} ForeignTask
 * @property {string} id
 * @property {string} title
 * @property {'pending'|'active'|'done'|'blocked'} status
 * @property {{ path: string }[]} [outputs]
 * @property {string[]} [scopeBoundary]
 * @property {string[]} [acceptance]
 * @property {{ kind: string, command?: string, expectExitCode?: number, runner?: string, pattern?: string }|null} [verifier]
 * @property {object|null} [evidence]
 */

/**
 * @typedef {object} ForeignPhase
 * @property {string} id
 * @property {string} title
 * @property {'pending'|'active'|'done'} status
 * @property {ForeignTask[]} tasks
 * @property {boolean} [terminal] - true for FINALIZE / ARCHIVE
 */

/**
 * @typedef {object} ForeignWorkOrder
 * @property {string} kind
 * @property {string} schemaVersion
 * @property {string} sourcePath
 * @property {string} slug
 * @property {string} branch
 * @property {'active'|'finalizing'|'archived'} status
 * @property {string} currentPhase
 * @property {ForeignPhase[]} phases
 * @property {{ value?: string, doneWhen?: string, outOfScope?: string[] }} [intent]
 * @property {object|null} [groundTruth]
 * @property {object|null} [finalize]
 * @property {object|null} [archive]
 * @property {object|null} [handoff]
 * @property {string|null} [executionMode]
 * @property {string|null} [entryChoice] - always 'foreign' for this file
 */

function text(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * @param {object} opts
 * @param {string} opts.sourcePath
 * @param {string} [opts.slug]
 * @param {string} [opts.branch]
 * @param {ForeignPhase[]} [opts.phases]
 * @param {object} [opts.intent]
 * @returns {ForeignWorkOrder}
 */
export function createWorkOrder(opts = {}) {
  const sourcePath = text(opts.sourcePath) || 'plan.md';
  const slug = text(opts.slug) || slugFromSourcePath(sourcePath);
  const branch = text(opts.branch) || foreignPlanBranch(slug);
  const phases = ensureTerminalPhases(array(opts.phases).map(clonePhase));

  // First non-terminal phase is active when present
  const firstWork = phases.find((p) => !p.terminal);
  if (firstWork && phases.every((p) => p.status === 'pending' || p.terminal)) {
    firstWork.status = 'active';
  }

  return {
    kind: WORK_ORDER_KIND,
    schemaVersion: WORK_ORDER_SCHEMA_VERSION,
    sourcePath,
    slug,
    branch,
    status: 'active',
    currentPhase: firstWork?.id || PHASE_FINALIZE,
    phases,
    intent: opts.intent && typeof opts.intent === 'object' ? { ...opts.intent } : {},
    groundTruth: opts.groundTruth ?? null,
    finalize: null,
    archive: null,
    handoff: emptyHandoff(),
    executionMode: opts.executionMode ?? 'automate',
    entryChoice: 'foreign',
  };
}

function emptyHandoff() {
  return {
    narrative: '',
    decisionLog: '',
    nextAction: '',
    verbatimState: '',
    uncommitted: 'clean tree',
  };
}

function clonePhase(p) {
  return {
    id: text(p?.id) || 'P0',
    title: text(p?.title) || text(p?.id) || 'Phase',
    status: p?.status || 'pending',
    terminal: Boolean(p?.terminal),
    tasks: array(p?.tasks).map(cloneTask),
  };
}

function cloneTask(t) {
  return {
    id: text(t?.id) || 'T-001',
    title: text(t?.title) || text(t?.id) || 'Task',
    status: t?.status || 'pending',
    outputs: array(t?.outputs)
      .map((o) => (typeof o === 'string' ? { path: o } : { path: text(o?.path) }))
      .filter((o) => o.path),
    scopeBoundary: array(t?.scopeBoundary).map(String),
    acceptance: array(t?.acceptance).map(String),
    verifier: t?.verifier && typeof t.verifier === 'object' ? { ...t.verifier } : null,
    evidence: t?.evidence ?? null,
  };
}

/**
 * Ensure FINALIZE and ARCHIVE terminal phases exist (append if missing).
 * @param {ForeignPhase[]} phases
 * @returns {ForeignPhase[]}
 */
export function ensureTerminalPhases(phases) {
  const list = array(phases).map(clonePhase);
  const ids = new Set(list.map((p) => p.id));

  if (!ids.has(PHASE_FINALIZE)) {
    list.push({
      id: PHASE_FINALIZE,
      title: 'Finalize — validation, PR, intent vs delivered',
      status: 'pending',
      terminal: true,
      tasks: [
        {
          id: 'T-FINALIZE',
          title: 'Operator validates intent vs delivered; open/update PR if needed',
          status: 'pending',
          outputs: [],
          scopeBoundary: [],
          acceptance: [
            'Intent-vs-delivered surface presented to operator',
            'Operator explicit validation recorded',
          ],
          verifier: null,
          evidence: null,
        },
      ],
    });
  } else {
    const f = list.find((p) => p.id === PHASE_FINALIZE);
    if (f) f.terminal = true;
  }

  if (!ids.has(PHASE_ARCHIVE)) {
    list.push({
      id: PHASE_ARCHIVE,
      title: 'Archive — clean worktree, branch bookkeeping, terminal handoff',
      status: 'pending',
      terminal: true,
      tasks: [
        {
          id: 'T-ARCHIVE',
          title: 'Remove worktree, record branch disposition, stamp archived',
          status: 'pending',
          outputs: [],
          scopeBoundary: [],
          acceptance: [
            'Worktree removed or explicitly retained with reason',
            'Sidecar status is archived',
          ],
          verifier: null,
          evidence: null,
        },
      ],
    });
  } else {
    const a = list.find((p) => p.id === PHASE_ARCHIVE);
    if (a) a.terminal = true;
  }

  return list;
}

/**
 * SPEC gap list for a task (R-ORCH-23 spirit). Terminal phases may omit shell verifier.
 * @param {ForeignTask} task
 * @param {{ terminal?: boolean }} [ctx]
 * @returns {string[]} missing field names
 */
export function taskSpecGaps(task, ctx = {}) {
  const gaps = [];
  const t = task || {};
  const outputs = array(t.outputs).filter((o) => text(o?.path) || text(o));
  const acceptance = array(t.acceptance).filter((a) => text(String(a)));
  const verifier = t.verifier;

  if (!ctx.terminal) {
    if (outputs.length === 0) gaps.push('outputs');
    if (acceptance.length === 0) gaps.push('acceptance');
    if (!verifier || typeof verifier !== 'object' || !text(verifier.kind)) {
      gaps.push('verifier');
    } else if (
      verifier.kind === 'shell' &&
      !text(verifier.command)
    ) {
      gaps.push('verifier.command');
    }
    // scopeBoundary may be empty array (explicit "no exclusions") — not a gap
  }
  return gaps;
}

/**
 * @param {ForeignWorkOrder} wo
 * @returns {{ ready: boolean, gaps: Array<{ taskId: string, phaseId: string, missing: string[] }> }}
 */
export function admitReadiness(wo) {
  const gaps = [];
  for (const phase of array(wo?.phases)) {
    if (phase.terminal) continue;
    for (const task of array(phase.tasks)) {
      if (task.status === 'done') continue;
      const missing = taskSpecGaps(task, { terminal: false });
      if (missing.length) {
        gaps.push({ taskId: task.id, phaseId: phase.id, missing });
      }
    }
  }
  return { ready: gaps.length === 0, gaps };
}

/**
 * @param {ForeignWorkOrder} wo
 * @param {string} taskId
 * @param {object} evidence - must include passed: true for close
 * @returns {ForeignWorkOrder} new object
 */
export function markTaskDone(wo, taskId, evidence) {
  const next = structuredCloneWorkOrder(wo);
  let found = false;
  for (const phase of next.phases) {
    for (const task of phase.tasks) {
      if (task.id === taskId) {
        found = true;
        if (!evidence || evidence.passed !== true) {
          throw new Error(
            `markTaskDone: evidence.passed must be true for ${taskId} (never self-certify)`,
          );
        }
        task.status = 'done';
        task.evidence = { ...evidence, closedAt: evidence.closedAt || new Date().toISOString() };
      }
    }
    // Phase done when all tasks done
    if (
      phase.tasks.length > 0 &&
      phase.tasks.every((t) => t.status === 'done')
    ) {
      phase.status = 'done';
    }
  }
  if (!found) throw new Error(`markTaskDone: task not found: ${taskId}`);
  return next;
}

/**
 * Advance currentPhase to next pending non-done phase.
 * @param {ForeignWorkOrder} wo
 * @returns {ForeignWorkOrder}
 */
export function advanceCurrentPhase(wo) {
  const next = structuredCloneWorkOrder(wo);
  const cur = next.phases.find((p) => p.id === next.currentPhase);
  if (cur && cur.status !== 'done') {
    // stay until phase tasks complete
    return next;
  }
  const upcoming = next.phases.find((p) => p.status !== 'done');
  if (upcoming) {
    next.currentPhase = upcoming.id;
    if (upcoming.status === 'pending') upcoming.status = 'active';
    if (upcoming.id === PHASE_FINALIZE) next.status = 'finalizing';
  }
  return next;
}

/**
 * Stamp finalize receipt (operator-owned validation).
 * @param {ForeignWorkOrder} wo
 * @param {{ userValidatedAt: string, intentVsDelivered?: object[], prUrl?: string|null, packagePresentedAt?: string }} stamp
 * @returns {ForeignWorkOrder}
 */
export function stampFinalize(wo, stamp = {}) {
  if (!text(stamp.userValidatedAt)) {
    throw new Error('stampFinalize: userValidatedAt is required (operator-owned)');
  }
  const next = structuredCloneWorkOrder(wo);
  next.finalize = {
    userValidatedAt: stamp.userValidatedAt,
    intentVsDelivered: array(stamp.intentVsDelivered),
    prUrl: stamp.prUrl ?? null,
    packagePresentedAt: stamp.packagePresentedAt || stamp.userValidatedAt,
  };
  next.status = 'finalizing';
  const phase = next.phases.find((p) => p.id === PHASE_FINALIZE);
  if (phase) {
    phase.status = 'done';
    for (const t of phase.tasks) {
      t.status = 'done';
      t.evidence = {
        passed: true,
        kind: 'operator-validation',
        userValidatedAt: stamp.userValidatedAt,
      };
    }
  }
  next.currentPhase = PHASE_ARCHIVE;
  const arch = next.phases.find((p) => p.id === PHASE_ARCHIVE);
  if (arch && arch.status === 'pending') arch.status = 'active';
  return next;
}

/**
 * Stamp archive + optional worktree cleanup notes. No promote-to-AS.
 * @param {ForeignWorkOrder} wo
 * @param {{
 *   archivedAt?: string,
 *   worktreeRemoved?: boolean,
 *   worktreePath?: string|null,
 *   branchDisposition?: string,
 *   note?: string,
 * }} stamp
 * @returns {ForeignWorkOrder}
 */
export function stampArchive(wo, stamp = {}) {
  const next = structuredCloneWorkOrder(wo);
  if (!next.finalize?.userValidatedAt) {
    throw new Error('stampArchive: finalize must be stamped first (userValidatedAt)');
  }
  next.archive = {
    archivedAt: stamp.archivedAt || new Date().toISOString(),
    worktreeRemoved: Boolean(stamp.worktreeRemoved),
    worktreePath: stamp.worktreePath ?? null,
    branchDisposition: text(stamp.branchDisposition) || 'retained',
    note: text(stamp.note) || '',
  };
  next.status = 'archived';
  const phase = next.phases.find((p) => p.id === PHASE_ARCHIVE);
  if (phase) {
    phase.status = 'done';
    for (const t of phase.tasks) {
      t.status = 'done';
      t.evidence = {
        passed: true,
        kind: 'archive',
        ...next.archive,
      };
    }
  }
  if (next.handoff) {
    next.handoff.nextAction = 'foreign plan archived — reopen requires explicit operator intent';
  }
  return next;
}

/**
 * @param {ForeignWorkOrder} wo
 * @param {object} handoff fields
 * @returns {ForeignWorkOrder}
 */
export function updateHandoff(wo, handoff = {}) {
  const next = structuredCloneWorkOrder(wo);
  next.handoff = {
    ...emptyHandoff(),
    ...(next.handoff || {}),
    ...handoff,
  };
  return next;
}

/**
 * @param {ForeignWorkOrder} wo
 * @param {object} receipt ground-truth receipt summary
 * @returns {ForeignWorkOrder}
 */
export function stampGroundTruth(wo, receipt) {
  const next = structuredCloneWorkOrder(wo);
  next.groundTruth = receipt && typeof receipt === 'object' ? { ...receipt } : null;
  return next;
}

/**
 * Serialize work order to YAML string.
 * @param {ForeignWorkOrder} wo
 * @returns {string}
 */
export function serializeWorkOrder(wo) {
  return stringifyYaml(wo);
}

/**
 * @param {string} yamlText
 * @returns {ForeignWorkOrder}
 */
export function parseWorkOrder(yamlText) {
  const raw = parseYaml(String(yamlText || ''));
  if (!raw || typeof raw !== 'object') {
    throw new Error('parseWorkOrder: invalid YAML object');
  }
  if (raw.kind && raw.kind !== WORK_ORDER_KIND) {
    throw new Error(`parseWorkOrder: unexpected kind ${raw.kind}`);
  }
  return createWorkOrder({
    sourcePath: raw.sourcePath,
    slug: raw.slug,
    branch: raw.branch,
    phases: raw.phases,
    intent: raw.intent,
    groundTruth: raw.groundTruth,
    executionMode: raw.executionMode,
  });
}

/**
 * Load/parse preserving finalize/archive/handoff/status from disk better than createWorkOrder.
 * @param {string} yamlText
 * @returns {ForeignWorkOrder}
 */
export function loadWorkOrder(yamlText) {
  const raw = parseYaml(String(yamlText || ''));
  if (!raw || typeof raw !== 'object') {
    throw new Error('loadWorkOrder: invalid YAML object');
  }
  const base = createWorkOrder({
    sourcePath: raw.sourcePath,
    slug: raw.slug,
    branch: raw.branch,
    phases: raw.phases,
    intent: raw.intent,
    groundTruth: raw.groundTruth,
    executionMode: raw.executionMode,
  });
  // createWorkOrder resets terminal phases; merge raw phase statuses/tasks more carefully
  if (Array.isArray(raw.phases) && raw.phases.length) {
    base.phases = ensureTerminalPhases(raw.phases.map(clonePhase));
  }
  base.status = raw.status || base.status;
  base.currentPhase = raw.currentPhase || base.currentPhase;
  base.finalize = raw.finalize ?? null;
  base.archive = raw.archive ?? null;
  base.handoff = raw.handoff && typeof raw.handoff === 'object' ? { ...emptyHandoff(), ...raw.handoff } : emptyHandoff();
  base.groundTruth = raw.groundTruth ?? null;
  base.entryChoice = 'foreign';
  return base;
}

function structuredCloneWorkOrder(wo) {
  return loadWorkOrder(serializeWorkOrder(wo));
}

/**
 * Next pending work task (skips terminal until work phases done).
 * @param {ForeignWorkOrder} wo
 * @returns {{ phase: ForeignPhase, task: ForeignTask }|null}
 */
export function nextPendingWorkTask(wo) {
  for (const phase of array(wo?.phases)) {
    if (phase.terminal) continue;
    for (const task of array(phase.tasks)) {
      if (task.status === 'pending' || task.status === 'active') {
        return { phase, task };
      }
    }
  }
  return null;
}

/**
 * Whether all non-terminal work is done (ready for FINALIZE).
 * @param {ForeignWorkOrder} wo
 * @returns {boolean}
 */
export function workPhasesComplete(wo) {
  return array(wo?.phases)
    .filter((p) => !p.terminal)
    .every(
      (p) =>
        p.status === 'done' ||
        (array(p.tasks).length > 0 && array(p.tasks).every((t) => t.status === 'done')),
    );
}

export { workOrderSidecarPath, slugFromSourcePath, foreignPlanBranch };
