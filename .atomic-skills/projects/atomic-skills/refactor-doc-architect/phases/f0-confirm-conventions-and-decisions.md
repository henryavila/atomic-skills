---
schemaVersion: "0.1"
slug: refactor-doc-architect-f0-confirm-conventions-and-decisions
title: Confirm conventions and decisions
goal: Lock the target skill layout against an existing atomic-skill and resolve
  the four open decisions before any file is moved.
status: paused
branch: main
started: 2026-05-31T20:37:21.595Z
lastUpdated: 2026-05-31T20:37:21.595Z
nextAction: "Start T-001: Read an existing atomic-skill end to end"
parentPlan: refactor-doc-architect
phaseId: F0
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: an existing skill's layout is documented as the template to follow;
      D1-D3 each have a recorded answer; and D4 has produced a concrete
      criteria-based F5 acceptance rubric with an archived baseline (original
      ad-hoc doc + pipeline doc + module SHA) and explicit pass/fail thresholds.
    status: pending
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
stack:
  - id: 1
    title: Confirm conventions and decisions
    type: task
    openedAt: 2026-05-31T20:37:21.595Z
tasks:
  - id: T-001
    title: Read an existing atomic-skill end to end
    description: "Inspect a skill under `skills/` to lock the exact layout: SKILL.md
      frontmatter shape, where step/reference files live, and the
      `skills/shared/<name>-assets/` convention."
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
  - id: T-002
    title: Resolve decisions D1-D4 with the user
    description: "D1 standard tie-break (house standard wins on structure, template
      wins on extraction depth). D2 stack scope (Laravel + Nova only for v1;
      Filament is reference pattern, not drop-in). D3 type-purity rubric source
      (target repo's convention, not Laravel's). D4 — PRODUCE a concrete,
      criteria-based acceptance rubric for F5 (codex F-003): not optional.
      Archive the bake-off baseline (original ad-hoc doc + pipeline doc + target
      module SHA) and define explicit pass/fail criteria + thresholds (accuracy,
      completeness, type-purity). If the original comparison was holistic, F0
      still authors the rubric here — F5 has no alternate gate, so a missing D4
      rubric blocks F5. Hard precondition before F1 starts."
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
  - id: T-003
    title: Confirm target location and slug
    description: Propose `skills/modules/architect-doc/` plus
      `skills/shared/architect-doc-assets/`; confirm naming against the registry
      style.
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
parked: []
emerged: []
summary: Trava o layout-alvo da skill contra um atomic-skill existente e resolve
  as 4 decisões abertas antes de mover arquivos.
planTitle: Refactor doc-architect into an atomic-skill
---

# Narrative / notes

Initiative for phase **F0 — Confirm conventions and decisions**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
