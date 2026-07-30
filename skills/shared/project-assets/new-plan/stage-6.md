# Stage 6 — Create Plan + Initiatives

## Contract

BI draft-and-ratify; materialize F0; creation-gates + assert-creation-stage. Advance to `bi-ratified` then `materialized`.

**creation-gates stage target:** `bi-ratified → materialized (+ summaries fields)`

After this stage closes, advance with:

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
GATE=".atomic-skills/status/creation-gates/<project-id>-<slug>.json"
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$GATE" --advance <next-stage> --write
```

Do **not** load other `new-plan/stage-*.md` files while executing this stage.

---

**Single-focus pre-flight (R-FOCUS-01) — at most one active plan per working tree.** The plan you are about to create is `active` and, under always-fork (Decisão 1), gets its own `plan/<slug>` branch + worktree at creation — so it never shares the current tree. What the pre-flight resolves is any **pre-existing** active plan still on `branch: null` (the legacy lazy default) that shares the current tree: detect them with {{BASH_TOOL}} (`status: active` across `.atomic-skills/projects/*/*/plan.md`). If any such legacy plan exists, this is a **concurrent front** and the focus becomes ambiguous — the statusline / `focus.json` cannot tell which plan is "current". Resolve it with {{ASK_USER_QUESTION_TOOL}} **before** materializing the entering plan (which always passes `branch: 'plan/<slug>'`):

Na criação, todo plano — solo ou concorrente — forka incondicionalmente sua própria branch `plan/<slug>` e sua própria worktree. Passe `branch: 'plan/<slug>'` para `materializeDecomposition`, revertendo o padrão preguiçoso anterior de permanecer com `branch: null` no caso solo.

- **Own worktree (parallel — recommended for genuinely parallel work):** create an isolated home per `skills/shared/worktree-isolation.md` (`git worktree add -b plan/<slug> .worktrees/<slug>` when the branch is new; **reuse without `-b`** when `plan/<slug>` already exists). Pass `branch: 'plan/<slug>'`, and stamp a **distinct** `branch:` on any pre-existing active plan that still has `branch: null` (its own `plan/<other-slug>`). Antes de materializar/escrever o plano entrante, capture o source-ref do pré-existente (o ref onde o trabalho dele ainda está, por exemplo `git rev-parse HEAD` na árvore atual) e materialize a worktree retroativa com `retroactiveWorktreeAdd({ slug, baseRef })`, semeada nesse ref capturado — nunca no HEAD pós-mutação, para não vazar artefatos do entrante; o comando nunca usa `--force`. **HALT/re-enter:** after `git worktree add`, `cd` into the new worktree **before** any plan-state write — `git worktree add` does not change CWD (Claude Code hosts may use the native enter-worktree accelerator documented in `worktree-isolation.md` instead of a raw `cd`). Materialization writes **only** inside the worktree declared by frontmatter `branch:` (never leave plan.md in the caller tree while `branch:` names another home). Each active plan then owns a tree → focus resolves per-worktree, no `⧉`.
- **Pause the others (sequential — one front at a time):** set every other active plan to `status: paused` and cascade-pause its `active` phase, exactly as `switch` does (project-transitions.md → `switch`). The entering plan still forks its own `plan/<slug>` (always-fork); pausing the others leaves a single active front.
- **Proceed anyway (accept the drift):** keep the others active on their current branches; the entering plan forks `plan/<slug>` regardless. The `⧉` multi-active marker shows for any other plan still on `branch: null` until it is stamped, and `verify` reports it (§3 branch match).

This is the **soft** form — detect + guided choice, never a silent multi-active; **record the chosen isolation verbatim, never default to "proceed".** The **hard** form (block a 2nd active plan that shares a tree with no distinct `branch:`) is `verify`'s `WARN → FAIL` promotion, the same dry-run→strict ladder as the other gates.

**F0 businessIntent gate (draft-and-ratify; active phase cannot start blank).** Before materializing the active phase, the agent **drafts** the five-field `businessIntent` spine (`value`, `workflow`, `rules`, `outOfScope`, `doneWhen`) from design/source context in the install-configured communication language — the same canonical spine `materialize` uses for F1..N (which may also carry an optional `derived[]` of open-questions, never gated). Present the **Drafted** spine via {{ASK_USER_QUESTION_TOOL}} with options **Aprovar draft** / **Ajustar** / **Cancelar** (or EN equivalents). On adjust, apply corrections and re-present; on cancel, stop before writing state. **Proof-of-work:** generic "ok"/"yes"/"do it" without the five fields visible is not acceptance — re-prompt with the Drafted spine. Reject blank values and `[NEEDS CLARIFICATION]`. Store the ratified object as `<businessIntent>` and pass it into `materializeDecomposition`, so both the F0 plan descriptor and F0 initiative frontmatter carry the same business intent spine from creation. After write, run **presence** `find-missing-business-intent.js` **and quality** `find-weak-business-intent.js` (HARD — rewrite weak fields; no approve-anyway) on the new plan path before declaring Stage 6 complete.

**Creation gate run record (resume / cancel boundary).** Before Stage 6 writes any canonical state file, write `.atomic-skills/status/creation-gates/<project-id>-<slug>.json` with:

```json
{
  "schemaVersion": "0.1",
  "kind": "new-plan",
  "slug": "<slug>",
  "projectId": "<project-id>",
  "sourcePath": "<source.md>",
  "stage": "bi-ratified",
  "businessIntentAccepted": true,
  "filesPlanned": [],
  "filesWritten": [],
  "status": "pending",
  "updatedAt": "<now>"
}
```

Update the record after `materializeDecomposition` returns (`filesPlanned`), before each canonical file write (`filesWritten` gets the path first, then the file is written), after validation (`status: "validated"`), and after the review receipt gate (`status: "ready"`). On `cancel` before the first canonical write, set `status: "cancelled"` and write nothing else. On any failure after a canonical write attempt, delete exactly `filesWritten`, set `status: "rolled-back"` with the verbatim error, and stop. On resume, read this record first: if `status` is `pending` with no `filesWritten`, continue at Stage 6; if `filesWritten` is non-empty and validation/review is incomplete, validate those exact paths or roll them back before continuing. Do not infer a half-created plan by scanning `.atomic-skills/projects/`; the creation gate is the authority.

Materialize the decomposed structure into the **nested** layout. Pass `projectId` to `materializeDecomposition` (it honors `opts.projectId` → nested paths; `opts.stateRoot` defaults to `.atomic-skills`):

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
node "$PKG_ROOT/scripts/decompose-plan.js" materialize \
  --source '<source.md>' \
  --slug '<slug>' \
  --project-id '<project-id>' \
  --branch 'plan/<slug>' \
  --business-intent '<businessIntent-json>'
```

