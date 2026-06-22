---
date: 2026-06-17T15:08:04-03:00
topic: deadline-burnup-forecast
artifact: .atomic-skills/projects/atomic-skills/deadline-burnup-forecast/plan.md (+ source.md) — REV3 (convergence confirmation)
skill: review-plan
reviewer: gpt-5-codex
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
framing_delta: {dropped: 1, maintained: 4, emerged: 0}
mode: codex
schema_version: "1.0"
---

# Cross-Model Re-Review (REV3, convergence) — deadline-burnup-forecast

Third sealed codex envelope on the cleaned plan (commit 926a044). Convergence signal across rounds: critical 1→1→0; architectural breaks gone; round-3 pass-2 had 0 emerged. The 4 finals are spec-precision (not new architecture). All applied.

## Outcome + remediation (applied in the commit following this file)

- **F-001 (was critical→major): prose transition not behaviorally testable** — grep-count too weak; T-004 only tested the appendCompletion API. FIXED: T-003 now ships a STRUCTURAL detector (scripts/lint-transition-emits.js + tests/transition-emits.test.js) inspecting each done/phase-done/reconcile block; T-004 reframed as the API-contract test (claim downgraded from "behavioral proof of RED"). F0 gate runs the structural test (grep removed).
- **F-002: completion-event `event` had no enum** — FIXED: event enum 'task-done'|'phase-done'|'reconcile' in F0/T-002 + rejection test.
- **F-003: buildSeries scoping** — global completions.jsonl not filtered per-plan; weightTotal only an initiative rollup. FIXED: F3/T-002 filters by projectId+planSlug; weightTotal defined plan-wide; two-plan exclusion test; "hoje"=emit-time wall-clock.
- **F-004: phase-actuals cardinality** — phase diff would duplicate onto N per-task events. FIXED via the event model: phase-done emits N {task-done} + 1 {phase-done}; phase actuals go ONCE on the {phase-done} event; started=phase.started.
- **DROPPED**: weight-producer "no decompose" contradiction — codex dropped under the AI-authored-at-Stage-6 constraint; still reworded the F2 goal/summary to remove the misleading "derivado no decompose" engine implication.

Convergence reached (SDD limit): remaining precision is implement-time, caught by per-task acceptance + verifiers. Post-fix: validate-state 7/7, validate-aideck-state, lint all GREEN.

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has several execution gaps around the event log boundary: it claims behavioral proof for prose-only transitions without actually exercising those transitions, leaves completion events under-specified, and does not define the scoping needed to keep a global completions log from contaminating per-plan burn-up outputs. The weight and actuals sections also contain contradictions that can lead implementers to touch frozen code or duplicate phase-level measurements across task events.

## Findings

### F-001 [critical] viability — source.md:49-53

**Evidence:**
```md
### T-004 — Harness de integração: a transição emite o evento (prova comportamental do RED)
Teste que exercita a emissão do jeito que project-transitions.md a documenta — invoca o appendCompletion como a transição invoca — e asserta o crescimento append-only do completions.jsonl. Troca a prova do RED de "grep de prosa" (T-003) por comportamento observado, fechando o gap do gate de F0 que antes só testava helper+schema e nunca uma transição.
Files: tests/emit-on-transition.test.js
scopeBoundary: read-only sobre state .md; escreve só num completions.jsonl de fixture/tmp; chama a API pública de appendCompletion (não reescreve a prosa da skill); não depende de rede nem de um modelo.
acceptance: uma conclusão done simulada grava exatamente 1 linha; um phase-done de N tasks grava N linhas (nunca um <now> compartilhado); um reconcile grava 1 linha; cada linha gravada valida no completion-event.schema.
```

**Claim:** The proposed “behavioral” verifier does not exercise the real done/phase-done/reconcile transitions; it only tests direct calls to `appendCompletion`.

**Impact:** F0 can pass while the model-executed transition prose is semantically wrong or incomplete, so real tracker completions may still produce no `completions.jsonl` events despite the phase gate passing.

**Recommendation:** Replace T-004 with a verifier that exercises the actual transition execution path if one exists; if transitions are only prose, downgrade the claim and add a precise structural verifier that checks the required instruction blocks for done, phase-done, and reconcile, including per-task emission and required event fields.

**Confidence:** high

---

### F-002 [major] coverage — source.md:35-39

