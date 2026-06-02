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
   - Associated branch (auto-fills with `git branch --show-current` if none provided).
   - Optional `audience` (e.g., "Developer", "Admin user").
4. Materialize from `{{ASSETS_PATH}}/initiative.template.md`, substituting `REPLACE_*` markers:
   - **Standalone → degenerate 1-phase plan.** Write the initiative as the lone phase at `projects/<project-id>/<slug>/phases/<slug>.md` (`parentPlan: <slug>`, `phaseId: F0`) AND synthesize a minimal `projects/<project-id>/<slug>/plan.md` whose single `phases[0].slug === <slug>` (same shape `src/migrate.js` produces for an orphan — see `project-migrate.md`), so `validate-state` cross-validates the pair.
   - **In-plan → phase file.** Write at `projects/<project-id>/<parent-plan>/phases/f<N>-<slug>.md`; add/confirm the matching `phases[]` descriptor on the parent `plan.md`.
5. Handle the **plan-membership-block** in the template:
   - Standalone: keep `parentPlan: <slug>` + `phaseId: F0` (it is its own 1-phase plan), delete the two `# === ... ===` sentinel lines.
   - In-plan: delete the two sentinel comment lines but fill `REPLACE_PARENT_PLAN_SLUG` and `REPLACE_PHASE_ID`.
6. Offer to detect scope automatically: run the `detect-scope` flow (see `{{ASSETS_PATH}}/project-transitions.md` § detect-scope); on user accept, write the suggested `scope.paths` into the new initiative.
7. Append a row under the relevant plan in that project's index `.atomic-skills/projects/<project-id>/PROJECT-STATUS.md` (legacy: top-level `.atomic-skills/PROJECT-STATUS.md`).
8. Validate against schema (`npm run validate-state .atomic-skills/projects/<project-id>/<slug>/` for standalone, or the parent plan + new phase file for in-plan; legacy fallback `.atomic-skills/initiatives/<slug>.md`), normalizing first if needed (same resolver/rules as `new plan` Stage 6). Roll back on failure.
9. Report to user with the created path. The `new` flow seeds the initiative's first stack frame from `initiative.template.md`.

## Emerge hand-off

When the `emerge` flow (`{{ASSETS_PATH}}/project-emergence.md`) offers "Create new initiative now?", it hands off here with the surfaced title/goal pre-filled and `surfacedBy`/provenance carried forward.
