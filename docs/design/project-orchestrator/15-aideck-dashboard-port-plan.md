# 15 — aiDeck dashboard port plan (MVP → insight-parity)

**Status:** PLAN (awaiting decisions on the forks in §7). Authored 2026-06-03.
**Context:** The Model-B consumer (docs 13/14) reconnected the project-status skill to
the rebuilt generic aiDeck and was validated end-to-end (reads + MCP mutation). But the
*dashboard* that ships in the consumer manifest is an **MVP**, not a port of the old
React dashboard. Brought up live, it renders one `table` widget dumping every frontmatter
field — including `phases` (a ~8 KB JSON array) and `_body` (~4 KB of raw markdown) — as
columns. It is unusable. This plan maps the old dashboard's insight, measures it against
the new aiDeck's widget/manifest capabilities, and sequences the work to reach
insight-parity.

Supersedes the single F5 prose criterion "aiDeck consumer side" with a real,
phased scope. Pairs with the F5 phase file `inc7-aideck-prose-long-tail.md`.

---

## 1. The concrete defect (why it looks horrible)

The current manifest (`assets/aideck-consumer/manifest.yaml`) has 3 pages — Overview,
Plans, Phases — built almost entirely on `stat` + `table` + `kanban-board` bound directly
to the `plans` / `initiatives` dataSources, with **no `config.columns`**. Each plan record
carries: `schemaVersion, slug, title, version, status, started, lastUpdated, branch,
currentPhase, parallelismAllowed, phases (8 KB array), _body (4 KB md), _file, projectId,
planSlug`. The `table` widget defaults to "all keys except `_body`/`_file`", so `phases`
(and `principles`/`glossary`/`tracks` on other plans) render as giant JSON blobs in cells.
Same latent risk on the `kanban-board`/`list` reading initiative records (`tasks[]`,
`stack[]`, `parked[]`, `emerged[]`).

**Root cause is two-layered:**
1. **Consumer:** the manifest never declares which columns/fields to show (trivially fixable).
2. **aiDeck:** there is no server-side way to turn a nested array (`plan.phases[]`,
   `phase.tasks[]`, …) into per-row records, and no derived/computed columns — so every
   list/timeline/progress visualization the old dashboard had is structurally blocked.

---

## 2. The vision being recreated (old dashboard + skill render)

### 2a. Old React dashboard (`src/dashboard/`)
A full SPA with five insight surfaces:

| Page | Question it answers | Signature visualizations |
|------|--------------------|--------------------------|
| **Home** | What's tracked? Active now? Issues? | Per-project health cards (pulsing active dot), 5-lane roadmap (`ProjectCard`, `Roadmap`/`RoadmapItems`) |
| **ProjectDetail** | How many streams active? Blocked? Shipped? | Metric strip + roadmap lanes (inflight/blocked/upnext/parked/shipped) |
| **Plan** | Phase sequence? Active now? Blocking the next gate? | `PhaseCard` timeline (task progress + gate meter + active highlight), `ActivePhaseCallout` "YOU ARE HERE", `InconsistencyBanner`, **`DepGraphOverlay`** (interactive SVG DAG: Kahn topological columns, track rows, bezier edges, parallel pills) |
| **Initiative** | Current item? Gates to close? In-flight vs parked? | `InitiativeHero` phase-stepper + next-action, `ExitGatesCard` (met/deferred/pending + verifier), **`StackPanel`** (depth-indented call-stack, HERE marker), `TaskList` (blockedBy pills, expandable), `Parked`/`Emerged` (staleness ⌛>14d) |
| **Discover** | What latent work to track? Highest confidence? | `CandidateCard` (bucketed strong/worth/historical), `ConfidenceBar`, `ActivitySparkline`, `EvidencePill`, already-tracked + orphan signals |

### 2b. The skill's own render spec (`--browser` / `--report`)
Mermaid **Gantt** of tasks (done/active/blocked), Mermaid dependency **flowchart**
(T-X→T-Y via blocker), box-drawing **stack tree**, tasks table, parked+emerged, NEXT
action, and the pasteable `--report` markdown. Same north-stars: timeline, dependency
graph, stack.

---

## 3. What the new aiDeck offers today

**25 built-in widgets:** accordion, badge, bar-chart, breadcrumb, card, card-grid,
code-block, container, drawer, gauge, graph-dag, grid-columns, header-nav, kanban-board,
key-value, line-chart, list, log-feed, markdown, progress-bar, search-filter, stat, table,
tabs, tag-chip, timeline, tree-view.

**Already capable (native / config-only):**
- `table` **does** support `config.columns` whitelisting (drops `_body`/`_file`) + native
  status chips — Phase 1 needs no aiDeck change.
