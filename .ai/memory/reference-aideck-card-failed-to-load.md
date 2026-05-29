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

## Classes de drift conhecidas (caso 2026-05-29, projeto `arch`)
Não é só `references.kind`. Mesma raiz (dado escrito fora dos comandos do skill,
validado só no read-time `.strict()` all-or-nothing), campos diferentes:
1. **`exitGates[].status: done`** — vocabulário cruzado: `done` é status de **Task**;
   gate é `pending|met|deferred`. `done`→`met`. (Origem: fechar initiative standalone
   não tinha comando que resolvesse gates → `phase-done` aborta sem `parentPlan`.)
2. **Campo obrigatório ausente** — ex. getin sem `stack`. Runtime initiativeSchema
   é `.strict()` e exige `schemaVersion, slug, title, goal, status, branch, started,
   lastUpdated, nextAction, exitGates, stack, tasks, parked, emerged`. Backfill:
   arrays→`[]`, `branch`/`nextAction`→`null`.
3. **`references` sem `kind` / com `title`** (o caso original).

`totalErrors: N` no erro = **nº de entidades que falharam** (não erros por entidade);
surfaça só o 1º erro da 1ª entidade.

## Runtime vs validate-state (CRÍTICO)
O que bloqueia o card é o **runtime do aideck serve**, NÃO o `scripts/validate-state.js`
do repo. validate-state usa Ajv `additionalProperties:false` em tudo + cross-validation;
o runtime é mais tolerante: `taskSchema` do runtime **não** é `.strict()` (tolera
`evidence` numa task), e não faz cross-validation (plan-criterion↔initiative-gate).
→ Validar contra o runtime real: `POST /api/projects/register {rootDir}` + `GET
/api/projects/<id>/state/project-status`; HTTP 200 = card carrega. NÃO confie só em
`validate-state` (falha-positiva relativa ao runtime).

## Auto-fix (impl. 2026-05-29)
`src/normalize.js` (`normalizeEntity` puro/immutable + `normalizeStateDir` que reescreve
arquivos, idempotente) corrige as 3 classes. kind-gated: backfill SÓ em initiative
(plano `.strict()` rejeitaria `stack`/`tasks`). Wired em: `migrate.js` (retorno),
project-plan Stage 6 (pré-validate), project-status default view (passo 2, on STATE_ERROR).
Skills resolvem o script (`$PWD/src`, `npm root -g`, `~/.atomic-skills/src`) com **fallback
inline** (IA aplica as regras com file tools) — necessário porque o script NÃO está em
repo-alvo (global pkg defasado, install não copia `src/`). Ver [[feedback-skill-body-review-rules]].
