/**
 * Pure phase lessons gate (automate Step G HARD order — distill before phase-done).
 *
 * Under durable automate, phase-done must not run until lessons are *answered*:
 *   - lessonsState === 'recorded' AND non-empty lessonsPath (pointer to
 *     `.atomic-skills/projects/<id>/<plan>/lessons/<initiative-slug>.md`), or
 *   - lessonsState === 'none' (clean phase — explicit; silence ≠ zero)
 *
 * Omitting lessonsState is the dogfood failure mode (skip distill/ratify).
 * Non-automate: gate inactive (allows close) — commitGuardPhaseDone still
 * enforces requireLessons when callers pass it.
 *
 * No I/O — lessonsPath is a non-empty string pointer; on-disk existence is
 * orchestrator responsibility (same pattern as evaluationGate.reportPath).
 */

import { isDurableAutomateActive } from './plan-end-review.js';

/**
 * Whether durable automate lessons order applies (stamp-first).
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 * }} [input]
 * @returns {boolean}
 */
export function isDurableAutomateForLessons(input = {}) {
  return isDurableAutomateActive(input);
}

/**
 * @typedef {{
 *   lessonsState?: 'recorded' | 'none' | string | null,
 *   lessonsPath?: string | null,
 *   noneReason?: string | null,
 * }} LessonsGateFields
 */

/**
 * Pure honesty check for phase lessons answer (no automate stamp).
 * Used by canRunPhaseDone / preflight / assert under durable automate.
 *
 * @param {LessonsGateFields} [fields]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function phaseLessonsHonesty(fields = {}) {
  const state =
    fields.lessonsState != null
      ? String(fields.lessonsState).trim().toLowerCase()
      : '';

  if (state === '') {
    return {
      ok: false,
      reason:
        'automate requires lessonsState before phase-done (distill + operator ratify → recorded with lessonsPath, or explicit none for a clean phase — silence is not an answer)',
    };
  }

  if (state === 'recorded') {
    const path =
      fields.lessonsPath != null ? String(fields.lessonsPath).trim() : '';
    if (path === '') {
      return {
        ok: false,
        reason:
          'lessonsState=recorded requires non-empty lessonsPath (path to lessons/<initiative>.md after operator ratify)',
      };
    }
    return { ok: true };
  }

  if (state === 'none') {
    // Explicit zero-lessons answer. Optional noneReason is recommended in prose
    // but not required for machine honesty (explicit enum is the anti-skip).
    return { ok: true };
  }

  return {
    ok: false,
    reason: `unknown or invalid lessonsState: ${state || '(empty)'} (expected recorded|none)`,
  };
}

/**
 * Whether phase-done may proceed under the lessons order (design: no skip distill).
 *
 * When durable automate is off → true (inactive).
 * When on → phaseLessonsHonesty on lessonsState/lessonsPath from input or phase slice.
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 *   lessonsState?: string | null,
 *   lessonsPath?: string | null,
 *   noneReason?: string | null,
 *   phase?: LessonsGateFields | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function phaseLessonsAllowsClose(input = {}) {
  if (!isDurableAutomateForLessons(input)) {
    return { ok: true };
  }

  const phase =
    input.phase != null && typeof input.phase === 'object' ? input.phase : {};
  return phaseLessonsHonesty({
    lessonsState:
      input.lessonsState != null ? input.lessonsState : phase.lessonsState,
    lessonsPath:
      input.lessonsPath != null ? input.lessonsPath : phase.lessonsPath,
    noneReason:
      input.noneReason != null ? input.noneReason : phase.noneReason,
  });
}

/**
 * Immutable stamp helper after distill + operator ratify (or explicit none).
 * Does not mutate input. Throws on forge-friendly partial stamps.
 *
 * @param {{
 *   lessonsState: 'recorded' | 'none',
 *   lessonsPath?: string | null,
 *   noneReason?: string | null,
 *   verifiedAt?: string | null,
 * }} fields
 * @returns {{
 *   lessonsState: 'recorded' | 'none',
 *   lessonsPath?: string,
 *   noneReason?: string,
 *   verifiedAt?: string,
 * }}
 */
export function buildLessonsState(fields) {
  if (fields == null || typeof fields !== 'object') {
    throw new Error('buildLessonsState: fields required');
  }
  const state =
    fields.lessonsState != null
      ? String(fields.lessonsState).trim().toLowerCase()
      : '';
  if (state !== 'recorded' && state !== 'none') {
    throw new Error(
      'buildLessonsState: lessonsState must be recorded|none',
    );
  }
  /** @type {{ lessonsState: 'recorded' | 'none', lessonsPath?: string, noneReason?: string, verifiedAt?: string }} */
  const out = { lessonsState: /** @type {'recorded' | 'none'} */ (state) };
  if (state === 'recorded') {
    const path =
      fields.lessonsPath != null ? String(fields.lessonsPath).trim() : '';
    if (path === '') {
      throw new Error(
        'buildLessonsState: recorded requires non-empty lessonsPath',
      );
    }
    out.lessonsPath = path;
  }
  if (state === 'none' && fields.noneReason != null) {
    const r = String(fields.noneReason).trim();
    if (r !== '') out.noneReason = r;
  }
  if (fields.verifiedAt != null && String(fields.verifiedAt).trim() !== '') {
    out.verifiedAt = String(fields.verifiedAt).trim();
  }
  const honesty = phaseLessonsHonesty(out);
  if (!honesty.ok) {
    throw new Error(`buildLessonsState: ${honesty.reason}`);
  }
  return out;
}
