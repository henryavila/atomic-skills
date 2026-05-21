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
//   5. Items whose `context.lastReviewedAt` aged past staleContextDays —
//      a signal to run `re-ratify <id>` because the original solves/trigger
//      premises may no longer hold.
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
/**
 * @typedef {Object} StaleContextEntry
 * @property {'task'|'phase'|'parked'|'emerged'} kind
 * @property {string} locator    `T-001` for tasks/phases; surfacedAt ISO for
 *                                parked/emerged (their natural key, since they
 *                                carry no `id`).
 * @property {string} initiativeSlug
 *                                For phases sitting on the plan itself, the
 *                                plan slug is used.
 * @property {string} title       Truncation is the renderer's job, not ours.
 * @property {string} lastReviewedAt
 * @property {number} ageDays     Floored days since lastReviewedAt at `now`.
 */

const DEFAULT_THRESHOLDS = Object.freeze({
  phaseGrowthPctWarn: 40, // banner when a phase grew >=40% via added tasks
  scopeExpansionPctWarn: 25, // plan-wide warn when overall expansion >=25%
  parkedZombieDays: 30, // parked items > N days old count as zombies
  staleContextDays: 14, // items whose lastReviewedAt aged >= this need re-ratify
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

  const staleContext = computeStaleContext(plan, initiatives, {
    now,
    staleContextDays: thresholds.staleContextDays,
  })

  return {
    totalPhases: plan.phases.length,
    phasesAddedMidExecution,
    phasesGrew,
    parkedZombies,
    scopeExpansionPct,
    staleContext,
  }
}

/**
 * Walks every task / parked / emerged entry under `initiatives`, plus every
 * phase descriptor on `plan`, and returns the entries whose
 * `context.lastReviewedAt` aged past `staleContextDays`. Items without a
 * `context` block (original-materialization items) are skipped — they have
 * no review timestamp by design.
 *
 * Sorted oldest-first so the renderer can show "fix the dustiest stuff first".
 *
 * @param {PlanLike | null | undefined} plan
 * @param {InitiativeLike[] | undefined} initiatives
 * @param {{now?: Date, staleContextDays?: number}} [opts]
 * @returns {StaleContextEntry[]}
 */
export function computeStaleContext(plan, initiatives, opts = {}) {
  const now = opts.now ?? new Date()
  const threshold = opts.staleContextDays ?? DEFAULT_THRESHOLDS.staleContextDays
  const stale = []

  function age(iso) {
    const t = Date.parse(iso)
    if (Number.isNaN(t)) return null
    return Math.floor((now.getTime() - t) / 86400000)
  }

  // Tasks + parked + emerged on each initiative.
  for (const init of initiatives ?? []) {
    if (!init) continue
    const slug = init.slug
    for (const t of init.tasks ?? []) {
      const rev = t.context?.lastReviewedAt
      if (!rev) continue
      const ageDays = age(rev)
      if (ageDays == null || ageDays < threshold) continue
      stale.push({
        kind: 'task',
        locator: t.id,
        initiativeSlug: slug,
        title: t.title ?? `(unnamed ${t.id})`,
        lastReviewedAt: rev,
        ageDays,
      })
    }
    for (const p of init.parked ?? []) {
      const rev = p.context?.lastReviewedAt
      if (!rev) continue
      const ageDays = age(rev)
      if (ageDays == null || ageDays < threshold) continue
      stale.push({
        kind: 'parked',
        locator: p.surfacedAt,
        initiativeSlug: slug,
        title: p.title ?? '(unnamed parked)',
        lastReviewedAt: rev,
        ageDays,
      })
    }
    for (const e of init.emerged ?? []) {
      const rev = e.context?.lastReviewedAt
      if (!rev) continue
      const ageDays = age(rev)
      if (ageDays == null || ageDays < threshold) continue
      stale.push({
        kind: 'emerged',
        locator: e.surfacedAt,
        initiativeSlug: slug,
        title: e.title ?? '(unnamed emerged)',
        lastReviewedAt: rev,
        ageDays,
      })
    }
  }

  // Phases on the plan itself (those inserted mid-execution carry context).
  if (plan && Array.isArray(plan.phases)) {
    for (const ph of plan.phases) {
      const rev = ph.context?.lastReviewedAt
      if (!rev) continue
      const ageDays = age(rev)
      if (ageDays == null || ageDays < threshold) continue
      stale.push({
        kind: 'phase',
        locator: ph.id,
        initiativeSlug: plan.slug ?? '(unknown plan)',
        title: ph.title ?? ph.id,
        lastReviewedAt: rev,
        ageDays,
      })
    }
  }

  stale.sort((a, b) => b.ageDays - a.ageDays)
  return stale
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
  if (Array.isArray(report.staleContext) && report.staleContext.length > 0) {
    reasons.push(
      `${report.staleContext.length} item(s) with stale context (lastReviewedAt > ${t.staleContextDays}d) — run \`re-ratify <id>\``
    )
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
    staleContext: [],
  }
}

export { DEFAULT_THRESHOLDS }
