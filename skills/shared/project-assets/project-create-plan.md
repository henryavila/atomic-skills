# project — `new plan` (bootstrap a multi-phase Plan) (lazy detail)

Loaded by the router for `/atomic-skills:project new plan <slug>` (and the bootstrap path of the `new` menu).

## Iron Law (plan creation)

NO PLAN WITHOUT NARRATIVE.

A bare frontmatter is not a Plan. Every plan created here ships a markdown body with at minimum:
- §1 Context — why this plan exists
- §2 Principles — elaborate frontmatter `principles[]`
- §3 Phase tree — human-readable summary of `phases[]`

If the user pushes back ("just create empty plan"), produce a `## TODO` skeleton for each section instead of skipping it. Empty sections are explicit, not implicit.

## Initial detection

Run with {{BASH_TOOL}}:

- `test -d .atomic-skills/` — if absent, run first-time setup (`{{ASSETS_PATH}}/project-setup.md`). Plan creation assumes the canonical tree exists.
- **Resolve `<project-id>`** (the nested top level): if exactly one `.atomic-skills/projects/*/` folder exists, use it; if several, ask which project the plan belongs to; if none, default to the repo's basename (`basename "$PWD"`) and create `.atomic-skills/projects/<project-id>/`. The plan materializes under that folder.
- Pre-flight collision: `test -f .atomic-skills/projects/<project-id>/<slug>/plan.md` (legacy fallback `test -f .atomic-skills/plans/<slug>.md`) — abort early on collision before any work.

## Default flow — 9 stages

Stages run in order. Each stage gates the next: do not advance past a stage with an unresolved question.

### Stage 1 — Validate slug

- Slug regex: `^[a-z][a-z0-9-]{1,63}$`. Reject with a clear message + suggested fix on mismatch.
- Duplicate check: if `.atomic-skills/projects/<project-id>/<slug>/plan.md` exists (legacy fallback `.atomic-skills/plans/<slug>.md`), abort with a suggested alt-slug (e.g., `<slug>-v2`).
- Reserved slugs (`archive`, `index`) are rejected.

### Stage 2 — DESIGN (brainstorm)

Before any plan is decomposed, the WHAT/WHY + chosen approach must exist as a committed, critic-approved `design.md`. Invoke `atomic-skills:brainstorm` with the user's goal and the `<project-id>`/`<slug>`; it runs the divergent DESIGN front-half (frame → diverge → user ratifies → write → critic gate) and lands `projects/<project-id>/<slug>/design.md`.

Magnitude exemption (R-ORCH-03): the ad-hoc / single-task lanes routed by triage run ZERO gates and skip DESIGN. This multi-phase bootstrap does not.

Full procedure (and the optional superpowers RENT probe) in the **DESIGN integration** section below.

### Stage 3 — Plan input source

With an approved `design.md` in hand, produce the decompose-shaped "source plan" markdown that Stage 5 consumes — seeded from the design's Decisions + Chosen approach, or pointed at an existing markdown, or filled from the minimal template.

Full procedure in the **DESIGN integration** section.

### Stage 4 — Receive markdown plan

Read the source plan (either the file seeded from the approved design, the file the user pointed at, or the in-skill template the user filled in).

**PLAN precondition — refuse without an approved design (R-ORCH-09).** Before decomposing, confirm a committed `design.md` exists for this plan and passes the section lint:

```bash
node scripts/lint-design.js projects/<project-id>/<slug>/design.md
# add --migration when the plan is a one-way-door / migration (requires a Blast radius section)
```

A non-zero exit (missing file, or a missing/empty required section) **HARD-BLOCKS** the plan — do not decompose. Either run `atomic-skills:brainstorm` to produce the design, or, for a lane triage explicitly exempted from DESIGN (ad-hoc / single-task per R-ORCH-03, or `adopt` capturing a pre-lifecycle plan), record that exemption verbatim. PLAN never starts on a design that does not lint clean.

