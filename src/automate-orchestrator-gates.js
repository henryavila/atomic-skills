/**
 * Pure orchestrator hard-gates for implement --mode=automate (layer-1 runtime).
 *
 * Skill prose remains the maestro loop (spawn, wait, merge). These helpers are
 * the machine-checkable STOP points an agent (or future thin CLI) must call
 * before advancing — they do not spawn writers or run git.
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
 * Before phase-done under durable automate: evaluation gate must allow close.
 *
 * @param {Parameters<typeof phaseEvaluationAllowsClose>[0]} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canRunPhaseDone(input = {}) {
  return phaseEvaluationAllowsClose(input);
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
