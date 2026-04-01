Review the current git diff with an adversarial mindset to find functional defects.

## Fundamental Rule

NO STYLE NITS.
If it's not a functional defect, security vulnerability, or data integrity issue, DO NOT report it.
Focus on what can BREAK, not on how it looks.

## Mindset

{{READ_TOOL}} the diff as if the author were trying to hide a bug.
Your role is to find where the change fails, not to confirm that it's good.
If you find nothing, perform a second pass specifically on the boundaries
between changed and unchanged code (impact slicing).

## Process

### 1. Gather Context
- Use {{BASH_TOOL}} with `git diff {{#if ARG_VAR}}{{ARG_VAR}}{{else}}HEAD{{/if}}` to get the changes.
- Identify changed files and functions.
- For each changed function, identify:
    - **Callers (1-hop)**: Who calls this? Do they handle the new behavior/return/exceptions?
    - **Callees (1-hop)**: What does this call? Is it used correctly under the new logic?
- Use {{GREP_TOOL}} and {{GLOB_TOOL}} to find these neighbors.
- Use {{READ_TOOL}} to read the full context of changed files and their neighbors.

### 2. Adversarial Analysis (3 Tiers)
Analyze the diff and its neighbors against these tiers. You MUST address every tier.

#### T1: Blockers (P0) - MUST FIX
- **Correctness**: Logic errors, off-by-one, incorrect algorithms, race conditions.
- **Security**: Injection (SQL/Command), XSS, broken auth, credential leakage, unsafe defaults.
- **Data Integrity**: Potential data loss, corrupted state, partial writes without transactions.

#### T2: Should-fix (P1) - HIGHLY RECOMMENDED
- **Edge Cases**: Unhandled nulls/undefined, empty collections, boundary values, unexpected types.
- **Error Handling**: Swallowed exceptions, lack of retry logic, poor error messages for debugging.
- **Performance**: N+1 queries, O(n^2) in hot paths, memory leaks, blocking the event loop.

#### T3: Consider (P2) - IMPROVEMENTS
- **Maintainability**: Extreme cyclomatic complexity, violation of core architectural patterns.
- **Test Coverage**: Critical paths introduced without corresponding tests.
- **Contracts**: Violation of documented API or internal function contracts.

### 3. Generate Report
- Limit to ~7 findings total to ensure high signal.
- If a tier is clean, explicitly state "None found".
- Each finding MUST include:
    - **Severity**: P0, P1, or P2.
    - **Confidence**: 0.0 to 1.0.
    - **Evidence**: File path and line numbers.
    - **Impact**: What happens if ignored.
    - **Suggested Fix**: Literal code snippet.

## Output Format

### Code Review: [Brief Description of Changes]

**Tier 1: Blockers (P0)**
- [Finding 1] (Confidence: X.X)
  - **Evidence**: `path/to/file.ext:L123`
  - **Impact**: [Description]
  - **Fix**:
    ```[language]
    [code]
    ```
- (If none) None found.

**Tier 2: Should-fix (P1)**
- ...

**Tier 3: Consider (P2)**
- ...

## Rationalization

| Temptation | Reality |
|------------|---------|
| "The code looks clean" | Clean code is where subtle logic bugs hide |
| "Small change, low risk" | Small changes in auth/data = max blast radius |
| "Tests pass, so it's correct" | Tests only prove what they test, not what they don't |
| "It's a pre-existing issue" | If the change touches it or makes it worse, it's fair game |
| "I'll mention the naming style" | STOP. Style is not a functional defect. Delete the finding |

## Red Flags
- Reporting indentation, trailing spaces, or variable naming (unless misleading).
- Approving a change to a critical path without checking its callers.
- Finishing the review in under 2 minutes for a large diff.
- Finding 0 issues in a complex logic change (re-read it!).
