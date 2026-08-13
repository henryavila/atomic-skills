# audit-delivery — project-flow F0

- **mode:** audit
- **depth:** light (parent greps; axes product + residual)
- **verdict:** PARTIAL
- **verifiedAt:** 2026-08-13T21:42:00Z
- **intent source:** `.atomic-skills/projects/atomic-skills/project-flow/phases/f0-modelo-no-disco.md` businessIntent + plan F0
- **degradation:** axes ran inline in shared orchestrator context — isolation degraded

## Intent Package

### Decisions
- D1: `schemaVersion` stays `"1.0"`; node types are activity|xor|and|join|subprocess|event|end; machines[] required; effects kind+label+target. (`MODEL.md`, source T-001)
- D2: validate-flow is AJV 2020 + graph rules; no PDTI; no validateProcessMap; journey walk dropped if schema drops journey. (source T-002)
- D3: dogfood rewritten; clicks only in messages; ≥1 machine; old sequence/states fail. (source T-003)

### Original problems
- P1: current schema validates `type: sequence` and dogfood without machines[].
- P2: PDTI status rules must not enter core validator.

### Acceptance / doneWhen
- G-F0-1: suite green; dogfood validates with machines[]; sequence probe invalid.
- G-F0-2: schemaVersion const 1.0; no PDTI strings in validate-flow.js.

### Vocabulary
| OLD | NEW |
|-----|-----|
| type sequence | activity |
| type decision | xor (+ and/join) |
| root states | machines[] |
| effect.statusTo | effects[] kind+label+target |
| journey + IMPLEMENTATION_TOKEN_RE | removed from product |
| map.html | flow.html (F1; not this phase) |

### Surfaces
1. meta/schemas/flow.schema.json
2. scripts/lib/validate-flow.js
3. tests/validate-flow.test.js
4. docs/design/project-flow/dogfood/*.json
5. teaching: MODEL.md / historical dogfood HTML (out of F0 write scope)

### Non-goals
Renderer, project flow command, detector, implement HARD, Arch HTML, visual editor, npm package, PDTI feature.

## Matrix A — decisions

| ID | Status | Evidence |
|----|--------|----------|
| D1 | RESOLVED | flow.schema.json:19-21 const 1.0; :147-150 enum MODEL; :71-76 machines minItems 1; :401-413 effect kind+label+target additionalProperties false |
| D2 | RESOLVED | validate-flow.js:4 AJV 2020; :14 SUBGRAPH_MAX_DEPTH 8; no IMPLEMENTATION_TOKEN_RE; graphErrors :355-400 |
| D3 | RESOLVED | fluxo-sugestao.json machines[0] id sugestao; tests/validate-flow.test.js:126-171 fixtures; :246-272 old shapes invalid |

## Matrix B — problems

| ID | Status | Evidence |
|----|--------|----------|
| P1 | RESOLVED | tests reject sequence/decision/states; G-F0-1 probe exit 0 on merged tree |
| P2 | RESOLVED | rg no `statusTo === 10\|status 10\|three decisions` in validate-flow.js; domain-isolation test :458-480 |

## Matrix C — must-not

| Must not | Status | Evidence |
|----------|--------|----------|
| bump schemaVersion off 1.0 | RESOLVED | const 1.0 |
| copy validateProcessMap | RESOLVED | not imported |
| merge 86c1c2d4 render | RESOLVED | no render-flow.js |
| PDTI in core | RESOLVED | G-F0-2 |

## Residual hunt

OLD_TERMS × product surfaces (schema, validator, dogfood JSON): **no hits**.

Hits outside F0 write scope (accepted residual):
- `docs/design/project-flow/dogfood/fluxo-completo.html` still teaches sequence/statusTo (T-003 scopeBoundary: do not change). Class: teaching / historical. Severity: LOW.
- This plan still has `process/process.yaml` + `map.html` (process-map until T-010). Class: teaching. Severity: MEDIUM for product-as-a-whole; **N/A for F0** (outOfScope).

Residual valid: terms derived; product surfaces clean; historical leftovers dispositioned.

## Findings ledger

None CRITICAL/HIGH for F0 delivery.

## Verdict

**PARTIAL** — F0 intent delivered on admitted surfaces. Plan-level process-map + historical HTML remain until F1/F2. PARTIAL is honest (not CLOSED) because those residuals exist in-repo; they are out of F0 scope, not F0 defects.

Accept Record: process-map + fluxo-completo.html residual accepted as F1/F2 / explicit T-003 exclusion.
