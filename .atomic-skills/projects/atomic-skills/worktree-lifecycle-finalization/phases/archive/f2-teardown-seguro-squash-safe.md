---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f2-teardown-seguro-squash-safe
title: Teardown seguro squash-safe contra integrationRef (Decisão 4)
goal: revisar o invariante de não-perda em `scripts/worktree-teardown.js` para
  verificar contra o `integrationRef` configurável (não mais `main`), compondo
  liveness via `gh pr view` (state==MERGED, baseRefName correto, captura
  `headRefOid`) com um veto local ancorado no `headRefOid` que é seguro sob
  squash-merge; em indeterminação, BLOQUEIA.
status: done
branch: plan/worktree-lifecycle-finalization
started: 2026-06-17T15:15:13Z
lastUpdated: 2026-06-17T15:15:13Z
nextAction: null
parentPlan: worktree-lifecycle-finalization
phaseId: F2
tasksDone: 1
tasksTotal: 1
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: G-1
    description: Teardown verifica contra integrationRef; liveness+veto headRefOid;
      oráculos A (resíduo pós-squash bloqueia) e B (squash limpo permite);
      indeterminação bloqueia; sem -D/--force/rm -rf; suite verde.
    status: met
    metAt: 2026-06-17T16:51:02Z
    verifier:
      kind: test
      runner: node
      pattern: tests/worktree-teardown.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T16:51:02Z
      exitCode: 0
      testsCollected: 21
      passed: true
      outputSummary: "node --test tests/worktree-teardown.test.js @ 2a69940: tests 21,
        pass 21, fail 0 (2 oráculos de squash + G9 mutation-kill + 4 testes de
        hardening)."
    verifierLabel: "test: node tests/worktree-teardown.test.js"
    evidenceSummary: passed · 21 tests · 2026-06-17
  - id: G-2
    description: Skills válidos após a revisão do invariante.
    status: met
    metAt: 2026-06-17T16:51:02Z
    verifier:
      kind: shell
      command: npm run validate-skills
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T16:51:02Z
      exitCode: 0
      passed: true
      outputSummary: "npm run validate-skills @ 2a69940: All 15 skills valid, exit 0."
    verifierLabel: "shell: npm run validate-skills"
    evidenceSummary: passed · 2026-06-17
stack:
  - id: 1
    title: Teardown seguro squash-safe contra integrationRef (Decisão 4)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: Liveness gh + veto ancorado no headRefOid, com 2 testes-oráculo de squash
    status: done
    lastUpdated: 2026-06-17T16:01:56Z
    closedAt: 2026-06-17T16:01:56Z
    summary: Liveness gh + veto headRefOid contra o integrationRef, com 2 oráculos
      de squash; consome a `pr-url`/identidade do finalize (F3) — contrato
      definido em F2, populado por F3.
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
        (consumindo `resolveIntegrationRef` de `scripts/integration-ref.js`, F1)
        em vez de `origin/main→main`"
      - a liveness exige `state==MERGED`, `mergedAt` não-nulo E `baseRefName ==
        integrationRef`, e captura o `headRefOid`
      - o veto libera só quando `git merge-base --is-ancestor` é verdadeiro OU
        `HEAD == headRefOid` (squash), e BLOQUEIA qualquer commit além do
        `headRefOid`
      - ORÁCULO de squash — com um commit adicionado DEPOIS do head ⟹ teardown
        BLOQUEIA, e squash-merged LIMPO (`HEAD == headRefOid`) ⟹ teardown
        PERMITE
      - o teardown resolve a identidade do PR a partir da `pr-url`/identidade
        gravada no estado do plano (que o finalize/F3 popula) para desambiguar,
        e BLOQUEIA só quando `gh` está não-autenticado, `headRefOid`/ref
        ausente, OU a identidade gravada está ausente/ambígua.
    verifier:
      kind: test
      runner: node
      pattern: tests/worktree-teardown.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T16:01:56Z
      exitCode: 0
      testsCollected: 17
      passed: true
      outputSummary: "node --test tests/worktree-teardown.test.js on merged primary
        (a6c98d9): tests 17, pass 17, fail 0. Mode 2/Codex executed in worktree
        impl/wlf-f2-t001, ff-merged + re-verified on primary (mode2 L-001: the
        re-run is the adjudicator, not Codex -o). G-2 npm run validate-skills
        exit 0 (All 15 skills valid)."
      mutation:
        target: scripts/worktree-teardown.js:93 (squash-head-match veto)
        change: branchHead === headRefOid → branchHead !== headRefOid
        killedBy:
          - isTeardownSafe blocks squash residue beyond the PR head (Oracle A)
          - isTeardownSafe permits clean squash when branch head matches PR head
            (Oracle B)
          - isTeardownSafe permits non-squash ancestry when branch head differs
            from PR head
        killTranscript: "inject ===→!== ⟹ node --test: tests 17, pass 14, fail 3 (both
          squash oracles + ancestor RED); git checkout revert ⟹ tests 17, pass
          17, fail 0."
parked: []
emerged: []
summary: Teardown só remove com integração provada vs integrationRef, seguro sob squash.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: false
---

