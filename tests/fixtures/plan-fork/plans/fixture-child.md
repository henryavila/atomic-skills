---
schemaVersion: "0.1"
slug: fixture-child
title: "Fixture child plan (plan-fork sidecar test)"
version: "1.0"
status: active
started: 2026-06-19T17:00:00.000Z
lastUpdated: 2026-06-19T17:00:00.000Z
currentPhase: F0
parallelismAllowed: false
phases:
  - id: F0
    slug: fixture-child-f0
    title: Fixture child phase
    goal: The first phase of a plan forked from fixture-parent.
    dependsOn: []
    subPhaseCount: 1
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F0-G1
          description: Fixture criterion.
          status: pending
          verifier:
            kind: manual
            description: fixture
    status: active
    summary: Fixture child phase.
planActive: true
planTitle: "Fixture child plan (plan-fork sidecar test)"
---

# Fixture child plan

Sidecar-link fixture. The child→parent edge (`spawnedFrom`) lives in this plan's
`links.json`, NOT in the frontmatter above — the frontmatter stays clean under
the aiDeck 0.1.0 `.strict` consumer.
