/**
 * Pure phase evaluation gate (automate Step F → G HARD order).
 *
 * Under durable automate, phase-done must not run until the evaluation agent
 * has produced a disposition: pass, or skip with non-empty reason, or fail
 * with operator disposition accept|defer|fix recorded.
 *
 * Non-automate: gate inactive (allows close).
 * No I/O.
 */

import { isDurableAutomateActive } from './plan-end-review.js';

/**
 * Whether durable automate evaluation order applies (stamp-first).
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 * }} [input]
 * @returns {boolean}
 */
export function isDurableAutomateForEvaluation(input = {}) {
  return isDurableAutomateActive(input);
}

/**
 * @typedef {{
 *   status: 'passed' | 'skipped' | 'failed-dispositioned',
 *   verdict?: 'pass' | 'fail' | null,
 *   reason?: string | null,
 *   disposition?: 'accept' | 'defer' | 'fix' | null,
 *   verifiedAt?: string | null,
 *   at?: string | null,
 * }} EvaluationGate
 */

/**
 * Whether phase-done may proceed under the evaluation order (design D10/D13).
 *
 * When durable automate is off → true (gate inactive).
 * When on, **only** status === 'passed' && verdict === 'pass' → true.
 * Skip, failed-dispositioned (including accept/defer/fix residual), missing
 * gate → false. Evaluation is mandatory under the durable stamp; leave
 * automate via clearExecutionModeStamp if residual risk must be accepted.
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 *   evaluationGate?: EvaluationGate | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function phaseEvaluationAllowsClose(input = {}) {
  if (!isDurableAutomateForEvaluation(input)) {
    return { ok: true };
  }

  const gate = input.evaluationGate;
  if (gate == null || typeof gate !== 'object') {
    return {
      ok: false,
      reason:
        'automate requires evaluationGate before phase-done (run evaluation agent — skip is forbidden under durable automate)',
    };
  }

  const status =
    gate.status != null ? String(gate.status).trim().toLowerCase() : '';

  if (status === 'passed') {
    const verdict =
      gate.verdict != null ? String(gate.verdict).trim().toLowerCase() : '';
    if (verdict === 'pass') {
      return { ok: true };
    }
    return {
      ok: false,
      reason: 'evaluationGate status=passed requires verdict=pass',
    };
  }

  if (status === 'skipped') {
    return {
      ok: false,
      reason:
        'automate forbids evaluationGate status=skipped — evaluation is mandatory under durable stamp (clear executionMode to leave automate)',
    };
  }

  if (status === 'failed-dispositioned') {
    return {
      ok: false,
      reason:
        'automate forbids phase-done on failed-dispositioned evaluation — re-dispatch fix until evaluationGate status=passed verdict=pass (accept/defer residual requires clearing the automate stamp)',
    };
  }

  return {
    ok: false,
    reason: `unknown or missing evaluationGate.status: ${status || '(empty)'}`,
  };
}

/**
 * Immutable stamp helper for orchestrator after evaluation agent returns.
 * Does not mutate input.
 *
 * @param {Partial<EvaluationGate> & { status: EvaluationGate['status'] }} fields
 * @returns {EvaluationGate}
 */
export function buildEvaluationGate(fields) {
  if (fields == null || typeof fields !== 'object') {
    throw new Error('buildEvaluationGate: fields required');
  }
  const status = String(fields.status || '').trim().toLowerCase();
  if (
    status !== 'passed' &&
    status !== 'skipped' &&
    status !== 'failed-dispositioned'
  ) {
    throw new Error(
      `buildEvaluationGate: invalid status "${fields.status}" (passed|skipped|failed-dispositioned)`,
    );
  }
  /** @type {EvaluationGate} */
  const out = { status: /** @type {EvaluationGate['status']} */ (status) };
  if (fields.verdict != null) {
    out.verdict = /** @type {EvaluationGate['verdict']} */ (
      String(fields.verdict).trim().toLowerCase()
    );
  }
  if (fields.reason != null) out.reason = String(fields.reason);
  if (fields.disposition != null) {
    out.disposition = /** @type {EvaluationGate['disposition']} */ (
      String(fields.disposition).trim().toLowerCase()
    );
  }
  if (fields.verifiedAt != null) out.verifiedAt = String(fields.verifiedAt);
  if (fields.at != null) out.at = String(fields.at);
  return out;
}
