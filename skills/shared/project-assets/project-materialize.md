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
- The parent plan descriptor updated through the recoverable pair transaction for that phase:
  `summary`, `businessIntent`, real `subPhaseCount`, `status`, and `currentPhase`.
- A detector-backed gate result: `scripts/find-missing-business-intent.js` exits
  `0` before the command reports the phase as active.

## Required Flow

The command's load-bearing order is fixed:

1. Load retained source sidecar.
2. Run the phase-start lessons gate.
3. Collect the user-written `businessIntent` spine.
4. Reuse `decomposeOnePhase(phaseSource, ctx)` when raw phase body is present;
   otherwise reuse the parsed F2 sidecar capture.
5. Author and ratify the phase `summary`, then every task's `summary`, `weight`,
   completion signal, and the initiative `nextAction`. Reuse `writeInitiativeFile(initiative, planSlug, ctx)`.
6. Capture the live plan bytes and their expected plan hash.
   Write the initiative with `businessIntent` and update the parent plan
   descriptor atomically. Route that paired publication through
   `scripts/materialize-state.js` (initiative rename first, plan rename last).
7. Run `scripts/find-missing-business-intent.js`.
8. Run `scripts/validate-state.js`.
9. Run `scripts/refresh-state.js`.

## Pre-flight

Before invoking any package-owned script, resolve one trusted absolute package
root and reuse it for the entire flow:

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || true)"
if [ -z "$PKG_ROOT" ]; then
  CANDIDATE="$PWD"
  if [ -f "$CANDIDATE/package.json" ] && node -e '
    const { readFileSync } = require("node:fs");
    try {
      const pkg = JSON.parse(readFileSync(process.argv[1], "utf8"));
      process.exit(pkg.name === "@henryavila/atomic-skills" ? 0 : 1);
    } catch (_) { process.exit(1); }
  ' "$CANDIDATE/package.json" && [ -f "$CANDIDATE/scripts/materialize-state.js" ]; then
    PKG_ROOT="$CANDIDATE"
  else
    echo "atomic-skills package root unavailable; reinstall atomic-skills before materializing state" >&2
    exit 1
  fi
fi
[ -f "$PKG_ROOT/scripts/materialize-state.js" ] || {
  echo "atomic-skills package root is stale: missing scripts/materialize-state.js" >&2
  exit 1
}
```

The source-checkout fallback is allowed only after both package identity and the
transaction entrypoint are proven. When tool calls do not share a shell, carry
the exact resolved absolute `PKG_ROOT` into the next call; never recompute it
with an unconditional `.` fallback.

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
   When `stateIntegrityHardening.successorBarriers[]` contains the target phase,
   materialization must also receive the full prerequisite close commit emitted
   by the phase close commit guard. The single materialization authority checks
   the configured history receipt, re-reads the prerequisite descriptor from
   that commit, and requires both the live and committed prerequisite to be
   terminal. Missing, stale, skipped, or deferred evidence is a hard stop. This
   barrier is transitive: a later destructive phase cannot bypass a guarded
   predecessor through ordinary dependency activation.
5. Do not perform an inline "initiative already exists" guard. The materialize
   authority must recover any pending transaction marker before applying that
   guard; without a marker, an existing initiative is a hard stop.
6. Load the retained sidecar for the descriptor. Require
   `captureVersion: "0.1"` and require its `phaseId` to match the descriptor id.
   Treat malformed or missing sidecar data as a hard stop; do not re-parse the
   whole source markdown as a fallback.
7. Run the phase-start lessons gate before activation:
   `{{BASH_TOOL}} node "$PKG_ROOT/scripts/list-lessons.js" --project <project-id> --plan <plan-slug> --phase <phase-id>`.
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
3. **Task-level guarantees — author + gate (C-2, B1#1, mirrors `new plan`).**
   First draft the phase's concise one-line `summary` from its title/goal in the
   install-configured communication language, or reuse the descriptor summary
   when it is already non-empty. Present that summary in the same ratify/edit
   gate as the tasks, then put the exact ratified string on BOTH the in-memory
   initiative and the parent descriptor candidate. Materializing a phase creates
   its tasks, so every task must carry a `summary`,
   a `weight`, and a completion signal (`verifier` or `outputs[].path`). DRAFT the
   task fields from the sidecar, present them for one ratify/edit, and put the
   ratified values on the in-memory initiative object. When tasks exist,
   set the initiative `nextAction` to the ONE concrete first step — `Run \`done
   <first-task-id>\` after <its first move>` — before rendering either candidate.
   A valid zero-task phase has `nextAction: null`. Cancellation at this gate
   writes nothing.
