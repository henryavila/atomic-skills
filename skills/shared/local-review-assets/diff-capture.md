# Argument & diff capture — review-code (lazy asset)

review-code reads this BEFORE Step 0 (the mode picker) in every mode. Execute it
to produce the captured material the downstream phases consume, then return to
the skill's Step 0. The diff shape algorithm below is authoritative — do not
paraphrase or shortcut it.

**Outputs (consumed by Step 0, the Local review agent, and the Codex sub-flow):**
- `CAPTURED_DIFF` — the byte-identical diff materialized ONCE; both reviewers consume it (never re-run `git diff`).
- `CAPTURED_FILES` — the modified-file list.
- `SCOPE` — set when {{ARG_VAR}} was a scope keyword (`wip` | `branch` | `all`) or empty.
- `{{GIT_REF}}` — the neutral label for the briefing placeholder.
- `DESTRUCTIVE` — the deterministic destructive-diff signal that Step 0's warning reads.

## Argument & diff capture contract

Parse {{ARG_VAR}} BEFORE any prompt or diff command. First run
`parseModelArgs({{ARG_VAR}})` (or the CLI `--resolve` path) so that
`--model <id>`, `--model=<id>`, `--model-codex` / `--model-grok` (eq or
space form), `model:<id>`, and `--ask-model` are **consumed with their
values** and never leak into `git_ref`. Then split
`remainingTokens` into `git_ref` + optional flags. Tokens starting with
`--` are flags:

| Flag | Effect |
|---|---|
| `--mode=local` | Skip Step 0 mode picker; force local sealed envelope. |
| `--mode=codex` | Skip Step 0 mode picker; force Codex envelope (cross-model only when host ≠ codex). |
| `--mode=grok` | Skip Step 0 mode picker; force Grok envelope (cross-model only when host ≠ grok). |
| `--mode=both` | Skip Step 0 mode picker; force local → host external default. |
| `--mode=both-codex` | Skip Step 0 mode picker; force local → Codex. |
| `--mode=both-grok` | Skip Step 0 mode picker; force local → Grok. |
| `--mode=external-both` | Skip Step 0 mode picker; force family-different external providers only (no local leg). |
| `--accept-same-family-as-local` | Non-interactive: same-family external remaps to sealed `local` (`provider: local`, `sameFamilyRemap: true`; never counts as CROSS-MODEL REVIEW). Env: `ATOMIC_SKILLS_ACCEPT_SAME_FAMILY_AS_LOCAL=1`. |
| `--model=<id>` | Force external reviewer model; skip model picker. Also `--model <id>`, `model:<id>`, or `cli-default`. See review-mode-ux.md Step 0.model. |
| `--model-codex=<id>` / `--model-grok=<id>` | Per-provider model override (external-both legs). |
| `--ask-model` | Prefer catalog **recommended** model (interactive picker highlights it; non-interactive binds it). |
| `--allow-dirty` | Include working-tree changes in the captured diff; suppress the dirty-tree abort. |
| `--max-iterations=N` | Max verification-loop iterations (default 3). Convergence rule (plateau detection) may stop earlier. |

`git_ref` = `positionalFromRemaining(remainingTokens)` (all non-`--*` tokens
after model flags were stripped — including the value of space-form
`--model <id>`, which must **not** remain as a positional). `git_ref` may be a
git ref, a scope keyword (`wip` | `branch` | `all`), or empty — keyword and
empty forms are handled by **Scope resolution** below, never by guessing a ref.
Helper: `parseModelArgs` / `positionalFromRemaining` in
`src/resolve-review-model.js`.

**Non-interactive abort.** Without a TTY, every interactive prompt in
this skill is unavailable — do NOT invoke {{ASK_USER_QUESTION_TOOL}} in
background. Abort instead when, non-interactively:
- no explicit `--mode=` flag: "review-code invoked without TTY and
  without `--mode=`; pass `--mode=local|codex|grok|both|both-codex|both-grok|external-both` explicitly."
- `git_ref` is empty: "review-code invoked without TTY and without a
  ref/scope; pass a git ref or `wip`|`branch`|`all` explicitly."
- same-family external without `--accept-same-family-as-local`: HARD ABORT
  per `review-mode-ux.md` (do not silently remap).

### Scope resolution (run before ref validation)

If `git_ref` is a scope keyword or empty, resolve the review scope here
instead of validating a ref:

| Keyword | Scope | Capture command |
|---|---|---|
| `wip` | Uncommitted changes (staged + unstaged + untracked) | `git diff HEAD`; then for each untracked file (`??` in `git status --porcelain`) append `git diff --no-index /dev/null <file>` (`--no-index` exits 1 on differences — expected) |
| `branch` | Commits on HEAD vs the default base | `git diff $(git merge-base <base> HEAD)..HEAD` |
| `all` | Branch commits + uncommitted changes | `git diff $(git merge-base <base> HEAD)` — worktree vs merge-base; the single-ref form is intentional here |

`<base>`: the branch named by `git symbolic-ref refs/remotes/origin/HEAD`,
else `main`, else `master` (first that passes `git show-ref`). If no base
resolves or `git merge-base` returns nothing (detached/disjoint history),
`branch` and `all` are unavailable — say so instead of improvising.

**Empty `git_ref` (interactive picker):**

1. Detect what exists:
   - `git status --porcelain` → D = count of dirty + untracked files.
   - `git rev-list --count $(git merge-base <base> HEAD)..HEAD` → C =
     commits ahead of base.
