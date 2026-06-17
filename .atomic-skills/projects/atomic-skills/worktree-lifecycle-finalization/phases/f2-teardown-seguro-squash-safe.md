---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f2-teardown-seguro-squash-safe
title: Teardown seguro squash-safe contra integrationRef (Decisão 4)
goal: revisar o invariante de não-perda em `scripts/worktree-teardown.js` para
  verificar contra o `integrationRef` configurável (não mais `main`), compondo
  liveness via `gh pr view` (state==MERGED, baseRefName correto, captura
  `headRefOid`) com um veto local ancorado no `headRefOid` que é seguro sob
  squash-merge; em indeterminação, BLOQUEIA.
status: active
branch: plan/worktree-lifecycle-finalization
started: 2026-06-17T15:15:13Z
lastUpdated: 2026-06-17T15:15:13Z
nextAction: "Start T-001: Liveness gh + veto ancorado no headRefOid, com 2
  testes-oráculo de squash"
parentPlan: worktree-lifecycle-finalization
phaseId: F2
tasksDone: 0
tasksTotal: 1
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: Teardown verifica contra integrationRef; liveness+veto headRefOid;
      oráculos A (resíduo pós-squash bloqueia) e B (squash limpo permite);
      indeterminação bloqueia; sem -D/--force/rm -rf; suite verde.
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/worktree-teardown.test.js
    verifierLabel: "test: node tests/worktree-teardown.test.js"
  - id: G-2
    description: Skills válidos após a revisão do invariante.
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills
    verifierLabel: "shell: npm run validate-skills"
stack:
  - id: 1
    title: Teardown seguro squash-safe contra integrationRef (Decisão 4)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: Liveness gh + veto ancorado no headRefOid, com 2 testes-oráculo de squash
    status: pending
    lastUpdated: 2026-06-17T11:34:32Z
    summary: Liveness gh + veto headRefOid contra o integrationRef, com 2 oráculos
      de squash; consome a `pr-url`/identidade do finalize (F3) — contrato definido
      em F2, populado por F3.
    outputs:
      - kind: file
        path: scripts/worktree-teardown.js
      - kind: test
        path: tests/worktree-teardown.test.js
    scopeBoundary:
      - NÃO executar git/gh destrutivo no teste (injetar os resultados de
        `gh`/`merge-base`)
      - NÃO usar `git rev-list --not <ref>` (sob squash bloquearia o
        caminho-feliz para sempre)
      - a falha segura é BLOQUEAR, nunca over-deletar
      - o módulo nunca contém `-D`, `--force` nem `rm -rf`.
    acceptance:
      - "`resolveBaseRef` passa a resolver o `integrationRef` configurável
        (consumindo `resolveIntegrationRef` de `scripts/integration-ref.js`,
        F1) em vez de `origin/main→main`"
      - a liveness exige `state==MERGED`, `mergedAt` não-nulo E `baseRefName ==
        integrationRef`, e captura o `headRefOid`
      - o veto libera só quando `git merge-base --is-ancestor` é verdadeiro OU
        `HEAD == headRefOid` (squash), e BLOQUEIA qualquer commit além do
        `headRefOid`
      - ORÁCULO de squash — com um commit adicionado DEPOIS do head ⟹ teardown
        BLOQUEIA, e squash-merged LIMPO (`HEAD == headRefOid`) ⟹ teardown
        PERMITE
      - o teardown resolve a identidade do PR a partir da `pr-url`/identidade
        gravada no estado do plano (que o finalize/F3 popula) para
        desambiguar, e BLOQUEIA só quando `gh` está não-autenticado,
        `headRefOid`/ref ausente, OU a identidade gravada está
        ausente/ambígua.
    verifier:
      kind: test
      runner: node
      pattern: tests/worktree-teardown.test.js
parked: []
emerged: []
summary: Teardown só remove com integração provada vs integrationRef, seguro sob squash.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F2 — Teardown seguro squash-safe contra integrationRef (Decisão 4)**.

