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

6. **Integração é TOPOLOGY-AWARE e operator-prompted: serial só DENTRO de um componente que se toca,
   qualquer-ordem entre componentes disjuntos.** A regra "sempre serial" (R-XAGENT-03 incondicional) é coarse —
   força série mesmo entre worktrees de escopo comprovadamente disjunto, e nada cobre o caso "N worktrees, só
   algumas precisam de merge entre si" nem "N worktrees totalmente independentes, merge ignorando as outras sem
   risco de conflito". O lever novo é um **classificador de disjunção por footprint**: para cada plan-worktree
   viva, footprint = `git diff --name-only <base>...plan/<slug>`; há aresta entre duas worktrees sse os
   footprints se intersectam OU ambas tocam um **coupling file** (lockfiles, gerados, migrations — lista fixa).
   Os componentes conexos do grafo são as unidades de série; componentes distintos integram em qualquer ordem.
   **Mapa topologia → ação** (cobre a matriz dos 4 casos):
   - **0 worktrees (solo, `branch: null`):** finalize é no-op — nada para integrar.
   - **1 worktree:** merge-back único (guard `--is-ancestor`, depois teardown).
   - **N worktrees, componente conexo (interdependentes):** série R-XAGENT-03 intacta DENTRO do componente,
     re-verificando na primária; componentes não se esperam.
   - **N worktrees, componentes disjuntos (independentes):** qualquer ordem, um ignorando o outro.
   **Disjunção textual é sound, NÃO build-safe** (`verified_by: arxiv.org/pdf/1907.06274` Owhadi-Kareshk —
   footprint disjunto exclui conflito textual, não o semântico), então CADA merge ainda passa pelo gate de
   verify na primária; a disjunção autoriza paralelismo/ordem-livre, nunca pular o verify. Guard de idempotência
   `git merge-base --is-ancestor plan/<slug> <base>` antes de cada merge (skip se já contido) e de cada remoção
   (Decisão 4). Na falha de um merge serial dentro de um componente: drop-and-re-test-behind contra o tip novo
   (não assumir culpa do de trás). Octopus-merge e validação-contra-trunk-projetado/bissecção ficam FORA da v1
   (Open questions). Reusa o conceito de prova de disjunção par-a-par que já existe em
   `parallel-dispatch.md:76-77` (elevado de task para plan-worktree); não automatiza merge→main.
   `verified_by: skills/shared/worktree-isolation.md:47-57`, `skills/core/implement.md:97`,
   `skills/core/parallel-dispatch.md:76-77`.

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
  **Refinamento topology-aware (Decisão 6, pós-painel + pesquisa de prior-art):** a integração deixa de ser
  "sempre serial" e passa a serializar só dentro de componentes conexos do grafo de footprint, cobrindo a
  matriz dos 4 casos (solo / 1 worktree / interdependentes / independentes) com um único mecanismo novo (o
  classificador), reusando R-XAGENT-03 intacto dentro de cada componente. O octopus/merge-train fica deferido.

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
- **NÃO** octopus-merge (`git merge A B C`) na v1 — o classificador (Decisão 6) habilita ordem-livre entre
  componentes disjuntos, mas a integração de cada um continua um-merge-por-vez; o octopus atômico fica como
  promoção (Open questions), com fallback serial já provado.
- **NÃO** validação-contra-trunk-projetado nem bissecção de batch na v1 — o re-verify por-merge na primária
  (R-XAGENT-03) já localiza o culpado; a projeção estilo merge-train entra só se um componente grande tornar
  o re-verify-a-cada-merge caro demais.

## Open questions

