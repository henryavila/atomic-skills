Track and update canonical Plan / Initiative / Task state in `.atomic-skills/`. View + daily mutations only — creation, migration, and structural changes live in `atomic-skills:project-plan`.

This skill implements a 3-level model that matches `@henryavila/aideck`:

- **Plan** — multi-phase project with narrative, principles, glossary, phases, exit gates (`.atomic-skills/plans/<slug>.md`)
- **Initiative** — one phase of a plan, OR a standalone unit of work (`.atomic-skills/initiatives/<slug>.md`)
- **Task** — atomic action inside an initiative (frontmatter `tasks[]`)

Standalone initiatives (no `parentPlan`) coexist with plan-anchored initiatives. Plans are optional; a project may run with only initiatives.

State files conform to JSON Schemas in `meta/schemas/` (`plan.schema.json`, `initiative.schema.json`, `common.schema.json`). Validate via `npm run validate-state`. Canonical `schemaVersion` is `'0.1'`.

## Iron Law

NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE.

Every code-modifying session must be anchored to an active initiative in `.atomic-skills/initiatives/<slug>.md` (standalone or under an active plan), or the user must explicitly declare "ad-hoc".

## Initial detection

Run with {{BASH_TOOL}}:
- `test -d .atomic-skills/` — if absent, enter setup mode
- If present, read `.atomic-skills/PROJECT-STATUS.md`:
  - Determine the **active Plan** (if any) and its `currentPhase`
  - Determine the **active Initiative** (phase initiative of the active plan, OR a standalone initiative)
  - If the current branch matches no active initiative → run the disambiguation flow

## Modes

See sections below per {{ARG_VAR}}.

## Setup (when `.atomic-skills/` does not exist)

Announce: "I will configure project-status in this repo."

### 1. Detect environment
- `test -d .claude/` → Claude Code
- `test -d .cursor/` → Cursor
- `test -d .gemini/` → Gemini CLI
- Otherwise → generic IDE; skip step 5

### 2. Verify/create CLAUDE.md
- If CLAUDE.md is absent: ask "Create minimal CLAUDE.md with hard-gate? (y/n)" — if yes, create with a title + hard-gate template
- If CLAUDE.md exists: prepare to inject block between markers

### 3. Inject hard-gate into CLAUDE.md (idempotent)
Read `skills/shared/project-status-assets/CLAUDE.md-gate.template.md` (assets packaged with the skill).
Check if markers `<!-- atomic-skills:status-gate:start -->` already exist:
- If yes and content is identical: skip
- If yes and content differs: show diff, ask if updating
- If not: append to end of CLAUDE.md

### 4. AGENTS.md redirect
- If AGENTS.md absent: create from `skills/shared/project-status-assets/AGENTS.md.template.md`
- If AGENTS.md exists and references CLAUDE.md: skip
- If AGENTS.md exists without reference: show suggested diff, ask confirmation (do not force)

### 5. Install hooks (Claude Code only)
Present Structured Options:
> What enforcement level?
> (a) Passive — hard-gate in CLAUDE.md only, no hooks
> (b) Soft (recommended) — hard-gate + SessionStart hook + PreToolUse provenance gate (dry-run)
> (c) Strict — hard-gate + SessionStart + Stop hook + PreToolUse provenance gate (all dry-run 7d before real strict)

For (b) and (c): copy `session-start.sh`, `stop.sh`, and `pre-write.sh` to `.atomic-skills/status/hooks/`, register them in `.claude/settings.local.json` under `SessionStart`, `Stop`, and `PreToolUse` (with `matcher: "Edit|Write|MultiEdit"`) respectively.

For (b): copy `config.json` with `strict_mode: false`, `emergent_strict_mode: false`, and `dry_run_started: $(date -I)`.
For (c): same `config.json` shape — both strict knobs default false during the 7-day dry-run window.

The `pre-write.sh` gate intercepts direct Edits to `.atomic-skills/initiatives/*.md` and `plans/*.md` that add entries to `tasks[]` or `phases[]` without a `provenance:` field. Use the documented `new-task` / `new-phase` / `split-phase` / `emerge --target` commands (they set provenance automatically) instead. Bypass for 24h with `touch .atomic-skills/status/SKIP-EMERGENT`.

### 6. Create structure

Use {{BASH_TOOL}}:
```bash
mkdir -p .atomic-skills/plans/archive
mkdir -p .atomic-skills/initiatives/archive
mkdir -p .atomic-skills/status/hooks
```

Copy `PROJECT-STATUS.md.template.md` to `.atomic-skills/PROJECT-STATUS.md`, replacing `REPLACE_ISO_TIMESTAMP` with the current timestamp.

### 7. Update .gitignore
Append (if not present):
```
.atomic-skills/status/stop.log
.atomic-skills/status/drift.log
.atomic-skills/status/emergent-drift.log
.atomic-skills/status/SKIP
.atomic-skills/status/SKIP-EMERGENT
.atomic-skills/status/reconciliation.log
.atomic-skills/status/last-session.json
.atomic-skills/plans/*.rendered.md
.atomic-skills/initiatives/*.rendered.md
.atomic-skills/bootstrap-drafts/
.atomic-skills/status/bootstrap.json
```

### 8. Report
List everything created and give rollback instructions (`git status` + `git restore`).

Also ask: "Scan repo to discover in-flight initiatives? (y/N)". If yes, invoke `atomic-skills:project-plan discover` (multi-source scan that detects standalone initiatives AND multi-phase plans).

## View modes

### Default (no args, structure exists)

The default view opens the **aiDeck dashboard** in the browser. aiDeck is the canonical visual surface for `.atomic-skills/` state — it renders plans, initiatives, tasks, exit gates, annotations, and highlights in real-time via a chokidar watcher + SSE push.

Steps:

1. **Ensure aiDeck is running.** Run this script with {{BASH_TOOL}} — it is self-contained (no imports) and works from any repo because it uses the binaries installed to `~/.atomic-skills/` by `atomic-skills install`:

   ```bash
   AIDECK_BIN="${AIDECK_BIN:-$HOME/.atomic-skills/bin/aideck.mjs}"
   DASHBOARD_DIR="$HOME/.atomic-skills/dashboard"
   AIDECK_URL=""

   # 1. Check env files for an already-running instance
   for envf in "$HOME/.aideck/env" "$HOME/.atomic-skills/env"; do
     if [ -f "$envf" ]; then
       url=$(grep -oP "(?<=AIDECK_URL=')[^']+" "$envf" 2>/dev/null \
         || grep -o "http://[^ '\"]*" "$envf" 2>/dev/null | head -1)
       if [ -n "$url" ]; then
         health=$(curl -sf "$url/api/health" 2>/dev/null)
         if echo "$health" | grep -q '"service":"aideck"'; then
           # Register this project
           curl -sf -X POST "$url/api/projects/register" \
             -H 'Content-Type: application/json' \
             -d "{\"rootDir\":\"$PWD\",\"projectId\":\"$(basename "$PWD")\"}" >/dev/null 2>&1
           AIDECK_URL="$url"
         fi
       fi
     fi
   done

   # 2. If not running, spawn it
   if [ -z "$AIDECK_URL" ] && [ -f "$AIDECK_BIN" ] && [ -d "$DASHBOARD_DIR" ]; then
     nohup node "$AIDECK_BIN" serve --static-dir "$DASHBOARD_DIR" >/dev/null 2>&1 &
     disown 2>/dev/null
     # Poll until healthy (max 8s)
     for i in $(seq 1 16); do
       sleep 0.5
       for envf in "$HOME/.aideck/env" "$HOME/.atomic-skills/env"; do
         if [ -f "$envf" ]; then
           url=$(grep -o "http://[^ '\"]*" "$envf" 2>/dev/null | head -1)
           if [ -n "$url" ] && curl -sf "$url/api/health" >/dev/null 2>&1; then
             curl -sf -X POST "$url/api/projects/register" \
               -H 'Content-Type: application/json' \
               -d "{\"rootDir\":\"$PWD\",\"projectId\":\"$(basename "$PWD")\"}" >/dev/null 2>&1
             AIDECK_URL="$url"
             break 2
           fi
         fi
       done
     done
   fi

   # 3. Validate THIS project's state before opening the browser.
   #    aiDeck validates the whole project state all-or-nothing; one schema
   #    error makes the dashboard card render only "⊘ <project> — failed to
   #    load" with the real message hidden. Surface it here instead.
   STATE_ERROR=""
   if [ -n "$AIDECK_URL" ]; then
     pid=$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
     # NOTE: -s only (NOT -sf): aiDeck returns HTTP 400 on schema errors, and
     # curl -f would discard the body — i.e. swallow the very message we want.
     STATE_ERROR=$(curl -s "$AIDECK_URL/api/projects/$pid/state/project-status" 2>/dev/null \
       | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);if(j&&j.error){const e=j.error,d=e.details||{};const loc=d.path?` | file: ${d.path}`:"";const n=d.totalErrors&&d.totalErrors>1?` (+${d.totalErrors-1} more)`:"";process.stdout.write(`${e.message}${n}${loc}`)}}catch(_){}})' 2>/dev/null)
   fi

   # 4. Output
   if [ -n "$AIDECK_URL" ]; then
     echo "AIDECK_URL=$AIDECK_URL"
     [ -n "$STATE_ERROR" ] && echo "STATE_ERROR=$STATE_ERROR"
   else
     echo "AIDECK_URL="
   fi
   ```

   Parse the output: if `AIDECK_URL` is non-empty, aiDeck is running.

