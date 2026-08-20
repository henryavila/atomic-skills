# Plan-end local review — project-flow

**Mode:** local (operator: no family-different reviewer available)
**At:** 2026-08-17T13:30:00Z
**Range:** 3a76f8ed..025269ca
**HEAD:** b0cd40f9
**commitSha:** 025269cac13c6f1c3fd7a1b11264856b531186da
**patchId:** 2e9098996737672f05550386bd30e455e149cadc
**DESTRUCTIVE:** false (1810+/633-)
**Provider:** local
**Passes:** 3 (sealed subagent, then host G1 triage)
**executionMode stamp:** omitted

`planEndReviewOk`: **false** — receipt mode is `local`, gate requires `external-both`.
Finalize/archive: **blocked**.

## Analysis Summary

**Ref/scope:** 3a76f8ed..025269ca
**Mode:** local
**Provider:** local
**Files reviewed:** 25 product paths (+ captured core diff)
**Passes (local):** 3
**Counts (local):** blocker: 0, critical: 0, major: 1, minor: 2

| # | Finding | Severity | Provider | File:line | Action |
|---|---------|----------|----------|-----------|--------|
| 1 | Leftover `process-map` CLI can print ready without reviews close | major | local | scripts/creation-gates.js:63; scripts/assert-creation-stage.js:48,199-225 | recorded — no product fix (host-thin) |
| 2 | Stamp/HTML sha omits optional description fields | minor | local | scripts/lib/render-flow.js:214; scripts/find-missing-flow.js:102-104 | recorded — fingerprint matches HTML by design |
| 3 | Subgraph depth/cycle only from root subprocess nodes | minor | local | scripts/lib/validate-flow.js:276-284 | recorded |

**Reviews saved at:** `.atomic-skills/reviews/2026-08-17-plan-end-local-project-flow.md`
**Final status:** Code approved with caveats (1 major leftover-stage CLI hole; 2 minor fingerprint/depth gaps)
**Suggestion:** do not finalize on this receipt. External-both still required for `planEndReviewOk`.

## Triage (host G1)

### F-001 major — real (CLI honesty), remap-to-reviews is specified

`readCreationGate` normalizes `process-map` → `reviews` (`scripts/creation-gates.js:93-94`). T-010 asked for that remap.

`assert-creation-stage.js` `loadGate` (`:105`) parses **raw** JSON. Then:

- `--at ready`: `assertAtStage` uses `STAGE_INDEX[cur]` on raw `process-map` (`:48-57`). `undefined < expIdx` is false → `{ ok: true }`.
- `--ready --write`: `assertReady` with `advancing` calls `assertCanAdvance('process-map','ready')` which remaps from→reviews then reviews→ready is legal (`creation-gates.js:167-188`). Write only if raw `gate.stage === 'reviews'` (`assert-creation-stage.js:202`). Raw `process-map` skips persist and still prints `ready ✓` (`:224-225`).

Verified by reading those lines. Not applied (automate host-thin). Disposition: operator.

### F-002 minor — real, consistent with HTML sha

`flowDocumentSha` = `contentFingerprint(normalizeFlow(doc))` (`find-missing-flow.js:102-104`). `normalizeFlow` / `normalizeMachines` drop root `description` and machine-node `description` (`render-flow.js:161-164`, `:214-229`). Comment says the stamp matches HTML content-sha. Residual: those optional schema fields can change after ratify without `--strict` noticing.

### F-003 minor — real

`validateSubgraphDepth` only starts from root `graph.nodes` subprocess refs (`validate-flow.js:276-284`). `renderBpm` still emits every subgraph (`render-flow.js:394-401`). Unreferenced deep/cyclic subgraphs can validate and still show.

## Intent vs delivered (scored)

| # | status | label | note |
|---|--------|-------|------|
| 1 | matched | F0 schema 1.0 MODEL + validate-flow rejects old shape | meta/schemas/flow.schema.json:20; tests/validate-flow.test.js |
| 2 | matched | Implement recusa plano sem flow ratificado | skills/core/implement.md:151-169; assert-automate-gate.js:826 |
| 3 | partial | Draft grafo from design/source/BI not phases[] | skill-only (`project-flow.md`); no static ban in generate code |
| 4 | matched | Sem dual-read process.yaml; effects[] vazio ok; sem PDTI core | tests/validate-flow.test.js; tests/find-missing-flow.test.js |
| 5 | matched | F0 non-goals held | renderer/command/detector landed in F1/F2 |
| 6 | matched | G-F0-1 / G-F0-2 | tests/validate-flow.test.js |
| 7 | partial | F1 render três superfícies no DS; impecável | tokens+landmarks; layout still list; extra engine unwired |
| 8 | matched | CLI flow.html never map.html; no Mermaid engine | scripts/render-flow.js:25; tests/render-flow.test.js |
| 9 | matched | G-F1-1 / G-F1-2 | tests/render-flow.test.js |
| 10 | matched | F2 detector --strict M4+stamp+html sha; process.yaml fails | tests/find-missing-flow.test.js |
| 11 | matched | project flow command + buildFlowRatification only stamp writer | flow-ratification.js:22; project.md |
| 12 | matched | implement spawn fails closed without flow | tests/assert-automate-gate.test.js |
| 13 | partial | CREATION_STAGES summaries→reviews; leftover process-map remap | specified remap; CLI ready-lie = F-001 |
| 14 | partial | T-008 AskUserQuestion before stamp | skill can skip ask when stamp matches (`project-flow.md`) |
| 15 | extra | Diagram engine flow-layout/flow-draw not called from render-flow | scripts/lib/flow-layout.js; flow-draw.js |
| 16 | extra | HTTP show serve-flow; plan flow instance + brief | scripts/serve-flow.js; project-flow/flow/ |

## Legs

| provider | status | familyDifferent |
|----------|--------|-----------------|
| local | succeeded | false |
| codex | failed (prior envelope) | true |
| claude | failed (prior envelope) | true |
| grok | skipped same-family | false |

## Self-review against code-quality gates

- G1 read-before-claim: each finding verified at cited lines before recording; no product edit.
- G2 soft-language: scanned this file; completion is `planEndReviewOk: false` + findings table, not “works”.
- G3 anti-tautology: N/A (no new tests this turn).
- G4 fixture realism: N/A.
- G6 reference-or-strike: paths/commands/errors are verbatim.
- G7 anti-premature-abstraction: no helper added.
