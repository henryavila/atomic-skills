Perform an adversarial cross-model review of the plan at $ARGUMENTS using
the OpenAI Codex CLI in two-pass sealed envelope pattern.

## Iron Law

NO IMPLEMENTATION WITHOUT EVIDENCE.
Every Codex finding must have `file:line` and the 4 fields (Claim, Impact,
Recommendation, Confidence). Findings without these are rejected.

NO INTENT IN THE BRIEFING.
The briefing sent to Codex contains ONLY externally verifiable facts.
Intent narrative poisons the reviewer by up to -93pp detection rate
(arXiv 2603.18740).

## Mindset

Codex is an adversarial reviewer from a different family (GPT). Its task
is to find gaps Claude missed due to self-preference bias
(arXiv 2410.21819). Do NOT defend the plan — facilitate the critique.

## Checklist

1. **Pre-flight checks** — follow `{{ASSETS_PATH}}/preflight-checks.txt`.
   ABORT if any check fails.

2. **Collect input**
   - $ARGUMENTS must point to an existing `.md` file.
   - Validate with {{READ_TOOL}}: the file exists and has ≥ 10 lines.

3. **Curate Pass 1 briefing (factual minimal)**
   - Read `{{ASSETS_PATH}}/pass1-briefing-template-plan.txt` with {{READ_TOOL}}.
   - Identify externally verifiable factual constraints:
     - {{BASH_TOOL}}: `grep -E "engines|peerDependencies" package.json 2>/dev/null || true`
     - {{BASH_TOOL}}: `head -20 CLAUDE.md README.md 2>/dev/null | grep -iE "must|required|forbidden" || true`
     - Verifiable technical constraints (API contracts, forbidden deps, target runtime)
   - Identify non-goals (from the plan if declared; from the project if relevant).
   - **DO NOT** include intent narrative, DO NOT include curated memory, DO NOT mention authorship.
   - Substitute placeholders:
     - `{{ANTI_FRAMING_DIRECTIVE}}` ← contents of `{{ASSETS_PATH}}/anti-framing-directive.txt`
     - `{{NON_GOALS_LIST}}` ← short bullet list with no rationale
     - `{{ARTIFACT_PATH}}` ← path of the plan
     - `{{ARTIFACT}}` ← plan content read with {{READ_TOOL}}
     - `{{OUTPUT_TEMPLATE_PASS1}}` ← contents of `{{ASSETS_PATH}}/output-template-pass1.txt`
   - Save to `/tmp/codex-briefing-pass1-<timestamp>.md`.
   - {{BASH_TOOL}}: measure tokens with `wc -c /tmp/codex-briefing-pass1-<ts>.md`.
     If (size_bytes / 4) > 800 without the artifact: WARNING to user —
     likely residual framing; request extra approval.

4. **Briefing confirmation**
   Show user in compact format:
   - Artifact: `<path>` (`<lines>` lines)
   - Factual constraints: `<list>`
   - Non-goals: `<list>`
   - Estimated tokens: `<N>`
   Ask: `approve / edit / cancel`. Wait for response.
   On cancel: abort.

5. **Pass 1 invocation (blind)**
   - Read `{{ASSETS_PATH}}/invocation-canonical.txt`.
   - Execute the command substituting:
     - `<BRIEFING_PATH>` = file from step 3
     - `<OUTPUT_PATH>` = `/tmp/codex-output-pass1-<ts>.md`
     - `<TIMEOUT_SECONDS>` = 600
     - `<MODEL_FLAG>` = empty (Codex resolves)
   - Capture exit code. If 124 (timeout): abort with message. If other !=0: abort.

6. **Pass 1 validation**
   - Follow `{{ASSETS_PATH}}/validation-checklist.txt` (universal checks 1-9).
   - Failure → 1 corrective retry. Failure again → escalate raw.

7. **Build Pass 2 briefing (informed)**
   - Briefing = Pass 1 briefing (without `Begin review now.`) + content of
     `{{ASSETS_PATH}}/pass2-prompt-suffix.txt` with:
     - `{{CONSTRAINTS_LIST}}` ← factual constraints identified in step 3
     - `{{PASS_1_OUTPUT}}` ← content of Pass 1 output
     - `{{OUTPUT_TEMPLATE_PASS2}}` ← contents of `output-template-pass2.txt`
   - Save to `/tmp/codex-briefing-pass2-<ts>.md`.

8. **Pass 2 invocation (informed)**
   - Same command as step 5, with `<BRIEFING_PATH>` = file from step 7
     and `<OUTPUT_PATH>` = `/tmp/codex-output-pass2-<ts>.md`.

9. **Pass 2 validation**
   - Universal checks 1-9 + Pass-2-specific checks 10-13 from
     `{{ASSETS_PATH}}/validation-checklist.txt`.
   - Failure → 1 corrective retry. Failure again → escalate raw.

10. **Persistence**
    - {{BASH_TOOL}}: `mkdir -p .atomic-skills/reviews/`
    - Read `{{ASSETS_PATH}}/review-file-template.txt`.
    - Substitute placeholders.
    - Save to `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md`.
    - Update `.atomic-skills/reviews/INDEX.md` (create if missing) with
      a row from `{{ASSETS_PATH}}/index-row-template.txt`.

11. **Triage + fix proposals**
    - Show user 1 line: `Verdict: <V> | Counts (final): <C> | Framing Δ: <D> | Saved at <path>`
    - If `counts_final.blocker == 0 && counts_final.critical == 0`: end.
    - Otherwise, for each finding with severity ∈ {blocker, critical}:
      - Show: ID, severity, file:line, claim, recommendation
      - Read plan file with {{READ_TOOL}} and formulate a concrete edit
      - Ask: `apply / edit / skip`
      - `apply`: use {{REPLACE_TOOL}} on the plan file
      - `edit`: receive new proposal from user, validate and apply
      - `skip`: record "skipped: <reason>" appended to the review file

12. **Closing**
    Show: `N fixes applied, M skipped, P recorded (major/minor). Review: <path>`

## Severity → Action

- **blocker / critical:** propose immediate fix; blocks "all approved"
- **major / minor / nit:** record in review file; no required action

## Red Flags

- "I'll inject project memory into the briefing to help Codex"
- "I'll write an intent steelman so Codex understands better"
- "I'll skip pre-flight, codex is installed"
- "I'll skip briefing confirmation to go faster"
- "I already validated the output mentally, no need for the checklist"
- "I'll apply all fixes without confirming with the user"
- "Verdict is needs_changes but I'll approve anyway"

If you thought any of the above: STOP and go back to the step you were skipping.

## Closing (exact format)

```
### Cross-Model Plan Review — <slug>

**Reviewer:** <model id> | **Codex:** <version>
**Codex iterations:** 2 (blind + informed)
**Counts (blind):** <B>B/<C>C/<M>M/<m>m/<n>n
**Counts (final):** <B>B/<C>C/<M>M/<m>m/<n>n
**Framing Δ:** <d>d / <=>= / <+>+

| # | Finding | Severity | Action |
|---|---------|----------|--------|
| F-001 | <claim> | blocker | applied / skipped / pending |

**Review saved at:** `.atomic-skills/reviews/<filename>.md`
**Final verdict:** <verdict>
```
