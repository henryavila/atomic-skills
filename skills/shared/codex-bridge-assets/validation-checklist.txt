# Output Validation Checklist

After Codex writes to `<OUTPUT_PATH>`, validate the output before consuming it.
On failure: 1 corrective retry, then escalate raw to user.

## Universal checks (both passes)

1. **File exists and is non-empty**
   - `test -s <OUTPUT_PATH>`
   - If fail: "Codex produced empty output."

2. **Frontmatter parses as YAML**
   - First line is `---`, frontmatter block ends with `---`
   - Parse with available YAML lib
   - If fail: "Frontmatter missing or malformed."

3. **`verdict` field present and in enum**
   - Must be one of: `approve`, `approve_with_nits`, `needs_changes`, `reject`

4. **`counts` is object with exact keys**
   - Keys: `blocker`, `critical`, `major`, `minor`, `nit`
   - All numeric (integer ≥ 0)

5. **`pass` field present and correct**
   - Must equal `blind` for Pass 1, `informed` for Pass 2

6. **Header `## Sumário` (PT) or `## Summary` (EN) present**

7. **Header `## Findings` present**

8. **Each finding (regex `^### F-\d{3} \[(blocker|critical|major|minor|nit)\]`) has all 5 fields**
   - `**Evidence:**` block
   - `**Claim:**`
   - `**Impact:**`
   - `**Recommendation:**`
   - `**Confidence:**` ∈ `{high, medium, low}`

9. **`counts` numbers match actual finding count by severity**

## Pass-2-only checks

10. **`pass == informed`**
11. **Header `## Pass 2 reconciliation` present**
12. **Sub-headers all present** (even if empty):
    - `### Dropped from blind pass`
    - `### Maintained`
    - `### Emerged`
13. **Each `F-XXX-blind` mentioned in reconciliation must exist in Pass 1 output** (cross-reference)

## On validation failure

Build a corrective prompt naming exactly what failed, e.g.:

> "Your previous response was missing required header `## Pass 2 reconciliation`. Re-emit the COMPLETE response in the exact template provided. Do NOT add prose before or after the template. Required structure:
>
> ```
> [paste output-template-pass2.md content]
> ```"

Invoke Codex once more with this corrective briefing. If second attempt also fails: write raw outputs to `.atomic-skills/reviews/<ts>-raw-failed.txt` and escalate to user with message:

> "Codex output did not match expected template after 1 retry. Raw output saved to <path>. Try: (a) `codex update`, (b) different model via `--ask-model`, (c) verify briefing isn't too long."
