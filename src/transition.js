// Pure-function phase-transition helpers for the project-status skill.
//
// The skill body's `phase-done` flow consults these to decide which phase(s)
// should become eligible after the active phase's exit gates are all met.
// Kept dependency-free and side-effect-free so it can be unit-tested in
// isolation (see tests/transition.test.js).

/**
 * @typedef {Object} PhaseDescriptor
 * @property {string} id
 * @property {string} [slug]
 * @property {string} [title]
 * @property {string[]} dependsOn
 * @property {'pending'|'active'|'paused'|'done'|'archived'} status
 */

/**
 * @typedef {Object} PlanLike
 * @property {string} [currentPhase]
 * @property {boolean} [parallelismAllowed]
 * @property {PhaseDescriptor[]} phases
 */

const TERMINAL_STATUSES = new Set(['done', 'archived']);

/**
 * Given a plan and the id of the phase whose exit gates just passed, return
 * the phase ids that are now eligible to become the next active phase(s).
 *
 * A phase is eligible iff:
 *   - It is not itself the just-completed phase.
 *   - Its status is not already `done` or `archived`.
 *   - Every entry in its `dependsOn` either equals `completedPhaseId` or
 *     refers to another phase whose status is already `done` (after the
 *     just-completed phase is considered done for this computation).
 *
 * The order of returned ids preserves the order they appear in `plan.phases`.
 * Unknown ids in `dependsOn` arrays are treated as unsatisfiable — the phase
 * stays ineligible — so a typo never silently promotes a phase. Callers may
 * inspect `unknownDeps()` to surface those problems.
 *
 * @param {PlanLike} plan
 * @param {string} completedPhaseId
 * @returns {string[]}
 */
export function nextEligiblePhases(plan, completedPhaseId) {
  if (!plan || !Array.isArray(plan.phases)) return [];
  const phaseById = new Map();
  for (const p of plan.phases) {
    if (p && typeof p.id === 'string') phaseById.set(p.id, p);
  }
  const doneIds = new Set();
  for (const [id, p] of phaseById) {
    if (TERMINAL_STATUSES.has(p.status)) doneIds.add(id);
  }
  if (completedPhaseId && phaseById.has(completedPhaseId)) {
    doneIds.add(completedPhaseId);
  }

  const eligible = [];
  for (const p of plan.phases) {
    if (!p || typeof p.id !== 'string') continue;
    if (p.id === completedPhaseId) continue;
    if (TERMINAL_STATUSES.has(p.status)) continue;
    const deps = Array.isArray(p.dependsOn) ? p.dependsOn : [];
    const allSatisfied = deps.every((d) => {
      if (!phaseById.has(d)) return false; // unknown dep — never satisfiable
      return doneIds.has(d);
    });
    if (allSatisfied) eligible.push(p.id);
  }
  return eligible;
}

/**
 * Surfaces dependency ids referenced by `phase.dependsOn` arrays that don't
 * correspond to any phase in the plan. Used by the skill body to warn the
 * user before the phase-done flow commits to an advance.
 *
 * @param {PlanLike} plan
 * @returns {Array<{phaseId: string, missing: string[]}>}
 */
export function unknownDeps(plan) {
  if (!plan || !Array.isArray(plan.phases)) return [];
  const known = new Set();
  for (const p of plan.phases) {
    if (p && typeof p.id === 'string') known.add(p.id);
  }
  const out = [];
  for (const p of plan.phases) {
    if (!p || typeof p.id !== 'string') continue;
    const deps = Array.isArray(p.dependsOn) ? p.dependsOn : [];
    const missing = deps.filter((d) => !known.has(d));
    if (missing.length > 0) out.push({ phaseId: p.id, missing });
  }
  return out;
}

/**
 * Decides how the plan should advance after the named phase has all its exit
 * gates met. Returns a structured proposal the skill body can present to the
 * user verbatim.
 *
 * - When zero phases are eligible: `{ kind: 'plan-done', eligible: [] }`.
 *   (The user should mark the plan itself `done` or `archived`.)
 * - When `plan.parallelismAllowed === true`: returns all eligible phase ids.
 *   The user is prompted to pick one or more to spin up next.
 * - Otherwise: returns the single phase id that appears earliest in
 *   `plan.phases`. If multiple are tied, the user is told about the others
 *   via `alternatives` so they can override.
 *
 * @param {PlanLike} plan
 * @param {string} completedPhaseId
 * @returns {
 *   | { kind: 'plan-done', eligible: [] }
 *   | { kind: 'parallel-choice', eligible: string[] }
 *   | { kind: 'single', next: string, alternatives: string[] }
 * }
 */
export function proposeAdvance(plan, completedPhaseId) {
  const eligible = nextEligiblePhases(plan, completedPhaseId);
  if (eligible.length === 0) return { kind: 'plan-done', eligible: [] };
  if (plan && plan.parallelismAllowed === true) {
    return { kind: 'parallel-choice', eligible };
  }
  const [next, ...rest] = eligible;
  return { kind: 'single', next, alternatives: rest };
}
