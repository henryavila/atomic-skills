# project — `new initiative` (lazy detail)

Loaded by the router for `/atomic-skills:project new initiative <slug>` (and the initiative path of the `new` menu, and the disambiguation flow's (c)/(d) branches).

Creates one standalone Initiative, or one anchored to an active plan's phase.

## Pre-flight

- `test -d .atomic-skills/` — if absent, run first-time setup (`{{ASSETS_PATH}}/project-setup.md`) first.

## Steps

1. Validate slug: regex `^[a-z][a-z0-9-]{1,63}$`. Reject with a clear message if invalid.
2. Check for duplicate: if `.atomic-skills/initiatives/<slug>.md` exists, abort with a name suggestion.
3. Ask the user (if not obvious from context):
   - Is this initiative **standalone** or part of an **active plan**? If active plans exist, list them.
   - If part of a plan: which `phaseId` does it represent? (suggest the plan's `currentPhase`).
   - Initial title and goal (one short imperative sentence each).
   - Associated branch (auto-fills with `git branch --show-current` if none provided).
   - Optional `audience` (e.g., "Developer", "Admin user").
4. Copy `{{ASSETS_PATH}}/initiative.template.md` to `.atomic-skills/initiatives/<slug>.md`, substituting `REPLACE_*` markers.
5. Handle the **plan-membership-block** in the template:
   - Standalone: delete the entire block including both `# === ... ===` sentinel lines.
   - In-plan: delete the two sentinel comment lines but fill `REPLACE_PARENT_PLAN_SLUG` and `REPLACE_PHASE_ID`.
6. Offer to detect scope automatically: run the `detect-scope` flow (see `{{ASSETS_PATH}}/project-transitions.md` § detect-scope); on user accept, write the suggested `scope.paths` into the new initiative.
7. Append row to either "Active Initiatives (standalone)" or under the relevant plan in `.atomic-skills/PROJECT-STATUS.md`.
8. Validate against schema (`npm run validate-state .atomic-skills/initiatives/<slug>.md`), normalizing first if needed (same resolver/rules as `new plan` Stage 6). Roll back on failure.
9. Report to user with the created path. The `new` flow seeds the initiative's first stack frame from `initiative.template.md`.

## Emerge hand-off

When the `emerge` flow (`{{ASSETS_PATH}}/project-emergence.md`) offers "Create new initiative now?", it hands off here with the surfaced title/goal pre-filled and `surfacedBy`/provenance carried forward.
