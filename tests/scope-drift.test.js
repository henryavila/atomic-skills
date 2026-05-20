import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  computeDrift,
  evaluateWarnings,
  renderBanner,
  DEFAULT_THRESHOLDS,
} from '../src/scope-drift.js'

function task(id, opts = {}) {
  return {
    id,
    status: opts.status ?? 'pending',
    title: opts.title ?? `Task ${id}`,
    lastUpdated: '2026-05-01T00:00:00Z',
    ...(opts.provenance ? { provenance: opts.provenance } : {}),
  }
}

function phase(id, opts = {}) {
  return {
    id,
    status: opts.status ?? 'pending',
    ...(opts.provenance ? { provenance: opts.provenance } : {}),
  }
}

function init(slug, phaseId, tasks, parked = []) {
  return {
    slug,
    parentPlan: 'plan-x',
    phaseId,
    status: 'active',
    tasks,
    parked,
  }
}

describe('computeDrift — no drift', () => {
  it('returns zero counts when no provenance present anywhere', () => {
    const plan = { slug: 'plan-x', phases: [phase('F0'), phase('F1')] }
    const inits = [
      init('i-f0', 'F0', [task('T-001'), task('T-002')]),
      init('i-f1', 'F1', [task('T-001'), task('T-002')]),
    ]
    const r = computeDrift(plan, inits)
    assert.equal(r.phasesGrew.length, 0)
    assert.equal(r.parkedZombies.length, 0)
    assert.equal(r.scopeExpansionPct, 0)
    assert.equal(r.phasesAddedMidExecution, 0)
    assert.equal(r.totalPhases, 2)
  })

  it('null/malformed plan returns empty report', () => {
    assert.deepEqual(computeDrift(null, []), {
      totalPhases: 0,
      phasesAddedMidExecution: 0,
      phasesGrew: [],
      parkedZombies: [],
      scopeExpansionPct: 0,
    })
    assert.equal(computeDrift({}, []).totalPhases, 0)
  })
})

describe('computeDrift — phase growth', () => {
  it('reports phases with added tasks, sorted by growth %', () => {
    const plan = { slug: 'plan-x', phases: [phase('F0'), phase('F1')] }
    const inits = [
      init('i-f0', 'F0', [
        task('T-001'),
        task('T-002'),
        task('T-003'),
        task('T-004', { provenance: { surfacedAt: '2026-05-15T00:00:00Z' } }),
        task('T-005', { provenance: { surfacedAt: '2026-05-15T00:00:00Z' } }),
      ]),
      init('i-f1', 'F1', [
        task('T-001'),
        task('T-002'),
        task('T-003', { provenance: { surfacedAt: '2026-05-15T00:00:00Z' } }),
      ]),
    ]
    const r = computeDrift(plan, inits)
    assert.equal(r.phasesGrew.length, 2)
    // F0: 3 original + 2 added = 67% growth; F1: 2 + 1 = 50%. F0 first.
    assert.equal(r.phasesGrew[0].phaseId, 'F0')
    assert.equal(r.phasesGrew[0].growthPct, 67)
    assert.equal(r.phasesGrew[0].originalTaskCount, 3)
    assert.equal(r.phasesGrew[0].addedTaskCount, 2)
    assert.equal(r.phasesGrew[1].phaseId, 'F1')
    assert.equal(r.phasesGrew[1].growthPct, 50)
  })

  it('ignores phases with zero added tasks', () => {
    const plan = { slug: 'plan-x', phases: [phase('F0'), phase('F1')] }
    const inits = [
      init('i-f0', 'F0', [task('T-001'), task('T-002')]), // no growth
      init('i-f1', 'F1', [
        task('T-001'),
        task('T-002', { provenance: { surfacedAt: '2026-05-15T00:00:00Z' } }),
      ]),
    ]
    const r = computeDrift(plan, inits)
    assert.equal(r.phasesGrew.length, 1)
    assert.equal(r.phasesGrew[0].phaseId, 'F1')
  })

  it('ignores phases that have zero original tasks (can\'t compute %)', () => {
    const plan = { slug: 'plan-x', phases: [phase('F0')] }
    const inits = [
      init('i-f0', 'F0', [task('T-001', { provenance: { surfacedAt: '2026-05-15T00:00:00Z' } })]),
    ]
    const r = computeDrift(plan, inits)
    assert.equal(r.phasesGrew.length, 0)
    assert.equal(r.scopeExpansionPct, 0)
  })

  it('marks closed phases with closed: true so banner can skip them', () => {
    const plan = { slug: 'plan-x', phases: [phase('F0', { status: 'done' })] }
    const inits = [
      init('i-f0', 'F0', [
        task('T-001'),
        task('T-002', { provenance: { surfacedAt: '2026-05-15T00:00:00Z' } }),
      ]),
    ]
    const r = computeDrift(plan, inits)
    assert.equal(r.phasesGrew[0].closed, true)
  })
})

