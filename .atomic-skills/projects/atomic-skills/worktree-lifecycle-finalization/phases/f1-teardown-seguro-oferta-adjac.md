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
nextAction: "Dispatch T-002: oferta de teardown operator-prompted adjacente ao archive (project-transitions.md)"
parentPlan: worktree-lifecycle-finalization
phaseId: F1
tasksDone: 1
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
    status: pending
    lastUpdated: 2026-06-16T15:38:51.971Z
    summary: archive passa a oferecer teardown da worktree, sem mexer no status.
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
- **Narrative:** F1 em andamento, **1/2 tasks done**. **T-001 DONE**: invariante de teardown executado por Codex (Mode 2), merge-back auto-aprovado (modo serial consolidado), ff-merge na primária (`06009bb → 3a07fb6`), verifier `node --test tests/worktree-teardown.test.js` re-rodado na primária merged **8/8 exit 0** (auto-report Codex "tests 1" descartado por L-001), evidence escrita, rollups `tasksDone:1/2`, worktree+branch `impl/wlf-f1-t001` removidos. Próximo: T-002 (oferta de teardown no archive), auto-merge serial aprovado.
- **Decision log:** (1) F1 herda L-001: re-verificar na primária, nunca confiar no auto-report do Codex (confirmado de novo em T-001). (2) Auto-merge serial F1 aprovado pelo operador — T-002 mergeia sem re-prompt, mas SEMPRE serial + re-verify na primária (nada de batch concorrente). (3) T-002 toca só `project-transitions.md` (markdown), verifier é shell (grep âncora + npm run validate-skills); referencia o invariante de T-001 sem importá-lo. (4) Invariante P3 preservado no módulo (sem `-D`/`--force`/`rm -rf`; `shellQuote` adicionado contra injeção).
- **Single nextAction:** Dispatch F1 T-002 → editar `skills/shared/project-assets/project-transitions.md` seção `archive`: preservar a frase de flip zero-git + adicionar oferta de teardown operator-prompted ADJACENTE, gated por `scripts/worktree-teardown.js` (`isTeardownSafe`), documentando o desfecho `nothing-to-remove` para branch null. Verifier: `grep -q 'worktree-teardown' skills/shared/project-assets/project-transitions.md && grep -qi 'nothing-to-remove' skills/shared/project-assets/project-transitions.md && npm run validate-skills`.
- **Verbatim state:** HEAD `plan/worktree-lifecycle-finalization` = `3a07fb6` (após ff-merge T-001) + state-close de T-001 a commitar. F1 G-1 verifier `node --test tests/worktree-teardown.test.js`; F1 G-2 verifier = o shell grep+validate-skills acima. scopeBoundary T-002: NÃO automatizar; NÃO disparar integração de código no archive; NÃO alterar o flip de status (continua zero-git). Lane: `routing.json` mode2Enabled+codexLane.enabled.
- **Uncommitted changes:** a commitar agora (chore close T-001): F1 initiative (T-001 done + evidence + rollups + nextAction + este handoff) e `dispatch-log.json` (registro F1/T-001). Source de T-001 já em `3a07fb6`.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
