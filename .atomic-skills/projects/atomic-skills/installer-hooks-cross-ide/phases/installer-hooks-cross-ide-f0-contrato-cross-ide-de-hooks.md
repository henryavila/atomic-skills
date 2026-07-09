---
schemaVersion: "0.1"
slug: installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks
title: Contrato cross-IDE de hooks
goal: Mapear hosts suportados, paths de skills, contratos de hooks, arquivos de
  configuracao e comportamento seguro para hosts sem hook contract antes de
  qualquer correcao de installer.
summary: Escreve a matriz skills versus hooks e a fronteira com
  @henryavila/minimalist-installer.
businessIntent:
  value: Evita que o Atomic Skills anuncie compatibilidade multi-IDE enquanto o
    fluxo de hooks assume um host especifico, apaga hooks existentes ou orienta
    configuracao invalida.
  workflow: "Antes de editar setup, docs ou installer, a fase registra a matriz
    Claude Code, Codex, Cursor, Gemini, OpenCode e GitHub Copilot com dois eixos
    separados: instalacao de skills e setup de hooks."
  rules: Nao hardcodar comportamento Claude/Codex como se valesse para todos;
    preservar hooks de terceiros; diferenciar instalacao de skills de instalacao
    de hooks; manter @henryavila/minimalist-installer como pacote generico sem
    semantica de Atomic Skills.
  outOfScope: Nao implementar a correcao do installer, nao reparar
    .codex/hooks.json local e nao inventar suporte de hook para host sem
    contrato conhecido.
  doneWhen: A matriz host x contrato, a fronteira do minimalist-installer e o
    backlog F1-F3 estao registrados em artefatos revisaveis.
status: active
branch: develop
started: 2026-07-08T22:33:06Z
startedCommit: cb660ac9c0a3e6d29a94897a18176e23be5cafae
lastUpdated: 2026-07-09T00:53:40Z
nextAction: Executar T-003 para sincronizar o backlog F1-F3 com os artefatos de
  contrato sem implementar mudancas em setup, runtime layer, tests ou
  .codex/hooks.json.
parentPlan: installer-hooks-cross-ide
phaseId: F0
tasksDone: 2
tasksTotal: 3
gatesMet: 0
gatesTotal: 3
weightDone: 4
weightTotal: 5
exitGates:
  - id: G-1
    description: A matriz separa suporte de skills e suporte de hooks para Claude
      Code, Codex, Cursor, Gemini, OpenCode e GitHub Copilot.
    status: pending
    verifier:
      kind: shell
      command: test -s
        .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/host-hook-matrix.md
      expectExitCode: 0
    verifierLabel: "shell: test -s .atomic-skills/projects/atomic-skills/installer-hoo…"
  - id: G-2
    description: A fronteira atomic-skills versus @henryavila/minimalist-installer
      esta registrada com responsabilidade por arquivo e runtime layer.
    status: pending
    verifier:
      kind: shell
      command: grep -q '@henryavila/minimalist-installer'
        .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/minimalist-installer-boundary.md
      expectExitCode: 0
    verifierLabel: "shell: grep -q '@henryavila/minimalist-installer' .atomic-skills/p…"
  - id: G-3
    description: O backlog F1-F3 esta sincronizado com a matriz e nao contem task de
      implementacao antes do contrato.
    status: pending
    verifier:
      kind: shell
      command: test -s
        .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/implementation-backlog.md
      expectExitCode: 0
    verifierLabel: "shell: test -s .atomic-skills/projects/atomic-skills/installer-hoo…"
stack:
  - id: 1
    title: Contrato cross-IDE de hooks
    type: task
    openedAt: 2026-07-08T22:33:06Z
