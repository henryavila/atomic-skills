---
schemaVersion: "0.1"
slug: implement-phase-agents-f4-phase-boundary-ritual-and-next-agent
title: Phase boundary ritual and next agent
goal: After phase-done and at every phase start, automate presents objective +
  tasks + drafted BI for operator validation, then spawns a fresh phase agent —
  never a blank BI form.
status: done
branch: plan/implement-phase-agents
started: 2026-07-23T11:07:12.097Z
lastUpdated: 2026-07-23T13:12:23.339Z
nextAction: null
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
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: F4-G1
    description: Phase-start package and draft BI strings present in maestro.
    status: met
    verifier:
      kind: shell
      command: rg -n 'phase-start|draft|validate-only|businessIntent'
        skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    metAt: 2026-07-23T11:12:04.667Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-23T11:12:04.667Z
      verifiedCommit: 538dd6629b6ead66c6d9cd878430ac149e24ecba
      passed: true
      exitCode: 0
      outputSummary: phase-done exit gate F4-G1 EXIT 0
  - id: F4-G2
    description: Lazy materialization KB updated for host-thin automate phase-start package.
    status: met
    verifier:
      kind: shell
      command: rg -n 'host-thin|decision-review|phase-start|draft'
        docs/kb/project-lazy-materialization.md
      expectExitCode: 0
    metAt: 2026-07-23T11:12:04.667Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-23T11:12:04.667Z
      verifiedCommit: 538dd6629b6ead66c6d9cd878430ac149e24ecba
      passed: true
      exitCode: 0
      outputSummary: phase-done exit gate F4-G2 EXIT 0
stack:
  - id: 1
    title: Phase boundary ritual and next agent
    type: task
    openedAt: 2026-07-23T11:07:12.097Z
tasks:
  - id: T-013
    title: Step H and phase-start package ritual
    status: done
    lastUpdated: 2026-07-23T11:12:04.667Z
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
    closedAt: 2026-07-23T11:12:04.667Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-23T11:12:04.667Z
      verifiedCommit: 538dd6629b6ead66c6d9cd878430ac149e24ecba
      passed: true
      exitCode: 0
      outputSummary: rg
        phase-start|draft|validate-only|businessIntent|fresh|nextAction
        maestro+implement EXIT 0 @538dd66
  - id: T-014
    title: Materialize orchestration inside package (not blank handoff)
    status: done
    lastUpdated: 2026-07-23T11:12:04.667Z
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
    closedAt: 2026-07-23T11:12:04.667Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-23T11:12:04.667Z
      verifiedCommit: 538dd6629b6ead66c6d9cd878430ac149e24ecba
      passed: true
      exitCode: 0
      outputSummary: rg host-thin|decision-review|phase-start|draft|validate
        implement+lazy-kb EXIT 0 @538dd66
parked: []
emerged: []
startedCommit: 346b249f58ae55b4953b610e076e134a313d817b
weightDone: 4
---

# F4 done. decision-review PASS (aprovado). Next: F5 package.
