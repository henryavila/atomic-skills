---
schemaVersion: "0.1"
slug: plan-fork-f1-verbo-fork-plan-degrau-7-5-pause-only-at
title: Verbo fork-plan + degrau 7.5 (pause-only até a F2)
goal: Implementar o verbo fork-plan (ratify do elo + handoff ao fluxo new plan),
  inserir o degrau 7.5 residente na ladder, rodar o cycle-check antes de
  qualquer escrita, e entregar pause-only rejeitando o modo parallel até a F2
  existir.
status: pending
branch: plan/plan-fork
started: 2026-06-19T15:32:29.603Z
lastUpdated: 2026-06-19T15:32:29.603Z
nextAction: "Start T-001: Procedure fork-plan no project-emergence.md"
parentPlan: plan-fork
phaseId: F1
tasksDone: 0
tasksTotal: 4
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F1-G1
    description: fork-plan grava o elo no sidecar só após ratify; roda o cycle-check
      antes de qualquer escrita e aborta atômico em ciclo; o modo pause funciona
      e o parallel é rejeitado até a F2; o degrau 7.5 é roteado.
    status: pending
    verifier:
      kind: shell
      command: grep -q fork-plan skills/shared/project-assets/project-emergence.md &&
        grep -q fork-plan skills/core/project.md && grep -q ciclo
        skills/shared/project-assets/project-emergence.md && grep -q parallel
        skills/shared/project-assets/project-emergence.md && npm test
    verifierLabel: "shell: grep -q fork-plan skills/shared/project-assets/project-emer…"
stack:
  - id: 1
    title: Verbo fork-plan + degrau 7.5 (pause-only até a F2)
    type: task
    openedAt: 2026-06-19T15:32:29.603Z
tasks:
  - id: T-001
    title: Procedure fork-plan no project-emergence.md
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - não duplicar o fluxo new plan (o verbo delega a ele); não implementar
        render de dashboard.
    acceptance:
      - o procedure parseia child-slug com from, mode e task, imprime o bloco
        Proposed mutation com o context drafted, e só grava o elo no sidecar
        após o ratify.
    verifier:
      kind: shell
      command: grep -q fork-plan skills/shared/project-assets/project-emergence.md
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-emergence.md
    summary: "Procedure do fork-plan: ratify do elo no sidecar + handoff ao new plan."
  - id: T-002
    title: Degrau 7.5 residente e dispatch no router
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - apenas a linha 7.5 da ladder e a entrada na dispatch table; não
        reescrever a ladder existente.
    acceptance:
      - a ladder ganha a linha 7.5 (a fase vira plano-filho, o pai sobrevive,
        roteando para fork-plan) e a dispatch table roteia fork-plan para
        project-emergence.md.
    verifier:
      kind: shell
      command: grep -q fork-plan skills/core/project.md
    outputs:
      - kind: file
        path: skills/core/project.md
    summary: Insere o degrau 7.5 na ladder e roteia no router.
  - id: T-003
    title: Cycle-check antes do ratify no fork-plan
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - apenas a chamada do cycle-check (helper da F0) antes de qualquer
        escrita; não reimplementar a detecção.
    acceptance:
      - o procedure exige rodar o cycle-check antes do ratify; ao detectar
        ciclo, aborta atômico sem gravar nada no sidecar.
    verifier:
      kind: shell
      command: grep -q ciclo skills/shared/project-assets/project-emergence.md
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-emergence.md
      - kind: file
        path: src/spawn-graph.js
    summary: fork-plan roda o cycle-check antes do ratify e aborta em ciclo.
  - id: T-004
    title: Pause completo e parallel rejeitado até a F2
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - reuso de switch/cascade-pause; o protocolo cross-worktree do parallel é
        a F2 e não é implementado aqui.
    acceptance:
      - o modo pause documenta P para paused, fase para paused e filho active; o
        modo parallel é REJEITADO com mensagem clara apontando que depende da
        F2, evitando qualquer escrita cross-worktree antes do protocolo.
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-emergence.md
    summary: Pause completo; parallel rejeitado com mensagem até a F2.
    verifier:
      kind: shell
      command: grep -q parallel skills/shared/project-assets/project-emergence.md
parked: []
emerged: []
summary: Verbo fork-plan, degrau 7.5, cycle-check pré-ratify; pause-only até a F2.
planTitle: plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada
planActive: true
---

# Narrative / notes

Initiative for phase **F1 — Verbo fork-plan + degrau 7.5 (pause-only até a F2)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
