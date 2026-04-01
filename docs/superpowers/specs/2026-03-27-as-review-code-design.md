# as-review-code Design Spec

## 1. Problem

When making code changes, it is easy to introduce functional defects, security vulnerabilities, or regressions that automated tests might miss. Traditional code reviews can be inconsistent, and AI assistants often suffer from "confirmation bias," assuming the code they just wrote is correct.

## 2. Goal

Create a new core skill, `as-review-code`, that performs an **adversarial** analysis of the current git diff. The goal is to find real bugs, not style issues.

The skill must:
- Focus on functional correctness, security, and data integrity.
- Analyze the impact of changes on the rest of the codebase (impact slicing).
- Provide high-signal, actionable feedback with concrete fixes.

## 3. Non-Goals

- Reporting code style or "nitpick" issues (indentation, naming unless misleading, etc.).
- Fixing pre-existing issues in the codebase (unless the change makes them worse).
- Replacing comprehensive automated testing.

## 4. Scope: "The Diff and its Neighbors"

The review is strictly limited to issues **introduced or exacerbated** by the current changes.

### 4.1 Impact Slicing (1-hop)
Bugs often hide at the boundaries between changed and unchanged code. The skill must:
- Identify changed functions/classes.
- Inspect direct callers (who uses this changed code?) to ensure they handle new behaviors/return types/exceptions.
- Inspect direct callees (what does this changed code use?) to ensure it uses them correctly under the new logic.

## 5. The Three Tiers of Findings

To prevent alert fatigue, findings are categorized into three tiers. Each tier MUST be present in the report. If no issues are found for a tier, it must explicitly state "None found."

### T1: Blockers (P0)
- **Correctness**: Logic errors, off-by-one, incorrect algorithms.
- **Security**: SQL injection, XSS, broken auth, credential leakage.
- **Data Integrity**: Potential data loss, corrupted state, race conditions.

### T2: Should-fix (P1)
- **Edge Cases**: Unhandled nulls, empty collections, unexpected inputs.
- **Error Handling**: Swallowed exceptions, lack of retry logic where needed.
- **Performance**: N+1 queries, accidental O(n^2) in hot paths.

### T3: Consider (P2)
- **Maintainability**: Extreme complexity, violation of core architectural patterns.
- **Test Coverage**: Critical paths introduced without corresponding tests.
- **Contracts**: Violation of documented API or internal function contracts.

## 6. Finding Metadata

Each finding must include:
1. **Description**: Clear explanation of the defect.
2. **Severity**: P0, P1, or P2.
3. **Confidence**: A score from 0 to 1 (e.g., 0.9 = very sure, 0.4 = speculative but worth checking).
4. **Evidence**: Line numbers in the diff or related files.
5. **Impact**: What happens if this is not fixed?
6. **Suggested Fix**: Literal code snippet to resolve the issue.

## 7. Anti-patterns for Rationalization

The reviewer must actively fight these mental traps:
- "The code looks clean, probably no bugs" → Trace every execution path.
- "Small change, no deep review needed" → Small changes in critical paths (auth/data) have the highest risk.
- "Tests pass, so it's correct" → Check what tests *don't* cover.
- "I found nothing, code is perfect" → Perform a second pass specifically on boundaries/impact slicing.

## 8. Success Criteria

- Maximum of ~7 findings per review to maintain high signal-to-noise ratio.
- Every finding includes a concrete code fix.
- Zero style-related "nitpicks."
- Explicit confirmation of "None found" for clean tiers.
