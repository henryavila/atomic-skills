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
lastUpdated: 2026-07-09T11:47:03.029Z
nextAction: Run `phase-done`.
parentPlan: installer-hooks-cross-ide
phaseId: F1
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
weightDone: 4
weightTotal: 4
exitGates:
  - id: G-1
    description: project.test.js valida que setup e README nao prometem hooks para
      hosts sem contrato e que Codex e detectado por `.codex/ || .agents/`.
    status: met
    verifier:
      kind: shell
      command: node --test tests/project.test.js
      expectExitCode: 0
    metAt: 2026-07-09T11:44:00.384Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T11:44:00.384Z
      passed: true
      exitCode: 0
      outputSummary: rtk node --test tests/project.test.js -> tests 57, suites 1, pass
        57, fail 0, duration_ms 3696.935042
    verifierLabel: "shell: node --test tests/project.test.js"
    evidenceSummary: passed · 2026-07-09
  - id: G-2
    description: A documentacao instalada em .atomic-skills/status/hooks/README.md
      reflete o mesmo contrato da fonte em
      skills/shared/project-assets/hooks/README.md.
    status: met
    verifier:
      kind: shell
      command: node --test tests/project.test.js && bash
        tests/hooks/session-start.test.sh
      expectExitCode: 0
    metAt: 2026-07-09T11:44:00.384Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T11:44:00.384Z
      passed: true
      exitCode: 0
      outputSummary: "rtk zsh -lc node --test tests/project.test.js && bash
        tests/hooks/session-start.test.sh -> tests 57, pass 57; RESULT: 35
        passed, 0 failed"
    verifierLabel: "shell: node --test tests/project.test.js && bash tests/hooks/sessi…"
    evidenceSummary: passed · 2026-07-09
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
    status: done
    lastUpdated: 2026-07-09T11:36:51.549Z
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
    closedAt: 2026-07-09T11:36:51.549Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T11:36:51.549Z
      passed: true
      exitCode: 0
      outputSummary: rtk node --test tests/project.test.js -> tests 56, suites 1, pass
        56, fail 0, duration_ms 5062.648625
  - id: T-002
    title: Corrigir README de hooks fonte e instalado
    summary: Alinha README fonte e instalado ao contrato F0 sem prometer hooks fora
      da matriz.
    weight: 2
    description: Alinhar README fonte e README instalado para explicar suporte real,
      wrapper de projeto e no-op por host.
    status: done
    lastUpdated: 2026-07-09T11:40:26.892Z
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
    closedAt: 2026-07-09T11:40:26.892Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-09T11:40:26.892Z
      passed: true
      exitCode: 0
      outputSummary: rtk node --test tests/project.test.js -> tests 57, suites 1, pass
        57, fail 0, duration_ms 4274.667791
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

- **Narrative:** F1 ativa no plano `installer-hooks-cross-ide`; tasks T-001/T-002 e gates G-1/G-2 estao fechados com evidencia, e a review local da fase foi registrada em `.atomic-skills/reviews/2026-07-09-1148-installer-hooks-cross-ide-f1-local.md`. A fase esta pronta para a etapa de lessons/self-review e propagacao `phase-done`.
- **Decision log:** Review da fase usou modo local porque o diff `a09d1237c72a2a4120932e3f4357510923414acd..0ca27252edf2de326f55f5601b9c656a54c1c596` nao teve sinal destrutivo: nenhum arquivo deletado, nenhum token drop/truncate e 419 insercoes contra 95 delecoes. O review local rodou inline por restricao da ferramenta de subagente e esta marcado como isolamento degradado no arquivo de review.
- **Single nextAction:** Append phase-done self-review/lessons, propagate F1 done, archive F1, and activate/materialize F2.
- **Verbatim state:** review range -> `a09d1237c72a2a4120932e3f4357510923414acd..0ca27252edf2de326f55f5601b9c656a54c1c596`; review file -> `.atomic-skills/reviews/2026-07-09-1148-installer-hooks-cross-ide-f1-local.md`; reviewGate -> `{ status: passed, at: 0ca27252edf2de326f55f5601b9c656a54c1c596, mode: local }`; validation command -> `rtk node scripts/validate-state.js .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/f1-setup-e-documentacao.md`.
- **Uncommitted changes:** clean tree