**Evidence:**
```md
### T-002 — Schema do evento de conclusão (+ weightBasis + actuals opcional) + validação
Define o schema da linha do completions.jsonl e liga sua validação ao pipeline determinístico, sem quebrar o validate-state existente (que só varre .md). Inclui weightBasis (enum obrigatório) e pré-declara um sub-objeto OPCIONAL `actuals` (additionalProperties:false interno) para os campos que F4 vai preencher — assim F4 nunca precisa destravar este schema depois.
Files: meta/schemas/completion-event.schema.json, scripts/validate-aideck-state.js, tests/completion-event-schema.test.js
scopeBoundary: additionalProperties:false no nível do evento; campos-base = os de T-001 (ts/event/projectId/planSlug/phaseId/taskId/weight/weightBasis) + `actuals` opcional (filesChanged/locAdded/locRemoved/commits/attempts/durationMs/escalations, todos opcionais, additionalProperties:false interno); não altera as regras cross-field do validate-state.js (GATE-R2 intacto).
acceptance: uma linha bem-formada valida; linha sem ts/weight/weightBasis ou com campo extra de topo é rejeitada; weightBasis fora do enum é rejeitado; uma linha com o sub-objeto actuals válido passa e com sub-chave desconhecida em actuals é rejeitada; o validador roda sobre o jsonl sem afetar a varredura .md do validate-state.
```

**Claim:** The event schema requires an `event` field but does not define or test an enum for legal event types.

**Impact:** Unknown event names can validate successfully, leaving F3’s series builder to either silently count bad events or add ad hoc filtering behavior not specified by the schema.

**Recommendation:** Define the allowed `event` enum in F0/T-002 and add acceptance cases rejecting unknown event values; align F0/T-001, F0/T-003, F3/T-002, and F4 actuals tasks to those exact event names.

**Confidence:** high

---

### F-003 [major] dependency_break — source.md:101-123

**Evidence:**
```md
Goal: introduzir tasks[].weight (number, opcional, default=1) derivado por proxy estrutural no decompose, com rollups weightDone/weightTotal espelhando tasksDone/tasksTotal — admitidos no schema source E na projeção emitida.
...
### T-003 — Auditor de tasks sem weight (backfill replicável)
Cria find-unweighted-tasks.js espelhando find-missing-task-summaries.js (zero-token, exit não-zero) e referencia-o no passo de anotação do decompose (Stage 6 de project-create-plan.md) como ponto de atribuição.
Files: scripts/find-unweighted-tasks.js, tests/find-unweighted-tasks.test.js, skills/shared/project-assets/project-create-plan.md
scopeBoundary: read-only; não atribui weight sozinho (o texto/proxy é autorado na skill); não toca src/decompose.js (congelado, R-ORCH-10).
```

**Claim:** F2 contradicts itself by saying weight is derived “no decompose” while the task scope says weight is authored in `project-create-plan.md` and `src/decompose.js` is frozen.

**Impact:** An implementer can reasonably edit the frozen decompose implementation or build an automatic producer that the project constraints explicitly rule out, creating churn and invalidating the intended auditor-enforced workflow.

**Recommendation:** Rewrite the F2 goal and frontmatter summary to state that weight is AI-authored during project-create-plan Stage 6 and auditor-enforced by `find-unweighted-tasks`; remove “derivado ... no decompose” language unless it explicitly refers to the model-executed decomposition stage, not `src/decompose.js`.

**Confidence:** high

---

### F-004 [major] ambiguity — source.md:147-151

**Evidence:**
```md
Adiciona buildSeries() ao emit-consumer-state.js que lê completions.jsonl, bucketiza earned-weight por dia e emite, como bare-arrays: (1) a **linha planejada (Planned Value)** = 0 no started → weightTotal no deadline (CRESCENTE — earned-value/burn-UP, NÃO weightTotal→0 que seria burn-down e inverteria o SPI); (2) **DUAS séries earned separadas por weightBasis** — earnedCount (eventos 'count', escala de contagem) e earnedProxy (eventos 'proxy', escala de peso) — porque o log append-only mistura os dois e somá-los confundiria escalas; (3) **SPI por basis**: spiProxy = earnedProxy / plannedValue(hoje) (comparável, mesma escala proxy do weightTotal) e spiCount (informativo, escala de contagem). Adiciona $defs.burnup e $defs.spi ao aideck-state.schema.json e regenera o bundle. Borda: planned-value zero, deadline ausente, ou data fora de [started, deadline] ⇒ SPI null (nunca divisão por zero nem extrapolação).
Files: scripts/emit-consumer-state.js, meta/schemas/aideck-state.schema.json, assets/aideck-consumer/schema.json, tests/emit-series.test.js
scopeBoundary: toda agregação é pré-computada (aiDeck não agrega); saída são bare-arrays; a linha planejada é CRESCENTE (0→weightTotal); count e proxy são séries SEPARADAS, nunca somadas; sem deadline emite earned sem linha planejada e SPI null.
acceptance: burnup.json traz, por bucket, plannedValue (0→weightTotal crescente), earnedCount e earnedProxy como séries distintas; spi.json traz spiProxy (earnedProxy/planned, e null nas bordas: planned zero / sem deadline / fora do intervalo) e spiCount; cada record emitido tem $def correspondente (validate-aideck-state verde).
```

