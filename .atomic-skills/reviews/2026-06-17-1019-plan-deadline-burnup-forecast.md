---
date: 2026-06-17T10:19:19-03:00
topic: deadline-burnup-forecast
artifact: .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/plan.md (+ source.md task specs)
skill: review-plan
reviewer: gpt-5-codex
codex_version: codex-cli 0.139.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 1, major: 5, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 5, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 6, emerged: 0}
mode: both
cross_ref: design.md
initiatives_discovered: 6/6
schema_version: "1.0"
---

# Cross-Model Review — deadline-burnup-forecast

## Local pass (self-loop, mode=both) — audit trail

Local adversarial self-loop (Claude, Opus). Every claim verified with file:line.
Cross-ref against the sibling design.md. Initiative-depth over 6/6 phases.

- **[critical] L1 ↔ codex F-003** — F2 emits/persists `weightDone`/`weightTotal`; no task admits them in initiative.schema.json (top-level, additionalProperties:false) nor aideck-state.schema.json $defs/initiatives. F2 gate (schema-drift + compute-rollups) never runs validate-aideck-state → drift passes the gate while live CI rejects state. Evidence: compute-rollups.js:29,176; initiative.schema.json top-level props (no weightDone/weightTotal); aideck-state.schema.json $defs/initiatives additionalProperties:false; source.md F2/T-001 only touches $defs.task, F2/T-002 touches no schema.
- **[significant] L2 ↔ codex F-002** — F1/T-002 emits closedAt AND lastUpdated; F1/T-003 admits only closedAt. aideck-state.schema.json $defs/tasks currently has neither → lastUpdated unadmitted → drift. Sibling-task contradiction.
- **[significant] L3 ↔ codex F-001** — F0 RED (P1/D1) verified by a prose word-count grep (source.md:42); F0 exit gate tests only helper+schema, never a transition. Gate G-1 description "emitido pelas três transições" over-claims.
- **[significant] L4 (LOCAL-ONLY)** — F5 dependsOn:[F4] (intra-plan) but the real blocker (external plan fix-aideck-dashboard F2) lives only in prose; F5 becomes "ready" when F4 closes regardless. Recommend status:blocked + blockedBy, or a pre-verifier checking the rebuilt manifest.
- **[minor] L5 (LOCAL-ONLY)** — plan F3 goal + source.md:524 + design.md:86 say refresh-state "só chama emitFocus"; it actually runs 3 passes (computeRollupsDir+reconcileDir+emitFocus). Real gap (doesn't invoke emit-consumer-state) holds; wording is inaccurate (G1). Evidence: refresh-state.js:17-19,25.
- **[minor] L6 ↔ codex F-006 (codex elevated to critical)** — F4/T-003 promote-to-hard trigger ("lacuna ~0") has no numeric threshold; design Open questions acknowledges it. Codex deepened: no persisted cutoff source / classification rule / schema admission → not implementable as written.
- **[minor] L7 (artifact divergence — design.md, NOT edited)** — design.md:122 lists schema changes as "initiative.schema.json (weight, closedAt na projeção)"; closedAt projection actually lives in aideck-state.schema.json, and the list omits weightDone/weightTotal/lastUpdated admissions (root of L1/L2). HARD-GATE: design not edited; recorded as divergence.

### Codex-unique (local missed)
- **codex F-004 [major, ordering]** — completion event carries `weight` at F0, before F2 defines tasks[].weight; append-only log permanently mixes default-count and proxy-weighted events.
- **codex F-005 [major, schema]** — completion-event.schema.json locked additionalProperties:false at F0/T-002; F4 adds actuals fields without listing it in Files → actual-bearing events rejected.

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has multiple schema and gate-coverage gaps that will let phases pass while the implemented system still rejects its own emitted data or fails to instrument the core transition path. The highest-risk issue is the forward-only `closedAt` hard gate: it requires distinguishing legacy from new done tasks, but the plan defines no persisted cutoff or deterministic classification rule.

Several tasks also emit or persist new fields without admitting all of those fields in the strict schemas or regenerated consumer bundle. Those gaps will surface as `schema-drift`, Ajv validation failures, or invalid completion-event records during implementation.

## Findings

### F-001 [major] coverage — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:37-52

**Evidence:**
```md
### T-003 — Emitir o evento nas transições done/phase-done/reconcile
Liga o append-completion aos três pontos de mutação que já carimbam conclusão na skill (done, phase-done bulk-close, reconcile), no mesmo instante da transição.
Files: skills/shared/project-assets/project-transitions.md
scopeBoundary: edição de instrução de skill (prosa executada pelo modelo); não cria novo comando; um append por task fechada (phase-done em lote = N appends), nunca um <now> compartilhado.
acceptance: project-transitions.md instrui append-completion no passo done; instrui um append por task no phase-done bulk-close; instrui append no reconcile.
verifier: kind shell — grep -c "append-completion" skills/shared/project-assets/project-transitions.md | grep -qE "^[3-9]|[0-9]{2,}"

```yaml
exit_gate:
  - id: G-1
    description: o completions.jsonl recebe um evento imutável por conclusão, validado por schema, emitido pelas três transições.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion.test.js && node --test tests/completion-event-schema.test.js
```

**Claim:** The F0 exit gate claims transition emission is verified, but it does not run the only T-003 verifier that checks `done`, `phase-done`, and `reconcile` wiring.

**Impact:** F0 can be marked complete with a working append helper and schema while no real transition emits completion events, leaving the earned curve with no production data.

**Recommendation:** Add a transition-wiring verifier to the F0 gate, preferably a real test over `project-transitions.md` that asserts the three distinct transition instructions and one-per-task bulk behavior, not only the append helper/schema tests.

**Confidence:** high

---

### F-002 [major] schema — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:65-77

**Evidence:**
```md
### T-002 — Emitir closedAt e lastUpdated na projeção de task
Adiciona closedAt e lastUpdated à projeção de task emitida (hoje emit-consumer-state.js:255-267 carrega só id/title/summary/status/blocked/blockedBy), para a curva earned ler o instante de conclusão.
Files: scripts/emit-consumer-state.js, tests/emit-consumer-state.test.js
scopeBoundary: só adiciona campos à projeção de task; não altera outras projeções; closedAt ausente vira null (legado honesto), nunca inventado.
acceptance: a projeção de task inclui closedAt e lastUpdated; task sem closedAt na fonte emite closedAt:null.
verifier: kind shell — node --test tests/emit-consumer-state.test.js

### T-003 — Admitir closedAt na projeção do schema emitido + rebuild do bundle
Permite closedAt na projeção de task do aideck-state.schema.json (additionalProperties:false) e regenera o bundle assets/aideck-consumer/schema.json para o schema-drift.test.js passar.
Files: meta/schemas/aideck-state.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: mudança additiva no $defs da projeção de task; não toca regras cross-field; bundle regenerado pelo gerador, não editado à mão.
acceptance: aideck-state.schema.json admite closedAt na task emitida; bundle regenerado e schema-drift.test.js passa.
```

**Claim:** F1 emits `lastUpdated` in task records but only admits `closedAt` in the emitted task schema.

**Impact:** `emit-consumer-state.js` will produce task records with an undeclared `lastUpdated` field, and strict `aideck-state.schema.json` / consumer bundle validation will reject the dashboard state.

**Recommendation:** Update F1 T-003 to admit both `closedAt` and `lastUpdated` in the emitted task `$defs.tasks`, regenerate `assets/aideck-consumer/schema.json`, and include validation of both fields in the task projection test.

**Confidence:** high

---

### F-003 [major] schema — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:100-105

**Evidence:**
```md
### T-002 — Rollups weightDone/weightTotal
Estende compute-rollups.js para precomputar weightTotal (soma de weight, default 1 por task sem weight) e weightDone (soma das done) por initiative, e emiti-los.
Files: scripts/compute-rollups.js, scripts/emit-consumer-state.js, tests/compute-rollups.test.js
scopeBoundary: espelha o padrão tasksDone/tasksTotal; idempotente; task sem weight conta como 1 (degrada para count-burnup).
acceptance: weightTotal soma todos os weights (1 quando ausente); weightDone soma os das done; rerun de compute-rollups é idempotente (sem diff na segunda passada).
verifier: kind shell — node --test tests/compute-rollups.test.js
```

**Claim:** F2 persists and emits `weightDone`/`weightTotal` but does not include any task to admit those rollup fields in the strict source or emitted-state schemas.

**Impact:** `compute-rollups.js` will write undeclared frontmatter fields, and `emit-consumer-state.js` will emit undeclared projection fields; strict validation or schema drift tests will fail after the rollups are added.

**Recommendation:** Add `weightDone` and `weightTotal` to the relevant source frontmatter schema and emitted aiDeck schema, regenerate `assets/aideck-consumer/schema.json`, and include `schema-drift.test.js` in the F2 gate.

**Confidence:** high

---

### F-004 [major] ordering — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:23-24

**Evidence:**
```md
### T-001 — Helper append-completion + log JSONL
Cria o helper que faz append de uma linha JSON por conclusão em `.atomic-skills/analytics/completions.jsonl` (cria `analytics/` se ausente). Campos: ts, event, projectId, planSlug, phaseId, taskId, weight. Append-only.
```

**Claim:** F0 requires every completion event to carry `weight` before F2 introduces `tasks[].weight` and its assignment path.

**Impact:** Completions recorded during F0 and F1 have no defined source for `weight`; if they default to `1`, later weighted series will permanently mix default-count events with proxy-weighted events because the log is append-only and legacy backfill is out of scope.

**Recommendation:** Move the task weight schema/defaulting contract before completion events are emitted, or explicitly define F0 event `weight` as `1` until F2 and mark the resulting early events as count-based so F3 can handle mixed semantics deterministically.

**Confidence:** high

---

### F-005 [major] schema — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:30-35

**Evidence:**
```md
### T-002 — Schema do evento de conclusão + validação
Define o schema da linha do completions.jsonl e liga sua validação ao pipeline determinístico, sem quebrar o validate-state existente (que só varre .md).
Files: meta/schemas/completion-event.schema.json, scripts/validate-aideck-state.js, tests/completion-event-schema.test.js
scopeBoundary: additionalProperties:false no schema; campos exatamente os de T-001; não altera as regras cross-field do validate-state.js (GATE-R2 intacto).
acceptance: uma linha bem-formada valida; linha com campo extra ou sem ts/weight é rejeitada; o validador roda sobre o jsonl sem afetar a varredura .md do validate-state.
```

**Claim:** F0 locks the completion-event schema to exactly the base fields, but F4 later adds actuals fields without listing `completion-event.schema.json` as a file to update.

**Impact:** Phase-done or task-done events containing `filesChanged`, `locAdded`, `locRemoved`, `commits`, `attempts`, duration, or escalations will be rejected as additional properties by the strict event schema.

**Recommendation:** Add a F4 schema task or expand F4 T-001/T-002 to update `meta/schemas/completion-event.schema.json` and `tests/completion-event-schema.test.js` for the optional actuals fields before any actual-bearing events are emitted.

**Confidence:** high

---

### F-006 [critical] ambiguity — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:177-181

**Evidence:**
```md
### T-003 — Promover closedAt para hard-gate no GATE-R2
Quando o auditor (F1 T-001) reporta lacuna ~0, adiciona ao checkMetInvariant (validate-state.js:364-399) a exigência de closedAt para toda task done cuja transição é posterior ao corte; legado grandfathered.
Files: scripts/validate-state.js, tests/validate-state.test.js
scopeBoundary: forward-only: legado sem closedAt não é rejeitado; não altera a regra de evidence.passed existente do GATE-R2.
acceptance: task done nova sem closedAt é rejeitada pelo validate-state; task done legada (pré-corte) sem closedAt continua válida.
```

**Claim:** The hard gate depends on a “posterior ao corte” cutoff, but no task defines where that cutoff is stored, how it is computed, or what schema admits it.

**Impact:** `validate-state.js` cannot deterministically distinguish legacy done tasks from new done tasks without guessing from mutable timestamps or rejecting valid legacy state; the F4 acceptance criteria are not implementable as written.

**Recommendation:** Define a persisted cutoff source, schema admission, and validation rule before F4 T-003, then test tasks on both sides of that cutoff explicitly.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:136 — What exact SPI formula should be emitted when planned value is zero, deadline is missing, or the current date is outside `[started, deadline]`?

## Out of scope

- Fixed completion-date forecasting and Monte Carlo behavior are not reviewed because they are listed as non-goals.
- Backfilling legacy history is not reviewed because it is listed as a non-goal.
- Git as earned-value source is not reviewed because it is listed as a non-goal.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The plan still has schema, ordering, and gate-coverage failures that can let phases pass while the implemented tracker rejects its own data or emits unusable analytics. The externally supplied constraints strengthen the schema findings: rollups are written into strict source frontmatter and emitted into strict consumer projections, while `schema-drift.test.js` alone does not validate runtime emitted records.

The highest-risk issue remains the forward-only `closedAt` hard gate: it requires a deterministic cutoff to distinguish legacy from new done tasks, but the plan defines no persisted cutoff or admitted schema field for it.

## Findings

### F-001 [major] coverage — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:37-52

**Evidence:**
```md
### T-003 — Emitir o evento nas transições done/phase-done/reconcile
Liga o append-completion aos três pontos de mutação que já carimbam conclusão na skill (done, phase-done bulk-close, reconcile), no mesmo instante da transição.
Files: skills/shared/project-assets/project-transitions.md
scopeBoundary: edição de instrução de skill (prosa executada pelo modelo); não cria novo comando; um append por task fechada (phase-done em lote = N appends), nunca um <now> compartilhado.
acceptance: project-transitions.md instrui append-completion no passo done; instrui um append por task no phase-done bulk-close; instrui append no reconcile.
verifier: kind shell — grep -c "append-completion" skills/shared/project-assets/project-transitions.md | grep -qE "^[3-9]|[0-9]{2,}"

```yaml
exit_gate:
  - id: G-1
    description: o completions.jsonl recebe um evento imutável por conclusão, validado por schema, emitido pelas três transições.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion.test.js && node --test tests/completion-event-schema.test.js
```

**Claim:** The F0 exit gate claims transition emission is verified, but it does not run the only T-003 verifier that checks `done`, `phase-done`, and `reconcile` wiring.

**Impact:** F0 can be marked complete with a working append helper and schema while no real transition emits completion events, leaving the earned curve with no production data.

**Recommendation:** Add a transition-wiring verifier to the F0 gate that asserts the three distinct transition instructions and one-per-task bulk behavior.

**Confidence:** high

---

### F-002 [major] schema — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:65-77

**Evidence:**
```md
### T-002 — Emitir closedAt e lastUpdated na projeção de task
Adiciona closedAt e lastUpdated à projeção de task emitida (hoje emit-consumer-state.js:255-267 carrega só id/title/summary/status/blocked/blockedBy), para a curva earned ler o instante de conclusão.
Files: scripts/emit-consumer-state.js, tests/emit-consumer-state.test.js
scopeBoundary: só adiciona campos à projeção de task; não altera outras projeções; closedAt ausente vira null (legado honesto), nunca inventado.
acceptance: a projeção de task inclui closedAt e lastUpdated; task sem closedAt na fonte emite closedAt:null.
verifier: kind shell — node --test tests/emit-consumer-state.test.js

### T-003 — Admitir closedAt na projeção do schema emitido + rebuild do bundle
Permite closedAt na projeção de task do aideck-state.schema.json (additionalProperties:false) e regenera o bundle assets/aideck-consumer/schema.json para o schema-drift.test.js passar.
Files: meta/schemas/aideck-state.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: mudança additiva no $defs da projeção de task; não toca regras cross-field; bundle regenerado pelo gerador, não editado à mão.
acceptance: aideck-state.schema.json admite closedAt na task emitida; bundle regenerado e schema-drift.test.js passa.
```

**Claim:** F1 emits `lastUpdated` in task records but only admits `closedAt` in the emitted task schema.

**Impact:** `emit-consumer-state.js` will produce task records with an undeclared `lastUpdated` field, and strict `aideck-state.schema.json` / consumer bundle validation will reject the dashboard state.

**Recommendation:** Update F1 T-003 to admit both `closedAt` and `lastUpdated` in emitted task `$defs.tasks`, regenerate `assets/aideck-consumer/schema.json`, and validate both fields in the projection test.

**Confidence:** high

---

### F-003 [major] schema — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:100-105

**Evidence:**
```md
### T-002 — Rollups weightDone/weightTotal
Estende compute-rollups.js para precomputar weightTotal (soma de weight, default 1 por task sem weight) e weightDone (soma das done) por initiative, e emiti-los.
Files: scripts/compute-rollups.js, scripts/emit-consumer-state.js, tests/compute-rollups.test.js
scopeBoundary: espelha o padrão tasksDone/tasksTotal; idempotente; task sem weight conta como 1 (degrada para count-burnup).
acceptance: weightTotal soma todos os weights (1 quando ausente); weightDone soma os das done; rerun de compute-rollups é idempotente (sem diff na segunda passada).
verifier: kind shell — node --test tests/compute-rollups.test.js
```

**Claim:** F2 persists and emits `weightDone`/`weightTotal` but does not include any task to admit those rollup fields in the strict source or emitted-state schemas.

**Impact:** `compute-rollups.js` will write undeclared initiative frontmatter fields, and `emit-consumer-state.js` will emit undeclared projection fields; strict source validation or Ajv validation of emitted dashboard state will fail.

**Recommendation:** Add `weightDone` and `weightTotal` to the initiative frontmatter schema and emitted aiDeck initiative schema, regenerate `assets/aideck-consumer/schema.json`, and add a runtime validation verifier beyond `schema-drift.test.js`.

**Confidence:** high

---

### F-004 [major] ordering — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:23-24

**Evidence:**
```md
### T-001 — Helper append-completion + log JSONL
Cria o helper que faz append de uma linha JSON por conclusão em `.atomic-skills/analytics/completions.jsonl` (cria `analytics/` se ausente). Campos: ts, event, projectId, planSlug, phaseId, taskId, weight. Append-only.
```

**Claim:** F0 requires every completion event to carry `weight` before F2 introduces `tasks[].weight` and its assignment path.

**Impact:** Completions recorded during F0 and F1 have no defined source for `weight`; if they default to `1`, later weighted series will permanently mix default-count events with proxy-weighted events because the log is append-only and legacy backfill is out of scope.

**Recommendation:** Move the task weight schema/defaulting contract before completion events are emitted, or explicitly define F0 event `weight` as `1` until F2 and mark early events as count-based so F3 can handle mixed semantics deterministically.

**Confidence:** high

---

### F-005 [major] schema — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:30-35

**Evidence:**
```md
### T-002 — Schema do evento de conclusão + validação
Define o schema da linha do completions.jsonl e liga sua validação ao pipeline determinístico, sem quebrar o validate-state existente (que só varre .md).
Files: meta/schemas/completion-event.schema.json, scripts/validate-aideck-state.js, tests/completion-event-schema.test.js
scopeBoundary: additionalProperties:false no schema; campos exatamente os de T-001; não altera as regras cross-field do validate-state.js (GATE-R2 intacto).
acceptance: uma linha bem-formada valida; linha com campo extra ou sem ts/weight é rejeitada; o validador roda sobre o jsonl sem afetar a varredura .md do validate-state.
```

**Claim:** F0 locks the completion-event schema to exactly the base fields, but F4 later adds actuals fields without listing `completion-event.schema.json` as a file to update.

**Impact:** Phase-done or task-done events containing `filesChanged`, `locAdded`, `locRemoved`, `commits`, `attempts`, duration, or escalations will be rejected as additional properties by the strict event schema.

**Recommendation:** Expand F4 T-001/T-002 to update `meta/schemas/completion-event.schema.json` and `tests/completion-event-schema.test.js` for the optional actuals fields before any actual-bearing events are emitted.

**Confidence:** high

---

### F-006 [critical] ambiguity — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:177-181

**Evidence:**
```md
### T-003 — Promover closedAt para hard-gate no GATE-R2
Quando o auditor (F1 T-001) reporta lacuna ~0, adiciona ao checkMetInvariant (validate-state.js:364-399) a exigência de closedAt para toda task done cuja transição é posterior ao corte; legado grandfathered.
Files: scripts/validate-state.js, tests/validate-state.test.js
scopeBoundary: forward-only: legado sem closedAt não é rejeitado; não altera a regra de evidence.passed existente do GATE-R2.
acceptance: task done nova sem closedAt é rejeitada pelo validate-state; task done legada (pré-corte) sem closedAt continua válida.
```

**Claim:** The hard gate depends on a “posterior ao corte” cutoff, but no task defines where that cutoff is stored, how it is computed, or what schema admits it.

**Impact:** `validate-state.js` cannot deterministically distinguish legacy done tasks from new done tasks without guessing from mutable timestamps or rejecting valid legacy state; the F4 acceptance criteria are not implementable as written.

**Recommendation:** Define a persisted cutoff source, schema admission, and validation rule before F4 T-003, then test tasks on both sides of that cutoff explicitly.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:136 — What exact SPI formula should be emitted when planned value is zero, deadline is missing, or the current date is outside `[started, deadline]`?

## Out of scope

- Fixed completion-date forecasting and Monte Carlo behavior are not reviewed because they are listed as non-goals.
- Backfilling legacy history is not reviewed because it is listed as a non-goal.
- Git as earned-value source is not reviewed because it is listed as a non-goal.

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same
- F-003-blind → F-003-final [major] — same
- F-004-blind → F-004-final [major] — same
- F-005-blind → F-005-final [major] — same
- F-006-blind → F-006-final [critical] — same

### Emerged

- _(none)_

## Briefings used

<details>
<summary>Pass 1 briefing (factual minimal; no intent narrative; no local findings)</summary>

```
You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming.

## Project-factual constraints (externally verifiable; NOT findings)

- Runtime: Node >= 18; tests run via `node --test` (node built-in test runner).
- JSON schemas under meta/schemas/ are strict (additionalProperties:false / .strict()): any new emitted or persisted field must be admitted in the schema, and the consumer bundle assets/aideck-consumer/schema.json must be regenerated via `npm run build:aideck-schema` or the test tests/schema-drift.test.js fails.
- The emitted dashboard state is validated by scripts/validate-aideck-state.js (Ajv, strict) against that bundle; an emitted record carrying a field the schema does not declare is rejected.
- src/decompose.js is frozen and must not be edited.
- The aiDeck v0.1 runtime has no aggregation engine: every series/count/ratio must be precomputed as a bare JSON array. Only the published widgets line-chart, stat, gauge exist.
- compute-rollups.js writes rollup fields onto each phase's source .md frontmatter; emit-consumer-state.js builds the denormalized dashboard projection.

## Non-goals (factual, no rationale)

- No predictive fixed completion-date forecast (no Monte Carlo).
- No treatment/calibration of captured actuals in v1 (capture only).
- No backfill/migration of legacy history to fill the curve.
- Git is not a source of earned-value.
- Do not edit src/decompose.js.
- No dependency on unpublished aiDeck widgets (only line-chart/stat/gauge).

## Out of scope for this review

- Style, naming, or formatting unless it hides a substantive bug.
- Alternative approaches the plan did NOT choose.
- Items in the Non-goals list above.

## Artifact to review

Path: .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/plan.md (plan.md frontmatter + source.md task specs concatenated)

---BEGIN ARTIFACT---
===== FILE: plan.md =====
---
schemaVersion: "0.1"
slug: deadline-burnup-forecast
title: Deadline Burn-up Forecast (Earned Value / SPI)
version: "1.0"
status: active
started: 2026-06-17T12:06:57.781Z
lastUpdated: 2026-06-17T12:06:57.781Z
branch: plan/deadline-burnup-forecast
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Sinal antes de cálculo
    body: Primeiro tornar o fluxo observável (a transição done emite evento
      verificável); o forecast é consequência. O RED da feature é "a transição
      done emite um evento?" — hoje não emite.
  - id: P2
    title: Capturar imutável agora, tratar depois
    body: Eventos e actuals são gravados crus no instante em que acontecem;
      regressão/calibração é fase posterior. Nenhuma fonte derivada lossy
      substitui o log de eventos.
  - id: P3
    title: Forward-only, sem histórico cosmético
    body: Enforcement de closedAt vale só para frente; legado fica closedAt:null.
      Proibido inventar closedAt retroativo em lote — colapsa a curva num degrau
      falso.
  - id: P4
    title: Uma fonte, não duas
    body: O evento de conclusão é efeito colateral atômico do próprio comando
      done/phase-done/reconcile, não um arquivo paralelo mantido à mão que
      diverge do tracker.
glossary: []
phases:
  - id: F0
    slug: deadline-burnup-forecast-f0-fonte-de-fluxo-evento-done-emitido
    title: "Fonte de fluxo: evento done emitido na transição"
    goal: criar o log append-only de conclusões (completions.jsonl) e fazer os
      passos done/phase-done/reconcile emitirem um evento imutável por
      conclusão, com schema validado. Este é o RED da feature (sem isso não há
      curva earned).
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: o completions.jsonl recebe um evento imutável por conclusão,
            validado por schema, emitido pelas três transições.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/append-completion.test.js && node --test
              tests/completion-event-schema.test.js
    status: active
    summary: Cria o log append-only de conclusões e faz a transição done emitir o
      evento — o RED do forecast.
  - id: F1
    slug: deadline-burnup-forecast-f1-closedat-forward-only-auditor-soft
    title: "closedAt forward-only: auditor soft + emissão"
    goal: tornar closedAt auditável (soft, mede a lacuna de instrumentação) e
      emiti-lo na projeção de task do dashboard, sem backfill cosmético e sem
      hard-gate ainda.
    dependsOn:
      - F0
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: closedAt é auditável (soft) e emitido na projeção; nenhum closedAt
            retroativo é inventado.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/find-unclosed-done.test.js && node --test
              tests/emit-consumer-state.test.js
    status: pending
    summary: Torna closedAt auditável (soft) e o emite na projeção, sem backfill
      cosmético.
  - id: F2
    slug: deadline-burnup-forecast-f2-peso-por-task-proxy-estrutural-roll
    title: "Peso por task: proxy estrutural + rollups"
    goal: introduzir tasks[].weight (number, opcional, default=1) derivado por proxy
      estrutural no decompose, com rollups weightDone/weightTotal espelhando
      tasksDone/tasksTotal.
    dependsOn:
      - F1
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: weight existe no schema, é somado em rollups
            weightDone/weightTotal, e tem auditor de backfill.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/schema-drift.test.js && node --test
              tests/compute-rollups.test.js
    status: pending
    summary: Dá peso de complexidade a cada task (proxy automático) e soma em
      rollups weightDone/Total.
  - id: F3
    slug: deadline-burnup-forecast-f3-serie-earned-vs-planned-deadline-wi
    title: Série earned-vs-planned + deadline + wiring de recompute
    goal: adicionar plan.deadline, computar a série burn-up (earned acumulado vs
      linha planejada linear) e o SPI no emit, e ligar o recompute ao
      refresh-state (fechando o gap em que ele só chama emitFocus).
    dependsOn:
      - F2
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: a série earned-vs-planned + SPI é emitida e recomputada
            automaticamente pelo refresh-state, com deadline no schema.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/emit-series.test.js && node --test
              tests/refresh-state.test.js
    status: pending
    summary: Computa a série earned-vs-planejada e o SPI contra o deadline,
      recomputada no refresh-state.
  - id: F4
    slug: deadline-burnup-forecast-f4-geracao-de-dados-de-calibracao-endu
    title: Geração de dados de calibração + endurecer closedAt
    goal: "gravar os actuals crus por conclusão (calibração: só geração, tratamento
      depois) e promover closedAt de soft para hard no GATE-R2 quando a lacuna
      de instrumentação chegar perto de zero."
    dependsOn:
      - F3
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: actuals crus são gravados por conclusão e closedAt é hard-gated
            forward-only sem rejeitar legado.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/append-completion-actuals.test.js && node --test
              tests/validate-state.test.js
    status: pending
    summary: Grava os actuals crus por conclusão (calibração futura) e endurece
      closedAt forward-only.
  - id: F5
    slug: deadline-burnup-forecast-f5-render-no-aideck-depende-do-redesig
    title: Render no aiDeck (depende do redesign do dashboard)
    goal: "registrar os dataSources burnup/spi no manifest e uma página com
      line-chart (2 séries) + stat SPI, usando só widgets publicados.
      DEPENDÊNCIA EXTERNA: bloqueada até o redesign do dashboard (plano
      fix-aideck-dashboard, F2) aterrissar — o forecast só renderiza sobre o
      dashboard refeito; por isso é a última fase. As fases F0–F4
      (instrumentação de tracking) são independentes e implementáveis já."
    dependsOn:
      - F4
    subPhaseCount: 1
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: a página de ritmo renderiza com widgets reais ligados a
            burnup.json/spi.json, sobre o dashboard refeito.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/aideck-consumer-manifest.test.js
    status: pending
    summary: Renderiza o burn-up/SPI no dashboard — bloqueada até o redesign do
      dashboard aterrissar.
references: []
---

# Deadline Burn-up Forecast (Earned Value / SPI)

## 1. Context

Burn-up ponderado por complexidade contra um deadline por-plano: mostra se um plano está acima/abaixo do ritmo esperado para a data-alvo, em vez de uma data fixa de conclusão. Implementa a fonte de fluxo (evento done emitido na transição), o peso por task, a série earned-vs-planned e o render no aiDeck. Fonte-de-verdade: design.md deste plano.

## 2. Inviolable principles

- **P1 Sinal antes de cálculo** — Primeiro tornar o fluxo observável (a transição done emite evento verificável); o forecast é consequência. O RED da feature é "a transição done emite um evento?" — hoje não emite.
- **P2 Capturar imutável agora, tratar depois** — Eventos e actuals são gravados crus no instante em que acontecem; regressão/calibração é fase posterior. Nenhuma fonte derivada lossy substitui o log de eventos.
- **P3 Forward-only, sem histórico cosmético** — Enforcement de closedAt vale só para frente; legado fica closedAt:null. Proibido inventar closedAt retroativo em lote — colapsa a curva num degrau falso.
- **P4 Uma fonte, não duas** — O evento de conclusão é efeito colateral atômico do próprio comando done/phase-done/reconcile, não um arquivo paralelo mantido à mão que diverge do tracker.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

===== FILE: source.md (full per-task specs: Files / scopeBoundary / acceptance / verifier) =====
# Deadline Burn-up Forecast (Earned Value / SPI)

Burn-up ponderado por complexidade contra um deadline por-plano: mostra se um plano está acima/abaixo do ritmo esperado para a data-alvo, em vez de uma data fixa de conclusão. Implementa a fonte de fluxo (evento done emitido na transição), o peso por task, a série earned-vs-planned e o render no aiDeck. Fonte-de-verdade: design.md deste plano.

## Principles

### P1 Sinal antes de cálculo
Primeiro tornar o fluxo observável (a transição done emite evento verificável); o forecast é consequência. O RED da feature é "a transição done emite um evento?" — hoje não emite.

### P2 Capturar imutável agora, tratar depois
Eventos e actuals são gravados crus no instante em que acontecem; regressão/calibração é fase posterior. Nenhuma fonte derivada lossy substitui o log de eventos.

### P3 Forward-only, sem histórico cosmético
Enforcement de closedAt vale só para frente; legado fica closedAt:null. Proibido inventar closedAt retroativo em lote — colapsa a curva num degrau falso.

### P4 Uma fonte, não duas
O evento de conclusão é efeito colateral atômico do próprio comando done/phase-done/reconcile, não um arquivo paralelo mantido à mão que diverge do tracker.

## F0 — Fonte de fluxo: evento done emitido na transição

Goal: criar o log append-only de conclusões (completions.jsonl) e fazer os passos done/phase-done/reconcile emitirem um evento imutável por conclusão, com schema validado. Este é o RED da feature (sem isso não há curva earned).

### T-001 — Helper append-completion + log JSONL
Cria o helper que faz append de uma linha JSON por conclusão em `.atomic-skills/analytics/completions.jsonl` (cria `analytics/` se ausente). Campos: ts, event, projectId, planSlug, phaseId, taskId, weight. Append-only.
Files: scripts/append-completion.js, tests/append-completion.test.js
scopeBoundary: só escreve em .atomic-skills/analytics/; nunca muta state .md; não computa série nem agrega.
acceptance: appendCompletion anexa exatamente uma linha JSON válida; analytics/ é criado idempotentemente; chamadas repetidas nunca reescrevem nem reordenam linhas já gravadas.
verifier: kind shell — node --test tests/append-completion.test.js

### T-002 — Schema do evento de conclusão + validação
Define o schema da linha do completions.jsonl e liga sua validação ao pipeline determinístico, sem quebrar o validate-state existente (que só varre .md).
Files: meta/schemas/completion-event.schema.json, scripts/validate-aideck-state.js, tests/completion-event-schema.test.js
scopeBoundary: additionalProperties:false no schema; campos exatamente os de T-001; não altera as regras cross-field do validate-state.js (GATE-R2 intacto).
acceptance: uma linha bem-formada valida; linha com campo extra ou sem ts/weight é rejeitada; o validador roda sobre o jsonl sem afetar a varredura .md do validate-state.
verifier: kind shell — node --test tests/completion-event-schema.test.js

### T-003 — Emitir o evento nas transições done/phase-done/reconcile
Liga o append-completion aos três pontos de mutação que já carimbam conclusão na skill (done, phase-done bulk-close, reconcile), no mesmo instante da transição.
Files: skills/shared/project-assets/project-transitions.md
scopeBoundary: edição de instrução de skill (prosa executada pelo modelo); não cria novo comando; um append por task fechada (phase-done em lote = N appends), nunca um <now> compartilhado.
acceptance: project-transitions.md instrui append-completion no passo done; instrui um append por task no phase-done bulk-close; instrui append no reconcile.
verifier: kind shell — grep -c "append-completion" skills/shared/project-assets/project-transitions.md | grep -qE "^[3-9]|[0-9]{2,}"

```yaml
exit_gate:
  - id: G-1
    description: o completions.jsonl recebe um evento imutável por conclusão, validado por schema, emitido pelas três transições.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion.test.js && node --test tests/completion-event-schema.test.js
```

## F1 — closedAt forward-only: auditor soft + emissão

Goal: tornar closedAt auditável (soft, mede a lacuna de instrumentação) e emiti-lo na projeção de task do dashboard, sem backfill cosmético e sem hard-gate ainda.

### T-001 — Auditor da lacuna de instrumentação
Detector zero-token que lista tasks status:done sem closedAt (a métrica que decide quando promover para hard depois), exit não-zero quando houver offenders.
Files: scripts/find-unclosed-done.js, tests/find-unclosed-done.test.js
scopeBoundary: read-only; nunca muta state nem inventa closedAt; ignora a árvore _archive-legacy (legado grandfathered).
acceptance: lista cada task done sem closedAt e sai não-zero quando há ao menos uma; sai zero quando todas as done vivas têm closedAt; ignora _archive-legacy.
verifier: kind shell — node --test tests/find-unclosed-done.test.js

### T-002 — Emitir closedAt e lastUpdated na projeção de task
Adiciona closedAt e lastUpdated à projeção de task emitida (hoje emit-consumer-state.js:255-267 carrega só id/title/summary/status/blocked/blockedBy), para a curva earned ler o instante de conclusão.
Files: scripts/emit-consumer-state.js, tests/emit-consumer-state.test.js
scopeBoundary: só adiciona campos à projeção de task; não altera outras projeções; closedAt ausente vira null (legado honesto), nunca inventado.
acceptance: a projeção de task inclui closedAt e lastUpdated; task sem closedAt na fonte emite closedAt:null.
verifier: kind shell — node --test tests/emit-consumer-state.test.js

### T-003 — Admitir closedAt na projeção do schema emitido + rebuild do bundle
Permite closedAt na projeção de task do aideck-state.schema.json (additionalProperties:false) e regenera o bundle assets/aideck-consumer/schema.json para o schema-drift.test.js passar.
Files: meta/schemas/aideck-state.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: mudança additiva no $defs da projeção de task; não toca regras cross-field; bundle regenerado pelo gerador, não editado à mão.
acceptance: aideck-state.schema.json admite closedAt na task emitida; bundle regenerado e schema-drift.test.js passa.
verifier: kind shell — node --test tests/schema-drift.test.js

```yaml
exit_gate:
  - id: G-1
    description: closedAt é auditável (soft) e emitido na projeção; nenhum closedAt retroativo é inventado.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/find-unclosed-done.test.js && node --test tests/emit-consumer-state.test.js
```

## F2 — Peso por task: proxy estrutural + rollups

Goal: introduzir tasks[].weight (number, opcional, default=1) derivado por proxy estrutural no decompose, com rollups weightDone/weightTotal espelhando tasksDone/tasksTotal.

### T-001 — Campo weight no schema da task + rebuild do bundle
Adiciona weight (number, minimum 0, opcional) ao $defs.task de initiative.schema.json e regenera o bundle.
Files: meta/schemas/initiative.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: campo opcional, fora de required (backward-compat 0.1); não toca GATE-R2; bundle regenerado pelo gerador.
acceptance: task com weight numérico valida; task sem weight continua válida; schema-drift.test.js passa após o rebuild.
verifier: kind shell — node --test tests/schema-drift.test.js

### T-002 — Rollups weightDone/weightTotal
Estende compute-rollups.js para precomputar weightTotal (soma de weight, default 1 por task sem weight) e weightDone (soma das done) por initiative, e emiti-los.
Files: scripts/compute-rollups.js, scripts/emit-consumer-state.js, tests/compute-rollups.test.js
scopeBoundary: espelha o padrão tasksDone/tasksTotal; idempotente; task sem weight conta como 1 (degrada para count-burnup).
acceptance: weightTotal soma todos os weights (1 quando ausente); weightDone soma os das done; rerun de compute-rollups é idempotente (sem diff na segunda passada).
verifier: kind shell — node --test tests/compute-rollups.test.js

### T-003 — Auditor de tasks sem weight (backfill replicável)
Cria find-unweighted-tasks.js espelhando find-missing-task-summaries.js (zero-token, exit não-zero) e referencia-o no passo de anotação do decompose (Stage 6 de project-create-plan.md) como ponto de atribuição.
Files: scripts/find-unweighted-tasks.js, tests/find-unweighted-tasks.test.js, skills/shared/project-assets/project-create-plan.md
scopeBoundary: read-only; não atribui weight sozinho (o texto/proxy é autorado na skill); não toca src/decompose.js (congelado, R-ORCH-10).
acceptance: lista tasks sem weight e sai não-zero quando há ao menos uma; project-create-plan.md Stage 6 referencia o auditor como ponto de atribuição do weight.
verifier: kind shell — node --test tests/find-unweighted-tasks.test.js

```yaml
exit_gate:
  - id: G-1
    description: weight existe no schema, é somado em rollups weightDone/weightTotal, e tem auditor de backfill.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/schema-drift.test.js && node --test tests/compute-rollups.test.js
```

## F3 — Série earned-vs-planned + deadline + wiring de recompute

Goal: adicionar plan.deadline, computar a série burn-up (earned acumulado vs linha planejada linear) e o SPI no emit, e ligar o recompute ao refresh-state (fechando o gap em que ele só chama emitFocus).

### T-001 — Campo deadline no plano + rebuild do bundle
Adiciona deadline (isoTimestamp, opcional) ao plan.schema.json e regenera o bundle.
Files: meta/schemas/plan.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: campo opcional; plan.schema.json é .strict(), edição explícita; bundle regenerado pelo gerador.
acceptance: plano com deadline ISO valida; plano sem deadline continua válido; schema-drift.test.js passa.
verifier: kind shell — node --test tests/schema-drift.test.js

### T-002 — buildSeries: burnup.json + spi.json
Adiciona buildSeries() ao emit-consumer-state.js que lê completions.jsonl, bucketiza earned-weight por dia, computa a linha planejada (weightTotal no started → 0 no deadline) e o SPI, emitindo burnup.json e spi.json como bare-arrays; adiciona $defs.burnup e $defs.spi ao aideck-state.schema.json e regenera o bundle.
Files: scripts/emit-consumer-state.js, meta/schemas/aideck-state.schema.json, assets/aideck-consumer/schema.json, tests/emit-series.test.js
scopeBoundary: toda agregação é pré-computada (aiDeck não agrega); saída são bare-arrays; sem deadline emite earned sem linha planejada.
acceptance: burnup.json traz earned acumulado e a linha planejada por bucket; spi.json traz o SPI corrente; cada record emitido tem $def correspondente (validate-aideck-state verde).
verifier: kind shell — node --test tests/emit-series.test.js && node --test tests/schema-drift.test.js

### T-003 — Ligar emit ao refresh-state sem regredir emitFocus
Faz refresh-state.js disparar o emit da série (hoje importa só emitFocus), mantendo o digest emitFocus existente intacto.
Files: scripts/refresh-state.js, tests/refresh-state.test.js
scopeBoundary: additivo: adiciona o passo de emit; não remove nem altera o path emitFocus; idempotente, fail-open.
acceptance: refresh-state regenera burnup.json/spi.json além de focus.json; o digest focus.json continua sendo emitido (sem regressão).
verifier: kind shell — node --test tests/refresh-state.test.js

```yaml
exit_gate:
  - id: G-1
    description: a série earned-vs-planned + SPI é emitida e recomputada automaticamente pelo refresh-state, com deadline no schema.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/emit-series.test.js && node --test tests/refresh-state.test.js
```

## F4 — Geração de dados de calibração + endurecer closedAt

Goal: gravar os actuals crus por conclusão (calibração: só geração, tratamento depois) e promover closedAt de soft para hard no GATE-R2 quando a lacuna de instrumentação chegar perto de zero.

### T-001 — Actuals de fase no evento phase-done
Grava no evento de phase-done os stats do diff started→HEAD (arquivos, LOC, commits) como actuals crus, sem tratá-los.
Files: scripts/append-completion.js, skills/shared/project-assets/project-transitions.md, tests/append-completion-actuals.test.js
scopeBoundary: só captura/anexa actuals crus; nenhuma regressão/calibração; campos actuals opcionais no schema do evento (não quebram F0).
acceptance: o evento phase-done inclui filesChanged/locAdded/locRemoved/commits do range; ausência de git/diff degrada para actuals omitidos, sem erro.
verifier: kind shell — node --test tests/append-completion-actuals.test.js

### T-002 — Actuals de task via dispatch-log quando presente
Quando há dispatch-log.json para a task (lane codex), grava attempts/duração/escalations como actuals no evento de task-done.
Files: scripts/append-completion.js, tests/append-completion-dispatchlog.test.js
scopeBoundary: só lê dispatch-log existente; ausência não é erro (Mode-1 serial fica sem esses actuals); não cria dispatch-log nem instrumenta commits.
acceptance: com dispatch-log presente, o evento task-done inclui attempts/duração/escalations; sem dispatch-log, o evento é emitido sem esses campos.
verifier: kind shell — node --test tests/append-completion-dispatchlog.test.js

### T-003 — Promover closedAt para hard-gate no GATE-R2
Quando o auditor (F1 T-001) reporta lacuna ~0, adiciona ao checkMetInvariant (validate-state.js:364-399) a exigência de closedAt para toda task done cuja transição é posterior ao corte; legado grandfathered.
Files: scripts/validate-state.js, tests/validate-state.test.js
scopeBoundary: forward-only: legado sem closedAt não é rejeitado; não altera a regra de evidence.passed existente do GATE-R2.
acceptance: task done nova sem closedAt é rejeitada pelo validate-state; task done legada (pré-corte) sem closedAt continua válida.
verifier: kind shell — node --test tests/validate-state.test.js

```yaml
exit_gate:
  - id: G-1
    description: actuals crus são gravados por conclusão e closedAt é hard-gated forward-only sem rejeitar legado.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion-actuals.test.js && node --test tests/validate-state.test.js
```

## F5 — Render no aiDeck (depende do redesign do dashboard)

Goal: registrar os dataSources burnup/spi no manifest e uma página com line-chart (2 séries) + stat SPI, usando só widgets publicados. DEPENDÊNCIA EXTERNA: bloqueada até o redesign do dashboard (plano fix-aideck-dashboard, F2) aterrissar — o forecast só renderiza sobre o dashboard refeito; por isso é a última fase. As fases F0–F4 (instrumentação de tracking) são independentes e implementáveis já.

### T-001 — dataSources + página burn-up no manifest
Adiciona dataSources burnup e spi e uma página "Ritmo" com line-chart (planejada vs earned) + stat SPI ao manifest do consumer refeito, validando contra widgets reais.
Files: assets/aideck-consumer/manifest.yaml, tests/aideck-consumer-manifest.test.js
scopeBoundary: usa só widgets publicados (line-chart, stat); não introduz widget inexistente; não altera as páginas/dataSources existentes além do necessário ao burn-up; não inicia antes do redesign do dashboard (fix-aideck-dashboard) estar estável.
acceptance: manifest registra dataSources burnup e spi e a página com line-chart + stat; todo widget usado na página existe no registry publicado do aiDeck.
verifier: kind shell — node --test tests/aideck-consumer-manifest.test.js

```yaml
exit_gate:
  - id: G-1
    description: a página de ritmo renderiza com widgets reais ligados a burnup.json/spi.json, sobre o dashboard refeito.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/aideck-consumer-manifest.test.js
```
---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: task X says A, task Y says non-A
2. **Coverage gaps**: a requirement or constraint has no corresponding task
3. **Dependency breaks**: a task references a file/symbol no task creates
4. **Ordering bugs**: a task depends on something built only later
5. **Ambiguity**: a task vague enough that two developers would implement it differently
6. **Viability**: a decision technically infeasible or carries severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

# Required Output Format — Pass 1 (Blind)

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only — no compliments, no
"what works well", no praise. If verdict is approve, say so in one sentence
and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```<lang>
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — data loss? auth bypass? user-visible bug?
unimplementable design decision? Be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

<Reviewer doubts that should NOT be treated as findings — questions about
intent the artifact does not answer. Empty list is fine.>

- <file>:<line> — <question to author>

## Out of scope

<Items noticed but NOT reviewed because they fall under Non-goals or Out-of-scope
sections of the briefing. Empty list is fine.>

- <item>
````

## Format rules

- `<lang>` in Evidence fence: use the language of the file (`js`, `ts`, `py`, `md`, `yaml`). If unknown, leave blank.
- IDs must match regex `F-\d{3}` (e.g. `F-001`, not `F-1`, not `F-001-blind`). The `-blind` suffix is added by Pass 2 reconciliation if needed.
- Severity enum: `blocker | critical | major | minor | nit`. No other values.
- Confidence enum: `high | medium | low`. No other values.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space (no items).

## Forbidden

- Markdown other than the template above.
- Bullet lists summarizing findings outside the per-finding structure.
- "What works well" sections.
- Praise or hedging ("the author probably intends...").
- Multiple verdicts.
- Multiple frontmatter blocks.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above

Begin review now.
```

</details>

<details>
<summary>Pass 2 briefing (Pass-1 + external constraints + Pass-1 output)</summary>

```
You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming.

## Project-factual constraints (externally verifiable; NOT findings)

- Runtime: Node >= 18; tests run via `node --test` (node built-in test runner).
- JSON schemas under meta/schemas/ are strict (additionalProperties:false / .strict()): any new emitted or persisted field must be admitted in the schema, and the consumer bundle assets/aideck-consumer/schema.json must be regenerated via `npm run build:aideck-schema` or the test tests/schema-drift.test.js fails.
- The emitted dashboard state is validated by scripts/validate-aideck-state.js (Ajv, strict) against that bundle; an emitted record carrying a field the schema does not declare is rejected.
- src/decompose.js is frozen and must not be edited.
- The aiDeck v0.1 runtime has no aggregation engine: every series/count/ratio must be precomputed as a bare JSON array. Only the published widgets line-chart, stat, gauge exist.
- compute-rollups.js writes rollup fields onto each phase's source .md frontmatter; emit-consumer-state.js builds the denormalized dashboard projection.

## Non-goals (factual, no rationale)

- No predictive fixed completion-date forecast (no Monte Carlo).
- No treatment/calibration of captured actuals in v1 (capture only).
- No backfill/migration of legacy history to fill the curve.
- Git is not a source of earned-value.
- Do not edit src/decompose.js.
- No dependency on unpublished aiDeck widgets (only line-chart/stat/gauge).

## Out of scope for this review

- Style, naming, or formatting unless it hides a substantive bug.
- Alternative approaches the plan did NOT choose.
- Items in the Non-goals list above.

## Artifact to review

Path: .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/plan.md (plan.md frontmatter + source.md task specs concatenated)

---BEGIN ARTIFACT---
===== FILE: plan.md =====
---
schemaVersion: "0.1"
slug: deadline-burnup-forecast
title: Deadline Burn-up Forecast (Earned Value / SPI)
version: "1.0"
status: active
started: 2026-06-17T12:06:57.781Z
lastUpdated: 2026-06-17T12:06:57.781Z
branch: plan/deadline-burnup-forecast
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Sinal antes de cálculo
    body: Primeiro tornar o fluxo observável (a transição done emite evento
      verificável); o forecast é consequência. O RED da feature é "a transição
      done emite um evento?" — hoje não emite.
  - id: P2
    title: Capturar imutável agora, tratar depois
    body: Eventos e actuals são gravados crus no instante em que acontecem;
      regressão/calibração é fase posterior. Nenhuma fonte derivada lossy
      substitui o log de eventos.
  - id: P3
    title: Forward-only, sem histórico cosmético
    body: Enforcement de closedAt vale só para frente; legado fica closedAt:null.
      Proibido inventar closedAt retroativo em lote — colapsa a curva num degrau
      falso.
  - id: P4
    title: Uma fonte, não duas
    body: O evento de conclusão é efeito colateral atômico do próprio comando
      done/phase-done/reconcile, não um arquivo paralelo mantido à mão que
      diverge do tracker.
glossary: []
phases:
  - id: F0
    slug: deadline-burnup-forecast-f0-fonte-de-fluxo-evento-done-emitido
    title: "Fonte de fluxo: evento done emitido na transição"
    goal: criar o log append-only de conclusões (completions.jsonl) e fazer os
      passos done/phase-done/reconcile emitirem um evento imutável por
      conclusão, com schema validado. Este é o RED da feature (sem isso não há
      curva earned).
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: o completions.jsonl recebe um evento imutável por conclusão,
            validado por schema, emitido pelas três transições.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/append-completion.test.js && node --test
              tests/completion-event-schema.test.js
    status: active
    summary: Cria o log append-only de conclusões e faz a transição done emitir o
      evento — o RED do forecast.
  - id: F1
    slug: deadline-burnup-forecast-f1-closedat-forward-only-auditor-soft
    title: "closedAt forward-only: auditor soft + emissão"
    goal: tornar closedAt auditável (soft, mede a lacuna de instrumentação) e
      emiti-lo na projeção de task do dashboard, sem backfill cosmético e sem
      hard-gate ainda.
    dependsOn:
      - F0
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: closedAt é auditável (soft) e emitido na projeção; nenhum closedAt
            retroativo é inventado.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/find-unclosed-done.test.js && node --test
              tests/emit-consumer-state.test.js
    status: pending
    summary: Torna closedAt auditável (soft) e o emite na projeção, sem backfill
      cosmético.
  - id: F2
    slug: deadline-burnup-forecast-f2-peso-por-task-proxy-estrutural-roll
    title: "Peso por task: proxy estrutural + rollups"
    goal: introduzir tasks[].weight (number, opcional, default=1) derivado por proxy
      estrutural no decompose, com rollups weightDone/weightTotal espelhando
      tasksDone/tasksTotal.
    dependsOn:
      - F1
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: weight existe no schema, é somado em rollups
            weightDone/weightTotal, e tem auditor de backfill.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/schema-drift.test.js && node --test
              tests/compute-rollups.test.js
    status: pending
    summary: Dá peso de complexidade a cada task (proxy automático) e soma em
      rollups weightDone/Total.
  - id: F3
    slug: deadline-burnup-forecast-f3-serie-earned-vs-planned-deadline-wi
    title: Série earned-vs-planned + deadline + wiring de recompute
    goal: adicionar plan.deadline, computar a série burn-up (earned acumulado vs
      linha planejada linear) e o SPI no emit, e ligar o recompute ao
      refresh-state (fechando o gap em que ele só chama emitFocus).
    dependsOn:
      - F2
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: a série earned-vs-planned + SPI é emitida e recomputada
            automaticamente pelo refresh-state, com deadline no schema.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/emit-series.test.js && node --test
              tests/refresh-state.test.js
    status: pending
    summary: Computa a série earned-vs-planejada e o SPI contra o deadline,
      recomputada no refresh-state.
  - id: F4
    slug: deadline-burnup-forecast-f4-geracao-de-dados-de-calibracao-endu
    title: Geração de dados de calibração + endurecer closedAt
    goal: "gravar os actuals crus por conclusão (calibração: só geração, tratamento
      depois) e promover closedAt de soft para hard no GATE-R2 quando a lacuna
      de instrumentação chegar perto de zero."
    dependsOn:
      - F3
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: actuals crus são gravados por conclusão e closedAt é hard-gated
            forward-only sem rejeitar legado.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/append-completion-actuals.test.js && node --test
              tests/validate-state.test.js
    status: pending
    summary: Grava os actuals crus por conclusão (calibração futura) e endurece
      closedAt forward-only.
  - id: F5
    slug: deadline-burnup-forecast-f5-render-no-aideck-depende-do-redesig
    title: Render no aiDeck (depende do redesign do dashboard)
    goal: "registrar os dataSources burnup/spi no manifest e uma página com
      line-chart (2 séries) + stat SPI, usando só widgets publicados.
      DEPENDÊNCIA EXTERNA: bloqueada até o redesign do dashboard (plano
      fix-aideck-dashboard, F2) aterrissar — o forecast só renderiza sobre o
      dashboard refeito; por isso é a última fase. As fases F0–F4
      (instrumentação de tracking) são independentes e implementáveis já."
    dependsOn:
      - F4
    subPhaseCount: 1
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: a página de ritmo renderiza com widgets reais ligados a
            burnup.json/spi.json, sobre o dashboard refeito.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/aideck-consumer-manifest.test.js
    status: pending
    summary: Renderiza o burn-up/SPI no dashboard — bloqueada até o redesign do
      dashboard aterrissar.
