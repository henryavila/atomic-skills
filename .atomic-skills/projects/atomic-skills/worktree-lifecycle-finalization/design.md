# Design — worktree-lifecycle-finalization

Fechar o ciclo de vida da worktree-do-plano. Pesquisa-base + approach inicial:
`docs/design/project-orchestrator/10-worktree-lifecycle-finalization.md`. Este design **reenquadra**
aquele approach após um painel adversarial (pragmatista / robustez / contrarian) e uma rodada de critic.

## Context

O nascimento da branch-do-plano e a materialização da worktree são DOIS pontos distintos hoje:

- **Stamp da branch** acontece na CRIAÇÃO do plano — `project new plan` Stage 6 "single-focus pre-flight"
  oferece worktree/pause/drift e grava `branch:` no plano. `verified_by: skills/shared/project-assets/project-create-plan.md`
  (Stage 6, R-FOCUS-01: "Own worktree (parallel) ... pass `branch: 'plan/<slug>'`").
- **Materialização da worktree** acontece no `implement` Step 0.5, **condicionalmente e operator-prompted**:
  só quando o `branch:` do plano difere da árvore atual E a worktree está ausente (caso 4b "Materialize if
  absent, operator-prompted"); um plano com `branch: null` roda degraded na árvore atual e nunca forka.
  `verified_by: skills/core/implement.md` (Step 0.5, casos 2/3/4).

O que falta é o FIM: nada fecha o ciclo quando o plano arquiva. Um plano arquivado deixa branch viva,
não-mergeada, e worktree registrada. `verified_by: skills/shared/worktree-isolation.md:38` ("a
`git worktree remove` of a tree with un-merged commits discards them silently"). Observado nesta sessão:
`plan/multiplan-focus` arquivado, 36 commits à frente da main, **19 de outros fronts** (história interleaved).
O estado `.atomic-skills/` é compartilhado/commitado entre branches. `verified_by: CLAUDE.md` ("the
`.atomic-skills/` project-tracking tree is now meant to be versioned in git, not ignored").

O painel derrubou a premissa original ("construir um finalize simétrico"): uma `plan/<slug>` é **bookkeeping
de foco com commits interleaved**, NÃO uma feature branch cujo telos é mergear na trunk — importar o lifecycle
"ship to trunk" wholesale é erro de categoria.

## Decisions

1. **Branch só nasce sob concorrência real — a decisão vive no Stage 6, NÃO no Step 0.5 nem no `emit-focus`.**
   O `multipleActivePlans` do `emit-focus` é **pós-colisão e read-only** (`ambiguous = claimers.length > 1`,
   `verified_by: scripts/emit-focus.js` pickFocus) — ele DETECTA a colisão depois que dois planos já
   dividem a árvore; não forka nada e não serve de gatilho pré-emptivo. O lever correto é o **Stage 6
   single-focus pre-flight**, que já é o ponto de decisão de branch (`verified_by:
   skills/shared/project-assets/project-create-plan.md` Stage 6). A mudança: tornar **"não forkar / `branch: null`
   na árvore atual" o DEFAULT** para um plano solo (nenhum outro ativo); forkar `plan/<slug>` só quando a
   criação já encontra ≥1 plano ativo (concorrência presente). Plano solo sem branch → nada para finalizar.
   O artefato observado nesta sessão (`plan/multiplan-focus` branqueado e arquivado com 36 commits) é
   exatamente o que esse default elimina daqui pra frente — o backstop (Decisão 5) só limpa os pré-existentes.

2. **Caso retroativo (o 1º plano vira concorrente quando o 2º chega) é DESENHADO, não adiado.** Quando um 2º
   plano fica ativo e o 1º ainda está em `branch: null` na árvore compartilhada, o Stage 6 do 2º plano
   carimba uma branch distinta no 1º — mecanismo que já existe: `stampBranch`/`bindPlanBranch`
   (`verified_by: scripts/bind-plan-branch.js` — "stamp `branch:` ... or inserts one ... re-emits focus")
   grava `branch: plan/<slug-do-1º>` no `plan.md` do 1º, e `git worktree add -b plan/<slug-do-1º> .worktrees/<…>`
   materializa a casa dele sobre os commits já feitos (a branch nasce do HEAD atual, herdando o trabalho).
   **Distinção precisa:** o STAMP do `branch:` nos pré-existentes já existe no Stage 6 (`project-create-plan.md`
   Stage 6, opção "own worktree": "stamp a **distinct** `branch:` on any pre-existing active plan that still
   has `branch: null`") — `verified_by` cobre só o stamp. O `git worktree add` retroativo PARA o plano
   pré-existente é o acoplamento NOVO que este design adiciona (o Stage 6 hoje só roda `worktree add` para o
   plano entrante, não para o pré-existente).

3. **Arquivamento lógico e teardown da worktree são SEPARADOS e ambos operator-prompted.** O `archive`
   (project) flipa o plano para `status: archived` com **zero efeito git**, como hoje — `verified_by:
   skills/shared/project-assets/project-transitions.md` (`archive`: "a whole plan is archived in place with
   `status: archived`"). O teardown da worktree é uma **oferta NOVA, adjacente** ao `archive` (não parte do
   flip de status): após arquivar, o fluxo OFERECE finalizar a worktree. Integração do código nunca é
   disparada pelo evento de arquivar — arquivar-mas-não-mergear é o estado normal aqui.

4. **Invariante de não-perda-de-trabalho no teardown (machine-enforced), com base-ref decidida.** A worktree/
   branch só é removível quando um check **prova** integração: `git merge-base --is-ancestor plan/<slug> <base>`
   — esse check e a ladder de base-ref abaixo são mecanismo NOVO a ser construído (não existem hoje no código;
   o `verified_by` em `:42-43`/`:54` cobre só o PRINCÍPIO merge-before-remove, não a invocação). **Base-ref:**
   `origin/main` quando existe e está fetchado; senão `main` local. **Em indeterminação** (origin ausente/stale,
   base irresolúvel) o check **trata como não-mergeado e BLOQUEIA** — a falha segura é over-bloquear, nunca
   over-deletar. **Cadeia de segurança (explícita):** remover só a worktree é seguro porque os commits ficam
   ancorados na branch nomeada `plan/<slug>` que a Decisão 2 garante existir — o caso `branch: null` não tem
   worktree nem branch para remover, e o caso branqueado nunca deixa commit órfão. `git branch -d` (minúsculo)
   é a 2ª guarda nativa (recusa não-mergeada). Nunca `rm -rf`; nunca `-D`/`--force` por default.
   `verified_by: skills/shared/worktree-isolation.md:42-43` (merge-before-remove) e `:54`.

5. **Backstop é RELATÓRIO read-only — novo check no `project verify`.** Um check novo (slot #9, após os 8
   atuais — `verified_by: skills/shared/project-assets/project-verify.md`, lista numerada de checks read-only)
   deriva live de `git worktree list --porcelain` + `git merge-base --is-ancestor` + status do plano, e
   SINALIZA em **WARN**: "plano `archived` com branch à frente da base" ou "worktree viva de plano arquivado".
   É da mesma FAMÍLIA do check #3 (branch ↔ initiative ativa) mas de ESCOPO MAIOR — varre todas as worktrees e
   planos arquivados, não só a árvore atual. Sem flag nova no `focus.json`, sem hook que deleta.

6. **Integração, quando ocorre, é SERIAL e operator-prompted.** Não se mergeia plan-branch→main por plano
   (arrastaria fronts inacabados). Reusa R-XAGENT-03 serial merge-back, um por vez, re-verificando na primária.
   `verified_by: skills/shared/worktree-isolation.md:47-57` e `skills/core/implement.md:97`.

## Chosen approach

Três abordagens foram pesadas no painel:

- **(A) Finalize simétrico (approach original do doc 10):** gatilho no arquivamento + teardown ciente de merge
  + backstop com ladder. **Rejeitada como base** — aceita o frame de feature-branch que o contrarian derrubou.
- **(B) Máximo rigor (voz robustez):** híbrido + ladder WARN→**FAIL** no verify + comando dedicado
  `project finalize` com bloqueios estilo Worktrunk. **Não escolhida** — superfície maior que o problema exige
  hoje; o FAIL chora-lobo no estado-alvo (archived-mas-deliberadamente-não-mergeado é normal aqui).
- **(C) Híbrido reenquadrado — ESCOLHIDA.** Ataca a raiz no ponto certo (branch nasce sob concorrência no
  Stage 6, Decisões 1+2), separa os dois lifecycles (Decisão 3), adiciona o MENOR mecanismo que faz o sistema
  "lembrar" (relatório WARN, Decisão 5) e fixa o invariante de segurança onde o teardown ocorre (Decisão 4).

**Por que (C) ganhou:** pragmatista mostrou que "1 check WARN + teardown operator-prompted no `archive`" mata o
esquecimento sem comando/hook/schema novos; contrarian mostrou que a causa está na decisão de branch (movida
para o Stage 6, onde ela já vive) e que enforcer é over-build para um estado normal aqui; robustez fixou o
invariante inegociável (nunca remover trabalho não-provado-integrado), na Decisão 4.

## Blast radius

- **Decisões 1+2 mexem na decisão de branch (Stage 6) e tocam o Step 0.5 recém-entregue (T-006).** Mudar o
  default de fork (incondicional-na-criação → sob-concorrência) altera o contrato de criação de plano e o
  comportamento que o Step 0.5 consome. Contenção: fase isolada com verifier determinístico; preservar os
  paths no-op/degraded já testados do Step 0.5; não tocar `emit-focus` (11 testes verdes) — a Decisão 1 NÃO
  depende dele.
- **Decisão 6 toca o modelo de chegada-na-main.** Integração serial/operator-prompted é reversível (disciplina,
  não migração de dados), mas load-bearing. Contenção: nunca automatizar merge→main; default é "não mergear";
  o teardown só REMOVE quando o invariante (Decisão 4) prova integrado.
- **Nenhuma decisão deleta dados ou estado.** Backstop é read-only; teardown bloqueia perda. Reversão mais cara:
  re-permitir branch incondicional no Stage 6 — um patch de uma condição.

## Non-goals

- **NÃO** automatizar merge→main (auto-rebase/cron/hook que deleta) — é o v2 adiado em
  `worktree-isolation.md:49`. Tudo operator-prompted.
- **NÃO** construir integration-branch dedicada como subsistema (era R4 do doc 10) — integração fica na
  cadência do código.
- **NÃO** adicionar flag no `focus.json` nem campo de schema para orphan-state — derivado live.
- **NÃO** detecção patch-id de squash-merge na v1 (falha segura: over-bloqueia) — adiada até um squash-merge
  real produzir falso "esquecido".
- **NÃO** comando dedicado `project finalize` na v1 — o teardown vive adjacente ao `archive`.

## Open questions

- **Granularidade do teardown com fronts vivos:** quando o plano arquiva mas a base ainda não tem os commits
  (caso comum aqui), o teardown OFERECE remover só a worktree e deixar a branch (Decisão 4 bloqueia a deleção
  da branch não-mergeada). Confirmar na fase de SPEC que "remover worktree, manter branch" é um estado limpo
  para o backstop (#9 WARN) e não um falso-FAIL.
- **Severidade futura:** se o relatório WARN (#5) provar insuficiente na prática, promover a FAIL pela mesma
  ladder do single-focus — gatilho de evidência, não v1.

## Rejected alternatives

- **Finalize simétrico com merge plan-branch→main (approach A do doc 10).** Rejeitado: `plan/<slug>` é
  bookkeeping com commits interleaved; o §4 do doc 10 prova que para o caso real NÃO se deve mergear. "done =
  merged to trunk" é erro de categoria.
- **On-demand fork keyed no `multipleActivePlans` (1ª versão deste design).** Rejeitado pelo critic: o sinal é
  pós-colisão e read-only — não pré-empta a colisão nem forka. Substituído pela decisão-de-branch no Stage 6
  (Decisões 1+2).
- **Ladder WARN→FAIL + comando dedicado `project finalize` (voz robustez, opção B).** Não escolhida na v1 por
  superfície; **preservada** como promoção (Open questions). A voz de robustez sustenta o FAIL para o estado
  incoerente (worktree viva de plano arquivado) — registrado, não descartado.
- **ancestor + patch-id desde a v1 (voz robustez, D2).** Adiado: ancestor-only tem falha segura; patch-id
  entra quando um squash-merge real gerar falso-esquecido.

## Self-review against code-quality gates

- G1 read-before-claim: applied — claims sobre código existente citam arquivo (project-create-plan.md Stage 6,
  implement.md Step 0.5, emit-focus.js pickFocus, bind-plan-branch.js stampBranch, worktree-isolation.md
  :38/:42-43/:47-57/:54, project-transitions.md `archive`, project-verify.md checks), todos lidos/escritos nesta sessão.
- G2 soft-language: applied — bloco de Decisions varrido para should/probably/may/typically/usually; 0
  ocorrências nas Decisions e no Chosen approach (a palavra "pode" aparece só descrevendo modos de falha em
  Context/Open questions, não em afirmações de design).
- G6 reference-or-strike: applied — asserções sobre código carregam `verified_by:`; o que não é verificável
  está em Open questions como pergunta, não afirmação.
