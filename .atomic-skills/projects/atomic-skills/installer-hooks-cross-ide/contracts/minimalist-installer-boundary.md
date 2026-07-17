# Fronteira atomic-skills x @henryavila/minimalist-installer

## Escopo

Este contrato define onde termina o pacote generico
`@henryavila/minimalist-installer` e onde comeca a semantica especifica do
consumidor `atomic-skills`.

Fontes lidas para esta fronteira: `package.json`, `package-lock.json`,
`src/installer.js`, `src/install.js`, `src/uninstall.js`,
`src/providers/skills-provider.js`, `src/providers/skills-file-set.js`,
`src/runtime-layers/auto-update.js`,
`src/runtime-layers/effects/stage-runtime-artifacts.js`,
`tests/minimalist-installer-link.test.js` e
`tests/install-uninstall-roundtrip.test.js`.

## Responsabilidades por camada

| Camada | Owner | Responsabilidade | Fora da camada |
| --- | --- | --- | --- |
| Driver de install/uninstall | `@henryavila/minimalist-installer` | Executar providers/effects, gravar journal em `manifest.json`, encadear `beforeState` entre updates e reverter efeitos em ordem segura. | Decidir quais IDEs existem, quais hooks o Atomic Skills registra ou quais docs o projeto publica. |
| File-set effect | `@henryavila/minimalist-installer` | Aplicar `reconcileFileSet` com prova de ownership/hash e remover apenas arquivos de que o journal tem posse. | Conhecer paths `.claude`, `.agents`, `.cursor`, `.gemini`, `.opencode` ou `.github`. |
| JSON merge effect | `@henryavila/minimalist-installer` | Mesclar deltas JSON e reverter somente o delta registrado, preservando entradas de terceiros. | Definir eventos `SessionStart`, `Stop`, `PreToolUse` ou comandos de hook do Atomic Skills. |
| Installer composition | `atomic-skills` em `src/installer.js` | Chamar `defineInstaller`, fornecer `createSkillsProvider()`, `createAutoUpdateRuntimeProvider()` e registrar o effect customizado `stageRuntimeArtifacts`. | Alterar o contrato generico do pacote para carregar semantica de IDE. |
| Provider de skills | `atomic-skills` em `src/providers/skills-provider.js` e `src/providers/skills-file-set.js` | Transformar `IDE_CONFIG`, catalogo, modulos, linguagem e escopo em um desired file set por host. | Executar writes direto fora do driver ou inventar hooks. |
| Runtime layer de auto-update | `atomic-skills` em `src/runtime-layers/auto-update.js` | Emitir o script `.atomic-skills/hooks/version-check.sh` e o delta `jsonMerge` para `.claude/settings.json`. | Declarar suporte de auto-update para Codex, Cursor, Gemini, OpenCode ou GitHub Copilot sem contrato especifico. |
| Effect `stageRuntimeArtifacts` | `atomic-skills` em `src/runtime-layers/effects/stage-runtime-artifacts.js` | Copiar artefatos binarios/executaveis e preservar ownership pelo journal quando `reconcileFileSet` nao basta. | Guardar matriz de hosts ou rules de hook; ele continua effect generico local do consumidor. |
| Orquestracao de CLI | `atomic-skills` em `src/install.js` e `src/uninstall.js` | Resolver escopo user/project, detectar IDEs, normalizar selecao, migrar manifest legado, atualizar metadata e refcount global. | Colocar regras Atomic Skills dentro do pacote minimalist. |
| Docs e testes | `atomic-skills` | Publicar matriz cross-IDE, setup de hooks, round-trip, preservacao de hooks existentes e no-op por host. | Tratar uma garantia de teste local como comportamento nativo do pacote generico. |

## Contrato de ownership

1. `@henryavila/minimalist-installer` e o motor de efeitos. Ele sabe aplicar e
   reverter efeitos com journal, mas nao sabe o que e Claude Code, Codex,
   Cursor, Gemini, OpenCode ou GitHub Copilot.
2. `atomic-skills` e o consumidor que define `IDE_CONFIG`, paths de skills,
   assets compartilhados, runtime layers e docs de `project`.
3. O `jsonMerge` pertence ao pacote como primitiva generica. O delta que aponta
   para `.claude/settings.json`, `.codex/hooks.json` ou qualquer evento de hook
   pertence ao `atomic-skills`.
4. A preservacao de hooks de terceiros e uma obrigacao combinada: o pacote
   oferece reversao por delta; o consumidor so pode fornecer deltas pequenos,
   host-aware e aprovados pela matriz.
5. O pacote nao recebe fallback, path ou evento especifico de Atomic Skills para
   "corrigir" compatibilidade cross-IDE. Correcoes de host ficam no provider,
   runtime layer, docs e testes deste repositorio.

## Regras para F1-F3

- F1 altera prosa de setup/docs no consumidor, nao a dependencia.
- F2 adiciona regressao no consumidor para provar matriz de skills versus hooks
  e preservacao de entradas existentes.
- F3 pode reparar `.codex/hooks.json` local por merge, mas nao muda o contrato
  do pacote nem move semantica de host para `@henryavila/minimalist-installer`.

## Sinais de falha

- FAIL se um diff futuro alterar `package.json` ou `package-lock.json` para
  resolver este problema sem uma decisao explicita de dependencia.
- FAIL se uma mudanca no pacote minimalist citar hosts do Atomic Skills.
- FAIL se docs/testes tratarem `reconcileFileSet`, `jsonMerge` ou
  `stageRuntimeArtifacts` como substitutos da matriz de hosts.
- FAIL se um reparo de hook substituir um arquivo de config inteiro em vez de
  gravar um delta merge-only.
