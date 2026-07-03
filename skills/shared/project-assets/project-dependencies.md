# project — plan dependencies (lazy detail)

Loaded by the `project` router for: `depend`, `depend list`, `depend add`, `depend remove`, and `depend resolve`.

This command edits only the canonical operational dependency source: `dependsOnPlans[]` in the dependent plan's `plan.md` frontmatter. It never edits `spawnedFrom` on the child plan and never edits `phases[].spawnedPlans` on the parent phase descriptor; those fields describe origin only.

---

## Grammar

```text
/atomic-skills:project depend list [<plan-slug>] [--project <id>]
/atomic-skills:project depend add <dependent-plan-slug> <prerequisite-plan-slug> [--project <id>]
/atomic-skills:project depend remove <dependent-plan-slug> <prerequisite-plan-slug> [--project <id>]
/atomic-skills:project depend resolve <dependent-plan-slug> <prerequisite-plan-slug> --archived [--project <id>]
```

Parse the subcommand and slugs from `{{ARG_VAR}}`.

- `dependent-plan-slug` is the blocked plan whose frontmatter owns `dependsOnPlans[]`.
- `prerequisite-plan-slug` is the plan that must release the dependent.
- Edges are project-local only. Both slugs must resolve under the same `.atomic-skills/projects/<project-id>/` folder. A slug found in another project is treated as cross-project and the command stops.
- `createdBy: manual` is used for `depend add`. Manual edges do not carry `origin`; the schema rejects manual edges with origin data.
- `release.archived` is written as `blocked` on add and changed to `resolved` only by `depend resolve ... --archived`.

## Shared preflight

Before `add`, `remove`, or `resolve`, run the router's pre-mutation gates from `skills/core/project.md`. `list` is read-only and skips those gates.

Then resolve project scope:

1. Parse optional `--project <id>`.
2. Enumerate nested project folders first: `.atomic-skills/projects/<project-id>/`, considering only immediate plan directories that contain `plan.md`.
3. If `--project <id>` was supplied, restrict all resolution to that folder. If it does not exist, print `unknown project: <id>` and stop without writing.
4. If `--project` was omitted and exactly one nested project contains all referenced plan slugs (or, for `depend list`, contains the requested slug or has at least one plan when no slug is provided), use it.
5. If `--project` was omitted and more than one nested project is a possible target, ask the user to rerun with `--project <id>` and list the candidate project ids. Do not write.
6. If no nested project can satisfy the command, fall back to the legacy flat `.atomic-skills/plans/<slug>.md` layout.
7. Resolve both slugs in the same project folder or flat fallback.
8. If either slug is missing, print the missing slug and stop without writing.
9. If the same slug resolves in a different project folder than the selected one, print `cross-project plan dependencies are not supported; rerun with --project <id> to target one project` and stop without writing.
10. If dependent equals prerequisite, stop without writing.

After any write, run with {{BASH_TOOL}}:

```bash
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js"
```

If validation reports an unknown prerequisite, self-dependency, or dependency cycle, revert only the dependency edit made by this command and report the validation error.

## `depend list`

Read every plan in the resolved nested project (or legacy flat fallback), build the graph with `src/plan-dependencies.js`, and print:

- Manual and `fork-plan` edges from `dependencyEdges`, grouped by dependent plan.
- Current blockers from `blockedByPlans[plan]`.
- Inverse impact from `unblocksPlans[plan]`.
- Graph errors from `errors`, if any.

When a plan slug is provided, filter output to that plan as dependent or prerequisite. `depend list` never mutates state.

## `depend add`

Add a manual edge from dependent to prerequisite. Use the idempotent writer in `src/links-sidecar.js`; do not append YAML by hand.

Run with {{BASH_TOOL}} from the repo root, substituting the resolved dependent plan directory and prerequisite slug:

```bash
node --input-type=module -e "import { addPlanDependency } from './src/links-sidecar.js'; addPlanDependency(process.argv[1], { plan: process.argv[2], createdBy: 'manual', release: { archived: 'blocked' } });" "$dependentPlanDir" "$prerequisiteSlug"
```

`addPlanDependency` validates the edge against `meta/schemas/plan.schema.json#/$defs/planDependency`, preserves the plan body, and dedupes by `plan + origin.phaseId + origin.taskId + createdBy`. For a manual edge that identity collapses to `prerequisite + manual`, so re-running the command is a no-op.

After the write, run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js"`. If it passes, print the edge as:

```text
plan <dependent> now depends on plan <prerequisite> (release.archived: blocked)
```

## `depend remove`

Remove the matching operational edge from the dependent plan's `dependsOnPlans[]`.

Rules:

- Match by `plan` and, when the caller supplies a future selector, by the same operational identity used by `addPlanDependency`.
- If no edge matches, print `no matching dependsOnPlans[] edge` and stop successfully.
- Removing an edge never edits `spawnedFrom` or `phases[].spawnedPlans`; origin history remains intact.
- If removing the final edge, remove `dependsOnPlans` entirely from frontmatter instead of leaving an empty array.

Use the same parser/serializer pattern as `src/links-sidecar.js` (`parseFrontmatter` plus YAML stringify), so the markdown body is preserved. Then run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js"`.

## `depend resolve`

`resolve` records the explicit decision that an archived prerequisite releases a dependent plan.

Only this form is valid:

```text
/atomic-skills:project depend resolve <dependent-plan-slug> <prerequisite-plan-slug> --archived
```

Rules:

- Require an existing matching edge in `dependsOnPlans[]`; do not create a new edge during resolve.
- Set `release.archived: resolved` on that edge and preserve every other field.
- If the edge already has `release.archived: resolved`, print the current state and stop successfully.
- Do not mark the prerequisite `done` and do not change plan statuses. The transition layer reads `release.archived: resolved` and releases the blocker when the prerequisite status is `archived`.

An archived prerequisite remains blocking until this edge-level value exists. `release.archived: blocked` is the default for absent release metadata and the explicit state written by `depend add`.
