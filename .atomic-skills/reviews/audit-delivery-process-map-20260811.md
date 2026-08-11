# Audit Delivery — process-map
**Date:** 2026-08-11  
**Mode:** audit (read-only)  
**Depth:** full (axes ran **inline in shared context** — isolation degraded; residual protocol greps + parent file reads)  
**Axes:** product, residual  
**Intent sources:** `docs/kb/process-map.md` + implementation delivered in session (skills/scripts/schema/tests)  
**Cross:** off  
**Verdict:** **OPEN**

---

## Intent Package

### Decisions
| ID | Decision | Why |
|----|----------|-----|
| D1 | **Two layers:** L1 `process/process.yaml` SoT + L2 `process/map.html` deterministic render only | HTML must not invent stages; same YAML+DS → same bytes |
| D2 | **Iron Law P1:** process map **inescapable** on multi-phase plan bootstrap before `reviews`/`ready` | User loses process without mandatory vision map |
| D3 | **Iron Law P2:** map = objective journey, **not** phase tree; no silent `phases[]` rename | Prevents cosmetic F0→F3 “map” |
| D4 | **Iron Law P4:** audience lenses layperson / developer / both via AskUserQuestion; dual copy | Same graph, two vocabularies |
| D5 | **Creation-gate stage `process-map`** between `summaries` and `reviews` | Monotonic machine stage, not optional prose |
| D6 | **Detector + implement HARD-BLOCK** when map missing on active plan (same family as ground-truth) | Teeth: agents cannot implement without L1/L2 |
| D7 | **Day-2 command** `project process` opens/re-renders HTML | Ops surface for “how/when displayed” |
| D8 | Generic AS feature (not Titan-specific); Titan only as domain example | Avoid product lock-in |

### Original problems
| ID | Problem | Expected fix shape |
|----|---------|-------------------|
| P1 | Operator gets lost in plan stages/process | Mandatory human process map at plan creation + HTML view |
| P2 | Markdown/Mermaid maps diverge from living plan state | YAML SoT under plan tree + generated HTML |
| P3 | Dev vs non-tech need different language | Dual `copy.*` + lens toggle |

### Acceptance / doneWhen
| ID | Criterion | Source |
|----|-----------|--------|
| A1 | L1 schema + validate + lint implementation tokens | process-map.md + schema |
| A2 | L2 render deterministic; `--check` / tests | process-map.md + tests |
| A3 | `new plan`/`adopt` cannot reach `ready` without process-map stage | creation-gates + stage-process-map |
| A4 | `find-missing-process-map` fails closed on missing/unratified L1 or missing L2 | detector script |
| A5 | **implement** HARD-BLOCKs when detector fails on active plan | process-map.md L101 |
| A6 | `project process` documented and dispatchable | project.md + project-process-map.md |

### Vocabulary delta
| OLD | NEW | Scope |
|-----|-----|-------|
| phase tree as “the map” | process map (objective journey) | teaching / skills |
| hand-edited MD Mermaid only | L1 YAML + L2 HTML | plan tree |
| optional onboarding guide | inescapable plan artefact | lifecycle |
| (none) | `process-map` creation stage | creation-gates |
| (none) | `audience` layperson\|developer\|both | L1 |

### Surface inventory
| Surface | Path / system | Role |
|---------|---------------|------|
| Canon docs | `docs/kb/process-map.md` | SSOT intent |
| Schema | `meta/schemas/process-map.schema.json` | L1 validation |
| Render lib/CLI | `scripts/lib/render-process-map.js`, `scripts/render-process-map.js` | L2 |
| Detector | `scripts/find-missing-process-map.js` | HARD gate script |
| Creation gates | `scripts/creation-gates.js` | stage enum |
| Skill stage | `new-plan/stage-process-map.md` | agent procedure create |
| Skill router | `skills/core/project.md` | Iron Law + dispatch |
| Create-plan | `project-create-plan.md` + adopt steps | bootstrap |
| Day-2 detail | `project-process-map.md` | `project process` |
| Tests | `tests/render-process-map.test.js`, `find-missing-process-map.test.js`, `creation-gates.test.js` | T |
| Live plan tree | `.atomic-skills/projects/**/process/` | runtime artefacts |
| Catalog | `meta/catalog.yaml` | product/agent discovery |
| Implement/verify | implement skill / project-verify | enforcement teeth |

### Non-goals / do-not-reopen
- Titan-specific map content as product SoT  
- aiDeck widget as MVP display  
- Hand-authored monólito HTML as SoT  

### Key SSOT paths
- `docs/kb/process-map.md`  
- `scripts/creation-gates.js` `CREATION_STAGES`  
- `meta/schemas/process-map.schema.json`  
- Plan tree: `process/process.yaml` + `process/map.html`  

---

## Spec Package (criteria strip — no success narrative)

