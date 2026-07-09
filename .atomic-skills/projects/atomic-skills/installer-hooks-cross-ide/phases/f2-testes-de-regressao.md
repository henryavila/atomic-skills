---
schemaVersion: "0.1"
slug: installer-hooks-cross-ide-f2-testes-de-regressao
title: Testes de regressao
goal: Adicionar cobertura para Claude Code, Codex, Cursor, Gemini, OpenCode e
  GitHub Copilot, incluindo preservacao de hooks existentes e no-op seguro em
  hosts sem hook contract.
summary: Adiciona regressao automatica para matriz de hosts e preservacao de hooks.
businessIntent:
  value: Reduz regressao cross-IDE ao transformar a matriz de hosts em testes
    executaveis que protegem usuarios de Claude Code, Codex, Cursor, Gemini,
    OpenCode e GitHub Copilot contra hook setup invalido.
  workflow: O mantenedor roda a suite de regressao de project/install/hooks e
    recebe falha quando skill path, hook merge ou no-op por host divergem do
    contrato ratificado.
  rules: Cobrir skills e hooks como eixos separados; preservar hooks de terceiros
    em hosts com merge suportado; manter no-op explicito para hosts sem hook
    contract; executar scripts shell por `bash`, nao por `node --test`.
  outOfScope: Nao reparar `.codex/hooks.json` local, nao registrar hooks locais e
    nao alterar documentacao fora do necessario para testes nesta fase.
  doneWhen: A matriz cross-IDE, a preservacao de hooks existentes e os hooks do
    project tem cobertura automatica com verifiers deterministas passando.
  derived:
    - question: Como L-001 da F1 foi aplicada na F2?
      answer: Gates e tasks que combinam Node e shell mantem comandos shell explicitos
        com `&& bash <script>.sh`; scripts `.sh` nao sao passados para `node
        --test`.
status: active
branch: develop
started: 2026-07-09T13:59:23Z
startedCommit: 8bcf398dd70109eb964ad8e4f1b8d0f5102863b0
lastUpdated: 2026-07-09T14:10:49Z
nextAction: Implementar T-002 em tests/install-uninstall-roundtrip.test.js,
  src/runtime-layers/auto-update.js e src/installer.js; depois rodar `done T-002`.
parentPlan: installer-hooks-cross-ide
phaseId: F2
tasksDone: 1
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
weightDone: 2
weightTotal: 6
exitGates:
  - id: G-1
    description: A suite de project/install cobre a matriz cross-IDE de skills versus hooks.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/project.test.js
        tests/install-uninstall-roundtrip.test.js
        tests/minimalist-installer-link.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/project.test.js tests/install-uninstall-r…"
  - id: G-2
    description: Os testes de hooks cobrem SessionStart e preservacao de hooks
      existentes no setup suportado.
    status: pending
    verifier:
      kind: shell
      command: bash tests/hooks/session-start.test.sh
      expectExitCode: 0
    verifierLabel: "shell: bash tests/hooks/session-start.test.sh"
stack:
  - id: 1
    title: Testes de regressao
    type: task
    openedAt: 2026-07-09T13:59:23Z
