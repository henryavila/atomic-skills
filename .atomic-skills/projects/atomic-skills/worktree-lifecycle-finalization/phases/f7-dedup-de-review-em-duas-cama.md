---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f7-dedup-de-review-em-duas-cama
title: Dedup de review em duas camadas (Decisão 8)
goal: "eliminar re-review redundante sob worktrees paralelas — Camada A: um
  ledger de superfície unificado (`last-review.json` de ponteiro→conjunto, chave
  SHA+patch-id) que `review-code` e `review-due` leem/gravam por modo; Camada B:
  um run-record do composer `project review`, entregue como work-order ao autor
  da skill (vive em outra branch). Ambos falham-para-RE-revisar."
status: active
branch: plan/worktree-lifecycle-finalization
started: 2026-06-17T21:45:00Z
lastUpdated: 2026-06-17T21:45:00Z
nextAction: "Start T-001: Ledger de superfície em last-review.json
  (ponteiro→conjunto) + adaptador de migração"
parentPlan: worktree-lifecycle-finalization
phaseId: F7
tasksDone: 0
tasksTotal: 4
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: Ledger ponteiro→conjunto com migração fail-safe, append,
      alreadyReviewed só com prova positiva, e oráculo de patch-id sob squash;
      suite verde.
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/review-ledger.test.js
    verifierLabel: "test: node tests/review-ledger.test.js"
  - id: G-2
    description: review-code e review-due documentam o dedup (âncora review-dedup,
      fail-para-RE-revisar); work-order ao autor do project review presente
      (Camada B); skills válidos.
    status: pending
    verifier:
      kind: shell
      command: grep -qi 'review-dedup' skills/core/review-code.md && grep -qi
        'review-dedup' skills/shared/project-assets/project-drift.md && grep -qi
        'project-review-dedup'
        .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/workorders/project-review-dedup.md
        && npm run validate-skills
    verifierLabel: "shell: grep -qi 'review-dedup' skills/core/review-code.md && grep …"
stack:
  - id: 1
    title: Dedup de review em duas camadas (Decisão 8)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: Ledger de superfície em last-review.json (ponteiro→conjunto) + adaptador
      de migração
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
    summary: last-review.json de ponteiro para conjunto append-only, com migração
      fail-safe.
    outputs:
      - kind: file
        path: scripts/review-ledger.js
      - kind: test
        path: tests/review-ledger.test.js
    scopeBoundary:
      - append-only (compatível com o `merge=union` da F5)
      - NÃO escrever do composer `project review` (Camada B é via work-order)
      - um `last-review.json` em ponteiro/ausente é lido como "nada revisado"
        (fail-safe → re-revisa), nunca crasha
      - o módulo é função pura sobre o conteúdo do ledger injetado.
    acceptance:
      - '`readLedger` lê um `last-review.json` no novo formato-conjunto E migra
        um ponteiro legado (`{lastReviewedCommit,…}`) ou um arquivo ausente para
        "nenhuma superfície revisada" (fail-safe), com bump de `schemaVersion`'
      - "`recordReview` faz append de um registro `{commitSha, patchId, mode,
        reviewedAt, reviewFile}` sem reescrever entradas prévias"
      - "`alreadyReviewed(range, mode)` só retorna verdadeiro com prova POSITIVA
        (SHA no ledger no MESMO modo, ou patchId casa), retornando falso na
        dúvida"
      - o módulo não muta o input.
    verifier:
      kind: test
      runner: node
      pattern: tests/review-ledger.test.js
  - id: T-002
    title: Dedup em review-code e review-due (por modo, fail-para-RE-revisar)
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
    summary: Dedup por modo em review-code e review-due, fail-para-RE-revisar.
    outputs:
      - kind: file
        path: skills/core/review-code.md
      - kind: file
        path: skills/shared/project-assets/project-drift.md
    scopeBoundary:
      - dedup por modo (uma passada local não dispensa a codex)
      - falha-para-RE-revisar (só pula com prova positiva)
      - NÃO editar `skills/shared/project-assets/project-review.md` (Camada B,
        via work-order ao autor — vive em outra branch)
      - a perna de código defere ao ledger de T-001.
    acceptance:
      - "`review-code.md` documenta que a passada local lê o ledger antes (faixa
        a revisar = pedido − superfície já-revisada no modo local) e grava o
        registro depois, com a âncora `review-dedup`"
      - "`project-drift.md` documenta o mesmo para o `review-due` (codex) e
        generaliza o `last-review.json` de ponteiro para o conjunto-ledger"
      - ambos registram a regra fail-para-RE-revisar
      - "`npm run validate-skills` passa."
    verifier:
      kind: shell
      command: grep -qi 'review-dedup' skills/core/review-code.md && grep -qi
        'review-dedup' skills/shared/project-assets/project-drift.md && npm run
        validate-skills
  - id: T-003
    title: Teste-oráculo de patch-id sob squash
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
    summary: "Teste-oráculo: patch-id casa o dedup sob squash; miss re-revisa."
    outputs:
      - kind: test
        path: tests/review-ledger.test.js
    scopeBoundary:
      - cobre só o casamento de dedup (não o teardown da D4)
      - usa diffs/patch-ids injetados (não roda git real)
      - o miss de patch-id resulta em RE-revisar (seguro), nunca em pular.
    acceptance:
      - ORÁCULO — uma superfície squash-merged cujo `patchId` casa um registro
        do ledger é reconhecida como já-revisada (dedup acerta apesar do SHA
        reescrito)
      - um `patchId` que NÃO casa resulta em `alreadyReviewed=false` (RE-revisa,
        fail-safe)
      - um SHA reescrito sem patch-id no ledger também resulta em RE-revisar.
    verifier:
      kind: test
      runner: node
      pattern: tests/review-ledger.test.js
  - id: T-004
    title: Work-order ao autor do project review (Camada B)
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
    summary: Gera o work-order ao autor do project review (run-record do composer).
    outputs:
      - kind: file
        path: .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/workorders/project-review-dedup.md
    scopeBoundary:
      - NÃO editar `project-review.md` desta branch (ele vive na branch
        F4-skills)
      - o work-order só DESCREVE a mudança para o autor da skill
      - carrega os guardrails de skill-authoring (vars de tool, validate-skills,
        compat cross-agent) e o carve-out append-only à política READ-ONLY do
        composer.
    acceptance:
      - o work-order documenta o run-record por-perna do composer
        (`{auditedHead, auditedPlanSha, tree-clean, verdito, fingerprint}` no
        MESMO `last-review.json`), o carve-out append-only EXPLÍCITO à política
        READ-ONLY, o reuse-por-perna só com prova de input idêntico (a perna de
        código defere ao ledger da Camada A), e a guarda de
        shape-conjunto-ausente (lê como "nada auditado", fail-para-RE-rodar) que
        torna a ordem cross-branch mecânica
      - carrega os guardrails de skill-authoring
      - com a âncora `project-review-dedup`.
    verifier:
      kind: shell
      command: grep -qi 'project-review-dedup'
        .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/workorders/project-review-dedup.md
        && grep -qi 'append-only'
        .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/workorders/project-review-dedup.md
parked: []
emerged: []
summary: "Evita re-revisar o já-revisado: ledger de superfície nas pernas +
  run-record do composer."
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F7 — Dedup de review em duas camadas (Decisão 8)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