## Session handoff
- **Narrative:** F2 ATIVA (teardown seguro squash-safe, Decisão 4). T-001 é o ÚNICO task da fase. Contrato da API SETTLED por Opus (ver `## Decisions` → "Contrato settled de T-001") — F2 DEFINE a forma que F3 consome, logo settlei o design ANTES do dispatch. Roteado para **Mode 2 (Codex)**: lane on (`mode2Enabled+codexLane.enabled`, `minBatchTasks=1`), F1 spec-ready (contrato settled), F2 verifier determinístico, Codex autenticado ("Logged in using ChatGPT", codex-cli 0.139.0). Phase-start lessons gate F2 dispositionado (11 lessons; ver Decisions). Pré-dispatch snapshot.
- **Decision log:** Executor = Codex Mode 2 (default do lane; precedente F0/F1). Opus PLANEJA+REVISA, NÃO executa. O contrato de API foi settled ANTES do dispatch (F1 gate: não deixar Codex inventar a forma que F3 consome — gap-filling é a perda do split-author). Padrão de merge-back: worktree isolada off HEAD → briefing com intent → `git -C <wt> diff` readback → ff-merge SERIAL → **re-verify na primária MERGED** (mode2 L-001: o auto-report `-o` do Codex é DESCARTADO; o re-run é o adjudicador). Worktree sob `.worktrees/` (regra global do usuário: dentro do repo, nunca sibling).
- **Single nextAction:** Cortar worktree `git worktree add -b impl/wlf-f2-t001 /home/henry/atomic-skills/.worktrees/wlf-f2-t001 HEAD`, montar o briefing (work-order R-EXEC-40 com o contrato settled como intent), dispatch Codex workspace-write (cwd=worktree, stdin=briefing), ler `git -C <wt> diff`, ff-merge na primária, re-rodar `node --test tests/worktree-teardown.test.js` na MERGED, então `done T-001`.
- **Verbatim state:** Primária `plan/worktree-lifecycle-finalization` HEAD=`4fbfb122a86b9ac9d41a9199a3b9b4e036debd79`. T-001/G-1 verifier: `node --test tests/worktree-teardown.test.js`; G-2: `npm run validate-skills`. Consome `resolveIntegrationRef` de `scripts/integration-ref.js` (F1: retorna `{ref,configured,source}`, own-prop `Object.hasOwn`, `DEFAULT_INTEGRATION_REF='develop'`). MODIFY `scripts/worktree-teardown.js` (hoje: `resolveBaseRef` origin/main→main→null; `isTeardownSafe` só `git merge-base --is-ancestor`). REWRITE `tests/worktree-teardown.test.js` (hoje: 8 testes pré-pivô origin/main). routing.json: `mode2Enabled+codexLane.enabled=true`, `timeoutSeconds=600`, `sandbox=workspace-write`, `minBatchTasks=1`. **Follow-ups abertos:** (F1→F3) `git check-ref-format` ATIVO deferido ao F3 (cria o ref); (F0) finding #2 `shouldForkPlanBranch` sem caller runtime + `project-create-plan.md` fluxo `adopt` branch-or-null stale. **PROJECT-STATUS.md stale** (09/06) — `focus.json` é a fonte viva.
- **Uncommitted changes:** este snapshot pré-dispatch + a disposição de lessons + o contrato settled (edição de `phases/f2-teardown-seguro-squash-safe.md`), a commitar agora como checkpoint pré-dispatch. Após o commit a árvore primária fica LIMPA; o worktree Codex é cortado off HEAD=`4fbfb12`.

## Decisions

