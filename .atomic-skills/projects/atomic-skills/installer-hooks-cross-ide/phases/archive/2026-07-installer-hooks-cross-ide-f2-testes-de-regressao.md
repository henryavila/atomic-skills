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
status: done
branch: develop
started: 2026-07-09T13:59:23Z
startedCommit: 8bcf398dd70109eb964ad8e4f1b8d0f5102863b0
lastUpdated: 2026-07-10T12:11:11.688Z
nextAction: null
parentPlan: installer-hooks-cross-ide
phaseId: F2
tasksDone: 3
tasksTotal: 3
gatesMet: 2
gatesTotal: 2
weightDone: 6
weightTotal: 6
exitGates:
  - id: G-1
    description: A suite de project/install cobre a matriz cross-IDE de skills versus hooks.
    status: met
    verifier:
      kind: shell
      command: node --test tests/project.test.js
        tests/install-uninstall-roundtrip.test.js
        tests/minimalist-installer-link.test.js
      expectExitCode: 0
    metAt: 2026-07-09T14:36:24Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T14:36:24Z
      passed: true
      exitCode: 0
      outputSummary: rtk zsh -lc node --test tests/project.test.js
        tests/install-uninstall-roundtrip.test.js
        tests/minimalist-installer-link.test.js -> tests 68, suites 3, pass 68,
        fail 0, duration_ms 6012.093666
    verifierLabel: "shell: node --test tests/project.test.js tests/install-uninstall-r…"
    evidenceSummary: passed · 2026-07-09
  - id: G-2
    description: Os testes de hooks cobrem SessionStart e preservacao de hooks
      existentes no setup suportado.
    status: met
    verifier:
      kind: shell
      command: bash tests/hooks/session-start.test.sh
      expectExitCode: 0
    metAt: 2026-07-09T14:36:24Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T14:36:24Z
      passed: true
      exitCode: 0
      outputSummary: "rtk zsh -lc bash tests/hooks/session-start.test.sh -> RESULT: 38
        passed, 0 failed"
    verifierLabel: "shell: bash tests/hooks/session-start.test.sh"
    evidenceSummary: passed · 2026-07-09
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
    status: done
    lastUpdated: 2026-07-09T14:17:01Z
    closedAt: 2026-07-09T14:17:01Z
    scopeBoundary:
      - nao alterar docs nesta task
    acceptance:
      - teste prova que hook de terceiro permanece apos install/update/uninstall
        e que somente a entrada Atomic Skills e removida
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T14:17:01Z
      passed: true
      exitCode: 0
      outputSummary: rtk node --test tests/install-uninstall-roundtrip.test.js ->
        tests 10, suites 1, pass 10, fail 0, duration_ms 3404.337291
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
    status: done
    lastUpdated: 2026-07-09T14:26:54Z
    closedAt: 2026-07-09T14:26:54Z
    scopeBoundary:
      - nao registrar hooks locais nesta task
    acceptance:
      - suite de hooks passa e os testes cobrem ausencia de config como no-op
    verifier:
      kind: shell
      command: bash tests/hooks/session-start.test.sh && bash tests/hooks/stop.test.sh
        && bash tests/hooks/pre-write.test.sh
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T14:26:54Z
      passed: true
      exitCode: 0
      outputSummary: rtk zsh -lc bash tests/hooks/session-start.test.sh && bash
        tests/hooks/stop.test.sh && bash tests/hooks/pre-write.test.sh ->
        session-start RESULT 38 passed, 0 failed; stop RESULT 43 passed, 0
        failed; pre-write RESULT 70 passed, 0 failed
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
current: false
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
- T-002 rodou por Mode 2 em
  `/Volumes/External/code/.worktrees/atomic-skills-installer-hooks-cross-ide-f2-t-002`;
  o diff foi aplicado serialmente no primario e re-verificado antes do commit
  `fbfb6c4`. Nenhuma mudanca runtime foi necessaria.
- T-003 rodou por Mode 2 em
  `/Volumes/External/code/.worktrees/atomic-skills-installer-hooks-cross-ide-f2-t-003`;
  o diff foi aplicado serialmente no primario e re-verificado antes do commit
  `6e412b8`. Nenhuma mudanca em scripts fonte foi necessaria.
- O review local encontrou uma lacuna menor de cobertura: `tests/project.test.js`
  duplicava a lista de hosts publicos em vez de importar `PUBLIC_IDE_IDS`. O fix
  esta em `65e003a` e a review final limpa esta registrada em
  `.atomic-skills/reviews/2026-07-09-1439-installer-hooks-cross-ide-f2-local.md`.

## Links

- Plano: `../plan.md`
- Source sidecar: `installer-hooks-cross-ide-f2-testes-de-regressao.source.json`
- Lessons aplicadas: `../lessons/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md`, `../lessons/installer-hooks-cross-ide-f1-setup-e-documentacao.md`
- Lesson produzida: `../lessons/installer-hooks-cross-ide-f2-testes-de-regressao.md`

## Self-review against code-quality gates

- **G1 read-before-claim:** tasks, gates e review foram fechados depois de ler os
  diffs e arquivos finais: `tests/project.test.js`, `tests/install.test.js`,
  `tests/install-uninstall-roundtrip.test.js`, os tres scripts de teste em
  `tests/hooks/`, `src/config.js` e `src/runtime-layers/auto-update.js`.
- **G2 soft-language:** nextAction, gates, reviewGate e handoff foram conferidos
  para declaracoes operacionais sem linguagem de incerteza.
- **G6 reference-or-strike:** G-1 e G-2 estao `met` com comando, exit code e
  resumo de saida. Nao ha gate F2 pendente ou deferred.
- **G10 gate-must-be-able-to-fail:** G-1 falha se `PUBLIC_IDE_IDS`, skill paths,
  hook merge ou uninstall/update regredirem; G-2 falha se o hook SessionStart nao
  resolver por `$PWD` ou se criar arquivo de config de host sem contrato.
- **Review gate:** review obrigatoria da fase registrada como `passed`, modo
  `local`, em `d48f30efd9457d08b6bb9d3dd54c234ebb20f61e`; arquivo
  `.atomic-skills/reviews/2026-07-09-1439-installer-hooks-cross-ide-f2-local.md`.
  O review local rodou inline por restricao da ferramenta de subagente e esta
  marcado como isolamento degradado no arquivo de review.
- **Lessons:** uma lesson reutilizavel foi destilada e ratificada pelo usuario
  em `../lessons/installer-hooks-cross-ide-f2-testes-de-regressao.md`; reusable
  1, local 0.

## Session handoff

- **Narrative:** F2 foi encerrada e arquivada depois de 3/3 tasks done, G-1/G-2 met, reviewGate passed e lesson F2 ratificada. O plano `installer-hooks-cross-ide` avancou para F3.
- **Decision log:** O aceite do usuario para continuar foi usado como aceite explicito de avanco F2 -> F3. As lessons aplicaveis de F1/F2 foram dispositionadas como aplicadas/closed no phase-start de F3.
- **Single nextAction:** F3 esta ativa; rode `done T-001` depois de aplicar o merge aprovado em `.codex/hooks.json`.
- **Verbatim state:** F2 archive -> `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/archive/2026-07-installer-hooks-cross-ide-f2-testes-de-regressao.md`; F3 initiative -> `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/f3-reparo-local-e-validacao-final.md`; completion event -> `append-completion: phase-done atomic-skills/installer-hooks-cross-ide/F2 weight=1(count) ✓`; F3 startedCommit -> `bdf4085f74d1d663271d92abe6249a861b9f67db`.
