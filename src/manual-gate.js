/**
 * The reserved final manual-validation gate.
 *
 * Every Plan and every standalone Initiative ends with exactly one of these as
 * its LAST exit gate. It is the human sign-off before close: `project-status`
 * refuses to complete `phase-done`→plan-done (plans) or `archive` (standalone
 * initiatives) while it is `pending`, and never coerces it to `deferred`.
 *
 * - Plan          → lives on the TERMINAL phase's `exitGate.criteria[]`.
 * - Standalone    → lives in the initiative's `exitGates[]`.
 * - In-plan phase initiatives do NOT carry it (the plan's terminal phase owns it).
 *
 * Reserved id: `G-MANUAL`. Never reuse it, never let a plan/initiative carry two.
 * See skills/core/project-plan.md §"Mandatory final manual-validation gate" and
 * skills/core/project-status.md *Manual-validation gate invariant*.
 */

export const MANUAL_GATE_ID = 'G-MANUAL';

/** Build a fresh, schema-valid `G-MANUAL` exit criterion (status `pending`). */
export function makeManualGate() {
  return {
    id: MANUAL_GATE_ID,
    description:
      'Final manual validation — a human has personally verified the delivered work meets the goal before close.',
    verifier: {
      kind: 'manual',
      description:
        'Demonstrate the completed work to the user and obtain explicit sign-off. This is the LAST gate; the plan/initiative does not close until the user confirms.',
    },
    status: 'pending',
  };
}

/** True iff `criteria` already contains a `G-MANUAL` gate. */
export function hasManualGate(criteria) {
  return Array.isArray(criteria) && criteria.some((c) => c && c.id === MANUAL_GATE_ID);
}

/**
 * Append a `G-MANUAL` gate to `criteria` if absent. Returns a NEW array
 * (never mutates the input) so callers stay immutable. Idempotent: a list that
 * already has the gate is returned unchanged (as a copy).
 */
export function withManualGate(criteria) {
  const list = Array.isArray(criteria) ? [...criteria] : [];
  if (hasManualGate(list)) return list;
  list.push(makeManualGate());
  return list;
}
