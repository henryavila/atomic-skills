---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f0-always-fork-na-criacao-decis
title: Always-fork na criação (Decisão 1)
goal: tornar o fork de `plan/<slug>` + worktree INCONDICIONAL na criação do
  plano (Stage 6), revertendo o default lazy anterior — reusando o mecanismo de
  stamp/worktree e invertendo só o gatilho, sem tocar `emit-focus` nem o Step
  0.5 do implement.
status: done
branch: plan/worktree-lifecycle-finalization
started: 2026-06-16T22:50:35.627Z
lastUpdated: 2026-06-17T12:26:23Z
nextAction: null
parentPlan: worktree-lifecycle-finalization
phaseId: F0
tasksDone: 1
tasksTotal: 1
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: G-1
    description: "Fork incondicional na criação: solo agora forka plan/<slug>;
      planBranchName intacto; Stage 6 declara fork incondicional; suite verde."
    status: met
    metAt: 2026-06-17T12:26:23Z
    verifier:
      kind: test
      runner: node
      pattern: tests/plan-branch-policy.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T12:26:23Z
      exitCode: 0
      testsCollected: 9
      passed: true
      outputSummary: "node --test tests/plan-branch-policy.test.js @ 01c2455: tests 9,
        pass 9, fail 0."
    verifierLabel: "test: node tests/plan-branch-policy.test.js"
    evidenceSummary: passed · 9 tests · 2026-06-17
  - id: G-2
    description: emit-focus permanece intacto (Decisão 1 não o toca) e skills válidos.
    status: met
    metAt: 2026-06-17T12:26:23Z
    verifier:
      kind: shell
      command: node --test tests/focus-digest.test.js && npm run validate-skills
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T12:26:23Z
      exitCode: 0
      passed: true
      outputSummary: focus-digest 11/11 (emit-focus intact) && validate-skills 15/15 @
        01c2455.
    verifierLabel: "shell: node --test tests/focus-digest.test.js && npm run validate-…"
    evidenceSummary: passed · 2026-06-17
stack:
  - id: 1
    title: Always-fork na criação (Decisão 1)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: Fork incondicional na criação
    status: done
    closedAt: 2026-06-17T11:58:35Z
    lastUpdated: 2026-06-17T11:58:35Z
    summary: Torna o fork de branch+worktree incondicional na criação do plano.
    outputs:
      - kind: file
        path: scripts/plan-branch-policy.js
      - kind: test
        path: tests/plan-branch-policy.test.js
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
    scopeBoundary:
      - NÃO tocar `scripts/emit-focus.js` (Decisão 1 não depende dele) nem
        `skills/core/implement.md` Step 0.5
      - NÃO alterar a assinatura de `materializeDecomposition`
      - preservar `planBranchName` e `retroactiveWorktreeAdd` (só o gatilho de
        decisão muda).
    acceptance:
      - "`shouldForkPlanBranch` retorna `true` para um plano solo (fork
        incondicional na criação, revertendo o default lazy)"
      - "`planBranchName('foo')` segue retornando `'plan/foo'`"
      - o Stage 6 de `project-create-plan.md` declara o fork+stamp+worktree como
        ação incondicional na criação (não mais gated por concorrência)
      - a suíte `tests/plan-branch-policy.test.js` cobre o caso solo→fork e
        segue verde.
    verifier:
      kind: test
      runner: node
      pattern: tests/plan-branch-policy.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T11:58:35Z
      exitCode: 0
      testsCollected: 9
      passed: true
      outputSummary: "node --test tests/plan-branch-policy.test.js na árvore MERGEADA
        (789ca16): tests 9, pass 9, fail 0, exit 0. Mode 2 Codex exec em
        worktree isolada; re-verificado no primário pós-ff-merge."
parked: []
emerged: []
summary: Toda criação de plano forka branch+worktree (always-fork), revertendo o
  default lazy.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: false
---

# Narrative / notes

Initiative for phase **F0 — Always-fork na criação (Decisão 1)**.

