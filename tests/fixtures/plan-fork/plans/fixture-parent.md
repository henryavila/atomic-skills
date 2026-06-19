---
schemaVersion: "0.1"
slug: fixture-parent
title: "Fixture parent plan (plan-fork sidecar test)"
version: "1.0"
status: active
started: 2026-06-19T17:00:00.000Z
lastUpdated: 2026-06-19T17:00:00.000Z
currentPhase: F0
parallelismAllowed: false
phases:
  - id: F0
    slug: fixture-parent-f0
    title: Fixture anchor phase
    goal: A fixture anchor phase from which a child plan is forked.
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
    summary: Fixture anchor phase.
planActive: true
planTitle: "Fixture parent plan (plan-fork sidecar test)"
---

# Fixture parent plan

Sidecar-link fixture. The parent→child edge (`spawnedPlans`) lives in this
plan's `links.json`, NOT in the frontmatter above — the frontmatter stays clean
under the aiDeck 0.1.0 `.strict` consumer.
