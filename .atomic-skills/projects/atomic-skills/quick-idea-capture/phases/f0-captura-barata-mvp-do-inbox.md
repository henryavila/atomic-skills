---
schemaVersion: "0.1"
slug: quick-idea-capture-f0-captura-barata-mvp-do-inbox
title: Captura barata (MVP do inbox)
goal: Entregar a captura end-to-end — script determinístico de append, o detail
  file com o fork de dois modos e o `idea list`, mais o wiring no router e a
  paridade de install — sem tocar no modelo plan/initiative.
status: active
branch: null
started: 2026-06-09T18:41:40.321Z
lastUpdated: 2026-06-09T18:52:55Z
nextAction: "Start T-001: idea-add.js — append determinístico ao ideas.md"
parentPlan: quick-idea-capture
phaseId: F0
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 3
exitGates:
  - id: F0-G1
    description: Captura funciona end-to-end — idea-add.js cria e atualiza o
      ideas.md e a suíte do script passa.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/idea-add.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/idea-add.test.js"
  - id: F0-G2
    description: Validação de skills e compatibilidade cross-agent verdes para o
      novo detail file project-idea.md (sem nomes de ferramenta fixos).
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills && node --test tests/compatibility.test.js
      expectExitCode: 0
    verifierLabel: "shell: npm run validate-skills && node --test tests/compatibility.…"
  - id: F0-G3
    description: idea e idea list alcançáveis pela dispatch table do router e
      paridade de install/uninstall do novo asset garantida.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js && grep -q
        'project-idea.md' skills/core/project.md
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/install-uninstall-roundtrip.test.js && gr…"
stack:
  - id: 1
    title: Captura barata (MVP do inbox)
    type: task
    openedAt: 2026-06-09T18:41:40.321Z
tasks:
  - id: T-001
    title: idea-add.js — append determinístico ao ideas.md
    status: pending
    lastUpdated: 2026-06-09T18:41:40.321Z
    summary: Script determinístico que cria/atualiza o ideas.md e numera a ideia.
  - id: T-002
    title: project-idea.md — fork de captura mais idea list
    status: pending
    lastUpdated: 2026-06-09T18:41:40.321Z
    summary: Detail file com o fork de captura de dois modos e o idea list.
  - id: T-003
    title: Router wiring mais paridade de install
    status: pending
    lastUpdated: 2026-06-09T18:41:40.321Z
    summary: Liga os verbos no router e garante a paridade de install do novo asset.
parked: []
emerged: []
summary: "O inbox barato: script de append, detail file com o fork Analisar/Só
  salvar, idea list, wiring e paridade de install."
planTitle: Quick Idea Capture
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Captura barata (MVP do inbox)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
