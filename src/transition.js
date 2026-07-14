// Pure-function phase-transition helpers for the project-status skill.
//
// The skill body's `phase-done` flow consults these to decide which phase(s)
// should become eligible after the active phase's exit gates are all met.
// Kept dependency-free and side-effect-free so it can be unit-tested in
// isolation (see tests/transition.test.js).
import { collectPhaseGraphViolations, isTerminalStatus } from './state-invariants.js';

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
// A phase becomes eligible to be the NEXT active phase only when it hasn't
// started yet. `active` and `paused` phases are already in progress (or
// deliberately suspended) — advancing into them would seed a duplicate
// successor initiative and corrupt plan state in parallel-mode plans. The
// phase status enum is {pending, active, paused, done, archived} per
// meta/schemas/plan.schema.json $defs.phaseDescriptor.properties.status.
const STARTABLE_STATUS = 'pending';

/**
 * Given a plan and the id of the phase whose exit gates just passed, return
 * the phase ids that are now eligible to become the next active phase(s).
 *
 * A phase is eligible iff:
 *   - It is not itself the just-completed phase.
 *   - Its status is exactly `pending` (not `active`/`paused`/`done`/`archived`).
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
    if (p.status !== STARTABLE_STATUS) continue;
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
 * Distinguish a complete graph from one that merely has no startable phase.
 * `completedPhaseId` is considered terminal in-memory so phase-done can classify
 * before writing the close. Graph errors and remaining active/paused/pending
 * phases are blockers, never implicit plan completion.
 */
export function classifyPlanProgress(plan, completedPhaseId) {
  if (!plan || !Array.isArray(plan.phases)) {
    return {
      kind: 'blocked',
      eligible: [],
      blockers: [{ code: 'invalid-phase-graph', message: 'plan.phases must be an array' }],
    };
  }
  const graphViolations = collectPhaseGraphViolations(plan);
  if (graphViolations.length > 0) {
    return { kind: 'blocked', eligible: [], blockers: graphViolations };
  }
  const consideredTerminal = (phase) => (
    phase?.id === completedPhaseId || isTerminalStatus(phase?.status)
  );
  if (plan.phases.every(consideredTerminal)) {
    return { kind: 'complete', eligible: [], blockers: [] };
  }
  const eligible = nextEligiblePhases(plan, completedPhaseId);
  if (eligible.length > 0) {
    return { kind: 'ready', eligible, blockers: [] };
  }
  return {
    kind: 'blocked',
    eligible: [],
    blockers: plan.phases
      .filter((phase) => !consideredTerminal(phase))
      .map((phase) => ({
        code: 'open-phase',
        phaseId: phase?.id ?? '?',
        message: `phase ${phase?.id ?? '?'} remains ${phase?.status ?? 'unknown'} and no successor is startable`,
      })),
  };
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
 *   | { kind: 'blocked', eligible: [], blockers: object[] }
 *   | { kind: 'parallel-choice', eligible: string[] }
 *   | { kind: 'single', next: string, alternatives: string[] }
 * }
 */
export function proposeAdvance(plan, completedPhaseId) {
  const progress = classifyPlanProgress(plan, completedPhaseId);
  if (progress.kind === 'complete') return { kind: 'plan-done', eligible: [] };
  if (progress.kind === 'blocked') {
    return { kind: 'blocked', eligible: [], blockers: progress.blockers };
  }
  const eligible = progress.eligible;
  if (plan && plan.parallelismAllowed === true) {
    return { kind: 'parallel-choice', eligible };
  }
  const [next, ...rest] = eligible;
  return { kind: 'single', next, alternatives: rest };
}
