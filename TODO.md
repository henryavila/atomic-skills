# Roadmap

## Next Skills

### `as-review-code` — Adversarial Code Review of Git Diff

Review the current diff (not plans, not specs — the actual code changes) with an adversarial mindset.

**Research completed (2026-03-27).** Key design decisions:

- **Scope**: only the diff — flag issues INTRODUCED by this change, not pre-existing
- **3 tiers**: T1 Blockers (correctness, security, data integrity), T2 Should-fix (edge cases, error handling, performance), T3 Consider (maintainability, test coverage, contracts)
- **Outside-Diff Impact Slicing**: read callers/callees of changed functions (1-hop), not just the diff lines. Bugs hide at boundaries between changed and unchanged code
- **Cap ~7 findings**: more causes alert fatigue and blanket dismissal
- **"None Found" rule**: each tier must explicitly state "None found" if clean (prevents padding)
- **No style/nitpick**: if it's not a functional defect, don't report it
- **Severity + Confidence**: each finding gets P0/P1/P2 severity AND 0-1 confidence score
- **Concrete suggestions**: each finding includes a code fix, not just "consider fixing this"

**Anti-patterns for Rationalization table:**
- "The code looks clean, probably no bugs" → trace every path
- "Small change, no deep review needed" → small changes in auth/data = max blast radius
- "Tests pass, so it's correct" → check what WASN'T tested
- "I found nothing, code is perfect" → second pass on boundaries
- "Pre-existing issue, I'll mention it" → only flag THIS change's issues

**Sources**: Augment Code (45% comment-addressed rate), ODSC Impact Slicing, Codex SDK two-dimensional scoring, BMAD Blind Hunter pattern.

**Status**: Completed (2026-03-31). Implemented in `skills/en/core/review-code.md` and `skills/pt/core/review-code.md`.
