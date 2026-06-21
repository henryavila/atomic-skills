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
    spawnedPlans:
      - fixture-child
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

Inline-elo fixture (F5/T-003). The parent→child edge (`spawnedPlans`) lives
INLINE on the anchor phase descriptor above (`phases[F0].spawnedPlans`) — the
aiDeck consumer (fork-fields release) declares it as an optional, additive
field. The legacy `links.json` sidecar is retired for the elo.
