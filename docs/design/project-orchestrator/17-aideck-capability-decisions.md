# 17 — aiDeck capability decisions: accepted / rejected + consumer actions

**Status:** aiDeck-side agnostic review outcome, 2026-06-03. **Source repo:** `/Volumes/External/code/aideck`
(branch `feat/aideck-v2-generic-runtime`). **Supersedes the assumption in `16-aideck-dashboard-port-handoff.md`**
that all of spec §4's seven widgets + the composite param would land in aiDeck core.
**Companion:** `/Volumes/External/code/aideck/docs/component-spec-atomic-skills-dashboard.md` (the request this reviews).

> **For the atomic-skills agent:** this is what aiDeck **will** and **will not** put in its generic core, and
> therefore what you must build/change on the consumer side. The split is governed by one principle (§0). Several
> widgets the spec asked for are **rejected from core** — you rebuild them by composition or as custom components,
> not by waiting for a bespoke aiDeck widget. Some accepted capabilities are **already implemented but uncommitted**
> in aiDeck with known leaks being fixed (§4) — code against the *generalized* contract here, not the current shapes.

---

## 0. The governing principle (why things were rejected)

aiDeck is a domain-agnostic platform. The line that decides what enters core is the **"HTML h1/h2/h3" rule**: HTML
encodes structure (h1–h6, table/tr/td, dl/dt/dd, details/summary) yet stays agnostic because the slots/levels are
**neutral positions or consumer-supplied keys** and the **consumer assigns all meaning**. A primitive enters aiDeck
core **iff**:

1. **Neutral addressing** — every slot/level/role aiDeck names is a position, ordinal, or consumer key — never a
   domain noun (`gate`/`phase`/`task`) and never a fixed value→meaning dictionary.
2. **No fixed domain count/shape** — may impose a cardinality (N rows, N children) but not a domain-meaningful
   count ("exactly two meters, one is a gate") and **never reads named fields of a nested co-dependent object**
   (`{kind,runner,pattern}`) — those must be flattened consumer-side first.
3. **Standalone coherence** — useful on its own like `<table>`; if it only works after explode + N composed children
   wired around it, it's a custom component, not a core widget.

**Consequence for you:** anything that is a *domain concept* (a phase, an exit gate, a stack frame, a task with
blockers) is yours to express via generic primitives + composition + precomputed scalars. aiDeck gives you the
neutral building blocks; you assign the meaning.

---

## 1. Decision ledger

