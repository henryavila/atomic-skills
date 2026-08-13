# project — `new plan` (bootstrap a multi-phase Plan) (thin router)

Loaded by the router for `/atomic-skills:project new plan <slug>` (and the bootstrap path of the `new` menu).

**Fidelity rule (HARD):** this file is a **thin router**. For the current creation stage **N**, {{READ_TOOL}} **only** `{{ASSETS_PATH}}/new-plan/stage-N.md` (e.g. `stage-6.md`). Do **not** preload stage-1..9 at once — more monólito text increases ignore rate.

## Iron Law (plan creation)

NO PLAN WITHOUT NARRATIVE.

A bare frontmatter is not a Plan. Every plan created here ships a markdown body with at minimum:
- §1 Context — why this plan exists
- §2 Principles — elaborate frontmatter `principles[]`
- §3 Phase tree — human-readable summary of `phases[]`

If the user pushes back ("just create empty plan"), produce a `## TODO` skeleton for each section instead of skipping it. Empty sections are explicit, not implicit.

## Initial detection

Run with {{BASH_TOOL}}:

- Apply the resident **Project setup sentinel** from the router that loaded this
  detail. **Configured** → continue; **Legacy coexistence** → stop creation and
  read `{{ASSETS_PATH}}/project-migrate.md` for diagnosis/migration; **Setup
  required** → run `{{ASSETS_PATH}}/project-setup.md` first. Directory,
  manifest, or hook existence alone never skips this gate.
- **Resolve `<project-id>`** (the nested top level): if exactly one `.atomic-skills/projects/*/` folder exists, use it; if several, ask which project the plan belongs to; if none, default to the repo's basename (`basename "$PWD"`) and create `.atomic-skills/projects/<project-id>/`. The plan materializes under that folder.
- Pre-flight collision: `test -f .atomic-skills/projects/<project-id>/<slug>/plan.md` (legacy fallback `test -f .atomic-skills/plans/<slug>.md`) — abort early on collision before any work.
- **Create or resume** `.atomic-skills/status/creation-gates/<project-id>-<slug>.json` (`kind: "new-plan"`, monotonic `stage` starting at `slug`). Resume reads this record first — never infer progress by scanning the destination tree.

## Stage router (1–9)

Stages run in order. Each stage gates the next. After a stage closes, advance with `scripts/assert-creation-stage.js` (illegal skips / early `ready` **HARD-BLOCK**).

Monotonic `stage` enum: `slug → design → source → decompose-confirm → bi-ratified → materialized → summaries → reviews → ready`.

