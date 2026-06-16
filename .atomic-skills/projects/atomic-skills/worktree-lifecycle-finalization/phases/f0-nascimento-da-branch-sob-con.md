---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f0-nascimento-da-branch-sob-con
title: Nascimento da branch sob concorrência (Decisões 1+2)
goal: "tornar `branch: null` na árvore atual o DEFAULT para um plano solo no
  Stage 6, forkando `plan/<slug>` só sob concorrência; e materializar
  retroativamente a worktree do plano pré-existente quando um 2º plano o torna
  concorrente."
status: active
branch: plan/worktree-lifecycle-finalization
started: 2026-06-16T15:05:46.324Z
lastUpdated: 2026-06-16T15:38:51.971Z
nextAction: "F0: todas as tasks done — rodar phase-done (gates G-1/G-2 + review-code) para verificar e avançar."
parentPlan: worktree-lifecycle-finalization
phaseId: F0
tasksDone: 2
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: "Fork determinístico: solo retorna branch:null, concorrência
      retorna plan/<slug>; worktree retroativa do pré-existente composta sem
      --force; suite verde."
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/plan-branch-policy.test.js
    verifierLabel: "test: node tests/plan-branch-policy.test.js"
  - id: G-2
    description: emit-focus permanece intacto — Decisão 1 não depende dele (testes
      de focus verdes).
    status: pending
    verifier:
      kind: shell
      command: node --test tests/focus-digest.test.js
    verifierLabel: "shell: node --test tests/focus-digest.test.js"
stack:
  - id: 1
    title: Nascimento da branch sob concorrência (Decisões 1+2)
    type: task
    openedAt: 2026-06-16T15:05:46.324Z
tasks:
  - id: T-001
    title: Política determinística de fork de branch
    status: done
    closedAt: 2026-06-16T16:34:00.000Z
    lastUpdated: 2026-06-16T16:34:00.000Z
    summary: "Helper que decide o fork: solo → sem branch, concorrência → plan/<slug>."
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-16T16:34:00.000Z
      passed: true
      exitCode: 0
      testsCollected: 5
      outputSummary: node --test tests/plan-branch-policy.test.js → tests 5 / pass 5 /
        fail 0 (exit 0); re-run on MERGED primary tree (HEAD d66fbe2) após
        ff-merge de impl/wlf-t001.
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
      - NÃO alterar a assinatura de `materializeDecomposition`.
    acceptance:
      - "`shouldForkPlanBranch([])` retorna `false` (solo → sem fork)"
      - "`shouldForkPlanBranch([umPlanoAtivo])` retorna `true` (concorrência →
        fork)"
      - "`planBranchName('foo')` retorna `'plan/foo'`"
      - "o Stage 6 de `project-create-plan.md` declara `branch: null` como
        default explícito para plano solo."
    verifier:
      kind: test
      runner: node
      pattern: tests/plan-branch-policy.test.js
  - id: T-002
    title: Worktree retroativa para o plano pré-existente
    status: done
    closedAt: 2026-06-16T16:47:49.000Z
    lastUpdated: 2026-06-16T16:47:49.000Z
    summary: Materializa a worktree do plano pré-existente quando um 2º chega.
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-16T16:47:49.000Z
      passed: true
      exitCode: 0
      testsCollected: 9
      outputSummary: node --test tests/plan-branch-policy.test.js → tests 9 / pass 9 /
        fail 0 (exit 0); re-run on MERGED primary tree (HEAD 145774b) após
        rebase+ff-merge de impl/wlf-t002. Os 5 testes de T-001 preservados + 4
        de T-002 (retroactiveWorktreeAdd comando sem --force, throw sem baseRef,
        throw baseRef vazio, doc-presence Stage 6 capture-before-write).
    outputs:
      - kind: file
        path: scripts/plan-branch-policy.js
      - kind: test
        path: tests/plan-branch-policy.test.js
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
    scopeBoundary:
      - NÃO executar git real no teste (só compor o comando)
      - NÃO mergear
      - "NÃO re-tratar o plano entrante (o stamp do pré-existente já existe via
        `bindPlanBranch`, `verified_by: scripts/bind-plan-branch.js`)"
      - o source-ref do pré-existente é capturado ANTES de qualquer escrita do
        plano entrante.
    acceptance:
      - "`retroactiveWorktreeAdd({slug:'old', baseRef})` exige um `baseRef`
        capturado antes de qualquer escrita do plano entrante e devolve um
        comando que materializa `.worktrees/old` com branch `plan/old` semeada
        NESSE `baseRef` (nunca o HEAD pós-mutação, para a worktree retroativa
        não vazar artefatos do entrante)"
      - "`retroactiveWorktreeAdd` BLOQUEIA (lança) quando `baseRef` é
        ausente/irresolúvel — falha segura, nunca semeia de um ref indefinido"
      - o comando NUNCA inclui `--force`
      - o Stage 6 de `project-create-plan.md` captura o source-ref do
        pré-existente antes de escrever o plano entrante e liga a worktree
        retroativa a esse ref.
    verifier:
      kind: test
      runner: node
      pattern: tests/plan-branch-policy.test.js
