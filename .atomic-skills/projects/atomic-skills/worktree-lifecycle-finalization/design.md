# Design — worktree-lifecycle-finalization (REVISADO: pivô Git Flow)

Fecha o ciclo de vida da worktree-do-plano. **Este design foi REABERTO e revisado** após um pivô de
modelo do operador (precedência artefato humano > IA). A versão anterior (premissa "plan-branch é
bookkeeping, NÃO feature") está preservada no histórico git deste arquivo. Pesquisa-base original:
`docs/design/project-orchestrator/10-worktree-lifecycle-finalization.md`.

Decisões travadas pelo operador nesta reabertura (não rediscutíveis; ratificadas em B2): modelo
`worktree = feature → PR → develop → (futuro) main`; escopo v1 = **só feature→develop**; **todo plano
forka sua branch na criação**; branch de integração = **ref configurável** (default `develop`,
prompt-quando-ausente), criada de `main` neste repo; correção do coupling **deferida** (interim
`merge=union`); `focus.json` → **git-ignore**; push como **`plan/<slug>`**.

## Context

A versão anterior deste design derrubou, via painel adversarial, a premissa "finalize simétrico estilo
feature branch": uma `plan/<slug>` seria *bookkeeping de foco com commits interleaved*, não uma branch
cujo telos é mergear na trunk. A evidência que sustentava isso era a **interleaving** observada:
`plan/multiplan-focus` arquivado, 36 commits à frente da `main`, **19 de outros fronts**.

O operador **pivotou o modelo** (bom senso/consenso, refinado para Git Flow): cada worktree-de-plano **é**
uma feature; cada feature vai a **PR → `develop`** (branch de integração que consolida e mantém histórico
de PRs; conflitos resolvem na entrada da develop) → futuramente merge → `main`. Nunca PR cego na `main`.

O pivô **não é contraditório com a evidência de interleaving — ele a resolve na raiz.** A interleaving era
sintoma do modelo antigo, em que a branch nascia tarde (sob concorrência) e os commits do plano
pré-existente já estavam misturados na árvore compartilhada. Sob o modelo novo, **todo plano forka sua
própria branch na criação** (Decisão 1): cada feature acumula commits na própria branch desde o início, e
"1 worktree = 1 feature = 1 PR limpo" passa a ser mecanicamente verdadeiro.

O que falta continua sendo o FIM do ciclo: hoje nada fecha quando o plano termina — o
`scripts/worktree-teardown.js` (entregue na F1) já decide remoção segura, mas contra `main`
(`resolveBaseRef` ladder `origin/main→main→null`, `verified_by: scripts/worktree-teardown.js`), e nada
ABRE o PR. Sob o pivô o finalize passa a **ativo** e o teardown passa a verificar contra o **ref de
integração configurável**, robusto a squash-merge.

Risco estrutural identificado pelo painel (contrarian corroborado por 3 vozes): o tree `.atomic-skills/`
(`focus.json`, `status/*`, `projects/*`) é commitado e tocado por TODA branch de plano
(`verified_by: CLAUDE.md` — "the `.atomic-skills/` project-tracking tree is now meant to be versioned in
git"). Logo, sob PR→develop **todo par de feature-PRs colide** nesse estado. A v1 contém o risco com o
mínimo (Decisão 5); a cura estrutural é um plano separado.

## Decisions

1. **Todo plano forka sua própria branch + worktree na CRIAÇÃO (feature-branch desde o nascimento).**
   Reverte o default lazy da F0 ("plano solo = `branch: null` na árvore atual, forka só sob
   concorrência"). O mecanismo de fork/stamp/worktree-retroativa permanece útil
   (`verified_by: scripts/bind-plan-branch.js` stampBranch; `scripts/emit-focus.js` pickFocus intacto) —
   muda só o GATILHO: de condicional-sob-concorrência para incondicional-na-criação. Consequência
   load-bearing: elimina a interleaving (cada feature acumula na própria branch), tornando o PR limpo
   coerente. `emit-focus` NÃO é tocado (seu `multipleActivePlans` é pós-colisão e read-only).

2. **A branch de integração é um ref CONFIGURÁVEL (default `develop`), repo-global; quando ausente, o
   fluxo PERGUNTA (usar existente OU criar), nunca assume nem falha em silêncio.** Home: campo novo
   `integrationRef` em `.atomic-skills/status/routing.json`. **Restrição verificada:** o schema tem
   `additionalProperties: false` e descreve-se como "Mode 2 routing config"
   (`verified_by: meta/schemas/routing.schema.json`) — adicionar o campo EXIGE estender o schema e
   generalizar o escopo do arquivo de "Mode 2 routing" para "config de roteamento/integração do repo". O
   ref NÃO mora no frontmatter do plano (per-plano divergiria a verdade — dois planos apontando para
   develops diferentes). UX prompt-quando-ausente: **lazy, no ponto de consumo (o finalize, Decisão 3)**,
   persiste uma vez em `routing.json`; a criação de plano fica zero-rede. Para este repo: criar `develop`
   a partir de `main` (HEAD de `origin/main`).

3. **O "finalize" passa a ATIVO num comando dedicado `project finalize` (operator-prompted), SEPARADO do
   `archive`.** O finalize é magérrimo e faz só três coisas: (a) `git push -u origin plan/<slug>` (mantém
   o nome `plan/<slug>`, não renomeia); (b) `gh pr create --base <integrationRef> --head plan/<slug>
   --fill`; (c) grava a `pr-url`/identidade no estado do plano (que o invariante da Decisão 4 consulta). O
   `archive` CONTINUA zero-git e terminal, como hoje (`verified_by:
   skills/shared/project-assets/project-transitions.md` archive) e roda DEPOIS do merge do PR. Isso separa
   **publicar** (efeito de rede, irreversível-social: um PR é público) de **encerrar** (estado local
   reversível) — duas máquinas de estado com modos de falha independentes. Tudo operator-prompted, nunca
   automático; o finalize mostra o diff `plan/<slug> ^<integrationRef>` e o PR proposto e pede confirmação.

4. **Invariante de não-perda no teardown, contra o ref configurável e SEGURO sob squash-merge:
   API = sinal de liveness, grafo-local = veto de safety ANCORADO NO HEAD MERGEADO DO PR.** Os dois modos
   de erro são assimétricos — falso-negativo ("não integrado" quando está) é recuperável (re-roda);
   falso-positivo ("integrado" quando não está) **deleta trabalho não-mergeado, irreversível**. A
   composição segura, portanto:
   - **Liveness (gh):** `gh pr view <branch> --json state,mergedAt,baseRefName,headRefOid` confirma
     `state==MERGED`, `mergedAt != null` E `baseRefName == <integrationRef>` (PR mergeado no ref CERTO), e
     CAPTURA o `headRefOid` (SHA do head do PR no instante do merge). Falhou → BLOQUEIA.
   - **Safety veto (local) contra o head mergeado, NÃO contra a ref:** o tip de `plan/<slug>` não pode
     avançar além do que o PR mergeou. Concretamente: `git merge-base --is-ancestor <branch>
     <integrationRef>` (fast-path; cobre merge-commit/rebase-merge) OU — no caso squash, em que os commits
     da feature ganham SHAs novos em develop e o ancestor falha — `HEAD(<branch>) == headRefOid` (nada foi
     commitado DEPOIS do head que o PR mergeou). QUALQUER commit além do `headRefOid` → BLOQUEIA (resíduo
     não-integrado).
   - **Por que NÃO `git rev-list <branch> --not <integrationRef>`:** sob squash esse rev-list é SEMPRE
     não-vazio (os SHAs originais nunca viram ancestrais de develop) → bloquearia o caminho-feliz PARA
     SEMPRE, repetindo a inutilidade do ancestor-only. Ancorar o veto no `headRefOid` (não na ref) é o que
     torna o teardown de um squash LIMPO permitido (`HEAD == headRefOid`) e ainda bloqueia o resíduo
     pós-merge. Isso também responde ao caminho operacional: após um squash legítimo sem commits novos, o
     teardown PROSSEGUE.
   - O `OR` ingênuo (`ancestor OR pr-merged`) é **REJEITADO**: soma os falsos-positivos das duas pernas e
     não vê commits adicionados DEPOIS do merge do PR (a API ainda diz MERGED → deletaria o resíduo). O
     ancoramento no `headRefOid` fecha esse buraco. `patch-id` fica FORA da v1 (o `headRefOid` o substitui
     com mais precisão).
   - Indeterminação (sem `gh` auth, ref/`headRefOid` ausente, PR ambíguo/múltiplo) → **BLOQUEIA**. Falha
     segura over-bloqueia, nunca over-deleta. Sem `-D`/`--force`/`rm -rf`; `git branch -d` (minúsculo) é a
     2ª guarda nativa. `resolveBaseRef` muda de `origin/main→main` para o `integrationRef`.
     `verified_by: scripts/worktree-teardown.js` (isTeardownSafe/resolveBaseRef atuais),
     `skills/shared/worktree-isolation.md:42-43` (merge-before-remove).

5. **Coupling de `.atomic-skills/` contido com o MÍNIMO na v1; a partição estrutural é PLANO SEPARADO.**
   `focus.json` é estado-de-sessão regenerável (`verified_by: scripts/emit-focus.js:233,187` —
   `emitFocus`/`buildFocusDigest` reconstroem o digest com `generatedAt` a partir do plan state) →
   **git-ignore**, removendo o singleton que mais colide entre feature-PRs. Isso é um **carve-out
   explícito** ao princípio "o tree `.atomic-skills/` é versionado, não ignorado"
   (`verified_by: CLAUDE.md`), aprovado pelo operador em B2. Os demais JSON append-only de `status/*`
   ganham `.gitattributes merge=union`. A CURA (particionar por ownership: estado per-plano disjunto por
   slug viaja na branch; agregados globais saem das feature-branches) fica como **plano separado** (decisão
   de escopo do operador). Nota de parity: o git-ignore de `focus.json` é mudança manual de repo-policy,
   **fora** do contrato install/uninstall (o installer não cria nem ignora `focus.json` —
   `verified_by: CLAUDE.md` seção "Install / Uninstall parity").

6. **Topology-aware DEFERIDO inteiro; backstop read-only re-mirado para o modelo PR→develop.** O
   classificador de footprint (serializar só dentro de componentes conexos) foi desenhado para ordenar
   merge-backs LOCAIS; sob PR→develop quem serializa os merges é o GitHub (branch protection / merge do
   PR), então o classificador não se justifica na v1 — vira backlog para quando develop→main precisar de
   ordenação ou houver paralelismo real com dor de conflito. R-XAGENT-03 (merge serial) permanece para
   qualquer merge-back local fora do fluxo de PR. O **backstop** é um **9º check** a ADICIONAR no
   `project verify` (hoje há 8, §1–8; o #5 já faz orphan-detection de escopo menor —
   `verified_by: skills/shared/project-assets/project-verify.md` "Checks (in order)" §1–8), read-only,
   WARN-only, derivado live, e re-mirado para os órfãos do modelo novo: worktree viva de feature já
   mergeada em develop (teardown pendente); branch de plano arquivado nunca PR-ada, ou PR aberto e nunca
   mergeado. Sem flag em `focus.json`, sem hook, sem campo de schema novo.

## Chosen approach

O modelo (Git Flow `worktree=feature→PR→develop→main`) é decisão do operador. O painel adversarial
(Aria/Tariq/Flynn + contrarian Dr. Ravi, gate-mode) divergiu sobre o MECANISMO. Três abordagens pesadas:

- **(A) Sobrecarregar `archive` para abrir o PR + push.** Rejeitada — funde "publicar" (rede,
  irreversível) com "encerrar" (local, terminal, reversível); quebra a propriedade zero-git/offline do
  `archive` da qual o fluxo já depende.
- **(B) Teardown minimalista `gh MERGED → remove` (Flynn).** Não escolhida como invariante v1 — mais
  barata, mas deleta commits adicionados após o merge do PR (a API ainda reporta MERGED). Dissent
  preservado.
- **(C) Híbrido — ESCOLHIDA.** Comando dedicado `project finalize` (separa publicar de encerrar, Decisão
  3) + teardown com **liveness(gh) + veto ancorado no `headRefOid`** seguro sob squash (Decisão 4) + ref configurável em
  `routing.json` (Decisão 2) + coupling contido com o mínimo (Decisão 5) + topology deferido (Decisão 6).

**Por que (C) ganhou:** Tariq fixou o invariante inegociável — a API dá o SINAL, o grafo local dá o VETO;
um falso-positivo passa a exigir DOIS erros independentes (o `OR` ingênuo só exigia um). Flynn cravou o
finalize magérrimo e o corte do over-engineering (patch-id, merge-queue, locks). Aria separou as máquinas
de estado (publicar vs encerrar) e o ownership do ref (repo-global, não per-plano). O contrarian (Dr. Ravi)
forçou o reconhecimento de que o coupling de `.atomic-skills/` é a causa-raiz, não um detalhe — o que o
operador resolveu por escopo (conter agora, particionar depois).

## Blast radius

One-way doors / migração — contenções explícitas:

- **Decisão 1 reverte a F0-Decisão-1 (trabalho já entregue/done).** Muda de novo o contrato de criação de
  plano (default de fork). Contenção: o mecanismo de fork/worktree-retroativa é REUSADO; só o gatilho
  inverte (condicional → incondicional). Os paths no-op/degraded do Step 0.5 e o `emit-focus` (11 testes
  verdes) NÃO são tocados.
- **Decisão 2 estende `routing.json` (`additionalProperties: false`).** Adicionar `integrationRef` quebra
  a validação até o schema ser estendido; generaliza o escopo descrito do arquivo. Reversível (remover o
  campo). Risco social: ninguém deve apontar o ref via frontmatter (gera divergência) — proibido por design.
- **Decisão 3 introduz efeito de REDE/social irreversível (push + PR).** Um PR aberto é público. Contenção:
  operator-prompted sempre, nunca automático; `archive` permanece reversível e offline; finalize mostra o
  diff e o PR proposto antes de agir.
- **Decisão 5 git-ignora um arquivo hoje rastreado (`focus.json`).** Carve-out a um princípio documentado.
  Contenção: `focus.json` é regenerável (verificado); a mudança no `.gitignore` é repo-policy manual, fora
  do contrato install/uninstall; o round-trip test e o consumidor statusline (claudebar) precisam ser
  confirmados no SPEC (Open question).
- **Criação da branch `develop`.** Branch permanente nova no repo (deletável, mas load-bearing assim que
  features passam a mirá-la). Contenção: criada de `main`; develop→main fica fora de escopo (deferido).
- **Nenhuma decisão deleta dados.** O teardown bloqueia na dúvida. Reversão mais cara: re-permitir branch
  incondicional / re-trackear `focus.json` — patches pontuais.

## Non-goals

- **NÃO** mecanizar a consolidação `develop → main` na v1 (cadência de release deferida; lifecycle
  separado). Só feature→develop.
- **NÃO** particionar estruturalmente `.atomic-skills/` (estado per-plano disjunto por slug) nesta v1 —
  é plano separado; a v1 contém o coupling com `focus.json` gitignored + `merge=union`.
- **NÃO** classificador topology-aware, merge-queue do GitHub, nem fila estilo Zuul na v1 — o GitHub
  serializa os merges; o classificador é backlog.
- **NÃO** detecção patch-id de squash-merge na v1 — o liveness(gh)+veto-ancorado-no-`headRefOid` cobre o
  caso; patch-id colapsa N commits num diff agregado (falso-positivo de integração-parcial).
- **NÃO** automatizar push/PR/merge — tudo operator-prompted.
- **NÃO** renomear `plan/<slug>` → `feat/<slug>` no push — preserva a identidade branch↔worktree↔PR de
  que o invariante (Decisão 4) depende e não quebra a já-pushada `origin/plan/skills-restructuring`.
- **NÃO** colocar o `integrationRef` no frontmatter do plano — só repo-global (`routing.json`).

## Open questions

- **Home exata + schema do `integrationRef`:** campo em `routing.json` com schema estendido (escolhido) vs
  um `integration.json` dedicado repo-scoped — ambos repo-global, mesma UX prompt-quando-ausente. O atrito
  é o mismatch semântico (routing.json descreve-se como "Mode 2 routing"). Fechar no SPEC.
- **Impacto do git-ignore de `focus.json`:** confirmar no SPEC que (a) o round-trip
  install/uninstall (`tests/install-uninstall-roundtrip.test.js`) segue verde com `focus.json` não-rastreado
  (gerado em runtime, só não commitado), e (b) o consumidor statusline (claudebar) ainda o encontra.
- **Lista de `status/*` que recebe `merge=union`:** quais JSON são genuinamente append-only (union seguro)
  vs pontuais (union geraria JSON inválido). Confirmar a lista concreta no SPEC.
- **Identidade branch↔PR no teardown:** como `gh pr view` resolve o PR de `plan/<slug>` (por head branch) e
  o desempate quando há múltiplos PRs na mesma branch (um fechado, um mergeado). Fechar no SPEC.
- **Oráculo de CI (GATE DE SPEC, não opcional):** dois testes precisam existir ANTES de a invariante ser
  confiável — (a) "squash-merged + commit adicionado DEPOIS ⟹ teardown BLOQUEIA" e (b) "squash-merged
  LIMPO (`HEAD == headRefOid`) ⟹ teardown PERMITE". Sem eles a Decisão 4 é narrativa, não invariante.

## Rejected alternatives

- **Premissa original "plan-branch = bookkeeping, NÃO feature; arquivar-sem-merge é normal; nunca mergear
  na trunk".** SUBSTITUÍDA pelo pivô do operador (precedência humano > IA). A evidência de interleaving que
  a motivava é endereçada na raiz pela Decisão 1 (always-fork), não ignorada.
- **Fork lazy sob-concorrência (F0-Decisão-1 original).** Superado pela Decisão 1: o lazy deixava um plano
  solo sem feature-branch para PR-ar e reintroduzia a interleaving que motivou o design original.
- **`ancestor OR pr-merged` (híbrido ingênuo).** Rejeitado: soma falsos-positivos e some o resíduo
  pós-merge. Substituído por liveness(gh) + veto ancorado no `headRefOid` do PR mergeado.
- **Veto `git rev-list <branch> --not <integrationRef>` (1ª formulação do safety veto, do painel).**
  Corrigido após o critic: sob squash o rev-list é sempre não-vazio (SHAs reescritos) → bloquearia todo
  squash-merge para sempre. O veto certo ancora no `headRefOid` do PR, não na ref.
- **`gh MERGED → remove` (Flynn, minimalista).** Não escolhido como invariante v1 — deleta commits
  adicionados após o merge. Dissent preservado (mais barato; aceitável só se o dev nunca commita pós-merge).
- **`patch-id` como prova primária de integração.** Adiado: squash colapsa N commits → patch-id agregado
  não casa nenhum commit individual; risco de falso-positivo de integração-parcial.
- **Sobrecarregar `archive` / `phase-done` como casa do finalize.** Rejeitado: `archive` funde publicar com
  encerrar; `phase-done` é evento 1:N e o PR feature→develop é 1:1.
- **Classificador topology-aware / merge-queue / Zuul na v1.** Deferido: o GitHub serializa os merges;
  over-engineering para o volume atual (develop nem existe ainda). Preservado como backlog (Dr. Ravi, Flynn).
- **`integrationRef` no frontmatter do plano.** Rejeitado por todas as vozes: per-plano divergiria a
  verdade do ref (qual vence se dois planos discordam?).
- **Push como `feat/<slug>` (Aria).** Não escolhido — quebra a identidade branch↔PR de que o invariante
  depende e cria divergência local↔remote; `plan/<slug>` reflete a origem (tooling). Dissent de Aria
  preservado (alinhar à convenção `feat/*` do remote, PR list legível).
- **Partição estrutural de `.atomic-skills/` nesta v1.** Deferida a plano separado (escopo do operador);
  v1 fica com o interim mínimo.

## References

Prior-art (preservado da versão anterior — ainda fundamenta o teardown robusto e o topology deferido):

- **Integração "já mergeado?" e mecânica de merge/squash:** `https://git-scm.com/docs/git-merge-base`,
  `https://git-scm.com/docs/git-merge`, `https://cli.github.com/manual/gh_pr_view`.
- **Predição de conflito por footprint (para o topology DEFERIDO):** Owhadi-Kareshk et al.,
  `https://arxiv.org/pdf/1907.06274` (footprint disjunto ⇒ sem conflito textual, NÃO build-safe).
- **Serializar só dentro de componentes conexos (backlog topology):** Zuul gating
  `https://zuul-ci.org/docs/zuul/latest/gating.html`; GitHub merge queue
  `https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue`.
- **Git Flow (modelo do pivô):** `https://nvie.com/posts/a-successful-git-branching-model/`.
- **Máquina interna reusada (quando o classificador voltar):** prova de disjunção par-a-par em
  `skills/core/parallel-dispatch.md:76-77`.

## Self-review against code-quality gates

- **G1 read-before-claim:** applied — claims sobre código existente citam arquivo lido NESTA sessão:
  `scripts/worktree-teardown.js` (resolveBaseRef ladder + isTeardownSafe, lido integralmente),
  `scripts/emit-focus.js:233,187` (emitFocus/buildFocusDigest — focus.json regenerável),
  `meta/schemas/routing.schema.json` (additionalProperties:false + escopo "Mode 2 routing", lido),
  `skills/shared/project-assets/project-transitions.md` (archive zero-git, via evidência F1 T-002),
  `CLAUDE.md` (tree versionado + install-parity). Estado git verificado por comando nesta sessão
  (`git rev-parse develop` → ausente; `git branch -r` → `origin/plan/skills-restructuring` presente).
- **G2 soft-language:** applied — Decisions e Chosen approach varridos para should/probably/may/typically/
  usually e PT deveria/provavelmente/talvez/geralmente em posição de asserção; 0 ocorrências (o único
  "pode" descreve modo de falha em Context/Blast radius, não asserção de design).
- **G6 reference-or-strike:** applied — asserções sobre código carregam `verified_by:`; prior-art carrega
  URL citável (§References); o que não é verificável agora está em Open questions como pergunta
  (home/schema do ref, lista de merge=union, identidade branch↔PR, impacto no round-trip), não como
  afirmação.
