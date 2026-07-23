/**
 * Pure decision-review gate (automate operator PASS hardgate on phase-done).
 *
 * Under durable automate, phase-done must not run until the operator has
 * stamped decisionReview with status=passed (and verifiedAt). Agents never
 * write PASS without explicit operator provenance — this module only checks
 * the stamp shape; it does not stamp.
 *
 * Non-automate: gate inactive (allows phase-done) even if field absent.
 * No I/O.
 */

import { isDurableAutomateActive } from './plan-end-review.js';

/**
 * Whether durable automate decision-review order applies (stamp-first).
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 *   executionMode?: string | null,
 * }} [input]
 * @returns {boolean}
 */
export function isDurableAutomateForDecisionReview(input = {}) {
  const planExecutionMode =
    input.planExecutionMode != null
      ? input.planExecutionMode
      : input.executionMode != null
        ? input.executionMode
        : null;
  return isDurableAutomateActive({
    automateActive: input.automateActive,
    planExecutionMode,
  });
}

/**
 * @typedef {{
 *   status: 'pending' | 'passed' | 'failed',
 *   verifiedAt?: string | null,
 *   evidencePath?: string | null,
 *   at?: string | null,
 * }} DecisionReview
 */

/**
 * Whether phase-done may proceed under the decision-review order.
 *
 * When durable automate is off → ok true (gate inactive; field optional).
 * When on:
 *   - missing / non-object decisionReview → ok false
 *   - status !== 'passed' (pending|failed|unknown) → ok false
 *   - status === 'passed' without verifiedAt → ok false (recommended required)
 *   - status === 'passed' with verifiedAt → ok true
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 *   executionMode?: string | null,
 *   decisionReview?: DecisionReview | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function decisionReviewAllowsPhaseDone(input = {}) {
  if (!isDurableAutomateForDecisionReview(input)) {
    return { ok: true };
  }

  const review = input.decisionReview;
  if (review == null || typeof review !== 'object') {
    return {
      ok: false,
      reason:
        'automate requires decisionReview with status=passed before phase-done (operator PASS on decision log — agents never stamp PASS)',
    };
  }

  const status =
    review.status != null ? String(review.status).trim().toLowerCase() : '';

  if (status === 'passed') {
    const verifiedAt =
      review.verifiedAt != null ? String(review.verifiedAt).trim() : '';
    if (verifiedAt === '') {
      return {
        ok: false,
        reason:
          'decisionReview status=passed requires verifiedAt (operator PASS timestamp)',
      };
    }
    return { ok: true };
  }

  if (status === 'pending') {
    return {
      ok: false,
      reason:
        'automate forbids phase-done while decisionReview status=pending — await operator PASS on decision log',
    };
  }

  if (status === 'failed') {
    return {
      ok: false,
      reason:
        'automate forbids phase-done when decisionReview status=failed — do not advance currentPhase; re-open decision-review after fixes',
    };
  }

  return {
    ok: false,
    reason: `unknown or missing decisionReview.status: ${status || '(empty)'}`,
  };
}

/**
 * Immutable stamp helper for operator decision-review (orchestrator / host).
 * Does not mutate input. Does not authorize PASS — caller must have operator
 * token in the same turn before writing status=passed.
 *
 * @param {Partial<DecisionReview> & { status: DecisionReview['status'] }} fields
 * @returns {DecisionReview}
 */
export function buildDecisionReview(fields) {
  if (fields == null || typeof fields !== 'object') {
    throw new Error('buildDecisionReview: fields required');
  }
  const status = String(fields.status || '').trim().toLowerCase();
  if (status !== 'pending' && status !== 'passed' && status !== 'failed') {
    throw new Error(
      `buildDecisionReview: invalid status "${fields.status}" (pending|passed|failed)`,
    );
  }
  /** @type {DecisionReview} */
  const out = { status: /** @type {DecisionReview['status']} */ (status) };
  if (fields.verifiedAt != null) out.verifiedAt = String(fields.verifiedAt);
  if (fields.evidencePath != null) {
    out.evidencePath = String(fields.evidencePath);
  }
  if (fields.at != null) out.at = String(fields.at);
  return out;
}