tasks:
  - id: T-001
    title: Inventariar hosts e contratos reais
    summary: Produz a matriz Claude Code, Codex, Cursor, Gemini, OpenCode e GitHub
      Copilot separando path de skills, arquivo de hook e comportamento no-op.
    weight: 2
    description: Ler configuracao, deteccao, docs e testes existentes para escrever
      a matriz host x skills x hooks sem alterar installer.
    status: done
    lastUpdated: 2026-07-09T00:49:18Z
    closedAt: 2026-07-09T00:49:18Z
    scopeBoundary:
      - Nao editar src/install.js, src/installer.js,
        src/runtime-layers/auto-update.js nem arquivos de hook nesta task.
      - Nao reparar .codex/hooks.json local nesta task.
    acceptance:
      - A matriz lista Claude Code, Codex, Cursor, Gemini, OpenCode e GitHub
        Copilot com path de skills, suporte de hook, arquivo de config e acao
        segura.
      - Cada linha diferencia skill install compatibility de hook setup
        compatibility.
    verifier:
      kind: shell
      command: test -s
        .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/host-hook-matrix.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T00:49:18Z
      passed: true
      exitCode: 0
      outputSummary: ""
    outputs:
      - kind: file
        path: .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/host-hook-matrix.md
  - id: T-002
    title: Registrar fronteira com minimalist-installer
    summary: Define quais responsabilidades ficam no pacote
      @henryavila/minimalist-installer e quais ficam no consumidor
      atomic-skills.
    weight: 2
    description: Mapear o uso atual de @henryavila/minimalist-installer e separar
      motor generico de efeitos da semantica de IDEs e project hooks.
    status: done
    lastUpdated: 2026-07-09T00:53:40Z
    closedAt: 2026-07-09T00:53:40Z
    scopeBoundary:
      - Nao modificar package.json, package-lock.json ou a dependencia
        @henryavila/minimalist-installer nesta task.
      - Nao mover logica de host para dentro do pacote nesta task.
    acceptance:
      - O artefato cita @henryavila/minimalist-installer e descreve provider,
        runtime layer, json merge e ownership de docs/tests.
      - A fronteira explica que o pacote permanece generico e atomic-skills
        emite a matriz de hosts.
    verifier:
      kind: shell
      command: grep -q '@henryavila/minimalist-installer'
        .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/minimalist-installer-boundary.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T00:53:40Z
      passed: true
      exitCode: 0
      outputSummary: ""
    outputs:
      - kind: file
        path: .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/minimalist-installer-boundary.md
  - id: T-003
    title: Sincronizar backlog F1-F3 com o contrato
    summary: Converte a matriz em backlog de docs, testes e reparo local sem iniciar
      a correcao do installer.
    weight: 1
    description: Revisar as fases F1-F3 contra os artefatos de contrato e registrar
      quais arquivos serao tocados depois da F0.
    status: pending
    lastUpdated: 2026-07-09T00:11:43Z
    scopeBoundary:
      - Nao implementar mudancas em setup, runtime layer, tests ou
        .codex/hooks.json.
      - Nao ativar F1, F2 ou F3 nesta task.
    acceptance:
      - O backlog aponta cada ajuste futuro para F1, F2 ou F3.
      - Nenhuma task futura mistura suporte de skills com suporte de hooks sem
        citar a matriz.
    verifier:
      kind: shell
      command: test -s
        .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/implementation-backlog.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/implementation-backlog.md
parked: []
emerged: []
planTitle: Corrigir compatibilidade cross-IDE dos hooks do installer
planActive: true
current: true
---

# Contrato cross-IDE de hooks

Initiative for phase **F0 - Contrato cross-IDE de hooks**.

## Decisions

- A F0 materializa somente o contrato e o backlog; correcao de docs, testes e
  installer comeca em F1+.
- `@henryavila/minimalist-installer` fica tratado como pacote generico; a semantica
  Atomic Skills permanece no repositorio consumidor.

## Links

- Plano: `../plan.md`
- Source: `../source.md`

## Session handoff

- **Narrative:** F0 esta ativa no plano `installer-hooks-cross-ide`. T-001 e
  T-002 estao `done` com evidencia `passed: true`; T-003 permanece pendente.
  Os artefatos de contrato atuais sao
  `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/host-hook-matrix.md`
  e
  `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/minimalist-installer-boundary.md`.
- **Decision log:** O contrato separa compatibilidade de instalacao de skills de
  compatibilidade de setup de hooks. Hosts sem arquivo/evento de hook
  documentado neste repositorio recebem no-op de hooks, enquanto Claude Code e
  Codex ficam em merge-only para preservar entradas de terceiros. A fronteira
  registrada em T-002 mantem `@henryavila/minimalist-installer` como driver
  generico; matriz de hosts, deltas de hook, docs e testes pertencem ao
  consumidor `atomic-skills`.
- **Single nextAction:** Executar T-003 criando
  `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/implementation-backlog.md`,
  depois rodar `test -s .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/implementation-backlog.md`.
- **Verbatim state:**
  ```text
  rtk bash -lc "grep -q '@henryavila/minimalist-installer' .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/minimalist-installer-boundary.md"
  exit code: 0

  rtk node scripts/append-completion.js . --event task-done --project atomic-skills --plan installer-hooks-cross-ide --phase F0 --task T-002 --weight 2 --basis proxy
  append-completion: task-done atomic-skills/installer-hooks-cross-ide/F0/T-002 weight=2(proxy) ✓

  rtk node scripts/validate-state.js .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md
  ✓ .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md  [plan]
  ✓ .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md  [initiative]

  ✓ All 2 file(s) valid, 1 plan(s) cross-validated (schemaVersion 0.1/0.2)

  rtk node scripts/refresh-state.js
  refresh-state: rollups 1 changed, focus 0 changed, digest → installer-hooks-cross-ide · F0

  implementation commit: aa000de docs(T-002): define minimalist installer boundary
  state checkpoint commit: 718bb30 chore(project): checkpoint installer-hooks-cross-ide F0 T-002
  ```
- **Uncommitted changes:**
  ```text
   M .atomic-skills/projects/atomic-skills/ideas.md
   M .atomic-skills/status/hooks/README.md
   M skills/shared/project-assets/hooks/README.md
   M skills/shared/project-assets/project-setup.md
   M tests/hooks/session-start.test.sh
   M tests/project.test.js
  ```
