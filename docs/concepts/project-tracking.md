# Project Tracking — The `.atomic-skills/` Model

This is the canonical explanation of the data model behind the `project` skill
(thin router + lazy project-assets). The README *names* Plans, Initiatives, Phases,
and Tasks; this document *defines* them — what each one is, where it lives on disk,
how they nest, and the discipline that keeps the model trustworthy over a multi-month
project.

If you only ever run the non-tracking skills (`fix`, `hunt`, `review-code`, …), you
never need this. The tracking model exists for one situation: **multi-session work where
the agent must reload exactly where you left off** — which phase you're in, what's parked,
why a task exists — without you re-explaining it every conversation.

Everything here is grounded in the JSON Schemas under
[`meta/schemas/`](../../meta/schemas/) (`plan.schema.json`, `initiative.schema.json`,
`common.schema.json`) and the skill bodies. The schemas are authoritative; this guide is
the readable version.

---

## 1. The mental model in one screen

State lives as plain Markdown-with-frontmatter files under `.atomic-skills/` at the repo
root. **The files are canonical.** When the aiDeck dashboard is running it observes those
files and renders them in the browser, but the dashboard is a read-only *projection* — it
never owns state, and every mutation is a file write.

```
.atomic-skills/                          canonical state tree (aiDeck = read-only projection)
│
├── projects/<project-id>/<plan-slug>/   NESTED layout (canonical; preferred)
│   ├── plan.md                          PLAN frontmatter + narrative body
│   │     currentPhase · phases[] (inline PhaseDescriptors + exitGates)
│   ├── phases/
│   │     ├── f0-<slug>.md               phase-anchored INITIATIVE (parentPlan + phaseId)
│   │     │     stack[] · tasks[] · parked[] · emerged[] · exitGates[]
│   │     └── archive/                   closed phase initiatives
│   └── lessons/                         optional per-initiative lessons
│
├── plans/<slug>.md · initiatives/       LEGACY flat layout (still readable; migrate with `project migrate`)
│
└── status/ · bootstrap-drafts/ · reviews/ · focus.json · PROJECT-STATUS.md

provenance (WHEN/WHO)  +  context {solves, trigger, assumesStillValid, ratifiedAt} (WHY, human-ratified)
   ── co-located on every emergent task/phase, and on EVERY parked/emerged entry ──
```

**Nested is the taught model.** New plans materialize under
`projects/<project-id>/<slug>/`. The legacy flat tree (`plans/`, `initiatives/`) remains
readable during migration; do not author new state in flat paths.

### Two facts the rest of the docs hide

These are the load-bearing relationships. Both come straight from the `project`
router and its lazy assets:

1. **A Phase is not its own file.** A phase is an *inline entry* in the Plan's `phases[]`
   array. The actual *work* for that phase lives in a separate **phase-anchored
   Initiative**, linked back to the plan by the initiative's `parentPlan` + `phaseId`. The
   Plan-phase ↔ Initiative link is the single most important relationship in the model: the
   plan declares *what* the phases are; an initiative is *where* each phase is executed.

2. **Plans are optional.** A repo can run entirely on **standalone initiatives** with no
   `parentPlan`. You do not need a multi-phase Plan to track work — you reach for a Plan only
   when an effort genuinely has ordered, gated phases. Single-phase work is just one
   standalone initiative.

---

## 2. Entity definitions

Every field below is from the schemas. Required fields are listed first; the markdown
*body* of each file (long-form prose) is **not** in frontmatter.

### Plan — `.atomic-skills/projects/<project-id>/<slug>/plan.md`

(Legacy flat: `.atomic-skills/plans/<slug>.md`.)

A multi-phase project: a narrative plus an ordered list of phases, each gated by an exit
gate. Optional root of the hierarchy.

- **Required frontmatter:** `schemaVersion: '0.1'`, `slug`, `title`, `version`, `status`
  (`active` | `paused` | `done` | `archived`), `started`, `lastUpdated`, `currentPhase`
  (the id of the phase in progress, or `null`), `parallelismAllowed` (bool), `phases[]`
  (≥ 1).
- **Optional:** `branch`, `principles[]`, `glossary[]`, `tracks[]`, `interPhaseGates[]`
  (`{from, to, criteria[]}`), `supersedes`, `references[]`, `whatStaysValid[]`.
