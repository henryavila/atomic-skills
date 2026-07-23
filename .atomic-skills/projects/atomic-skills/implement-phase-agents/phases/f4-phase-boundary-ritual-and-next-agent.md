---
schemaVersion: "0.1"
slug: implement-phase-agents-f4-phase-boundary-ritual-and-next-agent
title: Phase boundary ritual and next agent
goal: After phase-done and at every phase start, automate presents objective +
  tasks + drafted BI for operator validation, then spawns a fresh phase agent —
  never a blank BI form.
status: active
branch: plan/implement-phase-agents
started: 2026-07-23T11:07:12.097Z
lastUpdated: 2026-07-23T11:07:12.097Z
nextAction: "Start T-013: Step H and phase-start package ritual"
parentPlan: implement-phase-agents
phaseId: F4
businessIntent:
  value: Sob automate, a cada phase-start o skill apresenta package (objetivo +
    tasks id/title + businessIntent rascunhado) para o operador so validar; apos
    ratify, spawna agente fresco — nunca formulario BI em branco nem reuso de
    contexto do writer anterior.
  workflow: Ritual Step H / phase-start package no maestro (T-013) → materialize
    orquestrado no package + KB lazy (T-014) → F5 fixtures/dogfood.
  rules: Nunca silent auto-PASS de BI draft. Nunca spawn writer antes de ratify do
    package. Nao alterar HARD de find-weak-business-intent. Handoff nextAction
    unico obrigatorio no boundary. decision-review e host-thin permanecem.
  outOfScope: Layer 4 daemon; reescrever Mode 1/2; auto-PASS de gates manuais de
    produto; host coding da fase antes do ratify.
  doneWhen: Strings phase-start/draft/validate-only/businessIntent greppable em
    maestro+implement; KB lazy menciona
    host-thin/decision-review/phase-start/draft; F4-G1 e F4-G2 metiveis.
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: F4-G1
    description: Phase-start package and draft BI strings present in maestro.
    status: pending
    verifier:
      kind: shell
      command: rg -n 'phase-start|draft|validate-only|businessIntent'
        skills/shared/implement-automate-maestro.md
      expectExitCode: 0
  - id: F4-G2
    description: Lazy materialization KB updated for host-thin automate phase-start package.
    status: pending
    verifier:
      kind: shell
      command: rg -n 'host-thin|decision-review|phase-start|draft'
        docs/kb/project-lazy-materialization.md
      expectExitCode: 0
stack:
  - id: 1
    title: Phase boundary ritual and next agent
    type: task
    openedAt: 2026-07-23T11:07:12.097Z
tasks:
  - id: T-013
    title: Step H and phase-start package ritual
    status: pending
    lastUpdated: 2026-07-23T11:07:12.097Z
    scopeBoundary:
      - Do not silent auto-PASS drafted businessIntent. Do not spawn phase
        writer before operator ratify of the package.
    acceptance:
      - "it - Step H / phase-start defines package: phase objective, task list
        id+title, drafted businessIntent."
      - it - Operator validate-only path is documented (edit titles and BI
        allowed; blank form forbidden).
      - it - After ratify, spawn new phase agent with fresh context; forbid
        reusing previous writer context.
      - it - Session handoff single nextAction is mandatory at the boundary.
    verifier:
      kind: shell
      command: rg -n 'phase-start|draft|validate-only|businessIntent|fresh|nextAction'
        skills/shared/implement-automate-maestro.md skills/core/implement.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/core/implement.md
    summary: Ritual phase-start package + spawn fresh agent apos ratify.
    weight: 2
  - id: T-014
    title: Materialize orchestration inside package (not blank handoff)
    status: pending
    lastUpdated: 2026-07-23T11:07:12.097Z
    scopeBoundary:
      - Do not change find-weak-business-intent quality HARD rules. Do not stamp
        BI PASS without operator ratify.
    acceptance:
      - it - If phase is descriptor-only, automate orchestrates materialize from
        sidecar and attaches drafted BI into the validation package.
      - it - Docs state operator does not invent BI from blank; validates
        drafted package only.
      - it - project-lazy-materialization after-materialize section mentions
        host-thin automate phase-start package and decision-review.
      - it - No path documents silent host coding of the new phase before ratify.
    verifier:
      kind: shell
      command: rg -n 'host-thin|decision-review|phase-start|draft|validate'
        skills/core/implement.md docs/kb/project-lazy-materialization.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: docs/kb/project-lazy-materialization.md
    summary: Materialize no package + KB lazy host-thin/decision-review.
    weight: 2
parked: []
emerged: []
startedCommit: 346b249f58ae55b4953b610e076e134a313d817b
---

# Narrative / notes

Initiative for phase **F4 — Phase boundary ritual and next agent**.

## Decisions

- F4 BI drafted and ratified (operator ratify on continue after F3 phase-done).
- Lessons: none. Sidecar age fresh. F3 done dependency satisfied.

## Session handoff
- **Narrative:** F4 materialized after F3 phase-done. Phase-start package: Step H ritual + materialize-in-package + lazy KB. Ready for pure-maestro phase writer T-013..T-014.
- **Decision log:** F4 BI ratified validate-only. F3 decisionReview hardgate done.
- **Single nextAction:** Run implement pure-maestro for F4 (spawn code-only phase writer T-013..T-014).
- **Verbatim state:** phaseId=F4; slug=implement-phase-agents-f4-phase-boundary-ritual-and-next-agent; executionMode=automate; currentPhase=F4; tasks T-013 T-014 pending; startedCommit=346b249f58ae55b4953b610e076e134a313d817b.
- **Uncommitted changes:** materialize checkpoint pending commit.

