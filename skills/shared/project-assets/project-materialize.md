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
- Publish goes through the single authority `scripts/materialize-state.js`
  (recoverable staging + marker; initiative rename first, plan last).
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
   descriptor atomically via `scripts/materialize-state.js`.
7. Run `scripts/find-missing-business-intent.js`.
8. Run `scripts/validate-state.js`.
9. Run `scripts/refresh-state.js`.

## Pre-flight

1. Parse `{{ARG_VAR}}`. If absent, stop and ask for exactly one phase id or slug.
2. Run the standard project initial detection from `skills/core/project.md`.
   Resolve exactly one active plan and read its `plan.md`.
3. Locate the requested phase descriptor by `id` or `slug`. If no descriptor
   matches, stop and print the valid ids/slugs from `phases[]`.
4. For a direct top-level invocation, the requested phase must equal
   `currentPhase`. For an internal transition call (`phase-done`/`switch`/
   `phase-reopen`), the caller passes the selected active phase id set; the
   requested phase must be in that set, which allows parallel-choice activation
   where `currentPhase` points at the first selected phase. Every `dependsOn[]`
   phase must be `done`, and no phase outside the selected active set may remain
   `active` when this command writes. If the current tree still has an unrelated
   active phase, stop and route through `phase-done`, `switch`, or `phase-reopen`
   so the transition demotes/archives the old phase before materializing the
   target.
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
   user-ratified spine before rendering the file content. Also stamp
   `startedCommit` on the initiative frontmatter with the current git HEAD
   (`{{BASH_TOOL}} git rev-parse HEAD`) — the immutable earned-value anchor (C-3)
   that lets `phase-done` compute actuals from a rebase/squash/amend-proof commit
   instead of the fragile `started` committer-date; omit the field silently when
   not a git repo (legacy phases degrade to the date heuristic). The write target
   must be the resolved phase path only; never write outside the active plan's
   state directory.
5. Update the parent plan descriptor for the phase in the same in-memory mutation:
   - set `businessIntent` on the parent plan descriptor;
   - set `subPhaseCount` to `initiative.tasks.length`;
   - set the descriptor `status` to `active`;
   - set `currentPhase` to the phase id;
   - refresh `lastUpdated`.
   Do **not** write either file with sequential `{{WRITE_TOOL}}` calls. The atomic
   publish path is step 6.
6. **Atomic publish via `scripts/materialize-state.js` (single authority).** Write
   the rendered initiative content and the updated plan content to temporary
   staging files on the same filesystem (e.g. under `/tmp` or next to the targets),
   then call the primitive — never sequential live writes:

   `{{BASH_TOOL}} PACKAGE_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)" && node "$PACKAGE_ROOT/scripts/materialize-state.js" --plan .atomic-skills/projects/<project-id>/<plan-slug>/plan.md --initiative .atomic-skills/projects/<project-id>/<plan-slug>/phases/<resolved-phase-file>.md --plan-file <staged-plan.md> --initiative-file <staged-initiative.md>`

   Contract of the primitive (do not reimplement inline):
   - validates the staged pair before publishing a marker;
   - persists a durable marker (`plan.md.materialize-tx.json`) with tx id and
     SHA-256 before/after digests, fsynced before the first rename;
   - renames **initiative first**, **plan last** (no snapshot can show the phase
     `active` without the initiative file);
   - on incomplete tx (marker present), recovers before applying the
     "initiative already exists" guard; retry is safe;
   - fail closed when a live hash is outside `{before, after}` (external write).

   Exit code `0` is required. On non-zero, leave state for recovery (re-run the
   same command or `node "$PACKAGE_ROOT/scripts/materialize-state.js" --recover
   --plan <plan.md>`); do not hand-edit the pair and do not report the phase active.
   The detector runs after a successful publish because it checks the descriptor
   and the materialized initiative together.
7. Run the detector with `{{BASH_TOOL}}`:
   `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-missing-business-intent.js" .atomic-skills/projects/<project-id>/<plan-slug>/plan.md`.
   Pass the parent `plan.md` so unrelated legacy plans cannot block this materialization.
   A tree root (`.atomic-skills` or repo root) is reserved for explicit audits that
   intentionally scan every materialized phase.
   Exit code `0` is required. Any non-zero exit leaves the initiative and plan
   edits open for repair; do not report the phase as active.
8. Run schema validation with `{{BASH_TOOL}}`:
   `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js" .atomic-skills/projects/<project-id>/<plan-slug>/plan.md .atomic-skills/projects/<project-id>/<plan-slug>/phases/<resolved-phase-file>.md`.
   Pass the newly written initiative file explicitly; do not pass the `phases/`
   directory because the validator treats arbitrary directories as discovery
   roots and can skip a bare phase directory.
9. **Task-level guarantees — author + gate (C-2, B1#1, mirrors `new plan`).** Materializing a phase creates its tasks, so — exactly like the F0 eager path (`project-create-plan.md` → "Summaries & level hygiene") — every materialized task must carry a `summary`, a `weight`, and a completion `signal` (`verifier` or `outputs[].path`). Do NOT leave these to a later accidental backfill: DRAFT each task `summary` (+ `weight`) from the sidecar goal/tasks, present for one ratify/edit, and write them onto the initiative content **before** the atomic publish in step 6 (or re-publish via `materialize-state.js` if summaries are ratified after a first publish that omitted them — never sequential dual WRITE of plan+initiative). Then verify with the tree-scoped detectors (`{{BASH_TOOL}}`, run at the repo root — they scan `projects/*/*/phases/*.md`, NOT a single file; passing one phase path returns a vacuous green). The **just-materialized `<resolved-phase-file>` must NOT appear** in their output (unrelated pre-existing debt in other plans is a separate backfill, not a blocker for this phase):
   - `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-missing-task-summaries.js"` — this phase absent from the offender list.
   - `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-unweighted-tasks.js"` — this phase absent.
   - `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-signalless-tasks.js"` — soft nudge only (some tasks are genuinely unverifiable; record the reason rather than forcing a fake signal).
   Then set the initiative `nextAction` (C-5) to the ONE concrete first step — `Run \`done <first-task-id>\` after <its first move>` (G2: a verified imperative, one step) — so a cold session resuming right after materialization reads an accurate pointer, not the template seed. Prefer stamping `nextAction` into the in-memory initiative content before step 6.
10. Run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/refresh-state.js"` so rollups, focus markers, and the statusline digest match the new active phase.

## Failure Handling

- Missing or malformed sidecar: stop and report the exact path. The fix belongs
  to the source-retention flow, not to `materialize`.
- Existing initiative file: stop and report that the phase is already
  materialized. Use `phase-reopen` for a closed materialized phase. When a
  `plan.md.materialize-tx.json` marker is present, re-run
  `scripts/materialize-state.js` (or `--recover`) first — recovery runs before
  the exists guard.
- `materialize-state.js` non-zero (invalid staged pair, ambiguous live hash,
  incomplete recovery): print the script error verbatim; do not sequential-WRITE
  around the primitive.
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
