Bootstrap a multi-phase Plan in `.atomic-skills/plans/<slug>.md` with N child Initiatives + Tasks. Entry point for starting planning work — the "skill silent during planning" gap that the v3-redesign migration set out to close.

This skill is the *creator* counterpart to `project-status` (which is the *manager*). Once a Plan + its initial-phase Initiative are created here, all further work flows through `project-status`.

State files conform to JSON Schemas in `meta/schemas/` (`plan.schema.json`, `initiative.schema.json`, `common.schema.json`). Validate via `npm run validate-state`. Canonical `schemaVersion` is `'0.1'`.

## Iron Law

NO PLAN WITHOUT NARRATIVE.

A bare frontmatter is not a Plan. Every plan created here ships a markdown body with at minimum:
- §1 Context — why this plan exists
- §2 Principles — elaborate frontmatter `principles[]`
- §3 Phase tree — human-readable summary of `phases[]`

If the user pushes back ("just create empty plan"), produce a `## TODO` skeleton for each section instead of skipping it. Empty sections are explicit, not implicit.

## When to invoke

- User describes a multi-phase project ("redo our admin UI", "rebuild the matching engine")
- A free-form plan markdown exists somewhere and needs to be captured — use `adopt`
- A previous `project-status:new` was pushed back as "this is bigger than one initiative" — escalate here

If the user wants a *standalone* initiative (single-phase, < 1 week), defer to `project-status:new` instead.

## Modes

| Mode | Args | Purpose |
|------|------|---------|
| (default) | `<slug>` | Interactive: walk through 7 stages to bootstrap a fresh Plan |
| `adopt` | `<file.md>` | Decompose an existing markdown plan into Plan + Initiatives + Tasks |

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
- Announce:
  - Plan path
  - N initiatives created
  - Active phase: `<F0> — <title>`
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

10. **Activate first phase + announce.** Same as Stage 7 of the default flow:
    - Plan path
    - N initiatives created
    - Active phase: `<F0> — <title>`
    - Suggested next: `atomic-skills:project-status` to view the bird's-eye

### Failure-mode summary

- **Decompose throws (zero phases):** the source file does not match the convention. Surface the message verbatim; abort. Suggest the user run the default flow's Branch B and migrate content into the minimal template.
- **Validation fails after materialize:** roll back (delete files), surface schema errors. The decomposer or materialize logic has a bug — file an initiative against atomic-skills, do NOT manually patch the files.
- **User aborts at step 5:** no files written, no rollback needed. The user can re-run `adopt` with an edited source file.
- **User aborts during step 6 (rare — fs errors):** roll back any files written so far. The repo state must return to pre-`adopt` state on any failure.

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