- **D1** chain: schema → validateProcessMap → renderProcessMapHtml → CLI write map.html → tests byte-id  
- **D2/D5** chain: CREATION_STAGES includes process-map → stage-process-map procedure → assert-creation-stage refuse skip → ready only after process-map  
- **D3** chain: stage forbids phase rename; IMPLEMENTATION_TOKEN_RE on copy; mapsToPhases weak  
- **D4** chain: audience field + dual copy + HTML toggle when both  
- **D6** chain: find-missing-process-map → **implement** entry HARD-BLOCK (must exist)  
- **D7** chain: grammar + dispatch table → project-process-map → open browser  
- **A5** explicit: implement blocks without map  
- Non-goals: Titan lock-in, hand HTML SoT  
- Terms: process map, L1, L2, process-map stage, layperson/developer  

---

## Matrix A — Decisions (stages S C U O T X)

| ID | Decision | Expected chain | S | C | U | O | T | X | Status | Evidence |
|----|----------|----------------|---|---|---|---|---|---|--------|----------|
| D1 | L1 YAML + L2 HTML only | schema→render→CLI | ok | ok | ok | ok | ok | ok | **RESOLVED** | `meta/schemas/process-map.schema.json`; `scripts/lib/render-process-map.js`; `scripts/render-process-map.js`; tests determinism pass |
| D2 | Inescapable before ready | stage enum + procedure | ok | partial | partial | ok | ok | fail | **PARTIAL** | `CREATION_STAGES` has `process-map` (`scripts/creation-gates.js:46`); stage prose HARD; **no** file-level check on `--ready`; agent can advance stage without writing L1/L2 |
| D3 | Not phase tree | lint + stage anti-collapse | ok | partial | n/a | ok | partial | fail | **PARTIAL** | Token lint on copy (`IMPLEMENTATION_TOKEN_RE`); stage anti-collapse is **prose only** — no automated collapse detector |
| D4 | Dual audience lenses | copy + toggle | ok | ok | ok | ok | ok | ok | **RESOLVED** | validate requires both copy blocks; HTML toggle when `both`; lens tests pass |
| D5 | creation-gate process-map | enum order | ok | ok | n/a | ok | ok | ok | **RESOLVED** | summaries → process-map → reviews (`creation-gates.js`); tests assert order |
| D6 | implement HARD-BLOCK | detector→implement | ok | **fail** | **fail** | **fail** | fail | fail | **NO** | Claimed `docs/kb/process-map.md:101`; **zero** hits in implement skill / automate gates for `find-missing-process-map` |
| D7 | `project process` day-2 | dispatch→open HTML | ok | partial | partial | partial | n/a | partial | **PARTIAL** | Router grammar + `project-process-map.md` exist; **catalog** `argument_hint` omits `process`; no host binary beyond agent skill |
| D8 | Generic not Titan | kb + fixtures | ok | ok | ok | ok | n/a | partial | **RESOLVED** | kb generic; titan fixture marked anti-example; residual: example HTML still named titan |

## Matrix B — Problems

| ID | Problem | Expected fix shape | S | C | U | O | T | X | Status | Evidence |
|----|---------|-------------------|---|---|---|---|---|---|--------|----------|
| P1 | Lost in plan process | mandatory map + open HTML | ok | partial | partial | ok | ok | fail | **PARTIAL** | Machinery for create+display exists; **0/39** live plans have `process/process.yaml`; implement not gated |
| P2 | MD maps drift | YAML SoT under plan | ok | ok | ok | ok | ok | partial | **PARTIAL** | Path contract + render; live tree empty; optional `processMap` not in `plan.schema.json` |
| P3 | Dual language | layperson/developer copy | ok | ok | ok | ok | ok | ok | **RESOLVED** | dual copy enforced; HTML lenses |

## Matrix C — must-not

| ID | Must NOT | Seed | Status | Evidence |
|----|----------|------|--------|----------|
| M1 | Ready without map | P1 | **PARTIAL** | Stage order helps; no detector on `--ready` file presence |
| M2 | HTML invent stages | P3 | **RESOLVED** | render only from normalized L1 |
| M3 | Map = phases rename | P2 | **PARTIAL** | Policy prose; no machine collapse gate |
| M4 | Teach implement-block if absent | D6 | **NO** | kb teaches HARD-BLOCK that code lacks → **lying teach** |

---

## Findings Ledger