2. **Auto-repair on `STATE_ERROR`.** If the script printed a non-empty `STATE_ERROR=...` line, this project's state failed aiDeck's `.strict()` schema validation — the dashboard would otherwise show `⊘ <project> — failed to load` with the real reason hidden. Repair the data **automatically** (do not just report it), then continue:

   a. **Run the normalizer.** It fixes every known drift class deterministically and idempotently — exit-gate `status` synonyms → `met`/`pending`, `references[]` missing `kind` / using `title`, and missing required initiative fields (`stack`, `tasks`, `parked`, `emerged`, `branch`, `nextAction`) backfilled to safe empties. Resolve it in this order and run the first that exists:
      ```bash
      NORM=""
      for c in "$PWD/src/normalize.js" \
               "$(npm root -g 2>/dev/null)/@henryavila/atomic-skills/src/normalize.js" \
               "$HOME/.atomic-skills/src/normalize.js"; do
        [ -f "$c" ] && NORM="$c" && break
      done
      [ -n "$NORM" ] && node "$NORM" "$PWD/.atomic-skills"
      echo "NORM=$NORM"
      ```
   b. **If `NORM` is empty** (script not resolvable in this repo), apply the same rules yourself with your file tools on the file named in `STATE_ERROR` (and any others that still fail): for each `exitGates[]` / phase `criteria[]` entry, map `status: done`→`met` (add `metAt` from `lastUpdated`/`started`), any other invalid value → `pending` — **never** write `done` on a gate (see *Gate status invariant*); for each `references[]` entry add `kind` (`url` if the path is `http(s)://`, else `file`) and rename `title`→`label`; backfill any missing required initiative array as `[]` and `branch`/`nextAction` as `null`. **Never** add these keys to a plan file (plans are `.strict()` and reject them).
   c. **Re-validate** by re-running the `STATE_ERROR` curl from step 1's script. Repeat (a)/(b) for any newly-surfaced file until `STATE_ERROR` is empty.
   d. Print a one-line summary of what was repaired. The aiDeck watcher reloads the card via SSE once the data is valid — no rebuild or reinstall needed (the bundle is never the problem; the data is).
   e. Then continue to open the browser so the user sees the corrected card.

3. If `AIDECK_URL` is non-empty:
   - Open the browser: `open "$AIDECK_URL"` (macOS) or `xdg-open "$AIDECK_URL"` (Linux). On failure, print the URL for the user.
   - Print: `Dashboard: <url>`

4. If `AIDECK_URL` is empty (binary not found, spawn failure):
   - Fall back to the **terminal view** (`--terminal` behavior below)
   - Print: `aiDeck not available — showing terminal view. Run \`atomic-skills install\` to set up the dashboard.`

5. After opening the browser, also print a **compact terminal summary** (3-5 lines) so the AI has context without needing to fetch from the API:
   - Active plan/phase (if any)
   - Active initiative slug + task progress (e.g. `3/7 done, 1 blocked`)
   - Next action
   - CODEX REVIEW line (see `## Codex review tracking` below)

### `--terminal`

Full terminal-only view (the previous default). No browser launch.