- `stat` value expressions: `count()`, `count(field=value)` (client-evaluated).
- `markdown` renders a record's `_body` natively.
- `key-value` detail view with `config.fields` whitelist.
- `kanban-board` buckets by `statusField` (already used for phases).
- `card-grid` + `repeat: <field>` grouping (e.g. group plans by `projectId`) — native.
- `tree-view` — real recursive collapsible tree with status chips (`childrenField`).
- Single-record **drill-down pages** via route `/:consumerId/:pageSlug/:routeParam` +
  `source.param` (matches `r.id===v || r.slug===v`).
- `list` / `log-feed` render JSONL rows (inbox/discover) natively.

**Structurally missing (needs aiDeck work):**
- **No array-explode/flatten:** `data-source-reader.ts` returns records as-is. Nested
  arrays (`phases[]`, `tasks[]`, `exitGates[]`, `stack[]`, `parked[]`, `emerged[]`,
  `candidates[]`) cannot become rows. **This is the single biggest enabler.**
- **No derived/computed columns:** `tasks.done/total`, `gates.met/total`, staleness age,
  per-project rollups/health cannot be computed by aiDeck.
- **`graph-dag` is mermaid-text-in-a-`<pre>`** — not interactive, no layout. The
  `DepGraphOverlay` north-star needs a real SVG DAG widget (or a server-rendered image).
- **Detail `param` is slug-only** → cross-project slug collisions (F-001). Needs a
  `projectId`-scoped/composite param.
- **`linkTo` is a static page slug** — rows can't link to a *specific* record's detail page.
- **`classifyFile` ignores `projects/<id>/<slug>/` nested paths** → SSE `state-change`
  misfires, so the dashboard won't live-refresh on edits.
- No sparkline (discover activity), no callout/banner widget (active-phase / drift line).

---

## 4. Gap matrix (insight feature → status)

`native` = ships with config · `config-only` = manifest change only · `needs-projection`
= needs array-explode · `needs-new-widget` = new aiDeck component · `needs-both` = projection + widget.

| Feature | aiDeck status | New widget? |
|---------|---------------|-------------|
| Plans portfolio table (the broken one) | **config-only** | — |
| Overview stat tiles | **native** | — |
| Markdown body (plan/initiative narrative) | **native** | — |
| Roadmap lane segmentation (5 lanes) | **config-only** | — (kanban status→lane mapping) |
| Inbox / intent queue review | **config-only** | — (list/log-feed) |
| Per-plan detail page (metadata + narrative) | needs-both | — (param scoping fix) |
| Per-initiative detail page | needs-both | — (param scoping fix) |
| Per-plan **phase timeline** (progress + gate meter) | needs-both | `phase-timeline` (or stacked progress-bar) |
| **Task list** w/ blockers | needs-projection | — (table/tree) |
| **Exit-gate** status per initiative | needs-projection | — (table/list; bespoke for full fidelity) |
| **Stack** depth view + HERE marker | needs-projection | — (tree-view; bespoke for glyph fidelity) |
| Parked vs emerged + staleness | needs-projection | — (staleness precomputed) |
| Active-phase callout + next-action | **needs-new-widget** | `callout` / banner |
| Data inconsistency / scope-drift banner | needs-both | `banner` (+ skill precompute) |
| Project health portfolio cards | needs-both | — (card-grid + precomputed rollups) |
| **Dependency DAG** (DepGraphOverlay) | needs-both | `dag-graph` (interactive SVG) |
| Discover candidate triage | needs-both | `sparkline` (+ explode candidates) |
| CODEX-review staleness line | needs-both | — (skill precompute; low priority) |

---

## 5. Work split

### aiDeck-side (lands in `../aideck`)
| Effort | Item |
|--------|------|
| S | Confirm/document `config.columns` (already present — no code change for P1) |
| **L** | **Array-explode/flatten projection** in `data-source-reader.ts` + `explode`/`projection` field in `manifest-schema.ts` (the structural enabler) |
| L | Derived/computed columns (rollups) — OR decide the skill precomputes them (§7) |
| M | Composite / `projectId`-scoped detail-page param (`WidgetRenderer.vue:172-175`) |
| M | Per-record dynamic `linkTo` (row→specific detail page) |
| M | Fix `classifyFile` for nested `projects/<id>/` paths (`paths.ts`) → SSE refresh |
| L | Interactive **SVG DAG** widget (or accept server-rendered mermaid interim) |
| M | `callout`/`banner` widget (active-phase, drift, CODEX line) |
| M | `sparkline` widget (discover activity) |
| L | Optional bespoke stack / exit-gate / phase-card widgets (only for pixel-parity) |

