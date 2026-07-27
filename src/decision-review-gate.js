/**
 * Pure decision-review gate (automate operator PASS hardgate on phase-done).
 *
 * Under durable automate (session default automateActive OR plan stamp),
 * phase-done must not run until the operator has stamped decisionReview with
 * status=passed, verifiedAt, **and** package present evidence
 * (packagePresentedAt ISO and/or packagePath) — present-before-PASS /
 * read-before-PASS. Agents never write PASS without explicit operator
 * provenance — this module only checks the stamp shape; it does not stamp.
 *
 * Non-automate: gate inactive (allows phase-done) even if field absent.
 * No I/O.
 */

import { isDurableAutomateActive } from './plan-end-review.js';

/**
 * ISO-ish timestamp: Date.parse accepts AND looks like a calendar date
 * (contains 'T' or matches YYYY-MM-DD…). Rejects Date.parse false positives
 * like "0" or bare "x".
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isIsoishTimestamp(value) {
  if (typeof value !== 'string') return false;
  const provided = value.trim();
  if (!provided) return false;
  if (Number.isNaN(Date.parse(provided))) return false;
  return /T/.test(provided) || /^\d{4}-\d{2}-\d{2}/.test(provided);
}

/**
 * Whether durable automate decision-review order applies (stamp-first **or**
 * session automateActive — so first-session-before-stamp cannot skip
 * present-before-PASS under automate-default).
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
 * Package present-before-PASS evidence on decisionReview.
 * Accepts packagePresentedAt (ISO) and/or non-empty packagePath.
 *
 * @param {{
 *   packagePresentedAt?: string | null,
 *   packagePath?: string | null,
 * } | null | undefined} review
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function hasDecisionPackagePresentEvidence(review) {
  if (review == null || typeof review !== 'object') {
    return {
      ok: false,
      reason:
        'present-before-PASS requires packagePresentedAt (ISO) and/or packagePath on decisionReview (decision package present evidence)',
    };
  }
  const presentedAt =
    review.packagePresentedAt != null
      ? String(review.packagePresentedAt).trim()
      : '';
  const packagePath =
    review.packagePath != null ? String(review.packagePath).trim() : '';

  const hasPresentedAt = presentedAt !== '';
  const hasPath = packagePath !== '';

  if (!hasPresentedAt && !hasPath) {
    return {
      ok: false,
      reason:
        'present-before-PASS / read-before-PASS: decisionReview status=passed requires packagePresentedAt (ISO) and/or packagePath (decision package present evidence) — host must present decision package before operator PASS',
    };
  }

  if (hasPresentedAt && !isIsoishTimestamp(presentedAt)) {
    return {
      ok: false,
      reason:
        'decisionReview packagePresentedAt must be an ISO timestamp (YYYY-MM-DD or full ISO-8601) when provided',
    };
  }

  return { ok: true };
}

/**
 * @typedef {{
 *   status: 'pending' | 'passed' | 'failed',
 *   verifiedAt?: string | null,
 *   evidencePath?: string | null,
 *   at?: string | null,
 *   packagePresentedAt?: string | null,
 *   packagePath?: string | null,
 * }} DecisionReview
 */

/**
 * Whether phase-done may proceed under the decision-review order.
 *
 * When durable automate is off → ok true (gate inactive; field optional).
 * When on:
 *   - missing / non-object decisionReview → ok false
 *   - status !== 'passed' (pending|failed|unknown) → ok false
 *   - status === 'passed' without verifiedAt → ok false
 *   - status === 'passed' without package present evidence
 *     (packagePresentedAt ISO and/or packagePath) → ok false (fail closed)
 *   - status === 'passed' with verifiedAt + present evidence → ok true
 *
 * Session default (`automateActive: true`) without stamp also activates
 * (no-stamp first session cannot skip present-before-PASS).
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
    if (!isIsoishTimestamp(verifiedAt)) {
      return {
        ok: false,
        reason:
          'decisionReview status=passed requires verifiedAt as ISO timestamp (YYYY-MM-DD or full ISO-8601)',
      };
    }
    // present-before-PASS: fail closed without package present evidence
    const present = hasDecisionPackagePresentEvidence(review);
    if (!present.ok) {
      return { ok: false, reason: present.reason };
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
 * token in the same turn before writing status=passed. Under automate, PASS
 * stamps should include package present evidence (packagePresentedAt and/or
 * packagePath) so decisionReviewAllowsPhaseDone can pass.
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
  if (status === 'passed') {
    const verifiedAt =
      fields.verifiedAt != null ? String(fields.verifiedAt).trim() : '';
    if (verifiedAt === '') {
      throw new Error(
        'buildDecisionReview: status=passed requires non-empty verifiedAt (operator PASS timestamp)',
      );
    }
    if (!isIsoishTimestamp(verifiedAt)) {
      throw new Error(
        'buildDecisionReview: status=passed requires verifiedAt as ISO timestamp (YYYY-MM-DD or full ISO-8601)',
      );
    }
  }
  /** @type {DecisionReview} */
  const out = { status: /** @type {DecisionReview['status']} */ (status) };
  if (fields.verifiedAt != null) out.verifiedAt = String(fields.verifiedAt);
  if (fields.evidencePath != null) {
    out.evidencePath = String(fields.evidencePath);
  }
  if (fields.at != null) out.at = String(fields.at);
  if (fields.packagePresentedAt != null) {
    out.packagePresentedAt = String(fields.packagePresentedAt);
  }
  if (fields.packagePath != null) {
    out.packagePath = String(fields.packagePath);
  }
  return out;
}