If there is an active initiative whose `branch:` matches `git rev-parse --abbrev-ref HEAD`:
- Read `.atomic-skills/initiatives/<slug>.md`, parse frontmatter YAML
- Render in terminal:
  1. Header: `▸ <slug> · <status> · depth <N> · updated <human-timestamp>`
     - If the initiative has `parentPlan` + `phaseId`, prepend: `<plan-slug>/<phaseId> ▸ <slug>`
  2. STACK (tree with box-drawing): each frame from `stack:` indented; mark last with ` ◉ HERE`
  3. TASKS (table): ID | Title | State-with-icon | Updated | Solves
     - The `Solves` column renders `context.solves` (truncated to fit, e.g. 60 chars + `…`). For original-materialization tasks (no context), render `—`. The column is what makes every row self-explanatory in a listing — without it, the user has to `why <id>` every line to remember what each task is about.
  4. PARKED + EMERGED side by side (2 columns). Each item renders as:
     ```
     ⌂ <truncated title>
        solves: <truncated context.solves>
        <age> · ⌛ if lastReviewedAt > staleContextDays
     ```
     The `solves` line is mandatory in the render — when `context.solves` is absent (shouldn't happen post-migration, but legacy data may), render `solves: (legacy — re-ratify to articulate)` to nudge the user toward `re-ratify <id>`.
  5. NEXT: `<nextAction>` from frontmatter
  6. **CODEX REVIEW** line: see `## Codex review tracking` below — this single line tells the user whether the work-in-progress has been adversarially reviewed since the last meaningful change, and surfaces the `review-due` command if not.

Unicode icons:
- `✓` done, `◉` active, `·` pending, `⊘` blocked, `⌂` parked, `⇥` emerged
- `◉ HERE` marks the active frame
- `←` or `waits X` for dependencies
- `⌛` lastReviewedAt is older than `staleContextDays`

ANSI colors (respecting `$NO_COLOR`):
- done → green, active/HERE → cyan, pending/— → gray, blocked → yellow, parked → magenta, stale-context → dim

### `--list`

Two tables: active Plans, then active standalone Initiatives.

```
ACTIVE PLANS
┌──────────────┬─────────┬───────────────┬──────────────┬─────────────┐
│ Slug         │ Status  │ Current Phase │ Branch       │ Started     │
├──────────────┼─────────┼───────────────┼──────────────┼─────────────┤
│ <plan-slug>  │ active  │ F0            │ <branch>     │ YYYY-MM-DD  │
└──────────────┴─────────┴───────────────┴──────────────┴─────────────┘

ACTIVE INITIATIVES (standalone)
┌────────────────┬─────────┬─────────────┬──────────────┬────────────────────────┐
│ Slug           │ Status  │ Started     │ Branch       │ Next Action            │
├────────────────┼─────────┼─────────────┼──────────────┼────────────────────────┤
│ <slug>         │ active  │ YYYY-MM-DD  │ <branch>     │ <nextAction>           │
└────────────────┴─────────┴─────────────┴──────────────┴────────────────────────┘
```

### `--plan [<slug>]`

Bird's-eye view of an active plan (or the only active plan if no slug given). Render:
1. Header: `<plan-slug> · v<version> · <status> · currentPhase: <id>`
2. PRINCIPLES (numbered list, title only)
3. PHASES (table): ID | Title | Status (icon) | SubPhases | Depends On | Exit Gate Summary
4. INTER-PHASE GATES (if present): "from → to: <criteria>"
5. REFERENCES (count + first 3)

### `--phase [<phase-id>]`

Detail view of the current phase of the active plan (or the given phase id). Render:
1. Header: `<plan-slug>/<phaseId> — <title> · <status>`
2. GOAL
3. EXIT GATE: criteria with status icons; render verifier kind summary
4. INITIATIVE for this phase (if exists): tasks summary inline
5. CROSS-TASK REFS impacting this phase

### `--stack`

Only the STACK section of the active initiative. 3-8 lines. For quick mid-session checks.

### `--archived`

Last 10 entries from `.atomic-skills/plans/archive/` AND `.atomic-skills/initiatives/archive/`, tabular, sorted by archived date desc.

## Schema reference (frontmatter fields)

The skill conforms to the JSON Schemas in `meta/schemas/`. Below is a quick reference; the schema files are authoritative.

### Plan (`.atomic-skills/plans/<slug>.md` frontmatter)

Required: `schemaVersion: '0.1'`, `slug`, `title`, `version`, `status`, `started`, `lastUpdated`, `currentPhase` (string|null), `parallelismAllowed` (bool), `phases[]`.

Optional: `branch`, `principles[]`, `glossary[]`, `tracks[]`, `interPhaseGates[]`, `supersedes`, `references[]`, `whatStaysValid[]`.

Markdown body: `narrative` — the long-form context, motivation, full decomposition. Not in frontmatter.

`PhaseDescriptor`: `id`, `slug`, `title`, `goal`, `dependsOn[]`, `subPhaseCount`, `exitGate {summary, criteria[]}`, `status`. Optional: `parallelWith[]`, `track`, `audience`, `externalImports[]`, `exitGateType` (`standard`/`ui-gate`/`custom`).

`ExitCriterion`: `id`, `description`, `status` (`pending`/`met`/`deferred`). Optional: `verifier`, `metAt`, `deferredReason`.

> **Gate status invariant.** Exit-gate `status` is `pending`/`met`/`deferred` ONLY. It is NOT a Task status — never write `done`, `active`, or `blocked` on a gate. A completed gate is `met` (with `metAt`); a skipped gate is `deferred` (with `deferredReason`). aiDeck validates this enum with a `.strict()` schema and rejects the **entire** project state on the first violation, so one stray `done` on a gate makes the whole project card render `⊘ <project> — failed to load` in the dashboard. This is the single most common cause of that card.

`ExitCriterionVerifier` (oneOf):
- `{ kind: shell, command, expectExitCode? }`
- `{ kind: query, sql, expectRowCount? }`
- `{ kind: test, runner, pattern }`
- `{ kind: manual, description }`

### Initiative (`.atomic-skills/initiatives/<slug>.md` frontmatter)

Required: `schemaVersion: '0.1'`, `slug`, `title`, `goal`, `status`, `branch` (string|null), `started`, `lastUpdated`, `nextAction` (string|null), `exitGates[]`, `stack[]`, `tasks[]`, `parked[]`, `emerged[]`.

Optional: `parentPlan`, `phaseId`, `audience`, `scope {paths[]}`, `externalImports[]`, `references[]`, `crossTaskRefs[]`.

Markdown body: `body` — additional rationale, decisions, gotchas. Not in frontmatter.

`Task`: `id`, `title`, `status` (`pending`/`active`/`done`/`blocked`), `lastUpdated`. Optional: `description`, `closedAt`, `blockedBy[]`, `outputs[]`, `tags[]`, `resourceCounts`, `scopeBoundary[]` (explicit "do NOT do X" exclusions), `acceptance[]` (max 5 `it()`-style assertions), `verifier`.

`StackFrame`: `id` (int ≥ 1), `title`, `type` (`task`/`research`/`validation`/`discussion`), `openedAt`.

`CrossTaskRef`: `fromTaskId`, `toInitiativeSlug`, `toTaskId`, `relation` (`depends_on`/`extends`/`unblocks`/`references`). Optional: `note`.

## Parsing frontmatter YAML

You (LLM) can parse frontmatter YAML directly — it is plain text with predictable structure. For edge cases (nested quotes, multi-line, complex lists), invoke the `yaml` npm package via `node -e "import('yaml').then(...)"`.

## Mutation modes

In each case, update the target frontmatter YAML and bump `lastUpdated:` to now (`date -u +%Y-%m-%dT%H:%M:%SZ`).

Quick map (mutations that exist + their section anchor):

| Command | What it does |
|---------|--------------|
| `push <description>` | Push a new stack frame (lateral expansion) |
| `pop [--resolve\|--park\|--emerge]` | Pop top frame with destination |
| `park <description>` | Add a parked item |
| `emerge <description>` | Add an emerged finding |
| `emerge --target <phaseId> "<title>"` | Cross-phase emergence (adds to target phase's initiative, not the active one; requires ratified context) |
| `promote <title-or-idx>` | Promote a parked item to a real task |
| `done <task-id>` | Mark task done; auto-detect last-task-done |
| `phase-done` | Verify exit gates, advance to next phase (now prompts codex review) |
| `phase-reopen` | Reverse of phase-done |
| `archive [<slug>]` | Move plan/initiative to archive/ |
| `switch <slug>` | Pause current active, set target as active |
| `detect-scope` | Suggest scope.paths from recent git activity |
| `review-due` | Cross-model codex review against the diff since last review |
| `why <id>` | Show full context for a task / phase / parked / emerged entry — title, status, provenance, ratified solves/trigger, lastReviewedAt aging |
| `re-ratify <id>` | Re-articulate the context of an existing item (refreshes `lastReviewedAt`, optionally rewrites solves/trigger) |
| `scope-creep` | On-demand drift report (phases grew, scope expansion %, parked zombies, stale-context items) |

**Creation, migration, and structural commands** (`new`, `new-task`, `new-phase`, `split-phase`, `migrate`, `re-bootstrap`) live in **`atomic-skills:project-plan`**. Bootstrapping a project from scratch or discovering in-flight work also lives there (`project-plan discover`).

**Pre-mutation migration check** — every time you load an existing initiative or plan for mutation:
1. Parse its frontmatter.
2. If `schemaVersion` is absent or missing, this is a **legacy file**. STOP and prompt the user to invoke `atomic-skills:project-plan migrate <slug>` (which handles the standalone-vs-in-plan choice and calls `src/migrate.js:migrateLegacyInitiative`). Abort the current mutation with: "Mutation cancelled — file is legacy. Run `atomic-skills:project-plan migrate <slug>` first, then retry."

The pre-mutation check is the **only** way legacy files are touched, and migration itself is delegated to `project-plan`. This skill never silently writes legacy-shape YAML.

**Pre-mutation reconciliation gate** — every time you load an active initiative for a **mutating** command (`push`, `pop`, `park`, `emerge`, `promote`, `done`, `phase-done`, `phase-reopen`, `archive`, `switch`, `detect-scope`, `re-ratify`), run this check AFTER the migration check and BEFORE executing the command:

1. Parse `tasks[]` from the active initiative's frontmatter.
2. Collect tasks where `status` is `active` AND `lastUpdated` is older than 24 hours from now.
3. If the collected list is empty → skip, proceed to the command.
4. If the list is non-empty → present a reconciliation prompt using {{ASK_USER_QUESTION_TOOL}}:

   ```
   ⚠ Unreconciled tasks detected (active >24h):

     T-001 "Add scopeBoundary to schema" — active 3d
     T-002 "Session-End reconciliation"  — active 1d

   For each: still active? done? blocked?
   ```

   Present one structured question per stale task (max 4; if more than 4, batch the oldest 4 first). Options per task: `Still active`, `Done`, `Blocked`, `Skip`.

5. Apply user answers immediately:
   - **Done** → run the `done <task-id>` flow (including auto-transition detection).
   - **Blocked** → set `status: blocked`, ask for `blockedBy[]` (optional), bump `lastUpdated`.
   - **Still active** → bump `lastUpdated` to now (acknowledges the task, resets the 24h clock).
   - **Skip** → no change, proceed.
6. After reconciliation, proceed to the original command.

The gate is skipped for read-only commands (`--terminal`, `--list`, `--plan`, `--phase`, `--stack`, `--archived`, `--report`, `--browser`, `why`, `scope-creep`). It is also skipped when the user is already running `done` on one of the stale tasks (avoid double-prompting).

The 24-hour threshold is configurable via `.atomic-skills/status/config.json` key `reconciliationThresholdHours` (default: 24). Set to `0` to disable.

### `push <description>`

1. Identify active initiative (via branch match or explicit `--slug` arg).
2. Read `stack:` from frontmatter.
3. Append new frame: `{id: <max_id+1>, title: "<description>", type: <inferred>, openedAt: <now>}`.
4. Save.
5. Announce: "Frame <N> pushed: <description>. Current depth: <N>."
6. If depth > `max_stack_depth_warning` (from config.json), warn: "Stack is deep — is this still the same initiative?"

Inferred types from verb: "research" → research; "test" → validation; "discuss" → discussion; otherwise → task.

### `pop [--resolve|--park|--emerge]`

0. If `stack:` is empty, abort with message: "Stack empty — nothing to pop."
1. Identify top frame of the stack.
2. Destination:
   - `--resolve` (default): remove from stack, add note in Done if it was a task
   - `--park`: route through the `park` flow above — including the ratify gate before the entry is written to `parked[]`
   - `--emerge`: route through the `emerge` flow above — including the ratify gate before the entry is written to `emerged[]`
3. Remove frame from stack.
4. Announce: "Frame <N> popped to <destination>. Current frame: <new top>."
5. Update `lastUpdated` and save.

`pop --resolve` skips the ratify gate entirely — resolving a frame doesn't create a new backlog entry, so there's nothing to articulate.

### `park <description>`

1. Identify active initiative.
2. **Ratify gate**: print the `Proposed mutation:` block with the drafted `context` (solves/trigger/assumesStillValid). HALT until `ratify` / edited context / `cancel`. Park items live in `parked[]` indefinitely — without a ratified context, the entry decays into a title-only stub no one can interpret three months later. The ratify is what justifies parking instead of just discussing.
3. On ratify: append to `parked:`: `{title: "<description>", surfacedAt: <now>, fromFrame: <current-top-id>, context: { …ratified values…, ratifiedAt: now, ratifiedBy: human, lastReviewedAt: now }}`.
4. Save.

### `emerge <description>`

1. Identify active initiative.
2. **Ratify gate**: same shape as `park`. HALT until ratify / edited / cancel.
3. On ratify: append to `emerged:`: `{title: "<description>", surfacedAt: <now>, promoted: false, context: { …ratified values…, ratifiedAt: now, ratifiedBy: human, lastReviewedAt: now }}`.
4. Save.
5. Offer: "Create new initiative now for '<description>'? (run `atomic-skills:project-plan new <slug>`)" — if yes, hand off to the project-plan skill's `new` subcommand.

### `promote <parking-item-title-or-index>`

1. Locate item in `parked:`. Confirm it carries a `context` block (it must — schema requires it for every parked entry).
2. Generate next task ID (`T-<NNN+1>` based on the highest existing).
3. **Re-ratify check** (only if `context.lastReviewedAt` is older than `parkedZombieDays` in config — default 30): print the existing context, ask "Premises still valid? `ratify` to keep, paste edits to update, `cancel` to abort." Fresh items skip this prompt — their context was just ratified.
4. Add to `tasks:` (array): `{id: '<id>', title: <parking title>, status: pending, lastUpdated: <now>, provenance: { surfacedAt: <parked surfacedAt>, surfacedDuring: "promote(<current-init>)", surfacedBy: human }, context: { …carried from parked, lastReviewedAt: now …}}`. The carried context's `ratifiedAt` is preserved (proof the human articulated this once); `lastReviewedAt` advances if step 3 ran.
5. Remove item from `parked:`.
6. Announce new task ID.

### `done <task-id>`

1. Locate task in `tasks:` (array). Find the entry where `id === <task-id>`.
2. Change `status: done`, set `closedAt: <now>`, refresh `lastUpdated: <now>`.
3. Save the initiative file.
4. **Auto-transition detection**: count remaining tasks with `status` in `{pending, active, blocked}`. If zero:
   - When the initiative has a `parentPlan`: announce "Last task of `<parentPlan>/<phaseId>` closed. Run `phase-done` to verify exit gates and advance the plan?". The next session's SessionStart hook also surfaces a 🔔 phase-transition reminder via the active-initiative pending-task count.
   - When the initiative is standalone: announce "All tasks of `<slug>` closed. Run `archive <slug>` or open a new initiative?".
   - Do NOT automatically run `phase-done` or `archive` — the user opts in (intrusive-actions rule).
5. Announce the task closure.

### `phase-done`

Invoked when the active initiative is the phase initiative of an active plan AND all its tasks are closed. Iterates the phase's exit gate criteria, archives the phase initiative, advances `currentPhase` per the dependency graph, and seeds the next phase's initiative.

1. Load the active initiative. Verify it has `parentPlan` + `phaseId` set. Else abort.
2. Load the parent plan from `.atomic-skills/plans/<parentPlan>.md`. Locate the phase by `phaseId`. Read `phase.exitGate.criteria` AND `initiative.exitGates` (combine; phase-level criteria are authoritative for the gate).
3. For each criterion (status === `pending`) → apply the **Verifier execution patterns** below.
4. After iterating: report status summary. Continue to advance only when every criterion is `met` OR was explicitly `deferred` with a `deferredReason`.
5. If any criterion is still `pending` after iteration: ask "Some gates remain pending. Mark phase done anyway? (y/N)". On `n`, leave initiative in `active` state and stop. On `y`, document the override (set `deferredReason` on the remaining criteria) and proceed to step 6.
6. **Review gate** — run `atomic-skills:review-code` on the phase diff. This step is mandatory unless `--skip-review` is passed explicitly.
   - Compute the diff range: from the phase initiative's `started` timestamp (find the closest commit via `git log --before=<started> -1 --format=%H`) to HEAD.
   - Run `atomic-skills:review-code <range> --mode=local`. The convergence rule (plateau detection, `--max-iterations`) applies automatically.
   - Apply blocker/critical findings. If fixes are committed, the review range shifts — this is expected and handled by the convergence rule.
   - If `--skip-review` was passed: record `Codex review: SKIPPED at phase-done (user requested --skip-review)` in the self-review block (see § "Self-review against code-quality gates") and proceed.
7. **Advance the plan** — call `src/transition.js`:`proposeAdvance(plan, phaseId)` to decide what's next. The function returns one of three shapes:
   - `{ kind: 'plan-done', eligible: [] }` — no more eligible phases. Offer to mark the plan itself `status: done` and `archive` it.
   - `{ kind: 'single', next: '<id>', alternatives: [...] }` — propose "Phase `<id>` done. Advance `currentPhase` to `<next>`? (y/N)". List `alternatives` so the user can override before accepting.
   - `{ kind: 'parallel-choice', eligible: [...] }` — when the plan has `parallelismAllowed: true`, ask "Which of `<eligible...>` should be activated now? Select one or more (or `none`)".
   Before presenting any of the above, call `src/transition.js`:`unknownDeps(plan)`. If it returns non-empty, surface the typos to the user and abort the advance — the dependency graph is broken.
8. On the user's accept of an advance:
   - **Propagate completion to the initiative** (BEFORE archiving):
     a. Set all `tasks[].status = 'done'`, `tasks[].closedAt = <now>`, `tasks[].lastUpdated = <now>` for any task not already `done`.
     b. For each `exitGates[]` in the initiative with `status !== 'met'`: set `status: met`, `metAt: <now>`. If the matching plan criterion (by `id`) has an `evidence` block, copy it to the initiative exitGate.
     c. Set initiative `status: done`, `lastUpdated: <now>`, `nextAction: null`.
     d. Save the initiative file.
   - Update the parent plan's matching phase: `status: done`, `lastUpdated: <now>`. Set the plan's `currentPhase` to the picked next phase (or to the first of multiple in parallel mode).
   - Run `archive <slug>` on the just-closed initiative so its file moves to `initiatives/archive/`.
   - For each newly-active phase id, propose `atomic-skills:project-plan new <plan-slug>-<phase-id-lower>-<phase-title-kebab>` to materialize the next initiative. The `new` flow already seeds the initiative's first stack frame from `initiative.template.md`.
   - Save the plan + PROJECT-STATUS.md.
9. On user decline (or `plan-done` accept without `currentPhase` change):
   - **Propagate completion to the initiative** (same steps 8a-d above).
   - Set the parent plan's phase `status: done` and stop without seeding a successor.

### Verifier execution patterns (`verify_exit_gate` workflow)

Applies to **each** `ExitCriterion` with `status === 'pending'` (or any criterion the user asks to re-verify). Used by `phase-done`, by per-task `verifier:` fields, and by ad-hoc verification from the user.

The output of every successful (or attempted) verification is stamped into the criterion's optional `evidence` block. The shape is:

```yaml
evidence:
  verifierKind: shell | query | test | manual
  verifiedAt: <ISO8601>
  passed: true | false
  exitCode: <integer>      # shell only
  rowCount: <integer>      # query only
  outputSummary: "<≤500 chars excerpt or user note>"
```

`evidence` is REQUIRED to set `status: met` when a verifier is present. Without `evidence`, the criterion stays `pending` (manual override → `deferred` with `deferredReason`).

#### `kind: shell`

1. Present the criterion `id` + `description` + the full `command` to the user.
2. Ask: "Run this verifier? (y/N)" — intrusive-actions rule applies.
3. On `y`: execute with {{BASH_TOOL}}, capture exit code AND a tail of stdout (≤500 chars). Compare exit code with `expectExitCode` (default `0`).
4. Write `evidence`:
   - `verifierKind: shell`, `verifiedAt: <now>`
   - `exitCode: <observed>`, `passed: <bool>`
   - `outputSummary: <stdout tail>`
5. If `passed === true`: set `status: met`, `metAt: <now>`.
6. If `passed === false`: ask "Mark `deferred` with a reason, retry, or leave pending?".
   - On `deferred`: keep the `evidence` block (so the failed run is recorded), set `status: deferred`, capture `deferredReason`.
   - On retry: loop back to step 3.
   - On leave-pending: keep `evidence` (records the failed attempt) but leave `status: pending`.

#### `kind: manual`

1. Present the criterion `id` + `description` + the verifier's `description`.
2. Ask: "Confirm this criterion is met? (y/n/defer)".
3. Write `evidence`:
   - `verifierKind: manual`, `verifiedAt: <now>`
   - `passed: <true if y else false>`
   - `outputSummary: <user's note, or empty>`
4. On `y`: set `status: met`, `metAt: <now>`.
5. On `n`: ask "Mark `deferred` (with reason) or leave `pending`?". Apply.
6. On `defer`: capture `deferredReason`, set `status: deferred`.

#### `kind: query` (v0.1: stubbed execution)

The schema is declared; the skill does NOT auto-run SQL in v0.1 (no DB conn assumed).

1. Present the criterion `id` + `description` + `sql` + `expectRowCount` (if any).
2. Ask: "Run this query externally and report the row count, or skip?".
3. If user provides a row count:
   - Write `evidence`:
     - `verifierKind: query`, `verifiedAt: <now>`
     - `rowCount: <reported>`, `passed: <rowCount === expectRowCount>`
     - `outputSummary: <user's note>`
   - Set `status: met` / `deferred` based on `passed` and user confirmation.
4. If user skips: leave `status: pending`, no `evidence` written.

#### `kind: test` (v0.1: stubbed execution)

The schema is declared; the skill does NOT auto-run test runners in v0.1.

1. Present the criterion `id` + `description` + `runner` + `pattern`.
2. Ask: "Run the test pattern (e.g., `<runner> <pattern>`) externally and report pass/fail, or skip?".
3. If user provides a result:
   - Write `evidence`:
     - `verifierKind: test`, `verifiedAt: <now>`
     - `passed: <bool>`, `outputSummary: <user's note>`
   - Set `status: met` / `deferred` per user.
4. If user skips: leave `status: pending`, no `evidence` written.

#### No verifier present

Treat as `kind: manual` with an empty `description`. Ask the user for explicit ack before marking `met`.

#### Per-task verifiers (`tasks[].verifier`)

When closing a task (`done <task-id>`) whose entry has a non-empty `verifier:`, apply the same workflow before marking the task done. Store the result inline on the task — task-level evidence is NOT in the v0.1 Task schema, so for now record it as a one-line note in the task's `description` (`"verified <verifierKind> at <ISO>: passed=<bool>"`) and stamp `closedAt`. A future v0.2 may extend the Task schema with its own `evidence` block.

### `phase-reopen`

Reverse of `phase-done`. Used when a closed phase needs more work (regression, scope expansion).

1. Identify the target phase (by `phaseId` arg or by reading the parent plan's last-done phase).
2. Locate the initiative file. Check both `initiatives/<slug>.md` and `initiatives/archive/` for the file. Note whether it is archived (do NOT move yet).
3. Confirm with user: "Reopen phase `<id>`? This sets initiative status back to active, clears `metAt` on all criteria, and resets all tasks to pending."
4. On accept:
   - If the initiative file was in `initiatives/archive/`: move it back to `initiatives/<slug>.md`.
   - Set initiative `status: active`.
   - Set every `exitGate[].status` and `phases[<id>].exitGate.criteria[].status` to `pending`; clear `metAt`.
   - Set all `tasks[].status = 'pending'`; clear `tasks[].closedAt`; refresh `tasks[].lastUpdated = <now>`.
5. If the plan had advanced past this phase, leave `currentPhase` unchanged (user decides whether to re-route).
6. Save. Update PROJECT-STATUS.md.

### `detect-scope`

Wrap `scripts/detect-scope.js` to suggest a `scope.paths` value based on recent git activity.

1. Run `npm run detect-scope -- --json --branch=<active-branch> --limit=20` via {{BASH_TOOL}}.
2. Parse the JSON output. Present the top groupings to the user as a checklist.
3. On user accept: write the accepted globs into the active initiative's `scope.paths`. Save.
4. If the initiative already had `scope.paths`: merge (union) with the new suggestions; ask user before overwriting any existing entry.

### `archive [<slug>]`

Works on both plans and initiatives. If `<slug>` matches `.atomic-skills/plans/<slug>.md`, archive the plan **and propagate** to its child initiatives.

1. Identify target (arg or active initiative). Detect kind by file location.
2. **Plan archival**:
   - Set the plan's `status: archived`.
   - For every initiative with `parentPlan === <slug>` and `status` in {`active`, `paused`, `pending`}: set its `status: archived`, move file to `initiatives/archive/<YYYY-MM>-<slug>.md`.
   - Move the plan file to `plans/archive/<YYYY-MM>-<slug>.md`.
3. **Initiative archival**:
   - **Resolve open exit gates first** (applies to BOTH standalone and plan-anchored initiatives — standalone has no `phase-done`, so this is the only place its gates get closed). For each `exitGates[]` entry whose `status` is not already `met` or `deferred`: run its `verifier` per the **Verifier execution patterns** (or ask the user when `kind: manual`), then set `status: met` (`metAt: <now>`, plus `evidence` when a verifier ran) on pass, or `status: deferred` (`deferredReason`) when the user skips it. **Never set `done`** — that is a Task status; gate status is `pending`/`met`/`deferred` only (see the *Gate status invariant* above). If the user wants to archive without verifying, mark the remaining gates `deferred` with a reason — do not leave them `pending` and do not coerce them to `done`.
   - If the initiative has `parentPlan` and the matching plan phase has `status: done`, verify that the initiative `status` is `done` (not `active`/`pending`). If not, apply the propagation steps from `phase-done` step 7a-d first (set all tasks `done`, exitGates `met`, initiative `status: done`), then continue.
   - Set the initiative's `status: archived`.
   - Move file to `initiatives/archive/<YYYY-MM>-<slug>.md`.
4. Update PROJECT-STATUS.md: remove archived rows from active tables; append to "Recently Archived" (keep last 10).
5. Announce: "Archived `<slug>` (+<N> child initiatives if plan)".

### `switch <slug>`

Works at 2 levels: switching plans, OR switching initiatives within the active plan / among standalone.

1. Detect kind: does `.atomic-skills/plans/<slug>.md` exist? OR `.atomic-skills/initiatives/<slug>.md`?
2. **Plan switch**:
   - Find target plan; abort if `status` not in {`active`, `paused`}.
   - Set any other active plan to `status: paused`.
   - Set target plan to `status: active`.
   - Update PROJECT-STATUS.md.
3. **Initiative switch**:
   - Find target initiative; abort if not active/paused.
   - If target has `parentPlan` ≠ currently-active plan's slug: warn and offer to also switch the plan.
   - Set any other active initiative to `status: paused`.
   - Set target initiative to `status: active`.
   - Update PROJECT-STATUS.md.
4. Announce.

## Emergent work — proposal / ratify / commit pattern

Work that surfaces mid-execution (new task, new phase, scope split) is the most common reason a 10-phase × 10-task plan drifts into 14-phase × 18-task chaos. This skill handles it through a three-stage **agent-proposes / user-ratifies / agent-commits** pattern. The middle stage — `ratify` — is the hard gate that prevents cryptic title-only stubs from ever entering the backlog. Every emergent item carries a `context` block (`solves`, `trigger`, `assumesStillValid`) ratified by the human BEFORE the file is touched.

The cost of skipping ratify is exactly the failure mode this section exists to prevent: months later, looking at `parked[]` or `emerged[]`, neither the human nor the agent can tell what the entry was about, why it was added, or whether it still matters. The ratify step trades 30 seconds at surfacing time for a backlog that survives the read at any later point.

### When the agent enters proposal mode

Any time the user says (in conversation) something like:

> "while doing this, I realized we also need to <X>"
> "this depends on something we haven't planned"
> "we should add a task to fix <Y> before continuing"
> "<Z> is bigger than we thought, needs its own phase"

The agent does NOT add anything directly. It classifies the request through the **emergence ladder** below, picks the right magnitude, drafts a `context` block, prints a `Proposed mutation:` block, and waits for the user to:

- type **`ratify`** (apply the drafted context verbatim), OR
- paste an **edited Drafted-context block** (the agent applies the edited version), OR
- type **`cancel`** (abort, no file touched).

A generic "ok" / "do it" / "yes" reply MUST be treated as the agent asking the user to be more specific — never as ratify. The point of the ratify gate is that the human reads and approves the WHY before it lands on disk. A reflexive "yes" would defeat that.

### Emergence ladder (which command for which magnitude)

| Magnitude | Surface | Command |
|---|---|---|
| **1.** Note for later, no decision | "we should think about Z eventually" | `park "<title>"` (existing) |
| **2.** Real follow-up worth promoting | "Z deserves its own initiative someday" | `emerge "<title>"` (existing) |
| **3.** Promote a parked/emerged item to a task | "let's actually do that parked thing" | `promote <title-or-idx>` (existing) |
| **4.** New task in CURRENT phase | "T-002 needs T-008 to run first" | `atomic-skills:project-plan new-task "<title>" [--blocked-by T-002] [--tags ...]` |
| **5.** New task in DIFFERENT phase | "F2 needs an extra task before it can finish" | `atomic-skills:project-plan new-task --target F2 "<title>"` |
| **6.** New phase inserted into the plan | "Need a validation phase F0.5 between F0 and F1" | `atomic-skills:project-plan new-phase <id> "<title>" --after <other-id> [--parallel-with ...]` |
| **7.** Phase grew too big — split | "F2 is now 18 tasks, split into F2a + F2b" | `atomic-skills:project-plan split-phase <id>` |
| **8.** Strategic shift — half the plan is wrong | "rethink everything, this is a different project" | `atomic-skills:project-plan adopt <new-source.md>` with `supersedes` link |

The ladder doubles in cost per step. The agent picks the lowest rung that fits — promoting up only when explicitly justified.

### Proposed-mutation print format

The agent's proposal block must follow this exact shape. The `Drafted context` block is mandatory for every magnitude (1-7); the user must `ratify` it before the agent applies anything.

```
Proposed mutation: <magnitude name, e.g. "new task in different phase">

  atomic-skills:project-plan new-task --target F2 \
    --title "Add canary smoke test for cross-landlord case" \
    --blocked-by T-002 \
    --tags critical

  Drafted context (✋ ratify or edit before applying):
    solves:  <one sentence: the concrete problem this addresses;
              if removed tomorrow, what would degrade?>
    trigger: <one sentence: the specific observation that surfaced this;
              the incident, the code-review note, the test that failed>
    assumesStillValid:
      - <premise 1 — if it stops being true, item becomes moot>
      - <premise 2>

  Provenance: surfaced during F0/T-002 (this conversation), surfacedBy: ai
  Reasoning:  <one line: why this magnitude, not the rung below or above>
  Cost:       <fast / medium / heavy — what changes on disk>

To apply: reply "ratify" (accept context as drafted), OR paste a corrected
Drafted-context block, OR "cancel".
```

Both `Reasoning` and `Drafted context` are mandatory. The first defends against magnitude inflation; the second defends against title-only stubs. A proposal block that omits either is malformed — the agent must re-print it correctly, not proceed.

#### How to draft a useful context (so the user doesn't reject the ratify)

- **`solves`** answers "what concrete pain does this address?". `Audit may be incomplete` beats `Investigate Patrimony Clone`. A title doubled into a verb is a tell that the agent didn't actually understand the WHY — re-read the user's message before drafting.
- **`trigger`** is the literal observation that surfaced this. `Reviewing F1 design docs we noticed it references the same auth path F0 audits` beats `seemed relevant`. If the trigger is "the agent thought of it", say that — `surfacedBy: ai` already records the source.
- **`assumesStillValid`** lists 1-3 premises that, if invalidated, make the item moot. They're the antidote to backlog rot: a `lastReviewedAt` re-ratify check asks "are these still true?" and an item with zero premises offers no answer.

### `emerge --target <phaseId> "<title>"`

Extension of the existing `emerge` command. Without `--target`, behaves as the base `emerge` above. With `--target`, adds to the target phase's initiative `emerged[]` instead — useful when the surfacing context is task-A-in-F0 but the emerging item belongs to F2.

Same ratify gate as base `emerge` — the `--target` flag only changes WHERE the entry lands, not whether the user must ratify the `context` block.

### `why <id>` (view command)

The canonical answer to "what is this item and does it still make sense?". Locates `<id>` across tasks / parked / emerged / phases (in that priority order, returning the first match — or asking the user to disambiguate if a `parked`/`emerged` title collides with a task id).

Output shape:

```
T-002 · pending · age 2d · lastReviewedAt: 2d ago

TITLE:  Add canary smoke test for cross-landlord case

SOLVES: Without a canary, every matcher fix runs against a moving target —
        regressions in the data layer go undetected for weeks.

TRIGGER (when surfaced):
        Matcher fix candidate passed yesterday and failed today on the same
        input; realized the dataset itself is drifting.

ASSUMES STILL VALID:
  ✓ Canary dataset is the right verification mechanism
  ✓ A single canary covers the cross-landlord case

PROVENANCE:
  surfacedAt:     2026-05-19T16:00:00Z
  surfacedDuring: v3-redesign/F0/T-002
  surfacedBy:     ai

RATIFIED:
  ratifiedAt:     2026-05-19T16:10:00Z (by human)
  lastReviewedAt: 2026-05-19T16:10:00Z

NEXT: blocked on T-002 — run `done T-002` to unblock.
```

The render is read-only. It does not mutate. When `lastReviewedAt` exceeds `staleContextDays` (default 14, configurable), prepend a `⚠ Not re-reviewed in <N> days — premises may have shifted. Run \`re-ratify <id>\`?` banner.

Items shipped in the original materialization (no provenance, no context) get a minimal render — title + status + age + "this is an original-materialization item; narrative lives in the plan body".

### `re-ratify <id>` (mutation command)

Re-articulates the `context` of an existing item. Used when `lastReviewedAt` is stale, when the user notices the original `solves` no longer applies, or before promoting a long-parked item.

Steps:
1. Locate `<id>` (same resolver as `why`). Print the current context.
2. Print a `Proposed re-ratify:` block with the current values pre-filled — the user can `ratify` (just bump `lastReviewedAt`), paste edits (full re-articulation), or `cancel`.
3. On ratify: update `context.lastReviewedAt = now`. If edits were pasted: also update `solves` / `trigger` / `assumesStillValid` per the edit. `ratifiedAt` advances to now; `ratifiedBy: human`.
4. Save. Print a one-line confirmation.

The original `ratifiedAt` is replaced — that's intentional. The audit trail of "this item used to mean X, now means Y" lives in git history of the .md file, not in a separate field, to avoid context bloat.

### `re-bootstrap` (moved to project-plan)

The `re-bootstrap <slug>` batch re-articulation command now lives in
`atomic-skills:project-plan`. Use `/atomic-skills:project-plan re-bootstrap <slug>`.

### `scope-creep` (view command)

On-demand drift report. Renders the output of `src/scope-drift.js`:`computeDrift(plan, initiatives)` formatted for terminal.

Output sections:
- **Header**: plan slug + total phases + plan-wide scope expansion %
- **Phases that grew** (table): phase id, initiative slug, original/added/growth%, closed?
- **Phases added mid-execution** (list): phase id + provenance.surfacedAt + surfacedDuring + `context.solves` (truncated to one line)
- **Parked zombies** (table): initiative · title · `solves` · age in days · lastReviewedAt age. Default age threshold: 30 days. Configurable via `.atomic-skills/status/config.json` `parkedZombieDays`. Items where `lastReviewedAt` > `staleContextDays` (default 14) are marked with a `⌛` glyph.
- **Stale-context items** (list): every task/parked/emerged with `lastReviewedAt` older than `staleContextDays`, sorted by age. Recommends `re-ratify <id>` per row.
- **Recommendation footer**: e.g. "F0 grew 67% — consider `split-phase F0`. 3 parked zombies older than 30d — `promote` or `park <idx> --delete`. 5 items with stale context — `re-ratify` each."

The command is read-only. It surfaces drift; it does not mutate.

### Default view — DRIFT banner

Whenever the default view renders an active initiative, also call `computeDrift(plan, allInitiatives)` and `renderBanner(report)` from `src/scope-drift.js`. If the banner is non-null, prepend it to the default-view output (above the header line) with a leading `⚠ ` glyph and color it yellow (status-blocked).

Thresholds (default, configurable per-repo via `.atomic-skills/status/config.json`):

- `phaseGrowthPctWarn`: 40
- `scopeExpansionPctWarn`: 25
- `parkedZombieDays`: 30

The banner is informational — it does not block any command. The user can ignore it. But the next `phase-done` flow (see Codex review tracking integration above) re-checks drift and surfaces a stronger prompt before archive.

### Why provenance + context live on the item itself (not a separate log)

Every emergent item carries two co-located blocks in its frontmatter:

- `provenance: { surfacedAt, surfacedDuring, surfacedBy, originalPhaseId? }` — the WHEN and WHO of the addition. Schema: `common.schema.json#/$defs/provenance`.
- `context: { solves, trigger, assumesStillValid?, ratifiedAt, ratifiedBy, lastReviewedAt }` — the WHY, articulated by the human at `ratify` time. Schema: `common.schema.json#/$defs/context`.

The schema makes them inseparable: any task/phase that carries `provenance` MUST also carry `context` (`if/then` constraint in initiative.schema.json and plan.schema.json). And every `parked[]` and `emerged[]` entry — emergent by definition — requires `context` unconditionally. Items shipped in the original materialization have neither field; their narrative lives in the plan or initiative body and the listing rendering falls back to `—`.

The choice (vs a separate `.atomic-skills/changelog.jsonl` or a `.atomic-skills/why/<id>.md` sidecar) was deliberate:

1. **The WHY survives initiative archive.** When the initiative moves to `archive/`, the context block moves with it. A separate log would either grow forever or rotate, breaking grep-style audits.
2. **`grep -A 12 "solves:" .atomic-skills/`** answers "show me what every emergent item is supposed to solve" in one line. No tooling needed.
3. **Dual-write would diverge.** Editing the task without updating the log is the default failure mode of any sidecar; making the WHY part of the same YAML eliminates the synchronization problem.
4. **The ratify gate has somewhere to write to.** Forcing the human to articulate `solves` + `trigger` only makes sense if those land on the item itself — a separate ratify log would feel ceremonial and get skipped.

Cost: no chronological cross-cuts the way a single log would give. The `scope-creep` view is the workaround — it aggregates context + provenance across all initiatives into chronologically-ordered tables on demand, including the stale-context section that surfaces items whose `lastReviewedAt` aged past `staleContextDays`.

When the optional `pre-write.sh` PreToolUse hook is installed (enforcement level (b) or (c)), it enforces both rules mechanically: any `Edit` / `Write` / `MultiEdit` that adds a `tasks[]` or `phases[]` entry without `provenance:` — OR with `provenance:` but missing any of `context.solves` / `context.trigger` / `context.ratifiedAt` — is logged in dry-run mode or denied in strict mode (`emergent_strict_mode: true`). The hook exempts file creation (original materialization), updates to existing entries, deletions, archive subdirs, and `*.rendered.md` artifacts. See `.atomic-skills/status/hooks/README.md` for promotion + bypass instructions.

## aiDeck integration

When [aiDeck](https://github.com/henryavila/aideck) is running alongside this skill, it observes the canonical files in `.atomic-skills/` via a chokidar watcher and projects them onto the dashboard at the URL written to `~/.aideck/env` (default port 7777, auto-fallback to 7778–7787 if busy; use `aideck up` to ensure it is running and discover the actual URL). The skill always writes the files directly — aiDeck does NOT serve as an intermediary for mutations. Its MCP mutation tools (`aideck_mark_task_done`, etc.) record append-only intents and are intended for cross-tool consumers like other AI IDEs; the project-status skill itself does not call them, because the file-write path is faster and the intent log would just shadow the same change.

The dashboard surface (v0.1) is read-only: it renders plans, initiatives, exit gates, annotations, and highlights, and does not mutate state from the browser. Human input flows through `inbox/*.jsonl` JSONL files that this skill drains on demand (a future task). In short: files are canonical, the dashboard is a projection, and there is no "MCP-or-file" choice for this skill.

## Disambiguation flow

Triggers when: current branch does not match any active initiative, OR multiple match, OR `disambiguate` is called explicitly.

Present Structured Options:

```
Detected context:
- Branch: <current-branch>
- Active plan: <plan-slug> (currentPhase: <id>)   [or "none"]
- No matching active initiative in .atomic-skills/PROJECT-STATUS.md

Active initiatives:
  1. <slug-1> (branch <branch-1>, last updated <timestamp>, [under <plan>] or [standalone])
  2. <slug-2> (branch <branch-2>, <status>, ...)

Is this work:
  (a) Continuation of an existing initiative (pick: 1 or 2)
  (b) Lateral expansion of an existing initiative (pick: 1 or 2; new frame added to its stack)
  (c) New phase initiative of the active plan (skill will pre-fill parentPlan/phaseId)
  (d) New standalone initiative (no parentPlan)
  (e) Ad-hoc work (no initiative anchor)
```

By choice:
- (a): load selected file; ask where in the stack to resume
- (b): load file; `push` new frame for lateral expansion
- (c): invoke `atomic-skills:project-plan new` with `parentPlan` = active plan slug; ask for `phaseId` (suggest plan's `currentPhase`)
- (d): invoke `atomic-skills:project-plan new` with no plan membership
- (e): append row to "Ad-Hoc Sessions Log" in PROJECT-STATUS.md with timestamp + short description

## `--browser [<slug>]`

Opens the aiDeck dashboard in the browser, optionally deep-linking to a specific plan or initiative. This is the same mechanism used by the default view — the `--browser` flag is kept as an explicit alias for cases where the user invoked `--terminal` or a mutation command and now wants to jump to the dashboard.

1. Run the ensure-aideck script from the default view (step 1) to get `AIDECK_URL`.
2. If `AIDECK_URL` is non-empty:
   - If `<slug>` is provided: determine if it matches a plan or initiative, and open `<AIDECK_URL>/plans/<slug>` or `<AIDECK_URL>/initiatives/<slug>`.
   - If no `<slug>`: open the root URL (HomePage).
   - Open via `open` (macOS) or `xdg-open` (Linux); fall back to printing the URL.
3. If `AIDECK_URL` is empty: print error and suggest `atomic-skills install`.

## `--report`

Emit MD to stdout, pasteable format for standups/PRs/updates:

```markdown
# Project Status — YYYY-MM-DD

## Active Plans

### <plan-slug> v<version> (started YYYY-MM-DD)
**Current phase:** <id> — <title>
**Progress:** <N/M phases done>
**Open exit gates:** <count> across <phase ids>

## Active Initiatives

### <slug> (started YYYY-MM-DD)  [under <plan>/<phaseId> | standalone]
**Next:** <nextAction>
**Progress:** <N tasks done>; <M in progress>; <B blocked> (stack depth <D>)
**Open exit gates:** <count> with status pending
**Parked:** <list>
**Emerged:** <list>

### <slug-2> ...
```

No browser launch; pure stdout.

## Codex review tracking

`review-code --mode=codex` (or `--mode=both`) is the cross-model adversarial review gate (see `skills/en/core/review-code.md` — the codex sub-flow inside `review-code`). This skill tracks when it was last run against the current branch so the user knows whether the in-flight work is reviewed or accumulating un-reviewed surface.

### State file

`.atomic-skills/status/last-review.json` — single source of truth, updated by the user (or by this skill's `review-due` command on completion):

```json
{
  "schemaVersion": "0.1",
  "branch": "v2-rebuild",
  "lastReviewedCommit": "a3f1c2d",
  "lastReviewedAt": "2026-05-20T13:38:06Z",
  "reviewFile": ".atomic-skills/reviews/2026-05-20T13-38-06Z-phase-e.md",
  "verdict": "needs_changes",
  "counts": { "blocker": 0, "critical": 1, "major": 3, "minor": 0, "nit": 0 }
}
```

If the file is absent, treat as "never reviewed".

### Default view — CODEX REVIEW line

Run with {{BASH_TOOL}}:

```bash
last_review_commit=$(jq -r '.lastReviewedCommit // empty' .atomic-skills/status/last-review.json 2>/dev/null)
head_commit=$(git rev-parse HEAD)
branch=$(git rev-parse --abbrev-ref HEAD)
if [ -z "$last_review_commit" ]; then
  echo "CODEX REVIEW: never run on this repo"
elif [ "$last_review_commit" = "$head_commit" ]; then
  echo "CODEX REVIEW: up to date (HEAD reviewed at $(jq -r '.lastReviewedAt' .atomic-skills/status/last-review.json))"
else
  commits_behind=$(git rev-list --count "$last_review_commit..HEAD")
  lines_diff=$(git diff --stat "$last_review_commit..HEAD" | tail -1 | grep -oE '[0-9]+ insertions' | grep -oE '[0-9]+' || echo 0)
  echo "CODEX REVIEW: $commits_behind commit(s) behind · $lines_diff lines un-reviewed"
fi
```

Threshold for the visual cue (color the line yellow → "review recommended", red → "review overdue"):

- **green / up-to-date**: HEAD = lastReviewedCommit
- **yellow / recommended**: 1–3 commits OR 1–100 lines un-reviewed
- **red / overdue**: ≥4 commits OR ≥100 lines un-reviewed OR ≥7 days since lastReviewedAt OR a `phase-done` has run since lastReviewedAt

If yellow or red, append to the same line: `→ run \`atomic-skills:project-status review-due\``

### `review-due`

On-demand command. Invokes `atomic-skills:review-code` with args = `<lastReviewedCommit>..HEAD --mode=codex` (or whole branch if last-review.json is absent), then updates `last-review.json` on completion.

Steps:

1. Read `.atomic-skills/status/last-review.json`. If absent, set `<base>` to `main` (or whatever this repo's main branch is — auto-detect via `git symbolic-ref refs/remotes/origin/HEAD` falling back to `main`/`master`). Else set `<base>` to `lastReviewedCommit`.
2. Compute `<range> = <base>..HEAD`. If `git diff --stat <range>` is empty, announce "No changes to review" and exit.
3. Announce to user:

   > Run cross-model adversarial review on `<range>` (`<N>` commits, `<L>` lines)? Cost: ~$0.50–$1.50, ~5–10 minutes. (y/N)

4. On `y`: invoke `atomic-skills:review-code` with args = `<range> --mode=codex` (skips the Step 0 picker and runs only the codex sub-flow). The skill produces a review file in `.atomic-skills/reviews/`.
5. On completion (review skill returned a verdict): update `last-review.json`:
   ```json
   {
     "schemaVersion": "0.1",
     "branch": "<current branch>",
     "lastReviewedCommit": "<HEAD sha at start of review>",
     "lastReviewedAt": "<ISO timestamp>",
     "reviewFile": ".atomic-skills/reviews/<filename>.md",
     "verdict": "<from review frontmatter>",
     "counts": <from review frontmatter>
   }
   ```
6. Apply fixes for blocker/critical (`review-code` codex sub-flow already does this triage). After fixes are committed, the next `review-due` invocation will see a new HEAD and the cycle repeats.

### `phase-done` integration

The existing `phase-done` flow (Mutation modes section above) gains a new step BETWEEN "all gates met" and "archive":

> Before archiving the phase initiative, check `.atomic-skills/status/last-review.json`. If `lastReviewedCommit` ≠ HEAD, announce to user:
>
> > Phase `<id>` is closing with `<N>` commits / `<L>` lines un-reviewed since last codex review. Run cross-model review against `<lastReviewedCommit>..HEAD` before archiving? (y/N)
>
> On `y`: invoke `atomic-skills:project-status review-due` (which delegates to `atomic-skills:review-code --mode=codex`). Apply blocker/critical fixes. After completion, proceed to archive.
> On `n`: archive proceeds, but record `Codex review: SKIPPED at phase-done` in the archived initiative's `## Self-review against code-quality gates` block (alongside the existing G1-G6 entries).

This makes the codex review part of the natural phase-close ceremony rather than a separate ritual the user has to remember.

## Code-quality gates

This skill is bound by the gates in `docs/kb/code-quality-gates.md`. The state files this skill writes must comply with:

- **G1 read-before-claim** — when materializing a Task description that references existing code, paste the relevant source lines into the task's `description` field. Inferring "T-005 fixes the matcher join" without reading the matcher is forbidden.
- **G2 soft-language ban** — `nextAction`, task `description`, and exit-criterion `description` fields MUST NOT contain `should`, `probably`, `may`, `typically`, `I think`. Convert each occurrence to a verified statement or `unverified: <why>` marker.
- **G6 reference-or-strike** — every exit-criterion claim ("the matcher round-trip test passes") carries a verifier or an `unverified` marker. The `verifier:` field is the structured form; for criteria without a verifier, the description text MUST start with `unverified: <why>`.

## Self-review against gates

When closing a phase via `phase-done`, before archiving the initiative, append a `## Self-review against code-quality gates` block to the initiative file body:

```markdown
## Self-review against code-quality gates

- **G1 read-before-claim**: N tasks closed, each linked to source lines in its `outputs[]` field. / N/A — phase was pure planning (no code).
- **G2 soft-language**: scanned `nextAction` + task descriptions + criterion descriptions for the ban list; 0 violations (or list with rewrites).
- **G6 reference-or-strike**: K exit criteria, J met with `evidence:` populated, L deferred with `deferredReason:`, M unverified-and-flagged.
- **Codex review**: ran via `atomic-skills:project-status review-due` at HEAD = `<sha>`, verdict `<v>`, counts `<…>`, file `.atomic-skills/reviews/<…>.md`. / SKIPPED at phase-done per user (`<reason or "no reason given">`).
```

The block stays with the archived initiative so future spelunking can audit whether the gates were applied AND whether the codex review ran. Silent skipping is forbidden — the phase does not close without the checkpoint.

## Red Flags

If any of these thoughts appeared: STOP and validate.

- "I'll quickly edit this file without opening the initiative"
- "The current initiative probably matches, I don't need to check the branch"
- "Stack depth 7 is fine, it's still the same initiative"
- "This task is small, it doesn't need a task ID"
- "I'll pop the frame without deciding the destination; I'll sort it out later"
- "The Stop hook dry-run is showing too many false positives, I'll disable it without investigating"
- "The initiative is legacy snake_case but the change is small — I'll edit without migrating"
- "Phase has 3 tasks left but the exit gate is met, I'll just mark phase done"
- "The active plan's currentPhase doesn't match the branch I'm on — probably fine"

## Rationalization

| Temptation | Reality |
|------------|---------|
| "Setup already ran before, no need to check again" | Re-checking is cheap (5s); silent drift is expensive |
| "CLAUDE.md already has something similar, no need for HARD-GATE" | Hard-gate is explicit and marked — it coexists without conflict |
| "Manual YAML parsing is fine, I don't need a parser library" | Manual parsing breaks on edge cases (nested quotes, multi-line, arrays); use the `yaml` npm package for robustness |
| "I don't know if this change is lateral or a new initiative, I'll guess" | Use the disambiguation flow; 5 questions resolve it |
| "A stack with 8 frames means I'm overthinking" | Maybe — consider archive or split into a new initiative |
| "I can skip the aiDeck launch, the terminal view is enough" | The browser view is the default because aiDeck shows richer context (Mermaid graphs, exit gate status, real-time SSE). Use `--terminal` when you specifically need CLI-only output. |
| "Legacy initiative is small; I'll write to it directly in snake_case" | Pre-mutation check exists for this exact reason. Writing legacy shape silently corrupts the state. Always migrate first. |
| "Exit gate is `manual` so just mark all `met` and move on" | The user must ack manually — that's the whole point of `manual` kind. Bypassing it defeats the gate's purpose. |
| "Phase advance doesn't need exit gates verified" | It does. `phase-done` exists to make this explicit; never set a phase to `done` without iterating the criteria. |

