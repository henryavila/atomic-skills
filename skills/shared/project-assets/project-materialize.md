# project — `materialize <phase>` (lazy detail)

Loaded by the router for `/atomic-skills:project materialize <phase>`.

`materialize` turns one descriptor-only phase of the active plan into a real
phase initiative. It consumes the retained per-phase source sidecar written by
`new plan`/`materializeDecomposition`, asks the user to fill the canonical
`businessIntent` spine, writes the initiative with `writeInitiativeFile`, and
then runs the deterministic businessIntent detector before the phase can become
active.

## Contract

### Inputs

- `{{ARG_VAR}}`: required phase id or phase slug. Accept either `F1`-style id or
  the matching `phases[].slug` from the active plan.
- Active plan: `.atomic-skills/projects/<project-id>/<plan-slug>/plan.md`
  (nested-first, legacy fallback only when the tree is still flat).
- Retained source sidecar: nested
  `.atomic-skills/projects/<project-id>/<plan-slug>/phases/<phase-file>.source.json`;
  legacy flat fallback `.atomic-skills/initiatives/<initiative-slug>.source.json`.

### Output

- One initiative file for the target phase under the resolved `phases/`
  directory, written with the same frontmatter shape as `writeInitiativeFile`
  plus the ratified `businessIntent` spine.
- The parent plan descriptor updated atomically for that phase:
  `businessIntent`, real `subPhaseCount`, `status`, and `currentPhase`.
- A detector-backed gate result: `scripts/find-missing-business-intent.js` exits
  `0` before the command reports the phase as active.

## Required Flow

The command's load-bearing order is fixed:

1. Load retained source sidecar.
2. Run the phase-start lessons gate.
3. Collect the user-written `businessIntent` spine.
4. Reuse `decomposeOnePhase(phaseSource, ctx)` when raw phase body is present;
   otherwise reuse the parsed F2 sidecar capture.
5. Reuse `writeInitiativeFile(initiative, planSlug, ctx)`.
6. Write the initiative with `businessIntent` and update the parent plan
   descriptor atomically.
7. Run `scripts/find-missing-business-intent.js`.
8. Run `scripts/validate-state.js`.
9. Run `scripts/refresh-state.js`.

## Pre-flight

1. Parse `{{ARG_VAR}}`. If absent, stop and ask for exactly one phase id or slug.
2. Run the standard project initial detection from `skills/core/project.md`.
   Resolve exactly one active plan and read its `plan.md`.
3. Locate the requested phase descriptor by `id` or `slug`. If no descriptor
   matches, stop and print the valid ids/slugs from `phases[]`.
4. The requested phase must equal `currentPhase`. Every `dependsOn[]` phase must
   be `done`, and no other phase descriptor or initiative may remain `active`
   when this command writes. If the current tree still has a different active
   phase, stop and route through `phase-done`, `switch`, or `phase-reopen` so the
   transition demotes/archives the old phase before materializing the target.
5. If the phase initiative file already exists, stop: the phase is already
   materialized. Do not overwrite it from the sidecar.
6. Load the retained sidecar for the descriptor. Require
   `captureVersion: "0.1"` and require its `phaseId` to match the descriptor id.
   Treat malformed or missing sidecar data as a hard stop; do not re-parse the
   whole source markdown as a fallback.
7. Run the phase-start lessons gate before activation:
   `{{BASH_TOOL}} node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/list-lessons.js" --project <project-id> --plan <plan-slug> --phase <phase-id>`.
   Apply, keep, stale, or reject every applicable lesson before proceeding, using
   the same disposition semantics as `project-create-initiative.md`.

## BusinessIntent Gate

The user writes the five spine fields. The agent may draft labels and context,
but unknown values stay visibly marked `[NEEDS CLARIFICATION]` until the user
replaces them.

Ask via `{{ASK_USER_QUESTION_TOOL}}` for a single structured block:

```yaml
value: ""
workflow: ""
rules: ""
outOfScope: ""
doneWhen: ""
derived: []
```

Field rules:

- `value` states both business value and customer/user value.
- `workflow` names the operational workflow this phase changes.
- `rules` lists the business rules the implementation must preserve.
- `outOfScope` is a non-goal, not a vague omission.
- `doneWhen` is the phase-level acceptance condition.
- `derived[]` is optional and stores non-authoritative notes derived from the
  source, lessons, or implementation constraints.

Reject the block when any required field is blank or still contains
`[NEEDS CLARIFICATION]`. Re-ask rather than inventing content.

## Materialization Steps

1. Convert the sidecar into the `phaseSource`/initiative object expected by the
   existing F1 helpers; do not duplicate decomposition heuristics.
2. Call `decomposeOnePhase(phaseSource, ctx)` only when the sidecar still holds
   raw `bodyLines`. For the F2 `captureVersion: "0.1"` shape, the sidecar is
   already the parsed per-phase initiative: reuse its `goal`, `tasks`, and
   `exitGates` directly.
3. Call `writeInitiativeFile(initiative, planSlug, ctx)` with `active: true`,
   the active plan branch, the resolved `projectId`, and the same timestamp used
   for the descriptor update.
4. Build the initiative file content and the parent plan descriptor update in
   memory before writing either one. Parse the returned initiative frontmatter
   and add `businessIntent` to the initiative frontmatter with the exact
   user-ratified spine before rendering the file content. The write target must
   be the resolved phase path only; never write outside the active plan's state
   directory.
5. Update the parent plan descriptor for the phase in the same mutation:
   - set `businessIntent` on the parent plan descriptor;
   - set `subPhaseCount` to `initiative.tasks.length`;
   - set the descriptor `status` to `active`;
   - set `currentPhase` to the phase id;
   - refresh `lastUpdated`.
6. Write the returned initiative file with `{{WRITE_TOOL}}` and write the parent
   plan descriptor with the same ratified `businessIntent`. The detector runs
   after both writes because it checks the descriptor and the materialized
   initiative together.
7. Run the detector with `{{BASH_TOOL}}`:
   `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-missing-business-intent.js" .atomic-skills`.
   Do not pass `plan.md` to this detector: its CLI scans a state root (repo root
   or `.atomic-skills`) and discovers nested/flat plans from there.
   Exit code `0` is required. Any non-zero exit leaves the initiative and plan
   edits open for repair; do not report the phase as active.
8. Run schema validation with `{{BASH_TOOL}}`:
   `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js" .atomic-skills/projects/<project-id>/<plan-slug>/plan.md .atomic-skills/projects/<project-id>/<plan-slug>/phases/`.
9. Run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/refresh-state.js"` so rollups, focus markers, and the statusline digest match the new active phase.

## Failure Handling

- Missing or malformed sidecar: stop and report the exact path. The fix belongs
  to the source-retention flow, not to `materialize`.
- Existing initiative file: stop and report that the phase is already
  materialized. Use `phase-reopen` for a closed materialized phase.
- Detector failure: print the detector output verbatim, keep the task unclosed,
  and ask the user to correct the `businessIntent` block.
- Validation failure: print the validator output verbatim and do not advance to
  any transition command.

## Internal Callers

`phase-done`, `switch`, and `phase-reopen` call this same procedure when their
target next phase is descriptor-only. They pass the concrete phase id, then
return to their own transition flow only after this procedure has produced a
validated initiative and detector exit `0`. They do not duplicate the gate or
write their own initiative file.