There is **no** `process-map` or `flow` creation stage. Drafting `flow/flow.json` is optional. Ready without flow is legal. Day-2: `project flow`. Leftover gate stage `process-map` reads as `reviews`.

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
GATE=".atomic-skills/status/creation-gates/<project-id>-<slug>.json"
# example: after Stage 1
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$GATE" --advance design --write
# terminal (Stage 9 only, after reviews)
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$GATE" --ready --write
```

| N | Title | Load **only** |
|---|--------|----------------|
| 1 | Stage 1 — Validate slug | `{{ASSETS_PATH}}/new-plan/stage-1.md` |
| 2 | Stage 2 — DESIGN (brainstorm) | `{{ASSETS_PATH}}/new-plan/stage-2.md` |
| 3 | Stage 3 — Plan input source | `{{ASSETS_PATH}}/new-plan/stage-3.md` |
| 4 | Stage 4 — Receive markdown plan | `{{ASSETS_PATH}}/new-plan/stage-4.md` |
| 5 | Stage 5 — Decompose | `{{ASSETS_PATH}}/new-plan/stage-5.md` |
| 6 | Stage 6 — Create Plan + Initiatives | `{{ASSETS_PATH}}/new-plan/stage-6.md` |
| 7 | Stage 7 — Activate first phase | `{{ASSETS_PATH}}/new-plan/stage-7.md` |
| 8 | Stage 8 — Adversarial review (always runs) | `{{ASSETS_PATH}}/new-plan/stage-8.md` |
| 9 | Stage 9 — Announce | `{{ASSETS_PATH}}/new-plan/stage-9.md` |

**Stage 4 (summary — full procedure in stage-4.md):** before decompose, **HARD-BLOCK** unless:

```bash
node "$PKG_ROOT/scripts/lint-design.js" projects/<project-id>/<slug>/design.md
node "$PKG_ROOT/scripts/find-missing-design-process.js" .atomic-skills/status/design-gates/<project-id>-<slug>.json
node "$PKG_ROOT/scripts/find-weak-design.js" projects/<project-id>/<slug>/design.md projects/<project-id>/<slug>/research-digest.md
node "$PKG_ROOT/scripts/lint-source.js" <source.md>
```

R-ORCH-03 exempt lanes (ad-hoc / single-task / `adopt`): pass `--lane` to design detectors; never silent skip.

**Stage 6 (summary — full procedure in stage-6.md):** F0 **businessIntent** is **draft-and-ratify** (agent drafts the five-field spine; user ratifies **Drafted** via {{ASK_USER_QUESTION_TOOL}}). Materialize with `businessIntent: <businessIntent>`; run `find-missing-business-intent` + `find-weak-business-intent`; advance via `assert-creation-stage`.

## `adopt <file.md>` (thin pointer — not the multi-phase stage ladder)

`adopt` is a **top-level** verb (`/atomic-skills:project adopt <file.md>`), NOT part of the `new` menu. It captures a pre-lifecycle plan: **skips Stages 2–4 DESIGN** (R-ORCH-03 / design-exempt), still runs No-Placeholders + draft-and-ratify BI + materialize + Stage 8 reviews.

Full step-by-step (validate → decompose preview → confirm → materialize → validate → announce) lives below in **Reference: adopt procedure** so this path stays complete without inventing novel behavior. Creation gate: `kind: "adopt"`, start stage `bi-ratified` (DESIGN stages not required), then same materialize/reviews/`assert-creation-stage` discipline as Stage 6–9.

## Markdown decompose

Decomposition reads a source markdown file and emits a structured proposal (`{plan, initiatives, warnings}`) for user confirmation. The pure transform lives in `src/decompose.js`:`decomposePlan(markdown, { planSlug })`. The skill body owns the interactive confirmation and the eventual file write (Stage 6); the helper only owns the transform. **Stage 5** loads `new-plan/stage-5.md` for the hot path; this section is the heuristic reference.

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
     - *YAML mode* (preferred): a fenced `yaml`/`yml` block whose top level declares `exit_gate:` or `exitGate:` parses via the `yaml` npm package. Each criterion's `status` is forced to `pending`.
     - *Prose mode* (fallback): a line `**Exit gate da fase:** ...` / `**Exit gate:** ...` / `**Gate de saída:** ...` becomes a single criterion with `id: G-1`, `verifier: { kind: 'manual', description: 'Verify exit-gate prose with the user during phase-done.' }`, and the prose as `description`.

6. **Unrecognized H2** — any other H2 is captured in `warnings`. The decompose does **not** error on unrecognized sections.

7. **No-phase guard** — if zero H2 sections match the phase pattern, `decomposePlan` throws (`phases.minItems: 1`).

8. **Duplicate phase id guard** — if two phase H2s share the same id, `decomposePlan` throws.

9. **Malformed exit_gate YAML** — surfaces a warning instead of swallowing silently.

### Slug derivation

Each phase's initiative slug is derived as `<planSlug>-<phaseId-lowercase>-<phase-title-kebab>` (truncated to 63 chars, must match `^[a-z][a-z0-9-]{1,63}$`). Example: `<sample, F0, "Foundation Repair">` → `sample-f0-foundation-repair`.

### How to invoke (Stage 5)

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
node "$PKG_ROOT/scripts/decompose-plan.js" preview \
  --source '<path-to-source.md>' \
  --slug '<slug>'
```

Always run `previewDecomposition(result)` and display it before any file write. User must explicitly confirm before Stage 6.

## Reference: adopt procedure

