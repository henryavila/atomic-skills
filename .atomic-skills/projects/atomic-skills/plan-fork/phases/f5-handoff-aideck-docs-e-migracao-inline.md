---
schemaVersion: "0.1"
slug: plan-fork-f5-handoff-aideck-docs-e-migracao-inline
title: Handoff aiDeck, docs e migração inline
goal: Documentar a estrutura de estado para o aiDeck, atualizar a KB, e migrar o
  elo do sidecar para inline quando o aiDeck publicado tolerar os campos (maior
  ou igual a 0.1.2).
status: pending
branch: plan/plan-fork
started: 2026-06-19T15:32:29.603Z
lastUpdated: 2026-06-19T15:32:29.603Z
nextAction: "Start T-001: Handoff ao aiDeck"
parentPlan: plan-fork
phaseId: F5
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F5-G1
    description: O handoff documenta os campos, a semântica intra-project e os dois
      modos de falha; a KB cobre o degrau 7.5; o caminho de migração
      sidecar-para-inline (gated em aiDeck maior ou igual a 0.1.2) está
      documentado e a migração é coberta por teste.
    status: pending
    verifier:
      kind: shell
      command: test -f /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md &&
        grep -q spawnedPlans
        /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md && grep -q
        strict /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md &&
        grep -q fork-plan docs/kb/skill-authoring.md && npm test
    verifierLabel: "shell: test -f /home/henry/aideck/docs/handoffs/atomic-skills-plan…"
stack:
  - id: 1
    title: Handoff aiDeck, docs e migração inline
    type: task
    openedAt: 2026-06-19T15:32:29.603Z
tasks:
  - id: T-001
    title: Handoff ao aiDeck
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - apenas o documento de handoff; não editar código do aiDeck.
    acceptance:
      - o handoff documenta os campos exatos (spawnedFrom, spawnedPlans), a
        semântica pai/filho intra-project, a expectativa de render aninhado, e
        os dois modos de falha do .strict (spawnedFrom derruba o card,
        spawnedPlans é stripado).
    verifier:
      kind: shell
      command: test -f /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md &&
        grep -q spawnedFrom
        /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md && grep -q
        spawnedPlans /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md
        && grep -q strict
        /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md
    outputs:
      - kind: file
        path: ~/aideck/docs/handoffs/atomic-skills-plan-fork.md
    summary: Escreve o handoff do plan-fork em ~/aideck.
  - id: T-002
    title: Atualizar a KB do atomic-skills
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - apenas a seção sobre a ladder/plan-fork; não reescrever a KB inteira.
    acceptance:
      - a KB documenta o degrau 7.5 e o verbo fork-plan com link para
        project-emergence.md.
    verifier:
      kind: shell
      command: grep -q fork-plan docs/kb/skill-authoring.md
    outputs:
      - kind: file
        path: docs/kb/skill-authoring.md
    summary: Documenta o degrau 7.5 na KB.
  - id: T-003
    title: Migração sidecar para inline (gated em aiDeck maior ou igual a 0.1.2)
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - só roda quando o pin do aiDeck for maior ou igual a 0.1.2; não emitir os
        campos inline enquanto o pin for 0.1.0.
    acceptance:
      - com o pin maior ou igual a 0.1.2, spawnedFrom e spawnedPlans são
        adicionados ao plan.schema.json, o conteúdo do sidecar é migrado para o
        frontmatter, e o sidecar é removido; com pin 0.1.0 a task fica bloqueada
        e não emite inline; um teste cobre os dois ramos (migra em ≥0.1.2,
        bloqueia em 0.1.0).
    outputs:
      - kind: file
        path: meta/schemas/plan.schema.json
      - kind: file
        path: src/links-sidecar.js
      - kind: file
        path: src/links-sidecar.test.js
    summary: Migra o elo do sidecar para inline quando aiDeck ≥0.1.2.
    verifier:
      kind: shell
      command: npm test
parked: []
emerged: []
summary: Handoff aiDeck + KB + migração sidecar→inline (gated em aiDeck ≥0.1.2).
planTitle: plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada
planActive: true
---

# Narrative / notes

Initiative for phase **F5 — Handoff aiDeck, docs e migração inline**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
