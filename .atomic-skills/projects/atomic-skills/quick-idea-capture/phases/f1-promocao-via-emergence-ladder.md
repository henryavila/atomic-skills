---
schemaVersion: "0.1"
slug: quick-idea-capture-f1-promocao-via-emergence-ladder
title: Promoção via emergence ladder
goal: Adicionar o verbo idea promote que extrai uma ideia do inbox, roteia pela
  emergence ladder com ratify e marca a ideia como triaged, sem reinventar
  classificação.
status: active
branch: null
started: 2026-06-09T18:41:40.321Z
lastUpdated: 2026-06-09T20:35:00Z
nextAction: "Start T-001: idea promote — procedimento mais wiring"
parentPlan: quick-idea-capture
phaseId: F1
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: F1-G1
    description: Promoção converte uma ideia em task ou iniciativa via ladder e
      marca a ideia triaged; a suíte de idea-mark passa.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/idea-mark.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/idea-mark.test.js"
  - id: F1-G2
    description: idea promote extrai a ideia do inbox, roteia pela emergence ladder
      com ratify e materializa/encaminha a task ou iniciativa; fixture prova
      extração e handoff.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/idea-promote.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/idea-promote.test.js"
stack:
  - id: 1
    title: Promoção via emergence ladder
    type: task
    openedAt: 2026-06-09T18:41:40.321Z
tasks:
  - id: T-001
    title: idea promote — procedimento mais wiring
    status: pending
    lastUpdated: 2026-06-09T18:41:40.321Z
    summary: Documenta e liga idea promote, roteando pela emergence ladder.
  - id: T-002
    title: idea-mark.js — transição de status para triaged
    status: pending
    lastUpdated: 2026-06-09T18:41:40.321Z
    summary: Script que marca a ideia como triaged sem mexer no resto do ideas.md.
parked: []
emerged: []
summary: "O verbo idea promote: extrai a ideia e roteia pela emergence ladder
  com ratify, marcando-a como triaged."
planTitle: Quick Idea Capture
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Promoção via emergence ladder**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
