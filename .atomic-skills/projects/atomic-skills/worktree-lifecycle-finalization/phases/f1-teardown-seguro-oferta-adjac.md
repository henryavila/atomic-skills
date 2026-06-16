---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f1-teardown-seguro-oferta-adjac
title: Teardown seguro + oferta adjacente ao archive (Decisões 3+4)
goal: fixar o invariante machine-enforced de não-perda-de-trabalho no teardown
  (com base-ref ladder) e oferecer o teardown operator-prompted adjacente ao
  `archive`, sem alterar o flip de status (que continua zero efeito git).
status: active
branch: plan/worktree-lifecycle-finalization
started: 2026-06-16T15:05:46.324Z
lastUpdated: 2026-06-16T17:31:21.000Z
nextAction: "F1: todas as tasks done — rodar phase-done (gates G-1/G-2 + review-code) para verificar e avançar a F2."
parentPlan: worktree-lifecycle-finalization
phaseId: F1
tasksDone: 2
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: Invariante prova integração antes de remover; indeterminação
      bloqueia; sem -D/--force/rm -rf; suite verde.
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/worktree-teardown.test.js
    verifierLabel: "test: node tests/worktree-teardown.test.js"
  - id: G-2
    description: Oferta de teardown (âncora worktree-teardown) + desfecho
      nothing-to-remove presentes no archive; flip zero-git; skills válidos.
    status: pending
    verifier:
      kind: shell
      command: grep -q 'worktree-teardown'
        skills/shared/project-assets/project-transitions.md && grep -qi
        'nothing-to-remove' skills/shared/project-assets/project-transitions.md
        && npm run validate-skills
    verifierLabel: "shell: grep -q 'worktree-teardown' skills/shared/project-assets/pr…"
stack:
  - id: 1
    title: Teardown seguro + oferta adjacente ao archive (Decisões 3+4)
    type: task
    openedAt: 2026-06-16T15:05:46.324Z
