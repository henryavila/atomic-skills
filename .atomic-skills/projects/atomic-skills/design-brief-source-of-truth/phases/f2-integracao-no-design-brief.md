---
schemaVersion: "0.1"
slug: design-brief-source-of-truth-f2-integracao-no-design-brief
title: Integração no design-brief
goal: o design-brief consome o catálogo com reconstrução-primeiro, comuta o R2
  por regime, e persiste o catálogo na árvore do app-alvo.
status: pending
branch: plan/skills-restructuring
started: 2026-06-15T19:46:08.157Z
lastUpdated: 2026-06-15T17:00:00.000Z
nextAction: "Start T-001: Step 2 consome o catálogo"
parentPlan: design-brief-source-of-truth
phaseId: F2
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: o design-brief consome o catálogo, o R2 comuta por regime, e o
      catálogo persiste no app-alvo passando pela validação emit-time.
    status: pending
    verifier:
      kind: shell
      command: node --test test/app-map/persist.test.js && grep -qi 'app-map'
        skills/core/design-brief.md
    verifierLabel: "shell: node --test test/app-map/persist.test.js && grep -qi 'app-m…"
stack:
  - id: 1
    title: Integração no design-brief
    type: task
    openedAt: 2026-06-15T19:46:08.157Z
tasks:
  - id: T-001
    title: Step 2 consome o catálogo
    status: pending
    lastUpdated: 2026-06-15T19:46:08.157Z
    summary: Step 2 lê o catálogo e reconstrói antes; route-Glob vira legado opt-in.
    description: "Reescreve o Step 2 para ler o catálogo e rodar a reconstrução
      antes de consumir. Files: skills/core/design-brief.md,
      skills/shared/design-brief-assets/screens-prompt.md"
    scopeBoundary:
      - não tocar o coração anti-contaminação (camadas 2 e 3); só o Step 2 de
        inventário.
    acceptance:
      - o Step 2 lê o catálogo
      - ausente ou stale dispara reconstrução primeiro
      - o route-Glob ao vivo aparece como legado opt-in, nunca o default.
    verifier:
      kind: shell
      command: grep -qi 'app-map' skills/core/design-brief.md
  - id: T-002
    title: Switch do R2 por regime
    status: pending
    lastUpdated: 2026-06-15T19:46:08.157Z
    summary: R2 minera em brownfield e pergunta em greenfield; nunca silencia.
    description: "Faz o R2 minerar do código em brownfield e perguntar ao operador
      em greenfield. Files: skills/core/design-brief.md,
      skills/shared/design-brief-assets/anti-contamination.md"
    scopeBoundary:
      - não alterar a regra de silêncio da camada 1; só a fonte dos parâmetros
        do R2.
    acceptance:
      - brownfield minera valores do código
      - greenfield pergunta ao operador semeado pelos artefatos
      - nunca silencia o parâmetro.
    verifier:
      kind: shell
      command: grep -qi 'greenfield' skills/core/design-brief.md
  - id: T-003
    title: Persistência na árvore do app-alvo
    status: pending
    lastUpdated: 2026-06-15T17:00:00.000Z
    summary: Grava o catálogo na árvore do app-alvo, validando na emissão.
    description: "Grava o catálogo no app-alvo, validando na emissão. Files:
      src/app-map/persist.js, test/app-map/persist.test.js"
    scopeBoundary:
      - catálogo na árvore do app-alvo, não na do repo, salvo dogfooding do
        próprio atomic-skills.
    acceptance:
      - grava o app-map.json e o espelho .md sob a árvore do app-alvo
      - o project-id vem do basename do alvo ou é fornecido
      - valida na emissão antes de gravar.
      - path exato app-alvo/.atomic-skills/app-map/app-map.json + espelho .md,
        marcados como output gerado (regenerado, nunca editado à mão).
    verifier:
      kind: shell
      command: node --test test/app-map/persist.test.js
parked: []
emerged: []
summary: "Pluga o catálogo no design-brief: Step 2, switch do R2 e persistência
  no app-alvo."
---

# Narrative / notes

Initiative for phase **F2 — Integração no design-brief**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