`adopt` is the retroactive-capture path: take an existing markdown plan file the user already wrote and materialize Plan + N Initiatives + Tasks from it. Skips Stages 2–4 (no DESIGN/brainstorm gate — `adopt` is explicitly exempt from the R-ORCH-09 design precondition) and goes straight from input file to materialized files.

### Step-by-step

1. **Validate the input.** Resolve the path the user passed. Fail with a clear message if:
   - the file does not exist,
   - it is not a regular file,
   - it does not end in `.md`,
   - it lives under the materialized state tree (`.atomic-skills/projects/*/`; legacy `.atomic-skills/plans/`) — refuse to re-decompose canonical state.

2. **Derive the plan slug.** Default: kebab-case the source file's basename minus extension. Apply the slug regex `^[a-z][a-z0-9-]{1,63}$`.

3. **Collision check.** Resolve `<project-id>`, then pre-flight `test -f .atomic-skills/projects/<project-id>/<slug>/plan.md` (legacy fallback `.atomic-skills/plans/<slug>.md`). Abort on collision.

4. **Decompose.** Run the Stage 5 helper:

   ```bash
   PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
   node "$PKG_ROOT/scripts/decompose-plan.js" preview \
     --source '<source-path>' \
     --slug '<slug>'
   ```

5. **Preview + explicit confirmation + hard No-Placeholders.** Show the rendered preview. Include **cognitive load warnings** for oversized tasks. **No-Placeholders is a hard gate for `adopt` (no advisory bypass):** run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/lint-source.js" <source-path>` and **HARD-BLOCK** on any `REPLACE_*`/`TODO`/fuzzy-path hit. Wait for an explicit `yes` — no implicit confirmation.

5b. **`supersedes` link (when replacing a prior plan).** Persist `supersedes: <prior-slug-or-path>` when applicable.

6. **Materialize.** On confirmation, collect the same F0 `businessIntent` spine as the default flow via **draft-and-ratify** (agent drafts the five fields, user ratifies via {{ASK_USER_QUESTION_TOOL}}). If the user cannot ratify a complete spine, stop before writing state. Then write `.atomic-skills/status/creation-gates/<project-id>-<slug>.json` with `kind: "adopt"`, `sourcePath: "<source-path>"`, `stage: "bi-ratified"`, `businessIntentAccepted: true`, `filesPlanned: []`, `filesWritten: []`, and `status: "pending"`. This is the durable resume boundary for `adopt`: before the first canonical write, `cancel` only marks the gate `cancelled`; after any write, rollback deletes exactly `filesWritten`. Resume reads this record first and never infers progress by scanning the destination tree. Then run the pure transform:

   ```bash
   PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
   node "$PKG_ROOT/scripts/decompose-plan.js" materialize \
     --source '<source-path>' \
     --slug '<slug>' \
     --project-id '<project-id>' \
     --branch '<branch-or-null>' \
     --business-intent '<businessIntent-json>'
   ```

   The CLI option preserves the transform contract
   `businessIntent: <businessIntent>`; serialize the same ratified object as
   JSON rather than rebuilding it in the consumer.

   Then update the creation gate's `filesPlanned` from the returned `{relativePath, content}[]`. For each returned path (nested `projects/<project-id>/<slug>/{plan.md,phases/…}`), create the parent directory (`mkdir -p`), append the path to `filesWritten` and persist the gate, then write the canonical file before proceeding to the next path. Recording the path before the write makes rollback/resume safe if the session is interrupted between write attempts; deleting a recorded-but-never-created path is a no-op, while an unrecorded created file is forbidden. The output is the plan, the materialized F0 `.md`, and F1+ `.source.json` sidecars. Order does not matter — files are independent — but write the Plan first so failures don't leave orphan initiatives.

