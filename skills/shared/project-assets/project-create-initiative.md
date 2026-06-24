# project — `new initiative` (lazy detail)

Loaded by the router for `/atomic-skills:project new initiative <slug>` (and the initiative path of the `new` menu, and the disambiguation flow's (c)/(d) branches).

Creates one standalone Initiative, or one anchored to an active plan's phase.

## Pre-flight

- `test -d .atomic-skills/` — if absent, run first-time setup (`{{ASSETS_PATH}}/project-setup.md`) first.
- **Resolve `<project-id>`** (the nested top level), same as `new plan` Initial detection: the lone `.atomic-skills/projects/*/` folder, or ask, or default to `basename "$PWD"`.

In the unified nested layout there is no separate top-level `initiatives/` file. A **standalone** initiative is a *degenerate 1-phase plan*; an **in-plan** initiative is a phase file under its parent plan. Both land under `projects/<project-id>/`.

## Steps

1. Validate slug: regex `^[a-z][a-z0-9-]{1,63}$`. Reject with a clear message if invalid.
2. Check for duplicate: if the resolved target exists — standalone `projects/<project-id>/<slug>/plan.md`, or in-plan `projects/<project-id>/<parent-plan>/phases/f<N>-<slug>.md` (legacy fallback `.atomic-skills/initiatives/<slug>.md`) — abort with a name suggestion.
3. Ask the user (if not obvious from context):
   - Is this initiative **standalone** or part of an **active plan**? If active plans exist, list them.
   - If part of a plan: which `phaseId` does it represent? (suggest the plan's `currentPhase`).
   - Initial title and goal (one short imperative sentence each).
   - A concise one-line **`summary`** (what this phase does — distinct from the longer `goal`), drafted by the agent in the **install-configured communication language** (`manifest.json` `language`) and confirmed by the user. This is the dashboard-visible string (Home "Agora"/timeline); see skills/core/project.md → "Phase summaries".
   - Associated branch (auto-fills with `git branch --show-current` if none provided). **Single-focus pre-flight (R-FOCUS-01):** a standalone initiative is a degenerate *active* plan, so if other active plans already exist this is a concurrent front — apply the same invariant as plan creation (project-create-plan.md → Stage 6 "Single-focus pre-flight"): isolate it in its own `branch: plan/<slug>` + worktree (parallel), pause the others (sequential), or accept the drift with the current branch stamped. Never open a 2nd silent multi-active.
   - Optional `audience` (e.g., "Developer", "Admin user").
4. Materialize from `{{ASSETS_PATH}}/initiative.template.md`, substituting `REPLACE_*` markers. Write the confirmed `summary` onto the initiative frontmatter in every case (and onto the descriptor, below):
   - **Standalone → degenerate 1-phase plan.** Write the initiative as the lone phase at `projects/<project-id>/<slug>/phases/<slug>.md` (`parentPlan: <slug>`, `phaseId: F0`) AND synthesize a minimal `projects/<project-id>/<slug>/plan.md` whose single `phases[0].slug === <slug>` (same shape `src/migrate.js` produces for an orphan — see `project-migrate.md`) — set `phases[0].summary` to the same confirmed line — so `validate-state` cross-validates the pair.
   - **In-plan → phase file.** Write at `projects/<project-id>/<parent-plan>/phases/f<N>-<slug>.md`; add/confirm the matching `phases[]` descriptor on the parent `plan.md`, setting that descriptor's `summary` to the confirmed line.
5. Handle the **plan-membership-block** in the template:
   - Standalone: keep `parentPlan: <slug>` + `phaseId: F0` (it is its own 1-phase plan), delete the two `# === ... ===` sentinel lines.
   - In-plan: delete the two sentinel comment lines but fill `REPLACE_PARENT_PLAN_SLUG` and `REPLACE_PHASE_ID`.
6. Offer to detect scope automatically: run the `detect-scope` flow (see `{{ASSETS_PATH}}/project-transitions.md` § detect-scope); on user accept, write the suggested `scope.paths` into the new initiative.
6b. **Phase-start lessons gate — in-plan phases only (G1, the Spec-2 disposition; HARD gate with explicit override).** A reusable lesson is only "learned" when it changes the next phase's plan (Knoco: *lessons identified ≠ lessons learned*; Easy Agile: tracking open items lifted completion 40%→65%). When this is an **in-plan** phase initiative, surface the prior phases' distillate and force a decision on each before the phase activates:
   - Run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/list-lessons.js" --project <project-id> --plan <parent-plan> --phase <phaseId>` (zero-token; emits only `scope: reusable` + `status: open` lessons whose `appliesTo` admits this phase — push-not-pull, no token bloat). **First phase / no applicable lessons → no-op**, proceed silently.
   - For **each** applicable lesson, disposition via {{ASK_USER_QUESTION_TOOL}} — **Apply** (turn it into a concrete task or exit-gate criterion in THIS initiative — "identified→applied" — e.g. the orphaned-data lesson becomes a data-impact acceptance on the destructive task, per G4), **Keep** (still valid, not yet actionable here → bump `validatedAt`), **Stale** (`status: closed` + a `staleReason` — CUPMem write-time adjudication, the premise no longer holds), or **Reject** (decrement `confidence`; close it at 0 — ExpeL vote). Save the lessons file and `validate-state` it.
   - **The phase does not activate until every applicable lesson is dispositioned**, unless `--skip-lessons` is passed — which records `Lessons review: SKIPPED (<reason>)` in the initiative self-review block (silent skip forbidden, mirroring `--skip-review`). Standalone initiatives (degenerate 1-phase plans) have no prior phase, so this gate is a no-op for them.
7. Append a row under the relevant plan in that project's index `.atomic-skills/projects/<project-id>/PROJECT-STATUS.md` (legacy: top-level `.atomic-skills/PROJECT-STATUS.md`).
8. Validate against schema (`node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js" .atomic-skills/projects/<project-id>/<slug>/` for standalone, or the parent plan + new phase file for in-plan; legacy fallback `.atomic-skills/initiatives/<slug>.md`), normalizing first if needed (same resolver/rules as `new plan` Stage 6). Roll back on failure.
9. Report to user with the created path. The `new` flow seeds the initiative's first stack frame from `initiative.template.md`.

## Emerge hand-off

When the `emerge` flow (`{{ASSETS_PATH}}/project-emergence.md`) offers "Create new initiative now?", it hands off here with the surfaced title/goal pre-filled and `surfacedBy`/provenance carried forward.
