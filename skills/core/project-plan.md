Create, restructure, and migrate Plan / Initiative / Task state in `.atomic-skills/`. The CREATE/STRUCTURAL counterpart to `project-status` (VIEW/MUTATION). Single entry-point for: bootstrapping a Plan from scratch, adopting an existing markdown plan, discovering in-flight work across the repo, adding individual initiatives/tasks/phases, splitting overgrown phases, and migrating legacy state files. Once Plans + Initiatives are created here, daily tracking flows through `project-status`.

State files conform to JSON Schemas in `meta/schemas/` (`plan.schema.json`, `initiative.schema.json`, `common.schema.json`). Validate via `npm run validate-state`. Canonical `schemaVersion` is `'0.1'`.

## Iron Law

NO PLAN WITHOUT NARRATIVE.

A bare frontmatter is not a Plan. Every plan created here ships a markdown body with at minimum:
- §1 Context — why this plan exists
- §2 Principles — elaborate frontmatter `principles[]`
- §3 Phase tree — human-readable summary of `phases[]`

If the user pushes back ("just create empty plan"), produce a `## TODO` skeleton for each section instead of skipping it. Empty sections are explicit, not implicit.

## When to invoke

- "I want to organize what I have" → `discover` (scans memory + plans + git divergence)
- User describes a multi-phase project ("redo our admin UI", "rebuild the matching engine") → default interactive bootstrap
- A free-form plan markdown exists somewhere and needs to be captured → `adopt <file.md>`
- A legacy initiative needs to be converted to schema 0.1 → `migrate <slug>`
- Standalone initiative (single-phase work) → `new <slug>`
- Add a task/phase to an existing plan → `new-task`, `new-phase`, `split-phase`

## Subcommands

| Verb | Mode | Purpose |
|------|------|---------|
| Bootstrap | `(default) <slug>` | Interactive 7-stage bootstrap of a fresh Plan |
| Bootstrap | `discover` | Multi-source scan (`.ai/memory`, `docs/`, git, custom) → propose Plans + Initiatives |
| Bootstrap | `adopt <file.md>` | Decompose an existing markdown plan into Plan + Initiatives + Tasks |
| Create | `new <slug>` | Create a standalone Initiative (or one anchored to an active plan) |
| Create | `new-task "<title>" [--target <phaseId>] [--blocked-by <id>] [--tags ...]` | Add a task to an active initiative |
| Create | `new-phase <id> "<title>" --after <other-id>` | Insert a new phase into the active plan + materialize its initiative |
| Restructure | `split-phase <id>` | Split an over-sized phase into two sub-phases (archives original) |
| Migrate | `migrate <slug>` | Convert a legacy initiative file to schemaVersion 0.1 |
| Migrate | `re-bootstrap <slug>` | Batch re-articulate placeholder context after `migrate` |

**Day-to-day tracking commands** (view, push/pop, park/emerge, promote, done, phase-done/reopen, archive, switch, scope-creep, review-due, re-ratify, why, detect-scope) live in **`atomic-skills:project-status`**.

See sections below per {{ARG_VAR}}.

## Initial detection

Run with {{BASH_TOOL}}:

- `test -d .atomic-skills/` — if absent, abort with: "Run `atomic-skills:project-status` setup first." This skill assumes the canonical tree already exists; it does not bootstrap it.
- `test -d .atomic-skills/plans/` — if absent, create it (`mkdir -p .atomic-skills/plans/archive`). Older repos that ran setup before B.T-003 may not have this directory yet.
- If `<slug>` provided, pre-flight: `test -f .atomic-skills/plans/<slug>.md` — abort early on collision before any work.

## Default flow — 7 stages

Stages run in order. Each stage gates the next: do not advance past a stage with an unresolved question.

### Stage 1 — Validate slug

- Slug regex: `^[a-z][a-z0-9-]{1,63}$`. Reject with a clear message + suggested fix on mismatch.
- Duplicate check: if `.atomic-skills/plans/<slug>.md` exists, abort with a suggested alt-slug (e.g., `<slug>-v2`).
- Reserved slugs (`archive`, `index`) are rejected.

### Stage 2 — Detect superpowers

