# project — view modes (lazy detail)

Loaded by the `project` router for: `status`, `status --browser`, `status --terminal`, `status --list`, `status --plan`, `status --phase`, `status --stack`, `status --archived`, `--report`, and the disambiguation flow.

---

## ⚠️ aiDeck contract — single source of truth (edit ONE place)

The aiDeck dashboard is the only external surface this skill talks to, and aiDeck is **under a full rewrite** (2026-05-31). To make the eventual re-connection touch exactly one block, every aiDeck-coupling parameter is declared ONCE here. Nothing else in this file (or in the router or the other lazy files) hardcodes the domain string or the endpoint shape.

```
# === AIDECK CONTRACT (cross-repo; aiDeck v2 Model-B consumer) ===
# The skill plugs into aiDeck as a v2 CONSUMER provisioned PER-PROJECT: the
# consumer id + title ARE the consuming repo (id = projectId, title = humanized
# name), so running the skill in repo `foo` yields ~/.aideck/consumers/foo/
# titled "Foo" — NOT a fixed atomic-skills/Project Status (that hardcoded
# identity was a bug). aiDeck keys each consumer by its manifest.id, so the
# consumer id == the projectId. The skill provisions it lazily from the shipped
# template via src/provision-consumer.js. aiDeck reads the repo's nested
# .atomic-skills/ tree IN PLACE via the consumer's root:'project' dataSources —
# no copy. State is read per-dataSource.
#
# AIDECK_CONSUMER is therefore DYNAMIC and equals $pid (the normalized repo
# basename, the same value aiDeck derives for /api/projects/register). The
# ensure-aideck script below computes $pid, provisions the consumer, then sets
# AIDECK_CONSUMER="$pid".
AIDECK_BIN="${AIDECK_BIN:-$HOME/.atomic-skills/bin/aideck.mjs}"
DASHBOARD_DIR="$HOME/.atomic-skills/dashboard"
# Data path:  $AIDECK_URL/api/consumers/$AIDECK_CONSUMER/projects/$pid/data/<ds>
#             ($AIDECK_CONSUMER == $pid; <ds> = plans | initiatives | discover | inbox)
# Dashboard:  $AIDECK_URL/$AIDECK_CONSUMER?project=$pid
# === END AIDECK CONTRACT ===
```

**Two responsibilities, kept separate:**

- **(a) Produce the data** — read/parse `.atomic-skills/` files, compute the compact summary, render terminal tables. STABLE; never changes with the aiDeck rewrite.
- **(b) Deliver to aiDeck** — the ensure-aideck script, the `/api/projects/register` call, the data-load cross-check, the best-effort normalize, and the browser open at the consumer page. PARAMETERIZED via the AIDECK CONTRACT block; this is the only part an aiDeck change touches. The produce-the-data half is untouched.

---

## Default (`status`, no extra flag, structure exists)

> **Note on no-args:** plain `/atomic-skills:project` (no subcommand) does NOT
> open the browser — the router prints a compact 5-line summary instead.
> The browser/dashboard view below is the behavior of `status --browser`
> (and of `status` with no flag, kept as the canonical visual surface).

The default view opens the **aiDeck dashboard** in the browser. aiDeck is the canonical visual surface for `.atomic-skills/` state — it renders plans, initiatives, tasks, exit gates, annotations, and highlights in real-time via a chokidar watcher + SSE push.

> **Open it directly — do NOT ask "open in browser?" first.** Invoking `status` (or `--browser`) IS an explicit request to open the dashboard; opening it is executing the command, not an unsolicited side effect. A generic "confirm before launching a browser" guideline does NOT apply here — gating this behind a confirmation defeats the command's whole purpose. (No-args `/atomic-skills:project` is the deliberately-non-opening variant for anyone who wants the cheap summary.)

Steps:

0. **Sync derived dashboard state (idempotent).** Before opening the dashboard, refresh the precomputed fields aiDeck reads (it has no compute engine): rollups + flat gate-evidence, then the focus markers + plan↔phase status hygiene. Run with {{BASH_TOOL}} from the repo root: `node scripts/compute-rollups.js && node scripts/reconcile-focus.js`. This keeps the Home ("Foco") accurate — current phase, active-plan timeline — and auto-corrects any `active` phase left under a `paused` plan. Both are no-ops when already in sync.

   **Then surface missing summaries (the skill always generates them).** Run the two zero-token detectors: `node scripts/find-missing-summaries.js && node scripts/find-missing-task-summaries.js`. Unlike the syncers these can't auto-fill (the text is semantic) — a non-zero exit means the Home panels would render bare titles. When either reports gaps **for the active plan's current phase** (the rows the Foco page actually shows), author each summary in the install-configured language and validate via {{ASK_USER_QUESTION_TOOL}} (`Aprovar todos` / `Ajustar alguns`) before opening — see skills/core/project.md → "Phase summaries" / "Task summaries". Long-tail gaps on paused/done plans are non-blocking — note them and move on.

1. **Ensure aiDeck is running.** Run this script with {{BASH_TOOL}} — it is self-contained (no imports) and works from any repo because it uses the binaries installed to `~/.atomic-skills/` by `atomic-skills install`. The `AIDECK_STATE_DOMAIN` / `AIDECK_BIN` / `DASHBOARD_DIR` values come from the AIDECK CONTRACT block above:

   ```bash
   # projectId = normalized repo basename. The consumer is provisioned PER-PROJECT
   # (id + title = THIS repo), so the consumer id IS the projectId (AIDECK CONTRACT).
   pid=$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')

   # Provision (idempotent) ~/.aideck/consumers/$pid/ with id=$pid + a humanized
   # title, from the shipped template. Resolve the provisioner the same way as
   # normalize.js (PWD → global npm → installed runtime). Safe no-op if unresolved.
   PROV=""
   for c in "$PWD/src/provision-consumer.js" \
            "$(npm root -g 2>/dev/null)/@henryavila/atomic-skills/src/provision-consumer.js" \
            "$HOME/.atomic-skills/src/provision-consumer.js"; do
     [ -f "$c" ] && PROV="$c" && break
   done
   [ -n "$PROV" ] && node "$PROV" "$pid" >/dev/null 2>&1

   AIDECK_CONSUMER="$pid"                  # ← consumer id == projectId (AIDECK CONTRACT)
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

   # 3. Cross-check THIS project's data loads before opening the browser.
   #    Model-B reads are per-dataSource and do NOT schema-validate, so a load
   #    failure here means an io/parse error (not a strict-schema reject). Empty
   #    STATE_ERROR = data loaded fine.
   STATE_ERROR=""
   if [ -n "$AIDECK_URL" ]; then
     # $pid + $AIDECK_CONSUMER already set above (consumer id == projectId).
     STATE_ERROR=$(curl -s "$AIDECK_URL/api/consumers/$AIDECK_CONSUMER/projects/$pid/data/plans" 2>/dev/null \
       | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);if(j&&j.error){process.stdout.write(j.error.message||"data load error")}}catch(_){}})' 2>/dev/null)
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

2. **Repair on `STATE_ERROR`.** A non-empty `STATE_ERROR=...` line means a dataSource failed to load — under Model-B aiDeck reads are per-dataSource and do **not** strict-validate, so this is an io/YAML-parse error (not a schema reject). Run the normalizer as a best-effort hygiene pass (it also keeps the data clean for `aideck validate` against the consumer `schema.json`), then continue:

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
   - Build the consumer URL: `DASH="$AIDECK_URL/$AIDECK_CONSUMER?project=$pid"` (the Model-B consumer page, project pre-selected). Open it with the **WSL-aware opener** below — `open_url "$DASH"` — then print `Dashboard: <DASH>`.

   > **NEVER call bare `xdg-open` — it HANGS on WSL2** (no native browser registered, the process blocks indefinitely and stalls the skill). Always use this helper, which prefers `wslview`, falls back to the Windows `start` shim, and only uses `xdg-open` on native Linux — detached (`setsid … &`) so it can never block the session:
   > ```bash
   > open_url() {
   >   url="$1"
   >   if command -v wslview >/dev/null 2>&1; then wslview "$url" >/dev/null 2>&1 && return 0; fi
   >   if [ "$(uname)" = "Darwin" ] && command -v open >/dev/null 2>&1; then open "$url" && return 0; fi
   >   if grep -qi microsoft /proc/version 2>/dev/null; then cmd.exe /c start "" "$url" >/dev/null 2>&1 && return 0; fi
   >   if command -v xdg-open >/dev/null 2>&1; then setsid xdg-open "$url" >/dev/null 2>&1 & return 0; fi
   >   echo "Open manually: $url"; return 1
   > }
   > ```
   - On any failure, print the URL for the user (the helper already does this on its last branch).

4. If `AIDECK_URL` is empty (binary not found, spawn failure):
   - Fall back to the **terminal view** (`--terminal` behavior below)
   - Print: `aiDeck not available — showing terminal view. Run \`atomic-skills install\` to set up the dashboard.`

