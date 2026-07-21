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
 * When durable automate is off → true.
 * When on:
 *   - status === 'passed' and verdict === 'pass' → true
 *   - status === 'skipped' and non-empty reason → true (rare; must be recorded)
 *   - status === 'failed-dispositioned' with disposition in accept|defer|fix
 *     and non-empty reason → true (operator owned residual)
 *   - otherwise → false
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
        'automate requires evaluationGate before phase-done (run evaluation agent, or record skip/disposition)',
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
    const reason = gate.reason != null ? String(gate.reason).trim() : '';
    if (reason !== '') return { ok: true };
    return {
      ok: false,
      reason: 'evaluationGate status=skipped requires non-empty reason',
    };
  }

  if (status === 'failed-dispositioned') {
    const disposition =
      gate.disposition != null
        ? String(gate.disposition).trim().toLowerCase()
        : '';
    const reason = gate.reason != null ? String(gate.reason).trim() : '';
    if (
      (disposition === 'accept' ||
        disposition === 'defer' ||
        disposition === 'fix') &&
      reason !== ''
    ) {
      return { ok: true };
    }
    return {
      ok: false,
      reason:
        'evaluationGate status=failed-dispositioned requires disposition accept|defer|fix and non-empty reason',
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
