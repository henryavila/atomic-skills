---
schemaVersion: "0.1"
slug: automate-default-and-operator-gates-f4-receipt-auth
title: Receipt authenticity and close-path integrity
goal: Fail-closed authenticity for phase review dual-leg and evaluation floors;
  major disposition tokens; decision-log statusRoot normalize; phase-done
  mirror/assert path (no host hand-edit).
summary: "Hardening: authenticity de review dual-leg, disposition e integrity do
  phase-done."
status: active
branch: plan/automate-default-and-operator-gates
started: 2026-07-27T08:19:56.073Z
lastUpdated: 2026-07-27T08:19:56.073Z
nextAction: "Start T-001: Phase review dual-leg authenticity floor"
parentPlan: automate-default-and-operator-gates
phaseId: F4
businessIntent:
  value: Fases sob automate não podem carimbar reviewGate/evaluationGate passed
    com receipt stub ou disposition major sem token do operador; phase-done não
    deixa archive com exitGates mentindo; decision-log não aceita statusRoot que
    duplica projects/.
  workflow: "TDD: authenticity floor em phase-review-gate (dual path, min size,
    non-binary); evaluation content floor; disposition major exige token
    operator (decline != accept); decisionLogPath normaliza statusRoot; assert
    mirror exitGates + validate-state no dir do plan e antipattern hand-edit
    phase-done; prosa maestro/transitions; testes unitários e greps de prosa."
  rules: "Floor médio (não parser full codex). Não auto-merge. Não reabrir F0–F3.
    Fora: post-merge Playwright, session-break, phase-done-apply script
    completo, Layer 4. Host-thin permanece."
  outOfScope: Post-merge e2e re-run (Cluster B); claims durable path;
    session-break AskUserQuestion; phase-done-apply atômico completo; forçar 2
    external providers; backlog produto Lekto; auto-PASS decision-review.
  doneWhen: phase-done sob automate falha com stub/corrupt dual-leg; evaluation
    thin sem floor falha; major sem disposition token bloqueia; statusRoot
    double-projects rejeitado; mirror exitGates assert + prosa canônica; F4-G*
    met.
tasksDone: 0
tasksTotal: 5
gatesMet: 0
gatesTotal: 4
exitGates:
  - id: F4-G1
    description: phase-review authenticity tests pass (dual leg, min size,
      non-binary reject stub/corrupt).
    status: pending
    verifier:
      kind: shell
      command: node --test tests/phase-review-gate.test.js
        tests/phase-review-authenticity.test.js 2>/dev/null; node --test
        tests/phase-review-gate.test.js
      expectExitCode: 0
  - id: F4-G2
    description: decision-log statusRoot normalize tests pass; double projects path
      rejected or fixed.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/decision-log.test.js
      expectExitCode: 0
  - id: F4-G3
    description: Prose requires present dual-leg authenticity, disposition token,
      canonical phase-done (no hand-edit).
    status: pending
    verifier:
      kind: shell
      command: rg -n
        'authenticity|dual-leg|non-binary|disposition|statusRoot|hand-edit|mirror'
        skills/shared/implement-automate-maestro.md
        skills/shared/implement-antipatterns.md
        skills/shared/project-assets/project-transitions.md
        src/phase-review-gate.js src/decision-log.js
      expectExitCode: 0
  - id: F4-G4
    description: assert or unit tests cover exitGate mirror / terminal pending block
      under automate close.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/phase-done-mirror.test.js
        tests/lifecycle-order-guard.test.js 2>/dev/null; rg -n
        'exitGate|mirror|terminal-pending' src/ scripts/ tests/
      expectExitCode: 0
stack:
  - id: 1
    title: Receipt authenticity and close-path integrity
    type: task
    openedAt: 2026-07-27T08:19:56.073Z