parked: []
emerged: []
summary: Branch da worktree nasce só sob concorrência; plano solo fica sem branch.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Nascimento da branch sob concorrência (Decisões 1+2)**.

## Session handoff
- **Narrative:** **Fase F0 com TODAS as tasks done (2/2) — fronteira de fase.** T-001 e T-002 executadas por Codex (Mode 2), serial (coupladas nos mesmos 3 arquivos), cada uma merge-back operator-aprovado → re-verificada na primária merged como entry token a done. Estado final: `scripts/plan-branch-policy.js` (`shouldForkPlanBranch`/`planBranchName`/`retroactiveWorktreeAdd`), `tests/plan-branch-policy.test.js` (9 testes), `project-create-plan.md` Stage 6 (solo→`branch: null` + capture-before-write retroativo). HEAD `plan/worktree-lifecycle-finalization` = `145774b`. Falta apenas `phase-done` (gates G-1/G-2 + review-code), que é operator-opt-in.
- **Decision log:** (1) Mode 2/Codex honrado por config file-backed; coupling T-001/T-002 força serial. (2) Worktrees Codex sob checkout PRIMÁRIO, ambas removidas+`branch -d` (= integradas). (3) Merge-back operator-prompted (v1). (4) Codex nunca tocou `.atomic-skills/`; Opus fez toda transição/commit. (5) Auto-report do Codex ("tests 1") descartado nas DUAS tasks — só o re-run na primária merged conta (5/5 e 9/9). (6) Source em commits `feat(...)` (co-authored, d66fbe2 + 145774b via rebase+ff); fechamento de estado em commits `chore(project):` separados.
- **Single nextAction:** Rodar `phase-done` de F0: executar os verifiers dos exit-gates G-1 (`node --test tests/plan-branch-policy.test.js`) e G-2 (`node --test tests/focus-digest.test.js`), depois o gate `review-code` do diff de fase, gravar `reviewGate` no plan.md e avançar `currentPhase` para F1. NÃO auto-avançar — operator opt-in.
- **Verbatim state:** HEAD = `145774b`. Exit-gates F0: G-1 verifier `node --test tests/plan-branch-policy.test.js` (kind:test); G-2 verifier `node --test tests/focus-digest.test.js` (kind:shell). Ambos `status: pending` no frontmatter (serão resolvidos no phase-done). Telemetria: 2 registros novos em `.atomic-skills/status/dispatch-log.json` (T-001, T-002). Próxima fase: F1 (teardown seguro + oferta adjacente ao archive).
- **Uncommitted changes:** a commitar agora (chore): `.atomic-skills/.../f0-*.md` (T-002 done + evidence + rollups 2/2 + nextAction + este snapshot) e `.atomic-skills/status/dispatch-log.json` (registro T-002). Source de T-002 já em `145774b`.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
