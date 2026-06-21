---
date: 2026-06-17T14:02:37-03:00
topic: deadline-burnup-forecast
artifact: .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/plan.md (+ source.md) — REV2 after first re-spec
skill: review-plan
reviewer: gpt-5-codex
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 6, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 5, minor: 0, nit: 0}
framing_delta: {dropped: 1, maintained: 5, emerged: 1}
mode: codex
schema_version: "1.0"
---

# Cross-Model Re-Review (REV2) — deadline-burnup-forecast

Second codex envelope, run on the CLEANED plan after the first re-spec (commit cede1c3). Sealed: the briefing did NOT mention the prior review or fixes.

## Outcome + remediation (all applied in commit following this file)

- **F-002 (correctness, REAL BUG from design D5)** — planned line was weightTotal→0 (burn-DOWN) in a burn-UP/SPI chart → SPI inverted. FIXED: planned value 0→weightTotal (rising); F3/T-002 + goal + design-divergence note.
- **F-003 (basis reconciliation)** — count vs proxy mixed-scale in earned/SPI undefined. FIXED (user decision: two separate series): F3/T-002 emits plannedValue + earnedCount + earnedProxy; SPI per basis (spiProxy comparable, spiCount informative); F5 line-chart gets 3 tracks.
- **F-005 (flip has no implementer)** — closedAtHardening was read by the validator but no task wrote it. FIXED: F4/T-003 adds scripts/harden-closedat.js + tests/harden-closedat.test.js (idempotent flip computing grandfatheredTaskIds + enforcedFrom).
- **F-001 (F0 gate wiring)** — REFINED critical→major. FIXED: F0 gate now also runs the T-003 grep wiring check (defense-in-depth; note: per-task closure already runs it at T-003 done).
- **F-004 (F4 gate)** — omitted append-completion-dispatchlog.test.js. FIXED: added to F4 gate.
- **F-006 (F1 gate, EMERGED)** — omitted schema-drift.test.js. FIXED: added to F1 gate.
- **F-002-blind (weight producer) → DROPPED by codex** under the constraint that weight is AI-authored at Stage 6 + auditor-enforced (like summaries).

Calibration: F-001/F-004/F-006 are "phase gate omits a task's verifier" — in the atomic-skills model each task's verifier runs at its own `done` (verify-on-done), so the wiring/schema-drift IS gated at task close; adding to the phase gate is cheap defense-in-depth against later-task regressions, not a hole. Applied anyway.

Post-fix validation: validate-state 7/7 GREEN, validate-aideck-state GREEN, gate commands parse as YAML.

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has substantive gaps in the executable path from state transitions to analytics events, the weight model, and phase gates. Several gates can pass while required behavior remains absent, and the burn-up/SPI definition contains a math-direction error that would produce misleading output.

## Findings

### F-001 [critical] coverage — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:39-60

**Evidence:**
```md
### T-003 — Emitir o evento nas transições done/phase-done/reconcile
Liga o append-completion aos três pontos de mutação que já carimbam conclusão na skill (done, phase-done bulk-close, reconcile), no mesmo instante da transição.
Files: skills/shared/project-assets/project-transitions.md
scopeBoundary: edição de instrução de skill (prosa executada pelo modelo); não cria novo comando; um append por task fechada (phase-done em lote = N appends), nunca um <now> compartilhado.
acceptance: project-transitions.md instrui append-completion no passo done; instrui um append por task no phase-done bulk-close; instrui append no reconcile.
verifier: kind shell — grep -c "append-completion" skills/shared/project-assets/project-transitions.md | grep -qE "^[3-9]|[0-9]{2,}"

### T-004 — Harness de integração: a transição emite o evento (prova comportamental do RED)
Teste que exercita a emissão do jeito que project-transitions.md a documenta — invoca o appendCompletion como a transição invoca — e asserta o crescimento append-only do completions.jsonl.
```

**Claim:** F0 can pass without proving that the real `done`, `phase-done`, and `reconcile` transition instructions were changed to emit completion events.

**Impact:** The helper and simulated harness can pass while actual project operations still do not append to `completions.jsonl`, leaving the burn-up/SPI pipeline with no real earned-flow data.

**Recommendation:** Add the T-003 transition-instruction verifier to the F0 exit gate and make `emit-on-transition.test.js` verify the actual transition integration point, or introduce an executable transition adapter used by both the skill instructions and the test.

**Confidence:** high

---

### F-002 [major] contradiction — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:98-121

**Evidence:**
```md
Goal: introduzir tasks[].weight (number, opcional, default=1) derivado por proxy estrutural no decompose, com rollups weightDone/weightTotal espelhando tasksDone/tasksTotal — admitidos no schema source E na projeção emitida.
...
scopeBoundary: read-only; não atribui weight sozinho (o texto/proxy é autorado na skill); não toca src/decompose.js (congelado, R-ORCH-10).
acceptance: lista tasks sem weight e sai não-zero quando há ao menos uma; project-create-plan.md Stage 6 referencia o auditor como ponto de atribuição do weight.
```