references: []
---

# Deadline Burn-up Forecast (Earned Value / SPI)

## 1. Context

Burn-up ponderado por complexidade contra um deadline por-plano: mostra se um plano está acima/abaixo do ritmo esperado para a data-alvo, em vez de uma data fixa de conclusão. Implementa a fonte de fluxo (evento done emitido na transição), o peso por task, a série earned-vs-planned e o render no aiDeck. Fonte-de-verdade: design.md deste plano.

## 2. Inviolable principles

- **P1 Sinal antes de cálculo** — Primeiro tornar o fluxo observável (a transição done emite evento verificável); o forecast é consequência. O RED da feature é "a transição done emite um evento?" — hoje não emite.
- **P2 Capturar imutável agora, tratar depois** — Eventos e actuals são gravados crus no instante em que acontecem; regressão/calibração é fase posterior. Nenhuma fonte derivada lossy substitui o log de eventos.
- **P3 Forward-only, sem histórico cosmético** — Enforcement de closedAt vale só para frente; legado fica closedAt:null. Proibido inventar closedAt retroativo em lote — colapsa a curva num degrau falso.
- **P4 Uma fonte, não duas** — O evento de conclusão é efeito colateral atômico do próprio comando done/phase-done/reconcile, não um arquivo paralelo mantido à mão que diverge do tracker.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

