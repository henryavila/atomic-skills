// Pure-function phase-transition helpers for the project-status skill.
//
// The skill body's `phase-done` flow consults these to decide which phase(s)
// should become eligible after the active phase's exit gates are all met.
// Kept dependency-free and side-effect-free so it can be unit-tested in
// isolation (see tests/transition.test.js, tests/transition-integrity.test.js).
//
// F4/T-002: plan-done only when every phase is terminal; zero-eligible with
// open work is blocked; self-loops / cycles / unknown deps fail closed.

import { isTerminalPhaseStatus } from './state-invariants.js';

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

/**
 * @typedef {{ code: string, message: string, phaseId?: string, missing?: string[], cycle?: string[] }} PhaseDagError
 */

export const PHASE_DAG_CODES = Object.freeze({
  UNKNOWN_DEP: 'unknown-dep',
  SELF_LOOP: 'self-loop',
  CYCLE: 'cycle',
});

// A phase becomes eligible to be the NEXT active phase only when it hasn't
// started yet. `active` and `paused` phases are already in progress (or
// deliberately suspended) — advancing into them would seed a duplicate
// successor initiative and corrupt plan state in parallel-mode plans. The
// phase status enum is {pending, active, paused, done, archived} per
// meta/schemas/plan.schema.json $defs.phaseDescriptor.properties.status.
const STARTABLE_STATUS = 'pending';

/**
 * @param {PlanLike|null|undefined} plan
 * @returns {PhaseDescriptor[]}
 */
function phasesOf(plan) {
  if (!plan || !Array.isArray(plan.phases)) return [];
  return plan.phases.filter((p) => p && typeof p.id === 'string');
}

/**
 * @param {PlanLike|null|undefined} plan
 * @returns {Map<string, PhaseDescriptor>}
 */
function phaseMap(plan) {
  const map = new Map();
  for (const p of phasesOf(plan)) map.set(p.id, p);
  return map;
}

/**
 * Ids considered terminal for advance computation: existing terminal statuses
 * plus the just-completed phase id (treated as done for this call).
 * @param {PlanLike|null|undefined} plan
 * @param {string} [completedPhaseId]
 * @returns {Set<string>}
 */
function doneIdsFor(plan, completedPhaseId) {
  const byId = phaseMap(plan);
  const doneIds = new Set();
  for (const [id, p] of byId) {
    if (isTerminalPhaseStatus(p.status)) doneIds.add(id);
  }
  if (completedPhaseId && byId.has(completedPhaseId)) {
    doneIds.add(completedPhaseId);
  }
  return doneIds;
}

/**
 * True when every phase is terminal after treating `completedPhaseId` as done.
 * Vacuously true for empty/malformed plans (nothing open remains).
 *
 * @param {PlanLike|null|undefined} plan
 * @param {string} [completedPhaseId]
 * @returns {boolean}
 */
export function allPhasesTerminal(plan, completedPhaseId) {
  const phases = phasesOf(plan);
  if (phases.length === 0) return true;
  const doneIds = doneIdsFor(plan, completedPhaseId);
  return phases.every((p) => doneIds.has(p.id));
}

/**
 * Non-terminal phase ids after treating `completedPhaseId` as done.
 * Declaration order preserved.
 *
 * @param {PlanLike|null|undefined} plan
 * @param {string} [completedPhaseId]
 * @returns {string[]}
 */
export function openPhaseIds(plan, completedPhaseId) {
  const doneIds = doneIdsFor(plan, completedPhaseId);
  return phasesOf(plan).filter((p) => !doneIds.has(p.id)).map((p) => p.id);
}

/**
 * Find directed cycles in the phase `dependsOn` graph (edge: phase → dep).
 * Self-loops are reported as single-node cycles. Returns each cycle once as
 * a closed id list `[a, b, a]` or `[a, a]` for a self-loop. Pure.
 *
 * @param {PlanLike|null|undefined} plan
 * @returns {string[][]}
 */
export function findPhaseCycles(plan) {
  const byId = phaseMap(plan);
  if (byId.size === 0) return [];

  /** @type {Map<string, string[]>} */
  const adj = new Map();
  for (const [id, p] of byId) {
    const deps = Array.isArray(p.dependsOn) ? p.dependsOn : [];
    // Only known ids participate in cycle detection; unknown deps are separate errors.
    adj.set(id, deps.filter((d) => byId.has(d)));
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  /** @type {Map<string, number>} */
  const color = new Map();
  /** @type {string[]} */
  const stack = [];
  /** @type {string[][]} */
  const cycles = [];
  /** @type {Set<string>} */
  const seenCycleKeys = new Set();

  function recordCycle(fromIdx) {
    const cycle = [...stack.slice(fromIdx), stack[fromIdx]];
    const body = cycle.slice(0, -1);
    const key = body.slice().sort().join('\0');
    if (seenCycleKeys.has(key)) return;
    seenCycleKeys.add(key);
    cycles.push(cycle);
  }

  function visit(node) {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of adj.get(node) ?? []) {
      if (next === node) {
        // Self-loop: explicit single-node cycle.
        const key = node;
        if (!seenCycleKeys.has(key)) {
          seenCycleKeys.add(key);
          cycles.push([node, node]);
        }
        continue;
      }
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) {
        const idx = stack.indexOf(next);
        if (idx !== -1) recordCycle(idx);
        continue;
      }
      if (c === WHITE) visit(next);
    }
    stack.pop();
    color.set(node, BLACK);
  }

  for (const id of byId.keys()) {
    if ((color.get(id) ?? WHITE) === WHITE) visit(id);
  }
  return cycles;
}

