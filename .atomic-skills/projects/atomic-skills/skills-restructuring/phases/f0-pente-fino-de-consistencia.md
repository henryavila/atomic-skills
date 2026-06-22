---
schemaVersion: "0.1"
slug: skills-restructuring-f0-pente-fino-de-consistencia
title: Pente fino de consistência
goal: corrigir resíduo e drift documental de baixo risco nas skills, sem mudar comportamento.
status: active
branch: null
started: 2026-06-15T13:37:12.477Z
lastUpdated: 2026-06-15T13:54:20.262Z
nextAction: "Start T0.1: Corrigir contagem de stages no create-plan"
parentPlan: skills-restructuring
phaseId: F0
tasksDone: 0
tasksTotal: 7
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F0-G1
    description: Suite de validação de skills passa após as correções de pente fino.
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills
      expectExitCode: 0
    verifierLabel: "shell: npm run validate-skills"
stack:
  - id: 1
    title: Pente fino de consistência
    type: task
    openedAt: 2026-06-15T13:37:12.477Z
tasks:
  - id: T0.1
    title: Corrigir contagem de stages no create-plan
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: "Heading do create-plan: 7→9 stages"
    description: 'Trocar o heading "7 stages" por "9 stages" em project-create-plan.md, que roda Stage 1 a 9. Arquivos: skills/shared/project-assets/project-create-plan.md'
    scopeBoundary:
      - não alterar o corpo dos Stages 1-9, apenas o heading da contagem.
    acceptance:
      - o heading lê "9 stages"
      - nenhuma ocorrência de "7 stages" resta no arquivo.
    verifier:
      kind: shell
      command: grep -q '9 stages' skills/shared/project-assets/project-create-plan.md && ! grep -q '7 stages' skills/shared/project-assets/project-create-plan.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
  - id: T0.2
    title: Completar cheat-sheet de Task com summary e evidence
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Cheat-sheet de Task ganha summary e evidence
    description: "Adicionar `summary` e `evidence` à lista de opcionais de Task no Schema quick-reference do router. Arquivos: skills/core/project.md"
    scopeBoundary:
      - apenas a linha de opcionais de Task; não tocar PhaseDescriptor nem ExitCriterion.
    acceptance:
      - a linha de opcionais de Task cita summary e evidence.
    verifier:
      kind: shell
      command: grep -qE 'Task.*Optional:.*summary.*evidence' skills/core/project.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/project.md
  - id: T0.3
    title: Completar cheat-sheet de PhaseDescriptor
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Cheat-sheet de PhaseDescriptor ganha summary/provenance/context
    description: "Adicionar `summary`, `provenance`, `context` aos opcionais de PhaseDescriptor no router. Arquivos: skills/core/project.md"
    scopeBoundary:
      - apenas a linha de opcionais de PhaseDescriptor.
    acceptance:
      - a linha de PhaseDescriptor cita summary, provenance e context.
    verifier:
      kind: shell
      command: grep -qE 'PhaseDescriptor.*Optional:.*summary.*provenance.*context' skills/core/project.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/project.md
  - id: T0.4
    title: Anotar campos 0.2 do verifier manual
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Verifier manual anotado com os campos 0.2
    description: "Anotar o branch manual do ExitCriterionVerifier com os opcionais 0.2 (demoCommand, fallbackKind, steps, expected, data). Arquivos: skills/core/project.md"
    scopeBoundary:
      - apenas o branch manual do oneOf de ExitCriterionVerifier.
    acceptance:
      - o branch manual cita demoCommand e fallbackKind.
    verifier:
      kind: shell
      command: grep -q 'demoCommand' skills/core/project.md && grep -q 'fallbackKind' skills/core/project.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/project.md
  - id: T0.5
    title: Corrigir caminho morto do review-code no drift
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Caminho morto do review-code no drift vira slug
    description: "Trocar o caminho morto skills/en/core/review-code.md pelo slug atomic-skills:review-code. Arquivos: skills/shared/project-assets/project-drift.md"
    scopeBoundary:
      - apenas a linha que cita o caminho do review-code.
    acceptance:
      - nenhuma ocorrência de "skills/en/" no arquivo
      - o slug atomic-skills:review-code está presente.
    verifier:
      kind: shell
      command: "! grep -q 'skills/en/' skills/shared/project-assets/project-drift.md && grep -q 'atomic-skills:review-code' skills/shared/project-assets/project-drift.md"
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-drift.md
  - id: T0.6
    title: Registrar o gate G9 no registry canônico
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Gate G9 registrado no code-quality-gates
    description: "Adicionar a entrada G9 mutation-kill em code-quality-gates.md, espelhando a definição inline de project-transitions.md. Arquivos: docs/kb/code-quality-gates.md"
    scopeBoundary:
      - apenas adicionar a seção G9; não reescrever G1-G8.
    acceptance:
      - o registry contém um heading G9 mutation-kill.
    verifier:
      kind: shell
      command: grep -qE '^##+ G9' docs/kb/code-quality-gates.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/kb/code-quality-gates.md
  - id: T0.7
    title: Remover referência dangling AIDECK_STATE_DOMAIN
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Referência dangling AIDECK_STATE_DOMAIN removida
    description: "Remover AIDECK_STATE_DOMAIN da prosa do project-view.md, mantendo AIDECK_BIN e DASHBOARD_DIR. Arquivos: skills/shared/project-assets/project-view.md"
    scopeBoundary:
      - apenas a frase do step 1 que cita as variáveis; não tocar o bloco CONTRACT.
    acceptance:
      - nenhuma ocorrência de AIDECK_STATE_DOMAIN
      - AIDECK_BIN permanece.
    verifier:
      kind: shell
      command: "! grep -q 'AIDECK_STATE_DOMAIN' skills/shared/project-assets/project-view.md && grep -q 'AIDECK_BIN' skills/shared/project-assets/project-view.md"
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-view.md
parked: []
emerged: []
summary: "Quick-wins de consistência: contagem de stages, caminhos mortos, cheat-sheets e gates."
planTitle: Reestruturação das skills atomic-skills
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Pente fino de consistência**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