- **Body:** the long-form narrative — context, motivation, the human-readable phase tree.
  This is *required content* even though it is not a schema field: `project-plan`'s Iron Law
  is **NO PLAN WITHOUT NARRATIVE** (§1 Context, §2 Principles, §3 Phase tree).

### Phase (PhaseDescriptor) — inline in `plan.md` `phases[]`

One ordered stage of a Plan. Declared inline; never a separate file.

- **Required:** `id` (e.g. `F0`), `slug`, `title`, `goal`, `dependsOn[]` (ids of
  prerequisite phases), `subPhaseCount`, `exitGate {summary, criteria[]}`, `status`
  (`pending` | `active` | `paused` | `done` | `archived`).
- **Optional:** `parallelWith[]`, `track`, `audience`, `externalImports[]`, `exitGateType`
  (`standard` | `ui-gate` | `custom`), and — only when a phase is inserted *mid-plan* —
  `provenance` + `context`.
- **Schema constraint:** if a phase carries `provenance`, it **must** carry `context`
  (the `if/then` rule in `plan.schema.json`). Phases that shipped in the original plan have
  neither — their "why" is the plan narrative.

### Initiative — `.atomic-skills/projects/<project-id>/<plan-slug>/phases/f<N>-<slug>.md`

(Legacy flat: `.atomic-skills/initiatives/<slug>.md`.)

The unit of *execution*. Either one phase of a Plan (phase-anchored) or a free-standing unit
of work (standalone). The initiative owns the tasks, the stack, and the parked/emerged
backlogs.

- **Required frontmatter:** `schemaVersion: '0.1'`, `slug`, `title`, `goal`, `status`
  (`pending` | `active` | `paused` | `done` | `archived`), `branch` (string | null),
  `started`, `lastUpdated`, `nextAction` (string | null), `exitGates[]`, `stack[]`,
  `tasks[]`, `parked[]`, `emerged[]`.
- **Optional:** `parentPlan` + `phaseId` (**both-or-neither** — present ⇒ phase-anchored;
  absent ⇒ standalone), `audience`, `scope {paths[]}`, `externalImports[]`, `references[]`,
  `crossTaskRefs[]`.
- **Slug convention** for a phase-anchored initiative: `<planSlug>-<phaseId>-<title-kebab>`
  — phaseId lowercased, truncated to 63 chars (e.g. `rebuild-matcher-f0-foundation-audit`).
- **Body:** additional rationale, decisions, gotchas.

### Task — inline in `initiatives/<slug>.md` `tasks[]`

The smallest tracked unit; an atomic action inside an initiative.

- **Required:** `id` (`T-NNN`), `title`, `status` (`pending` | `active` | `done` |
  `blocked`), `lastUpdated`.
- **Optional:** `description`, `closedAt`, `blockedBy[]`, `outputs[]` (kind ∈ `command` |
  `file` | `migration` | `json` | `test`), `tags[]`, `resourceCounts`, `scopeBoundary[]`
  (explicit "must NOT do" exclusions — drift defence at the task level), `acceptance[]`
  (≤ 5 `it()`-style assertions), `verifier`, and — only when added *mid-execution* —
  `provenance` + `context` (same `if/then` constraint as phases).

Closing the last open task of an initiative surfaces the next step: `phase-done` for a
phase-anchored initiative, or `archive` for a standalone one. The transition is *surfaced,
never auto-run* — you opt in.

### Track — `plans/<slug>.md` `tracks[]` (optional)

A named lane that groups parallel phases by domain (`{id, title, domain?}`). A phase opts in
with `track: <id>`. Tracks are a purely organizational overlay used when
`parallelismAllowed` is true — they impose no gating of their own and are rarely needed.

---

## 3. Exit gates and verifiers — how a phase proves it is done

A phase does not advance because the agent says so. It advances against **machine-checkable
exit criteria with captured evidence**. This is the proof mechanism behind "phase gates."

A phase carries `exitGate {summary, criteria[]}`; an initiative independently carries
`exitGates[]`. At `phase-done` the **phase-level criteria are authoritative**.

Each **exit criterion** (`common.schema.json#/$defs/exitCriterion`) has:

- `id`, `description`, `status` (`pending` | `met` | `deferred`)
- optional `metAt`, `deferredReason`, a `verifier`, and an `evidence` block.

A **verifier** is the executable proof attached to the criterion — a `oneOf`:

