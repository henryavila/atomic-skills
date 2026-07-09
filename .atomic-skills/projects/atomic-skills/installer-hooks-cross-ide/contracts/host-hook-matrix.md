# Matriz host x contrato de hooks

## Escopo

Este contrato separa dois eixos que o installer vinha misturando:

- **Skill install compatibility:** o host recebe arquivos de skill no path
  declarado por `src/config.js` e e detectado por `src/detect.js`.
- **Hook setup compatibility:** o host tem arquivo de configuracao e eventos de
  hook reconhecidos por este repositorio, com merge preservando entradas de
  terceiros.

Fontes lidas para esta matriz: `src/config.js`, `src/detect.js`,
`src/providers/skills-file-set.js`, `src/installer.js`,
`src/runtime-layers/auto-update.js`,
`skills/shared/project-assets/project-setup.md`,
`skills/shared/project-assets/hooks/README.md` e
`tests/install-uninstall-roundtrip.test.js`.

## Matriz

| Host | Deteccao | Skill install path | Skill format | Hook setup compatibility | Hook config file | Acao segura |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `.claude` | `.claude/commands/atomic-skills/<skill>.md` | `command` | Sim. O setup de `project` registra `SessionStart`, `Stop` e `PreToolUse`; o runtime de auto-update registra `SessionStart` para `version-check.sh`. | Project hooks: `.claude/settings.local.json`; auto-update runtime: `.claude/settings.json`. | Merge-only. Preservar hooks de terceiros, adicionar apenas entradas Atomic Skills e remover apenas o delta no uninstall. |
| Codex | `.agents` | `.agents/skills/atomic-skills/<skill>/SKILL.md` | `markdown` | Sim para os hooks do `project` documentados neste repositorio. Nao ha runtime de auto-update para Codex em `src/runtime-layers/auto-update.js`. | `.codex/hooks.json` para `SessionStart`, `Stop` e `PreToolUse` do `project`. | Merge-only. Preservar entradas existentes, incluindo hooks locais de terceiros; reparar `.codex/hooks.json` apenas na F3. |
| Cursor | `.cursor` | `.cursor/skills/atomic-skills/<skill>/SKILL.md` | `markdown` | Nao ha contrato de hook conhecido neste repositorio. | Nenhum arquivo de hook aprovado nesta matriz. | Instalar skills; setup de hooks e no-op documentado. |
| Gemini CLI | `.gemini` | Normal: `.gemini/skills/atomic-skills/<skill>/SKILL.md`; quando Gemini e Codex sao selecionados juntos, `normalizeIDESelection()` emite `gemini-commands` em `.gemini/commands/atomic-skills-<skill>.toml`. | `markdown` ou `toml` no modo `gemini-commands` | Nao ha contrato de hook conhecido neste repositorio. | Nenhum arquivo de hook aprovado nesta matriz. | Instalar skills/commands; setup de hooks e no-op documentado. |
| OpenCode | `.opencode` | `.opencode/skills/atomic-skills/<skill>/SKILL.md` | `markdown` | Nao ha contrato de hook conhecido neste repositorio. | Nenhum arquivo de hook aprovado nesta matriz. | Instalar skills; setup de hooks e no-op documentado. |
| GitHub Copilot | `.github` | `.github/skills/atomic-skills/<skill>/SKILL.md` | `markdown` | Nao ha contrato de hook conhecido neste repositorio. | Nenhum arquivo de hook aprovado nesta matriz. | Instalar skills; setup de hooks e no-op documentado. |

## Contrato operacional

1. Um host listado em `PUBLIC_IDE_IDS` pode ser compatibilidade de skills sem ser
   compatibilidade de hooks.
2. O setup de hooks so pode mencionar um host quando esta matriz declarar um
   arquivo de configuracao e eventos suportados.
3. Hosts sem contrato de hook conhecido recebem no-op explicito: nenhum arquivo
   de hook e criado, sobrescrito ou reparado.
4. Configuracao de hook e sempre merge-only. A presenca de um arquivo de config
   existente aumenta a obrigacao de preservar entradas de terceiros; ela nao
   autoriza snapshot do arquivo inteiro.
5. O runtime de auto-update atual e Claude Code-only: `src/runtime-layers/auto-update.js`
   planeja `.atomic-skills/hooks/version-check.sh` e merge em
   `.claude/settings.json`. Codex so entra no contrato dos hooks de `project`.

## Implicacoes para as proximas fases

- F1 deve atualizar docs/setup para mostrar a matriz em dois eixos:
  instalacao de skills e setup de hooks.
- F2 deve testar que hosts sem contrato de hook permanecem no-op para hooks,
  mesmo quando recebem skills.
- F3 deve reparar `.codex/hooks.json` por merge, preservando hooks locais
  existentes e adicionando apenas entradas aprovadas nesta matriz.
