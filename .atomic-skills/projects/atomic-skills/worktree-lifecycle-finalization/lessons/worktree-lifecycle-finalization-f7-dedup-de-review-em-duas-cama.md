---
schemaVersion: "0.2"
slug: worktree-lifecycle-finalization-f7-dedup-de-review-em-duas-cama
projectId: atomic-skills
parentPlan: worktree-lifecycle-finalization
lessons:
  - id: L-001
    statement: >-
      A T-002 generalizou `last-review.json` de um pointer único para um set-ledger NDJSON
      NA PROSA, mas deixou QUATRO leitores `jq '.lastReviewedCommit'` (a linha CODEX REVIEW,
      o `<base>` do review-due, a integração phase-done, e o archive-gate de
      project-transitions.md) na forma antiga, e hand-waveou um "mirror" que o `recordReview`
      não produz (um record NDJSON não tem `lastReviewedCommit` top-level). Tanto o pass
      local quanto o Codex blind pegaram (C5/L1) — o finding cross-doc mais forte do plano
      (os DOIS modelos viram). 3ª recorrência da classe produtor/consumidor neste plano
      (wlf-f3 L-003 overclaim de closure; wlf-f4 L-002 fechar follow-up rasga o anúncio).
    corrective: >-
      Ao mudar o FORMATO de um arquivo de dado ou um contrato compartilhado, ENUMERE cada
      leitor/escritor dele (grep o campo/o arquivo) ANTES de alegar coerência; então migre
      TODOS em LOCKSTEP, ou DEFIRA o flip explicitamente — os leitores ficam na forma antiga
      e o caminho novo fica inerte-mas-seguro (aqui: `readLedger` migra um pointer → [], então
      o dedup nunca dá falso-skip enquanto o arquivo ainda é pointer). Uma frase
      "mirror"/"kept for back-compat" SEM implementação é o tell de uma migração não-verificada
      — risque-a e substitua pela enumeração lockstep/deferral concreta. Um contrato de dado
      tem produtor E consumidores; mudá-lo sem enumerar os consumidores é a mesma classe de
      bug que muda referência sem rastrear o ripple (wlf-f0 L-001). Locus:
      project-drift.md State-file ⚠️ note + review-code.md Step 0.5 (record-after).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    recurrenceOf: worktree-lifecycle-finalization-f4-check-de-colisao-cross-wt-no/L-002
    evidence: >-
      .atomic-skills/reviews/2026-06-17-2300-wlf-f7-dedup-review-ledger.md (codex C5 + local
      L1, cross-model agreement); skills/shared/project-assets/project-drift.md (State-file
      deferred-flip note + review-due step 5); skills/core/review-code.md Step 0.5; fix 83d2ee1
    createdAt: 2026-06-17T23:00:00Z
    validatedAt: 2026-06-17T23:00:00Z
  - id: L-002
    statement: >-
      `review-ledger.js` era puro e tratava conteúdo ausente/legacy/linha-malformada
      fail-safe, e o pass local julgou pureza/never-throws "clean". O Codex blind achou
      QUATRO majors de input adversarial que o happy-path perdeu: (C2) um record NDJSON de
      uma linha carregando `lastReviewedCommit` era misclassificado como pointer e dropado;
      (C3) um record PARCIAL (`{mode, commitSha}` sem `patchId`) era contado como prova
      positiva — um modo de falha DISTINTO de "ausente"; (C4) um getter que throwa em `range`
      quebrava o contrato never-throws; (C1) `content.trimEnd()` corrompia a byte-preservação
      de uma última linha com trailing whitespace. 7ª fase consecutiva (wlf-f1..f6) em que o
      cross-model pega o que o mesmo-modelo racionaliza.
    corrective: >-
      Para um módulo fail-safe / never-throws / prova-positiva, o CONTRATO é definido pelo
      espaço de input ADVERSARIAL, não pelo happy-path: (a) prova-positiva exige um record
      COMPLETO e bem-formado (rejeite parcial — um record parcial é um modo de falha distinto
      de ausente, e "na dúvida, re-revisa"); (b) never-throws tem que sobreviver a input
      HOSTIL (getter que throwa → try/catch top-level, não só type-guards); (c)
      byte-preservação tem que ser literal (sem `trimEnd` que altera bytes do payload).
      Enumere essas classes na acceptance da SPEC + nos testes, e rode `review-code
      --mode=both` — o cross-model acha os inputs adversariais que o autor não imaginou.
      Sharpeniza wlf-f4 L-001 (espaço-negativo é a feature): aqui o espaço-negativo inclui
      o PARCIAL e o HOSTIL, não só o ausente. Locus: scripts/review-ledger.js (isValidRecord,
      try/catch, endsWith append).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    recurrenceOf: worktree-lifecycle-finalization-f4-check-de-colisao-cross-wt-no/L-001
    evidence: >-
      .atomic-skills/reviews/2026-06-17-2300-wlf-f7-dedup-review-ledger.md (codex blind C1-C4
      major, local julgou logic "clean"; informed pass-2 clean emerged 0);
      scripts/review-ledger.js (isValidRecord gate, alreadyReviewed try/catch, byte-preserving
      recordReview); tests/review-ledger.test.js 13→20; fix 83d2ee1
    createdAt: 2026-06-17T23:00:00Z
    validatedAt: 2026-06-17T23:00:00Z
---

# Lessons — F7 dedup de review em duas camadas (worktree-lifecycle-finalization)

Distiladas no phase-done de F7 (a ÚLTIMA fase do plano) a partir do review-gate `--mode=both`
sobre o diff de código da fase (`scripts/review-ledger.js` novo + teste + `review-code.md`
Step 0.5 + `project-drift.md`). Foi a rodada mais pesada do plano: o pass local achou 1 major
(doc produtor/consumidor) + 1 minor + 2 nit e julgou a LÓGICA do módulo "clean"; o Codex blind
achou 5 major (4 de lógica adversarial C1-C4 + o doc C5) + 1 minor; o informed pass-2 confirmou
todos fechados, emerged 0 (verdict clean). Fixes em `83d2ee1`; suite 13→20.

**`--mode=both`, 7ª fase consecutiva (a evidência definitiva):** desta vez o local declarou a
lógica "clean" e o cross-model achou QUATRO majors de lógica nela. O padrão wlf-f1..f7 L-001 é
overwhelming: para mudança de contrato/lógica/fail-safe, o cross-model não é opcional.

**Recorrência produtor/consumidor (L-001, 3ª vez):** wlf-f3 L-003 → wlf-f4 L-002 → wlf-f7 L-001.
A lição "um contrato tem dois lados; mude um, reconcilie/enumere o outro" ainda não grudou
totalmente — desta vez foram QUATRO leitores deixados para trás. Reforço: enumerar os leitores
(grep) é o gate, e "mirror" sem implementação é o tell.

**Espaço-negativo expandido (L-002):** wlf-f4 L-001 era "o espaço-negativo é a feature"; F7
mostra que o espaço-negativo de um módulo fail-safe inclui o PARCIAL (record incompleto) e o
HOSTIL (getter que throwa), não só o ausente — três sub-classes que o happy-path + mesmo-modelo
racionalizam juntos.
