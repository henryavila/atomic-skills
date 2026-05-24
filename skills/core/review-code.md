Perform an adversarial analysis of the code changes at {{ARG_VAR}}
(git ref: branch, single commit, or commit range) looking for logic
bugs, race conditions, error handling gaps, schema/migration
inconsistencies, and missing tests. Step 0 picks one of three modes:
`local` (same-model self-loop), `codex` (cross-model two-pass sealed
envelope via OpenAI Codex CLI), or `both` (local first → codex on the
same captured diff).

## Iron Law

NO APPROVAL WITHOUT EVIDENCE.
- Local mode: each finding MUST cite `file:line`. Bug claims without `file:line` are rejected.
- Codex mode: every codex finding MUST have `file:line` + 4 fields (Claim, Impact, Recommendation, Confidence). Findings without these are rejected.

NO INTENT IN THE BRIEFING (codex sub-flow).
The briefing sent to codex contains ONLY externally verifiable facts.
Intent narrative poisons the reviewer by up to -93pp detection rate
([arXiv 2603.18740](https://arxiv.org/abs/2603.18740)). When the active
mode is `both`, the codex briefing additionally must NOT include local
findings, fix descriptions, iteration counts, or any narrative implying a
prior review took place.

## Mindset

Read the diff as if the author were wrong. Your role is to find bugs,
not to confirm the change is clean. If you finish without findings, it's
more likely you missed something than the diff being perfect — re-read
the checklist and force a second pass.

In codex sub-flow: codex is an adversarial reviewer from a different
family (GPT). Find bugs, vulnerabilities, race conditions — don't defend
the code.

## Argument & diff capture contract

Parse {{ARG_VAR}} BEFORE any prompt or diff command. {{ARG_VAR}} is the
raw argument string; split into `git_ref` + optional flags. Tokens
starting with `--` are flags:

| Flag | Effect |
|---|---|
| `--mode=local` | Skip Step 0 mode picker; force local self-loop. |
| `--mode=codex` | Skip Step 0 mode picker; force codex envelope. |
| `--mode=both` | Skip Step 0 mode picker; force local→codex. |
| `--allow-dirty` | Include working-tree changes in the captured diff; suppress the dirty-tree abort. |

Everything not starting with `--` is `git_ref`. If `git_ref` is empty,
abort with: "review-code requires a git ref as the first argument."

**Non-interactive abort.** If neither a TTY nor an explicit `--mode=`
flag is available, abort with: "review-code invoked without TTY and
without `--mode=`; pass `--mode=local|codex|both` explicitly." Do NOT
invoke {{ASK_USER_QUESTION_TOOL}} in background.

### Ref validation (run before Step 0 mode picker)

1. **Detect ref shape (test in order, triple-dot FIRST):**
   - If `git_ref` contains `...` (triple-dot): RANGE; separator = `...`.
   - Else if `git_ref` contains `..` (double-dot): RANGE; separator = `..`.
   - Else: SINGLE ref.

   Triple-dot detection MUST come first. If you test `..` first and use
   it as the split separator, `'main...HEAD'.split('..')` returns
   `['main', '.HEAD']` (with a leftover dot). Order matters.

2. **Validate:**
   - SINGLE: {{BASH_TOOL}}: `git rev-parse --verify <git_ref>` exits 0.
   - RANGE: split on the DETECTED separator (do NOT split on `..` when
     the separator was `...`). Validate each non-empty endpoint with
     `git rev-parse --verify <endpoint>`. Empty endpoint (e.g. `..HEAD`
     or `HEAD..`) is shorthand for `HEAD` — valid.

   Why conditional: `git rev-parse --verify` rejects revision-range
   syntax — passing `main..HEAD` raw fails even when both endpoints
   exist.

3. **For SINGLE, distinguish COMMIT vs BRANCH (deterministic):**
   - If `git show-ref --verify --quiet refs/heads/<git_ref>` exits 0 → SINGLE BRANCH.
   - Else if `git show-ref --verify --quiet refs/remotes/<git_ref>` exits 0 → SINGLE BRANCH (remote-tracking).
   - Else if `git cat-file -t <git_ref>` outputs `commit` → SINGLE COMMIT.
   - Else if `git cat-file -t <git_ref>` outputs `tag` → resolve via `git rev-parse <git_ref>^{commit}` and treat as SINGLE COMMIT.
   - Else abort: "Cannot classify `<git_ref>` as branch or commit; refusing to guess."
   - **Ambiguity rule:** if `git_ref` matches BOTH a local branch and a commit SHA (rare), prefer BRANCH and warn the user. Surface in the ask-the-user-for-base prompt (step 5).

4. **Dirty-tree policy** (applies to all modes):
   - {{BASH_TOOL}}: `git status --porcelain`.
   - Tree clean: proceed.
   - Tree dirty + `--allow-dirty`: warning + include working-tree changes in `CAPTURED_DIFF`.
   - Tree dirty without `--allow-dirty`: abort with the same message as `{{ASSETS_PATH}}/preflight-checks.txt` check #3 ("Codex bug #8404 can cause hallucinated findings when reviewing against a dirty tree. Either commit/stash changes, or re-invoke with `--allow-dirty`.").

5. **Pick the right diff command per shape** (`git diff <ref>` is NOT uniform):
   - **SINGLE COMMIT:** `git show --format= --patch <git_ref>` (equivalent: `git diff <git_ref>^!`) — patch of THAT commit alone.
   - **SINGLE BRANCH:** use {{ASK_USER_QUESTION_TOOL}} to ask **"Which base should we diff `<git_ref>` against?"** with options derived from `git symbolic-ref refs/remotes/origin/HEAD` (default branch) and `main` / `master` if they exist (dedupe). Once base is chosen, run `git diff $(git merge-base <base> <git_ref>)..<git_ref>`. DO NOT use `HEAD` as one side: when the user is checked out on the branch being reviewed (`HEAD` resolves to the branch tip), `merge-base <branch> HEAD == <branch>` and the diff is empty. If `git merge-base` returns nothing (disjoint history), abort and re-ask.
   - **RANGE:** `git diff <git_ref>` — already correct.
   - **NEVER use `git diff <single-ref>` raw:** diffs the WORKTREE against the ref, leaking unrelated local edits into the review.

6. **Materialize `CAPTURED_DIFF` ONCE.** Run the shape-specific command
   from step 5 and store the output as `CAPTURED_DIFF`. Both phases
   (local checklist + codex briefing) MUST consume `CAPTURED_DIFF`, never
   re-execute `git diff`. This guarantees both reviewers see byte-identical
   material.

7. {{BASH_TOOL}}: `git diff --name-only` using the same shape-specific
   command → list of modified files (`CAPTURED_FILES`). If empty: abort
   with "No changes in ref".

8. {{BASH_TOOL}}: pipe `CAPTURED_DIFF` to `wc -c`. If > 50000 bytes: use
   {{ASK_USER_QUESTION_TOOL}} to ask **"Diff is N bytes (large). Continue
   review or abort?"** with options `Continue` / `Abort`. In codex mode,
   this also previews the cost (~ $1-2 per 50KB).

## Step 0 — Pick review mode

Skip this step if `--mode=` was supplied. Otherwise, use
{{ASK_USER_QUESTION_TOOL}}:

**Question:** "How should this code change be reviewed?"

**Options:**
- **Both (local then codex)** — Recommended for significant changes
  (auth, payments, data integrity). Self-loop catches obvious bugs;
  codex catches what self missed. ~$1-2 codex cost.
- **Local only** — Cheap, fast. Use for routine PRs or pre-commit checks.
- **Codex only** — Skip local. Use when another agent self-reviewed.

Default: **Both**.

Set `mode ∈ {local, codex, both}` based on the answer.

Why route all user prompts through {{ASK_USER_QUESTION_TOOL}}: the
template var resolves per IDE — Claude Code uses its native multi-choice
prompt tool; Gemini / Cursor / Codex CLI / Opencode / GitHub Copilot /
generic receive a descriptive string so the agent renders the prompt as
plain text. Hardcoding any specific tool name would break the other IDEs.

---

## Flow per mode

### Flow A — `mode == local`

Argument & diff capture → Step 0 → `local`. Run **Self-loop checklist**
(below). END.

### Flow B — `mode == codex`

Argument & diff capture → Step 0 → `codex`. Run **Codex sub-flow**
(below). END.

### Flow C — `mode == both`

Argument & diff capture → Step 0 → `both`.

1. **LOCAL PHASE** — Run Self-loop checklist on `CAPTURED_DIFF`. Apply
   fixes inline where obvious; track fix descriptions for the audit trail.
   The audit trail goes into the persisted review file, NOT the codex
   briefing.

2. **CODEX PHASE** — Run Codex sub-flow on the SAME `CAPTURED_DIFF`. The
   Pass-1 briefing MUST NOT mention local findings, fix descriptions,
   iteration counts, or that a prior review took place. The codex sees
   the diff as if it were the first review.

   **Smoke test invariant:** the `CAPTURED_DIFF` consumed by both phases
   must be byte-identical. If you suspect drift (e.g. fixes mutated the
   tree), abort the codex phase and warn — the local fixes contaminate
   the cross-model invariant.

END.

---

## Self-loop checklist (modes: local, both)

### Step 1 — Gather artifacts

- Use `CAPTURED_DIFF` from the argument-capture step (do NOT re-run `git diff`).
- For each file in `CAPTURED_FILES`: {{READ_TOOL}} the full content.
- For each modified PUBLIC symbol (exported function, exported class): {{GREP_TOOL}} recursively for callers (limit 5 per symbol).

### Checklist

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

### Iteration

**ITERATION 1.** Walk the diff once. Apply EACH checklist item. For
each, record: status (ok / problem), `file:line` verified. Fix findings
directly in the source files when a fix is obvious; otherwise propose
the correction in the closing table for the user to apply.

**VERIFICATION LOOP (max 3 iterations).**
- {{READ_TOOL}} the CORRECTED files from the beginning (NOT mental review — execute {{READ_TOOL}} on each modified file). Cite line numbers.
- Verify corrections did not introduce new problems; no checklist item was missed.
- If new bugs were found: fix and loop.
- If the reread found nothing new: the loop ends.
- If you reached 3 iterations and still find problems: STOP and escalate — the change may have structural issues that require human decision.

---

## Codex sub-flow (modes: codex, both)

The codex sub-flow uses canonical assets in
`skills/shared/codex-bridge-assets/` as the single source of truth.

1. **Pre-flight checks** — follow `{{ASSETS_PATH}}/preflight-checks.txt`.
   ABORT if any check fails. (`--allow-dirty` passes through from the
   argument contract; the dirty-tree check in step 4 above has already
   filtered this.)

2. **Input** — `CAPTURED_DIFF` and `CAPTURED_FILES` from the
   argument-capture step. Both phases use the same captured material; do
   NOT re-run `git diff`.

3. **Gather extra context (codex briefing)**
   - For each file in `CAPTURED_FILES`: ensure {{READ_TOOL}} ran and the content is available.
   - For each modified public symbol: {{GREP_TOOL}} for callers (limit 5).

4. **Curate Pass 1 briefing (factual minimal)**
   - {{READ_TOOL}} `{{ASSETS_PATH}}/pass1-briefing-template-code.txt`.
   - Identify externally verifiable factual constraints:
     - `package.json` engines, forbidden deps.
     - Public API contracts (grep README/docs).
     - Schema/migration constraints if any.
   - Identify non-goals (short, no rationale).
   - **DO NOT** include intent, memory, authorship, or (when `mode == both`) any reference to the prior local review or fix log.
   - Substitute placeholders:
     - `{{ANTI_FRAMING_DIRECTIVE}}` ← contents of `{{ASSETS_PATH}}/anti-framing-directive.txt`
     - `{{NON_GOALS_LIST}}` ← short bullet list with no rationale
     - `{{ARTIFACT}}` ← `CAPTURED_DIFF` (NOT a fresh `git diff`)
     - `{{OUTPUT_TEMPLATE_PASS1}}` ← contents of `{{ASSETS_PATH}}/output-template-pass1.txt`
   - Save to `/tmp/codex-briefing-pass1-<timestamp>.md`.
   - Verify briefing size without diff: < 800 tokens.

5. **Briefing confirmation** — show user: git ref, modified files,
   callers included, estimated tokens. Ask `approve / edit / cancel`.

6. **Pass 1 invocation (blind)** — follow
   `{{ASSETS_PATH}}/invocation-canonical.txt`. `MODEL_FLAG` empty by
   default (codex resolves via `~/.codex/config.toml` or bundled
   default). User can override by passing `model:<id>`.

7. **Pass 1 validation** — `{{ASSETS_PATH}}/validation-checklist.txt`
   (universal checks 1-9). Failure → 1 corrective retry. Failure again →
   escalate raw.

8. **Build Pass 2 briefing (informed)** — append
   `{{ASSETS_PATH}}/pass2-prompt-suffix.txt` substituting
   `{{CONSTRAINTS_LIST}}`, `{{PASS_1_OUTPUT}}`, `{{OUTPUT_TEMPLATE_PASS2}}`.

9. **Pass 2 invocation** — same command as step 6 with the pass-2
   briefing path and output path.

10. **Pass 2 validation** — universal checks 1-9 + Pass-2-only checks
    10-13.

11. **Persistence**
    - {{BASH_TOOL}}: `mkdir -p .atomic-skills/reviews/`
    - {{READ_TOOL}} `{{ASSETS_PATH}}/review-file-template.txt`.
    - Substitute placeholders. When `mode == both`, include both the
      local fix log AND codex findings in the review file.
    - Save to `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md`.
    - Update `.atomic-skills/reviews/INDEX.md` (create if missing) using
      `{{ASSETS_PATH}}/index-row-template.txt`.

12. **Triage + fix proposals**
    - For each finding with severity ∈ {blocker, critical}:
      - Show ID, severity, file:line, claim, recommendation.
      - {{READ_TOOL}} the file, formulate edit.
      - Ask: `apply / edit / skip`.
      - `apply` uses {{REPLACE_TOOL}}.
    - Major/minor/nit: record in review file, no required action.
    - Suggest user run tests if fixes were applied.

---

## Severity → Action

- **Critical / blocker:** breaks prod / data loss / security breach / bug hitting users in normal use — MUST be fixed before merge.
- **Significant / major:** real bug with workaround — fix if possible.
- **Minor / nit:** style / readability / micro-perf — record, no required action.

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

In `mode ∈ {codex, both}`, the block goes into the consolidated review
file under `.atomic-skills/reviews/<…>.md` under "Fixes applied in this
session". Silent skipping is forbidden.

## Red Flags

- "This finding seems ok, I don't need to cite file:line"
- "The diff is clear, I don't need to verify callers"
- "I've already read the diff mentally, I don't need to use {{READ_TOOL}}"
- "This bug is minor, I can ignore it"
- "I finished without finding anything — the diff is perfect"
- "I'll skip the reread, my corrections are right"
- "I'll skip callers, just the diff is enough"
- "The migration is reversible, I don't need to check"
- "I'll re-run `git diff` for the codex briefing — close enough" (mode == both — breaks the byte-identical invariant)
- "I'll mention the local pass in the codex briefing — codex deserves context" (mode == both)
- "I'll add architectural context to help codex" (codex sub-flow)
- "Codex said approve but I think it needs more review"

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
| "Codex will figure it out from context" (codex) | Sealed envelope: facts only |
| "The local pass already found everything, codex is a formality" (both) | Empirically codex catches disjoint findings — see [arXiv 2603.12123](https://arxiv.org/abs/2603.12123) |

## Closing

Present the summary in this format. Sections marked `(local/both)` only
appear in the corresponding mode; `(codex/both)` likewise.

```markdown
### Analysis Summary

**Ref:** {{ARG_VAR}}
**Mode:** local | codex | both
**Files reviewed:** [N]
**Iterations (local):** [N] (local/both only)
**Codex iterations:** 2 (blind + informed) (codex/both only)
**Counts (local):** critical: X, significant: Y, minor: Z (local/both only)
**Counts (codex blind):** <B>B/<C>C/<M>M/<m>m/<n>n (codex/both only)
**Counts (codex final):** <B>B/<C>C/<M>M/<m>m/<n>n (codex/both only)
**Framing Δ (codex):** <d>d / <=>= / <+>+ (codex/both only)

| # | Finding | Severity | Mode | File:line | Action |
|---|---------|----------|------|-----------|--------|
| 1 | <summary> | critical | local | src/foo.ts:42 | applied |
| 2 | <summary> | blocker | codex | src/bar.ts:88 | applied |

**Reviews saved at:** `.atomic-skills/reviews/<file>.md` (codex/both only)
**Final status:** Code approved / with caveats / Escalated to user
**Suggestion:** run `npm test` if fixes were applied.
```