describe('computeDrift — plan-wide expansion', () => {
  it('computes overall scope expansion as added / original across all phases', () => {
    const plan = { slug: 'plan-x', phases: [phase('F0'), phase('F1')] }
    const inits = [
      init('i-f0', 'F0', [
        task('T-001'),
        task('T-002'),
        task('T-003', { provenance: { surfacedAt: '2026-05-15T00:00:00Z' } }),
      ]),
      init('i-f1', 'F1', [
        task('T-001'),
        task('T-002'),
        task('T-003', { provenance: { surfacedAt: '2026-05-15T00:00:00Z' } }),
        task('T-004', { provenance: { surfacedAt: '2026-05-15T00:00:00Z' } }),
      ]),
    ]
    const r = computeDrift(plan, inits)
    // 4 original (2 + 2) + 3 added (1 + 2) → 75% expansion
    assert.equal(r.scopeExpansionPct, 75)
  })
})

describe('computeDrift — parked zombies', () => {
  it('flags parked items older than threshold (default 30d)', () => {
    const now = new Date('2026-05-20T00:00:00Z')
    const plan = { slug: 'plan-x', phases: [phase('F0')] }
    const inits = [
      init('i-f0', 'F0', [task('T-001')], [
        { title: 'recent', surfacedAt: '2026-05-15T00:00:00Z' }, // 5d ago — not a zombie
        { title: 'medium', surfacedAt: '2026-04-15T00:00:00Z' }, // 35d ago — zombie
        { title: 'ancient', surfacedAt: '2025-12-01T00:00:00Z' }, // >5mo — zombie
      ]),
    ]
    const r = computeDrift(plan, inits, { now })
    assert.equal(r.parkedZombies.length, 2)
    assert.equal(r.parkedZombies[0].title, 'medium')
    assert.equal(r.parkedZombies[0].ageDays, 35)
    assert.equal(r.parkedZombies[1].title, 'ancient')
  })

  it('honors custom parkedZombieDays threshold', () => {
    const now = new Date('2026-05-20T00:00:00Z')
    const plan = { slug: 'plan-x', phases: [phase('F0')] }
    const inits = [
      init('i-f0', 'F0', [task('T-001')], [
        { title: 'week-old', surfacedAt: '2026-05-13T00:00:00Z' }, // 7d ago
      ]),
    ]
    // With 7-day threshold: 7-day-old IS at threshold (>= 7 days)
    const r = computeDrift(plan, inits, { now, thresholds: { parkedZombieDays: 7 } })
    assert.equal(r.parkedZombies.length, 1)
  })

  it('skips parked items with unparseable surfacedAt', () => {
    const plan = { slug: 'plan-x', phases: [phase('F0')] }
    const inits = [
      init('i-f0', 'F0', [task('T-001')], [
        { title: 'broken', surfacedAt: 'not-a-date' },
      ]),
    ]
    const r = computeDrift(plan, inits)
    assert.equal(r.parkedZombies.length, 0)
  })
})

describe('computeDrift — phases added mid-execution', () => {
  it('counts phase descriptors with provenance', () => {
    const plan = {
      slug: 'plan-x',
      phases: [
        phase('F0'),
        phase('F0.5', { provenance: { surfacedAt: '2026-05-15T00:00:00Z' } }),
        phase('F1'),
      ],
    }
    const r = computeDrift(plan, [])
    assert.equal(r.phasesAddedMidExecution, 1)
    assert.equal(r.totalPhases, 3)
  })
})