===== FILE: source.md (full per-task specs: Files / scopeBoundary / acceptance / verifier) =====
# Deadline Burn-up Forecast (Earned Value / SPI)

Burn-up ponderado por complexidade contra um deadline por-plano: mostra se um plano está acima/abaixo do ritmo esperado para a data-alvo, em vez de uma data fixa de conclusão. Implementa a fonte de fluxo (evento done emitido na transição), o peso por task, a série earned-vs-planned e o render no aiDeck. Fonte-de-verdade: design.md deste plano.

## Principles

### P1 Sinal antes de cálculo
Primeiro tornar o fluxo observável (a transição done emite evento verificável); o forecast é consequência. O RED da feature é "a transição done emite um evento?" — hoje não emite.

### P2 Capturar imutável agora, tratar depois
Eventos e actuals são gravados crus no instante em que acontecem; regressão/calibração é fase posterior. Nenhuma fonte derivada lossy substitui o log de eventos.

### P3 Forward-only, sem histórico cosmético
Enforcement de closedAt vale só para frente; legado fica closedAt:null. Proibido inventar closedAt retroativo em lote — colapsa a curva num degrau falso.

### P4 Uma fonte, não duas
O evento de conclusão é efeito colateral atômico do próprio comando done/phase-done/reconcile, não um arquivo paralelo mantido à mão que diverge do tracker.

