---
schemaVersion: "0.1"
slug: installer-hooks-cross-ide
title: Corrigir compatibilidade cross-IDE dos hooks do installer
version: "1.0"
status: active
started: 2026-07-08T22:33:06Z
lastUpdated: 2026-07-09T00:11:43Z
branch: develop
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Separar instalacao de skills de contrato de hooks
    body: Um host pode receber skills sem ter suporte documentado para hooks; o setup
      registra essa diferenca como comportamento explicito.
  - id: P2
    title: Hooks sao opt-in e merge-only
    body: Qualquer configuracao de hook preserva entradas de terceiros e nunca
      substitui o arquivo inteiro por um snapshot do Atomic Skills.
  - id: P3
    title: O pacote minimalist-installer nao recebe semantica do Atomic Skills
    body: O pacote fornece efeitos e driver genericos; a matriz de IDEs, paths de
      skills e contrato dos hooks do project pertencem ao consumidor
      atomic-skills.
  - id: P4
    title: Hosts sem contrato conhecido recebem no-op documentado
    body: Cursor, Gemini, OpenCode e GitHub Copilot continuam cobertos pela
      instalacao de skills, mas hooks so aparecem quando o host tem arquivo e
      evento suportados.
glossary:
  - term: Skill install compatibility
    definition: Capacidade de instalar arquivos de skill no path declarado para o host.
  - term: Hook setup compatibility
    definition: Capacidade de registrar eventos de hook em um arquivo de config
      reconhecido pelo host sem apagar configuracao existente.
  - term: minimalist-installer boundary
    definition: Fronteira entre o pacote generico @henryavila/minimalist-installer
      e o consumidor atomic-skills que emite providers/runtime layers.
phases:
  - id: F0
    slug: installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks
    title: Contrato cross-IDE de hooks
    goal: Mapear hosts suportados, paths de skills, contratos de hooks, arquivos de
      configuracao e comportamento seguro para hosts sem hook contract antes de
      qualquer correcao de installer.
    summary: Escreve a matriz skills versus hooks e a fronteira com
      @henryavila/minimalist-installer.
    businessIntent:
      value: Evita que o Atomic Skills anuncie compatibilidade multi-IDE enquanto o
        fluxo de hooks assume um host especifico, apaga hooks existentes ou
        orienta configuracao invalida.
      workflow: >-
        Antes de editar setup, docs ou installer, a fase registra a matriz
        Claude Code, Codex, Cursor, Gemini, OpenCode e GitHub Copilot com dois
        eixos separados: instalacao de skills e setup de hooks.
      rules: Nao hardcodar comportamento Claude/Codex como se valesse para todos;
        preservar hooks de terceiros; diferenciar instalacao de skills de
        instalacao de hooks; manter @henryavila/minimalist-installer como pacote
        generico sem semantica de Atomic Skills.
      outOfScope: Nao implementar a correcao do installer, nao reparar
        .codex/hooks.json local e nao inventar suporte de hook para host sem
        contrato conhecido.
      doneWhen: A matriz host x contrato, a fronteira do minimalist-installer e o
        backlog F1-F3 estao registrados em artefatos revisaveis.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: G-1
          description: A matriz separa suporte de skills e suporte de hooks para
            Claude Code, Codex, Cursor, Gemini, OpenCode e GitHub Copilot.
          status: pending
          verifier:
            kind: shell
            command: test -s .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/host-hook-matrix.md
            expectExitCode: 0
        - id: G-2
          description: A fronteira atomic-skills versus
            @henryavila/minimalist-installer esta registrada com responsabilidade por
            arquivo e runtime layer.
          status: pending
          verifier:
            kind: shell
            command: grep -q '@henryavila/minimalist-installer' .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/minimalist-installer-boundary.md
            expectExitCode: 0
        - id: G-3
          description: O backlog F1-F3 esta sincronizado com a matriz e nao contem
            task de implementacao antes do contrato.
          status: pending
          verifier:
            kind: shell
            command: test -s .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/implementation-backlog.md
            expectExitCode: 0
    status: active
  - id: F1
    slug: installer-hooks-cross-ide-f1-setup-e-documentacao
    title: Setup e documentacao
    goal: Corrigir project-setup.md, hooks/README.md e textos relacionados para
      separar instalacao de skills de setup de hooks, com no-op explicito para
      hosts sem contrato.
    summary: Atualiza prosa de setup e README de hooks para refletir a matriz
      cross-IDE.
    dependsOn:
      - F0
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: project.test.js valida que setup e README nao prometem hooks
            para hosts sem contrato.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project.test.js
            expectExitCode: 0
        - id: G-2
          description: A documentacao instalada em .atomic-skills/status/hooks/README.md
            reflete o mesmo contrato da fonte em skills/shared/project-assets/hooks/README.md.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project.test.js tests/hooks/session-start.test.sh
            expectExitCode: 0
    status: pending
  - id: F2
    slug: installer-hooks-cross-ide-f2-testes-de-regressao
    title: Testes de regressao
    goal: Adicionar cobertura para Claude Code, Codex, Cursor, Gemini, OpenCode e
      GitHub Copilot, incluindo preservacao de hooks existentes e no-op seguro em
      hosts sem hook contract.
    summary: Adiciona regressao automatica para matriz de hosts e preservacao de hooks.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: A suite de project/install cobre a matriz cross-IDE de skills
            versus hooks.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project.test.js tests/install-uninstall-roundtrip.test.js tests/minimalist-installer-link.test.js
            expectExitCode: 0
        - id: G-2
          description: Os testes de hooks cobrem SessionStart e preservacao de hooks
            existentes no setup suportado.
          status: pending
          verifier:
            kind: shell
            command: bash tests/hooks/session-start.test.sh
            expectExitCode: 0
    status: pending
  - id: F3
    slug: installer-hooks-cross-ide-f3-reparo-local-e-validacao-final
    title: Reparo local e validacao final
    goal: Aplicar o reparo local em .codex/hooks.json por merge quando o contrato
      disser que Codex tem hook contract neste projeto, rodar a suite relevante e
      fechar a fase com review.
    summary: Repara a configuracao local apenas depois do contrato e roda a validacao final.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: .codex/hooks.json local preserva o hook Nexus e adiciona apenas
            entradas aprovadas pelo contrato.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project.test.js tests/install-uninstall-roundtrip.test.js
            expectExitCode: 0
        - id: G-2
          description: Validacao final de estado e hooks passa apos refresh-state.
          status: pending
          verifier:
            kind: shell
            command: node scripts/validate-state.js .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md && bash tests/hooks/session-start.test.sh
            expectExitCode: 0
    status: pending