| # | Title | Sev | Axis | Evidence | Impact | Suggested fix (one-liner) |
|---|-------|-----|------|----------|--------|---------------------------|
| F1 | **implement HARD-BLOCK claimed but not implemented** | **CRITICAL** | product + residual (teaching) | `docs/kb/process-map.md:101` claims implement HARD-BLOCK; `rg find-missing-process-map` empty under implement/automate | Agents/ops believe implement is gated; work proceeds without map | Wire `find-missing-process-map` into implement entry (Mode 1 + automate) like ground-truth |
| F2 | **ready can be staged without L1/L2 files** | **HIGH** | product | `assert-creation-stage --ready` only checks stage enum, not files; stage-process-map step 6 is agent discipline | Iron Law P1 bypassable by advancing gate without writing process/ | On advance `process-map` and `--ready`, run detector HARD |
| F3 | **0/39 live plans have process/** | **HIGH** | residual | `find .atomic-skills/projects -path '*/process/process.yaml'` → 0; plan.md count 39 | Existing AS dogfood tree violates P1 if law applies retroactively | Migration path or explicit grandfather; detector policy for legacy |
| F4 | **verify does not call find-missing-process-map** | **HIGH** | product | no match in `project-verify.md` | Drift invisible in daily verify | Add check #N to verify |
| F5 | **plan.schema lacks processMap mirror field** | **MEDIUM** | product | `rg processMap meta/schemas/plan.schema.json` empty; kb shows optional frontmatter | Optional stamp may fail validate-state if written | Add optional `processMap` to plan.schema or drop stamp |
| F6 | **catalog argument_hint omits `process`** | **MEDIUM** | residual (teaching) | `meta/catalog.yaml` project argument_hint list without process | Discovery incomplete for agents using catalog | Add `process` to hint + description |
| F7 | **No automated phase-collapse detector** | **MEDIUM** | product | stage-process-map anti-collapse is prose only | D3 partially unenforced | Script: warn/HARD if main bijection to phases titles |
| F8 | **Plugin install may lag workspace** | **MEDIUM** | residual | Delivery is in repo; runtime plugin path separate | Host may not see stage until reinstall | Install/sync skill package after merge |
| F9 | **Example out/*.html still teach titan delivery shape** | **LOW** | residual | fixtures/titan-v01 anti-example present in out/ | Confusion if mistaken for template | Prefer quality-judge as only “good” sample in README |

---

## Residual (ordered)

| # | Title | Sev | Class | Evidence | Status |
|---|-------|-----|-------|----------|--------|
| R1 | Teaching: implement HARD-BLOCK without code | CRITICAL | teaching | kb:101 vs empty implement wiring | OPEN |
| R2 | Storage: no live L1 under projects | HIGH | storage | 0 process.yaml vs 39 plan.md | OPEN (legacy) |
| R3 | Teaching: catalog omit process | MEDIUM | teaching | catalog argument_hint | OPEN |
| R4 | Dual path: prose-only ready vs detector | HIGH | dual-path | stage advance vs find-missing unused at ready | OPEN |

### Residual protocol
- Terms: OLD=phase-tree-as-map, optional guide; NEW=process map, L1/L2, process-map stage, find-missing-process-map  
- Validity: **valid** (terms + surfaces derived)  
- Surfaces hunted: 12 listed  

---

## Accept Register (Accept Records)
| Finding | Risk | Mitigation | Operator | At | Expires |
|---------|------|------------|----------|-----|---------|
| _(none)_ | — | CRITICAL F1 cannot Accept-Record to CLOSED | — | — | — |

---

## Tests / commands observed

| Command | Result | Notes |
|---------|--------|-------|
| `node --test tests/creation-gates.test.js tests/find-missing-process-map.test.js tests/render-process-map.test.js` | pass 32 | unit green |
| `test -f` key paths | all OK | artefacts present |
| `rg find-missing-process-map` implement/* | empty | F1 |
| `find … process/process.yaml` | 0 | F3 |
| `rg processMap plan.schema.json` | empty | F5 |

---

## Self-review against gates
- **G1 read-before-claim:** claims cite paths/commands above  
- **G2 soft-language:** verdict is **OPEN** only  
- **G6 reference-or-strike:** D6 NO with empty implement wiring; no unverified RESOLVED on load-bearing teeth  

## Confidence %
**78%** — core L1/L2 + stages well verified; implement/verify/catalog gaps clear; not dogfooded on a real `new plan` end-to-end in this audit.

---

## Closing summary

### Audit Delivery — Summary

**Intent source:** `docs/kb/process-map.md` + session implementation  
**Mode:** audit  
**Depth:** full (inline degraded isolation)  
**Verdict:** **OPEN**  
**Decisions:** RESOLVED 4 · PARTIAL 3 · NO 1 · N/A 0  
**Problems:** RESOLVED 1 · PARTIAL 2 · NO 0  
**Findings open:** CRITICAL 1 · HIGH 3 · MEDIUM 4 · LOW 1  
**Fix rounds:** 0  
**Report:** `.atomic-skills/reviews/audit-delivery-process-map-20260811.md`

| # | Residual | Sev | Next action |
|---|----------|-----|-------------|
| 1 | implement HARD-BLOCK missing while taught | CRITICAL | Wire detector into implement (+ automate) |
| 2 | ready without file proof | HIGH | assert process-map advance + ready runs find-missing |
| 3 | 0 live plans with process/ | HIGH | grandfather policy or backfill tool |
| 4 | verify ignores detector | HIGH | add verify check |

**Suggestion:** composition — fix F1–F4 → `audit-delivery --mode=reaudit --out=.atomic-skills/reviews/audit-delivery-process-map-20260811.md` → optional `review-code` on the fix range. Do **not** claim process-map shipped end-to-end until implement teeth + at least one dogfood `new plan` produces `process/`.