**No-Placeholders precondition — reject authored fill-me markers (R-ORCH-12).** The source plan itself must be free of leftover template/placeholder markers before it can decompose:

```bash
node scripts/lint-source.js <source.md>
```

A non-zero exit — any `REPLACE_*`, `TODO`/`TBD`/`FIXME` sentinel, fuzzy `<path>`-class placeholder, or "similar to Task N" cross-task hand-waving — **HARD-BLOCKS** decompose: **no file is written**. Fix the source and re-run. The gate is deterministic and zero-token (a pure `node` string scan, no LLM call), so it runs identically on every host. Unlike DESIGN, **no lane is exempt** from this one: even the magnitude-exempt single-task lane runs the No-Placeholders lint (R-ORCH-03 — "single-task runs ZERO gates *only* No-Placeholders lint"). It is intentionally narrow — a documented path *variable* like `projects/<id>/<slug>/` is not flagged; only the fixed fuzzy vocabulary (`<path>`, `<file>`, `<dir>`, `<…>`, …) is.

Sanity checks before decomposing:
- File is well-formed markdown (has at least one H1 or H2 header).
- File is < 5,000 lines (anything larger almost certainly contains noise that needs splitting first — surface a warning and ask the user to confirm).
- The file is *outside* the materialized state tree (`.atomic-skills/projects/*/`; legacy `.atomic-skills/plans/`). This skill never decomposes a previously-materialized plan.

If any check fails: surface the specific issue, do not proceed.

### Stage 5 — Decompose

Apply heuristics to extract `Plan` + `Initiatives[]` + `Tasks[]` from the source markdown. **Always** present the resulting structure (count of phases, initiatives, tasks; first 3 phase titles) for user confirmation before any file is written.

Decomposition rules live in the **Markdown decompose** section.

**SPEC per-task admission gate (R-ORCH-19/23).** After the user confirms the structure and before Stage 6 writes anything, run the per-task gate over the same source. The SPEC gate is **No-Placeholders lint + per-task ambiguity checks, no panel** (R-ORCH-19) — no debate, no critic:

```bash
node scripts/lint-source.js <source.md> --spec
```

A non-zero exit means at least one `### Tn` task lacks one of its four HOW fields — **exact paths (`Files:`), a `scopeBoundary:`, `acceptance:` criteria, or a DETERMINISTIC `verifier:`** (`kind shell`/`test`/`query`; `manual` does not satisfy the gate). No task is admitted to implement without all four (R-ORCH-23). Fix the source and re-run; the per-task interior carries into the materialized task's existing schema fields (`description`/`acceptance[≤5]`/`scopeBoundary[]`/`verifier`) — **no new schema keys**. Bullet-mode task lists (a `### Tasks` marker + `- **Tn — …**` bullets) cannot express the interior, so the gate requires the verbose `### Tn` form.

**Data-impact acceptance for DESTRUCTIVE tasks (G4 — SPEC does not admit without it).** A task whose work is *destructive* — it deletes a class/model/table, drops or renames a column, mass-deletes rows, or decommissions a feature (signalled by a `decommission`/`destructive`/`drop`/`delete` tag, or by a title/acceptance that says delete/drop/decommission/remove-model) — has a failure mode that a code-only acceptance cannot see: **data that references the thing by value, not by symbol**. Grep-zero of code references is *necessary but not sufficient* — a deleted `App\Models\AutomaticMail` can still be the live `sender_type` string in 15k polymorphic rows, fatal at read time. So for any destructive task, the SPEC gate requires **at least one `acceptance:` criterion of DATA-impact kind**, not only code-impact: e.g. *"scan polymorphic columns / FKs / enum+string columns for rows referencing the dropped class or value; the affected-row count is measured and its disposition (backfill / purge / block) is decided"*, ideally backed by a `kind: query`/`kind: shell` verifier that counts orphans. A destructive task carrying only code-impact acceptance (grep-zero, no-refs) is **not admitted** — surface it: *"T-00x is destructive but its acceptance only checks code references; add a data-impact criterion (orphan-row scan + disposition) or justify why no stored data can reference it."* The user may attest no data path exists (recorded), but the gate must be *answered*, never skipped silently. This catches the orphaned-data class in the PLAN, not in post-implementation review.

