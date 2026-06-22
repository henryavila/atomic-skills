---
date: 2026-06-15T16:58:24-03:00
topic: design-brief-source-of-truth (PLAN — Stage 8b)
artifact: .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/plan.md
skill: review-plan
reviewer: gpt-5-codex
codex_version: codex-cli 0.139.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 2, major: 3, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 2, major: 3, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 5, emerged: 0}
schema_version: "1.0"
---

# Cross-Model Review (PLAN, Stage 8b) — design-brief-source-of-truth

> Mode: codex (new plan Stage 8b). Composite artifact: plan.md + initiative summaries (context-only). Pre-flight --allow-dirty. Internal review (8a): G2=0, schema valid, signalless=0.

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 2, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan names the right core mechanisms but does not pin down several contracts that downstream phases depend on: catalog fields, staleness semantics, conflict resolution flow, persistence location, and executable verification. These are not cosmetic gaps; they allow F0 to complete while leaving F1/F2 to invent incompatible behavior.

The highest-risk issue is that the schema phase is supposed to establish the durable contract before reconstruction consumes it, yet the plan only describes generic validation and later introduces required fields and regime-dependent behavior outside that contract.

## Findings

### F-001 [critical] coverage gap — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/plan.md:37-47

**Evidence:**
```
goal: estabelecer o contrato persistido do catálogo — schema JSON, validação na
  emissão e cobertura pelo validate-state — antes de qualquer reconstrução
  consumi-lo.
```

```
description: schema compila, o validador emit-time rejeita catálogo malformado,
  e o validate-state cobre o catálogo durável.
```

**Claim:** F0 does not require the schema to define the fields that F1 and F2 later depend on.

**Impact:** F0 can pass with a schema that only proves generic well-formedness, then F1/F2 must retrofit `existence`, `conflicts`, `regime`, and `inputsHash` into an already “closed” contract, causing schema churn and broken validation midway through implementation.

**Recommendation:** Add explicit F0 criteria requiring the schema to define and validate all downstream catalog fields, including `existence`, `conflicts`, `regime`, `inputsHash`, provenance, and the allowed public/access/purpose/status fields.

**Confidence:** high

---

### F-002 [critical] ambiguity — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/plan.md:24-27

**Evidence:**
```
body: quando o catálogo está ausente ou stale, a reconstrução roda antes do Step
  2 consumir; route-Glob ao vivo é legado opt-in, nunca o default.
```

**Claim:** The plan makes `stale` a control-flow condition but never defines the staleness algorithm.

**Impact:** Two implementations can hash different inputs or use different freshness rules, so Step 2 may consume an obsolete catalog in one implementation and rebuild in another; this also makes the legacy route-Glob opt-in boundary unenforceable.

**Recommendation:** Define the canonical input set, hash algorithm, hash storage location, and comparison rule used to decide whether the catalog is stale.

**Confidence:** high

---

### F-003 [major] coverage gap — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/plan.md:17-20

**Evidence:**
```
body: divergência entre artefato e código vai ao operador com proveniência;
  resolução nunca é automática.
```

**Claim:** The plan requires operator resolution for divergences but provides no planned mechanism for asking, recording, or reusing that resolution.

**Impact:** Reconstruction can detect conflicts but has no defined handoff before Step 2 consumes the catalog, leaving implementers to either block indefinitely, silently pick a side, or invent incompatible resolution records.

**Recommendation:** Add a task and gate defining the operator prompt path, the persisted resolution shape in `app-map.json`, and the rule Step 2 follows when unresolved conflicts remain.

**Confidence:** high

---

### F-004 [major] ambiguity — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/plan.md:79-89

**Evidence:**
```
goal: o design-brief consome o catálogo com reconstrução-primeiro, comuta o R2
  por regime, e persiste o catálogo na árvore do app-alvo.
```

```
description: o design-brief consome o catálogo, o R2 comuta por regime, e o
  catálogo persiste no app-alvo passando pela validação emit-time.
```

**Claim:** The plan does not define the catalog’s canonical path or ownership boundary inside the target app tree.

**Impact:** Emit-time validation and `validate-state` cannot reliably locate the durable catalog, and different implementations may persist duplicate or incompatible `app-map.json` files in different directories.

**Recommendation:** Specify the exact path relative to the target app root and state whether that file is managed state, user-editable state, or generated output.

**Confidence:** high

---

### F-005 [major] viability — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/plan.md:45-51

**Evidence:**
```
- id: G-1
  description: schema compila, o validador emit-time rejeita catálogo malformado,
    e o validate-state cobre o catálogo durável.
  status: pending
  verifier:
    kind: manual
    description: Verify exit-gate prose with the user during phase-done.
```

**Claim:** The exit gate asserts executable validation outcomes but defines only a manual prose verifier.

**Impact:** A phase can be marked done without running `validate-state`, `validate-skills`, or malformed-catalog rejection tests, so the first real enforcement may happen later in CI or during installation work.

**Recommendation:** Replace the manual verifier with explicit command/test verifiers for schema compilation, emit-time rejection of a malformed fixture, and `validate-state` coverage.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/plan.md:104 — Where is the approved `design.md` path that implementers must treat as the source of truth?

## Out of scope

- Anti-contamination redesign.
- Creating the `app-map` skill now.
- Mutating human artifacts.
- Cataloging interaction or visual form.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 2, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The external constraints strengthen, not weaken, the blind-pass findings. The plan depends on JSON schema enforcement, `validate-state`, and skill validation scripts, but its gates remain prose/manual and its first phase can complete without pinning the catalog fields that later phases require.

