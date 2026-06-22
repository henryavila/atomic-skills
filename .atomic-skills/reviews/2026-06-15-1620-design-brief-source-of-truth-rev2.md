---
date: 2026-06-15T16:20:52-03:00
topic: design-brief-source-of-truth (rev2 — re-review do design corrigido)
artifact: .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md
skill: review-plan
reviewer: gpt-5-codex
codex_version: codex-cli 0.139.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 4, emerged: 1}
schema_version: "1.0"
---

# Cross-Model Review (rev2) — design-brief-source-of-truth

> Mode: codex only. Re-review do design APÓS aplicar os 6 fixes da rev1 (2026-06-15-1543).
> Artefato sanitizado antes do envelope: bloco self-review + todas as anotações (F-00X) removidas (Iron Law NO-INTENT — codex vê o design como primeira vez). Pre-flight: --allow-dirty.
> **Progresso vs rev1:** blocker + 2 criticals da rev1 → FECHADOS. Restam 5 major.

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The design fixes the high-level greenfield failure, but leaves several load-bearing contracts undefined or internally inconsistent. The largest risks are that the reconstruction input set is not specified, the mandatory stale-catalog gate depends on an undecided mechanism, and the stable schema omits or downgrades fields that earlier decisions require for reconciliation.

These are implementation-shaping gaps, not polish. Two engineers could build incompatible catalog generators that both appear to satisfy this document, and `design-brief` could consume a catalog that is validated but not sufficient to perform the promised conflict handling.

## Findings

### F-001 [major] coverage_gap — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:20-23

**Evidence:**
```
A verdade, nesse estágio, está espalhada nos artefatos
(brainstorms, design docs, plano do `project`, memória), não no código.
```

**Claim:** The plan does not define which artifacts are in scope for reconstruction or how they are discovered.

**Impact:** The generated `app-map.json` becomes nondeterministic: one implementation may scan only explicit design docs, another may include memory and project plans, and another may traverse all `.atomic-skills/` state. That changes page existence, audience, access, and conflict outcomes without any schema failure.

**Recommendation:** Add a required artifact-source contract before reconstruction: allowed roots, discovery order, include/exclude patterns, whether memory is eligible, and required provenance granularity for every extracted page field.

**Confidence:** high

---

### F-002 [major] dependency_break — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:72-79

**Evidence:**
```
**Ordem
obrigatória:** quando o catálogo está **ausente OU defasado**, o `design-brief` **roda a
reconstrução primeiro** e só então o Step 2 consome — a reconstrução nunca é pulada.
```

**Claim:** The mandatory stale-catalog gate depends on a staleness mechanism that the plan leaves unresolved.

**Impact:** Step 2 cannot be implemented deterministically. It may consume stale page maps, rebuild on every run, or use an mtime/hash rule incompatible with later validation, producing different behavior across executions.

**Recommendation:** Define the staleness fingerprint in this design: exact inputs, normalization rules, storage location in `app-map.json`, and the comparison rule that forces reconstruction.

**Confidence:** high

---

### F-003 [major] contradiction — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:52-59

**Evidence:**
```
Uma linha de
página carrega: (a) **existência** `{confirmed | artefact-only | code-only | possible-alias}`;
(b) **`conflicts[]`** por-campo, cada um com `{field, artefactValue, codeValue, evidence,
resolution: pending|resolved}`; (c) **`status`** de ciclo `{built | planned | drifted |
abandoned}`.
```

**Claim:** Fields required by D3 for reconciliation are not preserved as stable required contract fields later in the design.

**Impact:** A schema-compliant catalog can omit or treat as advisory the data needed to distinguish `code-only`, `artefact-only`, `possible-alias`, and unresolved field conflicts. `design-brief` then cannot reliably decide whether to ask the operator, merge entries, or classify coverage.

**Recommendation:** Make `existence`, `regime`, `provenance`, source evidence, and unresolved `conflicts[]` part of the required schema contract, or revise D3 so those fields are not required for Step 2 behavior.

**Confidence:** high

---

### F-004 [major] ambiguity — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:110-122