**Claim:** F2 says weights are derived “no decompose” while the only assignment task forbids touching `src/decompose.js` and creates only an auditor plus prose hook.

**Impact:** One implementer may edit the frozen decompose path, while another may only add an auditor; either way the plan lacks a deterministic producer for `tasks[].weight`, so rollups can silently degrade to all weights equal to 1.

**Recommendation:** Remove the decompose requirement and specify the exact Stage 6 weight-assignment algorithm and test fixture proving newly created plans receive `tasks[].weight`.

**Confidence:** high

---

### F-003 [major] correctness — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:144-148

**Evidence:**
```md
Adiciona buildSeries() ao emit-consumer-state.js que lê completions.jsonl, bucketiza earned-weight por dia (respeitando weightBasis: o trecho count-based e o proxy-weighted são distinguíveis), computa a linha planejada (weightTotal no started → 0 no deadline) e o SPI, emitindo burnup.json e spi.json como bare-arrays
...
acceptance: burnup.json traz earned acumulado e a linha planejada por bucket; spi.json traz o SPI corrente
```

**Claim:** The planned line is defined as `weightTotal` at `started` down to `0` at `deadline`, which is a burn-down line, not a burn-up planned-value line.

**Impact:** The chart compares increasing earned value against decreasing planned value, and SPI becomes inflated or null near the deadline instead of showing schedule performance.

**Recommendation:** Define planned cumulative value as `0` at `started` increasing linearly to `weightTotal` at `deadline`, then compute SPI as `earned / planned` within that interval.

**Confidence:** high

---

### F-004 [major] ambiguity — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:13-28

**Evidence:**
```md
Eventos e actuals são gravados crus no instante em que acontecem; regressão/calibração é fase posterior. Nenhuma fonte derivada lossy substitui o log de eventos. O peso é congelado no evento no instante da conclusão (com o seu `weightBasis`), nunca re-derivado no render.
...
Campos: ts, event, projectId, planSlug, phaseId, taskId, weight (default 1), weightBasis ('count'|'proxy'). Append-only.
scopeBoundary: só escreve em .atomic-skills/analytics/; nunca muta state .md; não computa série nem agrega; weight ausente vira 1 com weightBasis 'count'.
```

**Claim:** The plan never defines how F3 reconciles early `count`-basis completion events with later proxy-weighted totals.

**Impact:** Earned numerator and planned denominator can be on different scales, causing wrong burn-up totals and SPI for any plan with completions recorded before proxy weights are assigned.

**Recommendation:** Define a basis boundary explicitly: emit separate count/proxy series, or compute each SPI only against a denominator using the same `weightBasis` as the contributing events.

**Confidence:** high

---

### F-005 [major] coverage — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:179-200

**Evidence:**
```md
### T-002 — Actuals de task via dispatch-log quando presente
Quando há dispatch-log.json para a task (lane codex), grava attempts/durationMs/escalations no sub-objeto actuals do evento de task-done.
Files: scripts/append-completion.js, tests/append-completion-dispatchlog.test.js
...
verifier: kind shell — node --test tests/append-completion-dispatchlog.test.js
...
command: node --test tests/append-completion-actuals.test.js && node --test tests/validate-state.test.js && node --test tests/schema-drift.test.js
```

**Claim:** F4’s exit gate omits `tests/append-completion-dispatchlog.test.js`, so task-level dispatch actuals are not gated.

**Impact:** The phase can be marked complete while `attempts`, `durationMs`, and `escalations` are never captured for task completions, despite the phase goal requiring raw actuals per completion.

**Recommendation:** Add `node --test tests/append-completion-dispatchlog.test.js` to the F4 exit gate in both `source.md` and the materialized `plan.md` frontmatter.

**Confidence:** high

---

### F-006 [major] coverage — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:186-191

**Evidence:**
```md
Adiciona um campo persistido `closedAtHardening { enforcedFrom: isoTimestamp, grandfatheredTaskIds: [string] }` ao plan.schema.json (opcional). Quando um plano o declara, checkMetInvariant (validate-state.js:364-399) exige closedAt para toda task done cujo id NÃO esteja em grandfatheredTaskIds; as ids grandfathered (as done sem closedAt no instante do flip) e os planos sem closedAtHardening continuam válidos. O flip é uma operação única que computa grandfatheredTaskIds = done vivas sem closedAt e grava enforcedFrom=now — nunca inventa closedAt (P3).
Files: scripts/validate-state.js, meta/schemas/plan.schema.json, assets/aideck-consumer/schema.json, tests/validate-state.test.js
```