- **Granularidade do teardown com fronts vivos:** quando o plano arquiva mas a base ainda não tem os commits
  (caso comum aqui), o teardown OFERECE remover só a worktree e deixar a branch (Decisão 4 bloqueia a deleção
  da branch não-mergeada). Confirmar na fase de SPEC que "remover worktree, manter branch" é um estado limpo
  para o backstop (#9 WARN) e não um falso-FAIL.
- **Severidade futura:** se o relatório WARN (#5) provar insuficiente na prática, promover a FAIL pela mesma
  ladder do single-focus — gatilho de evidência, não v1.
- **Lista de coupling files:** a v1 trata lockfiles/gerados/migrations como aresta global fixa. Confirmar na
  SPEC a lista concreta deste repo (`package-lock.json`, `meta/schemas/*` gerados?, etc.) e como mantê-la sem
  virar config nova — provável: constante no script do classificador, não em `focus.json`.
- **Rename como expansão de footprint:** um branch que renomeia `a→b` tem footprint = união {a,b}; preferir o
  merge `ort` 3-way (melhor detecção de rename) a qualquer caminho octopus no componente afetado. Mecânica a
  fixar na SPEC; é trilho de segurança, não decisão de produto. `verified_by: git-scm.com/docs/git-merge`.
- **Promoção a octopus / projeção:** gatilho de evidência — um componente disjunto grande cujo re-verify
  one-by-one fique caro promove para octopus atômico (refuse-clean, fallback serial) e/ou validação contra
  trunk projetado. `verified_by: github.com/lesfurets/git-octopus`, `zuul-ci.org/docs/zuul/latest/gating.html`.

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
- **Integração SEMPRE serial e incondicional (R-XAGENT-03 puro, 1ª versão da Decisão 6).** Superada pelo
  refinamento topology-aware: forçar série entre worktrees de escopo disjunto é over-serialização — o prior-art
  (Zuul, merge queues, stacked diffs) serializa só dentro de componentes conexos. R-XAGENT-03 é **preservado
  intacto DENTRO de cada componente**; o que muda é não esperar entre componentes disjuntos. Não confundir com
  "merge paralelo dentro de um componente" — isso continua proibido (é o corruption R-XAGENT-03 previne).

## References

Prior-art que fundamenta o refinamento topology-aware da Decisão 6 (pesquisa desta sessão):

- **Predição de conflito por disjunção de footprint:** Owhadi-Kareshk et al., *Predicting Merge Conflicts*
  — `https://arxiv.org/pdf/1907.06274`; *Detecting Semantic Conflicts via Static Analysis* —
  `https://arxiv.org/pdf/2310.04269`. (Footprint disjunto ⇒ sem conflito textual, NÃO build-safe.)
- **Serializar só dentro de componentes conexos:** Zuul gating — `https://zuul-ci.org/docs/zuul/latest/gating.html`;
  GitHub merge queue — `https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue`;
  stacked diffs — `https://newsletter.pragmaticengineer.com/p/stacked-diffs`.
- **Teste de "já integrado" + octopus (deferido):** `https://git-scm.com/docs/git-merge-base`,
  `https://git-scm.com/docs/git-merge`, `https://github.com/lesfurets/git-octopus`.
- **Máquina interna reusada:** prova de disjunção par-a-par em `skills/core/parallel-dispatch.md:76-77`.

## Self-review against code-quality gates

- G1 read-before-claim: applied — claims sobre código existente citam arquivo (project-create-plan.md Stage 6,
  implement.md Step 0.5, emit-focus.js pickFocus, bind-plan-branch.js stampBranch, worktree-isolation.md
  :38/:42-43/:47-57/:54, project-transitions.md `archive`, project-verify.md checks), todos lidos/escritos nesta sessão.
- G2 soft-language: applied — bloco de Decisions varrido para should/probably/may/typically/usually; 0
  ocorrências nas Decisions e no Chosen approach (a palavra "pode" aparece só descrevendo modos de falha em
  Context/Open questions, não em afirmações de design).
- G6 reference-or-strike: applied — asserções sobre código carregam `verified_by:`; as afirmações de
  prior-art na Decisão 6 / Open questions carregam URL citável (ver §References); o que não é verificável
  está em Open questions como pergunta, não afirmação.