planTitle: Corrigir compatibilidade cross-IDE dos hooks do installer
planActive: true
---

# Corrigir compatibilidade cross-IDE dos hooks do installer

## 1. Context

O problema apareceu no Codex, mas a causa e mais ampla: o Atomic Skills declara
instalacao para varias IDEs/hosts, enquanto o setup de hooks atual mistura esse
suporte com instrucoes especificas de hosts que tem arquivo de configuracao de
hook. A correcao precisa separar dois contratos: onde instalar skills e quando
registrar hooks.

O plano tambem registra a fronteira com `@henryavila/minimalist-installer`: o
pacote e o motor generico de efeitos/driver, enquanto `atomic-skills` define a
matriz de hosts, runtime layers e docs do project hook.

## 2. Principles

- **P1 Separar instalacao de skills de contrato de hooks** - Um host pode receber
  skills sem ter suporte documentado para hooks.
- **P2 Hooks sao opt-in e merge-only** - Configuracao existente de terceiros deve
  sobreviver install, update, uninstall e reparo local.
- **P3 O pacote minimalist-installer nao recebe semantica do Atomic Skills** -
  Providers e runtime layers ficam no consumidor `atomic-skills`.
- **P4 Hosts sem contrato conhecido recebem no-op documentado** - A ausencia de
  hook contract vira comportamento explicito, nao promessa ambigua.

## 3. Phase tree

- **F0 - Contrato cross-IDE de hooks**: registra matriz host x skills x hooks,
  fronteira do pacote e backlog.
- **F1 - Setup e documentacao**: corrige textos e README para refletir a matriz.
- **F2 - Testes de regressao**: cria cobertura para a matriz de hosts e preservacao
  de hooks existentes.
- **F3 - Reparo local e validacao final**: repara `.codex/hooks.json` por merge
  somente apos o contrato e roda a suite relevante.

## Self-review against code-quality gates

- **G1 read-before-claim**: o diagnostico citado vem de leituras locais de
  `src/config.js`, `src/detect.js`, `src/runtime-layers/auto-update.js`,
  `skills/shared/project-assets/project-setup.md`,
  `skills/shared/project-assets/hooks/README.md` e `package.json`, feitas antes
  de materializar este plano.
- **G2 soft-language**: o texto de estado evita `should`, `probably`, `may`,
  `typically` e equivalentes em campos executaveis.
- **G6 reference-or-strike**: claims tecnicos viram tarefas com paths e verifiers;
  pontos ainda nao provados estao no escopo da F0.
- **G10 gate-must-be-able-to-fail**: cada exit gate aponta para arquivo ou comando
  que falha quando o contrato, doc, teste ou reparo local nao existe.