| kind | shape | v0.1 execution |
|------|-------|----------------|
| `shell` | `{kind, command, expectExitCode?}` | Run on y/N confirmation; compares exit code to `expectExitCode` (default 0). |
| `manual` | `{kind, description}` | Confirm on y/N; the user's note is the evidence. |
| `query` | `{kind, sql, expectRowCount?}` | **Stubbed** — the user runs the SQL externally and reports the row count. |
| `test` | `{kind, runner, pattern}` | **Stubbed** — the user runs the pattern externally and reports pass/fail. |

When a criterion is verified, `phase-done` stamps an **`evidence`** block:

```yaml
evidence:
  verifierKind: shell | query | test | manual
  verifiedAt: <ISO8601>
  passed: true | false
  exitCode: <int>      # shell only
  rowCount: <int>      # query only
  outputSummary: "<≤500 chars excerpt, or the user's manual note>"
```

**The hard rule: no evidence, no advance.** If a criterion has a verifier, `evidence` is
*required* to set its status to `met`. Without it, the criterion stays `pending`, or the
user explicitly marks it `deferred` with a `deferredReason`. The two stubbed verifier kinds
(`query`, `test`) are manual-report in v0.1 — the schema is there, the auto-execution is
not.

Tasks may also carry a `verifier`; the v0.1 Task schema has no task-level `evidence` field
yet, so a verified task records its result as a one-line note in `description`
(`verified shell at <ISO>: passed=true`).

---

## 4. Stack frames — lateral work without losing your place

Within a single initiative, `stack[]` is a **LIFO breadcrumb** of where you are *right
now*. Each frame is `{id (int ≥ 1), title, type, openedAt}`, where `type` ∈ `task` |
`research` | `validation` | `discussion` (inferred from the verb in the description:
"research…" → research, "test…" → validation, "discuss…" → discussion, otherwise task).

- **`push <description>`** opens a frame on top — a *lateral expansion of the same
  initiative* (e.g. chasing a slow query mid-task). Crucially, **push does not create a new
  initiative**; it just tracks the detour so it doesn't derail you.
- **`pop [--resolve | --park | --emerge]`** closes the top frame with a destination:
  `--resolve` (default — done, drop it), `--park` (file as a note for later), or `--emerge`
  (file as a real follow-up). `--park` / `--emerge` route through the ratify gate (§5);
  `--resolve` skips it because it creates no backlog entry.

The top frame renders as **`◉ HERE`**. When the stack gets deep, the skill warns *"is this
still the same initiative?"* (configurable `max_stack_depth_warning`) — a deep stack usually
means the detour deserved its own initiative.

---

## 5. The backlog: parked vs emerged, and the ratify discipline

Work surfaces mid-flight — an idea, a follow-up, a "we should also…". The model has two
distinct frontmatter arrays for it, one rung apart on an **emergence ladder**, and a hard
gate that keeps both honest.

### Two arrays

- **`parked[]`** — a low-commitment note for later, no decision to act. Entry:
  `{title, surfacedAt, fromFrame, context(REQUIRED)}`. Added by `park`. The lowest rung.
- **`emerged[]`** — a *real follow-up worth promoting*. Entry:
  `{title, surfacedAt, promoted, context(REQUIRED)}`. Added by `emerge`, which then offers
  to spin up a new initiative on the spot. `emerge --target <phaseId>` lands the item in a
  *different* phase's initiative when the surfacing context (a task in F0) belongs elsewhere
  (F2). The `promoted` flag flips when it becomes a task.

`promote <title-or-idx>` turns a parked item into a real Task (assigns the next `T-NNN`,
carries its `context` forward).

### Why both require a ratified context

A title-only backlog entry is worthless three months later — neither the human nor the agent
can tell what it was about or whether it still matters. So **every `parked` and `emerged`
entry requires a `context` block** (schema-mandatory, unconditionally). The cost is ~30
seconds at surfacing time; the payoff is a backlog that survives the read at any later point.

### provenance + context: WHEN/WHO + WHY

Anything added *after* a container's original materialization carries two co-located blocks:

- **`provenance`** (`common.schema.json#/$defs/provenance`) — the **WHEN/WHO**. Required
  `surfacedAt`; optional `surfacedDuring` (anchor like `<initiative-slug>/<task-id>`),
  `surfacedBy` (`human` | `ai`), `originalPhaseId` (for tasks moved cross-phase).