describe('evaluateWarnings', () => {
  it('warns when a phase exceeds growth threshold', () => {
    const r = {
      totalPhases: 1,
      phasesAddedMidExecution: 0,
      phasesGrew: [{ phaseId: 'F0', initiativeSlug: 'i', originalTaskCount: 2, addedTaskCount: 1, growthPct: 50, closed: false }],
      parkedZombies: [],
      scopeExpansionPct: 0,
    }
    const w = evaluateWarnings(r)
    assert.equal(w.shouldWarn, true)
    assert.match(w.reasons[0], /F0 \(\+50%\)/)
  })

  it('does not warn on closed phases even if they grew', () => {
    const r = {
      totalPhases: 1,
      phasesAddedMidExecution: 0,
      phasesGrew: [{ phaseId: 'F0', initiativeSlug: 'i', originalTaskCount: 2, addedTaskCount: 2, growthPct: 100, closed: true }],
      parkedZombies: [],
      scopeExpansionPct: 0,
    }
    const w = evaluateWarnings(r)
    assert.equal(w.shouldWarn, false)
  })

  it('warns on plan-wide expansion', () => {
    const r = {
      totalPhases: 2,
      phasesAddedMidExecution: 0,
      phasesGrew: [],
      parkedZombies: [],
      scopeExpansionPct: 30,
    }
    const w = evaluateWarnings(r)
    assert.equal(w.shouldWarn, true)
    assert.match(w.reasons[0], /scope expansion 30%/)
  })

  it('honors custom thresholds', () => {
    const r = {
      totalPhases: 1,
      phasesAddedMidExecution: 0,
      phasesGrew: [{ phaseId: 'F0', initiativeSlug: 'i', originalTaskCount: 10, addedTaskCount: 1, growthPct: 10, closed: false }],
      parkedZombies: [],
      scopeExpansionPct: 5,
    }
    assert.equal(evaluateWarnings(r).shouldWarn, false) // default threshold 40
    assert.equal(evaluateWarnings(r, { phaseGrowthPctWarn: 5 }).shouldWarn, true) // lowered to 5
  })

  it('warns when phases are added mid-execution regardless of size', () => {
    const r = {
      totalPhases: 3,
      phasesAddedMidExecution: 1,
      phasesGrew: [],
      parkedZombies: [],
      scopeExpansionPct: 0,
    }
    const w = evaluateWarnings(r)
    assert.equal(w.shouldWarn, true)
    assert.match(w.reasons[0], /1 phase\(s\) added mid-execution/)
  })
})

describe('renderBanner', () => {
  it('returns null when no warning', () => {
    const r = computeDrift({ slug: 'plan-x', phases: [phase('F0')] }, [
      init('i', 'F0', [task('T-001')]),
    ])
    assert.equal(renderBanner(r), null)
  })

  it('renders banner with reasons + run hint when warning', () => {
    const r = {
      totalPhases: 1,
      phasesAddedMidExecution: 0,
      phasesGrew: [{ phaseId: 'F0', initiativeSlug: 'i', originalTaskCount: 2, addedTaskCount: 2, growthPct: 100, closed: false }],
      parkedZombies: [],
      scopeExpansionPct: 100,
    }
    const banner = renderBanner(r)
    assert.match(banner, /^SCOPE DRIFT:/)
    assert.match(banner, /F0 \(\+100%\)/)
    assert.match(banner, /scope-creep/)
  })
})

describe('DEFAULT_THRESHOLDS', () => {
  it('is frozen so callers cannot accidentally tweak globals', () => {
    assert.ok(Object.isFrozen(DEFAULT_THRESHOLDS))
  })

  it('exposes the three documented thresholds', () => {
    assert.deepEqual(Object.keys(DEFAULT_THRESHOLDS).sort(), [
      'parkedZombieDays',
      'phaseGrowthPctWarn',
      'scopeExpansionPctWarn',
    ])
  })
})