## Session handoff
- **Narrative:** F0/T-001 **DONE** via Mode 2 (Codex) (2026-06-17). Stage 8 concluído antes (review interno + cross-ref `design.md`; S1 alinhado ao design no F2; commit `d104632`). T-001: Codex codou numa worktree isolada (`--sandbox workspace-write`), diff revisado (NENHUM teste enfraquecido — 9=9 testes, flips MEANINGFUL), capturado em `impl/wlf-f0-t001`=`789ca16`, **ff-merge** na plan branch, **re-verificado na árvore mergeada** (tests 9, pass 9, exit 0), fechado com evidence GATE-R2. Worktree removida+pruned, branch deletada. dispatch-log: 13 records (cheap tier, sem escalação). **F0 com 0 tasks abertas → phase-done PENDENTE.**
- **Decision log:** (a) honrar o gate Stage 8a antes de implementar; (b) cross-ref contra `design.md`; (c) S1 → align-to-design com co-dependência F2/F3 (pr-url definido+consumido em F2, populado por F3; `F3 dependsOn F2` mantém-se, SEM reorder); M1 dobrado; M2/M3/M4/N1 minor no review record p/ F4/F7; (d) Stage 8b codex PULADO; (e) **Mode 2 (Codex) = executor default da sessão** (1º task fechou limpo, cheap tier, 0 escalação). Impl escolhida: `shouldForkPlanBranch` → `return Array.isArray(activePlans);` (solo []→true, non-array→false fail-safe preservado), NÃO `return true` (preserva o teste de fail-safe).
- **Single nextAction:** Rodar **phase-done F0** — iterar gates G-1 (test `node --test tests/plan-branch-policy.test.js`, já 9/9) + G-2 (shell `node --test tests/focus-digest.test.js && npm run validate-skills`), depois o **review-code gate obrigatório** sobre o diff da fase (range = commit ≤ F0.started → HEAD `789ca16`; mode local salvo destrutivo), gravar `reviewGate` no `plan.md`, distilar lessons, avançar `currentPhase` F0→F1 e materializar a iniciativa F1.
- **Verbatim state:** HEAD `plan/worktree-lifecycle-finalization` = `789ca16` (+ commit de estado pendente). T-001 `done` com evidence (`verifierKind: test`, `testsCollected: 9`, `passed: true`). Gates G-1/G-2 ainda `pending` (resolvidos no phase-done). G-2 verifier: `node --test tests/focus-digest.test.js && npm run validate-skills`. `scripts/plan-branch-policy.js:10` agora `return Array.isArray(activePlans);`. Review record: `.atomic-skills/reviews/2026-06-17-1055-worktree-lifecycle-finalization.md`. dispatch-log: `.atomic-skills/status/dispatch-log.json` (13 records). Worktree `wlf-f0-t001` removida.
- **Uncommitted changes:** `phases/f0-always-fork-na-criacao-decis.md` (este handoff + T-001 done + evidence + rollups 1/1) e `.atomic-skills/status/dispatch-log.json` (record T-001) — a commitar como o commit de estado "T-001 done". O código já está em `789ca16` (ff-merge).

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Self-review against code-quality gates

- **G1 read-before-claim**: 1 task closed (T-001); evidence links the verifier run (`node --test tests/plan-branch-policy.test.js`, 9/9 on merged tree `789ca16`) + the diff; review-code triage read each cited `file:line` before acting (finding #1 at project-create-plan.md:96/101/102/113).
- **G2 soft-language**: scanned `nextAction` + task/criterion descriptions + the handoff narrative for the ban list; 0 violations — completion claims are `passed: true` evidence.
- **G6 reference-or-strike**: gate evidence + handoff literals are verbatim paths/commands/SHAs (`789ca16`, `01c2455`, the verifier commands).
- **Codex review (Mode 2 exec)**: T-001 executed by Codex (workspace-write, isolated worktree); diff reviewed (no test weakening, 9=9), re-verified on the MERGED primary as the entry token to done — a self-check, never a self-certify.
- **Review gate (G2)**: `reviewGate { status: passed, at: 01c2455, mode: local }` on the F0 phase descriptor. review-code `--mode=local` on `d104632..789ca16`: finding #1 (major) + #3 (minor) applied; #2 + the `adopt`-flow branch-or-null (project-create-plan.md ~:358) recorded as out-of-Stage-6 follow-ups.
- **Lessons (G1)**: distilled 2 reusable lessons (L-001 ripple-sites-on-default-flip, L-002 discriminating-doc-assertions), operator-ratified. The prior-F0 Codex-auto-report lesson recurred and was handled per its corrective (re-ran the verifier; did not trust the report).
