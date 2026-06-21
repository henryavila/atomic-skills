# 10 — Worktree lifecycle: finalization (the symmetric end of Step 0.5)

> Status: **research + proposed design** (não implementado). Origem: lacuna identificada após
> T-006 (`implement` Step 0.5 materializa/entra na worktree-do-plano no INÍCIO, mas nada a fecha
> no FIM). Esta é a peça simétrica.

## 0. O problema

O modelo de 3 níveis (canon Decisão #1, `00-CANON.md`) tem a **worktree-do-plano** (nível 1/2) como
casa durável do foco, branch `plan/<slug>`. O T-006 forçou o **início** do ciclo (Step 0.5). Mas:

- `implement` só especifica teardown/merge-back para worktrees **efêmeras do Mode 2** (R-XAGENT-03,
  `skills/shared/worktree-isolation.md`). **Não há finalize da worktree-do-plano.**
- Resultado observado em produção (esta sessão): `plan/multiplan-focus` arquivado logicamente, mas
  **36 commits à frente da main, branch viva, worktree registrada** — trabalho que pode "ficar no
  esquecimento". Anti-padrão clássico (branch longa → merge hell).

## 1. Pesquisa — o que as soluções grandes fazem

**(R1) "Done" = mergeado, não "trabalho parado".** Feature-branch não está concluída até integrar ao
trunk; quanto mais aberta, pior o merge. ([ThinkingLabs — Evilness of Feature Branching](https://thinkinglabs.io/articles/2021/10/25/on-the-evilness-of-feature-branching-why-do-teams-use-feature-branches.html), [Mergify](https://mergify.com/blog/feature-branch-workflow-a-practical-guide-for-git))

**(R2) O "finale" canônico de worktree são 3 passos** ([gitworktree.org/best-practices](https://www.gitworktree.org/guides/best-practices)):
`merge` → `git worktree remove <path>` → `git branch -d <branch>`. Nunca `rm -rf`; `git worktree prune`
limpa órfãs; nome da WT espelha a branch; prune automatizável via cron/hook.

**(R3) Ferramentas dedicadas acoplam remoção da WT ao estado de merge da branch** (o ponto central):
- **Worktrunk** `wt remove`: deleta a branch só se "merged" (6 condições, incl. **patch-id p/
  squash-merge**); **não-mergeado/sujo BLOQUEIA** a remoção (precisa `-D`/`-f`); hooks pre/post-remove;
  varre órfãs > 24h. ([worktrunk.dev/remove](https://worktrunk.dev/remove/))
- **git-town** `ship` (merge + remove branch) e `sync` (auto-deleta branches já merged); **Graphite**
  `gt sync` idem. Finalizar é **verbo de primeira classe**. ([git-town](https://github.com/git-town/git-town), [Graphite](https://graphite.com/guides/how-to-delete-all-old-merged-git-branches))

**(R4) Trabalho paralelo → integration/staging branch, não merge direto na main por front.** Junta as
branches numa integração, testa, resolve conflito lá, então **um merge limpo** para main. ([Augment Code](https://www.augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution), [MindStudio](https://www.mindstudio.ai/blog/parallel-ai-coding-agents-git-worktrees), [Upsun](https://developer.upsun.com/posts/ai/git-worktrees-for-parallel-ai-coding-agents))

**(R5) Tools de agente automatizam criar E limpar** a WT no fim (Claude Squad, agent-worktree). O
lifecycle: create → enter → run → check → **merge → cleanup**.

## 2. Design proposto (3 peças, simétrico ao Step 0.5)

**A. Gatilho no `plan-done` (não no loop do `implement`).** A criação do plano materializa a WT; o
`plan-done` (arquivamento) **oferece finalizá-la**. Momento certo: plano `archived` → casa física fecha.

**B. Teardown ciente de merge, operator-prompted (nunca silencioso):**
1. Detecta se `plan/<slug>` está integrada (ancestor-check + patch-id p/ squash) — espelha Worktrunk R3.
2. **Não-mergeada OU tree suja → BLOQUEIA** e surface (já é a regra R-XAGENT-03 do Mode 2; estende-se ao nível do plano).
3. Mergeada → `git worktree remove` + `git branch -d` + `git worktree prune` (R2).
4. Vários fronts ativos → **integration branch** (R4), não merge direto na main.

**C. Backstop contra esquecimento (mata o risco que originou o plano):** `verify`/SessionStart detecta
**plano `archived` com branch não-mergeada** OU **worktree viva de plano arquivado**, e surface — igual
`gt sync` apontar merged, igual prune agendado (R2/R3). O sistema lembra; não depende de memória.

## 3. Decisões em aberto (para o planejamento)

- **D1** — Onde mora o finalize: `plan-done` (project) vs novo passo no `implement`. (Proposto: project, simétrico ao binding lógico.)
- **D2** — Detecção de "merged": só ancestor, ou ancestor + patch-id (squash)? (Proposto: ambos, R3.)
- **D3** — Integração: integration-branch dedicada vs serial-ship em ordem de dependência (R-XAGENT-03 já é serial). 
- **D4** — Backstop: onde sinaliza (`verify` §novo / SessionStart hook / focus.json flag) e com que severidade (WARN→FAIL ladder, como o single-focus).
- **D5** — Automação de prune: manual, hook, ou comando dedicado (`project finalize <slug>`).

## 4. Aplicação ao caso atual (`plan/multiplan-focus`)

36 commits à frente da main, **19 de outros fronts ativos** (design-brief/app-map). Pelo padrão (R4):
**não** mergear para main agora (arrastaria fronts inacabados). Remover só a WT é seguro (branch
persiste); registrar finalize pendente (peça C); integrar via integration-branch quando os fronts
convergirem.