## F0 — Fonte de fluxo: evento done emitido na transição

Goal: criar o log append-only de conclusões (completions.jsonl) e fazer os passos done/phase-done/reconcile emitirem um evento imutável por conclusão, com schema validado. Este é o RED da feature (sem isso não há curva earned).

### T-001 — Helper append-completion + log JSONL
Cria o helper que faz append de uma linha JSON por conclusão em `.atomic-skills/analytics/completions.jsonl` (cria `analytics/` se ausente). Campos: ts, event, projectId, planSlug, phaseId, taskId, weight. Append-only.
Files: scripts/append-completion.js, tests/append-completion.test.js
scopeBoundary: só escreve em .atomic-skills/analytics/; nunca muta state .md; não computa série nem agrega.
acceptance: appendCompletion anexa exatamente uma linha JSON válida; analytics/ é criado idempotentemente; chamadas repetidas nunca reescrevem nem reordenam linhas já gravadas.
verifier: kind shell — node --test tests/append-completion.test.js

### T-002 — Schema do evento de conclusão + validação
Define o schema da linha do completions.jsonl e liga sua validação ao pipeline determinístico, sem quebrar o validate-state existente (que só varre .md).
Files: meta/schemas/completion-event.schema.json, scripts/validate-aideck-state.js, tests/completion-event-schema.test.js
scopeBoundary: additionalProperties:false no schema; campos exatamente os de T-001; não altera as regras cross-field do validate-state.js (GATE-R2 intacto).
acceptance: uma linha bem-formada valida; linha com campo extra ou sem ts/weight é rejeitada; o validador roda sobre o jsonl sem afetar a varredura .md do validate-state.
verifier: kind shell — node --test tests/completion-event-schema.test.js