5. After opening the browser, also print a **compact terminal summary** (3-5 lines) so the AI has context without needing to fetch from the API:
   - Active plan/phase (if any)
   - Active initiative slug + task progress (e.g. `3/7 done, 1 blocked`)
   - Next action
   - CODEX REVIEW line (see `{{ASSETS_PATH}}/project-drift.md` § Codex review tracking)
   - Completion-drift offer (see "Completion-drift offer" below — read-only; `reconcile` is the only mutation path)

## `--terminal`

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
  6. **CODEX REVIEW** line: see `{{ASSETS_PATH}}/project-drift.md` § Codex review tracking — this single line tells the user whether the work-in-progress has been adversarially reviewed since the last meaningful change, and surfaces the `review-due` command if not.

Unicode icons:
- `✓` done, `◉` active, `·` pending, `⊘` blocked, `⌂` parked, `⇥` emerged
- `◉ HERE` marks the active frame
- `←` or `waits X` for dependencies
- `⌛` lastReviewedAt is older than `staleContextDays`

ANSI colors (respecting `$NO_COLOR`):
- done → green, active/HERE → cyan, pending/— → gray, blocked → yellow, parked → magenta, stale-context → dim

### Default view — DRIFT banner

Whenever the terminal/default view renders an active initiative, also call `computeDrift(plan, allInitiatives)` and `renderBanner(report)` from `src/scope-drift.js`. If the banner is non-null, prepend it to the default-view output (above the header line) with a leading `⚠ ` glyph and color it yellow (status-blocked).

Thresholds (default, configurable per-repo via `.atomic-skills/status/config.json`):

- `phaseGrowthPctWarn`: 40
- `scopeExpansionPctWarn`: 25
- `parkedZombieDays`: 30

The banner is informational — it does not block any command. The user can ignore it. But the next `phase-done` flow re-checks drift and surfaces a stronger prompt before archive.

### Completion-drift offer (READ-ONLY — the view never mutates)

Every status view (`status` / `--browser` / `--terminal`) ALSO surfaces *completion* drift — entries that look done in the repo but are still open — via the shared deterministic detector. This is distinct from the scope-drift banner above (that is about *where* writes landed; this is about *whether* open work is actually finished).

1. Run `node scripts/detect-completion.js --json` from the repo root (add `--project <id>` when the active project is ambiguous). It is zero-token, pure-read, and fail-open — on any error treat it as "no drift" and render the view normally.
2. If `drift` is true, append a single non-blocking line BELOW the rendered view (never above it; the view content is unchanged):
   `⚠ <N> item(s) look done — reconcile now? (y/N)` — where `<N>` = `candidates.length`.
3. The y/N is the intrusive-actions gate: on **`y`** route to the `reconcile` verb (`{{ASSETS_PATH}}/project-transitions.md`); on **`N`** / no answer, do nothing. **The view itself writes NOTHING** — rendering and the offer are read-only; only `reconcile` mutates. This preserves the read-only contract of every status view.

The same line is what the no-args compact summary and the SessionStart hook surface (deterministically, from the same detector) — so "looks done but open" is caught on a forced cadence instead of by accident.

## `--list`

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

## `--plan [<slug>]`

Bird's-eye view of an active plan (or the only active plan if no slug given). Render:
1. Header: `<plan-slug> · v<version> · <status> · currentPhase: <id>`
2. PRINCIPLES (numbered list, title only)
3. PHASES (table): ID | Title | Status (icon) | SubPhases | Depends On | Exit Gate Summary
4. INTER-PHASE GATES (if present): "from → to: <criteria>"
5. REFERENCES (count + first 3)

## `--phase [<phase-id>]`

