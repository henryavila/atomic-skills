---
schemaVersion: "0.1"
slug: implement-phase-agents-f3-decision-review-hardgate-on-phase-don
title: Decision-review hardgate on phase-done
goal: Machine-enforce that automate phase-done cannot complete without operator
  PASS on the phase decision log.
status: active
branch: plan/implement-phase-agents
started: 2026-07-23T09:15:05.378Z
lastUpdated: 2026-07-23T09:15:05.378Z
nextAction: "Start T-010: Schema field decisionReview on phase"
parentPlan: implement-phase-agents
phaseId: F3
businessIntent:
  value: "Sob automate, phase-done nao avanca sem operator PASS no decision log da
    fase: o hardgate decisionReview e machine-checkable e so o operador grava
    PASS."
  workflow: Schema+helper decisionReview (T-010) → wire canRunPhaseDone/assert
    (T-011) → procedimento PASS no maestro (T-012) → F4 ritual phase-start com
    fresh agent.
  rules: Agente nunca grava decisionReview PASS. evaluationGate e review-code both
    permanecem. Nao auto-stamp a partir de evaluation agent ou review receipt.
    FAIL grava failed e nao avanca currentPhase. Nao exigir decisionReview em
    plans sem executionMode automate.
  outOfScope: Layer 4 daemon; reescrever Mode 1/2; auto-PASS de gates manuais de
    produto; substituir evaluationGate ou review-code por decision-review.
  doneWhen: decision-review-gate testes verdes; canRunPhaseDone/assert greppable
    para decisionReview; procedimento maestro proibe host PASS sem token do
    operador no mesmo turno; Henry PASS em F3-G3.
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 3
weightDone: 0
weightTotal: 5
exitGates:
  - id: F3-G1
    description: decision-review gate unit tests pass.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/decision-review-gate.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/decision-review-gate.test.js"
  - id: F3-G2
    description: canRunPhaseDone and assert wiring mention decisionReview.
    status: pending
    verifier:
      kind: shell
      command: rg -n 'decisionReview|decision-review'
        src/automate-orchestrator-gates.js scripts/assert-automate-gate.js
      expectExitCode: 0
    verifierLabel: "shell: rg -n 'decisionReview|decision-review' src/automate-orchest…"
  - id: F3-G3
    description: Manual HARD — Henry confirms agent cannot stamp decision-review
      PASS in the documented procedure.
    status: pending
    verifier:
      kind: manual
      description: Henry PASS on F3 manual gate after reading PASS procedure.
    verifierLabel: manual
stack:
  - id: 1
    title: Decision-review hardgate on phase-done
    type: task
    openedAt: 2026-07-23T09:15:05.378Z
tasks:
  - id: T-010
    title: Schema field decisionReview on phase
    status: pending
    lastUpdated: 2026-07-23T09:15:05.378Z
    scopeBoundary:
      - Do not require decisionReview on non-automate plans. Do not allow
        agent-written PASS without operator field provenance.
    acceptance:
      - it - plan schema accepts optional phases decisionReview object with
        status pending or passed or failed and verifiedAt and optional
        evidencePath under automate phases.; it - decisionReviewAllowsPhaseDone
        pure helper returns false when executionMode automate and status is not
        passed.; it - Unit tests cover allow block and non-automate skip.; it -
        plans without the field still validate when not automate.
    verifier:
      kind: shell
      command: node --test tests/decision-review-gate.test.js
        tests/validate-state.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: meta/schemas/plan.schema.json
      - kind: file
        path: src/decision-review-gate.js
      - kind: file
        path: tests/decision-review-gate.test.js
      - kind: file
        path: tests/validate-state.test.js
    summary: Schema e helper decisionReviewAllowsPhaseDone com testes.
    weight: 2
  - id: T-011
    title: Wire canRunPhaseDone and assert gate
    status: pending
    lastUpdated: 2026-07-23T09:15:05.378Z
    scopeBoundary:
      - Do not remove evaluationGate requirement under automate. Do not
        auto-stamp decisionReview from evaluation agent.
    acceptance:
      - it - canRunPhaseDone requires decisionReviewAllowsPhaseDone when plan
        executionMode is automate.; it - assert-automate-gate phase-done fails
        closed without decisionReview passed under automate.; it -
        project-transitions phase-done prose states operator PASS on decision
        log before advance under automate.; it - Unit tests cover blocked and
        allowed matrix.
    verifier:
      kind: shell
      command: node --test tests/automate-orchestrator-gates.test.js
        tests/decision-review-gate.test.js && rg -n
        'decisionReview|decision-review' src/automate-orchestrator-gates.js
        scripts/assert-automate-gate.js
        skills/shared/project-assets/project-transitions.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/automate-orchestrator-gates.js
      - kind: file
        path: scripts/assert-automate-gate.js
      - kind: file
        path: tests/automate-orchestrator-gates.test.js
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
    summary: Wire canRunPhaseDone e assert-automate-gate com decisionReview.
    weight: 2
  - id: T-012
    title: Operator PASS procedure in maestro
    status: pending
    lastUpdated: 2026-07-23T09:15:05.378Z
    scopeBoundary:
      - Do not let evaluation agent or review-code receipt substitute for
        decision-review PASS.
    acceptance:
      - it - Fixed order under automate includes decision-review operator PASS
        after evaluation and before or as part of phase-done preflight.; it -
        Procedure forbids host writing PASS without explicit operator token in
        the same turn.; it - FAIL path records failed status and does not
        advance currentPhase.
    verifier:
      kind: manual
      description: Henry PASS on F3 manual gate after reading PASS procedure.
    outputs:
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-decision-log.md
    summary: Procedimento operator PASS no maestro; proibe agent stamp.
    weight: 1
parked: []
emerged: []
startedCommit: 3878067e3337e8a01f8b6e4c465122635ce42b14
planTitle: Implement phase agents (host-thin automate)
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F3 — Decision-review hardgate on phase-done**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F3 materialized after F2 phase-done. Phase-start package: decisionReview schema + canRunPhaseDone/assert wire + operator PASS procedure. BI draft validate-only ratified. Ready for pure-maestro phase writer T-010..T-012.
- **Decision log:** F3 BI drafted and ratified (operator ratify on materialize f3). Lessons: none. Sidecar age fresh. F2 done dependency satisfied.
- **Single nextAction:** Run implement pure-maestro for F3 (spawn code-only phase writer T-010..T-012).
- **Verbatim state:** phaseId=F3; slug=implement-phase-agents-f3-decision-review-hardgate-on-phase-don; executionMode=automate; currentPhase=F3; tasks T-010 T-011 T-012 pending; startedCommit=3878067e3337e8a01f8b6e4c465122635ce42b14.
- **Uncommitted changes:** materialize checkpoint pending commit.

