/**
 * Pure phase evaluation gate (automate Step F → G HARD order).
 *
 * Under durable automate, phase-done must not run until the evaluation agent
 * has produced a disposition: pass, or skip with non-empty reason, or fail
 * with operator disposition accept|defer|fix recorded.
 *
 * Authenticity (R3 / F1):
 *   - status=passed requires verdict=pass AND non-empty reportPath
 *     (path to evaluationReport under .atomic-skills/reviews/ or documented path)
 *   - status=skipped requires operatorSkip===true AND non-empty reason
 *     (legacy retroactive skips are expressible ONLY via this pair — never
 *     silent skip-by-reason alone)
 *
 * Non-automate: gate inactive (allows close).
 * No I/O — reportPath is a non-empty string pointer; on-disk existence is
 * orchestrator/evaluator responsibility, not this pure helper.
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
 *   reportPath?: string | null,
 *   operatorSkip?: boolean | null,
 *   verifiedAt?: string | null,
 *   at?: string | null,
 * }} EvaluationGate
 */

/**
 * Pure honesty check for an evaluationGate object (no automate stamp).
 *
 * Shared by phaseEvaluationAllowsClose and GATE-R4 / checkEvaluationGate —
 * one definition; no divergent prose rules.
 *
 * Required-when (documented + enforced here):
 *   - passed → verdict === 'pass' AND non-empty reportPath
 *   - skipped → operatorSkip === true AND non-empty reason
 *     (migration: legacy silent skips become operatorSkip+reason only)
 *   - failed-dispositioned → disposition in accept|defer|fix AND non-empty reason
 *
 * @param {EvaluationGate | null | undefined} gate
 * @returns {{ ok: boolean, reason?: string }}
 */
export function evaluationGateHonesty(gate) {
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
    if (verdict !== 'pass') {
      return {
        ok: false,
        reason: 'evaluationGate status=passed requires verdict=pass',
      };
    }
    const reportPath =
      gate.reportPath != null ? String(gate.reportPath).trim() : '';
    if (reportPath === '') {
      return {
        ok: false,
        reason:
          'evaluationGate status=passed requires non-empty reportPath (evaluationReport pointer)',
      };
    }
    return { ok: true };
  }

  if (status === 'skipped') {
    // Legacy retroactive skips: ONLY expressible via operatorSkip:true + non-empty
    // reason. reason alone is forge-able and rejected under honesty (R3).
    const reason = gate.reason != null ? String(gate.reason).trim() : '';
    const operatorSkip = gate.operatorSkip === true;
    if (!operatorSkip) {
      return {
        ok: false,
        reason:
          'evaluationGate status=skipped requires operatorSkip=true (operator-owned; no silent/forged skip)',
      };
    }
    if (reason === '') {
      return {
        ok: false,
        reason:
          'evaluationGate status=skipped requires non-empty reason with operatorSkip=true',
      };
    }
    return { ok: true };
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
 * Whether phase-done may proceed under the evaluation order (design D10/D13).
 *
 * When durable automate is off → true.
 * When on → evaluationGateHonesty(gate) (default-on authenticity for automate).
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
  return evaluationGateHonesty(input.evaluationGate);
}

/**
 * Immutable stamp helper for orchestrator after evaluation agent returns.
 * Does not mutate input.
 *
 * Records reportPath / operatorSkip when provided (authenticity fields).
 * For status=passed, non-empty reportPath is required (forge-resistant stamp).
 * For status=skipped, operatorSkip must be true and reason non-empty.
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
  if (fields.reportPath != null) {
    out.reportPath = String(fields.reportPath).trim();
  }
  if (fields.operatorSkip != null) {
    out.operatorSkip = fields.operatorSkip === true;
  }
  if (fields.verifiedAt != null) out.verifiedAt = String(fields.verifiedAt);
  if (fields.at != null) out.at = String(fields.at);

  // Stamp-time authenticity: refuse forge-friendly partial stamps
  if (status === 'passed') {
    const rp = out.reportPath != null ? String(out.reportPath).trim() : '';
    if (rp === '') {
      throw new Error(
        'buildEvaluationGate: status=passed requires non-empty reportPath',
      );
    }
    out.reportPath = rp;
  }
  if (status === 'skipped') {
    if (out.operatorSkip !== true) {
      throw new Error(
        'buildEvaluationGate: status=skipped requires operatorSkip=true',
      );
    }
    const reason = out.reason != null ? String(out.reason).trim() : '';
    if (reason === '') {
      throw new Error(
        'buildEvaluationGate: status=skipped requires non-empty reason',
      );
    }
  }

  return out;
}
