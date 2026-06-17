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
- **Narrative:** **F1 DONE + arquivada** (phase-done 2026-06-17): exit-gates G-1/G-2 met com evidence; review-code `--mode=both` verdict `approve` (Codex blind pegou F-001 leitura-de-protótipo disjunto, aplicado como hardening `Object.hasOwn`; F-001/F-002 dropados na reconciliação informed); 2 lessons F1 ratificadas; plano avançado `currentPhase`→F2; iniciativa F1 arquivada. **F2 agora ATIVA** (teardown seguro squash-safe, Decisão 4) — nada codado em F2 ainda.
- **Decision log:** Mode 2 (Codex) = executor default (lane on, `minBatchTasks=1`); padrão F1 que funcionou: worktree isolada off HEAD → briefing com intent → diff readback → ff-merge → **re-verify na primária MERGED** (mode2 L-001: auto-report `-o` do Codex descartado, o re-run é o adjudicador). **F2/T-001 CONSOME `resolveIntegrationRef`** de `scripts/integration-ref.js` (F1) — a função pura é própria-only (`Object.hasOwn`), retorna `{ref, configured, source: declared|default|not-configured}`; `resolveBaseRef` do teardown deve passar a usá-la em vez de `origin/main→main`.
- **Single nextAction:** No início de F2, rodar o **phase-start lessons gate**: `node scripts/list-lessons.js --phase F2` e disposicionar (Apply/Keep/Stale/Reject). As lessons F1 mais relevantes p/ F2: `wlf-f1 L-002` (schema=shape, validação de FORMATO do ref mora no consumidor — F2 É um consumidor: ao resolver o ref, considerar `git check-ref-format`), `wlf-f1 L-001` (own-prop + `--mode=both` p/ contrato), `mode2 L-001` (re-run na primária merged). Depois iniciar **F2/T-001** via Mode 2: MODIFY `scripts/worktree-teardown.js` (`resolveBaseRef` consome `resolveIntegrationRef`; liveness `gh pr view` state==MERGED + baseRefName==integrationRef + captura `headRefOid`; veto `git merge-base --is-ancestor` OU `HEAD==headRefOid` sob squash; indeterminação BLOQUEIA; sem `-D`/`--force`/`rm -rf`), CREATE `tests/worktree-teardown.test.js` (2 oráculos de squash: resíduo pós-head BLOQUEIA; squash limpo PERMITE; injetar resultados de gh/merge-base, sem git/gh destrutivo).
- **Verbatim state:** HEAD primária `plan/worktree-lifecycle-finalization` = (commit do avanço F1→F2, a seguir). F2/T-001 verifier: `node --test tests/worktree-teardown.test.js`. F2 G-1 verifier: `node --test tests/worktree-teardown.test.js`; F2 G-2 verifier: `npm run validate-skills`. F1 entregou: `meta/schemas/routing.schema.json` (integrationRef opcional), `scripts/integration-ref.js` (`resolveIntegrationRef`, `DEFAULT_INTEGRATION_REF='develop'`), `tests/{routing-schema,integration-ref}.test.js`. routing.json: `mode2Enabled+codexLane.enabled=true`, `minBatchTasks=1`. **Follow-ups abertos:** (F1→F3) validação de FORMATO do ref (whitespace/`git check-ref-format`) deferida ao consumidor — F2/F3 devem honrá-la; (F0) finding #2 `shouldForkPlanBranch` sem caller runtime + linha ~358 `project-create-plan.md` fluxo `adopt` branch-or-null stale. **PROJECT-STATUS.md está stale** (09/06, não lista este plano) — `focus.json` é a fonte viva; reconciliar o índice humano é follow-up separado.
- **Uncommitted changes:** o avanço F1→F2 (a commitar): `plan.md` (F1 done + reviewGate + currentPhase F2), iniciativa F1 (done + current:false, a `git mv` p/ `phases/archive/`), iniciativa F2 (active + current:true + este handoff), `focus.json` (regen → F2). Após o commit, árvore LIMPA.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
