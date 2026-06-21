---
schemaVersion: "0.2"
slug: worktree-lifecycle-finalization-f8-finalize-plan-aware-branch
projectId: atomic-skills
parentPlan: worktree-lifecycle-finalization
lessons:
  - id: L-001
    statement: >-
      Um work-order Mode-2 (Codex) cuja acceptance referencia um domínio de
      status/enum/lifecycle precisa fixar o enum COMPLETO mais a ordem mais o
      default fail-closed no próprio work-order. A T-001 especificou ORDER =
      ['active','archived'] para o ranking de lifecycle, omitindo done e paused do
      enum real (plan.schema.json enum active|paused|done|archived). O executor
      (Codex) implementou o contrato parcial fielmente — resultado:
      detectPlanStatusRegression com falso-positivo (done vs active) e
      falso-negativo (active vs done), e isTerminalPlan rejeitando um plano de
      status done. Os gates de review do phase-done (local L#1/L#2) pegaram.
    corrective: >-
      Quando a acceptance de um work-order Mode-2 toca um domínio de
      status/enum/lifecycle, ENUMERAR o enum schema COMPLETO no work-order e
      declarar a ORDEM mais o default fail-closed explicitamente; cross-check
      contra o *.schema.json ANTES do dispatch. Nunca deixar o executor inferir o
      domínio de um exemplo parcial — um exemplo parcial vira contrato.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      git f015e7c (local-review fixes); review-code local L#1/L#2 em
      scripts/finalize-plan-scope.js; plan.schema.json status enum
      active|paused|done|archived
    createdAt: 2026-06-19T18:42:34Z
    validatedAt: 2026-06-19T18:42:34Z
  - id: L-002
    statement: >-
      Num módulo guard/gate (cujo trabalho é BLOQUEAR), os bugs concentram nos
      caminhos fail-OPEN sobre input indeterminado — não no happy-path. Os 4
      findings do codex mais 2 dos 4 locais foram fail-OPEN em
      scripts/finalize-plan-scope.js: plano active com phases ausente/vazio/não-array
      PROSSEGUIA (tratado como todas done), slug duplicado pegava o primeiro match,
      irmão paused não-avisado apesar do contrato de non-archived siblings, e (no
      doc) ref local-only aceito como base de PR. Happy-path mais blocos óbvios
      tinham teste; os caminhos indeterminados não.
    corrective: >-
      Para qualquer módulo guard/gate, o spec (suíte de teste) E o checklist de
      review devem enumerar EXPLICITAMENTE a matriz de input indeterminado/malformado
      (ausente/vazio/não-array/ambíguo/desconhecido/local-only) e asserir que CADA UM
      bloqueia (fail-closed). Adicionar uma matriz fail-closed ao spec do guard —
      testar o happy-path mais o bloqueio óbvio não basta.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      git 00dd0cd (codex-review fixes); review-code codex F-001/F-002/F-003/F-004 mais
      local L#4; .atomic-skills/reviews/2026-06-19-1803-wlf-f8-finalize-plan-aware.md
    createdAt: 2026-06-19T18:42:34Z
    validatedAt: 2026-06-19T18:42:34Z
---

# Lessons — F8 Finalize plan-aware — branch ≠ plano (worktree-lifecycle-finalization)

Distiladas no phase-done de F8 a partir de sinal real: o gate review-code (mode
`both`) sobre o diff da fase pegou 8 findings reais — 4 locais (L#1/L#2 ranking de
status incompleto + done-não-terminal; L#3 divergência transitória de estado;
L#4 target ecoado) e 4 codex DISJUNTOS (F-001 phases vazio fail-open, F-002 slug
ambíguo fail-open, F-003 irmão paused não-avisado, F-004 ref local-only aceito).
Quase todos fail-OPEN num módulo cujo trabalho é BLOQUEAR — daí L-002. Todos
corrigidos e re-verificados (24/24 testes; validate-skills 15/15). Os 2 exit-gates
(G-1 test 24/24, G-2 grep+validate-skills) passaram; reviewGate `both` @ 00dd0cd.

**Recorrência observada (não nova lição):** o auto-report `ℹ tests N` do Codex
voltou a ser não-confiável (reportou `tests 1`; a suíte real tinha 16) — a mesma
lição já registrada em
`lessons/worktree-lifecycle-finalization-f0-nascimento-da-branch-sob-con.md`. O
corrective dela segurou: re-rodei o verifier determinístico na primária MERGED e a
contagem real (16, depois 24) veio dali, não do summary do Codex. Nenhuma nova lição
necessária.

`scope: reusable` + `status: open` ⇒ dispostas no início de cada fase futura via
`node scripts/list-lessons.js --phase <id>`.