- **`context`** (`common.schema.json#/$defs/context`) — the **WHY**, human-ratified.
  Required `solves` (≥ 8 chars — the problem addressed), `trigger` (≥ 8 chars — the concrete
  observation that surfaced it), `ratifiedAt`; optional `assumesStillValid[]` (premises that
  make the item moot if invalidated), `ratifiedBy` (default `human`; the only other allowed
  value is `ai-with-explicit-user-confirm`), `lastReviewedAt` (the aging clock, seeded from
  `ratifiedAt`).

The schema makes them inseparable: **any task or phase carrying `provenance` must also carry
`context`** (the `if/then` rule). Items that shipped in the original plan/initiative have
neither — their narrative is the body.

### The ratify gate

Emergent work flows through **agent-proposes → user-RATIFIES → agent-commits**. The agent
never writes the entry directly. It drafts a `context` block, prints a `Proposed mutation:`
block, and **HALTs**. The user must reply with one of:

- **`ratify`** — apply the drafted context verbatim;
- a **pasted, edited** Drafted-context block — apply the edit;
- **`cancel`** — abort, nothing touched.

**A generic "ok" / "yes" / "do it" is explicitly NOT ratify.** The whole point is that the
human reads and approves the WHY before it lands on disk; a reflexive "yes" would defeat
that, so the agent treats it as a request to be more specific.

The **emergence ladder** picks the right magnitude (cost roughly doubles per rung; the agent
takes the lowest rung that fits):

| # | Magnitude | Command |
|---|-----------|---------|
| 1 | Note for later, no decision | `project-status park "<title>"` |
| 2 | Real follow-up worth promoting | `project-status emerge "<title>"` |
| 3 | Promote a parked/emerged item to a task | `project-status promote <title-or-idx>` |
| 4 | New task in the current phase | `project-plan new-task "<title>"` |
| 5 | New task in a different phase | `project-plan new-task --target Fk "<title>"` |
| 6 | New phase inserted into the plan | `project-plan new-phase <id> "<title>" --after <other>` |
| 7 | Phase grew too big — split it | `project-plan split-phase <id>` |
| 8 | Strategic shift — half the plan is wrong | `project-plan adopt <new-source.md>` (with `supersedes`) |

### Keeping the WHY fresh

- **`why <id>`** — read-only deep view of one task/phase/parked/emerged item: title, status,
  the ratified `solves`/`trigger`/`assumesStillValid`, provenance, and a staleness banner if
  `lastReviewedAt` exceeds `staleContextDays` (default 14).
- **`re-ratify <id>`** — refresh a stale `lastReviewedAt`, or rewrite `solves`/`trigger`/
  `assumesStillValid` when the original reasoning no longer holds.
- **`scope-creep`** — read-only drift report aggregating phase growth %, total scope
  expansion %, **parked zombies** (items nobody promoted, default age 30 days), and
  stale-context items; recommends `split-phase` / `promote` / `re-ratify` per finding.

(When the optional `pre-write.sh` PreToolUse hook is installed at enforcement level Soft or
Strict, it enforces the `provenance ⇒ context` rule *mechanically* — a direct edit that adds
a `tasks[]`/`phases[]` entry without provenance, or with provenance but missing
`context.solves`/`trigger`/`ratifiedAt`, is logged in dry-run mode or denied in strict mode.)

---

## 6. Scope — the drift boundary

An initiative may declare `scope {paths[]}` — the path globs it is allowed to touch.
`detect-scope` suggests paths from recent git activity on the branch and unions them in on
accept. Combined with per-task `scopeBoundary[]` (explicit "do-NOT-do" exclusions) and the
context aging above, `scope.paths` is what the `scope-creep` report uses to draw its
boundary. "scope-creep detection" with no defined scope is meaningless — `scope.paths` is the
definition.

---

## 7. The lifecycle, end to end

### Step 0 — Empty repo → bootstrap the tree (`project-status`, setup mode)

Run `project-status` with **no args** in a repo that has no `.atomic-skills/` directory and
it enters **setup mode** — the *one* bootstrap `project-plan` refuses to do. Setup:

1. Detects the IDE (`.claude/`, `.cursor/`, `.gemini/`, else generic).
2. Injects the Iron-Law hard-gate (**NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE**) into
   `CLAUDE.md` between idempotent markers, and writes/links `AGENTS.md`.
