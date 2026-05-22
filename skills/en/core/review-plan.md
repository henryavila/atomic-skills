Perform an adversarial analysis of the plan {{ARG_VAR}}
looking for internal errors, gaps, and inconsistencies. Optionally
cross-reference against source artifacts (PRD, specs, designs) when the
Step 0 confirmation selects that mode.

## Iron Law

NO APPROVAL WITHOUT EVIDENCE.
Each checklist item marked as "ok" MUST have line numbers as proof.
"Seems consistent" without citing where in the plan = item not verified.
When cross-ref mode is active: line numbers from BOTH plan AND artifact.

## Mindset

{{READ_TOOL}} the plan as if the author were wrong. Your role is to find
where the plan fails, not to confirm that it's good.

CRITICAL: Do Not Trust the Plan.
If you finish the analysis without finding ANY problems, it's more likely
that you missed something than the plan being perfect. In that case,
re-read the checklist and force a second, more aggressive pass.

When the active mode is `cross-ref`, the artifacts are the source of
truth — the plan is the interpretation, and interpretations frequently
lose details, oversimplify, or add things nobody asked for.

## Step 0 — Detect and confirm scope

1. {{READ_TOOL}} the plan file at {{ARG_VAR}}.
2. Scan for sections matching `^##? (Source Documents|References|Artifacts|Inputs|Originated From|Based On)` (regex case-insensitive). Under each, extract bullet/link tokens and CLASSIFY each one:
   - **LOCAL PATH** (relative or absolute filesystem path that resolves to a readable file): keep in the `detected_artifacts` list.
   - **URL** (anything matching `^https?://` or `^//`): DO NOT include in `detected_artifacts`. Record it in a `links_seen` list shown to the user as "URL artifacts not auto-fetched — provide local copies if you want cross-ref coverage."
   - **AMBIGUOUS** (e.g. bare repo identifier, ticket ref like `JIRA-123`): treat as URL — not auto-fetched.

   Rationale: cross-ref mode's Iron Law requires line-number evidence from each cited artifact. URLs cannot be opened by {{READ_TOOL}} and have no stable line numbers, so allowing them would either stall the loop or weaken the evidence rule.

