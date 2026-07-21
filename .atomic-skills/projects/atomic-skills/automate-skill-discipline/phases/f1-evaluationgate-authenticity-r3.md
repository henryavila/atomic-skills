---
schemaVersion: "0.1"
slug: automate-skill-discipline-f1-evaluationgate-authenticity-r3
title: evaluationGate authenticity (R3)
goal: "Make evaluationGate forge-resistant: passed requires evaluationReport
  path on disk; skipped requires operatorSkip + non-empty reason; GATE-R4 and
  phaseEvaluationAllowsClose share one honesty definition; buildEvaluationGate
  and skill evaluator asset updated."
status: active
branch: plan/automate-skill-discipline
started: 2026-07-21T19:52:11.625Z
lastUpdated: 2026-07-21T19:52:11.625Z
nextAction: "Start T-003: Schema and pure honesty for evaluation report pointer"
parentPlan: automate-skill-discipline
phaseId: F1
businessIntent:
  value: "evaluationGate deixa de aceitar forge: passed exige evaluationReport no
    disco; skipped so com operatorSkip+reason; GATE-R4 e
    phaseEvaluationAllowsClose usam a mesma honesty — pure-maestro Step F vira
    fail-closed de verdade."
  workflow: TDD schema+helpers (T-003) depois prosa/buildEvaluationGate (T-004);
    validate-state e phase-evaluation-gate compartilham predicado; sem auto-run
    do evaluation agent.
  rules: Nao exigir evaluationGate em planos non-automate; nao mudar
    planEndReview; nao Layer 4; campos additive reportPath/operatorSkip; skipped
    so com operatorSkip true + reason nao-vazio.
  outOfScope: claim-bound done (F2); maestro cursor (F3); pause entre fases (F4);
    auto-finalize; evaluation agent que escreve state.
  doneWhen: Testes phase-evaluation-gate + validate-state-evaluation-gate verdes;
    prosa reportPath/operatorSkip e antipattern forge; F1-G1/F1-G2 met.
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: F1-G1
    description: Authenticity unit tests and GATE-R4 path pass.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/phase-evaluation-gate.test.js
        tests/validate-state-evaluation-gate.test.js
      expectExitCode: 0
  - id: F1-G2
    description: Prose forbids forge and documents reportPath/operatorSkip.
    status: pending
    verifier:
      kind: shell
      command: rg -n 'reportPath|operatorSkip'
        skills/shared/implement-phase-evaluator.md
        skills/shared/implement-automate-maestro.md && rg -n 'forging
        evaluationGate|operatorSkip' skills/shared/implement-antipatterns.md
      expectExitCode: 0
stack:
  - id: 1
    title: evaluationGate authenticity (R3)
    type: task
    openedAt: 2026-07-21T19:52:11.625Z
tasks:
  - id: T-003
    title: Schema and pure honesty for evaluation report pointer
    status: pending
    lastUpdated: 2026-07-21T19:52:11.625Z
    scopeBoundary:
      - Do not require evaluationGate on non-automate plans. Do not change
        planEndReview shape. Do not invent Layer 4. Prefer additive schema
        fields (reportPath, operatorSkip) with additionalProperties false
        updated carefully.
    acceptance:
      - it - evaluationGate schema allows reportPath string and operatorSkip
        boolean with documented required-when rules.; it -
        phaseEvaluationAllowsClose rejects status passed without non-empty
        reportPath when authenticity flag or durable automate honesty mode is on
        (default on for automate).; it - rejects status skipped without
        operatorSkip true and non-empty reason.; it - accepts passed with
        reportPath and verdict pass and accepts skipped only with
        operatorSkip+reason.; it - GATE-R4 / checkEvaluationGate uses the same
        honesty helper (no divergent prose rules).; it - legacy retroactive
        skips remain expressible only via operatorSkip+reason (document
        migration note in test or comment).; it - unit tests cover forge cases.
    verifier:
      kind: shell
      command: node --test tests/phase-evaluation-gate.test.js
        tests/validate-state-evaluation-gate.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: meta/schemas/plan.schema.json
      - kind: file
        path: src/phase-evaluation-gate.js
      - kind: file
        path: tests/phase-evaluation-gate.test.js
      - kind: file
        path: scripts/validate-state.js
      - kind: file
        path: tests/validate-state-evaluation-gate.test.js
  - id: T-004
    title: Evaluator asset and buildEvaluationGate write reportPath
    status: pending
    lastUpdated: 2026-07-21T19:52:11.625Z
    scopeBoundary:
      - Do not auto-run evaluation agent. Do not write product source from
        evaluator. Do not finalize on evaluation pass.
    acceptance:
      - it - buildEvaluationGate for passed requires or records reportPath.; it
        - evaluator asset mandates writing evaluationReport under
        .atomic-skills/reviews/ (or documented path) before orchestrator stamps
        gate.; it - antipatterns ban forging evaluationGate passed without
        report and inventing skip without operator.; it - maestro Step F/G
        references authenticity rules.
    verifier:
      kind: shell
      command: rg -n 'reportPath|operatorSkip'
        skills/shared/implement-phase-evaluator.md
        skills/shared/implement-automate-maestro.md && rg -n 'forging
        evaluationGate|operatorSkip' skills/shared/implement-antipatterns.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/phase-evaluation-gate.js
      - kind: file
        path: skills/shared/implement-phase-evaluator.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-antipatterns.md
parked: []
emerged: []
---

# Narrative / notes

Initiative for phase **F1 — evaluationGate authenticity (R3)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** Pure-maestro continues: F0 done; F1 materialized by orchestrator (businessIntent from ratified plan source + operator automate mandate). Spawning phase writer for T-003+T-004.
- **Decision log:** Under automate, materialize is maestro Step H — operator does not run materialize by hand. Spine filled from plan source F1 goal (not invented beyond ratified remediation plan).
- **Single nextAction:** Phase writer implements T-003 then T-004; orchestrator merges, re-verifies, done, evaluate, phase-done.
- **Verbatim state:** executionMode=automate; currentPhase=F1; initiative=f1-evaluationgate-authenticity-r3.md; tasks T-003 T-004 pending.
- **Uncommitted changes:** clean after materialize checkpoint.