### T-003 — Emitir o evento nas transições done/phase-done/reconcile
Liga o append-completion aos três pontos de mutação que já carimbam conclusão na skill (done, phase-done bulk-close, reconcile), no mesmo instante da transição.
Files: skills/shared/project-assets/project-transitions.md
scopeBoundary: edição de instrução de skill (prosa executada pelo modelo); não cria novo comando; um append por task fechada (phase-done em lote = N appends), nunca um <now> compartilhado.
acceptance: project-transitions.md instrui append-completion no passo done; instrui um append por task no phase-done bulk-close; instrui append no reconcile.
verifier: kind shell — grep -c "append-completion" skills/shared/project-assets/project-transitions.md | grep -qE "^[3-9]|[0-9]{2,}"

```yaml
exit_gate:
  - id: G-1
    description: o completions.jsonl recebe um evento imutável por conclusão, validado por schema, emitido pelas três transições.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion.test.js && node --test tests/completion-event-schema.test.js
```

## F1 — closedAt forward-only: auditor soft + emissão

Goal: tornar closedAt auditável (soft, mede a lacuna de instrumentação) e emiti-lo na projeção de task do dashboard, sem backfill cosmético e sem hard-gate ainda.

### T-001 — Auditor da lacuna de instrumentação
Detector zero-token que lista tasks status:done sem closedAt (a métrica que decide quando promover para hard depois), exit não-zero quando houver offenders.
Files: scripts/find-unclosed-done.js, tests/find-unclosed-done.test.js
scopeBoundary: read-only; nunca muta state nem inventa closedAt; ignora a árvore _archive-legacy (legado grandfathered).
acceptance: lista cada task done sem closedAt e sai não-zero quando há ao menos uma; sai zero quando todas as done vivas têm closedAt; ignora _archive-legacy.
verifier: kind shell — node --test tests/find-unclosed-done.test.js