**Claim:** The plan specifies a one-time hardening flip but has no task, file, or verifier that implements the operation that writes `closedAtHardening`.

**Impact:** The schema and validator can exist without a reproducible way to create the forward-only cut, leaving teams to hand-edit grandfathering state and risk rejecting legacy tasks or grandfathering the wrong IDs.

**Recommendation:** Add an explicit flip script or command with tests that computes `grandfatheredTaskIds`, writes `enforcedFrom`, and proves reruns are idempotent.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:145 — Should `burnup.json` contain one combined series with a `basis` field, or separate dataSources for count and proxy series?

## Out of scope

- Predictive fixed completion-date forecasting and Monte Carlo behavior.
- Calibration or treatment of captured actuals beyond raw capture.
- Backfill or migration of legacy history.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 6, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The plan still has material gaps after applying the external constraints. The biggest risks are that phase gates can pass without exercising required transition/schema/auditor behavior, and the core earned-value math is internally inconsistent for a burn-up chart.

Several blind-pass findings survive, but the weight-producer objection is invalid under the clarified constraint that weights are AI-authored in Stage 6 and auditor-enforced. New gate-coverage issues emerge because task verifiers are independent from phase exit gates unless explicitly included.

## Findings

### F-001 [major] coverage — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:39-60

**Evidence:**
```md
### T-003 — Emitir o evento nas transições done/phase-done/reconcile
Liga o append-completion aos três pontos de mutação que já carimbam conclusão na skill (done, phase-done bulk-close, reconcile), no mesmo instante da transição.
Files: skills/shared/project-assets/project-transitions.md
scopeBoundary: edição de instrução de skill (prosa executada pelo modelo); não cria novo comando; um append por task fechada (phase-done em lote = N appends), nunca um <now> compartilhado.
acceptance: project-transitions.md instrui append-completion no passo done; instrui um append por task no phase-done bulk-close; instrui append no reconcile.
verifier: kind shell — grep -c "append-completion" skills/shared/project-assets/project-transitions.md | grep -qE "^[3-9]|[0-9]{2,}"
```

**Claim:** F0 can pass without proving that the real model-executed transition prose was changed to emit completion events.

**Impact:** `done`, `phase-done`, and `reconcile` can remain uninstrumented while helper/schema/simulation tests pass, so real project operations produce no earned-flow data.

**Recommendation:** Add the T-003 grep verifier to the F0 exit gate, or replace the prose-only integration with an executable adapter that the real transition instructions and tests both invoke.

**Confidence:** high

---

### F-002 [major] correctness — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:144-149

**Evidence:**
```md
Adiciona buildSeries() ao emit-consumer-state.js que lê completions.jsonl, bucketiza earned-weight por dia (respeitando weightBasis: o trecho count-based e o proxy-weighted são distinguíveis), computa a linha planejada (weightTotal no started → 0 no deadline) e o SPI, emitindo burnup.json e spi.json como bare-arrays; adiciona $defs.burnup e $defs.spi ao aideck-state.schema.json e regenera o bundle. Define o comportamento de borda do SPI: planned-value zero, deadline ausente, ou data corrente fora de [started, deadline] emitem SPI null (nunca divisão por zero nem extrapolação).
```

**Claim:** The planned line is defined as `weightTotal` at `started` down to `0` at `deadline`, which is a burn-down direction inside a burn-up / earned-value chart.

**Impact:** The chart compares increasing earned value against decreasing planned value, and SPI can become misleadingly inflated instead of measuring earned value against expected cumulative value.

**Recommendation:** Change the planned cumulative line to `0` at `started` increasing linearly to `weightTotal` at `deadline`, and compute SPI as `earned / planned`.

**Confidence:** high

---

### F-003 [major] ambiguity — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:13-31

**Evidence:**
```md
Eventos e actuals são gravados crus no instante em que acontecem; regressão/calibração é fase posterior. Nenhuma fonte derivada lossy substitui o log de eventos. O peso é congelado no evento no instante da conclusão (com o seu `weightBasis`), nunca re-derivado no render.
```

**Claim:** The plan does not define how F3 computes earned/planned/SPI when early append-only events have `weightBasis: count` and later live tasks use proxy weights.

**Impact:** The numerator and denominator can be on different scales, producing incorrect burn-up totals and SPI for any plan with completions recorded before proxy weighting exists.

**Recommendation:** Define basis handling explicitly: emit separate count/proxy series, or compute each SPI only against a denominator expressed in the same basis as the contributing completion events.

**Confidence:** high

---

### F-004 [major] coverage — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:179-200

