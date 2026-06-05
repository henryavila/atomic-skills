# 18 — aiDeck decisions (doc 17) vs the aiDeck source: reconciliation + consumer enrichments

**Status:** consumer-side ground-truth review, 2026-06-03. **Verdict: doc 17 is stale against the aiDeck
source — our committed consumer manifest has ZERO breakages.** **Supersedes** the impact assumption in
`17-aideck-capability-decisions.md` for the routing/param/status/widget items it marked rejected/deferred.
**Companions:** `17-aideck-capability-decisions.md` (the aiDeck-agent decisions this reconciles),
`16-aideck-dashboard-port-handoff.md` (the consumer plan).

> **How this was produced:** a fan-out review read the actual source of BOTH repos and ran aiDeck's own
> vitest suite (52/52) + `loadManifest` against our consumer. Doc 17 is a **design statement**; the code
> is what actually runs. Where they disagree, the code wins. Every claim below cites `path:line`.

---

## 0. Provenance / what "the aiDeck source" means here (READ THIS)

All aiDeck evidence below was read from **`/Volumes/External/code/aideck`**, branch
**`feat/aideck-v2-generic-runtime`**, base commit **`d05ea13`**, **in the UNCOMMITTED working tree**.

This matters: the capabilities our manifest depends on (2-param route, composite `param.match`, `statuses`
override, generalized `phase-timeline`, `callout`, `WidgetSlot`) live in **modified-but-uncommitted** files
(` M src/client/router.ts`, ` M manifest-schema.ts`, ` M WidgetRenderer.vue`, ` M status.ts`, +untracked
`WidgetSlot.vue`, `CalloutWidget.vue`). This is exactly the state doc 17 §4 described as *"implemented but
not committed, nothing published."*

**Consequence:** the contract our manifest binds against is **real and test-passing today, but volatile.**
Until the aiDeck agent commits this working tree, a `git stash`/`checkout` over there silently breaks our
drill-down. **Action for the aiDeck agent: commit `feat/aideck-v2-generic-runtime` to anchor the contract.**

---

## 1. The drift: what doc 17 says is rejected/changing vs what the code actually does

| Doc 17 claim | aiDeck source reality | Evidence (working tree @ `d05ea13`) |
|---|---|---|
| §1 r.45 / §2c Ask1: SPA route has **no `:projectId` segment**; composite `match:[projectId,slug]` param = "Nothing / rejected as written" | **2-param route exists; composite param validated + executed; both forms (bare-pair AND `{field,param}`) work** | `router.ts:14` `{ path: '/:consumerId/:pageSlug/:projectId/:slug' }` (inline comment "§2c drill-down"); `manifest-schema.ts:84-97` param union; `WidgetRenderer.vue:220-235` composite branch; **vitest 52/52** incl. tests at `widget-renderer.test.ts:411` & `:443` |
| §1 r.44: row-scoped `linkTo` interpolates **a single** route param | **Interpolates ALL `:token`s (global replace), multi-segment** | `link.ts:16-22` `linkTo.replace(/:([A-Za-z0-9_]+)/g, …)`; docstring example `plan/:projectId/:slug → /c/plan/p/x` |
| §4 leak: `utils/status.ts` `STATUS_MAP` hardcoded, **no consumer override (P0)** | **Consumer `statuses` override already shipped + threaded in 8 host widgets** | `status.ts:16` `StatusOverrides`, `:40-49` `statusInfo(s, statuses?)`; read by table/kanban/list/key-value/accordion/phase-timeline `config.statuses` |
| §4d: `sparkline` config **"will change"** (`confidence`/0.6-0.4-0.2) | **Already changed**: default `valueField:'value'`, `thresholds[]` config present | `SparklineWidget.vue:46,152-162` |
| §4a / §4 leak: `phase-timeline` **hardcodes `tasks`/`gates`, fixed twin-meter, `status==='active'`** | **Already generalized**: no hardcoded labels (comment: "no built-in tasks/gates"), meters fully consumer-declared via `config.meters[]`, `currentField`/`activeStatus` configurable; **`stepper` is a live alias to the same component** | `PhaseTimelineWidget.vue:141,148-160,137-138`; `WidgetRenderer.vue:81-82` maps both `phase-timeline` & `stepper` |

**Net:** the items doc 17 told us to "rebuild by composition / not expect" are **already in aiDeck core**. The
suspected primary breakage (drill-down via composite param + 2-token `linkTo`) **does not exist**.

### What doc 17 got right (still true, no change)
- `compute:`/expression engine **rejected** — aiDeck has no compute (`data-source-reader.ts` explode only
  spreads `{...carried, ...element}`, no projection). Rollups must stay precomputed. ✅ we do.
