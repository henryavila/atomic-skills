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
 * phase-done under durable automate (order, all required):
 *   evaluation → lessons → phase review (both) → decisionReview
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
import { decisionReviewAllowsPhaseDone } from './decision-review-gate.js';
import { complexTaskAllowsDone } from './complex-task.js';
import {
  validateClaimReport,
  validateClaimReachability,
} from './claim-report.js';
import { planTreeProductFenceOk } from './automate-product-fence.js';

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
 * Host-thin spawn also requires the active phase to be **materialized** (initiative
 * file present — not descriptor-only). Use {@link canSpawnHostThinPhaseWriter}
 * (or pass `initiativePresent` / `phaseMaterialized` here) before Step C spawn.
 *
 * @param {{
 *   leaseStatus?: string | null,
 *   initiativePresent?: boolean | null,
 *   phaseMaterialized?: boolean | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canSpawnPhaseWriter(input = {}) {
  const status =
    input.leaseStatus != null ? String(input.leaseStatus).trim().toLowerCase() : 'missing';
  if (status !== 'missing' && status !== '') {
    return {
      ok: false,
      reason: `writer lease blocking (status=${status}) — refuse second spawn / resume`,
    };
  }
  // Optional materialization probe: only enforced when the caller supplies it.
  // assert-automate-gate --gate spawn always supplies initiativePresent.
  const materialization = resolvePhaseMaterialized(input);
  if (materialization === false) {
    return {
      ok: false,
      reason:
        'descriptor-only phase — active phase initiative file missing; run project materialize before spawn',
    };
  }
  return { ok: true };
}

/**
 * @param {{
 *   initiativePresent?: boolean | null,
 *   phaseMaterialized?: boolean | null,
 * }} input
 * @returns {boolean | null} true/false when known; null when not provided
 */
function resolvePhaseMaterialized(input) {
  if (input.initiativePresent != null) return Boolean(input.initiativePresent);
  if (input.phaseMaterialized != null) return Boolean(input.phaseMaterialized);
  return null;
}

/**
 * Host-thin preconditions for pure-maestro Step C spawn (pure, no FS / no network).
 *
 * Requires:
 * 1. **Lease clean** — `leaseStatus` missing (same as {@link canSpawnPhaseWriter})
 * 2. **Phase materialized** — initiative file present (`initiativePresent` /
 *    `phaseMaterialized` must be true; false = descriptor-only refuse)
 *
 * Unlike bare {@link canSpawnPhaseWriter}, this sibling **always** requires an
 * explicit materialization flag (missing flag ⇒ refuse as unknown / not
 * materialized). Layer-2 CLI `scripts/assert-automate-gate.js --gate spawn`
 * probes the initiative path on disk and feeds this helper.
 *
 * @param {{
 *   leaseStatus?: string | null,
 *   initiativePresent?: boolean | null,
 *   phaseMaterialized?: boolean | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canSpawnHostThinPhaseWriter(input = {}) {
  const materialization = resolvePhaseMaterialized(input);
  if (materialization == null) {
    return {
      ok: false,
      reason:
        'host-thin spawn requires phase materialized probe (initiativePresent|phaseMaterialized) — refuse unknown / descriptor-only risk',
    };
  }
  return canSpawnPhaseWriter({
    leaseStatus: input.leaseStatus,
    initiativePresent: materialization,
    phaseMaterialized: materialization,
  });
}

/**
 * Before orchestrator done: claim report must validate; optional reachability.
 * When `requireAllClaimedPass` is true (done gate), every task must be
 * claimed-pass with exitCode === 0, or a closed non-open status (blocked|skipped).
 * claimed-fail never satisfies the done gate.
 *
 * Low-level claim shape + exclusivity gate. Reachability is **opt-in** here
 * (`checkReachability === true`). For **automate claim-bound done** (default
 * reachability on), prefer {@link canDoneFromAutomateClaims}.
 *
 * @param {{
 *   claimReport?: unknown,
 *   reachableSet?: Iterable<string> | ((sha: string) => boolean) | null,
 *   checkReachability?: boolean,
 *   requireAllClaimedPass?: boolean,
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
  if (input.requireAllClaimedPass === true) {
    const tasks = Array.isArray(/** @type {{ tasks?: unknown }} */ (report).tasks)
      ? /** @type {{ tasks: object[] }} */ (report).tasks
      : [];
    for (const task of tasks) {
      const raw =
        task?.status != null ? String(task.status).trim().toLowerCase() : '';
      // omit / empty defaults to claimed-pass open in claim-report validation
      const status = raw === '' ? 'claimed-pass' : raw;
      if (status === 'blocked' || status === 'skipped') continue;
      if (status !== 'claimed-pass') {
        return {
          ok: false,
          reason: `done gate requires claimed-pass (got status=${status || '(empty)'} for task ${task?.taskId ?? '?'})`,
          claimValidation: v,
        };
      }
      if (task.exitCode !== 0) {
        return {
          ok: false,
          reason: `done gate requires exitCode === 0 for claimed-pass (task ${task?.taskId ?? '?'})`,
          claimValidation: v,
        };
      }
    }
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
 * **Plan-tree product fence (B):** when `planBranchDiffPaths` is provided (path
 * list injected by CLI from `git diff --name-only <baseRef>..HEAD`), every
 * product path in that diff must appear in claim `paths[]` /
 * `claimPaths` — otherwise refuse done. State paths under `.atomic-skills/`
 * never trip the fence. When `requireProductFence: true` (durable stamp
 * assert `--gate done`), omitting `planBranchDiffPaths` fails closed.
 *
 * Claim-pass bound: always passes `requireAllClaimedPass: true` to
 * {@link canCloseTasksFromClaims} — `claimed-fail` never satisfies done.
 *
 * @param {{
 *   claimReport?: unknown,
 *   reachableSet?: Iterable<string> | ((sha: string) => boolean) | null,
 *   checkReachability?: boolean,
 *   requireProductFence?: boolean,
 *   complexTasks?: Array<{
 *     task?: object | null,
 *     reviewReceipt?: object | null,
 *     operatorSkip?: boolean | null,
 *     disposition?: string | null,
 *     reason?: string | null,
 *     complexOptions?: { threshold?: number | string },
 *   }> | null,
 *   planBranchDiffPaths?: Iterable<string> | null,
 *   claimPaths?: Iterable<string> | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string, claimValidation?: object, productFence?: object }}
 */
export function canDoneFromAutomateClaims(input = {}) {
  // Automate done: claim required + reachability on by default.
  // Done is claim-pass-bound: claimed-fail never satisfies this gate.
  const checkReachability = input.checkReachability !== false;
  const claim = canCloseTasksFromClaims({
    claimReport: input.claimReport,
    reachableSet: input.reachableSet,
    checkReachability,
    requireAllClaimedPass: true,
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

  // Product fence (B): when requireProductFence is true (durable stamp done),
  // planBranchDiffPaths MUST be injected — omit is fail-closed. When false/omit
  // and paths provided, still evaluate fence.
  const requireFence = input.requireProductFence === true;
  if (requireFence && input.planBranchDiffPaths == null) {
    return {
      ok: false,
      reason:
        'plan-tree product fence required: inject planBranchDiffPaths (CLI --base-ref or --plan-diff-file)',
      claimValidation: claim.claimValidation,
    };
  }
  if (input.planBranchDiffPaths != null) {
    const fence = planTreeProductFenceOk({
      planBranchDiffPaths: input.planBranchDiffPaths,
      claimPaths: input.claimPaths,
      claimReport: input.claimReport,
    });
    if (!fence.ok) {
      return {
        ok: false,
        reason: fence.reason || 'plan-tree product fence failed',
        claimValidation: claim.claimValidation,
        productFence: fence,
      };
    }
    return {
      ok: true,
      claimValidation: claim.claimValidation,
      productFence: fence,
    };
  }

  return claim;
}

/** Operator disposition tokens for open major findings (review-disposition). */
export const MAJOR_DISPOSITION_TOKENS = Object.freeze([
  'accept',
  'defer',
  'fix',
]);

const MAJOR_DISPOSITION_SET = new Set(MAJOR_DISPOSITION_TOKENS);

/**
 * Open major findings require an explicit operator disposition token before
 * phase-done under automate (F4).
 *
 * - Tokens: **accept** | **defer** | **fix** (review-disposition category)
 * - **Decline ≠ accept:** AskUserQuestion decline/cancel is not a disposition;
 *   host judgment "accept" after decline fails closed
 * - No open majors → ok (gate inactive)
 *
 * Pure — does not write decision log; caller must append review-disposition.
 *
 * @param {{
 *   openMajorFindings?: unknown[] | null,
 *   majorFindings?: unknown[] | null,
 *   disposition?: string | null,
 *   operatorDisposition?: string | null,
 *   askUserQuestionDeclined?: boolean | null,
 *   declined?: boolean | null,
 *   hostJudgmentAccept?: boolean | null,
 *   hostAcceptAfterDecline?: boolean | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function majorDispositionAllowsClose(input = {}) {
  const findingsRaw = input.openMajorFindings ?? input.majorFindings;
  const findings = Array.isArray(findingsRaw) ? findingsRaw : [];
  if (findings.length === 0) {
    return { ok: true };
  }

  const declined =
    input.askUserQuestionDeclined === true || input.declined === true;
  if (declined) {
    return {
      ok: false,
      reason:
        'open major findings: AskUserQuestion decline is not accept — re-Ask disposition accept|defer|fix or STOP (decline ≠ accept)',
    };
  }

  if (
    input.hostJudgmentAccept === true ||
    input.hostAcceptAfterDecline === true
  ) {
    return {
      ok: false,
      reason:
        'open major findings: host judgment accept after decline fails gate — disposition must be operator token accept|defer|fix (decline ≠ accept)',
    };
  }

  const raw =
    input.disposition != null
      ? input.disposition
      : input.operatorDisposition != null
        ? input.operatorDisposition
        : null;
  const disposition =
    raw != null ? String(raw).trim().toLowerCase() : '';

  if (!MAJOR_DISPOSITION_SET.has(disposition)) {
    return {
      ok: false,
      reason:
        'open major findings block phase-done without review-disposition accept|defer|fix token from operator',
    };
  }

  return { ok: true };
}

/**
 * Before phase-done under durable automate:
 * evaluation → lessons → phase review (both) → major disposition (when open)
 * → decisionReview.
 *
 * Non-automate: inactive helpers return ok. Does not stamp any field.
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 *   executionMode?: string | null,
 *   evaluationGate?: import('./phase-evaluation-gate.js').EvaluationGate | null,
 *   lessonsState?: string | null,
 *   lessonsPath?: string | null,
 *   noneReason?: string | null,
 *   reviewGate?: unknown,
 *   phase?: object | null,
 *   decisionReview?: import('./decision-review-gate.js').DecisionReview | null,
 *   openMajorFindings?: unknown[] | null,
 *   majorFindings?: unknown[] | null,
 *   disposition?: string | null,
 *   operatorDisposition?: string | null,
 *   askUserQuestionDeclined?: boolean | null,
 *   declined?: boolean | null,
 *   hostJudgmentAccept?: boolean | null,
 *   hostAcceptAfterDecline?: boolean | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canRunPhaseDone(input = {}) {
  const planExecutionMode =
    input.planExecutionMode != null
      ? input.planExecutionMode
      : input.executionMode != null
        ? input.executionMode
        : null;
  const base = {
    automateActive: input.automateActive,
    planExecutionMode,
    executionMode: input.executionMode,
  };

  const evalResult = phaseEvaluationAllowsClose({
    ...base,
    evaluationGate: input.evaluationGate,
  });
  if (!evalResult.ok) return evalResult;

  const lessons = phaseLessonsAllowsClose({
    ...base,
    lessonsState: input.lessonsState,
    lessonsPath: input.lessonsPath,
    noneReason: input.noneReason,
    phase: input.phase,
  });
  if (!lessons.ok) return lessons;

  const review = phaseReviewAllowsClose({
    ...base,
    reviewGate: input.reviewGate,
    phase: input.phase,
  });
  if (!review.ok) return review;

  // F4: open major findings require operator disposition token before phase-done.
  const major = majorDispositionAllowsClose({
    openMajorFindings: input.openMajorFindings,
    majorFindings: input.majorFindings,
    disposition: input.disposition,
    operatorDisposition: input.operatorDisposition,
    askUserQuestionDeclined: input.askUserQuestionDeclined,
    declined: input.declined,
    hostJudgmentAccept: input.hostJudgmentAccept,
    hostAcceptAfterDecline: input.hostAcceptAfterDecline,
  });
  if (!major.ok) return major;

  return decisionReviewAllowsPhaseDone({
    ...base,
    decisionReview: input.decisionReview,
  });
}

/**
 * Before finalize/archive: durable automate plan-end gates.
 *
 * Under automate (stamp and/or automateActive), requires planEndReviewOk with
 * forbidSkip — including non-empty `intentVsDelivered` rows (F2 intent-vs-delivered:
 * status matched|partial|missing|extra) — AND operator-owned userValidationOk.
 * Skip path stays HARD-CLOSED. Session clear alone does not open finalize while
 * the stamp remains.
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