**SPEC-gate exemptions (record verbatim, never silent):** the triage-routed ad-hoc / single-task lanes (R-ORCH-03) and `adopt` (pre-lifecycle capture) skip the per-task SPEC gate — they still run the bare No-Placeholders lint from Stage 4. This default multi-phase bootstrap is never exempt.

### Stage 6 — Create Plan + Initiatives

**Single-focus pre-flight (R-FOCUS-01) — at most one active plan claims a working tree.** The plan you are about to create is `active`. Before materializing, detect other active plans with {{BASH_TOOL}} (`status: active` across `.atomic-skills/projects/*/*/plan.md`). If any already exist, this is a **concurrent front** and the focus becomes ambiguous — the statusline / `focus.json` cannot tell which plan is "current" because they share one working tree. Resolve it with {{ASK_USER_QUESTION_TOOL}} **before** choosing the `branch` value passed to `materializeDecomposition`:

- **Own worktree (parallel — recommended for genuinely parallel work):** create an isolated home per `skills/shared/worktree-isolation.md` (`git worktree add -b plan/<slug> <path>`), pass `branch: 'plan/<slug>'`, and stamp a **distinct** `branch:` on any pre-existing active plan that still has `branch: null` (its own `plan/<other-slug>`). Each active plan then owns a tree → focus resolves per-worktree, no `⧉`.
- **Pause the others (sequential — one front at a time):** set every other active plan to `status: paused` and cascade-pause its `active` phase, exactly as `switch` does (project-transitions.md → `switch`); pass `branch: '<current-branch-or-null>'`. One tree, one focus.
- **Proceed anyway (accept the drift):** keep the others active; pass `branch: '<current-branch>'` (`git symbolic-ref --short HEAD`) so focus has at least a signal. The `⧉` multi-active marker shows until resolved, and `verify` reports it (§3 branch match).

This is the **soft** form — detect + guided choice, never a silent multi-active; **record the chosen isolation verbatim, never default to "proceed".** The **hard** form (block a 2nd active plan that shares a tree with no distinct `branch:`) is `verify`'s `WARN → FAIL` promotion, the same dry-run→strict ladder as the other gates.

Materialize the decomposed structure into the **nested** layout. Pass `projectId` to `materializeDecomposition` (it honors `opts.projectId` → nested paths; `opts.stateRoot` defaults to `.atomic-skills`):

```bash
node -e "
import('./src/decompose.js').then(({ decomposePlan, materializeDecomposition }) => {
  const md = require('node:fs').readFileSync('<source.md>', 'utf8');
  const result = decomposePlan(md, { planSlug: '<slug>' });
  const files = materializeDecomposition(result, { planSlug: '<slug>', projectId: '<project-id>', branch: '<branch-or-null>' });
  console.log(JSON.stringify(files));
});"
```

The returned `{relativePath, content}[]` resolves to:
- `.atomic-skills/projects/<project-id>/<slug>/plan.md` (from `{{ASSETS_PATH}}/plan.template.md`)
- `.atomic-skills/projects/<project-id>/<slug>/phases/f<N>-<phase-slug>.md` per phase (from `{{ASSETS_PATH}}/initiative.template.md`, `parentPlan: <slug>` + `phaseId: <id>` filled, plan-membership block kept)

For each entry, `mkdir -p` its parent dir and write it (plan first, so a failure never orphans phases). Then append rows to that project's index `.atomic-skills/projects/<project-id>/PROJECT-STATUS.md` (legacy: top-level `.atomic-skills/PROJECT-STATUS.md`) — the Plan in "Active Plans", each phase initiative under it.