| Spec item | Verdict | What aiDeck delivers | What you (atomic-skills) must do |
|---|---|---|---|
| **§2b composition / `slots`** | ✅ **ACCEPTED** (built) | `slots: Record<string,WidgetBinding[]>`; `WidgetSlot` recursion; source-less child inherits the host record; `$parent.<field>` (single-hop) in `source.filter`; depth-8 guard. Hosts: `card`,`stat`,`list`,`kanban`,`table` (+`phase-timeline`). | Build the detail pages by **composing** existing widgets into slots (see §3). This is the backbone of everything below. |
| **§2a `explode`/`derivesFrom`/`carry`** | ✅ **ACCEPTED** (built) | A derived dataSource flattens a nested array of a parent source; carries named parent scalars; stamps `_index` (+`_parentId`). Schema enforces *exactly one of* `path`/`derivesFrom`. | Declare your exploded sources (`phases`, `tasks`, `exit_gates`, `stack_frames`, `parked`, `emerged`) via `derivesFrom`+`explode`+`carry`. |
| **§2a `compute:` / `field()` derivation** | ❌ **REJECTED** | aiDeck owns no derived state and ships no expression engine (the bounded `count()` in `stat` is the only blessed aggregate). | **Precompute rollups into frontmatter** (`tasksDone`,`tasksTotal`,`gatesMet`,`gatesTotal`,`staleDays`). Already your taken decision — keep it. |
| **§2c Ask2 row-scoped `linkTo`** | ✅ **ACCEPTED** (util added, `src/client/utils/link.ts` — verify) | Per-record `:field`/`{field}` interpolation into the single detail route param. | Use row-scoped links targeting the existing route shape `/:consumerId/:pageSlug/:routeParam` (one param). |
| **§2c Ask1 composite param `match:[projectId,slug]`** | ⛔ **DEFERRED / rejected as written** | Nothing. The SPA route has **no `:projectId` segment** (premise was false); project isolation already comes from the on-disk per-project directory layout. | Disambiguate same-slug-across-projects via your **file layout** (one dir per project, `root:'project'` sources) — do **not** expect a `projectId`-aware param. F-001 stays consumer-side. |
| **§2d SSE nested-path refresh** | ⚠️ **ACCEPTED (mechanism will change)** | Live refresh for nested `projects/<id>/<slug>/…` edits. *Currently hardcodes that path layout (`paths.ts`); will be reworked to emit by declared dataSource glob.* | No action. Initial render already works; live-refresh will fire regardless of the internal mechanism. |
| **§4c `callout`** | ✅ **ACCEPTED** (built, clean) | `callout` widget with a neutral `variant` enum (`info\|success\|warning\|attention\|error`), `title/body`(+`Field`), optional action link, `pulse`. | Use `variant` (set the value yourself) — not an auto-colored status field. |
| **§4d `sparkline`** | ✅ **ACCEPTED (config will change)** (built) | `line` + `bar` modes, inline. *Currently hardcodes `valueField:'confidence'` and `0.6/0.4/0.2` bands; will become `thresholds:[{at,tone}]` config.* | Use it; **don't rely on the `confidence`/0.6-0.4-0.2 defaults** — pass explicit field + (soon) thresholds. |
| **§4b `dag-graph`** | 🟡 **interim only** | Raw-mermaid-text in a `<pre>` today; interactive SVG layout deferred (spec Open Decision #3). | Feed a prebuilt mermaid string for now (project `dependsOn[]` → mermaid consumer-side). |
| **§4a `phase-timeline`** | 🟥 **BUILT but flagged — will change** | The widget exists, **but it is a domain leak** (hardcoded `tasks`/`gates` labels, fixed twin-meter, `status==='active'` magic, `phase-extra` slot). It will be **generalized to a neutral `stepper`** or moved to a custom component. | **Do not treat `phase-timeline` as a stable core widget.** Prefer composition (§3) or be ready to migrate to `stepper` (rail + `currentField` + N meters via slots). The current `tasks`/`gates` labels and `dependsOn` semantics are *not* a contract. |
| **§4e `stack-view`** | ❌ **REJECTED from core** | Nothing bespoke. | Use `list` + a `currentField` marker (planned) **or** reshape `stack[]` into `tree-view`'s `{label,status,children}`; supply your own kind→glyph map. The pulsing "HERE" / `◉/✓✓/⌬` taxonomy is yours, not core. |
| **§4f `exit-gate-list`** | ❌ **REJECTED from core** | Nothing bespoke. | Use `table` (or `accordion`, once it's a host) + a `row:detail`/`cell:detail` slot. **Flatten** `verifier:{kind,runner,pattern}` and `evidence:{passed,testsCollected,…}` into neutral `{label,value}` pairs **before binding** — aiDeck will not read those nested objects. (§3) |
| **§4g `task-list`** | ❌ **REJECTED from core** | Nothing bespoke. | Use `table` over exploded `tasks` + `cell:blockers` slot (`tag-chip`) + `row:detail` slot (`markdown`). (§3) — the spec already called this the right path. |

Legend: ✅ accepted · ⚠️ accepted, internals will change · 🟡 interim · 🟥 built but will be reworked · ❌ rejected from core · ⛔ deferred.

---

## 2. Consumer-side obligations (the agnostic contract — yours regardless)

These hold no matter how aiDeck evolves; they are the price of keeping aiDeck domain-free:

1. **Precompute rollups into phase frontmatter** — `tasksDone/tasksTotal`, `gatesMet/gatesTotal`, `staleDays`. aiDeck
   reads them as plain scalars; it will never compute them.
2. **Flatten co-dependent objects before binding.** `verifier {kind,runner,pattern}` and
   `evidence {passed,testsCollected,verifiedAt,outputSummary}` are domain object shapes aiDeck must not read field-by-field.
   Project them consumer-side into a neutral list of `{label, value}` (or a markdown blob) that a generic widget can render.
3. **Declare exploded dataSources** for every per-row view:
   ```yaml
   dataSources:
     - id: phases       { derivesFrom: plans,        explode: phases,    carry: [projectId, planSlug, title, currentPhase] }
     - id: tasks        { derivesFrom: initiatives,  explode: tasks,     carry: [projectId, planSlug, slug, phaseId] }
     - id: exit_gates   { derivesFrom: initiatives,  explode: exitGates, carry: [projectId, planSlug, slug, phaseId] }
     - id: stack_frames { derivesFrom: initiatives,  explode: stack,     carry: [projectId, slug] }
     - id: parked_items { derivesFrom: initiatives,  explode: parked,    carry: [projectId, slug] }
     - id: emerged_items{ derivesFrom: initiatives,  explode: emerged,   carry: [projectId, slug] }
   ```
4. **Own your status vocabulary.** aiDeck's status→tone/glyph map is *currently hardcoded* and happens to include your
   PM words (`active/done/blocked/…`) — **that is incidental and will move to a consumer-supplied `statuses` map.** When it
   does, declare your vocabulary (`statuses: { '<value>': { tone, glyph, label } }`). Don't depend on core knowing your words.
5. **Compose detail pages from existing widgets** (host widgets available: `card`,`stat`,`list`,`kanban`,`table`;
   `accordion`/`tabs` are coming). Bespoke domain widgets are not.
6. **For true pixel-parity** of a domain widget (e.g. the old `StackPanel` with its HERE marker), use
   `manifest.components` (`customComponentSchema`) — the sanctioned escape hatch — not a core widget request.

---

## 3. Replacement recipes (rejected widgets → composition)

### exit-gate-list → `table` + detail slot (flatten verifier/evidence)
```yaml
- widget: table
  source: { ref: exit_gates }
  config: { columns: [id, description, status] }   # native status chip on `status`
  slots:
    "row:detail":
      - widget: key-value
        # bind a consumer-flattened [{label,value}] projection of verifier+evidence,
        # NOT the raw {kind,runner,pattern}/{passed,…} objects.
        config: { fields: [verifierLabel, lastRun, testsCollected, verifiedAt] }
      - widget: markdown
        config: { field: evidenceSummary }          # outputSummary / deferredReason as prose
```

### task-list → `table` + `cell:blockers` + `row:detail`
```yaml
- widget: table
  source: { ref: tasks }
  config: { columns: [id, title, status] }
  slots:
    "cell:blockers":
      - widget: tag-chip
        config: { field: blockedBy }                 # blockedBy[] as pills
    "row:detail":
      - widget: markdown
        config: { field: description }
```

### stack-view → `list` + current marker (or tree-view reshape)
```yaml
- widget: list
  source: { ref: stack_frames }
  config: { titleField: title, subtitleField: kind /*, currentField: here (planned) */ }
  # supply your own kind→glyph mapping via the (planned) statuses/kinds map; do not expect
  # core to know task/validation/investigation.
```

### phase-timeline → composition today (migrate to `stepper` later)
```yaml
# Until a neutral `stepper` lands, compose the spine from list/card + meters in slots:
- widget: card-grid
  source: { ref: phases }              # exploded rows + precomputed rollups
  config: { titleField: title, subtitleField: status }
  slots:
    body:
      - widget: progress-bar
        config: { label: "Tasks", valueField: tasksDone, maxField: tasksTotal }
      - widget: progress-bar
        config: { label: "Gates", valueField: gatesMet, maxField: gatesTotal }
    footer:
      - widget: callout
        config: { bodyField: nextAction, variant: attention }
```

> Note: the **labels `"Tasks"`/`"Gates"` are yours to supply** here — that is exactly the agnostic win. The current
> `phase-timeline` widget hardcodes them; this composition does not, and will survive the widget's rework.

---

## 4. Current aiDeck build state (uncommitted — code against the *generalized* contract)

As of 2026-06-03 the aiDeck working tree has the above implemented but **not committed and nothing published**. Known
leaks being fixed before release — **do not build against these shapes**:

| File | Leak being fixed | Code against instead |
|---|---|---|
| `utils/status.ts` | `STATUS_MAP` hardcoded, `statusInfo(s)` has no override (P0) | a consumer-supplied `statuses` map (coming) |
| `PhaseTimelineWidget.vue` | hardcoded `tasks`/`gates` text, fixed twin-meter, `status==='active'`, `phase-extra` slot | neutral `stepper` / composition (§3) |
| `SparklineWidget.vue` | `valueField:'confidence'` default + `0.6/0.4/0.2` bands hardcoded | explicit `valueField` + `thresholds:[{at,tone}]` (coming) |
| `writers/paths.ts` | hardcodes `projects/<id>/<slug>/plan.md`+`phases/*.md` for SSE | (internal; no consumer action) |
| `data-source-reader.ts` | `_parentId = slug ?? id` (slug identity assumption) | rely on `carry` for whatever identity field you need |

**Host coverage today:** `card`,`stat`,`list`,`kanban`,`table`,`phase-timeline` mount child widgets.
**Not yet hosts:** `accordion`,`tabs`,`container`,`grid-columns`,`drawer`. → For exit-gate-list use `table` now;
`accordion` becomes available later. `tabs[].widgets` is still a dead label-only field — do not use it for nesting yet.

---

## 5. Delta vs `16-aideck-dashboard-port-handoff.md`

Doc 16 (consumer plan, "SPEC APPROVED") assumed all seven §4 widgets + the composite param. Corrected here:

- **Accepted as core widgets:** `callout`, `sparkline` (config changing), `dag-graph` (interim mermaid).
- **Conditional:** `phase-timeline` exists but is being reworked → don't anchor pages to it; use composition/`stepper`.
- **Rejected → composition (you build, no new widget):** `exit-gate-list`, `task-list`, `stack-view`.
- **Deferred:** composite `projectId` param (use per-project file layout).
- **Unchanged & reaffirmed:** rollups precomputed by the skill; `explode`/`slots` are the load-bearing capabilities;
  `dag-graph` mermaid interim.

**Net effect on your lanes:** the tasks that were "bind the bespoke widget" (exit-gate-list / task-list / stack-view /
phase-timeline) become **"compose existing widgets + flatten domain objects"** tasks. The no-dependency slice
(fix the plans table, scalar Plans view, `markdown _body`) is unaffected — start there as planned.