7. **Validate.** First run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-missing-business-intent.js" .atomic-skills/projects/<project-id>/<slug>/plan.md`; it must exit `0` because F0 is already materialized. Then run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-weak-business-intent.js" .atomic-skills/projects/<project-id>/<slug>/plan.md` — quality HARD-BLOCK; rewrite weak fields, no approve-anyway. This scoped gate checks the plan and F0 initiative just written without blocking on unrelated legacy plans; tree-wide detector runs remain an audit command, not this creation gate. Then run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js" .atomic-skills/projects/<project-id>/<slug>/plan.md` and `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js" .atomic-skills/projects/<project-id>/<slug>/phases/<f0-phase-file>.md` (legacy fallback `.atomic-skills/plans/<slug>.md` + the emitted F0 initiative file). Do not validate the `phases/` directory as a proxy for all phases: descriptor-only F1+ entries are not `.md` initiatives yet, and `.source.json` sidecars are capture artifacts. On any validation failure, surface the errors verbatim and **roll back** — delete the files just written. Never leave partial state on disk; the manifest invariant is "every file in `.atomic-skills/` validates against its schema".

8. **Update PROJECT-STATUS.md.** Append rows in that project's index `.atomic-skills/projects/<project-id>/PROJECT-STATUS.md` (legacy: top-level `.atomic-skills/PROJECT-STATUS.md`): the Plan to "Active Plans" and only the materialized F0 initiative to its plan's group. F1+ descriptor-only phases are visible through `plan.phases[]` and get initiative rows only after `materialize <phase>` writes their `.md` files. (Same content the `status` mutations write — `adopt` does it inline rather than calling out.)

9. **Optional source archive.** Ask: "Archive the source markdown to `docs/archive/<YYYY-MM-DD>-<basename>`? (y/N)". If yes, `git mv` the file (preserves history). If no, leave it in place.

10. **Activate first phase.** Same as Stage 7 (`new-plan/stage-7.md`).

11. **Flow draft (optional, not a gate).** Agent MAY write `flow/flow.json` from design/source/`businessIntent` (never from `phases[]`) and render `flow/flow.html`. Do **not** stop creation for it. Ready without flow is legal. Day-2: `project flow`.

12. **Adversarial review.** Same as Stages 8a + **8a2** + 8b + 8c (`new-plan/stage-8.md`) — internal always, ground-truth specialized, CROSS-MODEL via host default, then `find-unreviewed-plans.js` **and** `find-plans-missing-ground-truth.js` HARD-BLOCK until both receipts exist. Precondition: gate at `summaries` (or remapped `process-map` → `reviews`). Do **not** stop to run `stage-process-map`.

13. **Announce.** Same as Stage 9 (`new-plan/stage-9.md`):
    - Plan path
    - 1 initiative created + N descriptor-only source sidecars retained
    - Active phase: `<F0> — <title>`
    - Reviews: internal + codex OR (skipped per user)
    - Suggested next: `atomic-skills:project status`

### Failure-mode summary

- **Decompose throws (zero phases):** surface verbatim; abort. Suggest Stage 3 option `(c)` minimal template.
- **Validation fails after materialize:** roll back exactly `filesWritten`, mark `rolled-back`.
- **User aborts at step 5:** no files written.
- **User aborts during step 6:** roll back `filesWritten`.

## Code-quality gates (plan creation)

**Enforcement honesty (C-6 — what is deterministic vs. discipline).** Be precise about which of these the tooling actually enforces, so the skill never markets self-review as a machine gate:
- **Deterministic, at authoring time:** the placeholder-literal subset (`REPLACE_*`, sentinel `TODO`/`FIXME`/`TBD`/`WIP`/`HACK`/`XXX`) is caught by `scripts/lint-source.js` (`lintSource`/`lintSpec`), run by this `new plan`/`adopt` flow before the plan is declared ready.
- **Self-review discipline (NOT a `validate-state` check):** G2 soft-language and G6 reference-or-strike are enforced by the self-review block below + the review pass, not by `validate-state.js`.
- **Why SPEC-LINT is not a run-always tree gate:** `materializeDecomposition` intentionally seeds `TODO:` sentinels into descriptor-only F1..N phases (D1 lazy), so a tree-wide `validate-state` spec-lint would false-fail freshly-created plans.

This flow is bound by the gates in `docs/kb/code-quality-gates.md`. The plan you generate must comply with:

- **G1 read-before-claim** — paste source lines next to claims about existing code.
- **G2 soft-language ban** — no `should`/`probably`/`may`/`typically`/`usually`/`I think`/`it seems`/`in theory`/`tends to` without conversion.
- **G6 reference-or-strike** — every assertion carries `verified_by:` or `unverified:`.

**Applies to the runtime state this skill writes too:** `nextAction`, task `description`, and exit-criterion `description` MUST NOT contain G2 hedges; exit-criterion claims carry a `verifier:` or `unverified:`.

### Self-review against gates

After the plan file is written (Stage 6, or after `adopt` materializes), before declaring the plan ready, append a `## Self-review against code-quality gates` block at the end of the plan body:

```markdown
## Self-review against code-quality gates

- **G1 read-before-claim**: N claims about existing code, all backed by pasted source lines (see §X.Y for each). / N/A — plan describes entirely new work, no existing code referenced.
- **G2 soft-language**: scanned the plan for the ban list; M occurrences found and rewritten (changelog: <…>). / 0 occurrences.
- **G6 reference-or-strike**: K assertions, each carries `verified_by:` or `unverified:`. Unverified assertions: <list with reasons>.
- **G10 gate-must-be-able-to-fail**: each exit-criterion states (or can state) its `FAILS when …` — the concrete defect that makes it red. Vanity criteria rewritten or struck. Criteria without a stateable failure: <list, or "none">.
```

If any gate is violated, do NOT close the planning session. Silent application is forbidden — the checkpoint must be in the committed plan file.

## Schema quick-reference (authoritative files: `meta/schemas/`)

> Moved here from the `project` router (resident → lazy): the schema field-reference is consulted when materializing/authoring state, so it lives with the creation flow.

**Plan** (`projects/<project-id>/<plan-slug>/plan.md` frontmatter; legacy flat `plans/<slug>.md`) — required: `schemaVersion` (`'0.1'` from current writers/templates; `'0.2'` accepted for explicit upgrades), `slug`, `title`, `version`, `status`, `started`, `lastUpdated`, `currentPhase` (string|null), `parallelismAllowed` (bool), `phases[]`. Optional: `branch`, `principles[]`, `glossary[]`, `tracks[]`, `interPhaseGates[]`, `supersedes`, `references[]`, `whatStaysValid[]`. Body = `narrative`.
- `PhaseDescriptor`: `id`, `slug`, `title`, `goal`, `dependsOn[]`, `subPhaseCount`, `exitGate {summary, criteria[]}`, `status`. Optional: `summary`, `businessIntent {value, workflow, rules, outOfScope, doneWhen, derived[]}` (the load-bearing spine — authored + gated when the phase materializes; see Stage 6 draft-and-ratify + `materialize`), `parallelWith[]`, `track`, `audience`, `externalImports[]`, `exitGateType`, `provenance`, `context`.
- `ExitCriterion`: `id`, `description`, `status` (`pending`/`met`/`deferred`). Optional: `verifier`, `metAt`, `deferredReason`, `evidence`.
- `ExitCriterionVerifier` (oneOf): `{kind: shell, command, expectExitCode?}` · `{kind: query, sql, expectRowCount?}` · `{kind: test, runner, pattern}` · `{kind: manual, description, demoCommand?, fallbackKind?, steps?, expected?, data?}` (0.2 fields).