**Evidence:**
```
produzindo um catálogo persistido em `.atomic-skills/projects/<project-id>/` (árvore
versionada, não ignorada — `verified_by: CLAUDE.md` install-parity).
```

**Claim:** The persistence location is underspecified for `design-brief` runs against external apps.

**Impact:** Implementations may write the catalog into the atomic-skills repo, the target app repo, or a derived project directory. That breaks repeatability, `validate-state` coverage, collision avoidance between apps, and later extraction into `app-map`.

**Recommendation:** Define the canonical root and full file paths for `app-map.json` and the regenerated `.md`, including how `<project-id>` is derived or supplied for an external target app.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:118 — Should unresolved `audience` or `accessTier` values be allowed in committed durable state, or only in a draft/intermediate catalog?

## Out of scope

- Anti-contamination redesign
- Creating the standalone `app-map` skill now
- Mutating human-authored artifacts
- Style, naming, or formatting choices
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The external constraints do not invalidate the blind-pass findings. They make the validation surface stricter: the plan proposes durable `.atomic-skills/` state and a JSON schema, but leaves key validator integration and schema-shape decisions to a later PLAN while also making Step 2 depend on them.

The remaining risk is not implementation detail polish. The spec still permits incompatible generators, stale or unvalidated catalogs, and schema-valid catalogs that lack the reconciliation data the workflow says it needs.

## Findings

### F-001 [major] coverage_gap — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:21-23

**Evidence:**
```
A verdade, nesse estágio, está espalhada nos artefatos
(brainstorms, design docs, plano do `project`, memória), não no código.
```

**Claim:** The reconstruction input set is undefined because the plan names artifact classes but does not define discoverable roots, eligibility rules, or precedence.

**Impact:** Two implementations can generate different `app-map.json` files for the same project: one may include memory, another may exclude it, and another may scan all `.atomic-skills/` state, changing page existence, audience, access, and conflicts without any validation failure.

**Recommendation:** Add a required artifact-source contract before reconstruction: allowed roots, discovery order, include/exclude patterns, whether memory is eligible, and required provenance granularity for every extracted field.

**Confidence:** high

---

### F-002 [major] dependency_break — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:72-79

**Evidence:**
```
**Ordem
obrigatória:** quando o catálogo está **ausente OU defasado**, o `design-brief` **roda a
reconstrução primeiro** e só então o Step 2 consome — a reconstrução nunca é pulada.
```

**Claim:** The mandatory stale-catalog gate depends on `defasado`, but the design leaves the staleness signal unresolved.

**Impact:** Step 2 cannot be implemented deterministically: it may consume stale maps, rebuild every run, or choose an mtime/hash rule later that changes behavior across executions.

**Recommendation:** Define the staleness fingerprint in this design: exact inputs, normalization rules, storage location in `app-map.json`, and the comparison rule that forces reconstruction.

**Confidence:** high

---

### F-003 [major] contradiction — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:52-116

**Evidence:**
```
Uma linha de
página carrega: (a) **existência** `{confirmed | artefact-only | code-only | possible-alias}`;
(b) **`conflicts[]`** por-campo, cada um com `{field, artefactValue, codeValue, evidence,
resolution: pending|resolved}`; (c) **`status`** de ciclo `{built | planned | drifted |
abandoned}`.
```

**Claim:** D3 requires existence and field-level conflicts for reconciliation, but the later stable contract omits `existence` and downgrades `conflicts[]/aliases` to advisory.

**Impact:** A schema-valid catalog can lack the data needed to distinguish `code-only`, `artefact-only`, `possible-alias`, and unresolved field conflicts, so `design-brief` cannot reliably decide whether to ask the operator, merge entries, or classify coverage.

**Recommendation:** Make `existence`, `regime`, source evidence, provenance, and unresolved `conflicts[]` required schema fields, or revise D3 so those fields are explicitly transient and not needed by Step 2 behavior.

**Confidence:** high

---

### F-004 [major] ambiguity — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:110-112

**Evidence:**
```
produzindo um catálogo persistido em `.atomic-skills/projects/<project-id>/` (árvore
versionada, não ignorada — `verified_by: CLAUDE.md` install-parity).
```

