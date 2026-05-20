// Pure helpers that compute scope drift signals over a plan + its
// initiatives. Consumed by:
//   - skills/en/core/project-status.md default view (banner trigger)
//   - the `scope-creep` mutation-mode command (full report)
//
// Drift sources tracked:
//   1. Tasks added mid-execution (have `provenance` field) vs original tasks
//   2. Phases added mid-execution (provenance on the phase descriptor)
//   3. Parked items aging past a threshold (zombies)
//   4. Phase-completion vs originally-planned task count (closure drift)
//
// No I/O. Pass in already-parsed plan + initiatives objects.

/**
 * @typedef {Object} PlanLike
 * @property {string} slug
 * @property {Array<{id: string, status: string, provenance?: {surfacedAt: string, surfacedDuring?: string}}>} phases
 */
/**
 * @typedef {Object} InitiativeLike
 * @property {string} slug
 * @property {string} status
 * @property {string} [parentPlan]
 * @property {string} [phaseId]
 * @property {Array<{id: string, status: string, provenance?: {surfacedAt: string, surfacedDuring?: string}}>} tasks
 * @property {Array<{title: string, surfacedAt: string}>} [parked]
 */
/**
 * @typedef {Object} DriftReport
 * @property {number} totalPhases
 * @property {number} phasesAddedMidExecution
 * @property {Array<PhaseDriftEntry>} phasesGrew
 *   Phases where tasks were added after initial materialization. Sorted
 *   by growth ratio descending.
 * @property {Array<ParkedZombie>} parkedZombies
 *   Parked items older than thresholds.parkedZombieDays.
 * @property {number} scopeExpansionPct
 *   Across all phases under this plan: (added tasks) / (original tasks) × 100.
 *   Computed only for phases with at least one original task.
 */
/**
 * @typedef {Object} PhaseDriftEntry
 * @property {string} phaseId
 * @property {string} initiativeSlug
 * @property {number} originalTaskCount
 * @property {number} addedTaskCount
 * @property {number} growthPct
 * @property {boolean} closed
 */
/**
 * @typedef {Object} ParkedZombie
 * @property {string} initiativeSlug
 * @property {string} title
 * @property {string} surfacedAt
 * @property {number} ageDays
 */

const DEFAULT_THRESHOLDS = Object.freeze({
  phaseGrowthPctWarn: 40, // banner when a phase grew >=40% via added tasks
  scopeExpansionPctWarn: 25, // plan-wide warn when overall expansion >=25%
  parkedZombieDays: 30, // parked items > N days old count as zombies
})

/**
 * Builds the full drift report for a plan + its initiatives.
 *
 * @param {PlanLike} plan
 * @param {InitiativeLike[]} initiatives
 * @param {{thresholds?: Partial<typeof DEFAULT_THRESHOLDS>, now?: Date}} [opts]
 * @returns {DriftReport}
 */
export function computeDrift(plan, initiatives, opts = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(opts.thresholds ?? {}) }
  const now = opts.now ?? new Date()

  if (!plan || !Array.isArray(plan.phases)) {
    return emptyReport()
  }

  const initByPhase = new Map()
  for (const i of initiatives ?? []) {
    if (i && i.parentPlan === plan.slug && i.phaseId) initByPhase.set(i.phaseId, i)
  }

  const phasesGrew = []
  const parkedZombies = []
  let totalOriginal = 0
  let totalAdded = 0

  for (const phase of plan.phases) {
    const init = initByPhase.get(phase.id)
    if (!init) continue
    const tasks = Array.isArray(init.tasks) ? init.tasks : []
    const original = tasks.filter((t) => !t.provenance).length
    const added = tasks.filter((t) => Boolean(t.provenance)).length
    totalOriginal += original
    totalAdded += added
    if (added > 0 && original > 0) {
      phasesGrew.push({
        phaseId: phase.id,
        initiativeSlug: init.slug,
        originalTaskCount: original,
        addedTaskCount: added,
        growthPct: Math.round((added / original) * 100),
        closed: phase.status === 'done' || phase.status === 'archived',
      })
    }

    for (const p of init.parked ?? []) {
      const surfaced = Date.parse(p.surfacedAt)
      if (Number.isNaN(surfaced)) continue
      const ageDays = Math.floor((now.getTime() - surfaced) / 86400000)
      if (ageDays >= thresholds.parkedZombieDays) {
        parkedZombies.push({
          initiativeSlug: init.slug,
          title: p.title,
          surfacedAt: p.surfacedAt,
          ageDays,
        })
      }
    }
  }

  phasesGrew.sort((a, b) => b.growthPct - a.growthPct)

  const phasesAddedMidExecution = plan.phases.filter((p) => Boolean(p.provenance)).length
  const scopeExpansionPct =
    totalOriginal > 0 ? Math.round((totalAdded / totalOriginal) * 100) : 0

  return {
    totalPhases: plan.phases.length,
    phasesAddedMidExecution,
    phasesGrew,
    parkedZombies,
    scopeExpansionPct,
  }
}

/**
 * Filters the drift report to entries that exceed warn thresholds.
 * Used by the default view to decide whether to show the banner.
 *
 * @param {DriftReport} report
 * @param {Partial<typeof DEFAULT_THRESHOLDS>} [overrides]
 * @returns {{shouldWarn: boolean, reasons: string[]}}
 */
export function evaluateWarnings(report, overrides = {}) {
  const t = { ...DEFAULT_THRESHOLDS, ...overrides }
  const reasons = []
  const overGrowth = report.phasesGrew.filter((p) => p.growthPct >= t.phaseGrowthPctWarn && !p.closed)
  if (overGrowth.length > 0) {
    reasons.push(
      `${overGrowth.length} phase(s) grew >=${t.phaseGrowthPctWarn}%: ${overGrowth.map((p) => `${p.phaseId} (+${p.growthPct}%)`).join(', ')}`
    )
  }
  if (report.scopeExpansionPct >= t.scopeExpansionPctWarn) {
    reasons.push(`plan-wide scope expansion ${report.scopeExpansionPct}% (>=${t.scopeExpansionPctWarn}%)`)
  }
  if (report.parkedZombies.length > 0) {
    reasons.push(
      `${report.parkedZombies.length} parked zombie(s) older than ${t.parkedZombieDays}d`
    )
  }
  if (report.phasesAddedMidExecution > 0) {
    reasons.push(`${report.phasesAddedMidExecution} phase(s) added mid-execution`)
  }
  return { shouldWarn: reasons.length > 0, reasons }
}

/**
 * Renders a compact one-line banner for the default view.
 *
 * @param {DriftReport} report
 * @param {Partial<typeof DEFAULT_THRESHOLDS>} [overrides]
 * @returns {string | null}  null when no warning condition; otherwise the banner string.
 */
export function renderBanner(report, overrides = {}) {
  const { shouldWarn, reasons } = evaluateWarnings(report, overrides)
  if (!shouldWarn) return null
  return `SCOPE DRIFT: ${reasons.join(' · ')} → run \`atomic-skills:project-status scope-creep\``
}

function emptyReport() {
  return {
    totalPhases: 0,
    phasesAddedMidExecution: 0,
    phasesGrew: [],
    parkedZombies: [],
    scopeExpansionPct: 0,
  }
}

export { DEFAULT_THRESHOLDS }
