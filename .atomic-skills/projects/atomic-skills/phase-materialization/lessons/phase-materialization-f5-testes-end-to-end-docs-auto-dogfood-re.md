---
schemaVersion: "0.2"
slug: phase-materialization-f5-testes-end-to-end-docs-auto-dogfood-re
projectId: atomic-skills
parentPlan: phase-materialization
lessons:
  - id: L-001
    statement: Lifecycle e2e tests can false-green when they assert pre-action file
      lists instead of post-transition filesystem/state.
    corrective: Locus - lifecycle transition tests. Assert materialized vs
      descriptor-only phase state from the mutated tree after the transition
      action runs.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-07-01-2051-phase-materialization-f5.md
    createdAt: 2026-07-01T21:05:39.338Z
    validatedAt: 2026-07-01T21:05:39.338Z
---

# Lessons - F5 Testes end-to-end + docs + auto-dogfood/review

Distilled at F5 phase-done from the local review finding fixed before closure.

Ratified by the user on 2026-07-01T21:05:39.338Z.