### F2 phase-start lessons gate (2026-06-17) — disposição das 11 lessons
- **Apply (moldam T-001):**
  - `wlf-f1 L-001` (own-prop + `--mode=both` p/ contrato) → o resolver `resolveIntegrationRef` que consumo já é own-prop-only (`Object.hasOwn`); rodar review `--mode=both` no phase-done (teardown = porta-de-mão-única, over-delete irreversível).
  - `wlf-f1 L-002` (validade de FORMATO do ref mora no consumidor) → F2 honra via "ref resolvido deve EXISTIR localmente (`git.refExists`) senão BLOQUEIA"; o `git check-ref-format` ATIVO pertence ao F3 (que CRIA o ref), não ao teardown (que só LÊ o ref).
  - `mode2 L-001` (auto-report `-o` do Codex não-confiável) → o adjudicador é a re-execução de `node --test tests/worktree-teardown.test.js` na primária MERGED; nunca o resumo do Codex.
  - `design-brief L-003` (testes em `tests/` plural) → confirmado: `npm test` = `node --test 'tests/**/*.test.js' 'test/**/*.test.js'`, descobre o arquivo.
- **Apply (disciplina de review/triage):** `design-brief L-001` (`--mode=both` p/ contrato porta-única, no phase-done); `multiplan L-002` (G1 read-before-claim na triage — rejeitar file:line alucinado).
- **Keep (alinhamento de princípio, sem ação direta):** `multiplan L-001` (indeterminado→vazio+flag ≈ teardown indeterminado→BLOQUEIA); `wlf-f0 L-001`/`L-002` (ripple-sites / doc-assert — F2 é código, G-2 é `validate-skills`, baixa relevância).
- **Stale/N-A p/ F2:** `design-brief L-002` (enum schemaVersion — F2 não adiciona schema); `design-brief L-004` (unicidade de sub-campo — N/A).

### Contrato settled de T-001 (Opus PLANEJA; Codex executa) — a forma da API que F3 consome
- `resolveBaseRef({ routingConfig, git })` → `{ integrationRef, baseRef } | null`. Consome `resolveIntegrationRef(routingConfig)`; `configured===false` (not-configured) ⟹ `null` (BLOQUEIA, nunca assume); senão prefere `origin/<ref>` depois `<ref>` via `git.refExists`, e `null` se nenhum existe. `integrationRef` = ref bare (p/ comparar com `baseRefName` do gh); `baseRef` = ref local de ancestralidade (p/ `merge-base`).
- `isTeardownSafe({ branch, baseRef, integrationRef, prIdentity, git, gh })` → decisão:
  - `!branch` ⟹ `{safe:false, outcome:'nothing-to-remove'}`.
  - `!baseRef || !integrationRef` ⟹ `blocked('indeterminate-base')`; `!prIdentity` ⟹ `blocked('pr-identity-missing')`.
  - `live = gh.prView(prIdentity)`: `!live` ⟹ `blocked('pr-identity-ambiguous')`; `live.authenticated===false` ⟹ `blocked('gh-unauthenticated')`; `live.ambiguous` ⟹ `blocked('pr-identity-ambiguous')`; `state!=='MERGED' || !mergedAt` ⟹ `blocked('not-merged')`; `baseRefName!==integrationRef` ⟹ `blocked('base-ref-mismatch')`; `!headRefOid` ⟹ `blocked('head-ref-missing')`.
  - veto squash-safe: `git.revParse(branch)===headRefOid` ⟹ `safe (via:'squash-head-match')`; senão `git.isAncestor(branch, baseRef)` ⟹ `safe (via:'ancestor')`; senão `blocked('residue-beyond-head')`.
  - `blocked(reason) = {safe:false, outcome:'blocked', reason}`.
- Oráculos (G-1): A — commit após o head ⟹ `revParse≠headRefOid` ∧ ¬ancestor ⟹ `residue-beyond-head` (BLOQUEIA); B — `HEAD===headRefOid` ⟹ PERMITE.
- scopeBoundary honrada: testes injetam `gh.prView`/`git.revParse`/`git.isAncestor` (sem git/gh destrutivo); sem `git rev-list --not`; falha-segura = BLOQUEIA; módulo sem `-D`/`--force`/`rm -rf`.

## Links

_(plan doc, external refs)_
