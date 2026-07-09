# Backlog F1-F3 sincronizado com o contrato

## Entrada obrigatoria

Antes de qualquer item abaixo, ler estes contratos:

- `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/host-hook-matrix.md`
- `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/contracts/minimalist-installer-boundary.md`

Nenhuma mudanca futura pode tratar "host suporta skills" como equivalente a
"host suporta hooks". Cada tarefa que editar setup, docs, tests ou reparo local
precisa preservar os dois eixos da matriz.

## F1 - Setup e documentacao

| Item | Fase | Arquivos futuros | Regra do contrato | Verifier da fase |
| --- | --- | --- | --- | --- |
| Separar matriz de skills da matriz de hooks no setup. | F1 | `skills/shared/project-assets/project-setup.md`, `tests/project.test.js` | Claude Code e Codex podem ter setup de hooks; Cursor, Gemini, OpenCode e GitHub Copilot recebem no-op de hooks mesmo quando recebem skills. | `node --test tests/project.test.js` |
| Corrigir README de hooks fonte e instalado. | F1 | `skills/shared/project-assets/hooks/README.md`, `.atomic-skills/status/hooks/README.md`, `tests/project.test.js` | O README deve listar arquivos de config aprovados pela matriz e nao prometer hooks para hosts sem contrato. | `node --test tests/project.test.js tests/hooks/session-start.test.sh` |
| Documentar a fronteira do pacote. | F1 | `skills/shared/project-assets/project-setup.md`, `skills/shared/project-assets/hooks/README.md` | `@henryavila/minimalist-installer` continua driver generico; `atomic-skills` define providers, runtime layers, deltas de hook, docs e testes. | `node --test tests/project.test.js` |

## F2 - Testes de regressao

| Item | Fase | Arquivos futuros | Regra do contrato | Verifier da fase |
| --- | --- | --- | --- | --- |
| Cobrir matriz de hosts. | F2 | `tests/project.test.js`, `tests/install-uninstall-roundtrip.test.js`, `tests/minimalist-installer-link.test.js` | Cada host publico tem assert para skill path; hosts sem hook contract tem assert de no-op para hooks. | `node --test tests/project.test.js tests/install-uninstall-roundtrip.test.js tests/minimalist-installer-link.test.js` |
| Cobrir preservacao de hooks existentes. | F2 | `tests/install-uninstall-roundtrip.test.js`, possivelmente `src/runtime-layers/auto-update.js` e `src/installer.js` se o teste exigir runtime fix | Hook de terceiro permanece apos install/update/uninstall; somente o delta Atomic Skills e removido. | `node --test tests/install-uninstall-roundtrip.test.js` |
| Cobrir hooks do project. | F2 | `tests/hooks/session-start.test.sh`, `tests/hooks/stop.test.sh`, `tests/hooks/pre-write.test.sh` | SessionStart, Stop e PreToolUse mantem fallback de diretorio e nao dependem de host sem contrato. | `bash tests/hooks/session-start.test.sh && bash tests/hooks/stop.test.sh && bash tests/hooks/pre-write.test.sh` |

## F3 - Reparo local e validacao final

| Item | Fase | Arquivos futuros | Regra do contrato | Verifier da fase |
| --- | --- | --- | --- | --- |
| Reparar `.codex/hooks.json` local por merge. | F3 | `.codex/hooks.json` | Codex esta aprovado para hooks do `project`; o reparo preserva hooks locais existentes e adiciona apenas entradas Atomic Skills aprovadas. | `node --test tests/project.test.js tests/install-uninstall-roundtrip.test.js` |
| Rodar validacao final e review. | F3 | `plan.md`, `phases/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md`, suites de tests relevantes | Fechamento so ocorre depois de `validate-state`, suites de hooks/install e review de fase. | `node scripts/validate-state.js .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks.md && bash tests/hooks/session-start.test.sh` |

## Regras anti-mistura

- Qualquer linha de doc que cite hosts deve separar "skill install path" de
  "hook config file".
- Qualquer teste que selecione IDEs deve afirmar se espera hook setup ou no-op.
- Qualquer runtime change precisa dizer se altera provider, runtime layer,
  effect local ou pacote `@henryavila/minimalist-installer`.
- Qualquer reparo local de hook precisa ser merge-only e citar
  `host-hook-matrix.md`.

## Fora da F0

Este arquivo nao implementa F1, F2 ou F3. Ele apenas registra o backlog aceito
para execucao depois que a F0 fechar.
