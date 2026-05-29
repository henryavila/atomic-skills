---
name: reference-aideck-card-failed-to-load
description: Diagnóstico do card "⊘ <project> — failed to load" no dashboard aiDeck. É mismatch de DADO (schema), não bundle desatualizado.
metadata:
  type: reference
---

# Dashboard aiDeck: "⊘ <project> — failed to load"

## Sintoma
No HomePage multi-projeto, um card renderiza `⊘ <projectId> — failed to load`
(`src/dashboard/pages/HomePage.tsx` → `ProjectCardWrapper`: `error || !data` →
`CardSkeleton errored`). A mensagem real do erro fica escondida (só o caminho de
erro top-level `stateError` renderiza o texto do HTTP).

## Causa raiz (caso 2026-05-29)
`GET /api/projects/<id>/state/project-status` retorna **HTTP 400** de validação,
não erro de rede. Um único plano/initiative com schema inválido **derruba o estado
inteiro** do projeto (validação all-or-nothing, para no 1º erro). Erro observado:
`references.0.kind: Required` no plano do projeto aiDeck.

O `artifactRefSchema` (snapshot estável vendorizado) é `.strict()` e exige
`kind: file|url|repo-path|section` + `path`; `label` é opcional e **`title` NÃO é
campo válido**. O arquivo tinha `references: [{path, title}]` sem `kind` — formato
escrito pela ferramenta do **aiDeck v2** (sibling `../aideck`, em reescrita), que
tem uma normalize layer tolerante. O snapshot estável **não** tem essa camada.

## Por que rebuild/reinstall NÃO corrige
O bundle instalado (`~/.atomic-skills/bin/aideck.mjs`), o commitado
(`dist/aideck.mjs`) e um build fresh de `vendor/aideck-runtime/` são **byte-idênticos**
(mesmo SHA-256). O `vendor/aideck-runtime/` é cópia da **main estável** e
intencionalmente **não** inclui `normalize.ts`/`discover-run.ts` do v2. Reconstruir
produz o mesmo bundle. O problema é o dado, não o runtime. Ver [[feedback-resolveaideckbin-vendored-first]].

Pegadinha de comparação de bundle: rode esbuild com cwd = `dirname(entry)` (=
`vendor/aideck-runtime/src`) senão os comentários de path do esbuild (`// ../../` vs
`// ../../../`) divergem e parecem (falsamente) mudanças de código.

## Quando NÃO é problema
Projetos geridos pelo fluxo padrão atomic-skills funcionam: `src/bootstrap.js` e
`src/migrate.js` emitem refs com `kind`+`path`+`label` corretos. **Mas** `migrate.js`
repassa `references` pré-existentes sem corrigir — dado já no formato v2 continua
quebrando. Ver [[project-aideck-alreadytracked-contract]] (outro caso de drift
schema dado-vs-runtime).

## Fix
Nível de dado, sem rebuild: nas `references` do `.atomic-skills/`, adicionar `kind:`
e renomear `title:` → `label:`. O watcher do aiDeck propaga via SSE e o card recarrega.
