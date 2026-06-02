# 12 — aiDeck v2 Integration Gap Analysis (R-MIG-14)

**Date:** 2026-06-02
**Branch (atomic-skills):** dogfood/self-host-migration
**aiDeck rebuilt:** `/Volumes/External/code/aideck` @ `bfaeea5` (`@henryavila/aideck` 0.0.1)
**Directive:** gaps are fixed **in aiDeck**, not in the project skill.

---

## TL;DR

aiDeck was rebuilt as a **generic, manifest-driven dashboard runtime**. It now runs **two parallel
models** side-by-side in one server (`src/server/index.ts:buildApp`):

- **Model A — legacy v0.1 `project-status`** (`routes/api.ts` + `projections/state.ts`): the path
  atomic-skills uses today. Reads a registered project's `.atomic-skills/` and returns `{plans,
  initiatives}`. **Still hardcoded to the FLAT layout** (`plans/*.md` + `initiatives/*.md`).
- **Model B — generic v2 consumer** (`routes/api-v2.ts` + `consumer-registry.ts`): consumers live in
  `~/.aideck/consumers/<id>/manifest.yaml`, declare `dataSources`/`pages`/`widgets`/`tools`. Data is
  read **relative to the consumer dir** with **single-level globs only** (`data/*.yaml`).

The project skill now writes the **NESTED** layout
(`.atomic-skills/projects/<projectId>/<planSlug>/plan.md` + `phases/f<N>-*.md`). **Model A cannot see
it** → the dashboard reads zero plans/initiatives. That is the core R-MIG-14 gap. Model B cannot see
it either (consumer-dir-relative paths, no recursive glob). **Both models are blind to the nested
tree as-shipped.**

Recommended target: **extend Model A (legacy project-status reader) to understand the nested
layout.** It already has the right schema, the discover pipeline, the inbox, the watcher, and the
project-registry contract atomic-skills already speaks. Model B is the wrong shape for reading an
external repo's deep tree.

---

## What atomic-skills writes (confirmed from `src/migrate.js`)

```
.atomic-skills/
  projects/<projectId>/
    <planSlug>/
      plan.md                       # fixed filename; identity = frontmatter.slug
      phases/
        f<N>-<initiativeSlug>.md     # phaseFileName(planSlug, initSlug); identity = frontmatter.slug
        archive/*.md                 # archived phase initiatives
    PROJECT-STATUS.md                # per-project index
  status/                            # config.json, routing.json, dispatch-log.{json,jsonl}, telemetry.jsonl
  bootstrap-drafts/
    discover-run.json                # built/validated discover run
    inbox/*.jsonl                    # approve/reject decisions from the aiDeck UI
```

Frontmatter is `schemaVersion: '0.1'` today; meta schemas allow **0.1 ∪ 0.2** coexistence
(`migrate01to02` stamps new files `'0.2'`).

## What aiDeck Model A reads (confirmed from `projections/state.ts:consumerEntityDirs`)

For consumer `project-status`, exactly two dir shapes, single-level `.md` only:
```
<root>/.atomic-skills/project-status/{plans,initiatives}/*.md   # explicit layout
<root>/.atomic-skills/{plans,initiatives}/*.md                  # flat layout (default)
```
`buildForSlug` likewise tries `plans/<slug>.md` then `initiatives/<slug>.md`. **No `projects/`, no
`plan.md`, no `phases/`.**

---

## GAPS (all fixed in aiDeck)

### GAP 1 — Nested layout reader **[CRITICAL, blocks everything]**
`projections/state.ts` (`consumerEntityDirs`, `buildAllForConsumer`, `buildForSlug`) only scans
`{plans,initiatives}/`. The live tree is fully nested → **zero plans/initiatives returned**.
**Fix (aiDeck):** teach the project-status reader a third layout — enumerate
`.atomic-skills/projects/*/`, then per `<planSlug>/` read `plan.md` (kind plan) and `phases/*.md`
(kind initiative), including `phases/archive/*.md`. Slug comes from frontmatter, not filename.
Keep flat/explicit layouts for back-compat.

### GAP 2 — Watcher mis-classifies nested paths → no live SSE updates **[HIGH]**
`writers/paths.ts:classifyFile` keys off the **first** segment under `.atomic-skills/`. For
`projects/<id>/<slug>/plan.md` the head is `projects` (not in `ENTITY_DIRS`) → treated as
`consumer='projects'`, `kind:'other'` → **no `state-change` event emitted**. The chokidar watcher
already watches the whole `.atomic-skills/` recursively (`watcher.ts` watches `atomicSkillsRoot`), so
events fire; only classification is wrong. Dashboard won't live-update on edits.
**Fix (aiDeck):** extend `classifyFile` (and `extractConsumerId`) to recognise
`projects/<id>/<slug>/plan.md` → `{consumer:'project-status', kind:'plan', slug}` and
`projects/<id>/<slug>/phases/[archive/]*.md` → `kind:'initiative'`.

### GAP 3 — Discover-run + inbox path mismatch **[HIGH, discover UI disconnected]**
- aiDeck `projections/discover.ts:hasDiscoverRun` looks at
  `<root>/.atomic-skills/<consumer>/discover-run.json` (= `.atomic-skills/project-status/...`).
- aiDeck inbox (`writers/paths.ts:inboxPathFor`, `routes/api.ts /api/inbox`) uses
  `<root>/.atomic-skills/<consumer>/inbox/<date>.jsonl`.
- The skill writes/reads `.atomic-skills/bootstrap-drafts/discover-run.json` and
  `.atomic-skills/bootstrap-drafts/inbox/*.jsonl`.
→ the discover review loop never connects.
**Fix (aiDeck):** point the discover projection + inbox writer at `bootstrap-drafts/` for the
`project-status` consumer (or make the location a small per-consumer convention). Also verify
`schemas/discover-run.ts` matches what `aideck build-discover-run` emits (it's the same codebase, so
likely fine — confirm).

### GAP 4 — Schema strictness drift → `STATE_ERROR` "failed to load" **[MEDIUM, partly latent]**
aiDeck zod validators are `.strict()` on plan / initiative / exitCriterion / **evidenceBlock** /
context / provenance (`schemas/validators/project-status.ts`). Concrete drifts vs the skill's
0.2-capable frontmatter (`meta/schemas/common.schema.json`):
- **`schemaVersionSchema = z.literal('0.1')`** (`validators/common.ts:3`). The skill plans 0.2
  coexistence; the instant a file is stamped `'0.2'`, aiDeck returns `schema_version_mismatch` and
  `buildAllForConsumer` **hard-fails the whole state** (first error surfaced). Latent today (skill
  still emits 0.1) but a guaranteed future break.
- **`evidenceBlockSchema.strict()`** omits 0.2 `testsCollected` and `mutation` → any 0.2 test
  evidence → 400.
- `exitGateType` enum **matches** (`['standard','ui-gate','custom']` both sides) — no drift (earlier
  suspicion was wrong).
- `taskSchema` is **not** strict, so task-level 0.2 fields (`acceptance`, `scopeBoundary`,
  `closedAt`*, task `evidence`) are silently **stripped** — no 400, but the dashboard can't show them.
  (*`closedAt` is present; `acceptance`/`scopeBoundary`/task-`evidence` are not.)
**Fix (aiDeck):** accept `schemaVersion ∈ {'0.1','0.2'}`; add the 0.2 fields to `evidenceBlock`,
`task`, and manual-gate criterion as optional; keep `.strict()` but widen to the 0.2 superset. This
makes aiDeck the 0.1∪0.2 reader the redesign already specced.

### GAP 5 — `projectId` grouping has no home in aiDeck's model **[MEDIUM, design fork]**
The nested layout introduces an **intra-repo** grouping: one registered repo's `.atomic-skills/` can
hold **multiple** `projects/<projectId>/`. But aiDeck's model is **1 rootDir = 1 project**
(`project-registry.ts`), and `Plan`/`Initiative` schemas have **no `projectId` field**. If we flatten
all `projects/*/*/plan.md` into one `{plans, initiatives}` array, plans from different projectIds mix
with no grouping label and slugs only need to be unique *within* a projectId (collision risk).
**Fork — pick one:**
- (a) **Flatten + add optional `projectId`** to Plan/Initiative (derived from the dir), dashboard
  groups by it. Smallest change, preserves the single state endpoint. *Recommended.*
- (b) Treat each `projects/<projectId>/` as a **separate aiDeck project** (register N, or synthesize N
  from one rootDir). Truer model, but reworks registration + URLs and the skill's
  `/api/projects/register` call.

---

## Non-gaps / confirmed OK
- Project registration (`POST /api/projects/register`) + `validateRootDir` (requires `.atomic-skills/`)
  still exist — the skill's `ensureAideck`/register flow keeps working.
- `EvidenceBlock` rename `done→met`, `references` kind backfill: still covered by the skill's
  `src/normalize.js` pre-flight (the `reference-aideck-card-failed-to-load` mitigation).
- The `AIDECK_STATE_DOMAIN="project-status"` contract block in `project-view.md` does **not** need to
  change — the domain string stays; only aiDeck's internal reader changes.

## Recommended aiDeck work order
1. **GAP 1** nested reader in `projections/state.ts` (+ a `listProjectsLayout` helper). Unblocks the dashboard.
2. **GAP 2** `classifyFile` nested cases → live SSE.
3. **GAP 4** widen validators to 0.1∪0.2 (unblocks forward-compat, kills the latent break).
4. **GAP 3** discover/inbox → `bootstrap-drafts/`.
5. **GAP 5** per the chosen fork (5a recommended: optional `projectId`).

Each ships with vitest coverage in aideck (`src/**/*.test.ts`) using a nested-layout fixture.