**Phase summaries — author + user-validate (post-decompose annotation; decompose.js stays frozen per R-ORCH-10).** For each materialized phase, write a **concise one-line `summary`** of what it does — distinct from the longer technical `goal` — **in the install-configured communication language** (the `manifest.json` `language`; never an ad-hoc choice) — onto BOTH `plan.phases[].summary` (the descriptor, read by the Home timeline) and the phase's initiative `summary` (read by the Home "Agora"). Then **validate them with the user via {{ASK_USER_QUESTION_TOOL}}** before finalizing — present every phase's summary in the message, then ask (e.g. "Os resumos das fases estão coerentes e claros?") with options `Aprovar todos` / `Ajustar alguns`; on adjust, apply the user's corrections and re-confirm. Do NOT finalize the plan on an assumed-OK. The summary is a dev memory-aid AND a check that your decomposition interpretation matches the user's intent — **treat a correction as a signal the phase may be mis-scoped, not just mis-worded** (re-open the decomposition if so). (This is additive — an optional field authored after materialization; it never changes the decompose source format or heuristics.)

**Task summaries — author in the SAME validation gate (one level down).** For each materialized **task**, also write a **concise one-line `summary`** of what it does — distinct from the label `title` and the longer `description` — onto its `tasks[].summary`, **in the install-configured communication language**. Author these together with the phase summaries and present BOTH in the single {{ASK_USER_QUESTION_TOOL}} message above (e.g. group each phase's summary followed by its tasks' summaries), so the user approves the whole decomposition's wording at once (`Aprovar todos` / `Ajustar alguns`). The task summary is what the dashboard Home (Agora) and Initiative-detail tables show per row — a bare id/title reads as noise, the summary makes it actionable. Same additive, post-decompose, decompose.js-frozen discipline as phase summaries. **Guarantee:** before declaring the plan ready, run `node scripts/find-missing-task-summaries.js` — a non-zero exit means a task slipped through; author + validate the stragglers before finishing.

**Completion signal at creation (Component E — soft nudge, raises the detection floor).** A task is auto-detectable as "done in code" only if it carries a deterministic close-signal: a `verifier` OR at least one `outputs[].path`. As you materialize tasks, give each a signal where one is natural (most implementation tasks have an obvious output file or a test). For any task that ends up with **neither**, surface a soft prompt — *"T-00x has no completion signal (verifier or outputs.path); add one so it can be auto-detected as done?"* — and let the user decline (some tasks are genuinely unverifiable; it is a nudge, not a hard gate). **Audit before finishing:** run `node scripts/find-signalless-tasks.js` (zero-token, exits non-zero, lists offenders) — this is the backfill counterpart to `find-missing-task-summaries.js`. Over a plan's life this keeps the undetectable (`none`) blind spot rare, so `detect-completion` sees almost all real completion.

After writing every file, **normalize then validate**:

```bash
# 1. Auto-repair known drift (gate status synonyms, references kind/title,
#    missing required initiative fields). Idempotent; safe to always run.
#    Resolve the script the same way the `status` default view does.
NORM=""
for c in "$PWD/src/normalize.js" \
         "$(npm root -g 2>/dev/null)/@henryavila/atomic-skills/src/normalize.js" \
         "$HOME/.atomic-skills/src/normalize.js"; do
  [ -f "$c" ] && NORM="$c" && break
done
[ -n "$NORM" ] && node "$NORM" "$PWD/.atomic-skills"

# 2. Validate (nested paths; legacy fallback shown in parens).
npm run validate-state .atomic-skills/projects/<project-id>/<slug>/plan.md         # (legacy: .atomic-skills/plans/<slug>.md)
npm run validate-state .atomic-skills/projects/<project-id>/<slug>/phases/         # per phase (legacy: .atomic-skills/initiatives/)
```

