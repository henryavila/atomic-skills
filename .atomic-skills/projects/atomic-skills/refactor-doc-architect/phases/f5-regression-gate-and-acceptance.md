---
schemaVersion: "0.1"
slug: refactor-doc-architect-f5-regression-gate-and-acceptance
title: Regression gate and acceptance
goal: Prove the refactored skill still beats ad-hoc generation and emits a
  conformant, verifiable doc set.
status: pending
branch: main
started: 2026-05-31T20:37:21.595Z
lastUpdated: 2026-05-31T20:37:21.595Z
nextAction: "Start T-001: Re-run the refactored skill on the original module"
parentPlan: refactor-doc-architect
phaseId: F5
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: the regression run passes the concrete criteria-based rubric
      produced in F0/D4 (with its archived baseline), and the verification
      checklist reports zero unresolved cross-step references or uncited claims.
    status: pending
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
stack:
  - id: 1
    title: Regression gate and acceptance
    type: task
    openedAt: 2026-05-31T20:37:21.595Z
tasks:
  - id: T-001
    title: Re-run the refactored skill on the original module
    description: Run it on the same `../arch` module against the baseline archived
      by F0/D4 (original ad-hoc doc + pipeline doc + pinned module SHA), so the
      comparison is reproducible and falsifiable (codex F-003).
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
  - id: T-002
    title: Verify acceptance criteria
    description: Refactored pipeline passes the concrete criteria-based rubric
      PRODUCED in F0/D4 (which always exists by F0's exit gate — no
      conditional); every cross-step reference resolves (markdown has no
      compiler, so a broken 'as found in step 03' reference fails silently —
      gate via the ported `verification-checklist.md`); 6 Diataxis-typed files
      emitted; every load-bearing claim carries a resolvable `file:line`
      citation per F4.
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
parked: []
emerged: []
summary: "Gate de regressão + aceitação: prova que a skill refatorada supera a
  geração ad-hoc e emite docs conformes/verificáveis."
planTitle: Refactor doc-architect into an atomic-skill
---

# Narrative / notes

Initiative for phase **F5 — Regression gate and acceptance**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
