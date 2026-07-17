# Corrigir compatibilidade cross-IDE dos hooks do installer

O problema apareceu no Codex, mas a causa e cross-IDE: o setup mistura instalacao
de skills com instalacao de hooks. O plano separa esses dois contratos e so
implementa a correcao depois da matriz de hosts e da fronteira com
`@henryavila/minimalist-installer`.

## Principles

- **P1 Separar instalacao de skills de contrato de hooks** - Um host pode receber
  skills sem ter suporte documentado para hooks.
- **P2 Hooks sao opt-in e merge-only** - Configuracao existente de terceiros
  sobrevive install, update, uninstall e reparo local.
- **P3 O pacote minimalist-installer nao recebe semantica do Atomic Skills** - O
  pacote fornece efeitos e driver genericos; Atomic Skills define providers,
  runtime layers, matriz de hosts e docs.
- **P4 Hosts sem contrato conhecido recebem no-op documentado** - Ausencia de hook
  contract vira comportamento explicito.

## Glossary

| Term | Definition |
| --- | --- |
| Skill install compatibility | Capacidade de instalar arquivos de skill no path declarado para o host. |
| Hook setup compatibility | Capacidade de registrar eventos de hook em arquivo de config reconhecido pelo host sem apagar configuracao existente. |
| minimalist-installer boundary | Fronteira entre o pacote generico @henryavila/minimalist-installer e o consumidor atomic-skills. |

## F0 - Contrato cross-IDE de hooks

Goal: Mapear hosts suportados, paths de skills, contratos de hooks, arquivos de configuracao e comportamento seguro para hosts sem hook contract antes de qualquer correcao de installer.

### T-001 Inventariar hosts e contratos reais

Ler configuracao, deteccao, docs e testes existentes para escrever a matriz host x skills x hooks sem alterar installer.

- Files: src/config.js, src/detect.js, src/installer.js, src/runtime-layers/auto-update.js, src/providers/skills-provider.js, package.json, skills/shared/project-assets/project-setup.md, skills/shared/project-assets/hooks/README.md, tests/project.test.js, tests/install-uninstall-roundtrip.test.js
- scopeBoundary: nao editar installer, runtime layer, hooks ou .codex/hooks.json nesta task
- acceptance: a matriz lista Claude Code, Codex, Cursor, Gemini, OpenCode e GitHub Copilot com path de skills, suporte de hook, arquivo de config e acao segura
- verifier: { kind: shell, command: "test -s .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/host-hook-matrix.md", expectExitCode: 0 }

### T-002 Registrar fronteira com minimalist-installer

Mapear o uso atual de @henryavila/minimalist-installer e separar motor generico de efeitos da semantica de IDEs e project hooks.

- Files: package.json, package-lock.json, src/installer.js, src/install.js, src/runtime-layers/auto-update.js, tests/minimalist-installer-link.test.js, tests/install-uninstall-roundtrip.test.js
- scopeBoundary: nao modificar a dependencia @henryavila/minimalist-installer nem mover logica de host para dentro do pacote
- acceptance: o artefato cita @henryavila/minimalist-installer e descreve provider, runtime layer, json merge e ownership de docs/tests
- verifier: { kind: shell, command: "grep -q '@henryavila/minimalist-installer' .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/minimalist-installer-boundary.md", expectExitCode: 0 }

### T-003 Sincronizar backlog F1-F3 com o contrato

Revisar as fases F1-F3 contra os artefatos de contrato e registrar quais arquivos serao tocados depois da F0.

