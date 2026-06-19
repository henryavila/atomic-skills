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
nextAction: "PHASE BOUNDARY — F7 tasks 4/4 DONE (gates 0/2 pending). Próximo
  (operator-prompted): phase-done F7 — exit-gates G-1 (node --test review-ledger) +
  G-2 (grep review-dedup ×2 + project-review-dedup + validate-skills), review-code
  --mode=both no diff da fase, distila lessons, grava reviewGate. F7 é a ÚLTIMA fase
  → o phase-done fecha o PLANO inteiro (F0–F7); depois: finalize/archive do plano."
parentPlan: worktree-lifecycle-finalization
phaseId: F7
tasksDone: 4
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
    status: done
    closedAt: 2026-06-17T22:00:00Z
    lastUpdated: 2026-06-17T22:00:00Z
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
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T22:00:00Z
      exitCode: 0
      testsCollected: 10
      passed: true
      outputSummary: "node --test tests/review-ledger.test.js @ 2c4ca99 (merged primary):
        tests 10, pass 10, fail 0. Módulo puro review-ledger.js (readLedger/recordReview/
        alreadyReviewed) NDJSON, fail-safe em pointer-legado/ausente/malformado,
        recordReview preserva prior bytes (union-safe), alreadyReviewed só prova positiva
        (mode + SHA-ou-patchId squash-safe). Mode 2 Codex (impl/wlf-f7-t-001, ff 2c4ca99);
        auto-report -o 'tests 1' DESCARTADO per wlf-f0-nascimento L-001 (real 10); fence
        source-only; last-review.json vivo + merge=union deferidos ao wiring (T-002+)."
  - id: T-002
    title: Dedup em review-code e review-due (por modo, fail-para-RE-revisar)
    status: done
    closedAt: 2026-06-17T22:15:00Z
    lastUpdated: 2026-06-17T22:15:00Z
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
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T22:15:00Z
      exitCode: 0
      passed: true
      outputSummary: "grep -ci 'review-dedup' → review-code.md 2, project-drift.md 2;
        npm run validate-skills → All 15 skills valid, exit 0. review-code.md Step 0.5
        (review-dedup): fingerprint commitSha+patch-id, skip per-mode só com prova
        positiva (alreadyReviewed), record após via recordReview; project-drift.md
        generaliza last-review.json pointer→NDJSON set-ledger (readLedger migra o pointer
        legado fail-safe) e wira o review-due ao dedup codex + recordReview append.
        Mode 1 inline (doc auto-referencial), defere ao ledger da T-001. validate-state 0."
  - id: T-003
    title: Teste-oráculo de patch-id sob squash
    status: done
    closedAt: 2026-06-17T22:30:00Z
    lastUpdated: 2026-06-17T22:30:00Z
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
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T22:30:00Z
      exitCode: 0
      testsCollected: 13
      passed: true
      outputSummary: "node --test tests/review-ledger.test.js @ HEAD: tests 13, pass 13,
        fail 0 (10 da T-001 + 3 do oráculo T-003). Oráculo patch-id sob squash: superfície
        squash-merged com patchId casando → reconhecida (apesar do SHA reescrito); patchId
        não-casa → RE-revisa; SHA reescrito SEM patch-id usável (query sem patchId, ou
        record sem patchId) → RE-revisa (fail-safe). Diffs/patch-ids injetados, não roda
        git real. Mode 1 inline (+= no arquivo de teste da T-001)."
  - id: T-004
    title: Work-order ao autor do project review (Camada B)
    status: done
    closedAt: 2026-06-17T22:45:00Z
    lastUpdated: 2026-06-17T22:45:00Z
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
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T22:45:00Z
      exitCode: 0
      passed: true
      outputSummary: "grep -ci 'project-review-dedup' (4) && grep -ci 'append-only' (3) em
        workorders/project-review-dedup.md, exit 0. Work-order cross-branch (Opus-owned,
        NÃO edita project-review.md que vive na branch F4-skills): documenta o run-record
        por-perna do composer ({auditedHead, auditedPlanSha, treeClean, verdict,
        fingerprint} no MESMO last-review.json via recordReview), o carve-out append-only
        EXPLÍCITO à política READ-ONLY, reuse-por-perna só com prova de input idêntico (a
        perna de código defere ao ledger da Camada A), e a guarda absent-set-shape
        (fail-para-RE-rodar) + guardrails de skill-authoring. Mode 1 (Opus, state-tree).
        validate-state 65 files valid."
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

## Session handoff
- **Narrative:** **F7 — tasks 4/4 DONE** (T-001 ledger + T-002 wiring + T-003 patch-id oráculo + T-004 work-order Camada B). PHASE BOUNDARY (gates 0/2, resolvem no phase-done). Em andamento
  (última fase do plano). T-001 em **Mode 2/Codex**: módulo puro `scripts/review-ledger.js`
  (`readLedger`/`recordReview`/`alreadyReviewed`, NDJSON, fail-safe) + teste (10 casos),
  ff-merged `2c4ca99`, re-verificado na primária 10/10. T-002 em **Mode 1 inline** (doc
  auto-referencial): `review-code.md` Step 0.5 `review-dedup` (skip per-mode só com prova
  positiva, record após) + `project-drift.md` generaliza `last-review.json` pointer→NDJSON
  set-ledger e wira o `review-due`; verifier shell exit 0 (grep ×2/×2 + validate-skills).
- **Decision log:** (1) Formato do ledger = **NDJSON** (não array/objeto) — grounding L-002
  + lição F5 (union lossless só line-oriented). (2) `recordReview` preserva prior bytes
  (union-safe); pointer-legado/ausente → fresh ledger (fail-safe re-review). (3) Auto-report
  `-o` do Codex "tests 1" DESCARTADO — real 10 (wlf-f0 L-001, 4ª vez no plano). (4) O flip
  do `last-review.json` vivo p/ NDJSON + o `merge=union` no `.gitattributes` ficam DEFERIDOS
  ao wiring (T-002+) — unir o pointer-objeto agora cairia no trap F5.
- **Single nextAction:** **(operator-prompted)** Rodar `phase-done F7` — exit-gates G-1
  (`node --test tests/review-ledger.test.js`, 13/13) + G-2 (grep `review-dedup` em
  review-code.md/project-drift.md + `project-review-dedup` no work-order + validate-skills),
  `review-code --mode=both` no diff de código da fase, distila lessons, grava `reviewGate`.
  F7 é a ÚLTIMA fase → o phase-done leva o `currentPhase` ao fim e o PLANO (F0–F7) fica
  pronto para `finalize` (publica PR feature→develop) e depois `archive`.
- **Verbatim state:** Commits F7: `2c4ca99` (feat Codex T-001, ff), próximo:
  `chore(project): done F7/T-001`. Worktree `impl/wlf-f7-t-001` a remover pós-commit.

## Decisions

- **Formato do ledger = NDJSON (não array/objeto-com-array):** o scopeBoundary pede
  "append-only compatível com o merge=union da F5", e a lição F5 é que union é lossless
  só line-oriented → NDJSON (1 registro por linha). `recordReview` preserva os bytes das
  linhas prévias (só normaliza trailing newline) pra o union-merge concorrente ficar
  lossless. Pointer-legado/ausente/malformado → "nada revisado" (fail-safe re-review).
- **`merge=union` do last-review.json DEFERIDO:** o arquivo vivo só vira NDJSON quando o
  `recordReview` for wirado (T-002+); adicionar `merge=union` enquanto ainda é um objeto
  pointer cairia no trap F5. Fica como follow-up do flip de formato.

## Links

_(plan doc, external refs)_