### T-002 — Emitir closedAt e lastUpdated na projeção de task
Adiciona closedAt e lastUpdated à projeção de task emitida (hoje emit-consumer-state.js:255-267 carrega só id/title/summary/status/blocked/blockedBy), para a curva earned ler o instante de conclusão.
Files: scripts/emit-consumer-state.js, tests/emit-consumer-state.test.js
scopeBoundary: só adiciona campos à projeção de task; não altera outras projeções; closedAt ausente vira null (legado honesto), nunca inventado.
acceptance: a projeção de task inclui closedAt e lastUpdated; task sem closedAt na fonte emite closedAt:null.
verifier: kind shell — node --test tests/emit-consumer-state.test.js

### T-003 — Admitir closedAt na projeção do schema emitido + rebuild do bundle
Permite closedAt na projeção de task do aideck-state.schema.json (additionalProperties:false) e regenera o bundle assets/aideck-consumer/schema.json para o schema-drift.test.js passar.
Files: meta/schemas/aideck-state.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: mudança additiva no $defs da projeção de task; não toca regras cross-field; bundle regenerado pelo gerador, não editado à mão.
acceptance: aideck-state.schema.json admite closedAt na task emitida; bundle regenerado e schema-drift.test.js passa.
verifier: kind shell — node --test tests/schema-drift.test.js

```yaml
exit_gate:
  - id: G-1
    description: closedAt é auditável (soft) e emitido na projeção; nenhum closedAt retroativo é inventado.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/find-unclosed-done.test.js && node --test tests/emit-consumer-state.test.js
```

## F2 — Peso por task: proxy estrutural + rollups

Goal: introduzir tasks[].weight (number, opcional, default=1) derivado por proxy estrutural no decompose, com rollups weightDone/weightTotal espelhando tasksDone/tasksTotal.

### T-001 — Campo weight no schema da task + rebuild do bundle
Adiciona weight (number, minimum 0, opcional) ao $defs.task de initiative.schema.json e regenera o bundle.
Files: meta/schemas/initiative.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: campo opcional, fora de required (backward-compat 0.1); não toca GATE-R2; bundle regenerado pelo gerador.
acceptance: task com weight numérico valida; task sem weight continua válida; schema-drift.test.js passa após o rebuild.
verifier: kind shell — node --test tests/schema-drift.test.js

### T-002 — Rollups weightDone/weightTotal
Estende compute-rollups.js para precomputar weightTotal (soma de weight, default 1 por task sem weight) e weightDone (soma das done) por initiative, e emiti-los.
Files: scripts/compute-rollups.js, scripts/emit-consumer-state.js, tests/compute-rollups.test.js
scopeBoundary: espelha o padrão tasksDone/tasksTotal; idempotente; task sem weight conta como 1 (degrada para count-burnup).
acceptance: weightTotal soma todos os weights (1 quando ausente); weightDone soma os das done; rerun de compute-rollups é idempotente (sem diff na segunda passada).
verifier: kind shell — node --test tests/compute-rollups.test.js

### T-003 — Auditor de tasks sem weight (backfill replicável)
Cria find-unweighted-tasks.js espelhando find-missing-task-summaries.js (zero-token, exit não-zero) e referencia-o no passo de anotação do decompose (Stage 6 de project-create-plan.md) como ponto de atribuição.
Files: scripts/find-unweighted-tasks.js, tests/find-unweighted-tasks.test.js, skills/shared/project-assets/project-create-plan.md
scopeBoundary: read-only; não atribui weight sozinho (o texto/proxy é autorado na skill); não toca src/decompose.js (congelado, R-ORCH-10).
acceptance: lista tasks sem weight e sai não-zero quando há ao menos uma; project-create-plan.md Stage 6 referencia o auditor como ponto de atribuição do weight.
verifier: kind shell — node --test tests/find-unweighted-tasks.test.js

```yaml
exit_gate:
  - id: G-1
    description: weight existe no schema, é somado em rollups weightDone/weightTotal, e tem auditor de backfill.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/schema-drift.test.js && node --test tests/compute-rollups.test.js
```

## F3 — Série earned-vs-planned + deadline + wiring de recompute

Goal: adicionar plan.deadline, computar a série burn-up (earned acumulado vs linha planejada linear) e o SPI no emit, e ligar o recompute ao refresh-state (fechando o gap em que ele só chama emitFocus).

### T-001 — Campo deadline no plano + rebuild do bundle
Adiciona deadline (isoTimestamp, opcional) ao plan.schema.json e regenera o bundle.
Files: meta/schemas/plan.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: campo opcional; plan.schema.json é .strict(), edição explícita; bundle regenerado pelo gerador.
acceptance: plano com deadline ISO valida; plano sem deadline continua válido; schema-drift.test.js passa.
verifier: kind shell — node --test tests/schema-drift.test.js

### T-002 — buildSeries: burnup.json + spi.json
Adiciona buildSeries() ao emit-consumer-state.js que lê completions.jsonl, bucketiza earned-weight por dia, computa a linha planejada (weightTotal no started → 0 no deadline) e o SPI, emitindo burnup.json e spi.json como bare-arrays; adiciona $defs.burnup e $defs.spi ao aideck-state.schema.json e regenera o bundle.
Files: scripts/emit-consumer-state.js, meta/schemas/aideck-state.schema.json, assets/aideck-consumer/schema.json, tests/emit-series.test.js
scopeBoundary: toda agregação é pré-computada (aiDeck não agrega); saída são bare-arrays; sem deadline emite earned sem linha planejada.
acceptance: burnup.json traz earned acumulado e a linha planejada por bucket; spi.json traz o SPI corrente; cada record emitido tem $def correspondente (validate-aideck-state verde).
verifier: kind shell — node --test tests/emit-series.test.js && node --test tests/schema-drift.test.js

### T-003 — Ligar emit ao refresh-state sem regredir emitFocus
Faz refresh-state.js disparar o emit da série (hoje importa só emitFocus), mantendo o digest emitFocus existente intacto.
Files: scripts/refresh-state.js, tests/refresh-state.test.js
scopeBoundary: additivo: adiciona o passo de emit; não remove nem altera o path emitFocus; idempotente, fail-open.
acceptance: refresh-state regenera burnup.json/spi.json além de focus.json; o digest focus.json continua sendo emitido (sem regressão).
verifier: kind shell — node --test tests/refresh-state.test.js

