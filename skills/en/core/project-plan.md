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

The source markdown must follow these documented conventions:

1. **Plan title** — the first H1 (`# ...`) becomes `plan.title`. If no H1 exists, the helper records a warning and leaves the title empty — you must fill it before Stage 6.

2. **Plan narrative** — every line between the H1 and the first H2 becomes `plan.narrative` (whitespace-trimmed, joined as-is). The skill writes this as the Plan markdown body's intro paragraph.

3. **Principles** — an H2 whose title (case-insensitive) starts with `principle` (matches `Principles`, `Inviolable principles`, …) becomes the principles section. Each top-level bullet inside it parses as:
   - `**P1 Title** — body`
   - `P1 Title — body`
   - `**Title** — body`
   - `Title — body` / `Title: body` (id auto-assigned `P1`, `P2`, …)

4. **Glossary** — an H2 whose title starts with `glossary` becomes the glossary section. Each bullet parses as `term — definition`, `term – definition`, `term: definition`, or `**term** — definition`.

5. **Phases** — an H2 whose title matches `^(F\d+)\b\s*[-—–]?\s*(.+)?$` becomes a phase. Capture-group 1 (e.g. `F0`) is the `phaseId`; capture-group 2 is the title. Inside that H2:
   - The first line whose trimmed start matches `^(goal|objetivo)\s*:` becomes the phase `goal` (prefix stripped).
   - Every H3 (`### ...`) becomes a task. The H3 line is parsed for an optional leading `T<N>` / `T-NNN` / `T0.1` token; if absent, ids are auto-assigned `T-001`, `T-002`, … within that phase.
   - ` ```yaml ... ``` ` (or `yml`) fenced blocks whose top level declares `exit_gate:` or `exitGate:` (either as an array directly, or with a `criteria:` array inside) parse via the `yaml` npm package and become the phase's exit-gate criteria. Each criterion's `status` is forced to `pending` on initial decompose — the user runs the verifier later via `project-status:phase-done`.

6. **Unrecognized H2** — any other H2 is captured in `warnings`. The decompose does **not** error on unrecognized sections; the user sees the warning during Stage 5 preview and decides whether to keep the section in the plan body, move it, or drop it.

7. **No-phase guard** — if zero H2 sections match the phase pattern, `decomposePlan` throws. A Plan with no phases is invalid per `meta/schemas/plan.schema.json` (`phases.minItems: 1`); failing fast is friendlier than writing invalid state.

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

(Populated by C.T-003. Placeholder so Stages 2-3 have a target to link to.)

Detection:

```bash
test -d "$HOME/.claude/plugins/superpowers" || command -v superpowers >/dev/null 2>&1
```

If available: offer `superpowers:brainstorm` then `superpowers:write-execution-plan`; pipe the resulting markdown through Stage 5.
If not: ask the user for a path to an existing plan file, OR drop a minimal in-skill template into a temp file and have them fill it in.

Either way, the skill never errors when superpowers is absent.

## `adopt <file.md>`

(Populated by C.T-004. Placeholder so the Modes table has a target.)

`adopt` is the retroactive-capture path. Skips Stages 2-4 (no superpowers delegation, no template handoff) and runs only:

1. Validate the input markdown file exists and is readable.
2. Run Stage 5 (decompose) on it.
3. Run Stages 6-7 (materialize + activate first phase).
4. Optionally archive the source file (move to `docs/archive/` with a date prefix).

This is the path the v3-redesign migration uses to materialize the existing 843-line `docs/superpowers/plans/v3-redesign/00-master.md` into structured `.atomic-skills/` state.

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
