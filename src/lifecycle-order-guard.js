/**
 * Pure lifecycle order helpers for phase-done / archive integrity (F4).
 *
 * exitGate mirror: when plan phase criteria are all met, initiative exitGates
 * must not remain pending before archive — incomplete mirror fails closed
 * (terminal-pending block).
 *
 * Full order classifier lives in scripts/lifecycle-order-guard.js; this module
 * is the src-side assert used by unit tests and thin callers.
 */

/**
 * Whether a single exit gate / criterion is terminal-met.
 * @param {unknown} gate
 * @returns {boolean}
 */
export function isExitGateMet(gate) {
  if (gate == null || typeof gate !== 'object') return false;
  const status =
    /** @type {{ status?: unknown }} */ (gate).status != null
      ? String(/** @type {{ status?: unknown }} */ (gate).status)
          .trim()
          .toLowerCase()
      : '';
  return status === 'met';
}

/**
 * Whether a gate is still open (pending / failed / declined / empty).
 * deferred is open for terminal close (not a pass path).
 * @param {unknown} gate
 * @returns {boolean}
 */
export function isExitGateOpen(gate) {
  if (gate == null || typeof gate !== 'object') return true;
  const status =
    /** @type {{ status?: unknown }} */ (gate).status != null
      ? String(/** @type {{ status?: unknown }} */ (gate).status)
          .trim()
          .toLowerCase()
      : '';
  return status !== 'met';
}

/**
 * Assert exitGate mirror integrity before archive / phase-done terminal.
 *
 * Fails when plan criteria are all met (or empty with plan declaring phase)
 * but initiative exitGates still have pending/open gates (mirror incomplete).
 *
 * Also fails when a plan criterion is met and the matching initiative gate
 * (by id) is still pending — terminal-pending mirror block.
 *
 * @param {{
 *   planCriteria?: unknown[] | null,
 *   initiativeExitGates?: unknown[] | null,
 *   exitGates?: unknown[] | null,
 *   planPhaseMet?: boolean | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string, code?: string }}
 */
export function assertExitGateMirror(input = {}) {
  const planCriteria = Array.isArray(input.planCriteria)
    ? input.planCriteria
    : [];
  const initiativeGates = Array.isArray(input.initiativeExitGates)
    ? input.initiativeExitGates
    : Array.isArray(input.exitGates)
      ? input.exitGates
      : [];

  const planAllMet =
    planCriteria.length > 0 && planCriteria.every((g) => isExitGateMet(g));
  const planDeclaresMet = planAllMet || input.planPhaseMet === true;

  if (!planDeclaresMet && planCriteria.length === 0) {
    // No plan criteria and no planPhaseMet flag — nothing to mirror-check.
    // Still fail if initiative has pending and caller claimed plan met.
    return { ok: true };
  }

  if (planDeclaresMet) {
    for (const gate of initiativeGates) {
      if (isExitGateOpen(gate)) {
        const id =
          gate != null &&
          typeof gate === 'object' &&
          /** @type {{ id?: unknown }} */ (gate).id != null
            ? String(/** @type {{ id?: unknown }} */ (gate).id)
            : '<gate>';
        const status =
          gate != null &&
          typeof gate === 'object' &&
          /** @type {{ status?: unknown }} */ (gate).status != null
            ? String(/** @type {{ status?: unknown }} */ (gate).status)
            : 'pending';
        return {
          ok: false,
          code: 'exitGate-mirror-terminal-pending',
          reason: `exitGate mirror: plan criteria met but initiative exitGate ${id} is ${status} (terminal-pending) — complete mirror before archive; do not hand-edit phase-done`,
        };
      }
    }
  }

  // Per-id mirror: plan met ⇒ initiative same id must not be pending.
  /** @type {Map<string, unknown>} */
  const planById = new Map();
  for (const g of planCriteria) {
    if (g == null || typeof g !== 'object') continue;
    const id =
      /** @type {{ id?: unknown }} */ (g).id != null
        ? String(/** @type {{ id?: unknown }} */ (g).id).trim()
        : '';
    if (id) planById.set(id, g);
  }
  for (const g of initiativeGates) {
    if (g == null || typeof g !== 'object') continue;
    const id =
      /** @type {{ id?: unknown }} */ (g).id != null
        ? String(/** @type {{ id?: unknown }} */ (g).id).trim()
        : '';
    if (!id) continue;
    const planGate = planById.get(id);
    if (planGate && isExitGateMet(planGate) && isExitGateOpen(g)) {
      return {
        ok: false,
        code: 'exitGate-mirror-terminal-pending',
        reason: `exitGate mirror: plan criterion ${id} is met but initiative exitGate is still pending/open — mirror before archive`,
      };
    }
  }

  return { ok: true };
}

/**
 * Alias used by phase-done close path naming.
 * @param {Parameters<typeof assertExitGateMirror>[0]} [input]
 * @returns {ReturnType<typeof assertExitGateMirror>}
 */
export function exitGateMirrorAllowsArchive(input = {}) {
  return assertExitGateMirror(input);
}