3. Optionally installs hooks (Claude Code only) at one of three enforcement levels —
   **Passive** (gate only), **Soft** (gate + `SessionStart` hook + dry-run `PreToolUse`
   provenance gate), or **Strict** (adds a `Stop` hook; strict knobs start in a 7-day dry-run
   window).
4. Creates `plans/` + `initiatives/` (each with an `archive/` subdir) + `status/`
   (`hooks/`, `config.json`), seeds `PROJECT-STATUS.md` (the human index), and patches
   `.gitignore`.
5. Offers to run `project-plan discover` to inventory work already in the repo.

### Step 1 — Get work under tracking (`project-plan`)

Three entry points, pick by situation:

- **`discover [--dry-run | --commit] [--scope=…] [--scan=…]`** — you don't yet know what's in
  flight. A multi-source scan (git branches/PRs/push-debt, GitHub issues, `docs/` plans +
  specs + ADRs, roadmap files, `.ai/memory`, the Claude project dir) enumerates → extracts
  signals → clusters → synthesizes drafts to `bootstrap-drafts/` and opens the discover UI.
  A source with **≥ 2 phase headings** is classified `candidate_shape: plan`; everything else
  is an `initiative`. It **HALTs** for approve/reject in the browser; `discover --commit`
  materializes the approved drafts. `--dry-run` only summarizes.
- **`<slug>` (default 7-stage bootstrap)** — you're describing a multi-phase project from
  scratch. The flow validates the slug, optionally delegates planning to
  [superpowers](https://github.com/anthropics/superpowers) (else uses a source markdown or a
  minimal template), decomposes the markdown into Plan + per-phase Initiatives + Tasks via
  `src/decompose.js`, previews counts for explicit confirmation, materializes from templates,
  validates every file against the schemas (**rolls back on any failure** — never partial
  state), activates the first phase, then *always* runs `review-plan --mode=internal` and
  prompts for a codex cross-model review.
- **`adopt <file.md>`** — you already wrote a free-form markdown plan. Same decompose →
  preview → materialize → validate → review path as bootstrap, but straight from the input
  file (no superpowers, no template).