**Claim:** The series task does not specify how to scope a global `completions.jsonl` to the current project/plan or how to aggregate `weightTotal` across the matching plan.

**Impact:** `burnup.json` and `spi.json` can include completions from other plans or compare earned values from one scope against `weightTotal` from another, producing wrong dashboard data with no schema failure.

**Recommendation:** Specify exact filtering keys for buildSeries, at minimum `projectId` and `planSlug`, and define whether `weightTotal` is plan-wide across all initiatives, phase-specific, or initiative-specific; add tests with two plans in the same analytics log proving unrelated events are excluded.

**Confidence:** high

---

### F-005 [major] ambiguity — source.md:175-179

**Evidence:**
```md
### T-001 — Actuals de fase no evento phase-done
Grava no evento de phase-done os stats do diff started→HEAD (arquivos, LOC, commits) no sub-objeto actuals (já admitido pelo completion-event.schema em F0/T-002), sem tratá-los.
Files: scripts/append-completion.js, skills/shared/project-assets/project-transitions.md, tests/append-completion-actuals.test.js
scopeBoundary: só captura/anexa actuals crus no sub-objeto já admitido; nenhuma regressão/calibração; não destrava o completion-event.schema (já pré-declarado em F0).
acceptance: o evento phase-done inclui actuals.filesChanged/locAdded/locRemoved/commits do range; ausência de git/diff degrada para actuals omitido, sem erro; a linha com actuals valida no completion-event.schema.
```

**Claim:** Phase actuals are specified as a single phase-done measurement, but F0 requires phase-done to emit one completion event per closed task.

**Impact:** The same phase-level diff can be duplicated onto N task completion events, causing captured calibration data to overcount files, LOC, and commits by the number of tasks closed in the phase.

**Recommendation:** Define separate cardinality for actuals: either store phase aggregate actuals once in a distinct phase-level event type, or omit phase aggregate actuals from per-task completion events and reserve task events for task-level dispatch-log actuals only.

**Confidence:** high

## Questions (non-findings)

- source.md:148 — What exact date source is used for “hoje” when generating SPI: wall-clock runtime, last completion timestamp, or dashboard state timestamp?
- source.md:176 — What is the concrete meaning of `started` in `started→HEAD`: plan start, phase start, branch point, or another persisted timestamp?

## Out of scope

- No finding was made for missing legacy backfill because the briefing explicitly excludes backfill/migration of legacy history.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The plan still has material verification and data-boundary gaps after applying the external constraints. The most serious issue is that the real transitions are model-executed prose, so the proposed behavioral test cannot prove those transitions emit completion events; the deterministic gate must structurally verify the prose blocks precisely.

The global append-only log and per-task phase-done cardinality also require tighter specification. Without explicit per-plan filtering and a non-duplicating actuals model, the emitted series and calibration captures can be wrong while all schemas still pass.

## Findings

### F-001 [major] viability — source.md:42-53

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

**Claim:** F0’s gate cannot prove transition wiring because T-003 only counts string occurrences and T-004 directly calls `appendCompletion` instead of verifying the prose transition blocks.

**Impact:** The phase can pass while `done`, `phase-done`, or `reconcile` prose omits the emit instruction, places it in the wrong block, misses required fields, or fails the per-task phase-done cardinality, so real tracker completions still fail to populate the log.

**Recommendation:** Replace the grep-count verifier with a structural verifier that inspects the `done`, `phase-done`, and `reconcile` blocks in `project-transitions.md` and asserts the required append instruction, required event fields, and N-per-task behavior for phase-done; keep T-004 only as an `appendCompletion` API contract test and rename its claim accordingly.

**Confidence:** high

---

### F-002 [major] coverage — source.md:35-39

**Evidence:**
```md
### T-002 — Schema do evento de conclusão (+ weightBasis + actuals opcional) + validação
Define o schema da linha do completions.jsonl e liga sua validação ao pipeline determinístico, sem quebrar o validate-state existente (que só varre .md). Inclui weightBasis (enum obrigatório) e pré-declara um sub-objeto OPCIONAL `actuals` (additionalProperties:false interno) para os campos que F4 vai preencher — assim F4 nunca precisa destravar este schema depois.
Files: meta/schemas/completion-event.schema.json, scripts/validate-aideck-state.js, tests/completion-event-schema.test.js
scopeBoundary: additionalProperties:false no nível do evento; campos-base = os de T-001 (ts/event/projectId/planSlug/phaseId/taskId/weight/weightBasis) + `actuals` opcional (filesChanged/locAdded/locRemoved/commits/attempts/durationMs/escalations, todos opcionais, additionalProperties:false interno); não altera as regras cross-field do validate-state.js (GATE-R2 intacto).
acceptance: uma linha bem-formada valida; linha sem ts/weight/weightBasis ou com campo extra de topo é rejeitada; weightBasis fora do enum é rejeitado; uma linha com o sub-objeto actuals válido passa e com sub-chave desconhecida em actuals é rejeitada; o validador roda sobre o jsonl sem afetar a varredura .md do validate-state.
```