### consumer-side (manifest + skill, in `atomic-skills`)
| Effort | Dep | Item |
|--------|-----|------|
| S | — | `config.columns` on plans table — **kills the broken table now** |
| S | — | Audit kanban/list for nested-array leakage |
| M | — | Real Plans page: scalar table + card-grid grouped by `projectId` |
| S | — | Lane-meaningful stat tiles (add `count(status=blocked)` etc.) |
| S | — | Markdown widget on detail pages (`_body`) |
| S | — | Roadmap lanes via kanban status→lane mapping |
| M | aiDeck | Wire declared-but-unused discover + inbox sources into pages |
| L | aiDeck | Declare projected phase/task/gate/stack/parked/emerged sources |
| L | aiDeck | Per-plan & per-initiative detail pages w/ `projectId`-scoped param |
| M | aiDeck | Per-record links from lists into detail pages |
| M | aiDeck | DAG page (mermaid interim → interactive later) |
| L | — | **Skill precompute** rollups + drift/review summary into frontmatter/status source (if aiDeck stays read-in-place) |

---

## 6. Phased plan (each phase shippable)

- **P1 — Kill the broken table + real Plans view (quick win, ~0 aiDeck change).**
  `config.columns:[title,status,currentPhase,branch,projectId]` on the plans table; verify
  `_body`/`_file` dropped + native status chips; audit kanban for array leakage; Plans page =
  scalar table + `repeat:projectId` card-grid; add a couple lane stat tiles. **Makes the
  dashboard usable today.**

- **P2 — Markdown bodies + detail-page scaffolding (drill-down).** Single-layout per-plan /
  per-initiative pages: `key-value` scalar metadata + `markdown` `_body`. aiDeck:
  `projectId`-scoped `param` + per-record `linkTo`. Roadmap lanes via kanban; wire inbox to a
  log-feed.

- **P3 — Array-explode projection layer (structural enabler).** aiDeck: `explode`/`projection`
  in manifest-schema + data-source-reader (nested array → one record/element, preserving
  parent scalars + captures); decide rollup ownership (§7); fix `classifyFile` for nested
  paths (SSE). Consumer: declare projected sources.

- **P4 — High-value list/meter views on detail pages.** Phase timeline (stacked progress-bar
  + active highlight), task list (table + chips + blockedBy), exit-gates rows, stack
  (tree-view reshaped, HERE marker), parked/emerged lists w/ precomputed staleness.

- **P5 — Callouts, drift banner, discover triage, DAG.** aiDeck: callout/banner + sparkline
  widgets; skill precomputes drift/review summary; discover page (card-grid + confidence
  progress-bar + evidence chips, bucketed); DAG (mermaid interim → interactive SVG widget
  consuming a projected edge list from `plan.deps[]`).

```
P1 ──▶ P2 ──▶ P3 ──▶ P4 ──▶ P5
(config) (drill-down) (explode) (meters/lists) (callouts/DAG)
```

---

## 7. Decisions required (the forks)

1. **Data-shaping ownership (central fork).** Add a *generic* array-explode + derived-column
   capability to aiDeck (reusable across consumers, "proper", L-effort, changes the
   read-in-place contract) **OR** have the skill precompute denormalized sidecar files /
   frontmatter (keeps aiDeck strictly read-in-place, faster, but duplicates the old
   `adapters.ts` logic and bloats frontmatter). This decides whether P3+ is mostly aiDeck-side
   or skill-side.
2. **Parity level.** Pixel-parity (bespoke phase-card / stack / gate / DAG widgets, faithful
   to the old look) vs insight-parity (generic table / progress-bar / tree-view; information
   over fidelity). Decides whether the L-effort bespoke widgets in P4/P5 are in scope.
3. **DAG fidelity.** Interactive SVG DAG widget in aiDeck (matches `DepGraphOverlay`) vs
   server/skill-rendered mermaid into the existing text widget (cheap, static).
4. **Multi-project scope.** Must the dashboard handle repos with multiple `projects/<id>`
   sharing plan slugs (F-001)? If single-project-per-repo is acceptable for now, the slug-only
   param works and the composite-param aiDeck change defers.
5. **SSE live-refresh.** P1/P2 requirement or deferrable? Needs the `classifyFile` fix; without
   it, manual reload only.
6. **Discover/inbox priority.** Revive discover triage now, or is the operational
   plan/phase/initiative view the only must-have for dogfooding?

---

## 8. Recommended default sequencing (if no other steer)

Ship **P1 immediately** (zero-risk, fixes the visible pain). Do **P2** (drill-down +
markdown) for real navigability. For the central fork, lean **skill-precompute for rollups**
(matches aiDeck's read-in-place philosophy, unblocks fastest) **but** add the **generic
array-explode** to aiDeck (it's the one capability with no good skill-side substitute and it
benefits every future consumer). Target **insight-parity** first; treat bespoke widgets +
interactive DAG as P5 stretch behind a mermaid interim. Defer multi-project composite-param
and SSE to when a second project or a live-edit workflow actually needs them.