No Pass 1 finding is invalidated by the constraints or non-goals. No new finding emerges solely from the added constraints beyond refining the verification risk already captured in F-005.

## Findings

### F-001 [critical] coverage gap — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/plan.md:37-47

**Evidence:**
```
goal: estabelecer o contrato persistido do catálogo — schema JSON, validação na
  emissão e cobertura pelo validate-state — antes de qualquer reconstrução
  consumi-lo.
```

```
description: schema compila, o validador emit-time rejeita catálogo malformado,
  e o validate-state cobre o catálogo durável.
```

**Claim:** F0 can close the durable schema contract without requiring the schema to define the fields that F1 and F2 later consume.

**Impact:** A schema that only proves generic well-formedness can pass `validate-state`, then F1/F2 must retrofit `existence`, `conflicts`, `regime`, and `inputsHash` into a supposedly established contract, causing mid-implementation schema churn and validator breakage.

**Recommendation:** Add explicit F0 gate criteria requiring the JSON schema to define and validate all downstream catalog fields: `existence`, `conflicts`, `regime`, `inputsHash`, provenance, and the allowed public/access/purpose/status fields.

**Confidence:** high

---

### F-002 [critical] ambiguity — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/plan.md:24-27

**Evidence:**
```
body: quando o catálogo está ausente ou stale, a reconstrução roda antes do Step
  2 consumir; route-Glob ao vivo é legado opt-in, nunca o default.
```

**Claim:** The plan makes `stale` a required control-flow condition but never defines the staleness algorithm.

**Impact:** Implementations can hash different inputs or use different freshness rules, so Step 2 may consume an obsolete catalog in one implementation and rebuild in another; the route-Glob opt-in boundary also becomes unenforceable.

**Recommendation:** Define the canonical input set, hash algorithm, hash storage location, and comparison rule used to decide whether the catalog is stale.

**Confidence:** high

---

### F-003 [major] coverage gap — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/plan.md:17-20

**Evidence:**
```
body: divergência entre artefato e código vai ao operador com proveniência;
  resolução nunca é automática.
```

**Claim:** The plan requires operator resolution for divergences but defines no mechanism for asking, recording, or reusing that resolution.

**Impact:** Reconstruction can detect conflicts but has no defined handoff before Step 2 consumes the catalog, leaving implementers to block indefinitely, silently pick a side, or invent incompatible resolution records.

**Recommendation:** Add a task and gate defining the operator prompt path, the persisted resolution shape in `app-map.json`, and the rule Step 2 follows when unresolved conflicts remain.

**Confidence:** high

---

### F-004 [major] ambiguity — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/plan.md:79-89

**Evidence:**
```
goal: o design-brief consome o catálogo com reconstrução-primeiro, comuta o R2
  por regime, e persiste o catálogo na árvore do app-alvo.
```

```
description: o design-brief consome o catálogo, o R2 comuta por regime, e o
  catálogo persiste no app-alvo passando pela validação emit-time.
```

**Claim:** The plan does not define the catalog’s canonical path or ownership boundary inside the target app tree.

**Impact:** Emit-time validation and `validate-state` cannot reliably locate the durable catalog, and different implementations may persist duplicate or incompatible `app-map.json` files in different directories.

**Recommendation:** Specify the exact path relative to the target app root and state whether that file is managed state, user-editable state, or generated output.

**Confidence:** high

---

### F-005 [major] viability — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/plan.md:45-51

**Evidence:**
```
- id: G-1
  description: schema compila, o validador emit-time rejeita catálogo malformado,
    e o validate-state cobre o catálogo durável.
  status: pending
  verifier:
    kind: manual
    description: Verify exit-gate prose with the user during phase-done.
```

**Claim:** The exit gate asserts executable validation outcomes but defines only a manual prose verifier.

**Impact:** A phase can be marked done without running malformed-catalog rejection tests, `npm run validate-state`, or the required skill validation path, so enforcement may fail later in CI or during integration.

**Recommendation:** Replace the manual verifier with explicit command/test verifiers for schema compilation, malformed fixture rejection, `npm run validate-state`, and `npm run validate-skills` where skill files are changed.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/plan.md:104 — Where is the approved `design.md` path that implementers must treat as the source of truth?

## Out of scope

- Anti-contamination redesign.
- Creating the `app-map` skill now.
- Mutating human artifacts.
- Cataloging interaction or visual form.

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [critical] — same
- F-002-blind → F-002-final [critical] — same
- F-003-blind → F-003-final [major] — same
- F-004-blind → F-004-final [major] — same
- F-005-blind → F-005-final [major] — same

### Emerged

- _(none)_
## Fixes applied in this session
<!-- Append-only. Triage adiciona linhas. -->

### Triage applied (2026-06-15, user: apply all 5)
- F-001 [critical] F0 gate genérico → exige schema definir+validar todos os campos do contrato. APPLIED.
- F-002 [critical] staleness indefinido → F1 T-003: inputsHash = sha256(sorted(path+conteúdo)), recompute+compare. APPLIED.
- F-003 [major] sem fluxo de resolução → nova task F1 T-004 (prompt + shape no app-map.json + regra Step 2 não-resolvido). APPLIED.
- F-004 [major] path do catálogo ambíguo → F2 T-003: path exato app-alvo/.atomic-skills/app-map/app-map.json, output gerado. APPLIED.
- F-005 [major] gates kind:manual → os 3 exit gates viraram kind:shell executáveis (testes da fase + validate-state). APPLIED.
- Re-validate-state: PASS (4 arquivos). F1 tasksTotal 3→4.
