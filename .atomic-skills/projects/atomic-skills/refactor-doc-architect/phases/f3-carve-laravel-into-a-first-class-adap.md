---
schemaVersion: "0.1"
slug: refactor-doc-architect-f3-carve-laravel-into-a-first-class-adap
title: Carve Laravel into a first-class adapter
goal: Isolate the stack-specific extraction knowledge behind one Laravel adapter
  while keeping its depth intact. This is the genuine engineering of the
  refactor, because coupling is both delegated and inlined.
status: pending
branch: main
started: 2026-05-31T20:37:21.595Z
lastUpdated: 2026-05-31T20:37:21.595Z
nextAction: "Start T-001: Consolidate extraction guides into the adapter"
parentPlan: refactor-doc-architect
phaseId: F3
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: the framework-agnostic `steps/` carry no inlined Laravel symbols,
      and all stack specifics live in `references/adapters/laravel.md` with its
      depth preserved.
    status: pending
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
stack:
  - id: 1
    title: Carve Laravel into a first-class adapter
    type: task
    openedAt: 2026-05-31T20:37:21.595Z
tasks:
  - id: T-001
    title: Consolidate extraction guides into the adapter
    description: "Move
      `references/extraction-{flows,permissions,validations,user-guide}.md` (and
      business-rules extraction) into `references/adapters/laravel.md` (or a
      `laravel/` dir). `verified_by: source step-05-flows frontmatter delegates
      via extractionGuide: references/extraction-flows.md`."
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
  - id: T-002
    title: De-inline framework assumptions from steps
    description: "Replace inlined Laravel/Eloquent specifics in the steps with
      generic prompts that delegate to the adapter — for example step-05
      hardcodes `State`/`Transition` classes and `$name/$label/$color`. Audit
      every Laravel mention across `steps/01,02,04,05,06a`, `steps/07b,07d`,
      `discover-architecture.md`, `init.md`, `module-status.md`,
      `references/memory-system.md`, `references/verification-checklist.md`.
      `verified_by: grep -il laravel|filament|spatie|eloquent|nova across source
      → 18 files including those steps`."
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
  - id: T-003
    title: Document the adapter seam
    description: "State explicitly that `references/adapters/laravel.md` is the one
      shipped adapter and how a second stack would plug in, so the seam is
      visible without building adapter #2."
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
parked: []
emerged: []
summary: Isola o conhecimento de extração Laravel atrás de um adapter de
  primeira classe, mantendo a profundidade.
planTitle: Refactor doc-architect into an atomic-skill
---

# Narrative / notes

Initiative for phase **F3 — Carve Laravel into a first-class adapter**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
