---
schemaVersion: "0.1"
slug: reversible-installer-f2-providers-e-config-two-tier
title: Providers e config two-tier
goal: expor a config declarativa two-tier e portar a instalação de skills para
  um provider sobre o kernel, mantendo o render multi-IDE e o
  COMMUNICATION_LANGUAGE opt-out.
status: done
branch: plan/reversible-installer
started: 2026-06-17T15:13:50.418Z
lastUpdated: 2026-06-19T20:05:00.000Z
nextAction: "FECHADA (reconciliada no phase-done de F3, 2026-06-19).
  Fase-ponteiro: o contrato de Provider + Driver + config two-tier foi 100%
  feito no repo do pacote @henryavila/tooling-installer (suíte 62/62),
  auto-documentado lá. G-1 (SkillsProvider reproduz a instalação via
  reconcileFileSet) met no consumidor; G-2 deferred — seu verifier
  test/kernel/runtime-layer.test.js foi removido no flip de F3, e a extensão de
  runtime-layer está provada no pacote + test/runtime-layers/."
parentPlan: reversible-installer
phaseId: F2
tasksDone: 3
tasksTotal: 3
gatesMet: 1
gatesTotal: 2
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-1
    description: O SkillsProvider reproduz a instalação de skills atual (paths e
      conteúdo) via reconcileFileSet.
    status: met
    metAt: 2026-06-19T20:05:00.000Z
    verifier:
      kind: test
      runner: node --test
      pattern: test/providers/skills-provider.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-19T20:05:00.000Z
      passed: true
      exitCode: 0
      testsCollected: 3
      outputSummary: node --test test/providers/skills-provider.test.js → 3/3 (exit
        0). O SkillsProvider planeja o file set de skills (reconcileFileSet)
        reproduzindo paths/conteúdo de installSkills byte-a-byte. Reconciliado
        no phase-done de F3.
    verifierLabel: "test: node --test test/providers/skills-provider.test.js"
    evidenceSummary: passed · 3 tests · 2026-06-19
  - id: G-2
    description: Um runtime layer registra e reverte um tipo de efeito novo sem
      reabrir o kernel.
    status: deferred
    deferredReason: Verifier test/kernel/runtime-layer.test.js foi REMOVIDO no flip
      de F3 (src/kernel/ + test/kernel/ deletados — a engine virou o pacote). A
      capacidade de um runtime layer registrar+reverter um efeito novo sem
      reabrir o kernel está provada no pacote @henryavila/tooling-installer (cd
      ~/tooling-installer && node --test test/kernel/runtime-layer.test.js,
      suíte 62/62) e no consumidor via test/runtime-layers/atomic-skills.test.js
      (stageRuntimeArtifacts custom effect 3/3). Reconciliado no phase-done de
      F3.
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/runtime-layer.test.js
    verifierLabel: "test: node --test test/kernel/runtime-layer.test.js"
    evidenceSummary: "deferred: Verifier test/kernel/runtime-layer.test.js foi
      REMOVIDO no flip de F3 (src/kern…"
stack:
  - id: 1
    title: Providers e config two-tier
    type: task
    openedAt: 2026-06-17T15:13:50.418Z
tasks:
  - id: T-001
    title: defineInstaller (config two-tier)
    status: done
    lastUpdated: 2026-06-19T20:05:00.000Z
    closedAt: 2026-06-19T20:05:00.000Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-19T20:05:00.000Z
      passed: true
      exitCode: 0
      testsCollected: 62
      outputSummary: "Reconciliado no phase-done de F3: fase-ponteiro com 100%
        do contrato Provider + Driver + config two-tier implementado no repo do
        pacote @henryavila/tooling-installer; suíte do pacote 62/62. A task
        defineInstaller pertence a esse contrato package-first."
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
    status: done
    lastUpdated: 2026-06-19T20:05:00.000Z
    closedAt: 2026-06-19T20:05:00.000Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-19T20:05:00.000Z
      passed: true
      exitCode: 0
      testsCollected: 3
      outputSummary: "node --test test/providers/skills-provider.test.js → 3/3
        (exit 0). O SkillsProvider planeja o file set de skills
        (reconcileFileSet) reproduzindo paths/conteúdo de installSkills
        byte-a-byte. Reconciliado no phase-done de F3."
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
    status: done
    lastUpdated: 2026-06-19T20:05:00.000Z
    closedAt: 2026-06-19T20:05:00.000Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-19T20:05:00.000Z
      passed: true
      exitCode: 0
      testsCollected: 62
      outputSummary: "Reconciliado no phase-done de F3: a capacidade de um
        runtime layer registrar+reverter um efeito novo sem reabrir o kernel
        está provada no pacote @henryavila/tooling-installer (suíte 62/62) e no
        consumidor via test/runtime-layers/atomic-skills.test.js
        (stageRuntimeArtifacts custom effect 3/3). O gate G-2 da initiative
        permanece deferred porque o verifier antigo test/kernel/runtime-layer.test.js
        foi removido no flip de F3."
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
---

# Narrative / notes

Initiative for phase **F2 — Providers e config two-tier**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
