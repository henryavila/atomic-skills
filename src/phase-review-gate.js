/**
 * Pure phase-done review gate under durable automate (cross-model both).
 *
 * Dogfood: pure-maestro stamped reviewGate.mode=local with narrative override
 * and skipped real --mode=both. Under automate, phase-done default is both;
 * local/skip only with explicit operator-owned reason (same pattern as
 * phaseReviewMode overrideReason).
 *
 * Non-automate: inactive (allows close) — commitGuard still requires a complete
 * reviewGate when requireReview is true.
 *
 * No I/O — reviewFile is a non-empty string pointer when status=passed.
 */

import { isDurableAutomateActive } from './plan-end-review.js';

/** Modes that satisfy automate phase-done cross-model default. */
export const AUTOMATE_PHASE_BOTH_MODES = Object.freeze([
  'both',
  'both-codex',
  'both-grok',
  'both-claude',
  'external-both', // stricter than both; also satisfies
]);

const BOTH_SET = new Set(AUTOMATE_PHASE_BOTH_MODES);

const GIT_SHA_RE = /^[0-9a-f]{7,40}$/i;

/**
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 * }} [input]
 * @returns {boolean}
 */
export function isDurableAutomateForPhaseReview(input = {}) {
  return isDurableAutomateActive(input);
}

/**
 * @typedef {{
 *   status?: string | null,
 *   mode?: string | null,
 *   at?: string | null,
 *   reviewFile?: string | null,
 *   reason?: string | null,
 *   operatorSkip?: boolean | null,
 *   overrideReason?: string | null,
 *   verifiedAt?: string | null,
 * }} ReviewGate
 */

/**
 * Pure honesty for a phase reviewGate under automate (no stamp check).
 *
 * @param {ReviewGate | null | undefined} gate
 * @returns {{ ok: boolean, reason?: string }}
 */
export function phaseReviewHonesty(gate) {
  if (gate == null || typeof gate !== 'object') {
    return {
      ok: false,
      reason:
        'automate requires reviewGate before phase-done (run review-code --mode=both, or operator skip with reason)',
    };
  }

  const status =
    gate.status != null ? String(gate.status).trim().toLowerCase() : '';

  if (status === 'passed') {
    const mode = gate.mode != null ? String(gate.mode).trim().toLowerCase() : '';
    if (!BOTH_SET.has(mode)) {
      // local without operator override reason is the dogfood skip
      if (mode === 'local') {
        const override =
          gate.overrideReason != null
            ? String(gate.overrideReason).trim()
            : gate.reason != null
              ? String(gate.reason).trim()
              : '';
        // Under automate honesty, local is only ok with non-empty operator reason
        // AND we still prefer both — dogfood used reason as fig leaf for skip.
        // Product decision: local + non-empty overrideReason is allowed as
        // explicit downgrade (phaseReviewMode); but require operatorSkip-style
        // flag? Design says override with reason. Accept local only with
        // non-empty reason that is not empty.
        if (override === '') {
          return {
            ok: false,
            reason:
              'automate phase-done default is review mode both; local requires non-empty overrideReason (operator-owned downgrade)',
          };
        }
        // Allow explicit local downgrade with reason (operator-owned)
        const at = gate.at != null ? String(gate.at).trim() : '';
        if (!GIT_SHA_RE.test(at)) {
          return {
            ok: false,
            reason:
              'reviewGate status=passed requires real git SHA at (even for local override)',
          };
        }
        const reviewFile =
          gate.reviewFile != null ? String(gate.reviewFile).trim() : '';
        if (reviewFile === '') {
          return {
            ok: false,
            reason:
              'reviewGate status=passed requires non-empty reviewFile under automate',
          };
        }
        return { ok: true };
      }
      return {
        ok: false,
        reason: `automate phase-done requires reviewGate.mode both (or both-*/external-both); got ${mode || 'missing'}`,
      };
    }
    const at = gate.at != null ? String(gate.at).trim() : '';
    if (!GIT_SHA_RE.test(at)) {
      return {
        ok: false,
        reason: 'reviewGate status=passed requires real git SHA at',
      };
    }
    const reviewFile =
      gate.reviewFile != null ? String(gate.reviewFile).trim() : '';
    if (reviewFile === '') {
      return {
        ok: false,
        reason:
          'reviewGate status=passed requires non-empty reviewFile under automate (durable receipt)',
      };
    }
    return { ok: true };
  }

  if (status === 'skipped') {
    const reason = gate.reason != null ? String(gate.reason).trim() : '';
    // Prefer operatorSkip true; also accept non-empty reason alone for skip
    // (GATE-R3), but under automate require operatorSkip === true to match
    // evaluation skip authenticity.
    if (gate.operatorSkip !== true) {
      return {
        ok: false,
        reason:
          'reviewGate status=skipped under automate requires operatorSkip=true + non-empty reason',
      };
    }
    if (reason === '') {
      return {
        ok: false,
        reason:
          'reviewGate status=skipped requires non-empty reason under automate',
      };
    }
    return { ok: true };
  }

  return {
    ok: false,
    reason: `unknown or missing reviewGate.status: ${status || '(empty)'}`,
  };
}

/**
 * Whether phase-done may proceed under automate review policy.
 * Non-automate → ok (inactive).
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 *   reviewGate?: ReviewGate | null,
 *   phase?: { reviewGate?: ReviewGate | null } | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function phaseReviewAllowsClose(input = {}) {
  if (!isDurableAutomateForPhaseReview(input)) {
    return { ok: true };
  }
  const gate =
    input.reviewGate != null
      ? input.reviewGate
      : input.phase != null && typeof input.phase === 'object'
        ? input.phase.reviewGate
        : null;
  return phaseReviewHonesty(gate);
}
