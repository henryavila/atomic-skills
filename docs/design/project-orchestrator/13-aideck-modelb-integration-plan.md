# 13 — aiDeck v2 Model-B Integration Plan (R-MIG-14)

**Date:** 2026-06-02 · supersedes the "extend Model A" recommendation in `12-*.md`.
**aiDeck working copy:** `/Volumes/External/code/aideck` @ branch `feat/aideck-v2-generic-runtime`
(use this checkout to build + validate; **publish to npm** once integration is green).

## Locked decisions
1. **Target = Model B** (v2 generic consumer manifest). aiDeck stays domain-agnostic; atomic-skills
   ships a *consumer* (`manifest.yaml` + `schema.json` + script handlers).
2. **projectId = flatten + optional field.** All `projects/<id>/` plans/initiatives read into one
   flat record set; each record carries an injected `projectId` (the dir segment) for grouping.
3. **Read in-place** (NOT sync into the consumer dir). Build a real aiDeck capability:
   `root: 'project'` dataSources resolved against **registered repos' `.atomic-skills/`** + recursive
   globs. Zero data duplication; the git-tracked nested tree stays canonical.
4. **Full consumer incl. 7 script handlers** + MCP tool-name migration in the skill prompts.

## Key consequence — GAP 4 dissolves
v2 validates consumer data against the **consumer's** `schema.json` via AJV (`strict:false`), not
aiDeck's internal zod (`schemas/validators/project-status.ts`, which pins `0.1` + `.strict()`). So
shipping `schema.json` derived from atomic-skills' `meta/schemas/*.schema.json` gives **0.1∪0.2**
support for free. aiDeck's legacy zod is irrelevant on the Model-B path.

## Canonical source → what aiDeck reads
```
<repo>/.atomic-skills/projects/<projectId>/<planSlug>/plan.md          # frontmatter, slug=identity
<repo>/.atomic-skills/projects/<projectId>/<planSlug>/phases/f<N>-*.md  # initiatives
<repo>/.atomic-skills/projects/<projectId>/<planSlug>/phases/archive/*.md
<repo>/.atomic-skills/bootstrap-drafts/discover-run.json
<repo>/.atomic-skills/bootstrap-drafts/inbox/*.jsonl
```
The repo is registered via the existing `POST /api/projects/register` (shared ProjectRegistry).

---

## PHASE A — aiDeck: read-in-place capability (foundation, testable in isolation)

**A1. Manifest schema** (`src/server/manifest-schema.ts`): extend `dataSourceSchema`:
- `root: z.enum(['consumer','project']).default('consumer')` — `project` ⇒ resolve `path` against a
  registered repo's rootDir (path includes the leading `.atomic-skills/...`).
- `captures: z.array(z.string()).optional()` — names for the glob wildcards, in order; injected into
  every record from that file (this is how `projectId`/`planSlug` get flattened in).

**A2. Glob with captures** (`src/server/data-source-reader.ts`): replace single-`*` `expandGlob` with a
segment-walk matcher supporting per-segment `*` (prefix/suffix) **and** `**` (any depth), returning
`{ filePath, captures: string[] }`. Keep `resolveWithinDir` containment on every walked dir (no
escape via `..` or symlink-out). `**` capture = joined matched segments.

**A3. Reader** (`data-source-reader.ts`): `readDataSource(baseDir, decl)` — caller passes baseDir
(consumer dir or project rootDir). After parsing each file's records, inject
`decl.captures[i] → captureValue[i]` onto every record. Existing `_file`/`_body` behaviour unchanged.

**A4. Endpoints** (`src/server/routes/api-v2.ts` + thread `ProjectRegistry` into `ApiV2Deps` via
`index.ts`):
- `GET /api/consumers/:id/projects` → `registry.list()` (project switcher source).
- `GET /api/consumers/:id/projects/:projectId/data/:ds(/:slug)` → baseDir =
  `decl.root==='project' ? project.rootDir : consumer.dir`; read + return records.
- Keep existing consumer-root `/api/consumers/:id/data/:ds` untouched (back-compat / demo).

**A5. SSE (coarse, milestone-1):** reuse the v0.1 per-project watcher (already watches
`<root>/.atomic-skills`); on any change under a registered repo, emit a consumer-scoped
"data-changed" event the client uses to refetch. Fine-grained nested `classifyFile` mapping = a
follow-up.

**A6. Tests** (`tests/unit/server/...`): nested-layout fixture under `tests/fixtures/projects/`;
cover `**`, multi-`*`, captures injection, containment, `root:project` resolution, endpoint wiring.

## PHASE B — atomic-skills consumer (authored in atomic-skills, installed to `~/.aideck/consumers/atomic-skills/`)

**B1. `schema.json`** — assemble from `meta/schemas/{plan,initiative,common}.schema.json` (already
JSON Schema; 0.1∪0.2). `$id: atomic-skills-schema`, `definitions: {plan, initiative, task,...}`.
**B2. `manifest.yaml`** — pages (overview / board / plan-detail / initiative-detail / discover /
health), widgets, `nav`. dataSources with `root: project`:
  - `plans`: `.atomic-skills/projects/*/*/plan.md`, frontmatter, `captures: [projectId, planSlug]`
  - `initiatives`: `.atomic-skills/projects/*/*/phases/*.md`, frontmatter,
    `captures: [projectId, planSlug, phaseFile]`
  - `initiatives-archive`: `.atomic-skills/projects/*/*/phases/archive/*.md`
  - `discover`: `.atomic-skills/bootstrap-drafts/discover-run.json`, json
  - `inbox`: `.atomic-skills/bootstrap-drafts/inbox/*.jsonl`, jsonl
**B3. 7 script handlers** (`handlers/*.js`) — port from aiDeck `src/mcp/tools/*` + `projections/*`
(mark_task_done, verify_exit_gate, get_next_action, get_dependencies, health, pop_frame,
promote_parked). Handlers gain **project awareness**: `input.projectId` + project-scoped `data` map
(requires the handler runtime to accept projectId — extends Phase A if not already). Writes are
intents → `bootstrap-drafts/inbox/*.jsonl`; the skill applies them (intent pattern preserved).
**B4. Install** — `src/install.js` writes the consumer into `~/.aideck/consumers/atomic-skills/`
(manifest+schema+handlers). Update `resolveAideckBin`/`ensureAideck` for the published npm `aideck`.
**B5. Skill-prompt migration** — rewrite the `AIDECK_*` contract block in `project-view.md` (new
project-scoped endpoints) + MCP tool renames across skill bodies (`aideck_get_plan` → `aideck_read`,
`aideck_mark_task_done` → `aideck_atomic_skills_mark_task_done`, …). This is the one unavoidable
skill-side change (prompt wiring, not data logic).

## PHASE C — validate end-to-end against the current atomic-skills nested tree
Register this repo → open dashboard → plans/initiatives render with projectId grouping → discover
review → MCP read + the 7 tools. Fix drift (expect `schema.json` ↔ live frontmatter mismatches;
reuse `src/normalize.js` learnings).

## PHASE D — publish aiDeck to npm
`@henryavila/aideck` version bump + `npm publish`; point atomic-skills `resolveAideckBin` at the
published binary; drop/refresh `vendor/aideck-runtime`.

## Open follow-ups
- Fine-grained nested SSE `classifyFile` (A5 deferred).
- Custom Vue components (phase-card etc.) — optional, post-milestone.
- Decommission the legacy Model-A `project-status` reader once Model B is proven.
