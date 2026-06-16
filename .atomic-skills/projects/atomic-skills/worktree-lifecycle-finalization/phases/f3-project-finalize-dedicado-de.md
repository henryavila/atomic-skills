---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f3-project-finalize-dedicado-de
title: project finalize dedicado (Decisão 3)
goal: "introduzir o comando operator-prompted `project finalize` que PUBLICA a
  feature: `git push -u origin plan/<slug>` (sem renomear), `gh pr create --base
  <integrationRef> --head plan/<slug> --fill`, e grava a `pr-url`/identidade no
  estado do plano; prompt-quando-ausente do `integrationRef` (usar existente OU
  criar `develop` de `main`); mostra o diff e o PR proposto antes de agir; o
  `archive` continua zero-git e roda depois do merge."
status: pending
branch: plan/worktree-lifecycle-finalization
started: 2026-06-16T22:50:35.627Z
lastUpdated: 2026-06-16T22:50:35.627Z
nextAction: "Start T-001: Comando project finalize + wiring no router"
parentPlan: worktree-lifecycle-finalization
phaseId: F3
tasksDone: 0
tasksTotal: 1
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: project finalize documentado (push+PR→integrationRef+grava pr-url,
      prompt-quando-ausente), router lista o subcomando, archive intocado;
      skills válidos.
    status: pending
    verifier:
      kind: shell
      command: grep -q 'project-finalize' skills/core/project.md && grep -qi 'gh pr
        create' skills/shared/project-assets/project-finalize.md && npm run
        validate-skills
    verifierLabel: "shell: grep -q 'project-finalize' skills/core/project.md && grep -…"
  - id: G-2
    description: O finalize consome o resolvedor de integrationRef (F1) e o
      invariante de teardown (F2) permanece a guarda de remoção.
    status: pending
    verifier:
      kind: shell
      command: grep -qi 'integration-ref'
        skills/shared/project-assets/project-finalize.md && npm run
        validate-skills
    verifierLabel: "shell: grep -qi 'integration-ref' skills/shared/project-assets/pro…"
stack:
  - id: 1
    title: project finalize dedicado (Decisão 3)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: Comando project finalize + wiring no router
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
    summary: Comando project finalize (push + gh pr create + grava pr-url) e wiring
      no router.
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-finalize.md
      - kind: file
        path: skills/core/project.md
    scopeBoundary:
      - NÃO automatizar (sempre operator-prompted, mostra diff+PR antes)
      - NÃO alterar o `archive` (segue zero-git e posterior ao merge)
      - NÃO renomear `plan/<slug>` para `feat/<slug>`
      - NÃO colocar o `integrationRef` no frontmatter do plano.
    acceptance:
      - "`project-finalize.md` documenta o fluxo push `plan/<slug>` + `gh pr
        create --base <integrationRef>` + gravação da `pr-url` no estado,
        operator-prompted, mostrando o diff `plan/<slug>` contra o
        `integrationRef` antes"
      - documenta o prompt-quando-ausente do ref (usar existente OU criar
        `develop` de `main`, persistido uma vez em `routing.json`) consumindo
        `scripts/integration-ref.js`
      - o router `skills/core/project.md` lista o subcomando `finalize` na
        grammar e no dispatch table apontando para `project-finalize.md`, com a
        âncora `project-finalize`
      - "`npm run validate-skills` passa."
    verifier:
      kind: shell
      command: grep -q 'project-finalize' skills/core/project.md && grep -qi 'gh pr
        create' skills/shared/project-assets/project-finalize.md && npm run
        validate-skills
parked: []
emerged: []
summary: "Comando project finalize: publica a feature via push + PR para o develop."
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
---

# Narrative / notes

Initiative for phase **F3 — project finalize dedicado (Decisão 3)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