```yaml
exit_gate:
  - id: G-1
    description: a série earned-vs-planned + SPI é emitida e recomputada automaticamente pelo refresh-state, com deadline no schema.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/emit-series.test.js && node --test tests/refresh-state.test.js
```

## F4 — Geração de dados de calibração + endurecer closedAt

Goal: gravar os actuals crus por conclusão (calibração: só geração, tratamento depois) e promover closedAt de soft para hard no GATE-R2 quando a lacuna de instrumentação chegar perto de zero.

### T-001 — Actuals de fase no evento phase-done
Grava no evento de phase-done os stats do diff started→HEAD (arquivos, LOC, commits) como actuals crus, sem tratá-los.
Files: scripts/append-completion.js, skills/shared/project-assets/project-transitions.md, tests/append-completion-actuals.test.js
scopeBoundary: só captura/anexa actuals crus; nenhuma regressão/calibração; campos actuals opcionais no schema do evento (não quebram F0).
acceptance: o evento phase-done inclui filesChanged/locAdded/locRemoved/commits do range; ausência de git/diff degrada para actuals omitidos, sem erro.
verifier: kind shell — node --test tests/append-completion-actuals.test.js

### T-002 — Actuals de task via dispatch-log quando presente
Quando há dispatch-log.json para a task (lane codex), grava attempts/duração/escalations como actuals no evento de task-done.
Files: scripts/append-completion.js, tests/append-completion-dispatchlog.test.js
scopeBoundary: só lê dispatch-log existente; ausência não é erro (Mode-1 serial fica sem esses actuals); não cria dispatch-log nem instrumenta commits.
acceptance: com dispatch-log presente, o evento task-done inclui attempts/duração/escalations; sem dispatch-log, o evento é emitido sem esses campos.
verifier: kind shell — node --test tests/append-completion-dispatchlog.test.js

### T-003 — Promover closedAt para hard-gate no GATE-R2
Quando o auditor (F1 T-001) reporta lacuna ~0, adiciona ao checkMetInvariant (validate-state.js:364-399) a exigência de closedAt para toda task done cuja transição é posterior ao corte; legado grandfathered.
Files: scripts/validate-state.js, tests/validate-state.test.js
scopeBoundary: forward-only: legado sem closedAt não é rejeitado; não altera a regra de evidence.passed existente do GATE-R2.
acceptance: task done nova sem closedAt é rejeitada pelo validate-state; task done legada (pré-corte) sem closedAt continua válida.
verifier: kind shell — node --test tests/validate-state.test.js

```yaml
exit_gate:
  - id: G-1
    description: actuals crus são gravados por conclusão e closedAt é hard-gated forward-only sem rejeitar legado.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion-actuals.test.js && node --test tests/validate-state.test.js
```

## F5 — Render no aiDeck (depende do redesign do dashboard)

Goal: registrar os dataSources burnup/spi no manifest e uma página com line-chart (2 séries) + stat SPI, usando só widgets publicados. DEPENDÊNCIA EXTERNA: bloqueada até o redesign do dashboard (plano fix-aideck-dashboard, F2) aterrissar — o forecast só renderiza sobre o dashboard refeito; por isso é a última fase. As fases F0–F4 (instrumentação de tracking) são independentes e implementáveis já.

### T-001 — dataSources + página burn-up no manifest
Adiciona dataSources burnup e spi e uma página "Ritmo" com line-chart (planejada vs earned) + stat SPI ao manifest do consumer refeito, validando contra widgets reais.
Files: assets/aideck-consumer/manifest.yaml, tests/aideck-consumer-manifest.test.js
scopeBoundary: usa só widgets publicados (line-chart, stat); não introduz widget inexistente; não altera as páginas/dataSources existentes além do necessário ao burn-up; não inicia antes do redesign do dashboard (fix-aideck-dashboard) estar estável.
acceptance: manifest registra dataSources burnup e spi e a página com line-chart + stat; todo widget usado na página existe no registry publicado do aiDeck.
verifier: kind shell — node --test tests/aideck-consumer-manifest.test.js

```yaml
exit_gate:
  - id: G-1
    description: a página de ritmo renderiza com widgets reais ligados a burnup.json/spi.json, sobre o dashboard refeito.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/aideck-consumer-manifest.test.js
```
---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: task X says A, task Y says non-A
2. **Coverage gaps**: a requirement or constraint has no corresponding task
3. **Dependency breaks**: a task references a file/symbol no task creates
4. **Ordering bugs**: a task depends on something built only later
5. **Ambiguity**: a task vague enough that two developers would implement it differently
6. **Viability**: a decision technically infeasible or carries severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

# Required Output Format — Pass 1 (Blind)

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only — no compliments, no
"what works well", no praise. If verdict is approve, say so in one sentence
and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```<lang>
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — data loss? auth bypass? user-visible bug?
unimplementable design decision? Be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

<Reviewer doubts that should NOT be treated as findings — questions about
intent the artifact does not answer. Empty list is fine.>

- <file>:<line> — <question to author>

## Out of scope

<Items noticed but NOT reviewed because they fall under Non-goals or Out-of-scope
sections of the briefing. Empty list is fine.>

- <item>
````

## Format rules

- `<lang>` in Evidence fence: use the language of the file (`js`, `ts`, `py`, `md`, `yaml`). If unknown, leave blank.
- IDs must match regex `F-\d{3}` (e.g. `F-001`, not `F-1`, not `F-001-blind`). The `-blind` suffix is added by Pass 2 reconciliation if needed.
- Severity enum: `blocker | critical | major | minor | nit`. No other values.
- Confidence enum: `high | medium | low`. No other values.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space (no items).

## Forbidden

- Markdown other than the template above.
- Bullet lists summarizing findings outside the per-finding structure.
- "What works well" sections.
- Praise or hedging ("the author probably intends...").
- Multiple verdicts.
- Multiple frontmatter blocks.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above


## External constraints (verifiable)

The constraints below are verifiable externally. Each line includes how to
verify if needed. Treat as ground truth.

- initiative.schema.json `$defs/task` already declares `closedAt` (and `lastUpdated`) but does NOT declare `weight`. Verify: `node -e 'console.log(Object.keys(require("./meta/schemas/initiative.schema.json").$defs.task.properties))'`.
- initiative.schema.json top-level object is additionalProperties:false and declares `tasksDone/tasksTotal/gatesMet/gatesTotal` but NOT `weightDone/weightTotal`. Verify: same file, top-level properties.
- aideck-state.schema.json `$defs.tasks` (emitted task projection) is additionalProperties:false and declares NEITHER `closedAt` NOR `lastUpdated`. Verify: `node -e 'console.log(Object.keys(require("./meta/schemas/aideck-state.schema.json").$defs.tasks.properties))'`.
- aideck-state.schema.json `$defs.initiatives` (emitted initiative projection) is additionalProperties:false and declares `tasksDone/tasksTotal` but NOT `weightDone/weightTotal`.
- compute-rollups.js writes its rollup keys onto each phase's SOURCE .md frontmatter (writeFileSync); those frontmatters are schema-validated by validate-state.js against initiative.schema.json.
- validate-aideck-state.js is the strict Ajv (draft-07) CI gate that validates the emitted projection against the bundle assets/aideck-consumer/schema.json; an emitted record with an undeclared field is rejected.
- tests/schema-drift.test.js only asserts the committed bundle equals a fresh regeneration of meta/schemas/ (`build-aideck-consumer-schema.mjs --check`); it does NOT validate emitted runtime state against the schema.
- The F0 completion-event line includes a `weight` field; F2 is the phase that introduces `tasks[].weight` and its assignment path; the completions.jsonl log is append-only and legacy backfill is a non-goal.
- F4 records raw actuals fields (filesChanged/locAdded/locRemoved/commits; attempts/duration/escalations) on completion events.
- src/decompose.js is frozen (must not be edited).

## Pass 1 (blind) findings

The following findings were produced by your previous review WITHOUT the
constraints above. Re-evaluate each against the constraints.

---BEGIN PASS 1 OUTPUT---
---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has multiple schema and gate-coverage gaps that will let phases pass while the implemented system still rejects its own emitted data or fails to instrument the core transition path. The highest-risk issue is the forward-only `closedAt` hard gate: it requires distinguishing legacy from new done tasks, but the plan defines no persisted cutoff or deterministic classification rule.

Several tasks also emit or persist new fields without admitting all of those fields in the strict schemas or regenerated consumer bundle. Those gaps will surface as `schema-drift`, Ajv validation failures, or invalid completion-event records during implementation.

## Findings

### F-001 [major] coverage — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:37-52

**Evidence:**
```md
### T-003 — Emitir o evento nas transições done/phase-done/reconcile
Liga o append-completion aos três pontos de mutação que já carimbam conclusão na skill (done, phase-done bulk-close, reconcile), no mesmo instante da transição.
Files: skills/shared/project-assets/project-transitions.md
scopeBoundary: edição de instrução de skill (prosa executada pelo modelo); não cria novo comando; um append por task fechada (phase-done em lote = N appends), nunca um <now> compartilhado.
acceptance: project-transitions.md instrui append-completion no passo done; instrui um append por task no phase-done bulk-close; instrui append no reconcile.
verifier: kind shell — grep -c "append-completion" skills/shared/project-assets/project-transitions.md | grep -qE "^[3-9]|[0-9]{2,}"

```yaml
exit_gate:
  - id: G-1
    description: o completions.jsonl recebe um evento imutável por conclusão, validado por schema, emitido pelas três transições.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion.test.js && node --test tests/completion-event-schema.test.js
```

**Claim:** The F0 exit gate claims transition emission is verified, but it does not run the only T-003 verifier that checks `done`, `phase-done`, and `reconcile` wiring.

**Impact:** F0 can be marked complete with a working append helper and schema while no real transition emits completion events, leaving the earned curve with no production data.

**Recommendation:** Add a transition-wiring verifier to the F0 gate, preferably a real test over `project-transitions.md` that asserts the three distinct transition instructions and one-per-task bulk behavior, not only the append helper/schema tests.

**Confidence:** high

---

### F-002 [major] schema — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:65-77

**Evidence:**
```md
### T-002 — Emitir closedAt e lastUpdated na projeção de task
Adiciona closedAt e lastUpdated à projeção de task emitida (hoje emit-consumer-state.js:255-267 carrega só id/title/summary/status/blocked/blockedBy), para a curva earned ler o instante de conclusão.
Files: scripts/emit-consumer-state.js, tests/emit-consumer-state.test.js
scopeBoundary: só adiciona campos à projeção de task; não altera outras projeções; closedAt ausente vira null (legado honesto), nunca inventado.
acceptance: a projeção de task inclui closedAt e lastUpdated; task sem closedAt na fonte emite closedAt:null.
verifier: kind shell — node --test tests/emit-consumer-state.test.js

### T-003 — Admitir closedAt na projeção do schema emitido + rebuild do bundle
Permite closedAt na projeção de task do aideck-state.schema.json (additionalProperties:false) e regenera o bundle assets/aideck-consumer/schema.json para o schema-drift.test.js passar.
Files: meta/schemas/aideck-state.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: mudança additiva no $defs da projeção de task; não toca regras cross-field; bundle regenerado pelo gerador, não editado à mão.
acceptance: aideck-state.schema.json admite closedAt na task emitida; bundle regenerado e schema-drift.test.js passa.
```