Detail view of the current phase of the active plan (or the given phase id). Render:
1. Header: `<plan-slug>/<phaseId> — <title> · <status>`
2. GOAL
3. EXIT GATE: criteria with status icons; render verifier kind summary
4. INITIATIVE for this phase (if exists): tasks summary inline
5. CROSS-TASK REFS impacting this phase

## `--stack`

Only the STACK section of the active initiative. 3-8 lines. For quick mid-session checks.

## `--archived`

Last 10 entries from the archive dirs — nested `.atomic-skills/projects/*/*/phases/archive/` (plus any legacy `.atomic-skills/plans/archive/` + `.atomic-skills/initiatives/archive/`), tabular, sorted by archived date desc.

## `--browser [<slug>]`

Opens the aiDeck dashboard in the browser, optionally deep-linking to a specific plan or initiative. This is the same mechanism used by the default view — the `--browser` flag is kept as an explicit alias for cases where the user invoked `--terminal` or a mutation command and now wants to jump to the dashboard.

1. Run the ensure-aideck script from the default view (step 1) to get `AIDECK_URL`.
2. If `AIDECK_URL` is non-empty (`pid` = the registered project id from the contract block):
   - If `<slug>` is provided: open the consumer page with the plan/phase deep-linked — `<AIDECK_URL>/$AIDECK_CONSUMER/plan/<slug>?project=<pid>` (or `/phase/<slug>`); the page resolves the slug against the project's dataSources.
   - If no `<slug>`: open `<AIDECK_URL>/$AIDECK_CONSUMER?project=<pid>` (the consumer overview).
   - Open via the **WSL-aware `open_url` helper** defined in the default-view step 3 (never bare `xdg-open` — it hangs on WSL2); fall back to printing the URL.
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
- (c): run the `new initiative` flow (`{{ASSETS_PATH}}/project-create-initiative.md`) with `parentPlan` = active plan slug; ask for `phaseId` (suggest plan's `currentPhase`)
- (d): run the `new initiative` flow with no plan membership
- (e): append row to "Ad-Hoc Sessions Log" in PROJECT-STATUS.md with timestamp + short description

## aiDeck integration notes

When [aiDeck](https://github.com/henryavila/aideck) is running alongside this skill, the `atomic-skills` v2 consumer reads the repo's canonical `.atomic-skills/` tree IN PLACE (root:'project' dataSources) and projects it onto the dashboard at the URL written to `~/.aideck/env` (default port 7777, auto-fallback to 7778–7787 if busy; use `aideck up` to ensure it is running and discover the actual URL). The skill always writes the files directly — aiDeck does NOT serve as an intermediary for mutations. Its MCP mutation tools (`aideck_atomic_skills_mark_task_done`, etc.) record append-only intents to `.atomic-skills/bootstrap-drafts/inbox/` and are intended for cross-tool consumers like other AI IDEs; the `project` skill itself does not call them, because the file-write path is faster and the intent log would just shadow the same change. Each intent's `target` carries the resolved `projectId` alongside the slug (the handlers derive it from the aiDeck-injected `record.projectId`), so any drainer MUST resolve the entity file via `projects/<target.projectId>/<target.planSlug|…>/…` — a slug alone is ambiguous across `projects/<id>/` (F-001). A mutation tool called with a slug that collides across projects and no `projectId` arg is rejected (`ambiguous slug … — pass projectId`) rather than guessing.

The dashboard surface is read-only: it renders plans, initiatives, tasks, and exit gates, and does not mutate state from the browser. Human/agent input flows through `.atomic-skills/bootstrap-drafts/inbox/*.jsonl` intent records that this skill drains on demand. In short: files are canonical, the dashboard is a projection, and there is no "MCP-or-file" choice for this skill.

**Draining a task-creating intent.** A `promote_parked` intent carries only `{parkedTitle}` (the `mark_task_done` intent mutates an existing task and is exempt). When this skill applies such an intent it MUST run the same author-summary step as the in-skill `promote` path (project-emergence.md → `promote` step 4): author a one-line `summary` in the install-configured communication language onto the new `tasks[].summary`, then run `node scripts/find-missing-task-summaries.js` and require exit 0 before declaring the drain complete. Otherwise a cross-tool consumer's promotion lands a summary-less task that renders bare in the Agora panel — the gap the "skill always generates" guarantee exists to close.
