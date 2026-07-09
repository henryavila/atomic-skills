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
lastUpdated: 2026-07-09T10:03:35Z
nextAction: Rodar `phase-done` para verificar os gates G-1, G-2 e G-3 da F0.
parentPlan: installer-hooks-cross-ide
phaseId: F0
tasksDone: 3
tasksTotal: 3
gatesMet: 3
gatesTotal: 3
weightDone: 5
weightTotal: 5
exitGates:
  - id: G-1
    description: A matriz separa suporte de skills e suporte de hooks para Claude
      Code, Codex, Cursor, Gemini, OpenCode e GitHub Copilot.
    status: met
    verifier:
      kind: shell
      command: test -s
        .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/host-hook-matrix.md
      expectExitCode: 0
    metAt: 2026-07-09T10:03:35Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T10:03:35Z
      passed: true
      exitCode: 0
      outputSummary: ""
    verifierLabel: "shell: test -s .atomic-skills/projects/atomic-skills/installer-hoo…"
    evidenceSummary: passed · 2026-07-09
  - id: G-2
    description: A fronteira atomic-skills versus @henryavila/minimalist-installer
      esta registrada com responsabilidade por arquivo e runtime layer.
    status: met
    verifier:
      kind: shell
      command: grep -q '@henryavila/minimalist-installer'
        .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/minimalist-installer-boundary.md
      expectExitCode: 0
    metAt: 2026-07-09T10:03:35Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T10:03:35Z
      passed: true
      exitCode: 0
      outputSummary: ""
    verifierLabel: "shell: grep -q '@henryavila/minimalist-installer' .atomic-skills/p…"
    evidenceSummary: passed · 2026-07-09
  - id: G-3
    description: O backlog F1-F3 esta sincronizado com a matriz e nao contem task de
      implementacao antes do contrato.
    status: met
    verifier:
      kind: shell
      command: test -s
        .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/implementation-backlog.md
      expectExitCode: 0
    metAt: 2026-07-09T10:03:35Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T10:03:35Z
      passed: true
      exitCode: 0
      outputSummary: ""
    verifierLabel: "shell: test -s .atomic-skills/projects/atomic-skills/installer-hoo…"
    evidenceSummary: passed · 2026-07-09
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
    status: done
    lastUpdated: 2026-07-09T00:56:51Z
    closedAt: 2026-07-09T00:56:51Z
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
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T00:56:51Z
      passed: true
      exitCode: 0
      outputSummary: ""
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

- **Narrative:** F0 esta ativa no plano `installer-hooks-cross-ide` com T-001,
  T-002 e T-003 `done` e evidencia `passed: true`. Os artefatos de contrato
  atuais sao
  `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/host-hook-matrix.md`,
  `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/minimalist-installer-boundary.md`
  e `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/implementation-backlog.md`.
- **Decision log:** O contrato separa compatibilidade de instalacao de skills de
  compatibilidade de setup de hooks. Hosts sem arquivo/evento de hook
  documentado neste repositorio recebem no-op de hooks, enquanto Claude Code e
  Codex ficam em merge-only para preservar entradas de terceiros. A fronteira
  registrada em T-002 mantem `@henryavila/minimalist-installer` como driver
  generico; matriz de hosts, deltas de hook, docs e testes pertencem ao
  consumidor `atomic-skills`. T-003 sincronizou F1-F3 com os dois contratos sem
  implementar setup, runtime layer, tests ou `.codex/hooks.json`.
- **Single nextAction:** Rodar `phase-done` para a F0.
- **Verbatim state:**
  ```text
  rtk bash -lc 'test -s .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/implementation-backlog.md'
  exit code: 0

  rtk node scripts/append-completion.js . --event task-done --project atomic-skills --plan installer-hooks-cross-ide --phase F0 --task T-003 --weight 1 --basis proxy
  append-completion: task-done atomic-skills/installer-hooks-cross-ide/F0/T-003 weight=1(proxy) ✓

  rtk node scripts/validate-state.js .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md
  ✓ .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md  [plan]
  ✓ .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md  [initiative]

  ✓ All 2 file(s) valid, 1 plan(s) cross-validated (schemaVersion 0.1/0.2)

  rtk node scripts/refresh-state.js
  refresh-state: rollups 1 changed, focus 0 changed, digest → installer-hooks-cross-ide · F0

  implementation commit: 576fe08 docs(T-003): sync implementation backlog
  state checkpoint commit: e2cce35 chore(project): checkpoint installer-hooks-cross-ide F0 T-003
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

## Self-review against code-quality gates

- **G1 read-before-claim**: 3 tasks closed, each with `outputs[]` pointing to
  the contract artifact it produced; `src/config.js`, `src/detect.js`,
  `src/runtime-layers/auto-update.js`, `skills/shared/project-assets/project-setup.md`
  and `skills/shared/project-assets/hooks/README.md` were read before the
  host-contract claims were recorded.
- **G2 soft-language**: scanned `nextAction`, task descriptions and criterion
  descriptions for soft-language ban terms; 0 violations found.
- **G6 reference-or-strike**: 3 exit criteria, 3 met with `evidence.passed:
  true`, 0 deferred and 0 unverified.
- **G10 gate-must-be-able-to-fail**: each exit criterion has a shell verifier
  that fails when its required contract artifact is missing or incomplete.
- **Codex review**: ran review-code/codex and phase-done local follow-up at
  HEAD = `0f48aa8697c5bb5cd89258dda1c234c906146784`; verdict
  `needs_changes_fixed`, counts `0B/0C/1M/0m/0n`, file
  `.atomic-skills/reviews/2026-07-09-0628-installer-hooks-cross-ide.md`.
- **Review gate (G2)**: recorded on the phase descriptor as
  `reviewGate: { status: passed, at: 0f48aa8697c5bb5cd89258dda1c234c906146784,
  mode: both }`.
- **Lessons (G1)**: distilled 1 reusable lesson into
  `lessons/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md`,
  ratified by the user.