**Evidence:**
```md
### T-002 — Actuals de task via dispatch-log quando presente
Quando há dispatch-log.json para a task (lane codex), grava attempts/durationMs/escalations no sub-objeto actuals do evento de task-done.
Files: scripts/append-completion.js, tests/append-completion-dispatchlog.test.js
scopeBoundary: só lê dispatch-log existente; ausência não é erro (Mode-1 serial fica sem esses actuals); não cria dispatch-log nem instrumenta commits; usa o sub-objeto actuals já admitido.
acceptance: com dispatch-log presente, o evento task-done inclui actuals.attempts/durationMs/escalations; sem dispatch-log, o evento é emitido sem esses campos.
verifier: kind shell — node --test tests/append-completion-dispatchlog.test.js
```

**Claim:** F4’s exit gate omits `tests/append-completion-dispatchlog.test.js`, so task-level dispatch actuals are not gated.

**Impact:** F4 can be marked complete while `attempts`, `durationMs`, and `escalations` are never captured for task completions.

**Recommendation:** Add `node --test tests/append-completion-dispatchlog.test.js` to the F4 exit gate in both `source.md` and `plan.md`.

**Confidence:** high

---

### F-005 [major] coverage — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:186-191

**Evidence:**
```md
Adiciona um campo persistido `closedAtHardening { enforcedFrom: isoTimestamp, grandfatheredTaskIds: [string] }` ao plan.schema.json (opcional). Quando um plano o declara, checkMetInvariant (validate-state.js:364-399) exige closedAt para toda task done cujo id NÃO esteja em grandfatheredTaskIds; as ids grandfathered (as done sem closedAt no instante do flip) e os planos sem closedAtHardening continuam válidos. O flip é uma operação única que computa grandfatheredTaskIds = done vivas sem closedAt e grava enforcedFrom=now — nunca inventa closedAt (P3).
```

**Claim:** The plan specifies a one-time hardening flip but has no task, file, or verifier that implements the operation that writes `closedAtHardening`.

**Impact:** The validator can support the field without any reproducible way to create the forward-only cut, forcing hand edits that can reject legacy tasks or grandfather the wrong IDs.

**Recommendation:** Add an explicit flip script or command with tests that computes `grandfatheredTaskIds`, writes `enforcedFrom`, and proves reruns are idempotent.

**Confidence:** high

---

### F-006 [major] coverage — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:81-95

**Evidence:**
```md
### T-003 — Admitir closedAt E lastUpdated na projeção do schema emitido + rebuild do bundle
Permite closedAt E lastUpdated na projeção de task ($defs.tasks) do aideck-state.schema.json (additionalProperties:false) e regenera o bundle assets/aideck-consumer/schema.json para o schema-drift.test.js passar. Ambos os campos porque T-002 emite os dois; admitir só closedAt deixaria lastUpdated como drift.
Files: meta/schemas/aideck-state.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: mudança additiva no $defs.tasks da projeção (closedAt + lastUpdated); não toca regras cross-field; bundle regenerado pelo gerador (npm run build:aideck-schema), não editado à mão.
acceptance: aideck-state.schema.json admite closedAt E lastUpdated na task emitida; bundle regenerado e schema-drift.test.js passa.
verifier: kind shell — node --test tests/schema-drift.test.js
```

**Claim:** F1’s phase gate omits the schema-drift verifier even though the phase emits new strict-schema fields and requires bundle regeneration.

**Impact:** F1 can pass while `meta/schemas/aideck-state.schema.json` and `assets/aideck-consumer/schema.json` are out of sync, causing strict dashboard-state validation or `tests/schema-drift.test.js` to fail later.

**Recommendation:** Add `node --test tests/schema-drift.test.js` to the F1 exit gate; audit F2/F3 gates for the same missing task-verifier pattern.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:145 — Should `burnup.json` expose count and proxy basis as separate data sources, separate series, or a single series with a `basis` field?

## Out of scope

- Predictive fixed completion-date forecasting and Monte Carlo behavior.
- Calibration or treatment of captured actuals beyond raw capture.
- Backfill or migration of legacy history.
- Editing `src/decompose.js`.

## Pass 2 reconciliation

### Dropped from blind pass

- F-002-blind [major] contradiction — DROPPED: the external constraint states that task weights are AI-authored in `project-create-plan.md` Stage 6 and auditor-enforced, with `src/decompose.js` frozen and no deterministic producer required.

### Maintained

- F-001-blind → F-001-final [major] — severity changed: was critical, now major
- F-003-blind → F-002-final [major] — same
- F-004-blind → F-003-final [major] — same
- F-005-blind → F-004-final [major] — same
- F-006-blind → F-005-final [major] — same

### Emerged

- F-006-final [major] coverage — emerged: the external constraints clarify that schema bundle regeneration is mandatory and task verifiers are independent of phase exit gates unless the gate command includes them.