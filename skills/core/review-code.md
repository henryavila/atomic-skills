Perform an adversarial analysis of the code changes at {{ARG_VAR}}
(a git ref — branch, single commit, or commit range — or a scope
keyword: `wip`, `branch`, `all`; empty → interactive scope picker)
looking for logic bugs, race conditions, error handling gaps,
schema/migration inconsistencies, and missing tests. Step 0 picks one of three modes:
`local` (same-model sealed envelope via agent with clean context),
`codex` (cross-model two-pass sealed envelope via OpenAI Codex CLI), or
`both` (local agent first → codex on the same captured diff).

## Iron Law

NO APPROVAL WITHOUT EVIDENCE.
- Local mode: each finding MUST cite `file:line`. Bug claims without `file:line` are rejected.
- Codex mode: every codex finding MUST have `file:line` + 4 fields (Claim, Impact, Recommendation, Confidence). Findings without these are rejected.

NO INTENT IN THE BRIEFING (local + codex).
Intent narrative poisons reviewers by up to -93pp detection rate
([arXiv 2603.18740](https://arxiv.org/abs/2603.18740)).
- **Local review** runs in a separate agent with clean context via
  {{INVESTIGATOR_TOOL}}. The agent receives only the diff and file list —
  no conversation history, no commit messages, no user intent.
- **Codex review** uses a sealed briefing with anti-framing directive.
- **Both mode:** neither reviewer sees the other's findings. The codex
  briefing must NOT include local findings, fix descriptions, iteration
  counts, or any narrative implying a prior review took place.

## Mindset

Read the diff as if the author were wrong. Your role is to find bugs,
not to confirm the change is clean. If you finish without findings, it's
more likely you missed something than the diff being perfect — re-read
the checklist and force a second pass.

In codex sub-flow: codex is an adversarial reviewer from a different
family (GPT). Find bugs, vulnerabilities, race conditions — don't defend
the code.

## Argument & diff capture

Before Step 0, {{READ_TOOL}} `skills/shared/local-review-assets/diff-capture.md`
and execute it. It parses {{ARG_VAR}} (flags + `git_ref` / scope keyword),
resolves the scope, validates the ref shape, applies the dirty-tree policy, and
materializes `CAPTURED_DIFF` + `CAPTURED_FILES` ONCE — plus `SCOPE`, the
{{GIT_REF}} label, and the deterministic `DESTRUCTIVE` signal. Step 0 and both
review phases consume those outputs; never re-run `git diff`.

## Step 0 — Pick review mode

Skip this step if `--mode=` was supplied. Otherwise, use
{{ASK_USER_QUESTION_TOOL}}:

**Question:** "How should this code change be reviewed?" (When `DESTRUCTIVE`
is true, prepend: *"⚠ This diff is predominantly destructive (deletes/drops).
A same-model local-only pass frequently misses the orphaned-data / dangling-
reference regression a delete leaves behind — cross-model is strongly
advised."*)

**Options:**
- **Both (local then codex)** — Recommended for significant changes
  (auth, payments, data integrity) and **strongly recommended for any
  destructive diff**. Local agent catches obvious bugs; codex catches what
  the agent missed. ~$1-2 codex cost.
- **Local only** — Cheap, fast. Use for routine PRs or pre-commit checks.
  **Not advised when `DESTRUCTIVE` is true** — if chosen anyway, record the
  user's explicit override (the false-green risk was surfaced and accepted).
- **Codex only** — Skip local. Use when another agent self-reviewed.

Default: **Both** — and when `DESTRUCTIVE` is true, `both` is not merely the
default but the recommended option; the picker leads with the warning above
so a user choosing `local` does so against an explicit caution, never by
omission.

Set `mode ∈ {local, codex, both}` based on the answer.

Why route all user prompts through {{ASK_USER_QUESTION_TOOL}}: the
template var resolves per IDE — Claude Code uses its native multi-choice
prompt tool; Gemini / Cursor / Codex CLI / Opencode / GitHub Copilot /
generic receive a descriptive string so the agent renders the prompt as
plain text. Hardcoding any specific tool name would break the other IDEs.

---

## Step 0.5 — Surface-review dedup (`review-dedup`, fail-para-RE-revisar)

Before running a pass, consult the **surface-review ledger** so the same surface is
not re-reviewed in the same mode under parallel worktrees. The ledger is the pure
module `scripts/review-ledger.js` (F7/T-001) over
`.atomic-skills/status/last-review.json`; this skill NEVER re-implements the
match logic, it defers to that module.

1. **Fingerprint the surface** from the captured range (deterministic, from Step 6):
   - `commitSha` = the tip SHA of the reviewed range (e.g. `git rev-parse <git_ref>`
     for a ref/range; for `wip`/`all` the working tree has no commit → leave empty,
     which forces RE-review, never a skip).
   - `patchId` = `git diff <range> | git patch-id --stable | awk '{print $1}'`
     (stable under squash/rebase — the SHA may be rewritten, the patch-id holds).
2. **Per-mode skip with POSITIVE proof only.** For EACH mode about to run
   (`local` and/or `codex`), read the ledger content from
   `.atomic-skills/status/last-review.json` and call
   `alreadyReviewed(content, { commitSha, patchId }, mode)`. If it returns **true**,
   SKIP that mode's pass and announce: `review-dedup: <mode> pass skipped — surface
   already reviewed (<commitSha|patchId>).` The dedup is **per mode**: a `local`
   hit does NOT skip the `codex` pass and vice-versa (one model's pass never
   discharges the other's). In `mode == both`, evaluate the two modes independently;
   if both are already-reviewed, report up-to-date and END.
3. **Fail-para-RE-revisar.** Skip ONLY on a positive `alreadyReviewed`. A pointer /
   absent / malformed `last-review.json` is read by the module as "nothing reviewed"
   (it returns false), so the pass RUNS — indeterminacy never skips a review.
4. **Record after a pass completes** (a verdict was produced): append a ledger record
   with `recordReview(content, { commitSha, patchId, mode, reviewedAt, reviewFile })` —
   append-only (prior lines preserved → `merge=union`-safe per F5), one record per mode
   per surface, never overwriting earlier entries. The persisted review file (Step
   "Persist") supplies `reviewFile`. **Do NOT unilaterally flip a project's
   `last-review.json` format:** where a project still keeps the legacy single-pointer
   shape with pointer-readers not yet migrated (e.g. this repo — see `project-drift.md`'s
   "State file" ⚠️ note), the record-back-write is deferred to that project's coordinated
   lockstep flip; until then the skip-read above is the only active dedup effect (safe,
   since a pointer reads as "nothing reviewed"). `recordReview` on a legacy pointer starts
   a fresh ledger, so the flip happens the first time the write-back is enabled.

This dedup is the code legs only (`review-code` local + codex, and `review-due` →
`project-drift.md`); the `project review` composer (Layer B) carries its own
append-only run-record via a separate work-order, never written from here.

---

## Flow per mode

### Flow A — `mode == local`

Argument & diff capture → Step 0 → `local`. Prepare briefing → spawn
**Local review agent** (below) → receive findings → **Triage + fix**
(below). END.

### Flow B — `mode == codex`

Argument & diff capture → Step 0 → `codex`. Run **Codex sub-flow**
(below). END.

### Flow C — `mode == both`

Argument & diff capture → Step 0 → `both`.

1. **LOCAL PHASE** — Prepare briefing → spawn **Local review agent** on
   `CAPTURED_DIFF` → receive findings → **Triage + fix** (below). Track
   fix descriptions for the audit trail. The audit trail goes into the
   persisted review file, NOT the codex briefing.

2. **CODEX PHASE** — Run Codex sub-flow on the SAME `CAPTURED_DIFF`. The
   Pass-1 briefing MUST NOT mention local findings, fix descriptions,
   iteration counts, or that a prior review took place. The codex sees
   the diff as if it were the first review.

   **Smoke test invariant:** the `CAPTURED_DIFF` consumed by both phases
   must be byte-identical. If you suspect drift (e.g. fixes mutated the
   tree between local triage and codex phase), abort the codex phase and
   warn — the local fixes contaminate the cross-model invariant.

   **Stash protocol (mode == both):** if the local triage applied fixes,
   `git stash` the dirty tree before the codex phase, then `git stash pop`
   after. This keeps the working tree clean for codex preflight checks
   while preserving the local fixes.

END.

---

## Local review agent (modes: local, both)

The local review runs in a **separate agent with clean context** to
prevent intent leakage from the conversation. The operator prepares a
sealed briefing; the agent reviews and returns findings; the operator
triages and applies fixes.

**Rationale:** reviewing in the same context window that discussed the
change causes confirmation bias — the reviewer "knows" what the code
should do and validates intent instead of verifying behavior. A clean
context forces the reviewer to derive intent from the code itself.

### Step 1 — Prepare briefing (operator)

1. {{READ_TOOL}} `skills/shared/local-review-assets/briefing-template.txt`.
2. {{READ_TOOL}} `skills/shared/codex-bridge-assets/anti-framing-directive.txt`.
3. Substitute placeholders in the template:
   - `{{ANTI_FRAMING_DIRECTIVE}}` ← contents of anti-framing-directive.txt
   - `{{GIT_REF}}` ← the git ref being reviewed (for keyword scopes, the
     neutral label from Scope resolution)
   - `{{CAPTURED_FILES_LIST}}` ← newline-separated list from `CAPTURED_FILES`
   - `{{DIFF}}` ← `CAPTURED_DIFF`
4. The substituted briefing is the agent's prompt. It contains NO
   conversation context, NO commit messages, NO user intent.

### Step 2 — Spawn review agent

Invoke {{INVESTIGATOR_TOOL}} with:
- **description:** `Adversarial code review of <git_ref>`
- **prompt:** the substituted briefing from Step 1

The agent operates in a clean context: no conversation history, no
knowledge of why the change was made, no prior findings. It reads files
and greps callers using its own tools.

**Fallback:** if {{INVESTIGATOR_TOOL}} is unavailable (IDE does not
support agent spawning), run the checklist inline in the current context.
Log a warning: "Local review running in shared context — isolation
degraded." Apply the checklist items from the briefing template directly.

### Step 3 — Triage + fix (operator)

Parse the agent's output. For each finding:

1. **Verify** — {{READ_TOOL}} the cited `file:line`. Confirm the finding
   is real, not a hallucination or stale reference.
2. **Classify** — real bug / false positive / already handled.
3. **Act:**
   - Real bug with obvious fix → apply via {{REPLACE_TOOL}}.
   - Ambiguous finding → present to user: `apply / edit / skip`.
   - False positive → record as dismissed with reason.

**Verification loop (max `--max-iterations`, default 3):**
- After applying fixes: {{READ_TOOL}} each modified file from the beginning.
- Verify fixes did not introduce new problems and no finding was missed.
- If new bugs found: fix and loop.
- If clean: loop ends.
- **Convergence rule (plateau detection):** after each iteration, count remaining CRITICAL + MAJOR findings. If the count did NOT decrease compared to the previous iteration (plateau or increase), STOP immediately and escalate to the user: "Findings plateaued at N CRITICAL + M MAJOR after K iterations. Fix-review loop is not converging — manual review needed." Do NOT continue looping when findings are not converging — additional iterations produce churn without progress.
- If `--max-iterations` reached and still problems: STOP and escalate.

---

## Codex sub-flow (modes: codex, both)

Run the canonical two-pass sealed envelope per
`{{ASSETS_PATH}}/envelope-orchestration.md` (the byte-identical 12-step skeleton
shared with `review-plan`). It uses the canonical leaf assets in
`skills/shared/codex-bridge-assets/` as the single source of truth. Bind these
code-review artifact slots:

- **`«INPUT»`** — `CAPTURED_DIFF` and `CAPTURED_FILES` from the argument-capture
  step. Do NOT re-run `git diff`.
- **`«PASS1_TEMPLATE»`** — `{{ASSETS_PATH}}/pass1-briefing-template-code.txt`.
- **`«CONSTRAINTS»`** — `package.json` engines / forbidden deps; public API
  contracts (grep README/docs); schema/migration constraints if any. Gather
  extra context: for each file in `CAPTURED_FILES` ensure {{READ_TOOL}} ran and
  the content is available; for each modified public symbol {{GREP_TOOL}} for
  callers (limit 5).
- **`«ARTIFACT»`** — `CAPTURED_DIFF` (NOT a fresh `git diff`).
- **`«SIZE_BUDGET»`** — < 800 tokens (briefing without the diff).
- **`«TRIAGE_TARGET»`** — the changed source file(s).
- **`«TRIAGE_NOTES»`** — after applying fixes, suggest the user run tests.

---

## Severity → Action

- **Blocker / critical:** breaks prod / data loss / security breach / bug hitting users in normal use — MUST be fixed before merge.
- **Major:** real bug with workaround — fix if possible.
- **Minor:** small issue; rare edge case — record, no required action.

## Code-quality gates (review lens)

When triaging findings and applying fixes, the code you write is bound by `docs/kb/code-quality-gates.md` — apply **G1** (read-before-claim), **G2** (soft-language ban in fix descriptions/commit messages), **G3** (anti-tautology in tests), **G4** (fixture realism, 60-second sample rule), and **G7** (premature-abstraction ban; three-site floor). See the KB for the definitions + good/bad examples; the self-review block below is where they shape the review output.

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
- "I'll run the local review in my current context — spawning an agent is overkill" (breaks sealed envelope)
- "I'll include a summary of the user's request in the agent briefing — it needs context" (intent leakage into local review)
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
| "I already know what the code does, reviewing in a fresh context is wasteful" | That knowledge IS the contamination — the agent must derive intent from code, not from you |
| "Codex will figure it out from context" (codex) | Sealed envelope: facts only |
| "The local pass already found everything, codex is a formality" (both) | Empirically codex catches disjoint findings — see [arXiv 2603.12123](https://arxiv.org/abs/2603.12123) |

## Closing

Present the summary in this format. Sections marked `(local/both)` only
appear in the corresponding mode; `(codex/both)` likewise.

```markdown
### Analysis Summary

**Ref/scope:** {{ARG_VAR}} (or the resolved scope when the picker ran)
**Mode:** local | codex | both
**Files reviewed:** [N]
**Passes (local):** [N] (local/both only)
**Codex iterations:** 2 (blind + informed) (codex/both only)
**Counts (local):** blocker: X, critical: Y, major: Z, minor: W (local/both only)
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
