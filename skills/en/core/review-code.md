Perform an adversarial analysis of the code changes at {{ARG_VAR}}
(git ref: branch, single commit, or commit range) looking for logic
bugs, race conditions, error handling gaps, schema/migration
inconsistencies, and missing tests. Same-model self-loop; free
alternative to `review-code-with-codex`.

## Iron Law

NO APPROVAL WITHOUT EVIDENCE.
Each finding MUST cite `file:line`. Bug claims without `file:line` = rejected.

## Mindset

Read the diff as if the author were wrong. Your role is to find bugs,
not to confirm the change is clean. If you finish without findings, it's
more likely you missed something than the diff being perfect — re-read
the checklist and force a second pass.

## Step 0 — Validate input

1. {{ARG_VAR}} must be a git ref: branch, single commit, or commit range
   like `main..HEAD` / `main...HEAD`.
2. **Detect ref shape (test in order, triple-dot FIRST):**
   - If {{ARG_VAR}} contains `...` (triple-dot): RANGE; separator = `...`.
   - Else if {{ARG_VAR}} contains `..` (double-dot): RANGE; separator = `..`.
   - Else: SINGLE ref.

   Triple-dot detection MUST come first. If you test `..` first and use it
   as the split separator, `'main...HEAD'.split('..')` returns
   `['main', '.HEAD']` (with a leftover dot). Order matters.

3. **Validate:**
   - SINGLE: {{BASH_TOOL}}: `git rev-parse --verify {{ARG_VAR}}` exits 0.
   - RANGE: split on the DETECTED separator (do NOT split on `..` when the
     separator was `...` — would yield wrong tokens like `['main', '.HEAD']`).
     Validate each non-empty endpoint with `git rev-parse --verify <endpoint>`.
     Empty endpoint (e.g. `..HEAD` or `HEAD..`) is shorthand for `HEAD` — valid.

   Why validation is conditional: `git rev-parse --verify` rejects
   revision-range syntax — passing `main..HEAD` raw fails even when both
   endpoints exist.

3.5. **For SINGLE, distinguish COMMIT vs BRANCH (deterministic):**
   - If `git show-ref --verify --quiet refs/heads/{{ARG_VAR}}` exits 0 → SINGLE BRANCH (it is a local branch name).
   - Else if `git show-ref --verify --quiet refs/remotes/{{ARG_VAR}}` exits 0 → SINGLE BRANCH (treat remote-tracking branch as branch input).
   - Else if `git cat-file -t {{ARG_VAR}}` outputs `commit` → SINGLE COMMIT.
   - Else if `git cat-file -t {{ARG_VAR}}` outputs `tag` → resolve via `git rev-parse {{ARG_VAR}}^{commit}` and treat as SINGLE COMMIT.
   - Else abort: "Cannot classify `{{ARG_VAR}}` as branch or commit; refusing to guess."
   - **Ambiguity rule:** if {{ARG_VAR}} matches BOTH a local branch and a commit SHA (rare — a branch literally named like a hex SHA), prefer BRANCH and warn the user. Surface this in the ask-the-user-for-base prompt of step 4.

4. **Pick the right diff command per shape** (`git diff <ref>` is NOT uniform):
   - **SINGLE COMMIT:** `git show --format= --patch {{ARG_VAR}}` (equivalent: `git diff {{ARG_VAR}}^!`) — patch of THAT commit alone.
   - **SINGLE BRANCH:** use {{ASK_USER_QUESTION_TOOL}} to ask **"Which base should we diff `{{ARG_VAR}}` against?"** with options derived from `git symbolic-ref refs/remotes/origin/HEAD` (default branch) and `main` / `master` if they exist (dedupe). Once the base is chosen, run `git diff $(git merge-base <base> {{ARG_VAR}})..{{ARG_VAR}}`. DO NOT use `HEAD` as one side: when the user is currently checked out on the branch they want reviewed (`HEAD` resolves to the branch tip), `merge-base <branch> HEAD == <branch>` and the diff is empty. If `git merge-base` returns nothing for the chosen base (disjoint history), abort and re-ask via the same prompt.
   - **RANGE:** `git diff {{ARG_VAR}}` — already correct.
   - **NEVER use `git diff <single-ref>` raw:** it diffs the WORKTREE against the ref, leaking unrelated local edits into the review.

5. {{BASH_TOOL}}: `git diff --name-only` using the same shape-specific
   command as step 4 → list of modified files. If empty: abort with
   "No changes in ref".

6. {{BASH_TOOL}}: pipe the shape-specific diff to `wc -c`. If > 50000
   bytes: use {{ASK_USER_QUESTION_TOOL}} to ask **"Diff is N bytes
   (large). Continue review or abort?"** with options `Continue` /
   `Abort`.

Why route all user prompts through {{ASK_USER_QUESTION_TOOL}}: the
template var resolves per IDE — Claude Code uses the native
AskUserQuestion tool; Gemini / Cursor / Codex CLI / Opencode /
GitHub Copilot / generic receive a descriptive string so the agent
renders the prompt as plain text. Hardcoding the tool name would break
non-Claude IDEs; hardcoding the plain-text form would skip the native
tool in Claude Code.

## Step 1 — Gather artifacts

- {{BASH_TOOL}}: gather the DIFF using the shape-specific command chosen
  in Step 0.4 (NOT raw `git diff {{ARG_VAR}}` for SINGLE shapes).