2. Offer ONLY scopes that exist, via {{ASK_USER_QUESTION_TOOL}}
   ("What should be reviewed?"):
   - D > 0 → "Uncommitted changes (D files)" → `wip`
   - C > 0 → "Branch vs <base> (C commits)" → `branch`
   - C > 0 and D > 0 → "Everything since <base> (C commits + D files)" → `all`
3. D == 0 and C == 0: abort with "Nothing to review: working tree clean
   and no commits ahead of <base>. Pass an explicit git ref."
4. No TTY: non-interactive abort above — never guess a scope.

With `SCOPE` resolved: skip ref-validation steps 1-3 and 5 (the capture
command comes from the table above); apply step 4 (dirty-tree policy —
scope-aware) and steps 6-8 unchanged.

For the briefing placeholder `{{GIT_REF}}`, use a neutral label:
`wip` → `uncommitted working-tree changes`; `branch` → `<merge-base>..HEAD`;
`all` → `<merge-base>..HEAD + working tree`. No intent, no narrative.

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

4. **Dirty-tree policy** (applies to all modes; scope-aware):
   - {{BASH_TOOL}}: `git status --porcelain`. Tree clean: proceed.
   - `SCOPE ∈ {wip, all}`: the working tree IS the review subject — do
     NOT abort. Treat `--allow-dirty` as implicitly set for preflight
     check #3. In codex mode, warn once: "reviewing uncommitted work;
     prefer `--mode=local` for WIP, or commit first for a codex pass."
   - Committed-only subject (`branch`, explicit ref/range) + dirty tree:
     - With `--allow-dirty`: warning + include working-tree changes in `CAPTURED_DIFF`.
     - Interactive: use {{ASK_USER_QUESTION_TOOL}} — "Working tree has
       uncommitted changes outside the reviewed ref. The review agent
       reads worktree files, so `file:line` citations may not match the
       diff." Options: `Review ref only` / `Include working-tree changes`
       / `Abort`.
     - Non-interactive without `--allow-dirty`: abort with the same
       message as `{{ASSETS_PATH}}/preflight-checks.txt` check #3
       ("Codex bug #8404 can cause hallucinated findings when reviewing
       against a dirty tree. Either commit/stash changes, or re-invoke
       with `--allow-dirty`.").

5. **Pick the right diff command per shape** (`git diff <ref>` is NOT uniform):
   - **SINGLE COMMIT:** `git show --format= --patch <git_ref>` (equivalent: `git diff <git_ref>^!`) — patch of THAT commit alone.
   - **SINGLE BRANCH:** use {{ASK_USER_QUESTION_TOOL}} to ask **"Which base should we diff `<git_ref>` against?"** with options derived from `git symbolic-ref refs/remotes/origin/HEAD` (default branch) and `main` / `master` if they exist (dedupe). Once base is chosen, run `git diff $(git merge-base <base> <git_ref>)..<git_ref>`. DO NOT use `HEAD` as one side: when the user is checked out on the branch being reviewed (`HEAD` resolves to the branch tip), `merge-base <branch> HEAD == <branch>` and the diff is empty. If `git merge-base` returns nothing (disjoint history), abort and re-ask.
   - **RANGE:** `git diff <git_ref>` — already correct.
   - **NEVER use `git diff <single-ref>` raw for ref shapes:** it diffs
     the WORKTREE against the ref, leaking unrelated local edits into the
     review. The one sanctioned use is scope `all`, where the worktree IS
     the review subject (see Scope resolution).

6. **Materialize `CAPTURED_DIFF` ONCE.** Run the shape-specific command
   from step 5 (or the scope-table command when `SCOPE` is set) and store
   the output as `CAPTURED_DIFF`. Both phases
   (local agent briefing + codex briefing) MUST consume `CAPTURED_DIFF`, never
   re-execute `git diff`. This guarantees both reviewers see byte-identical
   material.

7. {{BASH_TOOL}}: `git diff --name-only` using the same shape-specific
   (or scope) command → list of modified files (`CAPTURED_FILES`); for
   `wip`/`all`, append untracked file names from `git status --porcelain`.
   If empty: abort with "No changes in ref".

8. {{BASH_TOOL}}: pipe `CAPTURED_DIFF` to `wc -c`. If > 50000 bytes: use
   {{ASK_USER_QUESTION_TOOL}} to ask **"Diff is N bytes (large). Continue
   review or abort?"** with options `Continue` / `Abort`. In codex mode,
   this also previews the cost (~ $1-2 per 50KB).

## Destructive-diff signal (compute before Step 0)

A predominantly **destructive** diff — a delete/drop/mass-delete — is the
diff class where a same-model local pass most often false-greens (the cost
of a missed regression is high, and the bug is an *absence* the author's
model already rationalized away). Compute this signal from `CAPTURED_DIFF`
before picking a mode; it is deterministic, not a judgement call:

`DESTRUCTIVE` is true when **any** of these holds over the captured range:
- a whole source/class/model file is **deleted** (`git diff --diff-filter=D
  --name-only <range>` is non-empty for a non-test, non-doc file), OR
- the diff contains a schema/data drop token — `DROP TABLE`, `DROP COLUMN`,
  `dropColumn`, `dropIfExists`, `Schema::drop`, `->drop(`, `DELETE FROM`,
  `TRUNCATE`, `->truncate(`, `rm -rf`, or a migration whose net effect is a
  removal, OR
- removal-shaped churn: deleted lines dominate (deletions ≥ 3× additions)
  AND ≥ 50 lines are removed.

This same signal is what `phase-done` computes over the phase diff to choose
its review mode (`project-transitions.md` → `phase-done` step 6).
