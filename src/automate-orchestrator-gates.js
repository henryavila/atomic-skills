/**
 * Pure orchestrator hard-gates for implement --mode=automate (layer-1 runtime).
 *
 * Skill prose remains the maestro loop (spawn, wait, merge). These helpers are
 * the machine-checkable STOP points an agent (or future thin CLI) must call
 * before advancing — they do not spawn writers or run git.
 *
 * Claim-bound done under durable automate:
 *   - {@link canCloseTasksFromClaims} — validate claim report; reachability opt-in
 *   - {@link canDoneFromAutomateClaims} — claim + **reachability default true**
 *     for automate orchestrator `done` (missing/invalid/non-reachable ⇒ block)
 *   - complex path: `complexTaskAllowsDone` in `src/complex-task.js` (both
 *     receipt or operator disposition; non-complex ⇒ verifier-only)
 *
 * No I/O (except optional FS wrappers re-exported only via comment — call
 * writer-lease / claim-report directly for disk).
 */

import {
  isAutomateActive,
  hasAutomateStamp,
} from './implement-mode.js';
import {
  automatePlanEndGatesOk,
  isDurableAutomateActive,
} from './plan-end-review.js';
import { phaseEvaluationAllowsClose } from './phase-evaluation-gate.js';
import { phaseLessonsAllowsClose } from './phase-lessons-gate.js';
import { phaseReviewAllowsClose } from './phase-review-gate.js';
import { complexTaskAllowsDone } from './complex-task.js';
import {
  validateClaimReport,
  validateClaimReachability,
} from './claim-report.js';

/**
 * Should the pure-maestro spine (not Mode 1 Step 2) run this session?
 * Uses session isAutomateActive (CLI + stamp + clear).
 *
 * @param {Parameters<typeof isAutomateActive>[0]} [input]
 * @returns {boolean}
 */
export function shouldRunPureMaestro(input = {}) {
  return isAutomateActive(input);
}

/**
 * Pure lease-status gate (no FS). Pass `status` from `readLeaseResult(...).status`.
 * Blocking when status is anything other than `missing` (F5/F12).
 *
 * @param {{ leaseStatus?: string | null }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canSpawnPhaseWriter(input = {}) {
  const status =
    input.leaseStatus != null ? String(input.leaseStatus).trim().toLowerCase() : 'missing';
  if (status === 'missing' || status === '') {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `writer lease blocking (status=${status}) — refuse second spawn / resume`,
  };
}

/**
 * Before orchestrator done: claim report must validate; optional reachability.
 *
 * Low-level claim shape + exclusivity gate. Reachability is **opt-in** here
 * (`checkReachability === true`). For **automate claim-bound done** (default
 * reachability on), prefer {@link canDoneFromAutomateClaims}.
 *
 * @param {{
 *   claimReport?: unknown,
 *   reachableSet?: Iterable<string> | ((sha: string) => boolean) | null,
 *   checkReachability?: boolean,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string, claimValidation?: object }}
 */
export function canCloseTasksFromClaims(input = {}) {
  const report = input.claimReport;
  if (report == null) {
    return { ok: false, reason: 'missing claim report' };
  }
  const v = validateClaimReport(report);
  if (!v.ok) {
    return {
      ok: false,
      reason: (v.errors && v.errors.join('; ')) || 'invalid claim report',
      claimValidation: v,
    };
  }
  if (input.checkReachability === true) {
    const r = validateClaimReachability(report, input.reachableSet);
    if (!r.ok) {
      return {
        ok: false,
        reason: (r.errors && r.errors.join('; ')) || 'claim reachability failed',
        claimValidation: v,
      };
    }
  }
  return { ok: true, claimValidation: v };
}

/**
 * Claim-bound automate done (HARD under durable `executionMode: automate`).
 *
 * Requires a valid claim report (fields + multi-task exclusivity). **Post-merge
 * reachability defaults to true** — pass a reachable set / predicate after
 * merge settle, or set `checkReachability: false` only for pre-merge claim
 * shape checks. Missing / invalid / overlapping / non-reachable claims ⇒
 * refuse orchestrator `done` (claim-bound close).
 *
 * When `complexTasks` is provided (array of { task, reviewReceipt?, ... }),
 * each entry must pass {@link complexTaskAllowsDone} (complex → both receipt
 * or operator disposition). Omit the array to skip complex checks (shape-only).
 *
 * @param {{
 *   claimReport?: unknown,
 *   reachableSet?: Iterable<string> | ((sha: string) => boolean) | null,
 *   checkReachability?: boolean,
 *   complexTasks?: Array<{
 *     task?: object | null,
 *     reviewReceipt?: object | null,
 *     operatorSkip?: boolean | null,
 *     disposition?: string | null,
 *     reason?: string | null,
 *     complexOptions?: { threshold?: number | string },
 *   }> | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string, claimValidation?: object }}
 */
export function canDoneFromAutomateClaims(input = {}) {
  // Automate done: claim required + reachability on by default.
  const checkReachability = input.checkReachability !== false;
  const claim = canCloseTasksFromClaims({
    claimReport: input.claimReport,
    reachableSet: input.reachableSet,
    checkReachability,
  });
  if (!claim.ok) return claim;

  if (Array.isArray(input.complexTasks)) {
    for (let i = 0; i < input.complexTasks.length; i++) {
      const row = input.complexTasks[i];
      if (row == null || typeof row !== 'object') continue;
      const c = complexTaskAllowsDone(row);
      if (!c.ok) {
        return {
          ok: false,
          reason: c.reason || `complex task gate failed at index ${i}`,
          claimValidation: claim.claimValidation,
        };
      }
    }
  }
  return claim;
}

/**
 * Before phase-done under durable automate: evaluation + lessons + review both.
 *
 * Order: evaluation → lessons → phase review (mode both). Non-automate: inactive → ok.
 * Dogfood: pure-maestro must not skip distill, ratify, or cross-model phase review.
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 *   evaluationGate?: unknown,
 *   lessonsState?: string | null,
 *   lessonsPath?: string | null,
 *   noneReason?: string | null,
 *   reviewGate?: unknown,
 *   phase?: object | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canRunPhaseDone(input = {}) {
  const evalGate = phaseEvaluationAllowsClose(input);
  if (!evalGate.ok) return evalGate;
  const lessons = phaseLessonsAllowsClose(input);
  if (!lessons.ok) return lessons;
  return phaseReviewAllowsClose(input);
}

/**
 * Before finalize/archive: durable automate plan-end gates.
 *
 * @param {Parameters<typeof automatePlanEndGatesOk>[0]} [input]
 * @returns {ReturnType<typeof automatePlanEndGatesOk>}
 */
export function canFinalizeOrArchive(input = {}) {
  return automatePlanEndGatesOk(input);
}

/**
 * Snapshot of which durable automate bits are set (for status / debug).
 *
 * @param {{
 *   planExecutionMode?: string | null,
 *   cliMode?: string | null,
 *   clearExecutionMode?: boolean,
 *   plan?: { executionMode?: string | null } | null,
 * }} [input]
 */
export function automateModeSnapshot(input = {}) {
  const plan =
    input.plan != null
      ? input.plan
      : input.planExecutionMode != null
        ? { executionMode: input.planExecutionMode }
        : null;
  return {
    sessionAutomate: isAutomateActive(input),
    durableAutomate: isDurableAutomateActive(input),
    hasStamp: hasAutomateStamp(plan),
  };
}
