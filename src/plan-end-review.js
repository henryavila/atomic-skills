/**
 * Pure plan-end review and user-validation predicates (design D7, D9, D12).
 *
 * planEndReviewOk =
 *   receipt exists
 *   AND (
 *     (
 *       count(succeeded family-different external legs) ≥ 1
 *       AND non-empty reviewFile
 *       AND mode is 'external-both' only (F5 — not bare 'both')
 *       AND non-empty verifiedAt (ISO preferred / Date.parse finite)
 *     )
 *     OR explicit skipPlanEndReview with non-empty reason
 *   )
 *
 * A leg counts ONLY when ALL of:
 *   - status === 'succeeded'
 *   - familyDifferent === true (strict boolean; missing is NOT true)
 *   - provider is a known external ('codex' | 'grok' | 'claude')
 *
 * userValidationOk: under automateActive === true, require a non-empty
 * ISO-8601-ish timestamp in userValidatedAt. When automate is not active
 * the gate does not apply (returns true). Stamp alone also activates via
 * durable plan-end resolution.
 *
 * automatePlanEndGatesOk durable HARD-BLOCK (F4): uses **stamp only**:
 *   durableAutomate = planExecutionMode === 'automate' OR automateActive === true
 * Session cliMode / clearExecutionMode do NOT disable finalize/archive gates
 * while the stamp remains automate. To leave the durable gate, call
 * `clearExecutionModeStamp` (remove stamp). Session `isAutomateActive` remains
 * for the maestro coding loop only — finalize/archive MUST use
 * `isDurableAutomateActive` (not session isAutomateActive alone).
 *
 * Finalize/archive under automate HARD-BLOCK unless BOTH planEndReviewOk
 * and userValidationOk are true (see automatePlanEndGatesOk). Receipt files
 * land under `.atomic-skills/reviews/` and are linked from the plan
 * `## Reviews` section; frontmatter may carry a machine-readable
 * `planEndReview` object (finalize-shaped receipt) plus `userValidatedAt`.
 *
 * No I/O.
 */

import { EXTERNAL_PROVIDER_ORDER } from './cross-model-host-default.js';

/**
 * Family-different external providers that count toward planEndReviewOk.
 * Single source: EXTERNAL_PROVIDER_ORDER (codex → grok → claude) — never `local`.
 */
export const KNOWN_EXTERNAL_PROVIDERS = EXTERNAL_PROVIDER_ORDER;

const KNOWN_EXTERNAL_PROVIDER_SET = new Set(KNOWN_EXTERNAL_PROVIDERS);

/** Modes accepted on a non-skip plan-end receipt (F5: external-both only). */
const PLAN_END_OK_MODES = new Set(['external-both']);

/**
 * Guided `--skip-plan-end-review` reason taxonomy (non-empty required).
 * Operators may use free-form reasons; these tokens are the recommended
 * vocabulary when zero family-different providers remain or residual risk
 * is accepted — never strand a plan without a durable reason.
 */
export const SKIP_PLAN_END_REASON_TAXONOMY = Object.freeze([
  'no-family-different-provider',
  'external-providers-unavailable',
  'operator-accepted-residual-risk',
  'single-external-leg-already-reviewed-at-phase',
]);

/**
 * Basic ISO-8601-ish: full date (YYYY-MM-DD) optionally with time (T...).
 * Rejects bare words like "ok"/"yes" and pure numeric strings.
 */
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}(?:[Tt ][\d:.+-Zz]+)?$/;

/**
 * @typedef {{
 *   provider?: 'codex' | 'grok' | string,
 *   status: 'succeeded' | 'failed' | 'skipped' | string,
 *   familyDifferent?: boolean,
 * }} PlanEndReviewLeg
 *
 * Finalize-shaped receipt: durable machine fields plus optional metadata
 * written by finalize/plan-end (`reviewFile`, `mode`, `range`, `verifiedAt`).
 * Extra keys are ignored by planEndReviewOk.
 *
 * @typedef {{
 *   legs?: PlanEndReviewLeg[],
 *   skipPlanEndReview?: boolean,
 *   skipReason?: string,
 *   reviewFile?: string,
 *   mode?: string,
 *   range?: string,
 *   verifiedAt?: string,
 * }} PlanEndReviewReceipt
 */

/**
 * Whether a single external review leg counts toward planEndReviewOk.
 * Fail-closed: requires succeeded + familyDifferent === true + known external provider.
 * @param {PlanEndReviewLeg | null | undefined} leg
 * @returns {boolean}
 */
function legCountsAsSucceededFamilyDifferent(leg) {
  if (leg == null || typeof leg !== 'object') return false;
  if (leg.status !== 'succeeded') return false;
  if (leg.familyDifferent !== true) return false;
  const provider = leg.provider != null ? String(leg.provider).trim().toLowerCase() : '';
  if (!KNOWN_EXTERNAL_PROVIDER_SET.has(provider)) return false;
  return true;
}

/**
 * Non-skip success path requires durable receipt shape fields.
 * @param {PlanEndReviewReceipt} receipt
 * @returns {boolean}
 */
function receiptShapeOk(receipt) {
  const reviewFile =
    receipt.reviewFile != null ? String(receipt.reviewFile).trim() : '';
  if (reviewFile === '') return false;

  const mode =
    receipt.mode != null ? String(receipt.mode).trim().toLowerCase() : '';
  if (!PLAN_END_OK_MODES.has(mode)) return false;

  const verifiedAt =
    receipt.verifiedAt != null ? String(receipt.verifiedAt).trim() : '';
  if (verifiedAt === '') return false;
  // ISO preferred; accept non-empty with finite Date.parse (v1).
  if (isIsoTimestamp(verifiedAt)) return true;
  return Number.isFinite(Date.parse(verifiedAt));
}