tasks:
  - id: T-001
    title: Phase review dual-leg authenticity floor
    summary: Fail-closed dual-leg review receipts (anti-stub).
    status: pending
    lastUpdated: 2026-07-27T08:19:56.073Z
    scopeBoundary:
      - "Medium floor only: dual receipt paths, min size, non-binary. Do not
        full-parse codex MB transcripts. Do not force two external providers at
        plan-end."
    acceptance:
      - it - phaseReviewAllowsClose or honesty helper rejects one-line stub
        codex/local under mode both.; it - rejects binary/null-byte receipt
        content.; it - accepts dual non-stub receipts with min size and CLEAN or
        findings.; it - unit tests cover stub reject and real dual accept.; it -
        maestro Step G prose states dual-leg authenticity under automate.
    verifier:
      kind: shell
      command: node --test tests/phase-review-gate.test.js && rg -n
        'authenticity|dual-leg|non-binary|stub' src/phase-review-gate.js
        skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/phase-review-gate.js
      - kind: file
        path: tests/phase-review-gate.test.js
      - kind: file
        path: skills/shared/implement-automate-maestro.md
    weight: 3
  - id: T-002
    title: Evaluation report content floor
    summary: EvaluationGate thin report fails closed under automate.
    status: pending
    lastUpdated: 2026-07-27T08:19:56.073Z
    scopeBoundary:
      - Extend evaluation authenticity beyond empty reportPath pointer. Do not
        re-run full BI semantic re-eval. Do not replace F2 intentVsDelivered.
    acceptance:
      - it - evaluationGate passed requires report file exists with min content
        keys or min bytes.; it - thin 2-line verdict-only fails floor under
        automate.; it - unit tests cover thin reject and structured accept.; it
        - implement-phase-evaluator prose documents floor.
    verifier:
      kind: shell
      command: node --test tests/phase-evaluation-gate.test.js && rg -n
        'reportPath|floor|min' src/phase-evaluation-gate.js
        skills/shared/implement-phase-evaluator.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/phase-evaluation-gate.js
      - kind: file
        path: tests/phase-evaluation-gate.test.js
      - kind: file
        path: skills/shared/implement-phase-evaluator.md
    weight: 2
  - id: T-003
    title: Major disposition requires operator token
    summary: Major findings need explicit operator disposition token.
    status: pending
    lastUpdated: 2026-07-27T08:19:56.073Z
    scopeBoundary:
      - Do not auto-PASS decision-review. Decline of AskUserQuestion is not
        accept. Do not invent dispositions.
    acceptance:
      - it - open major findings block phase-done without review-disposition
        accept or defer or fix token from operator.; it - host judgment accept
        after decline fails gate.; it - decision-log and maestro prose state
        decline is not accept.; it - unit or gate tests cover disposition
        required path.
    verifier:
      kind: shell
      command: rg -n 'disposition|accept|defer|decline'
        skills/shared/implement-decision-log.md
        skills/shared/implement-automate-maestro.md src/decision-review-gate.js
        src/automate-orchestrator-gates.js && node --test
        tests/decision-review-gate.test.js
        tests/automate-orchestrator-gates.test.js 2>/dev/null; node --test
        tests/automate-orchestrator-gates.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/automate-orchestrator-gates.js
      - kind: file
        path: skills/shared/implement-decision-log.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
    weight: 3
  - id: T-004
    title: decisionLog statusRoot normalize
    summary: Reject double-projects statusRoot on decision log.
    status: pending
    lastUpdated: 2026-07-27T08:19:56.073Z
    scopeBoundary:
      - Do not change JSONL entry schema fields. Do not move log outside
        projects tree.
    acceptance:
      - it - statusRoot ending in projects/id is rejected or normalized to
        status root without double projects.; it - canonical path remains
        statusRoot/projects/id/slug/decisions/phase.jsonl.; it - unit tests
        cover bad statusRoot and happy path.; it - docs mention statusRoot must
        be .atomic-skills root.
    verifier:
      kind: shell
      command: node --test tests/decision-log.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/decision-log.js
      - kind: file
        path: tests/decision-log.test.js
      - kind: file
        path: docs/kb/implement-decision-log.md
    weight: 2
  - id: T-005
    title: Phase-done mirror exitGates assert and antipattern
    summary: Assert exitGate mirror; ban host hand-edit phase-done.
    status: pending
    lastUpdated: 2026-07-27T08:19:56.073Z
    scopeBoundary:
      - Assert + prose + validate-state plan dir. Do not implement full
        phase-done-apply atomic script (P1-a deferred). Do not auto-repair Lekto
        historical archives unless opt-in later.
    acceptance:
      - it - helper or guard fails when plan criteria met but initiative
        exitGates pending before archive.; it - project-transitions and
        antipatterns forbid hand-edit phase-done under automate.; it - prose
        requires validate-state on plan directory before advance commit.; it -
        unit or integration tests cover mirror pending block.
    verifier:
      kind: shell
      command: rg -n 'mirror|hand-edit|validate-state|exitGate'
        skills/shared/project-assets/project-transitions.md
        skills/shared/implement-antipatterns.md src/ && node --test
        tests/lifecycle-order-guard.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/implement-antipatterns.md
      - kind: file
        path: src/lifecycle-order-guard.js
      - kind: file
        path: tests/lifecycle-order-guard.test.js
    weight: 3
parked: []
emerged: []
---
# F4 Receipt authenticity

## Session handoff

- **Narrative:** F4 materialized after package ratify.
- **Single nextAction:** Start T-001: Phase review dual-leg authenticity floor

