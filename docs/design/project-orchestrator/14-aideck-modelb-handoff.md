# 14 — aiDeck v2 Model-B Integration: Session Handoff (R-MIG-14)

**Read this first to resume cold.** Companion docs: `12-*` (gap analysis), `13-*` (full plan).
Memory breadcrumb: `project-aideck-v2-modelb-integration.md` (+ MEMORY.md line).

## Where things stand (2026-06-02)

aiDeck was rebuilt into a generic v2 runtime. We are reconnecting the project skill via a **Model-B
consumer** (manifest + schema + handlers), reading the repo's git-tracked nested `.atomic-skills/`
**in place**. Locked decisions: Model B · flatten+optional `projectId` · read-in-place · full 7
handlers · then npm-publish aiDeck. Validate with the `/Volumes/External/code/aideck` checkout
(branch `feat/aideck-v2-generic-runtime`).

### DONE
- **Phase A — aiDeck read-in-place capability** — COMMITTED in aideck repo as `7c88b1b`.
  - `src/server/manifest-schema.ts`: dataSource gained `root?:'consumer'|'project'` + `captures?:string[]`.
  - `src/server/data-source-reader.ts`: `expandGlob` rewritten → multi-`*` + `**` segment walk
    returning per-file captures; captures injected onto records (never clobbers an existing field;
    no-glob path still yields `io_error`; `isWithinDir` containment preserved).
  - `src/server/routes/api-v2.ts` + `src/server/index.ts`: `GET /api/consumers/:id/projects` and
    `GET /api/consumers/:id/projects/:projectId/data/:ds(/:slug)`; baseDir = `project.rootDir` when
    `root:'project'` else `consumer.dir`; `ProjectRegistry` threaded into `ApiV2Deps`.
  - Tests: `tests/unit/server/data-source-reader-nested.test.ts` (6) + fixture
    `tests/fixtures/projects/sample-repo/`. Typecheck clean; suite 587/588 (1 pre-existing chokidar
    `file-count-cap` flake — passes in isolation).
- **Phase B-read** — consumer `manifest.yaml` authored at
  `atomic-skills/assets/aideck-consumer/manifest.yaml` (root:project dataSources + captures for
  plans/initiatives/archive/discover/inbox; overview+plans+phases pages). Installed copy at
  `~/.aideck/consumers/atomic-skills/manifest.yaml`. **Live smoke PASSED** against the current repo:
  register → `/projects/atomic-skills/data/plans` count=7, `…/initiatives` count=16, captures
  injected, plan-by-slug found. (Smoke script was throwaway, already deleted.)

### NOT STARTED
Three independent workstreams + validate + publish.

## NEXT STEPS (pick up here)

**Recommended order: #1 client (makes it visible) → #2 B-write → #3 prompts → C → D.**

### 1. Client project-aware rendering  (task #5; aideck/Vue) — RECOMMENDED FIRST
The Vue client still calls consumer-root endpoints, so the browser won't show project data yet.
- `src/client/api.ts`: add `fetchProjects(consumerId)` → `GET /api/consumers/:id/projects`; make
  `fetchDataSource` accept a `projectId` and call `/api/consumers/:id/projects/:projectId/data/:ds`
  when the consumer has any `root:'project'` dataSource (else keep the consumer-root call).
- `src/client/router.ts` + `ConsumerPage.vue`: carry a selected `projectId` (query param or a
  selector); default to the first project. Add a project switcher in the chrome/nav.
- Verify in browser: `cd aideck && npm run dev` (or `aideck up` from the atomic-skills repo so it
  registers), open the dashboard → Overview should show 7 plans / phases kanban. Use the `verify`
  skill / a Vite build test.