- For each modified file: {{READ_TOOL}} the full content.
- For each modified PUBLIC symbol (exported function, exported class):
  {{GREP_TOOL}} recursively for callers (limit 5 per symbol).

## Checklist

For each item, cite `file:line` from the diff or from the modified file
that proves the verification. If you cannot cite line numbers, the item
was NOT verified.

1. **Logic bugs:** off-by-one, null/undefined, type confusion, unreachable branches.
2. **Race conditions:** shared state, async ordering, missing locks.
3. **Error handling:** silently swallowed failures, generic catches without rethrow.
4. **Schema/migrations:** new migrations consistent with each other AND reversible.
5. **API contracts:** public signatures changed without doc / callers updated. Use the callers list from Step 1.
6. **File / function references:** does each `import` / `require` in modified files resolve? Run {{GREP_TOOL}} or {{GLOB_TOOL}} to confirm.
7. **Test coverage:** new code paths without tests?

## Severity -> Action

- **Critical:** breaks prod / data loss / security breach / bug hitting users in normal use — MUST be fixed before merge.
- **Significant:** real bug with workaround — fix if possible.
- **Minor:** style / readability / micro-perf — record, no required action.

## Process

### ITERATION 1
1. Walk the diff once. Apply EACH checklist item. For each item, record:
   status (ok / problem), `file:line` verified. Fix findings directly in
   the source files when a fix is obvious; otherwise propose the
   correction in the closing table for the user to apply.

### VERIFICATION LOOP (max 3 iterations)
2. {{READ_TOOL}} the CORRECTED files from the beginning (NOT mental
   review — execute {{READ_TOOL}} on each modified file). Cite line
   numbers.
3. Verify that:
   - The corrections did not introduce new problems
   - No checklist item was missed in the previous pass
4. If new bugs were found: fix and go back to step 2.
5. If the reread found nothing new: the loop ends.
6. If you reached 3 iterations and still find problems: STOP and
   escalate to the user — the change may have structural issues that
   require human decision.

## Code-quality gates (review lens)

When triaging findings and applying fixes, the code you write must
comply with `docs/kb/code-quality-gates.md`:

- **G1 read-before-claim** — when applying a fix, paste the actual source lines being changed into the fix description before writing the edit. Inferring "the bug is on line 42" without reading line 42 is forbidden.
- **G2 soft-language ban** — fix descriptions and commit messages MUST NOT contain `should`, `probably`, `may`, `typically`, `usually`. State what the fix does, not what it should do.
- **G3 anti-tautology in tests** — if the fix adds a test that codifies the bug-then-fix, for each new assertion answer: "what mutation in the fix would make this test fail?" If the answer is "none", rewrite the assertion.
- **G4 fixture realism** — if the bug involves external data (transcript, HTTP payload, config file), sample a real instance before constructing the test fixture. The 60-second sample rule applies.
- **G7 premature-abstraction ban** — fixing one bug does not justify introducing a helper "for future similar bugs". Three identical sites = consider helper. Two or fewer = duplicate, document the pattern in a comment, move on.

## Self-review against gates

Before reporting the review as complete, append a `## Self-review against
code-quality gates` block:

```
- G1 read-before-claim: for each fix, pasted source lines before/after the edit / N/A.
- G2 soft-language: scanned fix descriptions for ban list; 0 occurrences (or list with rewrites).
- G3 anti-tautology: for each new test assertion, named the mutation that breaks it.
- G4 fixture realism: for each new fixture, cited the real source it was sampled from / N/A.
- G7 anti-premature-abstraction: no new helper introduced unless 3+ sites required it.
```

## Red Flags

- "This finding seems ok, I don't need to cite file:line"
- "The diff is clear, I don't need to verify callers"
- "I've already read the diff mentally, I don't need to use {{READ_TOOL}}"
- "This bug is minor, I can ignore it"
- "I finished without finding anything — the diff is perfect"
- "I'll skip the reread, my corrections are right"
- "I'll skip callers, just the diff is enough"
- "The migration is reversible, I don't need to check"

If you thought any of the above: STOP. Go back to the step you were skipping.

## Rationalization

| Temptation | Reality |
|------------|---------|
| "Looks fine" | Prove with `file:line` or it's not verification |
| "I've already verified mentally" | Mental verification doesn't count — execute {{READ_TOOL}} |
| "This item doesn't apply" | Record explicitly as N/A with justification |
| "The diff is small, it doesn't need all this" | Small diffs hide simple bugs in obvious places |
| "It's already 3 iterations, I'll approve" | If there are still problems, escalate — don't approve with defects |
| "The import probably resolves" | Sensible names are how bugs hide. Run {{GREP_TOOL}} to confirm |

## Closing

Present the summary in this format:

### Analysis Summary

**Ref:** {{ARG_VAR}}
**Files reviewed:** [N]
**Iterations performed:** [N]
**Total findings:** [N] (critical: X, significant: Y, minor: Z)

| # | Finding | File:line | Correction | Severity |
|---|---------|-----------|------------|----------|
| 1 | [summary] | src/foo.ts:42 | [fix] | critical |

**Final status:** [Code approved / Code with caveats / Escalated to user]
**Suggestion:** run `npm test` if fixes were applied.
