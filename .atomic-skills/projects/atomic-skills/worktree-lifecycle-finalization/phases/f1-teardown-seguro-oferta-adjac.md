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
nextAction: "Start T-001: Invariante de não-perda com base-ref ladder"
parentPlan: worktree-lifecycle-finalization
phaseId: F1
tasksDone: 0
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
    status: pending
    lastUpdated: 2026-06-16T15:38:51.971Z
    summary: Check que prova integração antes de remover; indeterminação bloqueia.
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
- **Narrative:** **F0 DONE e fase avançada para F1 (fronteira de fase, F1 recém-ativada, 0/2 tasks iniciadas).** F0 fechou com 2/2 tasks done (evidence), 2/2 gates met, `reviewGate: passed` (local, @ 4b8e9dd), lição L-001 ratificada, focus.json → F1. Tree limpa. F1 ainda NÃO começou — nenhuma task tocada. Lane Codex (Mode 2) segue on: F1 T-001 e T-002 são spec-ready com verifier determinístico ⇒ candidatas a Codex serial.
- **Decision log:** (1) F1 herda a lição L-001 (`list-lessons.js --phase F1`): nunca confiar no auto-report de contagem do Codex — re-verificar na primária merged. (2) F1 T-001 (`scripts/worktree-teardown.js` novo + teste) e T-002 (`project-transitions.md` archive offer) — T-002 depende do módulo de T-001, então serial T-001→T-002. (3) Invariante crítico de F1 (P3): teardown só remove com integração PROVADA (`git merge-base --is-ancestor`); indeterminação BLOQUEIA; nunca `-D`/`--force`/`rm -rf`.
- **Single nextAction:** Iniciar F1 T-001 "Invariante de não-perda com base-ref ladder" → criar `scripts/worktree-teardown.js` (`resolveBaseRef` ladder origin/main→main→null; `isTeardownSafe` bloqueia em null/não-ancestral, libera só com ancestral+base resolvida; branch `null` → `nothing-to-remove`) + `tests/worktree-teardown.test.js`. Verifier: `node --test tests/worktree-teardown.test.js`. Roteamento: Mode 2/Codex (spec-ready + verifier determinístico), worktree sob checkout primário, merge-back operator-prompted.
- **Verbatim state:** HEAD `plan/worktree-lifecycle-finalization` = (a commitar agora o phase-done de F0). F1 verifiers: T-001 `node --test tests/worktree-teardown.test.js`; T-002 `grep -q 'worktree-teardown' ... && grep -qi 'nothing-to-remove' ... && npm run validate-skills`. scopeBoundary T-001: NÃO git destrutivo no teste; NÃO tocar `archive` (T-002 faz a fiação); falha segura = BLOQUEAR. Lane: `routing.json` mode2Enabled+codexLane.enabled, minBatchTasks:1.
- **Uncommitted changes:** a commitar agora (chore phase-done): F0 initiative (done + gates met + evidence + self-review + handoff), `plan.md` (F0 done + reviewGate + currentPhase F1 + F1 active), F1 initiative (active + current + este handoff), lessons/f0 (novo), `focus.json` (→F1). Source de F0 já em 145774b.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