/**
 * Structural validation of the phase dependency DAG.
 * Reports unknown deps, self-loops, and multi-node cycles. Does not consult
 * phase status — pure graph shape.
 *
 * @param {PlanLike|null|undefined} plan
 * @returns {{ ok: true, errors: [] } | { ok: false, errors: PhaseDagError[] }}
 */
export function validatePhaseDag(plan) {
  /** @type {PhaseDagError[]} */
  const errors = [];
  const phases = phasesOf(plan);
  if (phases.length === 0) return { ok: true, errors: [] };

  const known = new Set(phases.map((p) => p.id));

  for (const p of phases) {
    const deps = Array.isArray(p.dependsOn) ? p.dependsOn : [];
    const missing = deps.filter((d) => !known.has(d));
    if (missing.length > 0) {
      errors.push({
        code: PHASE_DAG_CODES.UNKNOWN_DEP,
        message: `phase '${p.id}' dependsOn unknown id(s): ${missing.join(', ')}`,
        phaseId: p.id,
        missing,
      });
    }
    if (deps.includes(p.id)) {
      errors.push({
        code: PHASE_DAG_CODES.SELF_LOOP,
        message: `phase '${p.id}' depends on itself`,
        phaseId: p.id,
        cycle: [p.id, p.id],
      });
    }
  }

  for (const cycle of findPhaseCycles(plan)) {
    // Self-loops already reported above; skip duplicate self-loop codes.
    const isSelf = cycle.length === 2 && cycle[0] === cycle[1];
    if (isSelf) continue;
    errors.push({
      code: PHASE_DAG_CODES.CYCLE,
      message: `phase dependsOn cycle: ${cycle.join(' → ')}`,
      cycle,
      phaseId: cycle[0],
    });
  }

  if (errors.length === 0) return { ok: true, errors: [] };
  return { ok: false, errors };
}

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
 * Eligibility is driven by `dependsOn` satisfaction, not numeric id sort —
 * a chain F0→F4→F3 elects F4 after F0 even when phases are listed F0..F6.
 * Unknown ids in `dependsOn` arrays are treated as unsatisfiable — the phase
 * stays ineligible — so a typo never silently promotes a phase. Callers may
 * inspect `unknownDeps()` / `validatePhaseDag()` to surface those problems.
 *
 * @param {PlanLike} plan
 * @param {string} completedPhaseId
 * @returns {string[]}
 */
export function nextEligiblePhases(plan, completedPhaseId) {
  if (!plan || !Array.isArray(plan.phases)) return [];
  const byId = phaseMap(plan);
  const doneIds = doneIdsFor(plan, completedPhaseId);

  const eligible = [];
  for (const p of plan.phases) {
    if (!p || typeof p.id !== 'string') continue;
    if (p.id === completedPhaseId) continue;
    if (p.status !== STARTABLE_STATUS) continue;
    const deps = Array.isArray(p.dependsOn) ? p.dependsOn : [];
    const allSatisfied = deps.every((d) => {
      if (!byId.has(d)) return false; // unknown dep — never satisfiable
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
 * - Graph invalid (unknown dep / self-loop / cycle):
 *   `{ kind: 'error', errors, eligible: [] }` — fail closed; do not advance.
 * - Eligible phases exist and `parallelismAllowed`:
 *   `{ kind: 'parallel-choice', eligible }`.
 * - Eligible phases exist (serial):
 *   `{ kind: 'single', next, alternatives }` — `next` is the first eligible
 *   in declaration order among dependsOn-satisfied phases (not numeric id).
 * - Zero eligible AND every phase terminal (incl. completedPhaseId):
 *   `{ kind: 'plan-done', eligible: [] }`.
 * - Zero eligible but open (pending/active/paused) work remains:
 *   `{ kind: 'blocked', eligible: [], open }` — NOT plan-done.
 *
 * @param {PlanLike} plan
 * @param {string} completedPhaseId
 * @returns {
 *   | { kind: 'plan-done', eligible: [] }
 *   | { kind: 'blocked', eligible: [], open: string[] }
 *   | { kind: 'error', errors: PhaseDagError[], eligible: [] }
 *   | { kind: 'parallel-choice', eligible: string[] }
 *   | { kind: 'single', next: string, alternatives: string[] }
 * }
 */
export function proposeAdvance(plan, completedPhaseId) {
  const dag = validatePhaseDag(plan);
  if (!dag.ok) {
    return { kind: 'error', errors: dag.errors, eligible: [] };
  }

  const eligible = nextEligiblePhases(plan, completedPhaseId);
  if (eligible.length > 0) {
    if (plan && plan.parallelismAllowed === true) {
      return { kind: 'parallel-choice', eligible };
    }
    const [next, ...rest] = eligible;
    return { kind: 'single', next, alternatives: rest };
  }

  if (allPhasesTerminal(plan, completedPhaseId)) {
    return { kind: 'plan-done', eligible: [] };
  }

  return {
    kind: 'blocked',
    eligible: [],
    open: openPhaseIds(plan, completedPhaseId),
  };
}