4. Read the live parent plan bytes once and compute their SHA-256 as the expected
   plan hash. Build both candidates only from that captured plan version. The
   cross-platform hash command is:
   `{{BASH_TOOL}} node -e "const {createHash}=require('node:crypto');const {readFileSync}=require('node:fs');process.stdout.write(createHash('sha256').update(readFileSync(process.argv[1])).digest('hex'))" .atomic-skills/projects/<project-id>/<plan-slug>/plan.md`.
   Keep the returned hash for the authority call; a changed live plan must abort
   without a marker or live write.
5. Call `writeInitiativeFile(initiative, planSlug, ctx)` with `active: true`,
   the active plan branch, the resolved `projectId`, and the same timestamp used
   for the descriptor update. Build the initiative file content and the parent
   plan descriptor update in memory before publishing either one. Parse the returned initiative frontmatter
   and add `businessIntent` to the initiative frontmatter with the exact
   user-ratified spine before rendering the file content. Also stamp
   `startedCommit` on the initiative frontmatter with the current git HEAD
   (`{{BASH_TOOL}} git rev-parse HEAD`) — the immutable earned-value anchor (C-3)
   that lets `phase-done` compute actuals from a rebase/squash/amend-proof commit
   instead of the fragile `started` committer-date; omit the field silently when
   not a git repo (legacy phases degrade to the date heuristic). The write target
   must be the resolved phase path only; never write outside the active plan's
   state directory.
6. Update the parent plan descriptor for the phase in the same mutation:
   - set `summary` to the exact phase summary ratified for the initiative;
   - set `businessIntent` on the parent plan descriptor;
   - set `subPhaseCount` to `initiative.tasks.length`;
   - set the descriptor `status` to `active`;
   - set `currentPhase` to the phase id;
   - refresh `lastUpdated`.
7. Put the two candidate byte streams in non-live temporary input files, then
   invoke the single materialization authority through the installed package
   root (one command, no sequential live writes):
   `{{BASH_TOOL}} node "$PKG_ROOT/scripts/materialize-state.js" --root . --plan .atomic-skills/projects/<project-id>/<plan-slug>/plan.md --initiative .atomic-skills/projects/<project-id>/<plan-slug>/phases/<resolved-phase-file>.md --plan-candidate <temporary-plan-candidate> --initiative-candidate <temporary-initiative-candidate> --expected-plan-hash <sha256-of-live-plan> --prerequisite-close-sha <full-close-commit-when-configured> --tx-id <unique-tx-id>`.
   The script copies both candidates into same-filesystem staging, validates the
   staged pair before any live mutation, persists and fsyncs its immutable
   recovery marker, then renames the initiative first and the plan last. A
   retry invokes the same command shape; marker recovery runs before the
   existing-initiative guard. The detector runs after the command returns
   because it checks the descriptor and materialized initiative together.
   Omit `--prerequisite-close-sha` only when the target has no configured
   successor barrier; supplying a reviewed commit instead of the prerequisite's
   actual close commit fails because that commit must already contain the
   prerequisite as `done` or `archived`.
8. Run the detectors with `{{BASH_TOOL}}`. They are verification-only after
   publication; no task field or `nextAction` is written here:
   `node "$PKG_ROOT/scripts/find-missing-business-intent.js" .atomic-skills/projects/<project-id>/<plan-slug>/plan.md`.
   Pass the parent `plan.md` so unrelated legacy plans cannot block this materialization.
   A tree root (`.atomic-skills` or repo root) is reserved for explicit audits that
   intentionally scan every materialized phase.
   Exit code `0` is required. Any non-zero exit leaves the initiative and plan
   edits open for repair; do not report the phase as active.
   Then run the tree-scoped task detectors from the repo root. The just-materialized
   `<resolved-phase-file>` must not appear in their output; unrelated legacy debt
   remains a separate backfill:
   - `node "$PKG_ROOT/scripts/find-missing-summaries.js"` (the target phase must be absent from both descriptor and initiative gaps);
   - `node "$PKG_ROOT/scripts/find-missing-task-summaries.js"`;
   - `node "$PKG_ROOT/scripts/find-unweighted-tasks.js"`;
   - `node "$PKG_ROOT/scripts/find-signalless-tasks.js"` (soft nudge only; record why a task is genuinely unverifiable).
9. Run schema validation with `{{BASH_TOOL}}`:
   `node "$PKG_ROOT/scripts/validate-state.js" .atomic-skills/projects/<project-id>/<plan-slug>/plan.md .atomic-skills/projects/<project-id>/<plan-slug>/phases/<resolved-phase-file>.md`.
   Pass the newly written initiative file explicitly; do not pass the `phases/`
   directory because the validator treats arbitrary directories as discovery
   roots and can skip a bare phase directory.
10. Run `node "$PKG_ROOT/scripts/refresh-state.js"` so rollups, focus markers, and the statusline digest match the new active phase.

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
write their own initiative file. This F0 authority covers only the
descriptor-only-to-initiative publication inside `materialize`; reopen,
switch, and close transaction hardening remains outside this primitive.
