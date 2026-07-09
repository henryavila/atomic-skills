# Compatibilidade cross-IDE dos hooks de setup

## Context

O Atomic Skills declara suporte a varios hosts para instalacao de skills:
Claude Code, Cursor, Gemini, Codex, OpenCode e GitHub Copilot. O diagnostico
mostrou que a camada de setup de hooks nao segue a mesma matriz: docs e runtime
misturam suporte a skills com suporte a hook events.

O pacote de instalacao ativo no repo e `@henryavila/minimalist-installer`. Ele
entra como motor generico de efeitos e driver; a semantica de paths de IDE,
runtime layers e hook docs continua no consumidor `atomic-skills`.

## Decisions

- **D1 - Separar os contratos.** Skill install compatibility e hook setup
  compatibility sao eixos diferentes da matriz.
- **D2 - F0 primeiro.** A correcao do installer nao comeca antes de existir uma
  matriz host x contrato e uma fronteira explicita com
  `@henryavila/minimalist-installer`.
- **D3 - Hooks sao merge-only.** Qualquer host com hook contract preserva hooks de
  terceiros; hosts sem contrato recebem no-op documentado.
- **D4 - Codex nao vira caso especial escondido.** Codex aparece como uma linha da
  matriz junto dos outros hosts, com path de skills `.agents/skills/atomic-skills/`
  e hook config local tratado separadamente.
- **D5 - Reparo local vem por ultimo.** `.codex/hooks.json` so e alterado na F3,
  depois que o contrato e os testes decidirem a forma correta de merge.

## Chosen approach

1. Materializar a F0 com tres tasks de contrato: matriz de hosts, fronteira do
   pacote e backlog sincronizado.
2. Manter F1-F3 como descritores pendentes com sidecars `*.source.json`; o fluxo
   normal `materialize` coleta `businessIntent` quando cada fase comecar.
3. Fazer F1 corrigir `project-setup.md`, `hooks/README.md` e docs instaladas.
4. Fazer F2 adicionar regressao automatica para a matriz de hosts e preservacao
   de hooks existentes.
5. Fazer F3 aplicar o reparo local em `.codex/hooks.json` por merge e rodar a
   validacao final.

## Risks

- Misturar docs e runtime antes da matriz cria outra correcao especifica de host.
- Colocar semantica Atomic Skills dentro de `@henryavila/minimalist-installer`
  acopla o pacote a um consumidor.
- Reparar `.codex/hooks.json` antes da F2 cria configuracao local sem teste de
  regressao.