If `NORM` is empty (script not resolvable in this repo), apply the normalization rules inline before validating — same rules as the `status` default view STATE_ERROR auto-repair: gate `status` synonyms → `met`/`pending` (never `done` on a gate), `references[]` get a `kind` and `label` (not `title`), missing required **initiative** arrays → `[]` and `branch`/`nextAction` → `null` (never touch plan files this way — they are `.strict()`).

If any file still fails schema validation after normalization, surface the errors and roll back (delete the just-written files). Do not leave partial state on disk.

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
- Suggested next: `atomic-skills:project status` to view the bird's-eye

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
     - *Prose mode* (fallback): a line `**Exit gate da fase:** ...` / `**Exit gate:** ...` / `**Gate de saída:** ...` becomes a single criterion with `id: G-1`, `verifier: { kind: 'manual', description: 'Verify exit-gate prose with the user during phase-done.' }`, and the prose as `description`. The user runs the verifier later via `phase-done`.

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

## DESIGN integration (brainstorm)

This section covers Stages 2 and 3 in full. The DESIGN front-half is **owned** by `atomic-skills:brainstorm`; the skill works identically with or without [superpowers](https://github.com/anthropics/superpowers) installed — superpowers is an optional RENT probe for discipline phrasing, not a dependency.

### Stage 2 — Run DESIGN via brainstorm

Invoke `atomic-skills:brainstorm` with the user's goal as the seed and the `<project-id>`/`<slug>` this plan belongs to. brainstorm runs B0–B5 (frame the decision questions → diverge via `atomic-skills:debate --gate` only when ≥2 viable approaches AND the decision is expensive-to-reverse → user ratifies → write `design.md` → critic gate → handoff). It returns a committed `projects/<project-id>/<slug>/design.md` that has passed the section lint, the critic's binary `Approved`, and the user's explicit approval.

If brainstorm was interrupted, or the user already has an approved design, accept an existing `design.md` path instead — it still must pass `node scripts/lint-design.js` before Stage 4 decomposes (the PLAN precondition).

**Optional RENT probe (detect-and-degrade, R-SP-27/28).** superpowers discipline phrasing can enrich the design conversation but is never required. Detect it without blocking, with {{BASH_TOOL}}:

```bash
test -d "$HOME/.claude/plugins/superpowers" \
  || command -v superpowers >/dev/null 2>&1 \
  && echo "superpowers: available (phrasing probe only)" \
  || echo "superpowers: absent — brainstorm owns DESIGN fully"
```

Whatever the result, the DESIGN decision and the `design.md` are produced by `atomic-skills:brainstorm` + the critic — never delegated to superpowers. The probe rents phrasing only and is exempt from the pressure-test budget (R-SP-32, `docs/kb/skill-authoring.md`). If absent, proceed with brainstorm exactly the same — no degradation.

### Stage 3 — Plan input source

Once an approved `design.md` exists, choose the source the decomposer will consume. Present Structured Options:

```
Plan source?
  (a) Seed a decompose-shaped source from the approved design  ← recommended
  (b) I'll paste an existing markdown plan file path
  (c) Give me the minimal template — I'll fill it
```

If `(a)`:
- Translate the design's **Decisions** + **Chosen approach** into the decompose grammar (`## F0/F1` phases + `Goal:` + `### Tn` + fenced `exit_gate` YAML) in a draft source (the throwaway `source.md` / `.atomic-skills/_drafts/<slug>-source.md`). The design is the source of truth; the source markdown is its decompose-ready projection. Use this path for Stage 4.

If `(b)`:
- Ask for the markdown file path. Validate it exists. Skip to Stage 4.

If `(c)` (the minimal-template subflow):

1. Copy `{{ASSETS_PATH}}/minimal-source.template.md` to a temp path inside the repo, e.g. `.atomic-skills/_drafts/<slug>-source.md`. Create the `_drafts/` directory if needed.
2. Tell the user the file path and what sections to fill (title, narrative, principles, glossary, ≥ 1 phase with ≥ 1 task, and each task's four SPEC fields — Files / scopeBoundary / acceptance / verifier). **Fill every section you keep**: the No-Placeholders lint (Stage 4) rejects any leftover `REPLACE_*` marker before decompose, so to omit an optional section (e.g. glossary) *delete it entirely* rather than leaving its `REPLACE_*` markers in place.
3. Wait for the user to confirm they've finished editing. Re-read the file.
4. Use this path as the source-plan path for Stage 4.

The temp source under `.atomic-skills/_drafts/` is not canonical state — delete it after decompose. The installer no longer gitignores `.atomic-skills/`, so if you want the draft kept out of git, idempotently append `.atomic-skills/_drafts/` to `.gitignore` yourself (optional).

> **Nested-layout draft (R-XAGENT-05):** in the `projects/<id>/<slug>/` layout the per-plan source draft lives at `projects/<id>/<slug>/source.md`. `.atomic-skills/` is no longer gitignored by the installer, so this draft is visible to git (verify the actual state with `git check-ignore`) — delete it after decompose (it is a throwaway projection, not canonical state). If you'd rather keep it out of git, idempotently append a `source.md` ignore for its path — append once, never duplicate.

### Failure modes

- **brainstorm not run / no approved design**: the Stage 4 PLAN precondition HARD-BLOCKS (R-ORCH-09). Run `atomic-skills:brainstorm` first; never decompose without an approved, lint-clean `design.md`. The only exceptions are the triage-exempted lanes (ad-hoc / single-task, `adopt`), recorded verbatim.
- **superpowers probe fails / absent**: no effect — brainstorm owns DESIGN. Never silently retry superpowers; never treat its absence as a blocker.
- **User aborts mid-flow**: the skill keeps the design/source files (if any) but does NOT write to `.atomic-skills/`. Resume by re-invoking `new plan <slug>` and pointing at the same source file via option `(b)`.
- **No source and no design**: abort with a clear message — there is nothing to decompose. Suggest running `atomic-skills:brainstorm`, or sketching directly into the minimal template.

The skill never errors out because superpowers is absent — DESIGN is owned internally by `atomic-skills:brainstorm`.

## `adopt <file.md>`

`adopt` is the retroactive-capture path: take an existing markdown plan file the user already wrote (e.g. the 843-line `docs/superpowers/plans/v3-redesign/00-master.md`) and materialize Plan + N Initiatives + Tasks from it. Skips Stages 2–4 (no DESIGN/brainstorm gate, no template handoff — `adopt` captures a plan authored before the lifecycle existed, so it is explicitly exempt from the R-ORCH-09 design precondition) and goes straight from input file to materialized files.

> **Invocation:** `adopt` is a **top-level** verb (`/atomic-skills:project adopt <file.md>`), NOT part of the `new` menu. It is the highest-risk capture path and keeps its own name.

### Step-by-step

1. **Validate the input.** Resolve the path the user passed. Fail with a clear message if:
   - the file does not exist,
   - it is not a regular file (e.g., directory, symlink to nowhere),
   - it does not end in `.md`,
   - it lives under the materialized state tree (`.atomic-skills/projects/*/`; legacy `.atomic-skills/plans/`) — refuse to re-decompose canonical state.

2. **Derive the plan slug.** Default: kebab-case the source file's basename minus extension (e.g., `00-master.md` → `00-master`; ask the user to confirm or override). Apply the slug regex `^[a-z][a-z0-9-]{1,63}$`; reject leading digits by stripping them or prompting for a new slug.

3. **Collision check.** Resolve `<project-id>` (as in the default flow's Initial detection), then pre-flight `test -f .atomic-skills/projects/<project-id>/<slug>/plan.md` (legacy fallback `.atomic-skills/plans/<slug>.md`). Abort on any collision with the proposed plan slug or with any derived phase slug. Point the user at `switch` or a fresh slug.

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

5. **Preview + explicit confirmation.** Show the user the rendered preview (plan title, counts, first 3 phase titles, warnings). Include **cognitive load warnings** for any tasks whose description exceeds `maxTaskDescriptionLines` or whose acceptance criteria exceed `maxTaskAcceptance` (from config.json). **Advisory No-Placeholders surface (R-ORCH-12):** `adopt` is the pre-lifecycle capture path, so the No-Placeholders lint runs **advisorily, not as a hard gate** — run `node scripts/lint-source.js <source-path>` and surface any `REPLACE_*`/`TODO`/fuzzy-path hits as warnings so the user can decide to clean them before or after capture; never block the capture on them. Wait for an explicit `yes` — no implicit confirmation, no "(default y)". `adopt` is the highest-stakes path; always pause here.

6. **Materialize.** On confirmation, run the pure transform:

   ```bash
   node -e "
   import('./src/decompose.js').then(({ decomposePlan, materializeDecomposition }) => {
     const md = require('node:fs').readFileSync('<source-path>', 'utf8');
     const result = decomposePlan(md, { planSlug: '<slug>' });
     const files = materializeDecomposition(result, { planSlug: '<slug>', projectId: '<project-id>', branch: '<branch-or-null>' });
     console.log(JSON.stringify(files));
   });"
   ```

   Then for each `{relativePath, content}` in the returned array (nested `projects/<project-id>/<slug>/{plan.md,phases/…}`), create the parent directory (`mkdir -p`) and write the file. Order does not matter — files are independent — but write the Plan first so failures don't leave orphan initiatives.

7. **Validate.** Run `npm run validate-state .atomic-skills/projects/<project-id>/<slug>/plan.md` and `npm run validate-state .atomic-skills/projects/<project-id>/<slug>/phases/` (legacy fallback `.atomic-skills/plans/<slug>.md` + `.atomic-skills/initiatives/`). On any validation failure, surface the errors verbatim and **roll back** — delete the files just written. Never leave partial state on disk; the manifest invariant is "every file in `.atomic-skills/` validates against its schema".

8. **Update PROJECT-STATUS.md.** Append rows in that project's index `.atomic-skills/projects/<project-id>/PROJECT-STATUS.md` (legacy: top-level `.atomic-skills/PROJECT-STATUS.md`): the Plan to "Active Plans", each phase initiative to its plan's group. (Same content the `status` mutations write — `adopt` does it inline rather than calling out.)

9. **Optional source archive.** Ask: "Archive the source markdown to `docs/archive/<YYYY-MM-DD>-<basename>`? (y/N)". If yes, `git mv` the file (preserves history). If no, leave it in place; the user can repeat `adopt` against an updated copy without conflict because the materialized state is the canonical source from this point forward.

10. **Activate first phase.** Same as Stage 7 of the default flow.

11. **Adversarial review.** Same as Stages 8a + 8b of the default flow — internal review always (apply findings inline), Codex cross-model review prompted to user (y/N). Persist the codex review file to `.atomic-skills/reviews/<…>.md` and link from the plan body's `## Reviews` section.

12. **Announce.** Same as Stage 9 of the default flow:
    - Plan path
    - N initiatives created
    - Active phase: `<F0> — <title>`
    - Reviews: internal (zero findings) + codex (verdict, counts, file) OR (skipped per user)
    - Suggested next: `atomic-skills:project status` to view the bird's-eye

### Failure-mode summary

- **Decompose throws (zero phases):** the source file does not match the convention. Surface the message verbatim; abort. Suggest the user run the default flow's minimal-template subflow (Stage 3 option `(c)`) and migrate content into it.
- **Validation fails after materialize:** roll back (delete files), surface schema errors. The decomposer or materialize logic has a bug — file an initiative against atomic-skills, do NOT manually patch the files.
- **User aborts at step 5:** no files written, no rollback needed. The user can re-run `adopt` with an edited source file.
- **User aborts during step 6 (rare — fs errors):** roll back any files written so far. The repo state must return to pre-`adopt` state on any failure.

## Code-quality gates (plan creation)

This flow is bound by the gates in `docs/kb/code-quality-gates.md`. The plan you generate must comply with:

- **G1 read-before-claim** — when the plan asserts what an existing file does (e.g. "the `matcher` function joins on tenant_id"), paste the relevant source lines into the plan body next to the claim. Inferring from the file name is forbidden.
- **G2 soft-language ban** — the plan body MUST NOT contain `should`, `probably`, `may`, `typically`, `usually`, `I think`, `it seems`, `in theory`, `tends to`. Convert every such phrase to either a verified statement or an explicit `unverified: <why>` marker. Words like "will" (future tense for tasks you commit to) are fine.
- **G6 reference-or-strike** — every assertion in the plan body or in a task description carries one of: `verified_by: <file:line>`, `verified_by: <command>`, or `unverified: <why>`. A bare claim with no marker is deleted on the next review pass.

### Self-review against gates

After the plan file is written (Stage 6, or after `adopt` materializes), before declaring the plan ready, append a `## Self-review against code-quality gates` block at the end of the plan body:

```markdown
## Self-review against code-quality gates

- **G1 read-before-claim**: N claims about existing code, all backed by pasted source lines (see §X.Y for each). / N/A — plan describes entirely new work, no existing code referenced.
- **G2 soft-language**: scanned the plan for the ban list; M occurrences found and rewritten (changelog: <…>). / 0 occurrences.
- **G6 reference-or-strike**: K assertions, each carries `verified_by:` or `unverified:`. Unverified assertions: <list with reasons>.
```

If any gate is violated, do NOT close the planning session. Either fix the violation inline or write a follow-up task to address it before implementation begins. Silent application is forbidden — the checkpoint must be in the committed plan file.

## Red Flags (plan creation)

If any of these thoughts surfaced, STOP and validate.

- "Skip Stage 6 schema validation; will fix later" — never. Files committed to `.atomic-skills/` must validate against the schemas. Partial state breaks every downstream skill.
- "Generate fake principles when the source plan didn't specify any" — no. If the source has no principles, leave the array empty and add a `## TODO` to the body's §2 — visible omission beats silent fabrication.
- "Decompose without showing the user the structure first" — no. Stage 5 always emits a preview (counts + first 3 phase titles) and waits for explicit confirmation.
- "`adopt` overwrites existing files" — never. `adopt` aborts on any destination collision and points the user at `switch` or a fresh slug.
- "Markdown file is 6,000 lines, but I'll decompose anyway — user said go" — no. Stage 4 surfaces a warning; only proceed after the user re-confirms after seeing the warning.
- "User asked for empty plan, I'll skip the `## TODO` skeletons" — no. Iron Law: every plan ships with a navigable body.

## Rationalization (plan creation)

| Temptation | Reality |
|------------|---------|
| "Just create a plan with empty `phases[]` — user will fill later" | Empty phases never get filled; the skill ends up adding noise to the repo. Stage 5 requires ≥ 1 phase before Stage 6 runs. |
| "Superpowers is overkill for small plans" | Maybe — but the skill still detects it and offers; the user decides. Skipping detection means user never knows the option exists. |
| "I'll skip schema validation; the test suite catches it" | The schema is the contract; skipping it creates initiatives that block daily tracking later. Validate inline, not after the fact. |
| "Markdown decompose can be approximate" | An approximate decompose surfaces fake task IDs the user has to renumber. Heuristics + user confirmation at every level. |
| "`adopt` should be silent — user knows what they're doing" | No. `adopt` is the highest-stakes path (materializes N files at once); always surface the structure preview, always wait for confirmation. |