`--business-intent` transports the same object previously passed as
`businessIntent: <businessIntent>`; serialize the ratified five-field spine as
JSON without changing its values.

The returned `{relativePath, content}[]` resolves to:
- `.atomic-skills/projects/<project-id>/<slug>/plan.md` (from `{{ASSETS_PATH}}/plan.template.md`)
- `.atomic-skills/projects/<project-id>/<slug>/phases/f0-<phase-slug>.md` for the initially active F0 initiative (from `{{ASSETS_PATH}}/initiative.template.md`, `parentPlan: <slug>` + `phaseId: F0` filled, plan-membership block kept)
- `.atomic-skills/projects/<project-id>/<slug>/phases/f<N>-<phase-slug>.source.json` for every descriptor-only F1..N phase retained for future `materialize <phase>`

For each entry, `mkdir -p` its parent dir, append the path to `filesWritten` and persist the creation gate, then write the canonical file (plan first, so a failure never orphans phases). Recording the path before the write makes rollback/resume safe if the session is interrupted between write attempts. Then append rows to that project's index `.atomic-skills/projects/<project-id>/PROJECT-STATUS.md` (legacy: top-level `.atomic-skills/PROJECT-STATUS.md`) — the Plan in "Active Plans" and only the materialized F0 initiative under it. Do not add F1+ rows yet; descriptor-only phases become initiative rows only when `materialize <phase>` writes their `.md` file.

**Phase summaries — author + user-validate (post-decompose annotation; decompose.js stays frozen per R-ORCH-10).** For each materialized phase, write a **concise one-line `summary`** of what it does — distinct from the longer technical `goal` — **in the install-configured communication language** (the `manifest.json` `language`; never an ad-hoc choice) — onto BOTH `plan.phases[].summary` (the descriptor, read by the Home timeline) and the phase's initiative `summary` (read by the Home "Agora"). Then **validate them with the user via {{ASK_USER_QUESTION_TOOL}}** before finalizing — present every phase's summary in the message, then ask (e.g. "Os resumos das fases estão coerentes e claros?") with options `Aprovar todos` / `Ajustar alguns`; on adjust, apply the user's corrections and re-confirm. Do NOT finalize the plan on an assumed-OK. The summary is a dev memory-aid AND a check that your decomposition interpretation matches the user's intent — **treat a correction as a signal the phase may be mis-scoped, not just mis-worded** (re-open the decomposition if so). (This is additive — an optional field authored after materialization; it never changes the decompose source format or heuristics.)

