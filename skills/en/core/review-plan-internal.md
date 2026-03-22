Perform an adversarial analysis of the plan $ARGUMENTS
looking for internal errors, gaps, and inconsistencies.

## Fundamental Rule

NO APPROVAL WITHOUT EVIDENCE.
Each checklist item marked as "ok" MUST have line numbers as proof.
"Seems consistent" without citing where in the plan = item not verified.

## Mindset

Read the plan as if the author were wrong. Your role is to find where
the plan fails, not to confirm that it's good.

CRITICAL: Do Not Trust the Plan.
If you finish the analysis without finding ANY problems, it's more likely
that you missed something than the plan being perfect. In that case, reread
the checklist and force a second, more aggressive pass.

## Checklist

For each item, cite line numbers from the plan that prove the verification.
If you cannot cite line numbers, the item was NOT verified.

1. **Contradictions:** does one task say X while another says Y?
2. **Broken dependencies:** does a task reference a file/model that no task creates?
3. **Ordering:** does any task depend on something not yet done?
4. **Ambiguity:** is any task too vague to implement without guessing?
5. **Schema:** are migrations within the plan consistent with each other?
6. **File lists:** do listed files exist or will they be created by a prior task?
7. **Test coverage:** tasks with new code but no mention of tests?

## Severity -> Action

- **Critical:** blocks implementation — MUST be fixed before proceeding
- **Significant:** causes rework — fix now, not later
- **Minor:** annoying but doesn't break anything — fix if possible, record if not

## Process

### ITERATION 1:
1. Read the entire plan with the Read tool. Apply EACH checklist item.
   For each item, record: status (ok/problem), line numbers verified.
   Fix errors found directly in the plan.

### VERIFICATION LOOP (max 3 iterations):
2. Read the CORRECTED plan from the beginning using the Read tool
   (NOT mental review — execute Read on the file). Cite line numbers.
3. Verify that:
   - The corrections did not introduce new problems
   - No checklist item was missed in the previous pass
4. If new errors were found: fix and go back to step 2.
5. If the reread found nothing new: the loop ends.
6. If you reached 3 iterations and still find problems:
   STOP and escalate to the user — the plan may have structural issues
   that require human decision.

## Red Flags

- "This checklist item seems ok, I don't need to cite line numbers"
- "The plan is clear, I don't need to verify dependencies"
- "I've already read the entire plan mentally, I don't need to use Read again"
- "This error is minor, I can ignore it"
- "I finished without finding anything — the plan is perfect"
- "I'll skip the reread, my corrections are right"

If you thought any of the above: STOP. Go back to the step you were skipping.

## Rationalization

| Temptation | Reality |
|------------|---------|
| "Seems consistent" | Prove with line numbers or it's not verification |
| "I've already verified mentally" | Mental verification doesn't count — execute Read |
| "This item doesn't apply to this plan" | Record explicitly as N/A with justification |
| "The plan is simple, it doesn't need all this" | Simple plans have simple bugs that cause rework |
| "It's already 3 iterations, I'll approve" | If there are still problems, escalate — don't approve with defects |

## Closing

Present the summary in this format:

### Analysis Summary

**Iterations performed:** [N]
**Read calls executed:** [N]
**Total findings:** [N] (critical: X, significant: Y, minor: Z)

| # | Finding | Correction applied | Severity | Iteration |
|---|---------|-------------------|----------|-----------|
| 1 | [summary] | [what was fixed] | critical/significant/minor | 1 |

**Final status:** [Plan approved / Plan with caveats / Escalated to user]