3. **Non-interactive mode short-circuit:** if {{ARG_VAR}} matches `<plan-path> --mode=internal` (or the agent's caller passed `mode=internal` via a structured invocation envelope where supported), SKIP the prompt in step 4 and set `mode = internal` directly. The symmetric form is `<plan-path> --mode=cross-ref --artifacts=path1,path2,...` (custom artifact list passed explicitly). Workflows that invoke `review-plan` in a loop (e.g. `project-plan` Stage 8b, `project-status` Stage 8a-equivalent) MUST pass `--mode=internal` to avoid prompting the user on every iteration.

4. If no mode short-circuit applied, use {{ASK_USER_QUESTION_TOOL}} to ask:

   **Question:** "How should this plan be reviewed?"

   **Options:**
   - **Internal only** — adversarial review of internal consistency (contradictions, deps, ordering, ambiguity, schema, file existence, test coverage). Cheap, fast. Use when the plan was written from scratch or you don't have source artifacts to cross-check.
   - **Cross-reference with detected artifacts** (ONLY show this option when step 2 found ≥1 local artifact) — applies internal review PLUS coverage check against `<detected list>`. Activates the HARD-GATE: plan corrected, artifacts never edited.
   - **Cross-reference with custom artifact list** — user provides paths manually. Same checks as the detected-artifacts option.

5. Based on the answer (or short-circuit value from step 3), set `mode = internal | cross-ref`.

6. On `cross-ref` AND no `--artifacts=` was passed: list the artifacts to the user for final confirmation. The user can add or remove paths. After confirmation, {{READ_TOOL}} each artifact and record:
   - Full file path
   - Type (PRD, epic, spec, architecture, UX, other)
   - Number of requirements/stories/FRs identified
   - Then proceed to the checklist.

## Cross-ref HARD-GATE (only when mode == cross-ref)

<HARD-GATE>
This skill corrects the PLAN, NEVER the source artifacts.
If you find an error in the artifact: record it as "artifact divergence"
and ask the user how to resolve it. DO NOT edit artifacts.
</HARD-GATE>

## Checklist

Always run the 7 internal checks. For each item, cite line numbers from
the plan that prove the verification. If you cannot cite line numbers,
the item was NOT verified.

1. **Contradictions:** does one task say X while another says Y?
2. **Broken dependencies:** does a task reference a file/model that no task creates?
3. **Ordering:** does any task depend on something not yet done?
4. **Ambiguity:** is any task too vague to implement without guessing?
5. **Schema:** are migrations within the plan consistent with each other?
6. **File lists:** do listed files/commands/scripts actually exist? Run {{GLOB_TOOL}} or {{GREP_TOOL}} to confirm — do NOT trust the name. If the plan says "run X", verify X exists. For files that a prior task in the plan creates, verify the creation task exists and comes first.
7. **Test coverage:** tasks with new code but no mention of tests?

When `mode == cross-ref`, ADDITIONALLY run the 6 cross-reference checks.
For each, cite line numbers from BOTH the plan AND the corresponding
artifact. If you cannot cite line numbers from both, the item was NOT
verified.

8. **Coverage:** does every FR, NFR, and Story from the artifacts have a task in the plan?
9. **Acceptance criteria:** are tasks oversummarized vs the epics' ACs?
10. **Phase gates:** does each gate criterion from the PRD have a concrete step in the plan?
11. **Dependencies:** does the plan's phase graph match the epics' graph?
12. **Schema/API:** do migrations and endpoints match the architecture doc?
13. **UX:** do components, states, tokens, and responsive match the UX spec?

## Severity -> Action

- **Critical:** blocks implementation OR missing requirement / contradiction with artifact — MUST be fixed before proceeding
- **Significant:** causes rework OR partial coverage / excessive simplification — fix now, not later
- **Minor:** annoying but doesn't break anything — fix if possible, record if not

## Process

### ITERATION 1
1. {{READ_TOOL}} the entire plan. Apply EACH applicable checklist item
   (7 internal; +6 cross-ref when active). For each item, record:
   status (ok / problem), line numbers verified (plan + artifact when
   cross-ref). Fix errors found directly in the plan. When `cross-ref`
   and the divergence is intentional, document it as an "alignment note"
   in the plan itself.

### VERIFICATION LOOP (max 3 iterations)
2. {{READ_TOOL}} the CORRECTED plan from the beginning (NOT mental
   review — execute {{READ_TOOL}} on the file). Cite line numbers.
3. Verify that:
   - The corrections did not introduce new problems
   - No checklist item was missed in the previous pass
   - When `cross-ref`: no requirement from the artifacts was missed
4. If new errors / gaps were found: fix and go back to step 2.
5. If the reread found nothing new: the loop ends.
6. If you reached 3 iterations and still find problems:
   STOP and escalate to the user — the plan may have structural issues
   that require human decision.

## Code-quality gates (audit lens)

You are reviewing a plan that was generated by `project-plan` or written
by hand. Beyond the existing checklist, audit the plan against
`docs/kb/code-quality-gates.md`:

- **G1 read-before-claim** — does every plan claim about existing code have pasted source lines next to it? Inferences-from-name are MAJOR findings. Example reject: plan says "the matcher joins on tenant_id" without showing the join SQL line.
- **G2 soft-language ban** — grep the plan for `should|probably|may|typically|usually|I think|it seems|in theory|tends to`. Each occurrence that is NOT marked `unverified:` is a finding. Cite line number.
- **G6 reference-or-strike** — every assertion in the plan body or task descriptions must carry `verified_by:` or `unverified:`. Bare assertions are findings. Cite line number.

Report findings of these three classes in the existing checklist output.
Severity: G1 and G6 violations are MAJOR (the plan asserts things that
aren't verified); G2 violations are MINOR (cosmetic — the underlying
claim may be fine, but the language obscures verification status).

## Self-review against gates

Before reporting the review as complete, append a `## Self-review against
code-quality gates` block:

```
- G1 read-before-claim: ran grep against the plan looking for unsourced claims; found N (cited at lines …) / 0.
- G2 soft-language: ran the ban-list grep; found M occurrences (cited at lines …) / 0.
- G6 reference-or-strike: counted K total assertions in the plan body + tasks; J have `verified_by:`, L have `unverified:`, R bare (FINDINGS at lines …).
```

If you found zero gate violations, treat that result with suspicion —
re-read the checklist and force a second, more aggressive pass before
accepting.

## Red Flags

- "This checklist item seems ok, I don't need to cite line numbers"
- "The plan is clear, I don't need to verify dependencies"
- "I've already read the entire plan mentally, I don't need to use {{READ_TOOL}} again"
- "This error is minor, I can ignore it"
- "I finished without finding anything — the plan is perfect"
- "I'll skip the reread, my corrections are right"
- "I'll edit the artifact to make it consistent with the plan" (cross-ref mode only)
- "This artifact isn't relevant" (cross-ref mode only)

If you thought any of the above: STOP. Go back to the step you were skipping.

## Rationalization

| Temptation | Reality |
|------------|---------|
| "Seems consistent" | Prove with line numbers or it's not verification |
| "I've already verified mentally" | Mental verification doesn't count — execute {{READ_TOOL}} |
| "This item doesn't apply to this plan" | Record explicitly as N/A with justification |
| "The plan is simple, it doesn't need all this" | Simple plans have simple bugs that cause rework |
| "It's already 3 iterations, I'll approve" | If there are still problems, escalate — don't approve with defects |
| "The file probably exists, the name makes sense" | Sensible names are how bugs hide. Run {{GLOB_TOOL}} to confirm |
| "The plan covers all requirements" (cross-ref) | Prove with cross-referenced line numbers |
| "I'll skim the artifact" (cross-ref) | Skimming = missing requirements. Full {{READ_TOOL}} |
| "Intentional divergence, no need to document" (cross-ref) | If it's not documented, it's not intentional |
| "Editing the artifact is faster" (cross-ref) | HARD-GATE: never edit artifacts |

## Closing

Present the summary in this format:

### Analysis Summary

**Mode:** internal | cross-ref
**Artifacts analyzed:** [list with paths, only on cross-ref mode]
**Iterations performed:** [N]
**{{READ_TOOL}} calls executed:** [N] (plan: X, artifacts: Y)
**Total findings:** [N] (critical: X, significant: Y, minor: Z)

| # | Finding | Plan:line | Artifact:line | Correction | Severity |
|---|---------|-----------|---------------|------------|----------|
| 1 | [summary] | plan.md:108 | prd.md:42 (or —) | [fix] | critical |

**Alignment notes added:** [N, on cross-ref mode]
**Final status:** [Plan approved / Plan with caveats / Escalated to user]