- Files: .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md, .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md, .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/implementation-backlog.md
- scopeBoundary: nao implementar mudancas em setup, runtime layer, tests ou .codex/hooks.json
- acceptance: o backlog aponta cada ajuste futuro para F1, F2 ou F3 e nenhuma task futura mistura suporte de skills com suporte de hooks sem citar a matriz
- verifier: { kind: shell, command: "test -s .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/implementation-backlog.md", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: G-1
      description: "A matriz separa suporte de skills e suporte de hooks para Claude Code, Codex, Cursor, Gemini, OpenCode e GitHub Copilot."
      verifier: { kind: shell, command: "test -s .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/host-hook-matrix.md", expectExitCode: 0 }
    - id: G-2
      description: "A fronteira atomic-skills versus @henryavila/minimalist-installer esta registrada com responsabilidade por arquivo e runtime layer."
      verifier: { kind: shell, command: "grep -q '@henryavila/minimalist-installer' .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/minimalist-installer-boundary.md", expectExitCode: 0 }
    - id: G-3
      description: "O backlog F1-F3 esta sincronizado com a matriz e nao contem task de implementacao antes do contrato."
      verifier: { kind: shell, command: "test -s .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/implementation-backlog.md", expectExitCode: 0 }
```

## F1 - Setup e documentacao

Goal: Corrigir project-setup.md, hooks/README.md e textos relacionados para separar instalacao de skills de setup de hooks, com no-op explicito para hosts sem contrato.

### T-001 Corrigir project-setup.md

Atualizar o setup para declarar matriz de skills e matriz de hooks como passos separados.

- Files: skills/shared/project-assets/project-setup.md, tests/project.test.js
- scopeBoundary: nao alterar scripts de hook ou runtime layer nesta task
- acceptance: project-setup.md lista paths de skills por host e registra hooks apenas para hosts com contrato
- verifier: { kind: shell, command: "node --test tests/project.test.js", expectExitCode: 0 }

### T-002 Corrigir README de hooks fonte e instalado

Alinhar README fonte e README instalado para explicar suporte real, wrapper de projeto e no-op por host.

- Files: skills/shared/project-assets/hooks/README.md, .atomic-skills/status/hooks/README.md, tests/project.test.js
- scopeBoundary: nao editar session-start.sh, stop.sh ou pre-write.sh nesta task
- acceptance: os READMEs nao prometem .codex/hooks.json nem .claude/settings.local.json fora da matriz aprovada
- verifier: { kind: shell, command: "node --test tests/project.test.js", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: G-1
      description: "project.test.js valida que setup e README nao prometem hooks para hosts sem contrato."
      verifier: { kind: shell, command: "node --test tests/project.test.js", expectExitCode: 0 }
    - id: G-2
      description: "A documentacao instalada em .atomic-skills/status/hooks/README.md reflete o mesmo contrato da fonte em skills/shared/project-assets/hooks/README.md."
      verifier: { kind: shell, command: "node --test tests/project.test.js && bash tests/hooks/session-start.test.sh", expectExitCode: 0 }
```

## F2 - Testes de regressao

Goal: Adicionar cobertura para Claude Code, Codex, Cursor, Gemini, OpenCode e GitHub Copilot, incluindo preservacao de hooks existentes e no-op seguro em hosts sem hook contract.

### T-001 Cobrir matriz de hosts no setup

Adicionar fixtures ou asserts que exercitam a matriz cross-IDE de skill path e hook behavior.

- Files: tests/project.test.js, tests/install.test.js, tests/minimalist-installer-link.test.js, src/config.js, src/detect.js
- scopeBoundary: nao mudar comportamento runtime sem teste falhando que descreva a matriz
- acceptance: cada host declarado tem caso de teste para path de skills e resultado de hooks
- verifier: { kind: shell, command: "node --test tests/project.test.js tests/install.test.js tests/minimalist-installer-link.test.js", expectExitCode: 0 }

### T-002 Cobrir preservacao de hooks existentes

Garantir que entradas de terceiros sobrevivem quando o host suporta merge de hooks.

- Files: tests/install-uninstall-roundtrip.test.js, src/runtime-layers/auto-update.js, src/installer.js
- scopeBoundary: nao alterar docs nesta task
- acceptance: teste prova que hook de terceiro permanece apos install/update/uninstall e que somente a entrada Atomic Skills e removida
- verifier: { kind: shell, command: "node --test tests/install-uninstall-roundtrip.test.js", expectExitCode: 0 }

### T-003 Cobrir hooks do project

Validar que os hooks do project continuam executando com fallback de diretorio e sem acoplamento a host sem contrato.

- Files: tests/hooks/session-start.test.sh, tests/hooks/stop.test.sh, tests/hooks/pre-write.test.sh, skills/shared/project-assets/hooks/session-start.sh, skills/shared/project-assets/hooks/stop.sh, skills/shared/project-assets/hooks/pre-write.sh
- scopeBoundary: nao registrar hooks locais nesta task
- acceptance: suite de hooks passa e os testes cobrem ausencia de config como no-op
- verifier: { kind: shell, command: "bash tests/hooks/session-start.test.sh && bash tests/hooks/stop.test.sh && bash tests/hooks/pre-write.test.sh", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: G-1
      description: "A suite de project/install cobre a matriz cross-IDE de skills versus hooks."
      verifier: { kind: shell, command: "node --test tests/project.test.js tests/install-uninstall-roundtrip.test.js tests/minimalist-installer-link.test.js", expectExitCode: 0 }
    - id: G-2
      description: "Os testes de hooks cobrem SessionStart e preservacao de hooks existentes no setup suportado."
      verifier: { kind: shell, command: "bash tests/hooks/session-start.test.sh", expectExitCode: 0 }
```

## F3 - Reparo local e validacao final

Goal: Aplicar o reparo local em .codex/hooks.json por merge quando o contrato disser que Codex tem hook contract neste projeto, rodar a suite relevante e fechar a fase com review.

### T-001 Reparar .codex/hooks.json por merge

Adicionar somente entradas aprovadas pelo contrato e preservar o hook Nexus existente.

- Files: .codex/hooks.json, .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/host-hook-matrix.md
- scopeBoundary: nao sobrescrever .codex/hooks.json inteiro e nao remover hooks de terceiros
- acceptance: .codex/hooks.json contem o hook Nexus pre-existente e as entradas Atomic Skills aprovadas pela matriz
- verifier: { kind: shell, command: "node --test tests/project.test.js tests/install-uninstall-roundtrip.test.js", expectExitCode: 0 }

### T-002 Rodar validacao final e review

Executar validate-state, suite relevante e review da fase antes de fechar.

- Files: .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md, .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md, tests/project.test.js, tests/install-uninstall-roundtrip.test.js, tests/hooks/session-start.test.sh
- scopeBoundary: nao fechar fase com verifier falhando
- acceptance: validate-state, project tests, round-trip e session-start passam na arvore atual
- verifier: { kind: shell, command: "node scripts/validate-state.js .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md && node --test tests/project.test.js tests/install-uninstall-roundtrip.test.js && bash tests/hooks/session-start.test.sh", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: G-1
      description: ".codex/hooks.json local preserva o hook Nexus e adiciona apenas entradas aprovadas pelo contrato."
      verifier: { kind: shell, command: "node --test tests/project.test.js tests/install-uninstall-roundtrip.test.js", expectExitCode: 0 }
    - id: G-2
      description: "Validacao final de estado e hooks passa apos refresh-state."
      verifier: { kind: shell, command: "node scripts/validate-state.js .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md && bash tests/hooks/session-start.test.sh", expectExitCode: 0 }
```
