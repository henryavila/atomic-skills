# Reference — aiDeck consumer dashboard (rollups, generated schema, capability dependency)

Non-obvious facts for anyone editing `assets/aideck-consumer/` or the dashboard port (R-MIG-14, T-005..T-009). Companion: `docs/design/project-orchestrator/15`/`16`/`17`; aiDeck contract = `../aideck/docs/component-spec-atomic-skills-dashboard.md`.

## `schema.json` is GENERATED — never hand-edit it
`assets/aideck-consumer/schema.json` is built by `npm run build:aideck-schema`
(`scripts/build-aideck-consumer-schema.mjs`) from `meta/schemas/{common,plan,initiative}.schema.json`
(bundles `$defs`, rewrites refs to `#/definitions/`, drops top-level `additionalProperties:false`).
Edit the **meta schemas** then rebuild — a hand-edit to `schema.json` is overwritten.
`meta/schemas/*.schema.json` are `additionalProperties:false`, so ANY new frontmatter field
MUST be declared there first or both `scripts/validate-state.js` and the consumer schema reject it.

## Dashboard meters read skill-precomputed rollups (aiDeck has no compute engine)
Initiative frontmatter carries `tasksDone`/`tasksTotal`/`gatesMet`/`gatesTotal`. The generic
aiDeck reads state in place and cannot compute, so the **skill** writes these:
- Recompute on every task/gate **status** mutation (rule in `skills/core/project.md`, mirrored in
  `project-transitions.md` done/phase-done), OR run `node scripts/compute-rollups.js` (idempotent
  batch/backfill + drift fixer).
- Rollups are **self-contained per initiative** (count its own `tasks[]`/`exitGates[]`). The
  `phase-timeline` widget binds to the `initiatives` source (NOT exploded `plan.phases[]`) precisely
  to avoid a plan↔initiative join — the plan `phaseDescriptor` has no `tasks[]`.
- `staleDays` is deliberately NOT persisted (it's now-relative; compute at read time like `handlers/health.js`).

## The consumer manifest is ahead of the published aiDeck
`manifest.yaml` now uses aiDeck **§2a array-explode** (`derivesFrom`/`explode`/`carry` derived
dataSources), **§2b slots** (composition), **§2c drill-down** (`source.param` as
`string | {match:[ string | {field,param} ]}` + row-scoped `linkTo`), and the
`callout`/`sparkline`/`phase-timeline` widgets. These exist only on aiDeck
`feat/aideck-v2-generic-runtime` (NOT yet on npm). Until T-004 (publish + repoint
`src/serve.js:resolveAideckBin`), bring the dashboard up against the sibling build:
`AIDECK_BIN=/Volumes/External/code/aideck/dist/cli.js node …/aideck/dist/cli.js serve --port 7799 --static-dir …/aideck/dist/client` (resolveAideckBin otherwise prefers the stale vendored bin). Detail pages route `/:consumerId/<plan|phase>/:projectId/:slug`.

## Deep-links on every plan/initiative/phase surface (2026-06-05)
Every place a plan/initiative/phase appears now navigates to its detail. The route
shapes (`plan/:projectId/:planSlug`, `phase/:projectId/:slug`) live ONLY in the
consumer manifest — **aiDeck stays agnostic**: the widget link work is pure mechanism
(`resolveRowLink` token interpolation), zero atomic-skills vocabulary/fields/routes.
- aiDeck lane (generic, on `feat/aideck-v2-generic-runtime`): per-record `linkTo`
  added to `callout`/`panel`/`phase-timeline`/`kanban`; tables got `linkField` (a
  named column renders as a real `<a>`, not just a row click); the `callout` linkTo
  became the whole-banner anchor. `cursor:pointer`/hover scoped to `tr[role="link"]`
  (was an unconditional pre-existing bug — a non-link table looked clickable).
- consumer lane: `linkTo` on the surfaces + `linkField: title` on task/plan tables.
- **Tasks are intentionally NOT linked** — there is no `task` detail page (routes are
  home/overview/plans/phases/plan/phase). Linking a task→its parent phase is
  redundant (the phase is already on "Fase atual" + the timeline) and misleading.
- Foco order: Plano em foco → Fase atual|Tarefas-meter → "Onde estou no plano"
  timeline → task table. The `&statusvocab` YAML anchor is defined on the FIRST
  status widget on the page (moving widgets above it requires relocating the anchor).

## Applying + verifying a dashboard change LIVE
Manifest is cached at server startup (no hot-reload); the client is served from
`../aideck/dist/client` on disk. So: client change = rebuild + browser hard-refresh
(no restart); **manifest change = re-provision (`node src/provision-consumer.js <pid>`)
+ restart + re-register the project** (registration is in-memory). `serve` defaults to
7777 and falls back to 7778+ if busy — a *failed* kill leaves a stale server on 7777
serving the old manifest. Kill by `lsof -iTCP:7777 -iTCP:7778 -sTCP:LISTEN` pids, not a
lock-pid read. **Verify the rendered DOM with headless Playwright** (anchors,
`getComputedStyle(row).cursor`, widget Y-order) — the manifest API and unit tests can
be green while the browser shows stale/wrong. Use `waitUntil:'load'` (SSE never idles).

## Local aiDeck dev workflow and smoke gotchas (2026-06-25)
- `scripts/dev-aideck.mjs link` must stage the same launcher shim produced by
  `src/runtime-layers/aideck.js::buildShim()`. Copying `dist/cli.js` directly into
  `~/.atomic-skills/bin/aideck.mjs` breaks because the CLI's relative imports
  resolve beside the staged shim instead of beside the aiDeck package `dist/`.
  Regression tests must execute the staged shim, not only inspect strings.
- The v2 consumer dataSources bind to regenerable JSON under
  `.atomic-skills/.aideck/state/*.json`. Before dashboard serve/register/smoke,
  run the `refresh-state` chokepoint so `plans.json`, `phases.json`, and
  `initiatives.json` exist. Missing files surface as REST `io_error` on
  `/api/consumers/atomic-skills/projects/<projectId>/data/<ds>`.
- `initiatives` is `root: project`; the smoke route is
  `/api/consumers/atomic-skills/projects/<projectId>/data/initiatives`, not the
  old `/api/consumers/atomic-skills/initiatives`.
- `aideck up` alone starts the API without the staged SPA and `/` returns
  `not found`. For a browser dashboard either use `atomic-skills serve` or pass
  `--static-dir=$HOME/.atomic-skills/dashboard`, then register the project.

## aiDeck Home vs project scope (2026-06-25)
- The aiDeck root `/` is the global dashboard landing. It must render the
  project-centric consumer's `nav.landingPage` in place; it must NOT redirect to
  `/:consumerId/:landingPage`, because that makes a cross-project Panorama look
  scoped to a consumer/project in the URL.
- In aiDeck code, keep this generic: prefer the registered consumer whose summary
  has `navStyle: 'projects'`; use its manifest as the rendering/data contract,
  but keep `router.currentRoute.fullPath === '/'`.
- On the landing page for `nav.style:'projects'`, `selectedProjectId` must stay
  `undefined`. The first registered project may appear inside the Panorama card
  list, but it must not become the page scope. Per-project pages (`foco-agora`,
  detail routes, or `?project=`) are the only places that expand/select projects.