- `explode`/`derivesFrom`/`carry` (§2a) and `slots`/`WidgetSlot` (§2b) are the load-bearing capabilities. ✅
- Flatten co-dependent objects before binding (§2 obl.2): generic widgets can't read nested `verifier`/
  `evidence` — `TableWidget` `formatCell` JSON.stringifies any object (`TableWidget.vue:211-213`). ✅ still our job.
- `graph-dag` interim (raw mermaid in `<pre>`); SSE mechanism internal. ✅

---

## 2. Impact on our project — review totals

33 findings, adversarially verified: **0 breakage · 8 fidelity-gap · 5 future-obligation · 20 no-op.**
Our committed manifest (T-005…T-009) **passes `loadManifest` against the real working-tree schema**.

The fidelity-gaps were the only actionable consumer work, and they are **drift-independent** (true regardless
of how the contract drift resolves). §3 records what was applied.

---

## 3. Consumer enrichments applied (this session) — `assets/aideck-consumer/manifest.yaml`

All three are grounded in the real widget source and **validated via `loadManifest` (working-tree schema) + a
YAML/anchor parse check**. No aiDeck change, no state-shape change.

1. **Status vocabulary (`statuses` map).** Declared once as a YAML anchor `&statusvocab` (8 words:
   active/pending/paused/blocked/done/archived/met/deferred), aliased to **11 status-rendering widgets**
   (kanban, 5 tables, 2 key-value, 2 card-grid, phase-timeline). Fixes the **today** fidelity bug: `archived`/
   `met`/`deferred` were absent from aiDeck's default `STATUS_MAP` and rendered neutral-grey — now
   `met`=success-✓, `deferred`=warning, `archived`=neutral-labelled. Also inoculates against the announced
   "STATUS_MAP moves consumer-side" rework. (`status.ts:40-49` is the live override hook.)
2. **`phase-timeline` meters.** Added `config.meters: [{label:Tasks, tasksDone/tasksTotal, bar}, {label:Gates,
   gatesMet/gatesTotal, pips}]` to the Plan-detail timeline. Surfaces the rollups `compute-rollups.js` already
   precomputes (previously dropped — the spine showed status only). (`PhaseTimelineWidget.vue:148-194`.)
3. **Tasks blockers detail slot.** Added `blockedBy` column + a `cell:blockedBy` slot rendering `tag-chip`
   (`hideCounts`) on the Initiative-detail tasks table — surfaces WHY a task is blocked. (`TableWidget.vue:28-34`
   hosts `cell:<columnId>` slots; `blockedBy[]` is a flat field carried by explode.)

---

## 3b. Home redesign → "Foco" (default) + cross-file focus reconcile

The default page was a global portfolio dashboard; the project Home should instead answer **what am I
implementing / what am I doing now / how does it fit**. Rebuilt as a focus view, scoped to the **active
plan(s)** — driven by plan *status*, not initiative status (an initiative can be `active` under a paused plan):

- **`scripts/reconcile-focus.js`** (new, cross-file) — the dashboard can't join plan→initiative, so it
  precomputes: `planActive` (plan record + carried to phase rows + each initiative) and `current` (the active
  plan's `currentPhase` initiative). It also enforces hygiene: **a paused plan must not keep an `active` phase**
  → cascades the active phase (descriptor + initiative) to `paused`. Idempotent; strips stale markers.
- **Schema**: `planActive` on `plan.schema.json`, `planActive`+`current` on `initiative.schema.json`; consumer
  `schema.json` regenerated. **Auto-runs** in the project-status flow: `project-view.md` step 0 + the recompute
  rule (`project.md`) + the plan-switch transition (`project-transitions.md`).
- **Home (`manifest.yaml` slug `home`, default)**: *Agora* = `callout`(nextAction) + `key-value`(progress) over
  `initiatives {current:true}` (repeat parentPlan); *Onde estou* = `phase-timeline` over `phases {planActive:true}`
  (repeat planSlug) — the full skeleton from the plan's `phases[]` descriptor (phases materialize lazily, so the
  skeleton lives only there), current phase highlighted on status. Old global view demoted to the "Overview" tab.

Verified against real state: timeline = `F0✓ F1✓ F2✓ F3✓ F4✓ F5◉ F6(paused)` (active plan only); AGORA = F5 +
nextAction + `tasks 8/9 · gates 0/1`. Reconcile fixed 3 stale `active`-under-`paused` initiatives. Tests:
`reconcile-focus` 3/3, validate-state 24/24, validate-skills 14/14, manifest loadManifest-valid.

