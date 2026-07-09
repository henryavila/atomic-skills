---
schemaVersion: "0.1"
slug: installer-hooks-cross-ide-f1-setup-e-documentacao
title: Setup e documentacao
goal: Corrigir project-setup.md, hooks/README.md e textos relacionados para
  separar instalacao de skills de setup de hooks, com no-op explicito para hosts
  sem contrato.
summary: Atualiza prosa de setup e README de hooks para refletir a matriz cross-IDE.
businessIntent:
  value: Garante que o setup do project skill comunique suporte cross-IDE sem
    prometer hooks para hosts sem contrato, reduzindo configuracao invalida para
    usuarios Codex, Claude Code, Cursor, Gemini, OpenCode e GitHub Copilot.
  workflow: O operador roda project setup, escolhe nivel de enforcement e recebe
    docs/registro de hooks separados por host e por contrato real.
  rules: Separar instalacao de skills de setup de hooks; registrar hooks apenas
    para Claude Code e Codex quando houver arquivo de config aprovado; preservar
    entradas de terceiros; documentar no-op para hosts sem hook contract.
  outOfScope: Nao alterar runtime layer de auto-update, scripts de hook, testes de
    regressao amplos ou .codex/hooks.json local nesta fase.
  doneWhen: project-setup.md e os READMEs de hooks refletem a matriz F0, os testes
    cobrem a deteccao Codex por .codex/ ou .agents/, e os docs nao prometem
    hooks para hosts sem contrato.
  derived:
    - question: Como L-001 da F0 foi aplicada na F1?
      answer: O acceptance de T-001 e o gate G-1 exigem detectar Codex por `.codex/ ||
        .agents/` antes da fallback generica e manter path de skills e path de
        hook config no mesmo contrato/teste.
status: active
branch: develop
started: 2026-07-09T11:18:44Z
startedCommit: a09d1237c72a2a4120932e3f4357510923414acd
lastUpdated: 2026-07-09T11:18:44Z
nextAction: Rodar `done T-001` depois de atualizar project-setup.md e tests/project.test.js.
parentPlan: installer-hooks-cross-ide
phaseId: F1
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 4
exitGates:
  - id: G-1
    description: project.test.js valida que setup e README nao prometem hooks para
      hosts sem contrato e que Codex e detectado por `.codex/ || .agents/`.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/project.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/project.test.js"
  - id: G-2
    description: A documentacao instalada em .atomic-skills/status/hooks/README.md
      reflete o mesmo contrato da fonte em
      skills/shared/project-assets/hooks/README.md.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/project.test.js tests/hooks/session-start.test.sh
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/project.test.js tests/hooks/session-start…"
stack:
  - id: 1
    title: Setup e documentacao
    type: task
    openedAt: 2026-07-09T11:18:44Z
tasks:
  - id: T-001
    title: Corrigir project-setup.md
    summary: Atualiza project-setup.md para separar skills/hooks e detectar Codex
      por .codex/ ou .agents/.
    weight: 2
    description: Atualizar o setup para declarar matriz de skills e matriz de hooks
      como passos separados.
    status: pending
    lastUpdated: 2026-07-09T11:18:44Z
    scopeBoundary:
      - nao alterar scripts de hook ou runtime layer nesta task
    acceptance:
      - project-setup.md lista paths de skills por host e registra hooks apenas
        para hosts com contrato
      - project-setup.md detecta Codex por `.codex/ || .agents/` antes da
        fallback generica de hosts sem contrato
    verifier:
      kind: shell
      command: node --test tests/project.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-setup.md
      - kind: file
        path: tests/project.test.js
  - id: T-002
    title: Corrigir README de hooks fonte e instalado
    summary: Alinha README fonte e instalado ao contrato F0 sem prometer hooks fora
      da matriz.
    weight: 2
    description: Alinhar README fonte e README instalado para explicar suporte real,
      wrapper de projeto e no-op por host.
    status: pending
    lastUpdated: 2026-07-09T11:18:44Z
    scopeBoundary:
      - nao editar session-start.sh, stop.sh ou pre-write.sh nesta task
    acceptance:
      - os READMEs nao prometem .codex/hooks.json nem
        .claude/settings.local.json fora da matriz aprovada
    verifier:
      kind: shell
      command: node --test tests/project.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/hooks/README.md
      - kind: file
        path: .atomic-skills/status/hooks/README.md
      - kind: file
        path: tests/project.test.js
parked: []
emerged: []
planTitle: Corrigir compatibilidade cross-IDE dos hooks do installer
planActive: true
current: true
---

# Setup e documentacao

Initiative for phase **F1 - Setup e documentacao**.

## Decisions

- L-001 da F0 foi aplicada na propria materializacao: T-001 e G-1 exigem que o contrato/teste cubra tanto o path de skills quanto o path de hook config para Codex (`.codex/ || .agents/`).
- A fase limita-se a setup e documentacao; runtime layer, scripts de hook e reparo local de .codex/hooks.json ficam fora deste boundary.

## Links

- Plano: `../plan.md`
- Source sidecar: `installer-hooks-cross-ide-f1-setup-e-documentacao.source.json`
- Lessons aplicadas: `../lessons/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md`

## Session handoff

- **Narrative:** F1 ativa no plano `installer-hooks-cross-ide`, com 2 tasks pendentes e businessIntent ratificado pelo usuario em 2026-07-09T11:18:44Z.
- **Decision log:** Setup e README devem separar instalacao de skills de setup de hooks. Hosts sem contrato documentado recebem no-op de hooks; Claude Code e Codex sao tratados apenas quando houver arquivo de config aprovado, preservando entradas de terceiros.
- **Single nextAction:** Rodar `done T-001` depois de atualizar project-setup.md e tests/project.test.js.
- **Verbatim state:** `rtk git status --porcelain` -> clean output; `rtk git log --oneline -3` -> `d03c1b0 chore(project): advance installer-hooks-cross-ide F0` / `a09d123 chore(project): record installer hooks F0 review gate` / `0f48aa8 chore(project): record installer hooks review fix`; `rtk git symbolic-ref --short HEAD` -> `develop`; active plan path `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md`; active phase path `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/f1-setup-e-documentacao.md`; verifier for T-001: `node --test tests/project.test.js`.
- **Uncommitted changes:** clean tree
