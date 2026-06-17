---
schemaVersion: "0.1"
slug: deadline-burnup-forecast-f5-render-no-aideck-depende-do-redesig
title: Render no aiDeck (depende do redesign do dashboard)
goal: "registrar os dataSources burnup/spi no manifest e uma página com
  line-chart (2 séries) + stat SPI, usando só widgets publicados. DEPENDÊNCIA
  EXTERNA: bloqueada até o redesign do dashboard (plano fix-aideck-dashboard,
  F2) aterrissar — o forecast só renderiza sobre o dashboard refeito; por isso é
  a última fase. As fases F0–F4 (instrumentação de tracking) são independentes e
  implementáveis já."
status: pending
branch: plan/deadline-burnup-forecast
started: 2026-06-17T12:06:57.781Z
lastUpdated: 2026-06-17T16:06:30Z
nextAction: "Start T-001: — dataSources + página burn-up no manifest"
parentPlan: deadline-burnup-forecast
phaseId: F5
tasksDone: 0
tasksTotal: 1
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: a página de ritmo renderiza com widgets reais ligados a
      burnup.json/spi.json, sobre o dashboard refeito.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/aideck-consumer-manifest.test.js
    verifierLabel: "shell: node --test tests/aideck-consumer-manifest.test.js"
externalImports:
  - kind: repo-path
    path: .atomic-skills/projects/atomic-skills/fix-aideck-dashboard/plan.md
    label: "BLOQUEANTE: o redesign do dashboard (fix-aideck-dashboard, F2) deve
      aterrissar antes do render — F5 não inicia sem o manifest refeito
      presente."
    inside_repo: true
stack:
  - id: 1
    title: Render no aiDeck (depende do redesign do dashboard)
    type: task
    openedAt: 2026-06-17T12:06:57.781Z
tasks:
  - id: T-001
    title: — dataSources + página burn-up no manifest
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
parked: []
emerged: []
summary: Renderiza o burn-up/SPI no dashboard — bloqueada até o redesign do
  dashboard aterrissar.
planTitle: Deadline Burn-up Forecast (Earned Value / SPI)
planActive: true
---

# Narrative / notes

Initiative for phase **F5 — Render no aiDeck (depende do redesign do dashboard)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
