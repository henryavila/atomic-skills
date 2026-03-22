Perform an adversarial analysis of the plan $ARGUMENTS
comparing it against its source artifacts (PRD, specs, designs).

## Fundamental Rule

NO APPROVAL WITHOUT CROSS-REFERENCE.
Each requirement from the artifacts must have verifiable correspondence in the plan,
with line numbers from BOTH documents as proof.

<HARD-GATE>
This skill corrects the PLAN, NEVER the source artifacts.
If you find an error in the artifact: record it as "artifact divergence"
and ask the user how to resolve it. DO NOT edit artifacts.
</HARD-GATE>

## Mindset

The artifacts are the source of truth. The plan is the interpretation — and
interpretations frequently lose details, oversimplify, or
add things nobody asked for.

CRITICAL: Do Not Trust the Plan's Coverage.
If the plan says "covers all requirements", prove it. If you cannot
prove it with cross-referenced line numbers, coverage is incomplete.

## Checklist

For each item, cite line numbers from the plan AND the corresponding artifact.
If you cannot cite line numbers from both, the item was NOT verified.

1. **Coverage:** does every FR, NFR, and Story from the artifacts have a task in the plan?
2. **Acceptance criteria:** are tasks oversummarized vs the epics' ACs?
3. **Phase gates:** does each gate criterion from the PRD have a concrete step in the plan?
4. **Dependencies:** does the plan's phase graph match the epics' graph?
5. **Schema/API:** do migrations and endpoints match the architecture doc?
6. **UX:** do components, states, tokens, and responsive match the UX spec?

## Severity -> Action

- **Critical:** missing requirement or contradiction with artifact — MUST be fixed
- **Significant:** partial coverage or excessive simplification — fix now
- **Minor:** naming or formatting difference — record

## Process

### 0. Identify artifacts
Read the plan with the Read tool. Identify all artifacts listed
under "Source Documents", "References", or equivalent.

For EACH artifact, run Read and record:
- Full file path
- Type (PRD, epic, spec, architecture, UX)
- Number of requirements/stories/FRs identified

Present the list before starting the review:
> Artifacts found:
> - `path/to/prd.md` (PRD, 12 FRs, 3 NFRs)
> - `path/to/epic-1.md` (Epic, 5 stories)
> Proceed with the review?

Wait for confirmation. The user may add artifacts the plan did not list.

### ITERATION 1:
1. Apply EACH checklist item crossing plan x artifacts.
   For each item, record: status, plan line numbers, artifact line numbers.
   Fix divergences in the plan. If the divergence is intentional, document
   it as an "alignment note" in the plan itself.

### VERIFICATION LOOP (max 3 iterations):
2. Read the CORRECTED plan with the Read tool. Cite line numbers.
3. Verify that:
   - The corrections did not introduce new problems
   - No requirement from the artifacts was missed
4. If new gaps were found: fix and go back to step 2.
5. If the reread found nothing new: the loop ends.
6. If you reached 3 iterations and still find problems:
   STOP and escalate to the user.

## Red Flags

- "The plan probably covers this, I don't need to check the artifact"
- "This artifact is too long, I'll check it roughly"
- "The names are similar, it must be the same thing"
- "I'll skip the UX spec, the plan is backend"
- "I've already cross-checked mentally, I don't need Read"
- "I'll edit the artifact to make it consistent with the plan"

If you thought any of the above: STOP. Go back to the step you were skipping.

## Rationalization

| Temptation | Reality |
|------------|---------|
| "The plan covers all requirements" | Prove with cross-referenced line numbers |
| "This artifact isn't relevant" | If it was listed as a source, it's relevant — read it |
| "I'll skim the artifact" | Skimming = missing requirements. Full Read |
| "Intentional divergence, no need to document" | If it's not documented, it's not intentional |
| "Editing the artifact is faster" | HARD-GATE: never edit artifacts |

## Closing

### Cross-Reference Analysis Summary

**Artifacts analyzed:** [list with paths]
**Iterations performed:** [N]
**Read calls executed:** [N] (plan: X, artifacts: Y)
**Total findings:** [N] (critical: X, significant: Y, minor: Z)

| # | Finding | Artifact:line | Plan:line | Correction | Severity |
|---|---------|--------------|-----------|------------|----------|
| 1 | [summary] | prd.md:42 | plan.md:108 | [correction] | critical |

**Alignment notes added:** [N]
**Final status:** [Plan approved / Plan with caveats / Escalated to user]
