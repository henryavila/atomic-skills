---
schemaVersion: "0.1"
slug: automate-skill-discipline-f4-phase-pause-framing-and-residual-d
title: Phase pause, framing, and residual discipline (R5 + P1)
goal: After phase-done under automate, block next-phase spawn until operator
  continue; branch Mindset Mode-1 vs Automate; close residual antipatterns; view
  surfaces pause/plan-end if cheap.
status: active
branch: plan/automate-skill-discipline
started: 2026-07-21T20:16:16.227Z
lastUpdated: 2026-07-21T20:16:16.227Z
nextAction: "Start T-009: Awaiting-operator-advance pause after phase-done"
parentPlan: automate-skill-discipline
phaseId: F4
businessIntent:
  value: Apos phase-done sob automate, spawn da proxima fase bloqueia ate operator
    continue; framing Mode-1 vs Automate e antipatterns residual fecham a
    disciplina.
  workflow: T-009 pause awaiting-operator-advance no cursor+assert+transitions;
    T-010 framing mindset e antipatterns pack.
  rules: Nao auto-materialize; nao auto-finalize; continue token explicito;
    non-automate phase-done inalterado.
  outOfScope: Mode 2 rewrite; install surface; Layer 4.
  doneWhen: Pause tests+greps verdes; framing pure maestro vs execution driver;
    F4-G1/G2 met.
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: F4-G1
    description: Pause and framing greps plus cursor/assert tests pass.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/maestro-cursor.test.js
        tests/assert-automate-gate.test.js && rg -n 'awaiting-operator-advance'
        skills/core/implement.md skills/shared/implement-automate-maestro.md &&
        rg -n 'pure maestro|execution driver' skills/core/implement.md
      expectExitCode: 0
  - id: F4-G2
    description: No top-level automate skill; validate-state still green on fixture
      plans used in tests.
    status: pending
    verifier:
      kind: shell
      command: test ! -e skills/core/automate.md && node --test
        tests/phase-evaluation-gate.test.js tests/assert-automate-gate.test.js
      expectExitCode: 0
stack:
  - id: 1
    title: Phase pause, framing, and residual discipline (R5 + P1)
    type: task
    openedAt: 2026-07-21T20:16:16.227Z
tasks:
  - id: T-009
    title: Awaiting-operator-advance pause after phase-done
    status: pending
    lastUpdated: 2026-07-21T20:16:16.227Z
    scopeBoundary:
      - Do not auto-materialize next phase. Do not auto-finalize. Operator must
        explicitly continue; generic ok is not enough if project ratify rules
        apply — document continue token.
    acceptance:
      - it - successful phase-done under automate sets cursor step or flag
        awaiting-operator-advance.; it - assert spawn / implement Step A under
        automate refuses while awaiting-operator-advance until clear-continue
        helper runs.; it - continue path is documented (implement re-entry or
        explicit flag) and unit-tested.; it - non-automate phase-done unchanged.
    verifier:
      kind: shell
      command: node --test tests/maestro-cursor.test.js
        tests/assert-automate-gate.test.js && rg -n 'awaiting-operator-advance'
        skills/shared/implement-automate-maestro.md
        skills/shared/project-assets/project-transitions.md
        skills/core/implement.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/maestro-cursor.js
      - kind: file
        path: scripts/assert-automate-gate.js
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: tests/maestro-cursor.test.js
      - kind: file
        path: tests/assert-automate-gate.test.js
  - id: T-010
    title: Framing Mindset and antipatterns residual pack
    status: pending
    lastUpdated: 2026-07-21T20:16:16.227Z
    scopeBoundary:
      - Do not rewrite Mode 2 codex lane. Do not change install surface beyond
        docs. View changes read-only.
    acceptance:
      - it - implement Mindset explicitly branches Mode 1 execution driver vs
        Automate pure maestro orchestrator-only.; it - antipatterns include
        forge evaluationGate, silent Mode-1 under stamp, rm lease file,
        auto-materialize businessIntent, multi-phase auto-run, finalize without
        userValidatedAt.; it - project-view or drift surfaces
        awaiting-operator-advance or points at assert when stamp automate
        (read-only).; it - realism KB operator model mentions assert + cursor +
        pause.
    verifier:
      kind: shell
      command: test ! -e skills/core/automate.md && node --test
        tests/phase-evaluation-gate.test.js tests/assert-automate-gate.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-antipatterns.md
      - kind: file
        path: skills/shared/project-assets/project-view.md
      - kind: file
        path: docs/kb/automate-orchestrator-realism.md
parked: []
emerged: []
---

# Narrative / notes

Initiative for phase **F4 — Phase pause, framing, and residual discipline (R5 + P1)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F4 last phase pure-maestro.
- **Decision log:** Auto materialize.
- **Single nextAction:** Writer T-009 T-010.
- **Verbatim state:** F4 active.
- **Uncommitted changes:** clean after commit.