**Claim:** F1 emits `lastUpdated` in task records but only admits `closedAt` in the emitted task schema.

**Impact:** `emit-consumer-state.js` will produce task records with an undeclared `lastUpdated` field, and strict `aideck-state.schema.json` / consumer bundle validation will reject the dashboard state.

**Recommendation:** Update F1 T-003 to admit both `closedAt` and `lastUpdated` in the emitted task `$defs.tasks`, regenerate `assets/aideck-consumer/schema.json`, and include validation of both fields in the task projection test.

**Confidence:** high

---

### F-003 [major] schema — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:100-105

**Evidence:**
```md
### T-002 — Rollups weightDone/weightTotal
Estende compute-rollups.js para precomputar weightTotal (soma de weight, default 1 por task sem weight) e weightDone (soma das done) por initiative, e emiti-los.
Files: scripts/compute-rollups.js, scripts/emit-consumer-state.js, tests/compute-rollups.test.js
scopeBoundary: espelha o padrão tasksDone/tasksTotal; idempotente; task sem weight conta como 1 (degrada para count-burnup).
acceptance: weightTotal soma todos os weights (1 quando ausente); weightDone soma os das done; rerun de compute-rollups é idempotente (sem diff na segunda passada).
verifier: kind shell — node --test tests/compute-rollups.test.js
```

**Claim:** F2 persists and emits `weightDone`/`weightTotal` but does not include any task to admit those rollup fields in the strict source or emitted-state schemas.

**Impact:** `compute-rollups.js` will write undeclared frontmatter fields, and `emit-consumer-state.js` will emit undeclared projection fields; strict validation or schema drift tests will fail after the rollups are added.

**Recommendation:** Add `weightDone` and `weightTotal` to the relevant source frontmatter schema and emitted aiDeck schema, regenerate `assets/aideck-consumer/schema.json`, and include `schema-drift.test.js` in the F2 gate.

**Confidence:** high

---

### F-004 [major] ordering — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:23-24

**Evidence:**
```md
### T-001 — Helper append-completion + log JSONL
Cria o helper que faz append de uma linha JSON por conclusão em `.atomic-skills/analytics/completions.jsonl` (cria `analytics/` se ausente). Campos: ts, event, projectId, planSlug, phaseId, taskId, weight. Append-only.
```

**Claim:** F0 requires every completion event to carry `weight` before F2 introduces `tasks[].weight` and its assignment path.

**Impact:** Completions recorded during F0 and F1 have no defined source for `weight`; if they default to `1`, later weighted series will permanently mix default-count events with proxy-weighted events because the log is append-only and legacy backfill is out of scope.

**Recommendation:** Move the task weight schema/defaulting contract before completion events are emitted, or explicitly define F0 event `weight` as `1` until F2 and mark the resulting early events as count-based so F3 can handle mixed semantics deterministically.

**Confidence:** high

---

### F-005 [major] schema — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:30-35

**Evidence:**
```md
### T-002 — Schema do evento de conclusão + validação
Define o schema da linha do completions.jsonl e liga sua validação ao pipeline determinístico, sem quebrar o validate-state existente (que só varre .md).
Files: meta/schemas/completion-event.schema.json, scripts/validate-aideck-state.js, tests/completion-event-schema.test.js
scopeBoundary: additionalProperties:false no schema; campos exatamente os de T-001; não altera as regras cross-field do validate-state.js (GATE-R2 intacto).
acceptance: uma linha bem-formada valida; linha com campo extra ou sem ts/weight é rejeitada; o validador roda sobre o jsonl sem afetar a varredura .md do validate-state.
```

**Claim:** F0 locks the completion-event schema to exactly the base fields, but F4 later adds actuals fields without listing `completion-event.schema.json` as a file to update.

**Impact:** Phase-done or task-done events containing `filesChanged`, `locAdded`, `locRemoved`, `commits`, `attempts`, duration, or escalations will be rejected as additional properties by the strict event schema.

**Recommendation:** Add a F4 schema task or expand F4 T-001/T-002 to update `meta/schemas/completion-event.schema.json` and `tests/completion-event-schema.test.js` for the optional actuals fields before any actual-bearing events are emitted.

**Confidence:** high

---

### F-006 [critical] ambiguity — .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:177-181

**Evidence:**
```md
### T-003 — Promover closedAt para hard-gate no GATE-R2
Quando o auditor (F1 T-001) reporta lacuna ~0, adiciona ao checkMetInvariant (validate-state.js:364-399) a exigência de closedAt para toda task done cuja transição é posterior ao corte; legado grandfathered.
Files: scripts/validate-state.js, tests/validate-state.test.js
scopeBoundary: forward-only: legado sem closedAt não é rejeitado; não altera a regra de evidence.passed existente do GATE-R2.
acceptance: task done nova sem closedAt é rejeitada pelo validate-state; task done legada (pré-corte) sem closedAt continua válida.
```

**Claim:** The hard gate depends on a “posterior ao corte” cutoff, but no task defines where that cutoff is stored, how it is computed, or what schema admits it.

**Impact:** `validate-state.js` cannot deterministically distinguish legacy done tasks from new done tasks without guessing from mutable timestamps or rejecting valid legacy state; the F4 acceptance criteria are not implementable as written.

**Recommendation:** Define a persisted cutoff source, schema admission, and validation rule before F4 T-003, then test tasks on both sides of that cutoff explicitly.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md:136 — What exact SPI formula should be emitted when planned value is zero, deadline is missing, or the current date is outside `[started, deadline]`?

## Out of scope

- Fixed completion-date forecasting and Monte Carlo behavior are not reviewed because they are listed as non-goals.
- Backfilling legacy history is not reviewed because it is listed as a non-goal.
- Git as earned-value source is not reviewed because it is listed as a non-goal.---END PASS 1 OUTPUT---

## Your task in this pass

1. Re-evaluate ALL findings from Pass 1 against the External Constraints.
   For EACH Pass 1 finding, decide one of:
   - **DROP** — finding is invalid given a constraint or non-goal
   - **MAINTAIN** — finding stands, severity unchanged
   - **REFINE** — finding stands but severity changes

2. Identify NEW findings that emerge ONLY because of these constraints
   (e.g. the artifact violates a constraint you couldn't see in Pass 1).

3. Output the FULL final findings list (use new sequential IDs starting at
   F-001) plus a complete `## Pass 2 reconciliation` block.

## Output format

# Required Output Format — Pass 2 (Informed)

Same template as Pass 1 PLUS an obligatory `## Pass 2 reconciliation` block.
You MUST respond in this exact structure.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id>
pass: informed
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words>

## Findings

### F-001 [<severity>] <category> — <file>:<line>

**Evidence:** <...>
**Claim:** <...>
**Impact:** <...>
**Recommendation:** <...>
**Confidence:** <...>

---

### F-002 ... (final IDs — these are the post-constraints findings)

## Questions (non-findings)

- <file>:<line> — <question>

## Out of scope

- <item>

## Pass 2 reconciliation

### Dropped from blind pass

<For each Pass 1 finding you are dropping, write one line:>

- F-001-blind [<severity>] <category> — DROPPED: <one-sentence reason citing
  which constraint or non-goal makes it invalid>

<If no drops: write `- _(none)_`>

### Maintained

<For each Pass 1 finding kept (with or without severity change):>

- F-002-blind → F-001-final [<severity>] — <same | severity changed: was X, now Y>

<If no maintained: write `- _(none)_`>

### Emerged

<For each NEW finding that surfaced only because constraints were revealed:>

- F-XXX-final [<severity>] <category> — emerged: <one-sentence reason citing
  the constraint that triggered the finding>

<If no emerged: write `- _(none)_`>
````

## Rules specific to Pass 2

- Final findings use sequential IDs `F-001, F-002, ...` (no `-final` suffix in the `## Findings` section — only in reconciliation references).
- In reconciliation, refer to blind findings with `-blind` suffix and maintained mappings with `→ F-XXX-final`.
- `counts` is the COUNT OF FINAL findings (post-reconciliation), not blind.
- `pass: informed` (literal).
- All universal rules from `output-template-pass1.md` apply.

Begin reconciliation now.
```

</details>

## Fixes applied in this session

<!-- Append-only. -->
Re-spec applied 2026-06-17 via `atomic-skills:project` (corrected source.md + synced plan.md + phases/f*.md). All GREEN: `validate-state` 7/7, `validate-aideck-state` ok, `lint-task-titles` ok.

- **F-006 (critical) → APPLIED** — F4/T-003 now defines a persisted forward-only cutoff `closedAtHardening {enforcedFrom, grandfatheredTaskIds}` in plan.schema.json; validate-state rejects a new done task without closedAt unless its id ∈ grandfatheredTaskIds. (User decision: define persisted cutoff now.)
- **F-003/L1 (major) → APPLIED** — F2/T-001 adds weightDone/weightTotal to initiative.schema top-level AND aideck-state $defs/initiatives + bundle rebuild; F2 gate now runs emit-consumer-state.test.js (catches projection drift).
- **F-002/L2 (major) → APPLIED** — F1/T-003 admits BOTH closedAt AND lastUpdated in $defs/tasks; F1/T-002 asserts validateAideckState (no drift).
- **F-001/L3 (major) → APPLIED** — new F0/T-004 (tests/emit-on-transition.test.js) proves the RED behaviorally; F0 gate runs it (replaces prose-grep). subPhaseCount 3→4. (User decision: integration harness.)
- **F-004 (major) → APPLIED** — F0/T-001 event carries weight=1 + weightBasis:'count'|'proxy' (immutable capture); F3/T-002 buildSeries respects weightBasis. (User decision: B1.)
- **F-005 (major) → APPLIED** — F0/T-002 pre-declares an optional `actuals` sub-object (additionalProperties:false) on completion-event.schema; F4 fills it without re-touching the locked schema.
- **L4/#7 (significant) → APPLIED** — F5 carries a schema-sanctioned `externalImports[]` (repo-path → fix-aideck-dashboard/plan.md) instead of prose-only blocking.
- **L5/#8 (minor) → APPLIED** — F3 goal/T-003 corrected: refresh-state roda rollups+reconcile+emitFocus, NÃO invoca emit-consumer-state (was the inaccurate "só chama emitFocus").
- **L7/#9 (minor) → RECORDED** — divergence note added to source.md top; design.md NOT edited (HARD-GATE).
- **codex Question (SPI edge cases) → ADDRESSED** — F3/T-002 defines SPI null on planned-zero / no-deadline / date outside [started, deadline].

## Self-review against code-quality gates

- G1 read-before-claim: applied — every local claim cites verified file:line (validate-state.js:364-399 read; emit-consumer-state.js:253-268 read; refresh-state.js:17-25 read; schema $defs inspected via node).
- G2 soft-language: applied — ran ban-list grep over plan.md + source.md → 0 occurrences.
- G6 reference-or-strike: applied — each finding carries a verbatim path/command/line.
- Initiative-depth: 6/6 initiatives discovered; gate-task alignment: F0 gate (RED) and F2 gate found under-covering their own exit criteria (L3/L1).
