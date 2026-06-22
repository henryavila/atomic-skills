---
schemaVersion: "0.1"
slug: fix-aideck-dashboard-f1-validar-e-aplicar-o-manifesto-project-s
title: Validar e aplicar o manifesto project-status (nosso lado)
goal: "Ler /home/henry/aideck/docs/handoffs/atomic-skills-manifest.md, validar
  contra o estado atual do repo e aplicar os ajustes do lado do atomic-skills:
  publicar o consumer manifest em
  ~/.aideck/consumers/project-status/manifest.yaml e migrar
  annotations/highlights/inbox para o layout explícito
  `.atomic-skills/project-status/`, sem tocar no aiDeck."
status: active
branch: plan/fix-aideck-dashboard
started: 2026-06-16T11:57:08.891Z
lastUpdated: 2026-06-16T11:57:08.891Z
nextAction: Ler /home/henry/aideck/docs/handoffs/atomic-skills-manifest.md,
  validar contra o repo e aplicar os ajustes do nosso lado (publicar
  ~/.aideck/consumers/project-status/manifest.yaml + migrar
  annotations/highlights/inbox para .atomic-skills/project-status/), sem tocar
  no aiDeck.
summary: Publica o consumer manifest e migra annotations/highlights/inbox para o
  layout explícito, sem tocar no aiDeck.
parentPlan: fix-aideck-dashboard
phaseId: F1
tasksDone: 0
tasksTotal: 1
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: "`GET /api/consumers` lista o consumer `project-status` e editar um
      plano dispara o evento de live-refresh no dashboard."
    status: pending
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
stack:
  - id: 1
    title: Validar e aplicar o manifesto project-status (nosso lado)
    type: task
    openedAt: 2026-06-16T11:57:08.891Z
tasks:
  - id: T-001
    title: Ler, validar e aplicar o handoff atomic-skills-manifest
    summary: Lê o handoff, valida contra o repo, publica o consumer manifest e migra
      o layout — sem tocar no aiDeck.
    status: pending
    lastUpdated: 2026-06-16T11:57:08.891Z
    description: Ler /home/henry/aideck/docs/handoffs/atomic-skills-manifest.md;
      validar o contrato do consumer v2 contra o estado atual do repo; publicar
      ~/.aideck/consumers/project-status/manifest.yaml; migrar
      annotations/highlights/inbox para .atomic-skills/project-status/. Sem
      tocar no aiDeck. Interior SPEC (Files/acceptance/verifier) a decompor ao
      iniciar a frente.
parked: []
emerged: []
planTitle: "fix-aideck-dashboard: corrigir a integração com aiDeck"
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Validar e aplicar o manifesto project-status (nosso lado)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