**Task summaries — author in the SAME validation gate (one level down).** For each materialized **task**, also write a **concise one-line `summary`** of what it does — distinct from the label `title` and the longer `description` — onto its `tasks[].summary`, **in the install-configured communication language**. Author these together with the phase summaries and present BOTH in the single {{ASK_USER_QUESTION_TOOL}} message above (e.g. group each phase's summary followed by its tasks' summaries), so the user approves the whole decomposition's wording at once (`Aprovar todos` / `Ajustar alguns`). The task summary is what the dashboard Home (Agora) and Initiative-detail tables show per row — a bare id/title reads as noise, the summary makes it actionable. Same additive, post-decompose, decompose.js-frozen discipline as phase summaries. **Guarantee:** before declaring the plan ready, run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-missing-task-summaries.js"` — a non-zero exit means a task slipped through; author + validate the stragglers before finishing.

**Task weight — author in the SAME validation gate (structural proxy).** For each materialized **task**, also write a numeric `weight` (a number ≥ 0; omitted is treated as 1) onto its `tasks[].weight` as a complexity proxy derived from structural signals: number of acceptance items, Files, `scopeBoundary`, and verifier kind. Author these together with the phase/task summaries after decompose output is materialized, and present them in the same validation message so the user approves the decomposition wording and sizing at once. Same additive, post-decompose, decompose.js-frozen (R-ORCH-10) discipline as summaries: do not teach `decompose.js` to infer weight, and do not patch the source format to carry it. **Guarantee:** before declaring the plan ready, run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-unweighted-tasks.js"` — a non-zero exit means a task slipped through; author the stragglers before finishing.

**Completion signal at creation (Component E — soft nudge, raises the detection floor).** A task is auto-detectable as "done in code" only if it carries a deterministic close-signal: a `verifier` OR at least one `outputs[].path`. As you materialize tasks, give each a signal where one is natural (most implementation tasks have an obvious output file or a test). For any task that ends up with **neither**, surface a soft prompt — *"T-00x has no completion signal (verifier or outputs.path); add one so it can be auto-detected as done?"* — and let the user decline (some tasks are genuinely unverifiable; it is a nudge, not a hard gate). **Audit before finishing:** run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-signalless-tasks.js"` (zero-token, exits non-zero, lists offenders) — this is the backfill counterpart to `find-missing-task-summaries.js`. Over a plan's life this keeps the undetectable (`none`) blind spot rare, so `detect-completion` sees almost all real completion.

After writing every file, **normalize then validate**:

```bash
# 0. Ensure every materialized phase has businessIntent on both state surfaces (presence)
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-missing-business-intent.js" .atomic-skills/projects/<project-id>/<slug>/plan.md
# 0b. Quality HARD-BLOCK — rewrite weak fields; do not approve-anyway
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-weak-business-intent.js" .atomic-skills/projects/<project-id>/<slug>/plan.md

# 1. Auto-repair known drift (gate status synonyms, references kind/title,
#    missing required initiative fields). Idempotent; safe to always run.
#    Resolve the script the same way the `status` default view does.
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
if [ ! -f "$PKG_ROOT/src/normalize.js" ]; then
  echo "FAIL runtime: $PKG_ROOT/src/normalize.js is missing; reinstall atomic-skills" >&2
  exit 1
fi
node "$PKG_ROOT/src/normalize.js" "$PWD/.atomic-skills"

# 2. Validate (nested paths; legacy fallback shown in parens).
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js" .atomic-skills/projects/<project-id>/<slug>/plan.md         # (legacy: .atomic-skills/plans/<slug>.md)
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js" .atomic-skills/projects/<project-id>/<slug>/phases/<f0-phase-file>.md         # validate only emitted .md initiatives; .source.json sidecars are capture artifacts
```

If `NORM` is empty (script not resolvable in this repo), apply the normalization rules inline before validating — same rules as the `status` default view STATE_ERROR auto-repair: gate `status` synonyms → `met`/`pending` (never `done` on a gate), `references[]` get a `kind` and `label` (not `title`), missing required **initiative** arrays → `[]` and `branch`/`nextAction` → `null` (never touch plan files this way — they are `.strict()`).

If any file still fails schema validation after normalization, surface the errors and roll back (delete exactly `creationGate.filesWritten`). Do not leave partial state on disk.


## Stage advance (HARD)

After BI is ratified and **before** materialize writes:

```bash
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$GATE" --advance bi-ratified --write
```

After materialize + validate exit 0:

```bash
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$GATE" --advance materialized --write
```

Illegal skips (e.g. slug → ready) **HARD-BLOCK** via non-zero exit from `assert-creation-stage`.
