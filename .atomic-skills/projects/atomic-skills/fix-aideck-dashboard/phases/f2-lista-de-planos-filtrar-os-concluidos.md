---
schemaVersion: "0.1"
slug: fix-aideck-dashboard-f2-lista-de-planos-filtrar-os-concluidos
title: "Lista de planos: filtrar os concluídos"
goal: Na lista de planos do dashboard, filtrar da visão padrão os planos já
  concluídos (status done e archived), mantendo-os acessíveis sob um filtro
  explícito.
status: pending
branch: plan/fix-aideck-dashboard
started: 2026-06-16T11:57:08.891Z
lastUpdated: 2026-06-16T11:57:08.891Z
nextAction: null
parentPlan: fix-aideck-dashboard
phaseId: F2
summary: Ajusta a lista de planos do dashboard — oculta concluídos por padrão e
  corrige o live-refresh das mudanças de projeto (lado atomic-skills).
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: A lista de planos do dashboard oculta os planos done e archived por
      padrão e os expõe via um filtro explícito.
    status: pending
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
stack:
  - id: 1
    title: "Lista de planos: filtrar os concluídos"
    type: task
    openedAt: 2026-06-16T11:57:08.891Z
tasks:
  - id: T-001
    title: Filtrar da lista os planos done e archived
    summary: Oculta planos done/archived da lista por padrão, com filtro explícito
      para revê-los.
    status: pending
    lastUpdated: 2026-06-16T11:57:08.891Z
    description: Na lista de planos do dashboard, ocultar por padrão os planos com
      status done e archived; expor um filtro explícito para exibi-los. Interior
      SPEC a decompor ao iniciar a frente.
  - id: T-002
    title: "Live-refresh: dashboard não reflete alterações dos projetos"
    summary: Diagnostica e corrige, no lado do atomic-skills, por que edições de
      estado não disparam o live-update (SSE) que o aiDeck já implementa.
    status: pending
    lastUpdated: 2026-06-16T11:57:08.891Z
    description: "O dashboard não atualiza quando os projetos mudam. O aiDeck já
      implementa o live-update via SSE em mudança de arquivo; o defeito está no
      lado do atomic-skills. Candidatos de causa a investigar: escrita em
      caminho/layout que o watcher do consumer não atribui, ou globs do
      manifesto que não casam. Diagnosticar a causa-raiz e corrigir do nosso
      lado, sem tocar no aiDeck. Interior SPEC a decompor."
parked: []
emerged: []
planTitle: "fix-aideck-dashboard: corrigir a integração com aiDeck"
planActive: true
---

# Narrative / notes

Initiative for phase **F2 — Lista de planos: filtrar os concluídos**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