**Claim:** The completion event schema requires an `event` field but does not define or test an enum for legal event types.

**Impact:** Unknown event names can validate successfully, forcing F3’s series builder and F4’s actuals logic to invent filtering rules or silently include/exclude malformed events with no schema failure.

**Recommendation:** Define the allowed `event` enum in F0/T-002, add rejection tests for unknown values, and align F0/T-001, F0/T-003, F3/T-002, and F4 actuals tasks to those exact event names.

**Confidence:** high

---

### F-003 [major] dependency_break — source.md:109-151

**Evidence:**
```md
### T-002 — Rollups weightDone/weightTotal
Estende compute-rollups.js para precomputar weightTotal (soma de weight, default 1 por task sem weight) e weightDone (soma das done) por initiative, e emiti-los na projeção.
```

```md
Adiciona buildSeries() ao emit-consumer-state.js que lê completions.jsonl, bucketiza earned-weight por dia e emite, como bare-arrays: (1) a **linha planejada (Planned Value)** = 0 no started → weightTotal no deadline
```

**Claim:** The series task reads the shared global `completions.jsonl` without specifying mandatory `projectId` + `planSlug` filtering, and it depends on a plan-wide `weightTotal` that F2 only defines as an initiative rollup.

**Impact:** `burnup.json` and `spi.json` can include completions from other plans or compare one plan’s earned values against the wrong denominator, producing incorrect dashboard data that still passes schema validation.

**Recommendation:** Specify that `buildSeries` filters completion events by `projectId` and `planSlug`, define `weightTotal` as the plan-wide sum across all initiatives, and add tests with two plans in the same analytics log proving unrelated events are excluded and the denominator is plan-wide.

**Confidence:** high

---

### F-004 [major] ambiguity — source.md:175-179

**Evidence:**
```md
### T-001 — Actuals de fase no evento phase-done
Grava no evento de phase-done os stats do diff started→HEAD (arquivos, LOC, commits) no sub-objeto actuals (já admitido pelo completion-event.schema em F0/T-002), sem tratá-los.
Files: scripts/append-completion.js, skills/shared/project-assets/project-transitions.md, tests/append-completion-actuals.test.js
scopeBoundary: só captura/anexa actuals crus no sub-objeto já admitido; nenhuma regressão/calibração; não destrava o completion-event.schema (já pré-declarado em F0).
acceptance: o evento phase-done inclui actuals.filesChanged/locAdded/locRemoved/commits do range; ausência de git/diff degrada para actuals omitido, sem erro; a linha com actuals valida no completion-event.schema.
```

**Claim:** Phase actuals are specified as one phase-level diff measurement, but phase-done emits one completion event per closed task.

**Impact:** The same phase-level files, LOC, and commit counts can be duplicated onto N task completion events, causing captured calibration data to overcount by the number of tasks closed in the phase.

**Recommendation:** Define separate cardinality for actuals: either store phase aggregate actuals once in a distinct phase-level event type, or omit phase aggregate actuals from per-task completion events and reserve task events for task-level dispatch-log actuals only.

**Confidence:** high

## Questions (non-findings)

- source.md:148 — What exact date source is used for “hoje” when generating SPI: wall-clock runtime, last completion timestamp, or dashboard state timestamp?
- source.md:176 — What is the concrete meaning of `started` in `started→HEAD`: plan start, phase start, branch point, or another persisted timestamp?

## Out of scope

- Legacy backfill/migration, predictive fixed completion-date forecasting, treating/calibrating actuals, using git as earned value, editing `src/decompose.js`, and unpublished aiDeck widgets were not reviewed as findings because the briefing excludes them.

## Pass 2 reconciliation

### Dropped from blind pass

- F-003-blind [major] dependency_break — DROPPED: The external constraint states weight is AI-authored at decompose Stage 6 and that “decompose” refers to model-executed authoring in `project-create-plan.md`, not the frozen `src/decompose.js`.

### Maintained

- F-001-blind → F-001-final [major] — severity changed: was critical, now major
- F-002-blind → F-002-final [major] — same
- F-004-blind → F-003-final [major] — same; refined using the global-log and plan-wide `weightTotal` constraints
- F-005-blind → F-004-final [major] — same

### Emerged

- _(none)_