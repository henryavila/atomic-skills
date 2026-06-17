---
schemaVersion: "0.1"
slug: reversible-installer-f2-providers-e-config-two-tier
title: Providers e config two-tier
goal: expor a config declarativa two-tier e portar a instalação de skills para
  um provider sobre o kernel, mantendo o render multi-IDE e o
  COMMUNICATION_LANGUAGE opt-out.
status: pending
branch: plan/reversible-installer
started: 2026-06-17T15:13:50.418Z
lastUpdated: 2026-06-17T15:20:11.565Z
nextAction: "Start T-001: — defineInstaller (config two-tier)"
parentPlan: reversible-installer
phaseId: F2
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: O SkillsProvider reproduz a instalação de skills atual (paths e
      conteúdo) via reconcileFileSet.
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: test/providers/skills-provider.test.js
    verifierLabel: "test: node --test test/providers/skills-provider.test.js"
  - id: G-2
    description: Um runtime layer registra e reverte um tipo de efeito novo sem
      reabrir o kernel.
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/runtime-layer.test.js
    verifierLabel: "test: node --test test/kernel/runtime-layer.test.js"
stack:
  - id: 1
    title: Providers e config two-tier
    type: task
    openedAt: 2026-06-17T15:13:50.418Z
tasks:
  - id: T-001
    title: defineInstaller (config two-tier)
    status: pending
    lastUpdated: 2026-06-17T15:20:11.565Z
    summary: defineInstaller resolve config two-tier, rejeita runtime layer sem
      apply/revert, namespace parametrizável.
    description: Aceita dados declarativos (namespace, ides, variables,
      communicationLanguage, catalog) mais o escape-hatch runtimeLayers em
      código.
    scopeBoundary:
      - resolve e valida config; não executa efeitos nem toca o driver
    acceptance:
      - config mínima resolve os defaults
      - runtime layer sem apply ou revert é rejeitado na validação
      - namespace parametrizável, não fixo em atomic-skills
    verifier:
      kind: test
      runner: node --test
      pattern: test/define-installer.test.js
  - id: T-002
    title: SkillsProvider (porta IDE matrix, render e catálogo)
    status: pending
    lastUpdated: 2026-06-17T15:20:11.565Z
    summary: SkillsProvider emite efeitos de arquivo do catálogo, render multi-IDE,
      COMM_LANG opt-out.
    description: Encapsula src/config.js:5-55 (IDE matrix), src/render.js:37-97
      (render + COMMUNICATION_LANGUAGE) e o catálogo, emitindo efeitos de
      arquivo.
    scopeBoundary:
      - emite efeitos reconcileFileSet; não chama o driver nem os efeitos
        não-arquivo
    acceptance:
      - reproduz os paths e o conteúdo da instalação de skills atual
      - COMMUNICATION_LANGUAGE desativável via config
      - render multi-IDE (markdown, command, toml) intacto
    verifier:
      kind: test
      runner: node --test
      pattern: test/providers/skills-provider.test.js
  - id: T-003
    title: API de registro de runtime layer
    status: pending
    lastUpdated: 2026-06-17T15:20:11.565Z
    summary: API de registro p/ runtime layer declarar um tipo de efeito novo com
      fixtures.
    description: Formaliza como um runtime layer (F3) declara um tipo de efeito
      reversível além dos 3 built-in.
    scopeBoundary:
      - aditivo ao contrato; não altera os 3 efeitos built-in
    acceptance:
      - runtime layer registra um tipo de efeito novo e o kernel o reverte
        out-of-the-box
      - tipo registrado sem fixture de round-trip é rejeitado
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/runtime-layer.test.js
parked: []
emerged: []
summary: Config two-tier + SkillsProvider (IDE matrix/render, COMM_LANG opt-out)
  + API de registro de runtime layer.
planTitle: Reversible Installer — motor de instalação reversível e reutilizável
planActive: true
---

# Narrative / notes

Initiative for phase **F2 — Providers e config two-tier**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
