# Handoff → Dashboard redesign: what the Deadline Burn-up Forecast render (F5) needs

**From:** `deadline-burnup-forecast` plan (F0–F4 tracking instrumentation DONE; F5 render BLOCKED on the dashboard redesign).
**To:** the agent rebuilding the aiDeck dashboard / DS / manifest.
**Date:** 2026-06-19.
**Why this exists:** F5 ("Render no aiDeck") is deliberately the last phase and is blocked until the dashboard redesign (`fix-aideck-dashboard`, F2) lands. So the dashboard must be rebuilt *with the forecast render in mind*. This doc is the contract: build the DS/manifest so F5 can drop in a "Ritmo" page without inventing widgets.

F5 itself edits **`assets/aideck-consumer/manifest.yaml`** (this repo) and is gated by **`tests/aideck-consumer-manifest.test.js`**. F5 will be implemented by THIS plan once the redesign lands — you do NOT need to write the page. You DO need to make sure the pieces below exist so the page is admissible.

---

## 1. The two data sources are ALREADY emitted (do not rebuild them)

`scripts/emit-consumer-state.js` (run by `npm run emit-state` / refresh-state) already writes both, as bare top-level JSON arrays, into the same `root: project` emitted-state tree the other dataSources use:

| dataSource id | path | format | root |
|---|---|---|---|
| `burnup` | `.atomic-skills/.aideck/state/burnup.json` | json | project |
| `spi`    | `.atomic-skills/.aideck/state/spi.json`    | json | project |

These are precomputed (the v0.1 runtime has no aggregation engine). If your redesign **regenerates `assets/aideck-consumer/manifest.yaml`**, please **keep / re-add** these two `dataSources` entries (same shape as `plans`/`tasks`/etc.). If it does NOT touch the manifest, nothing to do here — F5 adds them.

### `burnup` record schema (`meta/schemas/aideck-state.schema.json#/$defs/burnup`)
One record per day of the plan's life, per plan. A time series.
```
{ projectId: string, planSlug: string,
  date: string,                 // "YYYY-MM-DD"
  plannedValue: number | null,  // the planned line 0 → weightTotal toward the deadline; NULL when the plan has no deadline
  earnedCount:  number,         // cumulative earned, count-basis (1 per done task)
  earnedProxy:  number }        // cumulative earned, proxy-basis (sum of task weights)
```

### `spi` record schema (`#/$defs/spi`)
One summary record per plan.
```
{ projectId: string, planSlug: string,
  asOf: string, started: string | null, deadline: string | null,
  weightTotal: number, tasksTotal: number,
  spiProxy: number | null,      // schedule perf index, proxy basis; NULL without a deadline
  spiCount: number | null }     // schedule perf index, count basis;  NULL without a deadline
```

> ⚠️ **Data prerequisite (not a dashboard task):** `plannedValue`, `spiProxy`, `spiCount` are `null` until the plan declares a `deadline`. With no deadline there is no "expected pace" to compare against. The render must tolerate null (flat/absent planned line, "—" SPI), and a plan-with-deadline is what makes the chart meaningful. This plan will set its own deadline before F5.

---

## 2. The page F5 will add — "Ritmo" (pace)

F5 will register a page roughly like this. It must use **only widgets the rebuilt DS publishes**. Concretely F5 needs:

1. **A multi-series line-chart** over `burnup` (x = `date`), with **three series**:
   - `plannedValue` (the planned/expected line, 0 → weightTotal toward deadline),
   - `earnedCount` (actual earned, count basis),
   - `earnedProxy` (actual earned, proxy/weight basis).
   The two earned series are intentionally separate (different weight bases, from F2/F3) — the widget must support **≥3 series on one chart** (or small-multiples). One series per chart would defeat the comparison.
2. **A stat** bound to `spi.spiProxy` (the headline number; > 1 ahead of pace, < 1 behind), plus an informative **stat** for `spi.spiCount`.

### What I need FROM you (the dashboard rebuild)
- [ ] The rebuilt DS publishes a **line-chart widget that accepts multiple series** (3 tracks from one dataSource). If its name/binding grammar differs from the current `line-chart`, tell me the published widget id + how series are declared, and F5 will bind to it.
- [ ] The rebuilt DS publishes a **stat widget** (single precomputed scalar with a tone, like the existing meters). Confirm its id.
- [ ] If you regenerate `assets/aideck-consumer/manifest.yaml`, preserve the `burnup` + `spi` dataSources (table in §1) and leave room for a top-level page (the nav is `style: tabs` today — a new "Ritmo" tab, or wherever the redesign puts plan-scoped analytics).
- [ ] If the redesign changes how plan-scoped pages are routed/scoped (the forecast is per-plan: `burnup`/`spi` records carry `planSlug`), tell me the new scoping convention so the page filters to the selected plan.

If any of the above is impossible in the new DS (e.g. no multi-series chart), flag it here — F5's design will adapt (e.g. small-multiples, or a single earned series) rather than invent an unpublished widget.

---

## 3. Hard constraints (F5 scopeBoundary — so we stay compatible)

- **Published widgets only.** F5 will NOT introduce a widget that the DS does not publish (the DS owns the widget vocabulary). That is why this handoff asks you to confirm `line-chart` (multi-series) + `stat`.
- F5 does **not** change existing pages/dataSources beyond adding the burn-up page + the two dataSources.
- F5 binds to the **emitted** files only (no compute in the manifest; the runtime has no aggregation engine — everything is precomputed in `emit-consumer-state.js`).

## 4. Status / pointers
- Tracking instrumentation (the data behind the render) is DONE + merged on branch `plan/deadline-burnup-forecast`: completions event log, per-task/phase actuals, weighted rollups, the `burnup`/`spi` series + SPI, and the `closedAt` forward-only hard-gate.
- F5 SPEC: `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md` (§F5) and the materialized phase `phases/f5-render-no-aideck-depende-do-redesig.md` (carries the blocking `externalImports` → `fix-aideck-dashboard/plan.md`).
- F5 verifier: `node --test tests/aideck-consumer-manifest.test.js`.
