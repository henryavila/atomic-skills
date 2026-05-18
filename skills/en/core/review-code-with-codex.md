Perform an adversarial cross-model review of code changes at $ARGUMENTS
using the OpenAI Codex CLI in two-pass sealed envelope pattern.

## Iron Law

NO IMPLEMENTATION WITHOUT EVIDENCE.
Every finding has `file:line` + 4 required fields (Claim, Impact,
Recommendation, Confidence). Without these, the finding is rejected.

NO INTENT IN THE BRIEFING.
The briefing contains ONLY verifiable facts. Intent narrative poisons
the reviewer (-93pp in arXiv 2603.18740).

## Mindset

Codex is an adversarial reviewer from a different family. Find bugs,
vulnerabilities, race conditions — don't defend the code.

## Checklist

1. **Pre-flight checks** — follow `{{ASSETS_PATH}}/preflight-checks.txt`. ABORT if any fails.

2. **Collect input**
   - $ARGUMENTS is a git ref: `main..HEAD`, branch, commit range.
   - Validate with {{BASH_TOOL}}: `git rev-parse --verify <ref>` exits 0.

3. **Gather artifacts**
   - {{BASH_TOOL}}: `git diff <ref>` → capture DIFF
   - {{BASH_TOOL}}: `git diff --name-only <ref>` → list of modified files
   - For each modified file: {{READ_TOOL}} for full content
   - For each modified public symbol: {{GREP_TOOL}} for callers (limit 5)
   - {{BASH_TOOL}}: `wc -c` on DIFF — if > 50000: warn user about cost

4. **Curate Pass 1 briefing (factual minimal)**
   - Read `{{ASSETS_PATH}}/pass1-briefing-template-code.txt` with {{READ_TOOL}}.
   - Identify externally verifiable factual constraints:
     - `package.json` engines, forbidden deps
     - Public API contracts (grep README/docs)
     - Schema/migration constraints if any
   - Identify non-goals (short, no rationale).
   - **DO NOT** include intent, memory, authorship.
   - Substitute placeholders and save to `/tmp/codex-briefing-pass1-<ts>.md`.
   - Verify briefing size without diff: < 800 tokens.

5. **Briefing confirmation**
   Show: git ref, modified files, callers included, estimated tokens.
   Ask: `approve / edit / cancel`.

6. **Pass 1 invocation (blind)** — follow `{{ASSETS_PATH}}/invocation-canonical.txt`.
   MODEL_FLAG empty by default: Codex resolves via your local config
   (`~/.codex/config.toml`) or the bundled CLI default. User can override
   by passing `model:<id>` explicitly.

7. **Pass 1 validation** — `{{ASSETS_PATH}}/validation-checklist.txt` (universal).

8. **Build Pass 2 briefing (informed)** — append `pass2-prompt-suffix.txt`
   substituting `{{CONSTRAINTS_LIST}}`, `{{PASS_1_OUTPUT}}`, `{{OUTPUT_TEMPLATE_PASS2}}`.

9. **Pass 2 invocation** — same command.

10. **Pass 2 validation** — universal checks + Pass-2-only.

11. **Persistence** — `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md`
    using `review-file-template.txt`. Update `INDEX.md`.

12. **Triage + fix proposals**
    - For each finding with severity ∈ {blocker, critical}:
      - Show ID, severity, file:line, claim, recommendation
      - {{READ_TOOL}} the file, formulate edit
      - Ask: `apply / edit / skip`
      - apply uses {{REPLACE_TOOL}}
    - Major/minor/nit: record in review file, no required action.
    - Suggest user run tests if fixes were applied.

## Severity → Action

- **blocker:** breaks prod, data loss, security breach — required fix
- **critical:** bug hitting users in normal use — required fix
- **major:** real bug with workaround — fix if possible
- **minor / nit:** record, no required action

## Red Flags

- "I'll skip the whole diff, it's too big"
- "I'll add architectural context to help Codex"
- "I'll skip callers, just the diff is enough"
- "I'll apply all fixes in batch without confirming"
- "Codex said approve but I think it needs more review"

If you thought any of the above: STOP.

## Closing (exact format)

```
### Cross-Model Code Review — <ref>

**Reviewer:** <model id> | **Codex:** <version>
**Files reviewed:** <N>
**Codex iterations:** 2 (blind + informed)
**Counts (blind):** <B>B/<C>C/<M>M/<m>m/<n>n
**Counts (final):** <B>B/<C>C/<M>M/<m>m/<n>n
**Framing Δ:** <d>d / <=>= / <+>+

| # | Finding | Severity | File:Line | Action |
|---|---------|----------|-----------|--------|
| F-001 | <claim> | blocker | src/foo.ts:42 | applied |

**Review saved at:** `.atomic-skills/reviews/<filename>.md`
**Final verdict:** <verdict>
**Suggestion:** run `npm test` if fixes were applied.
```
