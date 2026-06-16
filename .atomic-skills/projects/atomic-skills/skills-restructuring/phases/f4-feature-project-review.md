---
schemaVersion: "0.1"
slug: skills-restructuring-f4-feature-project-review
title: "Feature: project review"
goal: dar ao project um subcomando de auditoria de plano/iniciativa
  materializados, compondo linters, verify, review-plan e review-code.
status: pending
branch: null
started: 2026-06-15T13:37:12.477Z
lastUpdated: 2026-06-15T14:21:04.364Z
nextAction: "Start T4.1: review-plan resolve slug e active-plan"
parentPlan: skills-restructuring
phaseId: F4
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F4-G1
    description: O subcomando existe e a suite de validação passa.
    status: pending
    verifier:
      kind: shell
      command: test -f skills/shared/project-assets/project-review.md && grep -q
        'project review' skills/core/project.md && grep -qiE
        'review-plan|review-code|verify'
        skills/shared/project-assets/project-review.md && npm run
        validate-skills
      expectExitCode: 0
    verifierLabel: "shell: test -f skills/shared/project-assets/project-review.md && g…"
stack:
  - id: 1
    title: "Feature: project review"
    type: task
    openedAt: 2026-06-15T13:37:12.477Z
tasks:
  - id: T4.1
    title: review-plan resolve slug e active-plan
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: review-plan resolve slug e plano ativo
    description: "Estender o parser de review-plan para resolver um slug ou o plano
      ativo quando o primeiro token não é arquivo legível, reusando a detecção
      do project. Arquivos: skills/core/review-plan.md"
    scopeBoundary:
      - não tocar os HARD-GATEs nem o sub-flow codex; só o contrato de argumento.
    acceptance:
      - o corpo descreve resolução por slug e fallback para active-plan.
    verifier:
      kind: shell
      command: grep -qiE 'slug|active.plan' skills/core/review-plan.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/review-plan.md
  - id: T4.2
    title: review-plan auto cross-ref por provenance
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: review-plan auto cross-ref via references/supersedes
    description: "Pré-popular os artefatos de cross-ref a partir de references e
      supersedes do frontmatter do plano, antes do scan de prosa; manter a flag
      manual como override. Arquivos: skills/core/review-plan.md"
    scopeBoundary:
      - não remover o scan de prosa nem a flag manual de cross-ref.
    acceptance:
      - o corpo descreve auto-resolução de cross-ref via references/supersedes.
    verifier:
      kind: shell
      command: grep -qE 'references|supersedes' skills/core/review-plan.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/review-plan.md
  - id: T4.3
    title: Subcomando project review (detail lazy)
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Subcomando project review compõe linters + verify + reviews
    description: "Criar o subcomando project review que resolve o alvo, roda os
      linters determinísticos mais verify, chama review-plan e opcionalmente
      review-code; adicionar à grammar e ao dispatch table do router. Arquivos:
      skills/core/project.md, skills/shared/project-assets/project-review.md"
    scopeBoundary:
      - não duplicar a lógica de review-plan; o subcomando compõe, não
        reimplementa.
    acceptance:
      - o detail file project-review.md existe
      - a grammar do router cita project review
      - o dispatch table aponta para o detail.
    verifier:
      kind: shell
      command: test -f skills/shared/project-assets/project-review.md && grep -q
        'project review' skills/core/project.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/project.md
      - kind: file
        path: skills/shared/project-assets/project-review.md
parked: []
emerged: []
summary: Subcomando project review que audita plano/iniciativa materializados.
planTitle: Reestruturação das skills atomic-skills
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F4 — Feature: project review**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
