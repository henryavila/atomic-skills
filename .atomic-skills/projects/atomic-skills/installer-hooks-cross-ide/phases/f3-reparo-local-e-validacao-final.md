---
schemaVersion: "0.1"
slug: installer-hooks-cross-ide-f3-reparo-local-e-validacao-final
title: Reparo local e validacao final
goal: Aplicar o reparo local em .codex/hooks.json por merge quando o contrato
  disser que Codex tem hook contract neste projeto, rodar a suite relevante e
  fechar a fase com review.
status: active
branch: develop
started: 2026-07-10T12:11:11.688Z
lastUpdated: 2026-07-10T12:17:41.410Z
nextAction: Rode `phase-done` para verificar os exit gates e fechar F3.
parentPlan: installer-hooks-cross-ide
phaseId: F3
businessIntent:
  value: Garante que usuarios Codex deste repositorio recebam os hooks do project
    aprovados sem perder hooks locais existentes, fechando a correcao cross-IDE
    com a configuracao local coerente com o contrato.
  workflow: O mantenedor inicia F3 depois de F0-F2, aplica merge em
    `.codex/hooks.json`, preserva o hook Nexus existente, roda validate-state e
    as suites project/install/hooks, e fecha a fase somente depois do review.
  rules: Usar `host-hook-matrix.md` como contrato; tratar o reparo como
    merge-only; preservar hooks de terceiros; adicionar apenas entradas Atomic
    Skills aprovadas para Codex; manter hosts sem hook contract como no-op;
    executar scripts shell por `bash`, nao por `node --test`.
  outOfScope: Nao alterar o contrato cross-IDE, nao adicionar runtime de
    auto-update para Codex, nao mudar paths de hosts sem contrato e nao remover
    hooks locais de terceiros.
  doneWhen: "`.codex/hooks.json` preserva o hook Nexus, contem somente entradas
    Atomic Skills aprovadas para Codex, validate-state e as suites relevantes
    passam, e o review da fase fica registrado."
  derived:
    - question: Como L-001 da F1 foi aplicada na F3?
      answer: Os verifiers de F3 mantem comandos shell separados por `&& bash
        <script>.sh`; nenhum script `.sh` e passado para `node --test`.
    - question: Como L-001 da F2 foi aplicada na F3?
      answer: A fase usa `PUBLIC_IDE_IDS`/config canonica nos testes existentes quando
        tocar matriz de hosts; matrizes locais ficam limitadas a expectations de
        paths e contratos.
tasksDone: 2
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 4
weightTotal: 4
exitGates:
  - id: G-1
    description: .codex/hooks.json local preserva o hook Nexus e adiciona apenas
      entradas aprovadas pelo contrato.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/project.test.js
        tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/project.test.js tests/install-uninstall-r…"
  - id: G-2
    description: Validacao final de estado e hooks passa apos refresh-state.
    status: pending
    verifier:
      kind: shell
      command: node scripts/validate-state.js && bash tests/hooks/session-start.test.sh
      expectExitCode: 0
    verifierLabel: "shell: node scripts/validate-state.js && bash tests/hooks/session-…"
stack:
  - id: 1
    title: Reparo local e validacao final
    type: task
    openedAt: 2026-07-10T12:11:11.688Z
tasks:
  - id: T-001
    title: Reparar .codex/hooks.json por merge
    description: Adicionar somente entradas aprovadas pelo contrato e preservar o
      hook Nexus existente.
    status: done
    lastUpdated: 2026-07-10T12:15:01.798Z
    scopeBoundary:
      - nao sobrescrever .codex/hooks.json inteiro e nao remover hooks de
        terceiros
    acceptance:
      - .codex/hooks.json contem o hook Nexus pre-existente e as entradas Atomic
        Skills aprovadas pela matriz
    verifier:
      kind: shell
      command: node --test tests/project.test.js
        tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: .codex/hooks.json
    summary: Aplica merge em `.codex/hooks.json`, preservando o hook Nexus e
      adicionando apenas hooks do project aprovados para Codex.
    weight: 2
    closedAt: 2026-07-10T12:15:01.798Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-10T12:15:01.798Z
      passed: true
      exitCode: 0
      outputSummary: rtk node --test tests/project.test.js
        tests/install-uninstall-roundtrip.test.js -> tests 67, suites 2, pass
        67, fail 0, duration_ms 4387.309542
  - id: T-002
    title: Rodar validacao final e review
    description: Executar validate-state, suite relevante e review da fase antes de fechar.
    status: done
    lastUpdated: 2026-07-10T12:17:41.410Z
    scopeBoundary:
      - nao fechar fase com verifier falhando
    acceptance:
      - validate-state, project tests, round-trip e session-start passam na
        arvore atual
    verifier:
      kind: shell
      command: node scripts/validate-state.js && node --test tests/project.test.js
        tests/install-uninstall-roundtrip.test.js && bash
        tests/hooks/session-start.test.sh
      expectExitCode: 0
    outputs:
      - kind: test
        command: node --test tests/project.test.js
          tests/install-uninstall-roundtrip.test.js
      - kind: test
        command: bash tests/hooks/session-start.test.sh
    summary: Executa validate-state, suites project/install/hooks e review para
      fechar a fase com evidencia registrada.
    weight: 2
    closedAt: 2026-07-10T12:17:41.410Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-10T12:17:41.410Z
      passed: true
      exitCode: 0
      outputSummary: "rtk zsh -lc node scripts/validate-state.js && node --test
        tests/project.test.js tests/install-uninstall-roundtrip.test.js && bash
        tests/hooks/session-start.test.sh -> validate-state 162 files valid;
        tests 67, suites 2, pass 67, fail 0; session-start RESULT: 38 passed, 0
        failed"
parked: []
emerged: []
startedCommit: bdf4085f74d1d663271d92abe6249a861b9f67db
planTitle: Corrigir compatibilidade cross-IDE dos hooks do installer
planActive: true
current: true
---

# Reparo local e validacao final

Initiative for phase **F3 - Reparo local e validacao final**.

## Decisions

- Review local F3 registrado em `.atomic-skills/reviews/2026-07-10-1217-installer-hooks-cross-ide-f3-local.md`; a finding major sobre verifier parcial foi corrigida antes de fechar T-002.
- Lessons F1/F2 aplicadas no phase-start: comandos mistos usam `bash` explicitamente e testes de matriz usam fonte canonica para hosts publicos.
- F3 limita o reparo a `.codex/hooks.json` local por merge; mudancas de contrato, runtime de auto-update e hosts sem hook contract ficam fora do boundary.

## Links

- Plano: `../plan.md`
- Source sidecar: `installer-hooks-cross-ide-f3-reparo-local-e-validacao-final.source.json`
- Lessons aplicadas: `../lessons/installer-hooks-cross-ide-f1-setup-e-documentacao.md`, `../lessons/installer-hooks-cross-ide-f2-testes-de-regressao.md`