tasks:
  - id: T-001
    title: Invariante de não-perda com base-ref ladder
    status: done
    closedAt: 2026-06-16T17:59:33.000Z
    lastUpdated: 2026-06-16T17:59:33.000Z
    summary: Check que prova integração antes de remover; indeterminação bloqueia.
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-16T17:59:33.000Z
      passed: true
      exitCode: 0
      testsCollected: 8
      outputSummary: node --test tests/worktree-teardown.test.js → tests 8 / pass 8 /
        fail 0 (exit 0); re-run na primária MERGED (HEAD 3a07fb6) após ff-merge
        de impl/wlf-f1-t001. Cobre resolveBaseRef ladder
        (origin/main→main→null), isTeardownSafe (block
        indeterminate/not-integrated, safe só ancestral, nothing-to-remove sem
        git call em branch null) + no-forbidden-tokens (-D/--force/rm -rf).
    outputs:
      - kind: file
        path: scripts/worktree-teardown.js
      - kind: test
        path: tests/worktree-teardown.test.js
    scopeBoundary:
      - NÃO executar git destrutivo no teste
      - NÃO tocar o `archive` ainda (T-002 faz a fiação)
      - a falha segura é BLOQUEAR, nunca over-deletar.
    acceptance:
      - "`resolveBaseRef` prefere `origin/main` fresco quando presente, cai para
        `main` local, e retorna `null` (indeterminado) quando nenhum resolve"
      - "`isTeardownSafe` bloqueia em base-ref indeterminada (`null`), bloqueia
        quando a branch não é ancestral da base, e libera só quando é ancestral
        E a base resolveu"
      - "um plano com branch ausente/`null` retorna `{ outcome:
        'nothing-to-remove' }` — `isTeardownSafe` não invoca `merge-base`/`git
        branch -d` numa branch inexistente, não bloqueia e não erra"
      - o módulo não contém token `-D`, `--force` nem `rm -rf`.
    verifier:
      kind: test
      runner: node
      pattern: tests/worktree-teardown.test.js
  - id: T-002
    title: Oferta de teardown operator-prompted adjacente ao archive
    status: done
    closedAt: 2026-06-16T18:07:28.000Z
    lastUpdated: 2026-06-16T18:07:28.000Z
    summary: archive passa a oferecer teardown da worktree, sem mexer no status.
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T18:07:28.000Z
      passed: true
      exitCode: 0
      outputSummary: "grep -q 'worktree-teardown' ... && grep -qi 'nothing-to-remove'
        ... && npm run validate-skills → exit 0 (15 skills válidos) na primária
        MERGED (HEAD 0a098bf) após ff-merge de impl/wlf-f1-t002. Diff revisado
        (verifier de âncora é fraco): oferta operator-prompted/never-automatic
        gated por isTeardownSafe, flip zero-git preservado, nothing-to-remove
        documentado, sem --force/-D."
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
    scopeBoundary:
      - NÃO automatizar
      - NÃO disparar integração de código no evento de arquivar
      - "NÃO alterar o flip de status (continua `status: archived` com zero
        efeito git)."
    acceptance:
      - a seção `archive` preserva a frase de que o plano é arquivado in-place
        com zero efeito git
      - adiciona uma oferta de teardown operator-prompted ADJACENTE ao flip,
        gated pelo invariante de `scripts/worktree-teardown.js`
      - para um plano com branch `null`/sem worktree, a seção documenta o
        desfecho `nothing-to-remove` (sem prompt de teardown, flip de status
        ainda zero-git)
      - "`grep` confirma a âncora `worktree-teardown` e `npm run
        validate-skills` passa."
    verifier:
      kind: shell
      command: grep -q 'worktree-teardown'
        skills/shared/project-assets/project-transitions.md && grep -qi
        'nothing-to-remove' skills/shared/project-assets/project-transitions.md
        && npm run validate-skills
parked: []
emerged: []
summary: Remover worktree só com integração provada; oferta de teardown no archive.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Teardown seguro + oferta adjacente ao archive (Decisões 3+4)**.

## Session handoff
- **Narrative:** **F1 com TODAS as tasks done (2/2) — fronteira de fase.** T-001 (invariante `scripts/worktree-teardown.js`) e T-002 (oferta de teardown no `archive` em `project-transitions.md`) executadas por Codex (Mode 2), auto-merge serial, cada uma ff-merge + re-verificada na primária merged (T-001 8/8 @ `3a07fb6`; T-002 shell exit 0 @ `0a098bf`). Gates G-1 (8/8) e G-2 (shell exit 0) confirmados verdes na primária. Falta apenas `phase-done` de F1 (carimbar gates + reviewGate review-code + avançar a F2) — operator-opt-in.
- **Decision log:** (1) L-001 confirmada de novo (Codex "tests 1" ≠ realidade) nas 2 tasks. (2) Auto-merge serial F1 (operator-aprovado) — sempre serial + re-verify na primária, nunca batch. (3) T-002 verifier é grep de âncora (FRACO) → compensado por review do diff de Opus (oferta operator-prompted, gated por isTeardownSafe, flip zero-git intacto, sem `--force`/`-D`). (4) Source em commits `feat` (co-authored): T-001 `3a07fb6`, T-002 `0a098bf`.
- **Single nextAction:** Rodar `phase-done` de F1: carimbar G-1 (test 8/8) e G-2 (shell exit 0) como met com evidence; rodar `review-code` (modo local) sobre o diff de fase de F1; gravar `reviewGate` no plan.md fase F1; destilar lessons; avançar `currentPhase` F1→F2. NÃO auto-avançar.
- **Verbatim state:** HEAD `plan/worktree-lifecycle-finalization` = `0a098bf` (após ff-merge T-002) + state-close de T-002 a commitar. F1 G-1 verifier `node --test tests/worktree-teardown.test.js` (8/8, exit 0); F1 G-2 verifier `grep -q 'worktree-teardown' skills/shared/project-assets/project-transitions.md && grep -qi 'nothing-to-remove' skills/shared/project-assets/project-transitions.md && npm run validate-skills` (exit 0). Próxima fase: F2 (integração topology-aware: classificador de disjunção por footprint).
- **Uncommitted changes:** a commitar agora (chore close T-002): F1 initiative (T-002 done + evidence + rollups 2/2 + nextAction + este handoff) e `dispatch-log.json` (registro F1/T-002). Source de T-002 já em `0a098bf`.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
