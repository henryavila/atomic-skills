---
schemaVersion: "0.1"
slug: skills-restructuring-f3-economia-de-tokens-per-skill
title: "Economia de tokens: per-skill"
goal: mover blocos mode-gated e branch-only de cada skill grande para assets
  lazy, carregando só o branch que roda.
status: pending
branch: null
started: 2026-06-15T13:37:12.477Z
lastUpdated: 2026-06-15T13:54:20.262Z
nextAction: "Start T3.1: review-code — mover blocos mode-gated e diff-capture"
parentPlan: skills-restructuring
phaseId: F3
tasksDone: 0
tasksTotal: 5
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 5
exitGates:
  - id: F3-G1
    description: A suite de validação passa após os movimentos per-skill.
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills
      expectExitCode: 0
    verifierLabel: "shell: npm run validate-skills"
stack:
  - id: 1
    title: "Economia de tokens: per-skill"
    type: task
    openedAt: 2026-06-15T13:37:12.477Z
tasks:
  - id: T3.1
    title: review-code — mover blocos mode-gated e diff-capture
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: "review-code: blocos mode-gated e diff-capture para asset"
    description: "Mover os blocos local-review e codex-subflow e os branches de
      captura de diff para local-review-assets, carregados só no modo que roda.
      Arquivos: skills/core/review-code.md,
      skills/shared/local-review-assets/diff-capture.md"
    scopeBoundary:
      - não tocar o Step 0 mode-picker resident; preservar o algoritmo de shape
        do diff intacto.
    acceptance:
      - o asset de diff-capture existe
      - review-code encolhe abaixo de 20000 bytes.
    verifier:
      kind: shell
      command: test -f skills/shared/local-review-assets/diff-capture.md && test $(wc
        -c < skills/core/review-code.md) -lt 20000
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/review-code.md
      - kind: file
        path: skills/shared/local-review-assets/diff-capture.md
  - id: T3.2
    title: review-plan — mover initiative-depth e closing para asset
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: "review-plan: initiative-depth e closing para asset lazy"
    description: "Mover Step 0c initiative-discovery, checks 14-20 e o closing
      template para um asset lazy; manter o HARD-GATE de iniciativa resident.
      Arquivos: skills/core/review-plan.md,
      skills/shared/project-assets/plan-initiative-depth.md"
    scopeBoundary:
      - não tocar o HARD-GATE de iniciativa nem o Step 0 mode-picker.
    acceptance:
      - o asset de initiative-depth existe
      - review-plan encolhe abaixo de 24000 bytes.
    verifier:
      kind: shell
      command: test -f skills/shared/project-assets/plan-initiative-depth.md && test
        $(wc -c < skills/core/review-plan.md) -lt 24000
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/review-plan.md
      - kind: file
        path: skills/shared/project-assets/plan-initiative-depth.md
  - id: T3.3
    title: hunt — mover directory-triage para asset
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: "hunt: directory-triage para asset, convention unificada"
    description: "Mover Phase 0 directory-triage e o consolidated report para
      hunt-assets, deixando ponteiro de duas linhas; unificar a
      convention-detection. Arquivos: skills/core/hunt.md,
      skills/shared/hunt-assets/directory-triage.md"
    scopeBoundary:
      - preservar a Iron Law e o escopo canônico single-file da hunt.
    acceptance:
      - o asset de directory-triage existe
      - hunt encolhe abaixo de 14000 bytes.
    verifier:
      kind: shell
      command: test -f skills/shared/hunt-assets/directory-triage.md && test $(wc -c <
        skills/core/hunt.md) -lt 14000
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/hunt.md
      - kind: file
        path: skills/shared/hunt-assets/directory-triage.md
  - id: T3.4
    title: debate — mover gate-mode e remover redundância
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: "debate: gate-mode para asset, seções redundantes removidas"
    description: 'Mover o bloco gate-mode para debate-assets/gate-mode.md e deletar
      as seções redundantes "why this matters" e "where this fits". Arquivos:
      skills/core/debate.md, skills/shared/debate-assets/gate-mode.md'
    scopeBoundary:
      - não tocar a Iron Law spawn-don't-roleplay nem o Synthesis Handoff.
    acceptance:
      - o asset gate-mode existe
      - debate encolhe abaixo de 15000 bytes.
    verifier:
      kind: shell
      command: test -f skills/shared/debate-assets/gate-mode.md && test $(wc -c <
        skills/core/debate.md) -lt 15000
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/debate.md
      - kind: file
        path: skills/shared/debate-assets/gate-mode.md
  - id: T3.5
    title: init-memory — mover Step 5 e Critical Context para asset
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: "init-memory: Step 5 e Critical Context para asset"
    description: "Introduzir scaffold router mais asset e mover Step 5 Connect e
      Critical Context para um asset lazy. Arquivos:
      skills/modules/memory/init-memory.md,
      skills/modules/memory/_assets/connect.md"
    scopeBoundary:
      - não tocar os passos iniciais de criação da estrutura de memória.
    acceptance:
      - o asset de connect existe
      - init-memory encolhe abaixo de 7800 bytes.
    verifier:
      kind: shell
      command: test -f skills/modules/memory/_assets/connect.md && test $(wc -c <
        skills/modules/memory/init-memory.md) -lt 7800
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/modules/memory/init-memory.md
      - kind: file
        path: skills/modules/memory/_assets/connect.md
parked: []
emerged: []
summary: Move blocos mode-gated de cada skill grande para assets lazy.
planTitle: Reestruturação das skills atomic-skills
planActive: true
---

# Narrative / notes

Initiative for phase **F3 — Economia de tokens: per-skill**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