For single-phase work there is **`new <slug>`** — materialize one initiative (standalone, or
anchored to an active plan's phase) from the template; optionally `detect-scope` to fill
`scope.paths`.

Legacy (pre-0.1) files are handled by **`migrate <slug>`** (convert to schemaVersion 0.1,
standalone or under a plan) followed by **`re-bootstrap <slug>`** (batch re-articulate any
parked/emerged items still holding a migration placeholder).

### Step 2 — Anchor every session (`project-status`)

On each session, `project-status` reads `PROJECT-STATUS.md`, determines the active Plan (and
its `currentPhase`) and the active Initiative, and matches the current git branch to an
active initiative. If none or several match, it runs the **disambiguation flow**: continue an
existing initiative, lateral-expand one (push a frame), open a new phase initiative, open a
new standalone initiative, or declare **ad-hoc** work. The Iron Law forbids code-modifying
work without an active anchored initiative (or an explicit ad-hoc declaration).

### Step 3 — Daily mutation (`project-status`)

- **View:** default opens the aiDeck browser dashboard and prints a compact terminal summary;
  `--terminal` is CLI-only; other read views: `--list`, `--plan`, `--phase`, `--stack`,
  `--archived`, `--report`.
- **Work:** `push`/`pop` for lateral frames; `done <task-id>` to close tasks; `park` /
  `emerge` / `promote` and the higher ladder rungs (which live in `project-plan`) for
  emergent work.
- **Guards run before every mutating command:** a **legacy-migration check** (a file with no
  `schemaVersion` aborts the mutation and routes you to `migrate`), and a **reconciliation
  gate** that flags any task `active` for > 24h (configurable
  `reconciliationThresholdHours`) and asks "still active? done? blocked?" before proceeding.

### Step 4 — Close a phase (`project-status phase-done`)

Invoked when the active initiative is a plan's phase initiative and all its tasks are closed:

1. Iterate each *pending* exit criterion through its verifier (§3), stamping `evidence`.
   Advance only when every criterion is `met` or explicitly `deferred` with a reason.
2. Run the **mandatory `review-code` gate** (`--mode=local`) on the phase diff (from the
   phase initiative's `started` commit to HEAD) — unless `--skip-review` is passed.
3. Call `src/transition.js:proposeAdvance(plan, phaseId)`, which returns one of `single`
   (propose the next phase), `parallel-choice` (when `parallelismAllowed`), or `plan-done`
   (no more eligible phases — offer to mark the plan `done` and archive it). A
   broken dependency graph (`unknownDeps`) aborts the advance.
4. On accept: **propagate completion into the initiative** (all tasks `done`, exitGates
   `met`, initiative `status: done`, evidence copied across), set the parent plan's phase
   `done` and `currentPhase` to the picked successor, **archive** the closed initiative, and
   **seed** the next phase's initiative (`project-plan new <plan>-<phase>-<title>`).

`phase-reopen [<phase-id>]` reverses a `phase-done` when a regression appears: restores the
initiative to `active`, clears `metAt` on all criteria, resets tasks to `pending`, and pulls
the file back out of `archive/` if needed.

### Step 5 — Archive / switch (`project-status`)

- **`archive [<slug>]`** moves a finished plan or standalone initiative to `archive/`.
  Archiving a plan **cascades** to its child initiatives; archiving a still-open plan
  initiative first propagates completion.
- **`switch <slug>`** toggles the active plan/initiative — pauses the current one, activates
  the target, and warns (offering to also switch the plan) if the target belongs to a
  different plan.

---

## 8. A worked example

A team is rebuilding its matching engine.

1. **Plan.** `project-plan rebuild-matcher`, pointed at a markdown spec. The 7-stage flow
   decomposes it into a Plan (`rebuild-matcher`) with phases **F0** "Foundation audit",
   **F1** "New matcher" (`dependsOn: [F0]`), **F2** "Cutover" — each with an exit gate. F0's
   criterion *"matcher round-trip test passes"* carries a verifier
   `{kind: shell, command: "npm test -- matcher"}`. Stage 6 materializes only the F0
   initiative, retains F1/F2 as descriptor-only source sidecars for later activation,
   activates F0, and runs `review-plan --mode=internal` then a prompted codex review.

2. **Anchor.** Daily, `project-status` matches the branch to the active F0 initiative and
   shows `3/5 tasks done`.

3. **Emergence + ratify.** Mid-work the agent notices the dataset is drifting. The developer
   says "we also need a canary test." The agent enters proposal mode, picks ladder rung 5
   (a new task in a *different* phase), prints a `Proposed mutation:` block with a drafted
   `context` (`solves`/`trigger`/`assumesStillValid`), and **HALTs**. The developer types
   **`ratify`** → `project-plan new-task --target F1 "Add cross-landlord canary" --blocked-by
   T-002` appends a task carrying provenance + ratified context. A smaller idea ("maybe cache
   the join later") is **`park`**ed instead.

4. **Phase close.** When F0's last task closes, `done T-005` surfaces the transition.
   `project-status phase-done` runs each exit verifier (stamping `evidence{passed: true,
   exitCode: 0}`), runs the `review-code` gate on the phase diff, calls `proposeAdvance`,
   collects the F1 `businessIntent`, materializes F1 from its retained sidecar, moves
   `currentPhase`, marks the F0 initiative `done`, and archives it.

5. **Drift, weeks later.** `scope-creep` flags that the parked cache idea is a 40-day zombie
   with stale context. `re-ratify` either refreshes its premises or retires it.

---

## 9. Commands by workflow

The single thing newcomers get wrong: **`project-plan` owns CREATE + STRUCTURAL operations;
`project-status` owns VIEW + DAILY mutations.** People look for `new-task` under
`project-status`, where it does *not* live. Group by ownership, not by alphabet.

### `project-status` — view + daily mutations

**Stack frames** — *open and close lateral work without losing your place.*

| Command | What it does |
|---------|--------------|
| `push <description>` | Open a side-investigation frame on top of the current work; type inferred from the verb. |
| `pop [--resolve\|--park\|--emerge]` | Close the top frame and say where it goes (`--resolve` drops it; `--park`/`--emerge` route through the ratify gate). |

**Backlog** — *capture mid-flight work, then turn it into tasks when ready.*

| Command | What it does |
|---------|--------------|
| `park <description>` | File a low-commitment note into `parked[]`; ratify gate forces a one-line `solves`/`trigger`. |
| `emerge <description>` | File a real follow-up into `emerged[]`; same gate; offers to spin up a new initiative. `--target <phaseId>` lands it in another phase. |
| `promote <title-or-idx>` | Turn a parked item into a real task (next `T-NNN`, carries context forward; re-prompts only if stale). |

**Tasks & phases** — *advance work through completion and gates.*

| Command | What it does |
|---------|--------------|
| `done <task-id>` | Mark a task done, stamp `closedAt`; if it was the last open task, surfaces (does not auto-run) `phase-done` or `archive`. |
| `phase-done` | Verify every exit criterion, run the mandatory `review-code` gate, propagate completion, advance `currentPhase`, seed the next phase. |
| `phase-reopen [<phase-id>]` | Undo a `phase-done`: initiative back to `active`, clear `metAt`, tasks back to `pending` (un-archives if needed). |

**Lifecycle** — *move whole plans/initiatives between states.*

| Command | What it does |
|---------|--------------|
| `archive [<slug>]` | Move a finished plan/initiative to `archive/`; archiving a plan cascades to its child initiatives. |
| `switch <slug>` | Pause the current active plan/initiative, activate the target; warns on cross-plan switches. |

**Context & drift** — *inspect why work exists and watch for creep (read-only except `re-ratify`).*

| Command | What it does |
|---------|--------------|
| `why <id>` | Read-only deep view of one item: status, ratified `solves`/`trigger`/assumptions, provenance, staleness banner. |
| `re-ratify <id>` | Refresh a stale `lastReviewedAt`, or rewrite `solves`/`trigger`/assumptions when the reasoning no longer holds. |
| `scope-creep` | Read-only drift report: phases that grew, scope expansion %, parked zombies, stale-context items, with recommendations. |
| `detect-scope` | Suggest a `scope.paths` value from recent git activity, presented as a checklist you accept (and merge with existing scope). |

**Review** — *keep in-flight work covered by adversarial cross-model review.*

| Command | What it does |
|---------|--------------|
| `review-due` | Run a codex review on the diff since the last review (or the whole branch), and record the result in `last-review.json`. |

### `project-plan` — create + structural operations

**Discover & adopt** — *bring existing work under tracking without hand-writing it.*

| Command | What it does |
|---------|--------------|
| `discover [--dry-run\|--commit] [--scope=…] [--scan=…]` | Scan the repo for in-flight work, cluster signals, propose Plans + Initiatives; review in the browser; `--commit` materializes. |
| `adopt <file.md>` | Capture an existing free-form markdown plan into structured Plan + Initiatives + Tasks (decompose → preview → materialize → validate → review). |

**Create units** — *add the building blocks.*

| Command | What it does |
|---------|--------------|
| `<slug>` (default) | Interactive 7-stage bootstrap of a fresh multi-phase Plan. |
| `new <slug>` | Create one Initiative from the template — standalone or anchored to an active plan's phase. |
| `new-task "<title>" [--target <phaseId>] [--blocked-by <id>] [--tags …]` | Add a task to the active initiative (or another phase via `--target`); records provenance, requires ratified context. |
| `new-phase <id> "<title>" --after <other-id>` | Insert a new phase and materialize its initiative; sets `dependsOn` via `--after`; requires ratified context; runs an internal plan review. |

**Restructure** — *reshape a plan whose phases outgrew their sizing.*

| Command | What it does |
|---------|--------------|
| `split-phase <id>` | Split an over-sized phase into sub-phases; moves tasks (preserving provenance), archives the original as `archived` (not `done`). |

**Migrate legacy** — *bring pre-0.1 state up to current schema.*

| Command | What it does |
|---------|--------------|
| `migrate <slug>` | Convert a legacy initiative to schemaVersion 0.1 (standalone vs under-a-plan); reports the field-mapping diff. |
| `re-bootstrap <slug>` | Batch re-articulate every parked/emerged item still holding a migration placeholder; idempotent, no-op when nothing is left to fix. |

---

## 10. Where to go next

- **The skills themselves:** [`project-status`](../skills/project-status.md),
  [`project-plan`](../skills/project-plan.md).
- **The schemas (authoritative):** [`meta/schemas/plan.schema.json`](../../meta/schemas/plan.schema.json),
  [`initiative.schema.json`](../../meta/schemas/initiative.schema.json),
  [`common.schema.json`](../../meta/schemas/common.schema.json).
- **Validate any state file:** `npm run validate-state .atomic-skills/<path>`.
