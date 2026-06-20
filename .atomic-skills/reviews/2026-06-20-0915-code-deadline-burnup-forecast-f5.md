# Code review — deadline-burnup-forecast F5 (phase-done gate)

- **Date:** 2026-06-20
- **Mode:** both (local sealed-envelope agent → codex GPT-5 cross-model, blind)
- **Scope:** F5 authored work only (the dashboard redesign was reviewed on its own branch, F2/F3 reviewGates). CAPTURED_DIFF = 3 clean parts: post-merge T-001 (`8ab9c8a..HEAD` manifest Ritmo + verifier asserts + deadline) + merge resolution (`0c5cf06..8ab9c8a` emitter/schema/tests) + prep de-NUL (`e1d015a..0c5cf06`). 23284 bytes.
- **Files:** scripts/emit-consumer-state.js, meta/schemas/aideck-state.schema.json, assets/aideck-consumer/{manifest.yaml,schema.json}, tests/{aideck-consumer-manifest,emit-consumer-state,refresh-state}.test.js, plan.md, .gitattributes
- **Suite at review time:** 958 pass / 8 fail PRE-EXISTING (countSkills×3 + installSkills×5, skills-restructuring drift; merge touched none of install/skills).

## Counts
- **Local:** 1 major, 2 minor (0 blocker/critical)
- **Codex blind:** 3 major, 1 minor (0 blocker/critical); verdict needs_changes

## Findings + dispositions

| # | Source | Sev | File:line | Finding | Disposition |
|---|--------|-----|-----------|---------|-------------|
| L1 | local | major | emit-consumer-state.js:495 | SPI nulls (gauge→0) once `nowMs > deadline` (`inWindow` upper bound), even though `plannedProxyNow` clamps to `weightTotal`. Overdue plan shows SPI=0/"—" instead of the true earned/full ratio. | **F3 follow-up (out of F5 authored scope).** Real + imminent (this plan due 2026-06-21). buildSeries (F3) logic, not F5 render. Surfaced to user as emergent F3 work; does NOT fail G-1 (render wiring is correct). |
| L2/C2 | local+codex | minor/major | emit-consumer-state.js:444; manifest.yaml (Ritmo line-chart) | Chart shares one y-axis for `plannedValue` (weight-scaled) + `earnedCount` (count-scaled); `plannedValue` only baselines `earnedProxy`. | **Moot for this plan** (weightTotal 17 == tasksTotal 17 ⇒ weights=1 ⇒ scales identical). Generic for weights≠1. Spec required 3 series on one chart; documented limitation. Optional enhancement: emit `plannedCount` series. |
| L3 | local | nit | manifest.yaml (gauge); GaugeWidget.vue:56 | `displayValue` prints raw value above `max:2` while arc pins full. | **Accepted** (cosmetic; SPI>2 rare). |
| C1 | codex | major | manifest.yaml:105 (Panorama stat) | "stat uses source.agg but grammar reads config.value". | **REJECTED** — (a) out of scope: Panorama stat is dashboard-redesign code (reviewed on its branch), codex read the full file beyond the diff; (b) false positive: the v2.1 engine DOES support `source.agg` on stat — the manifest verifier explicitly asserts it (aideck-consumer-manifest.test.js:81-83). The briefing's stat grammar was the pre-v2.1 published one. |
| C3 | codex | major | emit-consumer-state.js:451 | burnup rows emitted only for days WITH completion events, not a dense daily series started→deadline. A plan with a deadline but sparse/no completions can't render a continuous planned line. | **F3 follow-up (out of F5 authored scope).** Real disjoint finding (local missed it). buildSeries (F3) day-bucketing. Also a discrepancy vs the handoff's "one record per day of the plan's life" wording. Surfaced to user; does NOT fail G-1. |
| C4 | codex | minor | aideck-state.schema.json:202 | New project fields (dotTone/fronts/moreText/idleText) added as optional, not `required`, though the emitter always writes them. | **FIXED** — added to `projects.required` (the emitter's single project-record builder always writes all four). Regenerated consumer schema; real-tree validate ✓; affected tests green. |

## Fixes applied in this session
- **C4** — `meta/schemas/aideck-state.schema.json`: added `dotTone`, `moreText`, `idleText`, `fronts` to `projects.required` (matches the existing pattern where every emitted project field is required; catches emitter/schema drift). Regenerated `assets/aideck-consumer/schema.json` via `build-aideck-consumer-schema.mjs`. Verified: real-tree `validate-state` ✓; aideck-state-schema 3/0, emit-consumer-state 16/0, aideck-consumer-manifest 30/0, refresh-state 2/0, widget-registry 4/0.

## Verdict
**F5 authored work: APPROVED with caveats.** No blocker/critical against F5's render. The one in-scope code fix (C4) is applied. The two `major` data-quality findings (L1 SPI-after-deadline, C3 sparse burnup series) are **F3/buildSeries** concerns surfaced by making the data visible — the F5 render wiring is correct (G-1 verifier 30/30) — and are routed to the user as emergent F3 follow-up decisions, not F5 blockers.

## Self-review against code-quality gates
- G1 read-before-claim: each disposition cites file:line; C4 fix made against the read `required` array (schema:202-205).
- G2 soft-language: dispositions state what was done (FIXED/REJECTED/follow-up), not "should".
- G3 anti-tautology: no new test added in this triage (C4 is covered by the existing real-tree validate test, which fails if a required field is absent from the emitted record).
- G4 fixture realism: N/A (no new fixture; validation runs against the real .atomic-skills tree).
- G7 anti-premature-abstraction: no helper introduced.
