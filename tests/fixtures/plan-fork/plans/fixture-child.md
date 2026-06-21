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
spawnedFrom:
  plan: fixture-parent
  phaseId: F0
  mode: pause
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

Inline-elo fixture (F5/T-003). The child→parent edge (`spawnedFrom`) lives
INLINE in the frontmatter above — the aiDeck consumer (fork-fields release)
declares it as an optional, additive field, so it no longer drops the card. The
legacy `links.json` sidecar is retired for the elo.