# Narrative / notes

Initiative for phase **F2 — Teardown seguro squash-safe contra integrationRef (Decisão 4)**.

## Session handoff
- **Narrative:** **T-001 DONE** (Decisão 4 teardown squash-safe). Executado via **Mode 2 (Codex)** em worktree isolada `impl/wlf-f2-t001` off `e7fba0d`, ff-merged SERIAL na primária (`a6c98d9`), **re-verificado na primária MERGED** (`node --test tests/worktree-teardown.test.js` = 17 tests, 17 pass, 0 fail) + **mutation-kill G9** (===→!== no veto squash mata ambos oráculos). G-2 `npm run validate-skills` exit 0. Worktree removido + branch impl deletada (`-d`, fully-merged). T-001 é o ÚNICO task de F2 ⟹ **fronteira de fase**: phase-done F2 está pendente (não auto-avançado — opt-in do operador).
- **Decision log:** Executor = Codex Mode 2 (codex-cli 0.139.0; lane on, `minBatchTasks=1`). Opus PLANEJOU+REVISOU, não executou; contrato de API settled ANTES do dispatch (F1 gate). O adjudicador foi a re-execução do verifier na primária MERGED, não o auto-report `-o` do Codex (mode2 L-001). Mutation-kill confirmou que os oráculos não são vacuosos (wlf-f0 L-002). **10 falhas em `tests/detect.test.js`+`tests/install.test.js` são PRÉ-EXISTENTES** — provado: na base `4fbfb12` (antes de qualquer trabalho desta sessão) esses 2 arquivos já dão `fail 2`; meus commits tocaram só 3 arquivos (o .md de estado + os 2 do teardown), nenhum de install/detect. É follow-up desacoplado, NÃO regressão nem bloqueador de T-001.
- **Single nextAction:** Rodar **`phase-done F2`** (opt-in do operador): executa os exit-gates G-1 (`node --test tests/worktree-teardown.test.js`) e G-2 (`npm run validate-skills`) com evidence, roda o **review-code gate** sobre o diff da fase, distila lessons F2, e avança `currentPhase`→F3. F2 não é destrutivo (diff aditivo) ⟹ mode=local por default; mas o módulo é porta-de-mão-única (teardown), então considerar `--mode=both` (design-brief L-001 / wlf-f1 L-001).
- **Verbatim state:** Primária `plan/worktree-lifecycle-finalization` HEAD=`a6c98d9794a9f74a46749983219253fe93e077b1` (ff-merge de `impl/wlf-f2-t001`). T-001 evidence: `verifierKind:test, exitCode:0, testsCollected:17, passed:true` @ a6c98d9. G-1 verifier: `node --test tests/worktree-teardown.test.js`; G-2: `npm run validate-skills`. Entregues por T-001: `scripts/worktree-teardown.js` (`resolveBaseRef({routingConfig,git})`→`{integrationRef,baseRef}|null` consome `resolveIntegrationRef`; `isTeardownSafe({branch,baseRef,integrationRef,prIdentity,git,gh})` liveness `gh.prView`+veto `headRefOid` squash-safe), `tests/worktree-teardown.test.js` (17 testes, 2 oráculos de squash). **Follow-ups abertos:** (F1→F3) `git check-ref-format` ATIVO deferido ao F3; (F0) finding #2 `shouldForkPlanBranch` sem caller runtime; **install/detect suite RED pré-existente** (10 falhas em countSkills/installSkills) — investigar fora deste plano. **PROJECT-STATUS.md stale** (09/06) — `focus.json` é a fonte viva.
- **Uncommitted changes:** a transição `done T-001` (edição de `phases/f2-teardown-seguro-squash-safe.md`: status done + evidence + mutation + rollup tasksDone:1 + nextAction + este handoff) e `focus.json` regen, a commitar agora. A fonte (`scripts/worktree-teardown.js`+`tests/worktree-teardown.test.js`) já está em `a6c98d9`. Após o commit, árvore LIMPA.

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

## Self-review against gates (implement, F2)
- **G1 read-before-claim:** applied — T-001 fechado pela re-execução REAL do verifier na primária MERGED (`a6c98d9`: `node --test tests/worktree-teardown.test.js` = 17 tests, 17 pass, 0 fail); o diff foi LIDO (`scripts/worktree-teardown.js` + os 17 testes), não o auto-report `-o` do Codex; o mutation-kill G9 (`===`→`!==`) prova os oráculos não-vacuosos (3 RED → revert GREEN).
- **G2 soft-language:** applied — o close é evidence `passed:true` / `testsCollected:17`, sem `should`/`works`/`looks-done`; handoff escaneado pela ban-list.
- **G6 reference-or-strike:** applied — literais do handoff são paths/commands/SHAs verbatim (`node --test tests/worktree-teardown.test.js`, HEAD=`a6c98d9`, base=`4fbfb12`); a afirmação "10 falhas pré-existentes" carrega a prova (`fail 2` em detect/install rodados na base 4fbfb12).

## Links

_(plan doc, external refs)_