/**
 * Machine-checkable plan-end external review predicate (HARD-BLOCK finalize/archive).
 *
 * Accepts a bare receipt or a finalize-shaped object.
 * CLI flag name in skill prose: `--skip-plan-end-review` maps to
 * `skipPlanEndReview: true` + non-empty `skipReason` on the durable receipt.
 *
 * Non-skip path requires ≥1 succeeded family-different known-provider leg
 * AND non-empty reviewFile + mode === 'external-both' + non-empty verifiedAt.
 * Skip path needs only skipPlanEndReview + non-empty reason (legs/shape optional).
 *
 * @param {PlanEndReviewReceipt | null | undefined} receipt
 * @returns {boolean}
 */
export function planEndReviewOk(receipt) {
  if (receipt == null || typeof receipt !== 'object') {
    return false;
  }

  if (receipt.skipPlanEndReview === true) {
    const reason = receipt.skipReason;
    if (reason != null && String(reason).trim() !== '') {
      return true;
    }
  }

  const legs = Array.isArray(receipt.legs) ? receipt.legs : [];
  const succeededCount = legs.filter(legCountsAsSucceededFamilyDifferent).length;
  if (succeededCount >= 1 && receiptShapeOk(receipt)) {
    return true;
  }

  return false;
}

/**
 * Whether a string is a usable ISO-8601-ish timestamp for userValidatedAt.
 * @param {string} s
 * @returns {boolean}
 */
function isIsoTimestamp(s) {
  if (typeof s !== 'string') return false;
  const trimmed = s.trim();
  if (trimmed === '') return false;
  if (!ISO_TIMESTAMP_RE.test(trimmed)) return false;
  return Number.isFinite(Date.parse(trimmed));
}

/**
 * Resolve whether durable automate plan-end gates apply (F4).
 *
 * Durable HARD-BLOCK uses **stamp only** (plus legacy automateActive flag):
 *   durableAutomate =
 *     automateActive === true
 *     OR planExecutionMode === 'automate'
 *
 * Session cliMode / clearExecutionMode are IGNORED for finalize/archive.
 * To leave the durable gate: `clearExecutionModeStamp` must remove the stamp.
 * Session `isAutomateActive` remains for the maestro coding loop.
 *
 * @param {{
 *   automateActive?: boolean,
 *   planExecutionMode?: string | null,
 *   cliMode?: string | null,
 *   clearExecutionMode?: boolean,
 * }} input
 * @returns {boolean}
 */
/**
 * Durable automate for finalize/archive HARD-BLOCK (stamp-first).
 * Exported so skill prose and gates share one definition — never early-exit
 * finalize on session `isAutomateActive` alone while the stamp remains.
 *
 * @param {{
 *   automateActive?: boolean,
 *   planExecutionMode?: string | null,
 *   cliMode?: string | null,
 *   clearExecutionMode?: boolean,
 * }} [input]
 * @returns {boolean}
 */
export function isDurableAutomateActive(input = {}) {
  if (input.automateActive === true) {
    return true;
  }
  const stamp =
    input.planExecutionMode != null
      ? String(input.planExecutionMode).trim().toLowerCase()
      : '';
  return stamp === 'automate';
}

/** @deprecated use isDurableAutomateActive — same predicate */
function resolveDurableAutomateForGates(input = {}) {
  return isDurableAutomateActive(input);
}

/**
 * Operator validation gate before finalize/archive under automate.
 *
 * When automate is not active, returns true (gate does not apply).
 * Activation: automateActive === true, OR durable stamp planExecutionMode
 * automate (session CLI override does not disable — F4). Under automate,
 * userValidatedAt must be a non-empty ISO-8601-ish timestamp.
 *
 * @param {{
 *   automateActive?: boolean,
 *   planExecutionMode?: string | null,
 *   cliMode?: string | null,
 *   clearExecutionMode?: boolean,
 *   userValidatedAt?: string | null,
 *   validatorId?: string | null,
 * }} [input]
 * @returns {boolean}
 */
export function userValidationOk(input = {}) {
  if (!resolveDurableAutomateForGates(input)) {
    return true;
  }

  const at = input.userValidatedAt;
  if (at == null) return false;
  if (typeof at !== 'string') return false;
  return isIsoTimestamp(at);
}

/**
 * Combined finalize/archive gate under automate (design D7 + D9 + D12 / F4).
 *
 * When durable automate is not active, both sub-gates are inactive → ok: true.
 * Under durable automate (automateActive or stamp automate — **ignore** session
 * cliMode/clear for this gate), HARD-BLOCK unless planEndReviewOk(receipt)
 * AND userValidationOk.
 *
 * @param {{
 *   automateActive?: boolean,
 *   planExecutionMode?: string | null,
 *   cliMode?: string | null,
 *   clearExecutionMode?: boolean,
 *   receipt?: PlanEndReviewReceipt | null,
 *   userValidatedAt?: string | null,
 *   validatorId?: string | null,
 * }} [input]
 * @returns {{
 *   ok: boolean,
 *   planEndReviewOk: boolean,
 *   userValidationOk: boolean,
 * }}
 */
export function automatePlanEndGatesOk(input = {}) {
  if (!resolveDurableAutomateForGates(input)) {
    return {
      ok: true,
      planEndReviewOk: true,
      userValidationOk: true,
    };
  }

  const pe = planEndReviewOk(input.receipt);
  const uv = userValidationOk({
    automateActive: true,
    userValidatedAt: input.userValidatedAt,
    validatorId: input.validatorId,
  });
  return {
    ok: pe && uv,
    planEndReviewOk: pe,
    userValidationOk: uv,
  };
}