## 4. The one genuinely-blocked enrichment + latent traps (not applied)

### ✅ RESOLVED (option a, this session): exit-gate verifier/evidence provenance
Previously dropped because `verifier{kind,…}`/`evidence{passed,…}` are **nested objects** generic widgets
can't read, `explodeRecords` doesn't flatten (`data-source-reader.ts:194-197`), and aiDeck has **no `row:detail`
host** (only `cell:<columnId>`). **Fixed by persisting a consumer-side flatten** — once the projection is a
flat scalar on the record, it's just a plain table **column** (no slot, no `row:detail` needed):
- **`scripts/compute-rollups.js`** now derives, alongside the rollups, `verifierLabel` (gate `verifier` kind +
  key arg, truncated) and `evidenceSummary` (one-line digest of `evidence`/`deferredReason`, omitted while
  pending) onto every `exitGates[]` element — idempotent, stable key order.
- **`meta/schemas/common.schema.json`** `$defs.exitCriterion` allow-lists the two fields (it is
  `additionalProperties:false` → `validate-state.js` would otherwise reject); consumer `schema.json` regenerated.
- **Recompute rule** (`project.md` Dashboard-rollups + `project-transitions.md` done/phase-done) extended so
  live mutations keep them fresh.
- **`manifest.yaml`** both exit-gate tables now show `verifierLabel` + `evidenceSummary` columns.

Verified: `compute-rollups` stamped 17 initiatives (e.g. a `manual` gate → `verifierLabel: manual`), idempotent
on re-run; `validate-state` 24/24; manifest passes `loadManifest`; tests green (validate-state 56, handlers 32,
transition 15, project 33, decompose 67). Note this denormalizes derived data into canonical state (same
trade-off as the rollups) — kept fresh by the recompute rule + the idempotent batch drift-fixer.

### Latent traps recorded (no action; documented so a future edit doesn't trip)
- **`dag-graph` is the wrong name** — the live registry key is **`graph-dag`** (`WidgetRenderer.vue:88`). A
  future dep-view that copies doc 17's `dag-graph` renders "Unknown widget."
- **`callout` `linkTo` does NOT token-interpolate** (`CalloutWidget` builds a plain `/consumerId/linkTo`,
  unlike table/card). Don't put a `:token` template in `callout.linkTo`.
- **`stat` `count()` grammar** is a single `field=value` only (`StatWidget.vue` regex `^count\((\w+)=(.+)\)$`);
  anything else (AND, `!=`, quotes) renders **verbatim as the literal value**, silently. Our 8 stats are all valid.
- **`staleDays`** is listed in doc 17 §2 obl.1 as a precomputed rollup but is **not** computed (only the 4
  task/gate rollups are). Currently moot — no widget binds it; the `health` MCP tool computes it live. Only
  precompute it if a staleness widget is added (note: it's time-relative, so a disk value would age).

---

## 5. Action items

**For the aiDeck agent (the other repo):**
1. **Commit `feat/aideck-v2-generic-runtime`** to anchor the contract our manifest binds (§0). Until then our
   drill-down depends on uncommitted edits.
2. **Reconcile doc 17** §1 r.44/r.45 + §2c (composite param + 2-param route = **ACCEPTED/BUILT**, cite
   `router.ts:14`, `manifest-schema.ts:84-97`, `WidgetRenderer.vue:220-235`, `link.ts:16`), and mark the §4
   leaks for `status.ts`/`sparkline`/`phase-timeline` as **already fixed**.
3. (Optional, unblocks gate provenance) add a `row:detail` table host and/or an `explode` flatten directive.

**For us (consumer):** §3 applied + validated; the gate-provenance flatten (§4) is **done** (option a). Remaining:
a **live bring-up eyeball** (pixel render not yet verified — headless):
```bash
rm -rf ~/.aideck/consumers/atomic-skills
cp -R /Volumes/External/code/atomic-skills/assets/aideck-consumer ~/.aideck/consumers/atomic-skills
cd /Volumes/External/code/aideck && npm run build   # build the working tree (uncommitted feature)
AIDECK_BIN=$PWD/dist/cli.js node $PWD/dist/cli.js serve --port 7799 --static-dir $PWD/dist/client &
curl -fsS -X POST http://127.0.0.1:7799/api/projects/register -H 'Content-Type: application/json' \
  -d '{"rootDir":"/Volumes/External/code/atomic-skills","projectId":"atomic-skills"}'
open http://127.0.0.1:7799/atomic-skills
```
Eyeball: status chips colored (met/deferred/archived), phase-timeline twin meters, task blocker chips, drill-down.