### 2. B-write: schema.json + 7 script handlers  (task #2)
- **schema.json** → `assets/aideck-consumer/schema.json`, `$id: atomic-skills-schema`,
  `definitions: { plan, initiative, task, ... }`. Assemble from atomic-skills
  `meta/schemas/{plan,initiative,common}.schema.json` (already JSON Schema, **0.1∪0.2**) — inline the
  `common.schema.json#/$defs/*` refs into one self-contained file (rewrite `$ref`s to
  `#/definitions/...`). AJV loads it `strict:false`. NOTE: read endpoint does NOT validate; schema.json
  is for the `aideck validate` CLI loop + future inline validation. GAP 4 dissolves here (we ship our
  own schema, not aiDeck's 0.1-pinned zod).
- **7 handlers** → `assets/aideck-consumer/handlers/*.js`, ported per aiDeck
  `docs/handoff-atomic-skills-migration.md` §6/§8 from aideck `src/mcp/tools/*` + `src/server/projections/*`:
  mark-task-done, verify-exit-gate, get-next-action, get-dependencies, health, pop-frame,
  promote-parked. Handler signature `export default async ({args,data,files,log}) => {...}`; cwd =
  consumer dir; writes intents to inbox JSONL via `files.append`; the skill applies them (intent
  pattern preserved — aiDeck never writes entity files).
  - **OPEN DESIGN ITEM:** handlers need **projectId awareness** — `data` (the pre-loaded dataSource
    map) and intent targets are per-project, but the current script-handler runtime loads a single
    `data` map with no projectId. Check `aideck/src/server/handlers/script.ts` + the MCP tool path;
    likely need to extend the handler context/input to accept `projectId` and load project-scoped
    data (small Phase-A-style aideck addition). Resolve before porting handlers.
- **install.js** → `atomic-skills/src/install.js`: copy `assets/aideck-consumer/` (manifest + schema +
  handlers) into `~/.aideck/consumers/atomic-skills/`. Follow the existing aideck-bin/dashboard
  install convention (`resolveAideckBin` in `src/serve.js`).

### 3. Skill-prompt migration  (task #2 tail) — the one unavoidable skill-side change
- Rewrite the `AIDECK_*` contract block in `skills/shared/project-assets/project-view.md` for the new
  project-scoped endpoints (state now comes from
  `/api/consumers/atomic-skills/projects/<projectId>/data/<ds>`, not
  `/api/projects/:pid/state/project-status`). Keep it isolated to this one file per the existing
  convention.
- MCP tool renames across skill bodies: `aideck_get_plan`→`aideck_read`,
  `aideck_mark_task_done`→`aideck_atomic_skills_mark_task_done`, etc. Full mapping in aideck
  `docs/handoff-atomic-skills-migration.md` §6. Re-run the skill compatibility/strip tests after.

### Phase C — validate end-to-end
Register this repo, open the dashboard (client done), exercise discover review + the 7 MCP tools
against the live nested tree. Expect/fix `schema.json` ↔ live-frontmatter drift (reuse
`src/normalize.js` learnings; see `reference-aideck-card-failed-to-load`).

### Phase D — publish aiDeck to npm
Version bump `@henryavila/aideck` (currently 0.0.1) + `npm publish`; repoint
`atomic-skills/src/serve.js:resolveAideckBin` at the published binary; refresh/drop
`atomic-skills/vendor/aideck-runtime`.

## Quick re-validate of Phase A/B-read (sanity on resume)
```
cd /Volumes/External/code/aideck && npx vitest run tests/unit/server/data-source-reader*.test.ts
# manifest already at ~/.aideck/consumers/atomic-skills/manifest.yaml
# (re-run the curl smoke by starting the server + POST /api/projects/register if needed)
```

## UPDATE 2026-06-02 (session 2): client done + B-write runtime findings

**DONE this session (committed):**
- aideck `b7a95d3` — **client project-aware rendering** (task #5 ✅). `api.fetchProjects` +
  `fetchDataSource(projectId)`; `ConsumerPage` detects `root:project` dataSources → project selector
  + `provide(PROJECT_ID_KEY)` (seeded from `?project=`); `WidgetRenderer` injects + passes it. Client
  73/73 + new project-scoped test; **live serve check passed** (SPA served, project-scoped plans=7).
- atomic-skills `8389ae2` — docs 12/13/14 + `assets/aideck-consumer/manifest.yaml`.

**Two aiDeck findings that reshape B-write (resolve before porting the 7 handlers):**

1. **MCP process isolation.** `aideck mcp` is a SEPARATE stdio process from the HTTP/dashboard
   server; the in-memory `ProjectRegistry` (filled by dashboard `POST /api/projects/register`) is NOT
   visible to MCP handlers. So handlers can't map a `projectId` → repo via that registry.
   **RECOMMENDED handler model = per-launch-repo (model A):** `aideck mcp` is launched with cwd =
   the repo (per-project MCP server, the Claude Code convention). Handlers operate on that repo:
   `root:project` dataSources resolve against the launch `rootDir`; intents are written to
   `<rootDir>/.atomic-skills/bootstrap-drafts/inbox/` (preserves where the skill already reads → MINIMAL
   skill change). NO `projectId` tool arg. Alternative (model B, rejected unless multi-project-from-one-
   MCP is needed): explicit `projectId` arg + a persisted `~/.aideck/projects.json` registry.
   - **Implementation (model A):** thread a `rootDir` into the MCP server (`src/mcp/server.ts` →
     `registerConsumerTools(registry, consumers, rootDir)`); in `src/mcp/tools/consumer-tools.ts`
     `loadConsumerData` resolve per-dataSource baseDir (`root:project`→rootDir else consumer.dir);
     give `executeScript`/`executeComposite` a separate **writeBaseDir** (= rootDir) so `files.append`
     + `computeWritablePaths`/`validateWritePath` target the repo's inbox, while the handler MODULE
     still loads from consumer.dir. `aideck mcp` must accept/derive rootDir (cwd or `--root`).
2. **`validate` CLI glob is single-`*` only** (`src/cli/validate.ts:pathMatchesDataSource`) — it won't
   match our multi-`*` nested paths. Reuse the new `data-source-reader` matcher there before relying on
   `aideck validate` for the agent generate-validate-fix loop. (Read path + MCP do NOT use schema.json,
   so this only gates the validate loop.)

**schema.json (deprioritized):** AJV-based (`src/server/schema-validator.ts`). Bundle from
atomic-skills `meta/schemas/*` by merging `$defs` (common+plan+initiative — no name collisions),
rewriting `common.schema.json#/$defs/` → `#/$defs/`, and dropping top-level `additionalProperties:false`
(the reader injects `_body`/`_file`/`projectId`/… so strict-extra would false-reject). Only consumed by
the `validate` CLI → do it together with finding #2.

**Revised next-step order:** handler-runtime model A (foundation) → 7 handlers → install.js →
validate-CLI glob + schema.json → prompt migration → C → D.

## UPDATE 2026-06-02 (session 3): Phase B DONE

All of Phase B is implemented, committed, and validated.
- aideck `ca12075` — handler-runtime **model A**: `executeScript` gains `writeBaseDir`;
  `consumer-tools` resolves project data + intent writes against the `aideck mcp` launch repo
  (`ctx.rootDir`). Handler/mcp tests 60; aideck suite **590/590**.
- atomic-skills `7221ee9` — **7 script handlers** (`assets/aideck-consumer/handlers/*.js` + `_lib.js`)
  + manifest `tools[]`. Handler smoke PASS: 7 tools registered, get_next_action/dependencies/health
  correct, 4 mutations wrote intents to the **repo** `bootstrap-drafts/inbox/` (model A confirmed).
- atomic-skills `ff3c341` — **schema.json** (`scripts/build-aideck-consumer-schema.mjs`, npm
  `build:aideck-schema`; draft-07; AJV compiles + validates the live plan + 6 initiatives) +
  `install.js` copies `assets/aideck-consumer/` → `~/.aideck/consumers/atomic-skills/`.
- atomic-skills `67817cf` — **prompt migration**: `project-view.md` AIDECK CONTRACT block →
  Model-B (`AIDECK_CONSUMER`, `/api/consumers/.../projects/$pid/data/<ds>`, page
  `/$AIDECK_CONSUMER?project=$pid`; register unchanged). Skill uses HTTP not MCP → no tool-rename in
  bodies. Skill suite **705/705**.

**Remaining:** Phase C (validate end-to-end — register a real repo, open the consumer dashboard in a
browser, exercise discover + the 7 MCP tools) → Phase D (npm publish + repoint `resolveAideckBin`).
**Deferred follow-ups:** `project-discover.md` discover-flow migration (needs a discover *page* in the
manifest + a decision-write path); aideck `cli/validate.ts` multi-`*` glob (so `aideck validate` works
on nested paths); fine-grained nested SSE `classifyFile`.

## Gotchas
- aideck working tree has **pre-existing unrelated** `.atomic-skills/` changes — do NOT bundle them
  into Model-B commits (stage files explicitly, as `7c88b1b` did).
- macOS FS is case-insensitive: `../aideck` and `../aiDeck` are the same dir.
- Commit only on explicit request. Branch: aideck `feat/aideck-v2-generic-runtime`, atomic-skills
  `dogfood/self-host-migration`.