tasks:
  - id: T-001
    title: Cobrir matriz de hosts no setup
    summary: Adiciona asserts para a matriz cross-IDE de skill paths e comportamento
      de hooks por host.
    weight: 2
    description: Adicionar fixtures ou asserts que exercitam a matriz cross-IDE de
      skill path e hook behavior.
    status: done
    lastUpdated: 2026-07-09T14:10:49Z
    closedAt: 2026-07-09T14:10:49Z
    scopeBoundary:
      - nao mudar comportamento runtime sem teste falhando que descreva a matriz
    acceptance:
      - cada host declarado tem caso de teste para path de skills e resultado de
        hooks
    verifier:
      kind: shell
      command: node --test tests/project.test.js tests/install.test.js
        tests/minimalist-installer-link.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T14:10:49Z
      passed: true
      exitCode: 0
      outputSummary: rtk node --test tests/project.test.js tests/install.test.js
        tests/minimalist-installer-link.test.js -> tests 96, suites 7, pass 96,
        fail 0, duration_ms 6448.072375
    outputs:
      - kind: file
        path: tests/project.test.js
      - kind: file
        path: tests/install.test.js
      - kind: file
        path: tests/minimalist-installer-link.test.js
  - id: T-002
    title: Cobrir preservacao de hooks existentes
    summary: Garante por teste que hooks de terceiros sobrevivem a install/update e
      uninstall.
    weight: 2
    description: Garantir que entradas de terceiros sobrevivem quando o host suporta
      merge de hooks.
    status: pending
    lastUpdated: 2026-07-09T13:59:23Z
    scopeBoundary:
      - nao alterar docs nesta task
    acceptance:
      - teste prova que hook de terceiro permanece apos install/update/uninstall
        e que somente a entrada Atomic Skills e removida
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: tests/install-uninstall-roundtrip.test.js
      - kind: file
        path: src/runtime-layers/auto-update.js
      - kind: file
        path: src/installer.js
  - id: T-003
    title: Cobrir hooks do project
    summary: Valida SessionStart, Stop e PreToolUse com fallback de diretorio e
      no-op seguro.
    weight: 2
    description: Validar que os hooks do project continuam executando com fallback
      de diretorio e sem acoplamento a host sem contrato.
    status: pending
    lastUpdated: 2026-07-09T13:59:23Z
    scopeBoundary:
      - nao registrar hooks locais nesta task
    acceptance:
      - suite de hooks passa e os testes cobrem ausencia de config como no-op
    verifier:
      kind: shell
      command: bash tests/hooks/session-start.test.sh && bash tests/hooks/stop.test.sh
        && bash tests/hooks/pre-write.test.sh
      expectExitCode: 0
    outputs:
      - kind: file
        path: tests/hooks/session-start.test.sh
      - kind: file
        path: tests/hooks/stop.test.sh
      - kind: file
        path: tests/hooks/pre-write.test.sh
parked: []
emerged: []
planTitle: Corrigir compatibilidade cross-IDE dos hooks do installer
planActive: true
current: true
---

# Testes de regressao

Initiative for phase **F2 - Testes de regressao**.

## Decisions

- L-001 da F1 foi aplicada na materializacao: comandos que combinam Node e shell
  usam `&& bash <script>.sh`, e nenhum script `.sh` e passado para `node --test`.
- A fase cobre regressao de matriz e preservacao; reparo local de `.codex/hooks.json`
  permanece fora do boundary e fica para F3.
- T-001 rodou por Mode 2 em
  `/Volumes/External/code/.worktrees/atomic-skills-installer-hooks-cross-ide-f2-t-001`;
  o diff foi aplicado serialmente no primario e re-verificado antes do commit
  `22f36b7`. `dispatch-log.json` nao foi alterado porque o arquivo existente esta
  em formato misto NDJSON/array e a normalizacao fica fora do boundary de T-001.

## Links

- Plano: `../plan.md`
- Source sidecar: `installer-hooks-cross-ide-f2-testes-de-regressao.source.json`
- Lessons aplicadas: `../lessons/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md`, `../lessons/installer-hooks-cross-ide-f1-setup-e-documentacao.md`

## Session handoff

- **Narrative:** F2 esta ativa no plano `installer-hooks-cross-ide`; T-001 esta fechada com evidence `passed: true` e commit de implementacao `22f36b7`. T-002 e a proxima task pendente.
- **Decision log:** T-001 usou Mode 2 porque routing estava ligado e a task tinha paths exatos, scopeBoundary, acceptance e verifier shell deterministico. O diff do worktree foi aplicado no primario e re-verificado com o mesmo comando antes de fechar a task; `dispatch-log.json` nao foi alterado porque o arquivo existente esta em formato misto NDJSON/array.
- **Single nextAction:** Implementar T-002 em tests/install-uninstall-roundtrip.test.js, src/runtime-layers/auto-update.js e src/installer.js; depois rodar `done T-002`.
- **Verbatim state:** worktree -> `/Volumes/External/code/.worktrees/atomic-skills-installer-hooks-cross-ide-f2-t-001`; implementation commit -> `22f36b7 test(T-001): cover cross-IDE host matrix`; verifier -> `rtk node --test tests/project.test.js tests/install.test.js tests/minimalist-installer-link.test.js`; verifier result -> `tests 96, suites 7, pass 96, fail 0, duration_ms 6448.072375`; completion event -> `append-completion: task-done atomic-skills/installer-hooks-cross-ide/F2/T-001 weight=1(count) ✓`.
- **Uncommitted changes:** clean tree