**Claim:** The persistence location is underspecified for `design-brief` runs against external apps.

**Impact:** Implementations may write the catalog into the atomic-skills repo, the target app repo, or a derived project directory, breaking repeatability, collision avoidance between apps, and `validate-state` coverage.

**Recommendation:** Define the canonical root and full file paths for `app-map.json` and the regenerated `.md`, including how `<project-id>` is derived or supplied for an external target app.

**Confidence:** high

---

### F-005 [major] dependency_break — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:134-141

**Evidence:**
```
**Validação:** o catálogo persistido é validado como
**state durável** — não escapa do `validate-state`; o schema vive em
`meta/schemas/app-map.schema.json` e a fiação exata no mecanismo de descoberta de schemas do
`scripts/validate-state.js` aterrissa no **PLAN**
```

**Claim:** The design defers the `validate-state` discovery wiring even though durable `.atomic-skills/` state must be schema-validated.

**Impact:** The implementation can add `app-map.schema.json` and still have `npm run validate-state` pass while ignoring invalid `app-map.json` files, leaving the new durable catalog outside the enforced state gate.

**Recommendation:** Specify the validator contract here: file path pattern, schema id/key, collection behavior in `validate-state`, failure mode for malformed catalogs, and a fixture/test that proves invalid `app-map.json` fails validation.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:118 — Should unresolved `audience` or `accessTier` values be allowed in committed durable state, or only in a draft/intermediate catalog?

## Out of scope

- Anti-contamination redesign
- Creating the standalone `app-map` skill now
- Mutating human-authored artifacts
- Style, naming, or formatting choices

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same
- F-003-blind → F-003-final [major] — same
- F-004-blind → F-004-final [major] — same

### Emerged

- F-005-final [major] dependency_break — emerged: the external constraint that durable `.atomic-skills/` state is validated by `npm run validate-state` makes deferred validator discovery wiring a substantive gap.
## Self-review against code-quality gates (review-plan)
- G1/G2/G6: design re-lintado --migration PASS; claims de código existente com verified_by; G2 ban-list 0 real.
- Initiative-depth: 0/0 phases (design doc) — checks 14–20 N/A.

## Briefings used
- Pass 1 (sealed, sanitizado): /tmp/codex-briefing-pass1-20260615-162052.md
- Pass 2 (informed): /tmp/codex-briefing-pass2-20260615-162052.md
  (referenciados por caminho — contêm o artefato design inline 2x; outputs+verdict+Δ acima são o valor de auditoria)

## Fixes applied in this session
<!-- Append-only. Triage adiciona linhas conforme o usuário aprova/pula. -->

### Triage applied (2026-06-15, user: revisão de contrato + ir pro PLAN)
- F-003 [major] D3↔contrato (existence/conflicts advisory) → Chosen approach: campos REQUERIDOS incluem existence+regime+provenance+conflicts[] não-resolvidos; só aliases advisory. APPLIED (design fix).
- F-004 [major] persistência app externo → Chosen approach: catálogo na árvore do APP-ALVO (`<app-alvo>/.atomic-skills/app-map/app-map.json`), <project-id>=id do alvo; árvore deste repo só no dogfooding. APPLIED (design fix).
- F-001 [major] contrato de fontes → novo D8: fontes={brainstorms,design docs,project plan,memória(elegível)}, proveniência por-campo; discovery/precedência/patterns → PLAN. APPLIED (contrato).
- F-002 [major] sinal de staleness → D5: `inputsHash`=hash de conteúdo das fontes, recompute-e-compara força reconstrução; inputs/normalização → PLAN. APPLIED (contrato).
- F-005 [major] validate-state wiring → Blast radius: validação EMIT-TIME contra o schema (gate universal p/ app externo); registro no validate-state quando em árvore tracked; fiação+fixture → PLAN. APPLIED (contrato).
- Re-lint --migration: PASS. Loop codex PARADO aqui (decisão do usuário): mecanismo de impl pertence ao PLAN; evita regresso adversarial infinito.
