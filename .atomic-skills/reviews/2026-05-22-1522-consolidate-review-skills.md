---
date: 2026-05-22T15:22:15-03:00
topic: consolidate-review-skills
artifact: HEAD (commit fafc29a)
skill: review-code-with-codex
reviewer: gpt-5-codex
codex_version: codex-cli 0.130.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
framing_delta: {dropped: 1, maintained: 2, emerged: 1}
schema_version: "1.0"
---

# Cross-Model Review — consolidate-review-skills

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The consolidation leaves normal invocations with broken or misleading execution paths. `review-plan --mode=internal` can fail before it reaches the short-circuit, `review-code` is cataloged as non-mutating while instructing edits, and `review-code-with-codex` still gathers the wrong diff for single refs after expanding validation to include them.

## Findings

### F-001 [major] Correctness — skills/en/core/review-plan.md:29-37

**Evidence:**
```md
1. {{READ_TOOL}} the plan file at {{ARG_VAR}}.
2. Scan for sections matching `^##? (Source Documents|References|Artifacts|Inputs|Originated From|Based On)` (regex case-insensitive). Under each, extract bullet/link tokens and CLASSIFY each one:
...
3. **Non-interactive mode short-circuit:** if {{ARG_VAR}} matches `<plan-path> --mode=internal` (or the agent's caller passed `mode=internal` via a structured invocation envelope where supported), SKIP the prompt in step 4 and set `mode = internal` directly.
```

**Claim:** `/atomic-skills:review-plan docs/plan.md --mode=internal` tells the agent to read the literal argument string as a file before parsing `--mode=internal`.

**Impact:** The documented non-interactive path for `project-plan` and `project-status` can abort on “file not found” instead of running the mandatory internal review, blocking those workflows or forcing manual recovery.

**Recommendation:** Parse flags and derive the plan path before any `{{READ_TOOL}}` call; make Step 0.1 read only the parsed plan path.

**Confidence:** high

---

### F-002 [major] Metadata contract — meta/skills.yaml:83-108

**Evidence:**
```yaml
  review-code:
    name: review-code
...
    requires_args: true
    mutates_repo: false
```

```md
1. Walk the diff once. Apply EACH checklist item. For each item, record:
   status (ok / problem), `file:line` verified. Fix findings directly in
   the source files when a fix is obvious; otherwise propose the
   correction in the closing table for the user to apply.
...
4. If new bugs were found: fix and go back to step 2.
```

**Claim:** The catalog marks `review-code` as non-mutating while the skill body explicitly instructs agents to edit source files.

**Impact:** Any UI, catalog consumer, or user relying on `mutates_repo: false` gets an incorrect safety signal and can launch what appears to be a read-only review that changes the working tree.

**Recommendation:** Either set `mutates_repo: true` or change the skill body to report findings only and never apply edits.

**Confidence:** high

---

### F-003 [major] Correctness — skills/en/core/review-code-with-codex.md:23-42

**Evidence:**
```md
2. **Collect input**
   - $ARGUMENTS is a git ref: branch, single commit, or commit range
     (e.g. `main..HEAD`, `main...HEAD`).
...
3. **Gather artifacts**
   - {{BASH_TOOL}}: `git diff <ref>` → capture DIFF
   - {{BASH_TOOL}}: `git diff --name-only <ref>` → list of modified files
```

**Claim:** Single commits and branches are now accepted inputs, but artifact gathering still uses raw `git diff <ref>`, which does not mean “review this commit” or “review this branch against its base.”

**Impact:** For a single commit, Codex reviews the worktree relative to that commit instead of the commit patch; for a branch, unrelated local edits can leak into the review or the intended branch delta can be missed.

**Recommendation:** Reuse the shape-specific diff logic from `review-code`: `git show --format= --patch <commit>` for single commits, merge-base diff for branches, and raw `git diff <range>` only for ranges.

**Confidence:** high

## Questions (non-findings)

- None.

## Out of scope

- README.pt-BR consistency, catalog v0.2 expansion, and installed derived skill artifacts.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The informed pass maintains two blind findings and adds one constraint-triggered finding. The new `review-plan` non-interactive path is internally ordered so flags can be included in the file path before they are parsed, and `review-code` advertises read-only metadata while instructing edits. In addition, the mandatory tool-abstraction rule is violated by literal tool names inside skill bodies.

## Findings

### F-001 [major] Correctness — skills/en/core/review-plan.md:29

**Evidence:**
```md
1. {{READ_TOOL}} the plan file at {{ARG_VAR}}.
```

**Claim:** `/atomic-skills:review-plan docs/plan.md --mode=internal` can instruct the agent to read the literal full argument string as a file before it extracts `--mode=internal`.

**Impact:** The documented non-interactive callers, `project-plan` and `project-status`, can fail their mandatory internal review with a file-not-found path like `docs/plan.md --mode=internal`, blocking the workflow or requiring manual interpretation to recover.

**Recommendation:** Make Step 0 parse `{{ARG_VAR}}` into `plan_path`, `mode`, and optional `artifacts` before any read; every later read should target `plan_path`, not raw `{{ARG_VAR}}`.

**Confidence:** high

---

### F-002 [major] Metadata contract — meta/skills.yaml:107

**Evidence:**
```yaml
    mutates_repo: false
```

**Claim:** The catalog marks `review-code` as non-mutating while the skill body instructs agents to edit source files.

**Impact:** The dashboard and install surfaces can present `review-code` as read-only even though invoking it can change the working tree, so users can run a review expecting no repo mutation and receive edits instead.

**Recommendation:** Set `review-code.mutates_repo: true`, or change `skills/en/core/review-code.md` to report findings only and never apply fixes.

**Confidence:** high

---

### F-003 [major] Tool abstraction — skills/en/core/review-code.md:74

**Evidence:**
```md
AskUserQuestion tool; Gemini / Cursor / Codex CLI / Opencode /
```

**Claim:** The skill body contains the literal hardcoded tool name `AskUserQuestion tool` instead of using only `{{ASK_USER_QUESTION_TOOL}}`.

**Impact:** This violates the mandatory repository rule for skill bodies and can leave rendered non-Claude prompts containing Claude-specific tool terminology, creating inconsistent or broken instructions for Gemini, Cursor, Codex CLI, Opencode, GitHub Copilot, and generic render targets.

**Recommendation:** Replace the literal `AskUserQuestion tool` mention with `{{ASK_USER_QUESTION_TOOL}}` or a tool-neutral description.

**Confidence:** high

## Questions (non-findings)

- None.

## Out of scope

- README.pt-BR consistency.
- Catalog `schema_version: 0.2` expansion.
- Installed derived skill artifacts under `.claude/commands/atomic-skills/`.
- The scoped decision not to rewrite `review-code-with-codex` artifact gathering commands in this commit.

## Pass 2 reconciliation

### Dropped from blind pass

- F-003-blind [major] Correctness — DROPPED: the external constraints state Phase 3 intentionally scoped `review-code-with-codex` to only the rev-parse validation fix and explicitly excluded the shape-specific diff rewrite.

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same

### Emerged

- F-003-final [major] Tool abstraction — emerged: the factual constraint makes hardcoded tool names in skill bodies mandatory violations, and `review-code.md` includes a literal `AskUserQuestion tool` mention.

## Briefings used

<details>
<summary>Pass 1 briefing (truncated for compactness — diff omitted)</summary>

The full Pass 1 briefing (109,901 bytes) is at `/tmp/codex-briefing-pass1-20260522-150421.md`.
It included: factual constraints (engines, tool abstraction, schema_version 0.1), non-goals
(README.pt-BR, schema v0.2, Iron Law normalization, HelpView regen), out-of-scope list,
the full diff at HEAD, and supplementary final-state contents of `src/render.js`,
`tests/render.test.js`, and `meta/skills.yaml`.

</details>

<details>
<summary>Pass 2 briefing (informed delta)</summary>

Pass 2 added an `## External constraints (verifiable)` section to clarify:

- Skill bodies are markdown prompts (not executable), so flag-parsing is a natural-language responsibility documented in Step 0.
- `mutates_repo` is metadata-only — no runtime enforcement; consumed by install/dashboard hints.
- The plan `docs/plan-review-skills-consolidation.md` explicitly scopes Phase 3 of `review-code-with-codex` to ONLY the rev-parse validation fix, deliberately excluding the shape-specific diff rewrite.
- Argument parsing in skill bodies is by convention; there is no shared parser.

Full Pass 2 briefing (118,181 bytes) at `/tmp/codex-briefing-pass2-20260522-150421.md`.

</details>

## Fixes applied in this session

- **F-001 → applied** — `skills/en/core/review-plan.md` Step 0: reordered to parse `{{ARG_VAR}}` into `plan_path` + `cli_mode` + `--artifacts` BEFORE any `{{READ_TOOL}}` call. Step 0.1 explicitly forbids passing raw `{{ARG_VAR}}` to the reader. Renumbered remaining steps (was 6 sub-items, now 7 with the explicit parse step first).
- **F-002 → applied** — `meta/skills.yaml`: `review-code.mutates_repo: false` → `true`. Now matches the body that instructs in-place fixes.
- **F-003 → applied** — `skills/en/core/review-code.md:67-72`: literal "AskUserQuestion tool" replaced with tool-neutral "native multi-choice prompt tool". All `{{ASK_USER_QUESTION_TOOL}}` template-var usages preserved.

## Self-review against code-quality gates

- **G1 read-before-claim:** all 3 fixes pasted the actual current source lines before formulating the edit (visible in Edit tool call old_string blocks).
- **G2 soft-language:** scanned fix descriptions for `should | probably | may | typically | usually`. Zero occurrences. The new review-plan Step 0 text uses imperative voice ("Parse {{ARG_VAR}} BEFORE any file read", "Strip any trailing whitespace", "abort with: ...").
- **G3 anti-tautology:** no new test assertions added (fixes touched skill bodies + 1 yaml line; existing 382 tests still pass — no new tests needed because the changes are markdown prompt logic and a metadata flag, not JS branching).
- **G4 fixture realism:** N/A — no new fixtures introduced.
- **G7 anti-premature-abstraction:** no new helper introduced. Each fix is a localized edit.

## Validation post-fix

- `npm test` → 382/382 pass (unchanged from pre-fix; expected — fixes are markdown + 1 yaml line).
- `npm run validate-skills` → 13 skills valid (unchanged).
- `grep -n 'AskUserQuestion' skills/en/core/review-plan.md skills/en/core/review-code.md` → 0 literal mentions (all are `{{ASK_USER_QUESTION_TOOL}}`).
