---
schemaVersion: "0.2"
slug: phase-materialization-f4-fire-points-backstop-do-implement-re-q
projectId: atomic-skills
parentPlan: phase-materialization
lessons:
  - id: L-001
    statement: Phase-transition prose can accidentally instruct agents to write
      fields that the state schema rejects.
    corrective: Locus - project transition docs and state mutation instructions.
      Before telling future agents to update plan phase descriptors, cross-check
      the target schema; descriptor timestamps belong at the plan root or
      initiative level, not inside `phases[]`.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-07-01-1825-phase-materialization-f4.md
    createdAt: 2026-07-01T18:25:06.000Z
    validatedAt: 2026-07-01T18:25:06.000Z
---

# Lessons - F4 Fire points + backstop do implement + re-question events

Distilled at F4 phase-done from the local review finding fixed in
`fe74783bda02e3bd604db183ac61fa02f75e80ce`.