**Initiative** (phase file `projects/<project-id>/<plan-slug>/phases/f<N>-*.md`; legacy flat `initiatives/<slug>.md`) — required: `schemaVersion` (`'0.1'` from current writers/templates; `'0.2'` accepted for explicit upgrades), `slug`, `title`, `goal`, `status`, `branch` (string|null), `started`, `lastUpdated`, `nextAction` (string|null), `exitGates[]`, `stack[]`, `tasks[]`, `parked[]`, `emerged[]`. Optional: `parentPlan`, `phaseId` (both-or-neither), `audience`, `scope {paths[]}`, `externalImports[]`, `references[]`, `crossTaskRefs[]`, `tasksDone`/`tasksTotal`/`gatesMet`/`gatesTotal`. Body = `body`.
- `Task`: `id`, `title`, `status` (`pending`/`active`/`done`/`blocked`), `lastUpdated`. Optional: `description`, `summary`, `weight` (number ≥ 0; absent ⇒ treated as 1), `closedAt`, `blockedBy[]`, `outputs[]`, `tags[]`, `resourceCounts`, `scopeBoundary[]`, `acceptance[]` (max 5), `verifier`, `evidence`, `provenance`, `context`.
- `StackFrame`: `id` (int ≥ 1), `title`, `type` (`task`/`research`/`validation`/`discussion`), `openedAt`.
- `CrossTaskRef`: `fromTaskId`, `toInitiativeSlug`, `toTaskId`, `relation` (`depends_on`/`extends`/`unblocks`/`references`). Optional: `note`.

Provenance + context (co-located on every emergent item; schema makes them inseparable):
- `provenance: { surfacedAt, surfacedDuring, surfacedBy, originalPhaseId? }` — `common.schema.json#/$defs/provenance`.
- `context: { solves, trigger, assumesStillValid?, ratifiedAt, ratifiedBy, lastReviewedAt }` — `common.schema.json#/$defs/context`.

You (LLM) can parse frontmatter YAML directly. For edge cases, use the package-owned command that owns the requested mutation. Bump `lastUpdated:` to now (`date -u +%Y-%m-%dT%H:%M:%SZ`) on every mutation.

## Summaries & level hygiene (replicable mechanisms)

> Authored at materialization (Stage 6 / `new-plan/stage-6.md`) and enforced at decompose.

**Phase summaries (replicable, not ad-hoc).** Every phase carries a concise one-line `summary` on BOTH `plan.phases[].summary` and the phase initiative's `summary`. Mechanism: (1) **new plans** author + user-validate at materialization (`new-plan/stage-6.md`); (2) **backfill** — `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-missing-summaries.js"`, then author + {{ASK_USER_QUESTION_TOOL}} validate. **Language: always the install-configured communication language.**

**Task summaries (replicable; the skill ALWAYS generates them).** Detector: `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-missing-task-summaries.js"`. Layers: (1) decompose / Stage 6; (2) mid-execution `new-task`/`promote` (project-emergence.md); (3) drift/backfill via detector.

**Level hygiene — a task is not a phase.** Enforced by `levelConfusedTaskTitle` in `scripts/lint-source.js` (SPEC gate at Stage 5) and `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/lint-task-titles.js"` for materialized state.

## Red Flags (plan creation)

If any of these thoughts surfaced, STOP and validate.

- "Skip Stage 6 schema validation; will fix later" — never. Files committed to `.atomic-skills/` must validate against the schemas.
- "Generate fake principles when the source plan didn't specify any" — no. Visible omission beats silent fabrication.
- "Decompose without showing the user the structure first" — no. Stage 5 always emits a preview and waits for confirmation.
- "`adopt` overwrites existing files" — never. Abort on destination collision.
- "Markdown file is 6,000 lines, but I'll decompose anyway" — no. Stage 4 surfaces a warning; re-confirm after the warning.
- "User asked for empty plan, I'll skip the `## TODO` skeletons" — no. Iron Law.
- "I'll load every stage-N.md at once to save turns" — no. Thin router: only the current `new-plan/stage-N.md`.
- "I'll skip assert-creation-stage and mark the plan ready in prose" — no. Exit code is the gate.

## Rationalization (plan creation)

| Temptation | Reality |
|------------|---------|
| "Just create a plan with empty `phases[]`" | Stage 5 requires ≥ 1 phase before Stage 6. |
| "Superpowers is overkill for small plans" | Optional RENT probe only; brainstorm owns DESIGN. |
| "I'll skip schema validation; tests catch it" | Validate inline; partial state breaks tracking. |
| "Markdown decompose can be approximate" | Heuristics + user confirmation at every level. |
| "`adopt` should be silent" | Highest-stakes path — always preview + confirm. |
| "Skip assert-creation-stage — stages are obvious" | Agents skip prose; exit codes do not. |