Detect whether the [superpowers](https://github.com/anthropics/superpowers) plugin is installed and announce the result. The detection signal flows into Stage 3 (decide whether to delegate planning to superpowers, or fall back to user-supplied input).

Detection details and the delegate-vs-fallback decision tree live in the **Superpowers integration** section below.

### Stage 3 — Optional delegation (superpowers)

If superpowers is available AND the user opts in, delegate the discovery + plan-writing steps to it. Otherwise, ask the user for a path to an existing plan markdown OR offer a minimal in-skill template. Either way, the output is a single markdown document — the "source plan" — that Stage 5 will decompose.

Full procedure in the **Superpowers integration** section.

### Stage 4 — Receive markdown plan

Read the source plan (either the file produced by superpowers, the file the user pointed at, or the in-skill template the user filled in).

Sanity checks before decomposing:
- File is well-formed markdown (has at least one H1 or H2 header).
- File is < 5,000 lines (anything larger almost certainly contains noise that needs splitting first — surface a warning and ask the user to confirm).
- The file is *outside* `.atomic-skills/plans/`. This skill never decomposes a previously-materialized plan.

If any check fails: surface the specific issue, do not proceed.

### Stage 5 — Decompose

Apply heuristics to extract `Plan` + `Initiatives[]` + `Tasks[]` from the source markdown. **Always** present the resulting structure (count of phases, initiatives, tasks; first 3 phase titles) for user confirmation before any file is written.

Decomposition rules live in the **Markdown decompose** section.

### Stage 6 — Create Plan + Initiatives

Materialize the decomposed structure:

- `.atomic-skills/plans/<slug>.md` from `skills/shared/project-status-assets/plan.template.md`
- `.atomic-skills/initiatives/<slug>-<phase-id>.md` per phase, from `skills/shared/project-status-assets/initiative.template.md` with `parentPlan: <slug>` + `phaseId: <id>` filled and the plan-membership-block kept
- Append rows to `.atomic-skills/PROJECT-STATUS.md` (the Plan in "Active Plans", each Initiative under it)

After writing every file, run:

```bash
npm run validate-state .atomic-skills/plans/<slug>.md
npm run validate-state .atomic-skills/initiatives/<slug>-<phase-id>.md   # per phase
```

If any file fails schema validation, surface the errors and roll back (delete the just-written files). Do not leave partial state on disk.

### Stage 7 — Activate first phase

- Set the first phase's initiative to `status: active`; the rest stay `status: pending`.
- Set the Plan's `currentPhase` to the first phase id.

### Stage 8 — Adversarial review (always runs)

The plan is materialized but NOT yet ready. Run review before declaring done.

**Stage 8a — Internal review (always, no user prompt).**

Invoke `atomic-skills:review-plan --mode=internal` with arg = the plan file path. The `--mode=internal` flag short-circuits the Step 0 prompt so this non-interactive stage doesn't block on user input each iteration. This is cheap (no external dependency, no token cost beyond the skill itself) and catches:

- Soft-language violations (G2 — see `docs/kb/code-quality-gates.md`)
- Bare assertions without `verified_by:` or `unverified:` (G6)
- Internal contradictions, broken dependencies, ambiguous tasks

Apply the findings inline before proceeding to 8b. Re-run `review-plan --mode=internal` until it returns zero findings of severity major or higher.

**Stage 8b — Cross-model review with Codex (intrusive-actions rule).**

Announce to the user:

> The plan is materialized and passed internal review. Run a cross-model adversarial review via Codex (`atomic-skills:review-plan --mode=codex`)? This catches same-model blind spots that internal review misses. Cost: ~$0.50–$1.50 per run, 5–10 minutes wall time. (y/N)

- On `y`: invoke `atomic-skills:review-plan` with args = `<plan path> --mode=codex` (skips the Step 0a mode picker and runs only the codex sub-flow). Apply blocker/critical findings before proceeding. Major findings: at minimum surface them; user decides per item.
- On `n`: continue, but record the skip in the plan's `## Self-review against code-quality gates` block (new line: `Codex review: SKIPPED — <user reason or "not provided">`).

Persistence: the review file goes to `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<plan-slug>.md` exactly per the `review-plan` codex sub-flow contract. The plan body MUST link to it in a `## Reviews` section appended after `## Self-review against code-quality gates`.

### Stage 9 — Announce

- Plan path
- N initiatives created
- Active phase: `<F0> — <title>`
- Reviews: internal (zero findings) + codex (verdict, counts, link to `.atomic-skills/reviews/<…>.md`) OR (skipped per user)
- Suggested next: `atomic-skills:project-status` to view the bird's-eye

## Markdown decompose

Decomposition reads a source markdown file and emits a structured proposal (`{plan, initiatives, warnings}`) for user confirmation. The pure transform lives in `src/decompose.js`:`decomposePlan(markdown, { planSlug })`. The skill body owns the interactive confirmation and the eventual file write (Stage 6); the helper only owns the transform.

### Heuristic rules

The source markdown must follow these documented conventions. Section names are matched case-insensitively, with leading numbered prefixes (`## 2. ...`, `### 2.1 ...`) and Unicode diacritics stripped first — so `## 2. Princípios invioláveis` and `## 5. Glossário` (Portuguese) detect the same as `## Principles` and `## Glossary`.

1. **Plan title** — the first H1 (`# ...`) becomes `plan.title`. If no H1 exists, the helper records a warning and leaves the title empty — you must fill it before Stage 6.

2. **Plan narrative** — every line between the H1 and the first H2 becomes `plan.narrative` (whitespace-trimmed, joined as-is). The skill writes this as the Plan markdown body's intro paragraph.

3. **Principles** — an H2 whose normalized title starts with `princip` (matches `Principles`, `Inviolable principles`, `Princípios invioláveis`, …) becomes the principles section. Two parser modes (whichever yields ≥ 1 entry):
   - **H3 mode** (preferred when the section has ≥ 2 H3s): each `### ... ` becomes one principle. The id is derived from a numbered prefix on the H3 (`### 2.1 Title` → `P1`, `### 2.6 Title` → `P6`) or from a leading `P<N>` token; auto-numbered otherwise. The principle `body` is every line until the next H3 (or section end).
   - **Bullet mode** (fallback): each top-level bullet parses as `**P1 Title** — body`, `P1 Title — body`, `**Title** — body`, `Title — body`, or `Title: body`.

4. **Glossary** — an H2 whose normalized title starts with `glossar` (matches `Glossary`, `Glossário`, …). Two parser modes:
   - **Table mode** (preferred when a markdown table is present): rows `| **term** | definition |` are parsed; the header row (`Termo | Term | Word | Significado | Definition | Meaning`, case-insensitive) is auto-skipped; the separator row (`|---|---|`) is auto-skipped; `**` markers stripped.
   - **Bullet mode** (fallback): bullets parse as `term — definition`, `term: definition`, or `**term** — definition`.

5. **Phases** — an H2 whose title matches `^(F\d+)\b\s*[-—–]?\s*(.+)?$` becomes a phase. Capture-group 1 (e.g. `F0`) is the `phaseId`; capture-group 2 is the title. Inside that H2:
   - The first line whose trimmed (and bold-stripped) start matches `^(goal|objetivo)\s*:` becomes the phase `goal` (prefix stripped). Both `Goal: ...` and `**Goal:** ...` / `**Goal**: ...` are recognised, as are PT `**Objetivo:** ...`.
   - **Tasks — two extraction modes:**
     - *Sub-fases bullet mode* (preferred when an H3 marker like `### Sub-fases (menu)`, `### Sub-phases`, `### Tasks`, or `### Sub-tasks` is present, EN+PT): bullets in that H3 with format `- **<id> — <title>.** body` are parsed as tasks. The `<id>` may carry a phase prefix (`F0.T-001`) which is stripped to leave the intra-initiative id (`T-001`). The body after the bold block becomes `task.description`.
     - *H3 mode* (fallback): every non-marker H3 becomes a task; the H3 line is parsed for an optional leading `T<N>` / `T-NNN` / `T0.1` token; otherwise auto-assigned `T-001`, `T-002`, … within that phase.
   - **Exit gates — two extraction modes:**
     - *YAML mode* (preferred): a ` ```yaml ... ``` ` (or `yml`) fenced block whose top level declares `exit_gate:` or `exitGate:` (either as an array directly, or with a `criteria:` array inside) parses via the `yaml` npm package. Each criterion's `status` is forced to `pending`.
     - *Prose mode* (fallback): a line `**Exit gate da fase:** ...` / `**Exit gate:** ...` / `**Gate de saída:** ...` becomes a single criterion with `id: G-1`, `verifier: { kind: 'manual', description: 'Verify exit-gate prose with the user during phase-done.' }`, and the prose as `description`. The user runs the verifier later via `project-status:phase-done`.

6. **Unrecognized H2** — any other H2 is captured in `warnings`. The decompose does **not** error on unrecognized sections; the user sees the warning during Stage 5 preview and decides whether to keep the section in the plan body, move it, or drop it.

7. **No-phase guard** — if zero H2 sections match the phase pattern, `decomposePlan` throws. A Plan with no phases is invalid per `meta/schemas/plan.schema.json` (`phases.minItems: 1`); failing fast is friendlier than writing invalid state.

8. **Duplicate phase id guard** — if two phase H2s share the same id (e.g. two `## F0 — ...`), `decomposePlan` throws with the offending heading text. Plans must have unique phase ids — the schema does not enforce uniqueness, but downstream `currentPhase` / `dependsOn` resolution depends on it.

9. **Malformed exit_gate YAML** — when a fenced `exit_gate:` block fails to parse, the decompose surfaces a warning (`Malformed exit_gate: YAML block in phase <id> — dropped from decompose. Parser said: <first line>`) instead of swallowing silently. The phase keeps its prose exit-gate (if present) or zero gates.

### Slug derivation

Each phase's initiative slug is derived as `<planSlug>-<phaseId-lowercase>-<phase-title-kebab>` (truncated to 63 chars, must match `^[a-z][a-z0-9-]{1,63}$`). Example: `<sample, F0, "Foundation Repair">` → `sample-f0-foundation-repair`.

### How to invoke (Stage 5)

Run from the package root via `node -e`:

```bash
node -e "
import('./src/decompose.js').then(async ({ decomposePlan, previewDecomposition }) => {
  const md = require('node:fs').readFileSync('<path-to-source.md>', 'utf8');
  const result = decomposePlan(md, { planSlug: '<slug>' });
  console.log(previewDecomposition(result));
  console.log('---');
  console.log(JSON.stringify(result, null, 2));
});"
```

The skill body (you, the LLM) reads the preview to the user, waits for explicit confirmation, then maps the JSON result into the plan + initiative templates during Stage 6.

### Preview / confirmation flow

Always run `previewDecomposition(result)` and display it before any file write. The preview shows:

- Plan title (or `(none — must fill)`)
- Counts: principles, glossary, phases, tasks, exit gates
- First 3 phase titles with per-phase task + gate counts
- Warnings list (skipped sections, missing H1, …)

User must explicitly confirm before Stage 6. If the user wants edits, they re-run with a fixed source file rather than ad-hoc patching the JSON — keeps the source markdown as the canonical input.

## Superpowers integration

This section covers Stages 2 and 3 in full. The skill works identically with or without [superpowers](https://github.com/anthropics/superpowers) installed; superpowers is an optimization, not a dependency.

### Stage 2 — Detect superpowers

Run with {{BASH_TOOL}}:

```bash
test -d "$HOME/.claude/plugins/superpowers" \
  || command -v superpowers >/dev/null 2>&1 \
  && echo "superpowers: available" \
  || echo "superpowers: absent"
```

Cache the result for Stage 3. Do not re-probe later in the flow.

Announce the detection outcome to the user in one sentence:
- Available: "superpowers detected — you can delegate brainstorming + plan writing to it."
- Absent: "superpowers not installed — I'll ask for an existing plan file or hand you a minimal template to fill."

### Stage 3 — Optional delegation OR fallback

Branch on the Stage 2 result.

#### Branch A — superpowers available

Present Structured Options:

```
Plan input source?
  (a) Delegate to superpowers (brainstorm + write-execution-plan)  ← recommended
  (b) I'll paste an existing markdown plan file path
  (c) Give me the minimal template — I'll fill it
```

If `(a)`:

1. Invoke `superpowers:brainstorm` with the user's goal as the seed prompt. The user iterates with superpowers until they accept the brainstorm output.
2. Invoke `superpowers:write-execution-plan` with the brainstorm artifact. Receive the resulting structured markdown file.
3. The output's path becomes the source-plan path for Stage 4.

If `(b)`:
- Ask for the markdown file path. Validate it exists. Skip to Stage 4.

If `(c)`:
- Fall through to Branch B's minimal-template subflow.

#### Branch B — superpowers absent

Present Structured Options:

```
Plan input source?
  (a) I'll paste an existing markdown plan file path
  (b) Give me the minimal template — I'll fill it  ← default
```

If `(a)`:
- Ask for the markdown file path. Validate it exists. Skip to Stage 4.

If `(b)` (the minimal-template subflow):

1. Copy `skills/shared/project-plan-assets/minimal-source.template.md` to a temp path inside the repo, e.g. `.atomic-skills/_drafts/<slug>-source.md`. Create the `_drafts/` directory if needed.
2. Tell the user the file path and what sections to fill (title, narrative, principles, glossary, ≥ 1 phase with ≥ 1 task). Suggest they leave the `REPLACE_*` markers in any section they don't want to fill — the decomposer's no-phase guard surfaces the only hard-required section.
3. Wait for the user to confirm they've finished editing. Re-read the file.
4. Use this path as the source-plan path for Stage 4.

`.atomic-skills/_drafts/` should be added to `.gitignore` if not already (the temp source is not canonical state). Append the entry idempotently.

### Failure modes

- **superpowers detected but invocation fails** (e.g., plugin disabled, network down): announce the error verbatim, drop back to Branch B. Do not retry silently.
- **User aborts mid-flow**: the skill keeps the source file (if any) but does NOT write to `.atomic-skills/`. The flow can be resumed by re-invoking `project-plan <slug>` and pointing at the same source file via option `(b)`.
- **Both branches exhausted and user has no source**: abort with a clear message — there is nothing to decompose. Suggest they describe the project to superpowers or sketch it directly into the minimal template.

The skill never errors out just because superpowers is absent.

## `adopt <file.md>`

`adopt` is the retroactive-capture path: take an existing markdown plan file the user already wrote (e.g. the 843-line `docs/superpowers/plans/v3-redesign/00-master.md`) and materialize Plan + N Initiatives + Tasks from it. Skips Stages 2–4 (no superpowers delegation, no template handoff) and goes straight from input file to materialized files.

### Step-by-step

1. **Validate the input.** Resolve the path the user passed. Fail with a clear message if:
   - the file does not exist,
   - it is not a regular file (e.g., directory, symlink to nowhere),
   - it does not end in `.md`,
   - it lives under `.atomic-skills/plans/` (refuse to re-decompose canonical state).

2. **Derive the plan slug.** Default: kebab-case the source file's basename minus extension (e.g., `00-master.md` → `00-master`; ask the user to confirm or override). Apply the slug regex `^[a-z][a-z0-9-]{1,63}$`; reject leading digits by stripping them or prompting for a new slug.

3. **Collision check.** Pre-flight `test -f .atomic-skills/plans/<slug>.md` and `test -d .atomic-skills/initiatives/`. Abort on any collision with the proposed plan slug or with any derived initiative slug. Point the user at `project-status switch` or a fresh slug.

4. **Decompose.** Run the Stage 5 helper exactly as the default flow does:

   ```bash
   node -e "
   import('./src/decompose.js').then(({ decomposePlan, previewDecomposition }) => {
     const md = require('node:fs').readFileSync('<source-path>', 'utf8');
     const result = decomposePlan(md, { planSlug: '<slug>' });
     console.log(previewDecomposition(result));
     console.log('---JSON---');
     console.log(JSON.stringify(result));
   });"
   ```

5. **Preview + explicit confirmation.** Show the user the rendered preview (plan title, counts, first 3 phase titles, warnings). Wait for an explicit `yes` — no implicit confirmation, no "(default y)". `adopt` is the highest-stakes path; always pause here.

6. **Materialize.** On confirmation, run the pure transform:

   ```bash
   node -e "
   import('./src/decompose.js').then(({ decomposePlan, materializeDecomposition }) => {
     const md = require('node:fs').readFileSync('<source-path>', 'utf8');
     const result = decomposePlan(md, { planSlug: '<slug>' });
     const files = materializeDecomposition(result, { planSlug: '<slug>', branch: '<branch-or-null>' });
     console.log(JSON.stringify(files));
   });"
   ```

   Then for each `{relativePath, content}` in the returned array, create the parent directory (`mkdir -p`) and write the file. Order does not matter — files are independent — but write the Plan first so failures don't leave orphan initiatives.

7. **Validate.** Run `npm run validate-state .atomic-skills/plans/<slug>.md` and `npm run validate-state .atomic-skills/initiatives/` (recursive). On any validation failure, surface the errors verbatim and **roll back** — delete the files just written. Never leave partial state on disk; the manifest invariant is "every file in `.atomic-skills/` validates against its schema".

8. **Update PROJECT-STATUS.md.** Append rows in the canonical tables: the Plan to "Active Plans", each Initiative to its plan's group. (Same content `project-status` writes — `adopt` does it inline rather than calling out.)

9. **Optional source archive.** Ask: "Archive the source markdown to `docs/archive/<YYYY-MM-DD>-<basename>`? (y/N)". If yes, `git mv` the file (preserves history). If no, leave it in place; the user can repeat `adopt` against an updated copy without conflict because the materialized state is the canonical source from this point forward.

10. **Activate first phase.** Same as Stage 7 of the default flow.

11. **Adversarial review.** Same as Stages 8a + 8b of the default flow — internal review always (apply findings inline), Codex cross-model review prompted to user (y/N). Persist the codex review file to `.atomic-skills/reviews/<…>.md` and link from the plan body's `## Reviews` section.

12. **Announce.** Same as Stage 9 of the default flow:
    - Plan path
    - N initiatives created
    - Active phase: `<F0> — <title>`
    - Reviews: internal (zero findings) + codex (verdict, counts, file) OR (skipped per user)
    - Suggested next: `atomic-skills:project-status` to view the bird's-eye

### Failure-mode summary

- **Decompose throws (zero phases):** the source file does not match the convention. Surface the message verbatim; abort. Suggest the user run the default flow's Branch B and migrate content into the minimal template.
- **Validation fails after materialize:** roll back (delete files), surface schema errors. The decomposer or materialize logic has a bug — file an initiative against atomic-skills, do NOT manually patch the files.
- **User aborts at step 5:** no files written, no rollback needed. The user can re-run `adopt` with an edited source file.
- **User aborts during step 6 (rare — fs errors):** roll back any files written so far. The repo state must return to pre-`adopt` state on any failure.

## `discover`

`discover` is the **multi-source inventory entry-point** — use it when you don't know what work the repo has in flight, or when you have signals scattered across `.ai/memory/`, `docs/`, git, and want a single coherent proposal instead of N manual `adopt`/`migrate`/`new` invocations.

Replaces the legacy `bootstrap` subcommand (which lived in `project-status`). Same Phase 1–4 pipeline (enumerate → extract → cluster → synthesize), extended to **detect multi-phase plan sources** and propose them as Plans (not just standalone Initiatives).

### Invocations

- `discover` — full pipeline (scan + cluster + synthesize); writes drafts to `.atomic-skills/bootstrap-drafts/`; opens `INDEX.md` in mdprobe (with confirmation)
- `discover --dry-run` — same scan, terminal summary only; no files written
- `discover --commit` — materializes approved drafts into `.atomic-skills/plans/` + `initiatives/`; updates PROJECT-STATUS.md
- `discover --scope=<list>` — limits sources. Defaults: `git,github,docs,roadmap,memory-local,memory-claude,claude-mem`
- `discover --scan=<path>[,<path>...]` — extra sources beyond defaults (e.g., `--scan=NOTES/,~/myteam/plans/`). Custom paths are walked recursively for `*.md` files. Useful for teams whose convention is not `.ai/memory/`.

### Pre-conditions

- `.atomic-skills/` must exist (run `atomic-skills:project-status` setup first). If absent: abort with `"run project-status setup first"`.
- For Layer 2 (Claude ecosystem): `.claude/` must exist in the repo.

### .gitignore

When `.atomic-skills/` was created via setup, the following are already gitignored. If not, append:

```
.atomic-skills/bootstrap-drafts/
.atomic-skills/status/bootstrap.json
```

### Phase 1a — Shell enumerate

Deterministic collection. No content interpretation.

#### Git (always)

```bash
# Active branches (last 180d)
git for-each-ref --sort=-committerdate \
  --format='%(refname:short)|%(committerdate:iso-strict)|%(authorname)' \
  refs/heads refs/remotes/origin

# Recent commits grouped by Conventional Commits scope (90d)
git log --since='90 days ago' --pretty=format:'%h|%s|%ci' \
  | grep -E '^[a-f0-9]+\|(feat|fix|refactor|docs|test|chore)\([^)]+\):'

# Push debt — commits ahead of origin/main (signal of unmerged work)
git log --oneline origin/main..HEAD 2>/dev/null | head -20
```

#### GitHub CLI (if `gh` is available)

```bash
gh pr list --state open --json number,title,headRefName,updatedAt,body,labels 2>/dev/null
gh pr list --state merged --limit 20 --json number,title,headRefName,mergedAt 2>/dev/null
gh issue list --state open --assignee @me --json number,title,labels,updatedAt 2>/dev/null
```

If it fails: log `source: github skipped (gh unavailable)` and continue. Not fatal.

#### Structured docs (always)

```bash
find docs/superpowers/plans -type f -name '*.md' 2>/dev/null
find docs/superpowers/specs -type f -name '*.md' 2>/dev/null
find docs -type d -name 'adr*' -exec find {} -name '*.md' \; 2>/dev/null
find docs -maxdepth 3 -type f -name '*plan*.md' 2>/dev/null
```

#### Roadmap (always)

```bash
for f in TODO.md ROADMAP.md NEXT.md docs/TODO.md docs/ROADMAP.md BACKLOG.md NOTES.md; do
  test -f "$f" && echo "$f"
done
```

For each file found, parse H2/H3 headers with line spans (shell reads the headers; LLM reads the sections in 1b).

#### Local memory (always)

```bash
test -f .ai/memory/MEMORY.md && echo ".ai/memory/MEMORY.md"
test -f .ai/memory/PROJECT_STATUS.md && echo ".ai/memory/PROJECT_STATUS.md"
find .ai/memory -maxdepth 2 -name '*.md' -not -name 'MEMORY.md' 2>/dev/null
```

Parse `MEMORY.md` as an index (format `[Title](file.md) — hook`). Parse `PROJECT_STATUS.md` (if present) as a dashboard with "Pending" / "Pendente" / "Next steps" / "Próximos passos" sections.

#### Custom paths (`--scan=<path>`)

When the user passes `--scan=<path>[,<path>...]`, walk each path recursively for `*.md` files (cap 200 files per path). This is the escape hatch for projects whose memory/plans conventions don't fit `.ai/memory/` (e.g. `NOTES/`, `~/team-plans/`).

```bash
for path in <user-supplied paths>; do
  find "$path" -type f -name '*.md' 2>/dev/null | head -200
done
```

#### Claude ecosystem (Layer 2 — only if `.claude/` exists)

```bash
REPO_PATH=$(pwd | sed 's|^/|-|; s|/|-|g')
CLAUDE_PROJ_DIR="$HOME/.claude/projects/$REPO_PATH"
test -d "$CLAUDE_PROJ_DIR/memory" && \
  find "$CLAUDE_PROJ_DIR/memory" -maxdepth 1 -name '*.md' -not -name 'MEMORY.md'
```

claude-mem note: use MCP tool `mcp__plugin_claude-mem_mcp-search__search` (deferred) with project filter.

Output of 1a: list of `sources` with `type`, `id`, `last_activity`, `raw`. No content reading yet.

### Phase 1b — LLM extract

Applied only to narrative sources (`doc-plan`, `doc-spec`, `doc-adr`, `roadmap-section`, `memory-local-entry`, `memory-local-orphan`, `memory-claude-auto`, `claude-mem-obs`, `custom-scan-entry`).

Structural sources (`git-branch`, `github-pr-*`, `github-issue-*`, `commit-group`, `git-push-debt`) skip 1b.

For each narrative source, read the content and emit zero or more signal objects:

```yaml
signal:
  source_id: <from 1a>
  source_type: <from 1a>
  topic_hint: <short kebab-case slug>
  evidence_quote: <1-2 verbatim sentences>
  candidate_completion: active | paused | done | unknown
  candidate_shape: plan | initiative              # NEW — see Plan-detection heuristic
  referenced_identifiers: [<branches, paths, slugs mentioned>]
  surfaced_subtopics: [<lateral slugs>]
```

#### Plan-detection heuristic (NEW)

Set `candidate_shape: plan` when the source has **≥ 2 phase headings** matching the regex `^##\s+(F\d+|Phase\s+\d+|Fase\s+\d+)\b`. Otherwise default to `candidate_shape: initiative`.

Phase headings are the load-bearing signal because `decomposePlan()` requires them. Sources with prose pendentes (e.g., a `## Pendente` section listing 7 tasks) stay `initiative` — they don't map to a multi-phase Plan.

Internal instruction (applied by you, LLM):

> "Read this source. For each distinct topic that looks like pending or in-flight work (not general documentation, not retrospective of completed work, not purely learning content), emit a signal with:
> - topic_hint: short kebab-case slug
> - evidence_quote: 1-2 verbatim sentences
> - candidate_completion: active | paused | done | unknown
> - candidate_shape: plan (≥ 2 phase headings) OR initiative (everything else)
> - referenced identifiers (branches, paths, slugs)
> - surfaced_subtopics: lateral slugs mentioned
>
> Skip: general documentation, decisions with no forward action, completed work, pure learnings, style guides, API reference."

A single source can produce multiple signals. Each inherits `last_activity` from the source (or overrides it if the text cites "re-discussed on YYYY-MM-DD").

### Phase 2 — Clustering

Use the functions in `src/bootstrap.js` via `node -e`:

```bash
# Example: group by exact slug
node -e "
import('./src/bootstrap.js').then(({ clusterByExactSlug, mergeFuzzySingletons, pickCanonicalSlug }) => {
  const signals = JSON.parse(process.argv[1]);
  const { clusters, unmatched } = clusterByExactSlug(signals);
  const merged = mergeFuzzySingletons(clusters, unmatched);
  const withCanonical = merged.clusters.map(c => ({ ...c, canonical: pickCanonicalSlug(c) }));
  console.log(JSON.stringify({ clusters: withCanonical, remainingOrphans: merged.remainingOrphans }));
});
" "$(cat /tmp/signals.json)"
```

A cluster's `candidate_shape` is `plan` if ANY of its signals has `candidate_shape: plan` (the plan-shaped signal wins — Plans subsume multiple per-phase signals).

**Remaining orphans** (those that did not match exact slug or fuzzy singleton) go through LLM fallback: you receive `{clusters, orphans}` and ask for each orphan whether it semantically belongs to an existing cluster (confidence ≥ 0.75 to merge). Never merge slug-matched clusters with each other. Record `merge_rationale` for each LLM merge.

### Phase 3 — Synthesize

For each cluster:

1. Call `classifyBucket(cluster, new Date())` → `'strong' | 'worth-reviewing' | 'historical'`.
2. Call `calculateConfidence(cluster)` → score 0–1.
3. **Branch on `candidate_shape`:**
   - `plan` clusters → generate **plan draft** at `.atomic-skills/bootstrap-drafts/<slug>.plan.draft.md`. The draft frontmatter declares `kind: plan` so Phase 4 routes it through `decomposePlan` + `materializeDecomposition`.
   - `initiative` clusters → generate **initiative draft** at `.atomic-skills/bootstrap-drafts/<slug>.draft.md` (existing behavior).
4. Generate drafts using the appropriate template (initiative drafts use `skills/shared/project-status-assets/bootstrap-draft.template.md`; plan drafts also include `source_markdown_path` pointing at the in-repo source so Phase 4 can re-read it for decompose).
5. Historical clusters always go to `archive/<YYYY-MM>-<slug>.draft.md` using `bootstrap-archived.template.md`.
6. For each draft, you (LLM) generate:
   - **Title** (4–8 imperative words)
   - **goal** (one short imperative sentence)
   - **nextAction** (strong = "Resume T-N: ..."; worth-reviewing = question form; historical = null)
   - **rationale** (1–2 lines citing decisive signals)
   - **Context synthesis** (2–3 paragraphs)
7. After all drafts, generate `INDEX.md` using `skills/shared/project-status-assets/bootstrap-index.template.md`.
8. Ask confirmation (intrusive-actions): "Open discover proposal in browser? (y/N)".
9. If `y`: execute `mdprobe .atomic-skills/bootstrap-drafts/INDEX.md 2>/dev/null || npx -y @henryavila/mdprobe .atomic-skills/bootstrap-drafts/INDEX.md`.

### Phase 4 — Commit

Invoked explicitly via `discover --commit` after the user reviews.

Algorithm:

```
1. If .atomic-skills/bootstrap-drafts/ does not exist: error "nothing to commit".
2. List all *.draft.md (initiative) AND *.plan.draft.md (plan), including archive/.
3. For each draft:
   a. Parse frontmatter YAML.
   b. Validate: slug regex, unique vs plans/** + initiatives/**.
   c. Branch on kind:
      - kind=plan → run materializeDecomposition (from src/decompose.js) on the
        source_markdown_path, then write the produced files to .atomic-skills/plans/
        and .atomic-skills/initiatives/.
      - kind=initiative (status=active) → call draftToInitiative(draft, new Date());
        write to .atomic-skills/initiatives/<slug>.md
      - kind=initiative (status=archived) → write to .atomic-skills/initiatives/archive/<YYYY-MM>-<slug>.md
   d. Delete the draft.
   e. On name conflict at destination: log, skip, continue.
4. Update PROJECT-STATUS.md (Active Plans, Active Initiatives, Recently Archived).
5. Write audit log to .atomic-skills/status/bootstrap.json:
   { timestamp, committed: [slugs], skipped: [{slug, reason}], errors: [{slug, error}] }.
6. Report summary: "Committed N (P plans, A active initiatives, H archived), skipped K, errors L".
7. If bootstrap-drafts/ is empty: ask "Remove bootstrap-drafts/? (y/N)". If drafts remain: skip the question, inform "N drafts remain; fix and re-run".
```

## `new <slug>`

1. Validate slug: regex `^[a-z][a-z0-9-]{1,63}$`. Reject with a clear message if invalid.
2. Check for duplicate: if `.atomic-skills/initiatives/<slug>.md` exists, abort with a name suggestion.
3. Ask the user (if not obvious from context):
   - Is this initiative **standalone** or part of an **active plan**? If active plans exist, list them.
   - If part of a plan: which `phaseId` does it represent? (suggest the plan's `currentPhase`).
   - Initial title and goal (one short imperative sentence each).
   - Associated branch (auto-fills with `git branch --show-current` if none provided).
   - Optional `audience` (e.g., "Developer", "Admin user").
4. Copy `skills/shared/project-status-assets/initiative.template.md` to `.atomic-skills/initiatives/<slug>.md`, substituting `REPLACE_*` markers.
5. Handle the **plan-membership-block** in the template:
   - Standalone: delete the entire block including both `# === ... ===` sentinel lines.
   - In-plan: delete the two sentinel comment lines but fill `REPLACE_PARENT_PLAN_SLUG` and `REPLACE_PHASE_ID`.
6. Offer to detect scope automatically: invoke `atomic-skills:project-status detect-scope`; on user accept, write the suggested `scope.paths` into the new initiative.
7. Append row to either "Active Initiatives (standalone)" or under the relevant plan in `.atomic-skills/PROJECT-STATUS.md`.
8. Report to user with the created path.

## `new-task [--target <phaseId>] "<title>" [options]`

Adds a task to an active initiative.

Options:
- `--target <phaseId>` (default: current active initiative). If specified, finds the active initiative whose `phaseId` matches.
- `--blocked-by <task-id>[,<task-id>...]` — sets `blockedBy[]`.
- `--tags <tag>[,<tag>...]` — sets `tags[]`.
- `--verifier-shell "<command>"` — sets `verifier: { kind: shell, command: ... }`.
- `--description "<text>"` — sets `description`.

Steps:
1. Resolve target initiative (current active OR by `--target` phaseId).
2. Generate next task id: scan `tasks[].id`, pick the next `T-NNN` (zero-pad to 3).
3. **Ratify gate**: print the `Proposed mutation:` block (including the drafted `context`). HALT until the user replies `ratify` / pastes an edited context block / `cancel`. Without a ratify reply, do NOT proceed to steps 4+.
4. Build the task object: `{id, title, status: pending, lastUpdated: now, …}`.
5. **MANDATORY**: set `provenance: { surfacedAt: now, surfacedDuring: "<current-initiative-slug>/<current-frame-or-task-id>", surfacedBy: <human|ai> }`. `surfacedBy: human` when the user typed the command directly; `surfacedBy: ai` when the agent surfaced it and the user only ratified.
6. **MANDATORY**: set `context: { solves, trigger, assumesStillValid?, ratifiedAt: now, ratifiedBy: human, lastReviewedAt: now }` — from the ratified block (verbatim if the user typed `ratify`, edited version if they pasted corrections).
7. Append to `tasks[]`, bump initiative `lastUpdated`.
8. Validate against schema. Save file.
9. If `--target` differs from current active initiative, surface a note: "task added to F2 (not the active phase F0)".

## `new-phase <id> "<title>" --after <other-id> [options]`

Inserts a new phase into the active plan. Heavy ritual — creates a new initiative file too.

Options:
- `<id>` — phase id, must be unique. Convention: use `<base>.5` for inserts (`F0.5`), or next integer for appends.
- `<title>` — phase title.
- `--after <other-id>` — the phase this new one depends on. Sets `dependsOn: [<other-id>]`.
- `--parallel-with <id>` — declares parallel pairing.
- `--track <id>` — assigns to a track if the plan has them.
- `--goal "<text>"` — short goal sentence.

Steps:
1. Load the active plan. If no active plan, abort with: "new-phase requires an active plan. Run `atomic-skills:project-plan <slug>` to create one first."
2. Validate `<id>` not in `phases[]`. Validate `--after` references an existing phase id.
3. **Ratify gate**: print the `Proposed mutation:` block with the drafted phase descriptor, the change to `phases[]` order, AND the drafted `context` block. HALT until `ratify` / edited context / `cancel`.
4. On ratify (or edited context):
   - Append phase descriptor to `phases[]` with `provenance: { surfacedAt: now, surfacedDuring: "<current-init>/<task-or-frame>", surfacedBy: <human|ai> }` and `context: { …ratified values…, ratifiedAt: now, ratifiedBy: human, lastReviewedAt: now }`.
   - Create the initiative file `.atomic-skills/initiatives/<plan-slug>-<id>-<slug>.md` from the template, with `status: pending`, `parentPlan: <plan-slug>`, `phaseId: <id>`.
   - Save plan + initiative.
   - Validate both files via `npm run validate-state`.
5. On any validation failure: roll back (delete just-written initiative, revert plan body). Surface errors verbatim.
6. **MANDATORY review**: run `atomic-skills:review-plan --mode=internal` against the updated plan. Surface findings. The user decides on Codex cross-model review per the standard intrusive-actions rule.

## `split-phase <id>`

A phase has grown too big. Split into two — typically `<id>a` and `<id>b`, but the user picks names interactively.

Steps:
1. Load the active plan + the phase's initiative. Show current state: N tasks, growth ratio, parked count.
2. Ask the user: "Split `<id>` into how many sub-phases? Suggest names + which tasks go to each."
3. **Ratify gate** (per new sub-phase): print one `Proposed mutation:` block per new phase being materialized, each with its own drafted context. The user can `ratify` once per phase or `ratify-all` to accept all drafts. `cancel` on any one aborts the entire split (no partial materialization).
4. Materialize the new phases (using `new-phase` semantics — provenance + plan body update + new initiative files), embedding each phase's ratified context.
5. Move tasks between the new initiatives per the user's split. Preserve `provenance` per task; add `originalPhaseId: <id>` to provenance for moved tasks. Moved tasks keep their existing `context` (no re-ratify — the articulation was already done when each task was added).
6. Mark the original phase as `archived` (not `done` — splitting is not completion). Move its initiative to `initiatives/archive/`.
7. Update plan `currentPhase` if it pointed at the split phase: set to the first new sub-phase that is `active` or `pending`.
8. Validate everything. Roll back on any failure.

## `migrate <slug>`

Explicit migration trigger for a legacy initiative.

1. Load `.atomic-skills/initiatives/<slug>.md`. Parse frontmatter.
2. If `schemaVersion === '0.1'`, announce "Already migrated" and exit.
3. Ask the user (intrusive-actions rule):
   > "This file uses the legacy (pre-0.1) format. Migrate now?
   > Choices:
   >   (s) standalone — no parentPlan
   >   (p) under existing plan — pick from list
   >   (n) cancel"
4. On `(s)` or `(p)`: run `src/migrate.js`:`migrateLegacyInitiative(legacy, { parentPlan, phaseId })`. Write the result back.
5. Report: "Migrated `<slug>` to schemaVersion 0.1. Field mapping summary: ..." (show the diff at a high level).
6. If the migrated file has any item where `isMigratedPlaceholder(context)` is true, append: **"<N> parked/emerged items carry placeholder context. Run `re-bootstrap <slug>` to re-articulate them in batch, or `atomic-skills:project-status re-ratify <id>` per item."**
7. Optionally run `npm run validate-state -- .atomic-skills/initiatives/<slug>.md` to confirm.

## `re-bootstrap <slug>`

Re-articulates the `context` of every parked/emerged item still carrying a migration placeholder. Runs after `migrate <slug>` to replace the honest "(migrated from legacy schema) — re-ratify to articulate" stub with a real `solves` / `trigger` / `assumesStillValid` block per item, using evidence gathered from the current project state.

**When to run:** right after `migrate <slug>`, OR any time you want to convert remaining placeholder items into real articulations. Note that `project-status scope-creep` does NOT surface fresh placeholders — its detector ages by `lastReviewedAt` and migration sets that to `now`. Placeholder items appear in `scope-creep` only after they age past `staleContextDays` (default 14). To find them earlier: grep the initiative file for `(migrated from legacy schema)` or check `isMigratedPlaceholder` on each parked/emerged context.

**When NOT to run:** if the initiative has no placeholder items (`isMigratedPlaceholder` returns false for every parked/emerged context), the command exits as a no-op. Re-running on a partially-ratified initiative only prompts the remaining placeholder items — fully idempotent.

### Pre-flight

1. {{READ_TOOL}} `.atomic-skills/initiatives/<slug>.md`. Parse YAML frontmatter.
2. If `schemaVersion !== '0.1'`: abort with "Initiative is legacy. Run `migrate <slug>` first."
3. **Load excludes config.** {{READ_TOOL}} `.atomic-skills/status/config.json` (treat absent file or missing key as empty). Build the effective excludes list:
   ```js
   excludes = ['node_modules', 'dist', '.git', '*.lock']
              .concat(config.reBootstrapExcludes ?? [])
   ```
   Hold `excludes` for use in the per-item evidence step. Dedupe.
4. Build the target list: every `parked[i]` and `emerged[i]` where `isMigratedPlaceholder(context)` (imported from `src/migrate.js`) returns true.
5. If target list empty: announce "No placeholder items to re-articulate." and exit.
6. Print cost preview:
   > "<N> items to re-articulate. Each runs ~3 greps + ~1 git log + ~2 reads + 1 LLM draft.
   > Estimated wall: <N × ~20s>. Estimated $: depends on context, typically <N × ~$0.05>.
   > Proceed? [(y)es / (n)o]"
7. On `(n)`: abort. On `(y)`: continue.

### Per-item loop

For each target item (P-1, P-2, ..., E-1, E-2, ...):

1. **Print header** for the item: `--- P-3 (parked, surfacedAt 2026-05-19) ---` + the full title.

2. **Evidence gathering** (read-only, scoped):
   - Extract keywords from the title using these rules, in priority order:
     - Identifiers in parens (e.g. `(T-005)`, `(F0.G1)`, `(cp4-f-007)`).
     - File paths (regex `[a-zA-Z0-9_/.-]+\.(ts|js|md|sh|yaml|yml|json|tsx)`).
     - CamelCase / kebab-case symbols longer than 4 chars (e.g. `parseInitiativeFile`, `matcher-key`).
     - Stop at 5 keywords max — order by specificity (paths > identifiers > symbols).
   - **Zero-keyword fallback** (when the rules above yield 0 matches):
     - Take the 3 longest non-stopword tokens (≥6 chars) from the title. EN+PT stopwords list: `the, a, an, and, or, but, of, in, on, with, that, this, for, from, after, before, into, onto, over, under, com, para, sem, entre, sobre, antes, depois, ainda, mesmo`.
     - If STILL 0 (title is purely short stopwords, e.g. `'fix bug'`): skip the entire evidence step. Mark every draft field with `[no evidence — title too generic; needs user input]` and proceed directly to step 3.
   - For each keyword (cap 3):
     - {{GREP_TOOL}} recursive in the project root, applying the `excludes` list built in pre-flight step 3. Cap 3 hits per keyword. ({{GREP_TOOL}} takes the pattern as a structured tool arg — no shell interpolation, so any keyword is safe here.)
     - If any hit looks like a file path with extension: {{READ_TOOL}} the first ~80 lines for additional context (cap 2 reads total per item).
   - **Keyword sanitization for {{BASH_TOOL}}** (mandatory before the git log step below): for each keyword, verify it matches `^[A-Za-z0-9._/-]+$`. If it doesn't (contains a quote, `$`, backtick, semicolon, pipe, newline, space, etc.), DROP it from the git log step — adversarial parked/emerged titles could otherwise inject shell commands via the interpolated `--grep` argument.
   - If at least one sanitized keyword remains: {{BASH_TOOL}} `git log --oneline -10 --grep="<top-sanitized-keyword>"` (1 call) to surface commits referencing the topic. **Skip this call when no sanitized keyword remains** (otherwise `git log` with no pattern would dump unrelated commits).

3. **Draft proposal**:
   - Based on title + evidence + surfacedAt, draft:
     - `solves` — 1 sentence problem statement. If evidence is thin (< 2 grep hits and no commits), prepend `[low-confidence draft] ` and ask the user to verify.
     - `trigger` — what caused the item to surface. If surfacedAt is near commits found in `git log`, reference them ("Noticed during commit abc1234"). Otherwise: `[needs user input — agent could not infer trigger from title + project state]`.
     - `assumesStillValid` — at most 1 premise the agent is confident about. If unsure: emit a single stub `[premise stub — edit to record what would invalidate this item]`.

4. **Ratify gate** (HARD halt — never auto-advance, never accept generic "ok"):
   ```
   Proposed re-articulation for P-3 ("4 pre-existing test failures..."):

   solves:           <draft>
   trigger:          <draft>
   assumesStillValid:
     - <draft premise>

   Evidence found (3 hits, 1 commit):
     - tests/zsh-completion-doc-preview.test.sh:42 — "mesh topic completion"
     - tests/menu.test.sh:87 — "BREW_BIN/BREW_PREFIX after 00-core"
     - 7a2f9b1 — "menu test prereq refresh"

   Type ONE OF:
     - `ratify`           apply this draft verbatim
     - <paste edits>      paste a full corrected block; lastReviewedAt advances to now
     - `skip`             keep placeholder; re-run `re-bootstrap` to handle later
     - `cancel-batch`     stop the loop; already-ratified items in this run are kept
   ```
   - HALT until input.
   - A generic `ok` / `sim` / `yes` / `do it` reply is NOT ratify. Treat as the user asking for more specificity — re-prompt.

5. **Apply**:
   - On `ratify`: write the drafted context to the item. Advance `ratifiedAt` and `lastReviewedAt` to now. `ratifiedBy: human`.
   - On `skip`: no write. Continue loop.
   - On `cancel-batch`: stop loop. Items ratified earlier in the run stay saved.
   - On **paste edits**: see the canonical format below.

### Pasted-edit canonical format

The user pastes a YAML-shaped block. Exactly these keys, in any order:

```yaml
solves: <string, ≥8 chars>
trigger: <string, ≥8 chars>
assumesStillValid:
  - <string, ≥4 chars>
  - <string, ≥4 chars>   # 0..N items, omit the key entirely for empty list
```

**Required fields:** `solves`, `trigger`.
**Optional:** `assumesStillValid` (defaults to `[]` when omitted; matches the contextSchema default).
**Forbidden:** any key other than the three above. `ratifiedAt`, `ratifiedBy`, `lastReviewedAt` are NEVER pasted — the command always advances them to now.

**Validation** (mirror `context` schema in `meta/schemas/common.schema.json#/$defs/context`):
- `solves.length >= 8`, otherwise parse failure.
- `trigger.length >= 8`, otherwise parse failure.
- Every item in `assumesStillValid`: `length >= 4`, otherwise parse failure.

**Parse failure behavior** (any of: YAML syntax error, missing required field, length violation, unknown key):
1. Print the specific error: e.g. `"parse failed: missing required field 'trigger'"`.
2. Re-print the canonical example block (above).
3. Re-prompt the user with the SAME four options (`ratify` / paste edits / `skip` / `cancel-batch`). The item is NOT skipped on parse failure.
4. Three consecutive parse failures on the same item: abort the loop with `"too many parse failures on <id>; cancel-batch invoked automatically"`.

### Post-loop

1. Print summary:
   ```
   re-bootstrap <slug> complete:
     ratified:     <R> items
     skipped:      <S> items (still placeholder; re-run to handle them)
     cancelled at: <item id, if any>
   ```
2. If S > 0: remind "Run `re-bootstrap <slug>` or `atomic-skills:project-status re-ratify <id>` to handle the remaining <S> items."
3. If R > 0: bump initiative `lastUpdated` to now. {{WRITE_TOOL}} the updated frontmatter back to `.atomic-skills/initiatives/<slug>.md`.

### Honest limits

- The agent CAN fabricate plausible-but-wrong `solves`. The ratify gate is the only guarantee against this — read every draft before approving.
- `assumesStillValid` is the field most likely to be wrong: it asks "what makes this moot?" and the agent rarely knows the user's mental model. Prefer pasting edits over `ratify` for non-trivial premises.
- The grep-based evidence is project-wide. Old archived branches, vendored code, or generated files can trigger false-positive hits. Defaults exclude `node_modules`, `dist`, `.git`, `*.lock`; extend per-repo via `.atomic-skills/status/config.json:reBootstrapExcludes`.

## Code-quality gates

This skill is bound by the gates in `docs/kb/code-quality-gates.md`. The plan you generate must comply with:

- **G1 read-before-claim** — when the plan asserts what an existing file does (e.g. "the `matcher` function joins on tenant_id"), paste the relevant source lines into the plan body next to the claim. Inferring from the file name is forbidden. This catches what the Phase D contract review found: a plan that contradicts the real code because nobody read it.
- **G2 soft-language ban** — the plan body MUST NOT contain `should`, `probably`, `may`, `typically`, `usually`, `I think`, `it seems`, `in theory`, `tends to`. Convert every such phrase to either a verified statement or an explicit `unverified: <why>` marker. Words like "will" (future tense for tasks you commit to) are fine.
- **G6 reference-or-strike** — every assertion in the plan body or in a task description carries one of: `verified_by: <file:line>`, `verified_by: <command>`, or `unverified: <why>`. A bare claim with no marker is deleted on the next review pass.

## Self-review against gates

After the plan file is written (Stage 6 in the default flow, or after `adopt` materializes), before declaring the plan ready, append a `## Self-review against code-quality gates` block at the end of the plan body:

```markdown
## Self-review against code-quality gates

- **G1 read-before-claim**: N claims about existing code, all backed by pasted source lines (see §X.Y for each). / N/A — plan describes entirely new work, no existing code referenced.
- **G2 soft-language**: scanned the plan for the ban list; M occurrences found and rewritten (changelog: <…>). / 0 occurrences.
- **G6 reference-or-strike**: K assertions, each carries `verified_by:` or `unverified:`. Unverified assertions: <list with reasons>.
```

If any gate is violated, do NOT close the planning session. Either fix the violation inline or write a follow-up task to address it before implementation begins. Silent application is forbidden — the checkpoint must be in the committed plan file.

## Red Flags

If any of these thoughts surfaced, STOP and validate.

- "Skip Stage 6 schema validation; will fix later" — never. Files committed to `.atomic-skills/` must validate against the schemas. Partial state breaks every downstream skill.
- "Generate fake principles when the source plan didn't specify any" — no. If the source has no principles, leave the array empty and add a `## TODO` to the body's §2 — visible omission beats silent fabrication.
- "Decompose without showing the user the structure first" — no. Stage 5 always emits a preview (counts + first 3 phase titles) and waits for explicit confirmation.
- "`adopt` overwrites existing files" — never. `adopt` aborts on any destination collision and points the user at `switch` or a fresh slug.
- "Markdown file is 6,000 lines, but I'll decompose anyway — user said go" — no. Stage 4 surfaces a warning; only proceed after the user re-confirms after seeing the warning.
- "User asked for empty plan, I'll skip the `## TODO` skeletons" — no. Iron Law: every plan ships with a navigable body.

## Rationalization

| Temptation | Reality |
|------------|---------|
| "Just create a plan with empty `phases[]` — user will fill later" | Empty phases never get filled; the skill ends up adding noise to the repo. Stage 5 requires ≥ 1 phase before Stage 6 runs. |
| "Superpowers is overkill for small plans" | Maybe — but the skill still detects it and offers; the user decides. Skipping detection means user never knows the option exists. |
| "I'll skip schema validation; the test suite catches it" | The schema is the contract; skipping it creates initiatives that block `project-status` later. Validate inline, not after the fact. |
| "Markdown decompose can be approximate" | An approximate decompose surfaces fake task IDs the user has to renumber. Heuristics + user confirmation at every level. |
| "`adopt` should be silent — user knows what they're doing" | No. `adopt` is the highest-stakes path (materializes N files at once); always surface the structure preview, always wait for confirmation. |

## Schema reference (quick)

`Plan` (frontmatter):
- `schemaVersion: '0.1'`, `slug`, `title`, `version`, `status` (`active` | `paused` | `archived`)
- `started`, `lastUpdated` (full ISO timestamps with timezone)
- `currentPhase` (id of the active phase), `parallelismAllowed: boolean`
- `principles[]: {id, title, body}`
- `glossary[]: {term, definition}`
- `tracks[]?: {id, title, domain}`
- `phases[]: PhaseDescriptor` (see `meta/schemas/plan.schema.json`)
- `interPhaseGates[]?`, `supersedes?`, `references[]?`

`Initiative` (frontmatter):
- `schemaVersion: '0.1'`, `slug`, `title`, `goal`, `status`
- `branch?`, `started`, `lastUpdated`, `nextAction`
- `parentPlan?` + `phaseId?` (both-or-neither — see the plan-membership-block in `initiative.template.md`)
- `audience?`, `exitGates[]`, `scope?: {paths: []}`
- `stack[]`, `tasks[]`, `parked[]`, `emerged[]`

Both files: markdown body below the frontmatter is the human-readable narrative; the skill never auto-mutates the body.
