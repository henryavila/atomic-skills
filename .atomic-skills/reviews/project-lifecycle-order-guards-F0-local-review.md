# Review local - project-lifecycle-order-guards F0

- Reviewed range: `2f9c8bdee197f4204637301b0a83226760046535..5c5167b17a2b5b012b3b50726b727a54b48fb55a`
- Mode: `local` fallback inline; subagent isolation unavailable under current tool policy.
- Captured diff: `/tmp/project-lifecycle-order-guards.phase.diff`, `33982` bytes.
- Destructive signal: false; `git diff --diff-filter=D --name-only 2f9c8bdee197f4204637301b0a83226760046535..HEAD` returned no paths.
- Final verifier: `rtk node --test tests/lifecycle-order-guard.test.js tests/help/compute-help.test.js tests/detect-orphan-worktrees.test.js tests/help/help-vocab.test.js tests/project.test.js tests/worktree-teardown.test.js tests/finalize-plan-scope.test.js tests/validate-state.test.js` -> `tests 244`, `pass 244`, `fail 0`.

## Result

verdict: clean_after_fix
total_findings: 1
counts: blocker=0 critical=0 major=1 minor=0
passes: 2

| # | Summary | Severity | File:line | Mechanism | Impact | Recommendation | Action |
|---|---|---|---|---|---|---|---|
| 1 | `pr.state: 'NONE'` was treated as publication attempt. | major | `scripts/lifecycle-order-guard.js:97` | `text(pr.state)` made any non-empty PR state truthy, including `NONE`, so archive chose `archive-missing-merge` instead of `archive-missing-publication`. | A plan with no PR would be told to merge a non-existent PR instead of running `finalize <slug>`. | Treat `NONE` as no publication attempt and add a regression test. | Applied in `5c5167b`. |

## Checklist

| Checklist item | Status | Evidence |
|---|---|---|
| Logic bugs | fixed finding #1 | `scripts/lifecycle-order-guard.js:93` normalizes `prState`; `scripts/lifecycle-order-guard.js:98` excludes `NONE`. |
| Race conditions | N/A | Pure synchronous helpers only: `scripts/lifecycle-order-guard.js:300`, `scripts/detect-orphan-worktrees.js:72`, `scripts/compute-help.js:474`. |
| Error handling | ok | Fail-open catches remain in `scripts/compute-help.js:270` and `scripts/compute-help.js:458`; detector swallows injected ancestry failures at `scripts/detect-orphan-worktrees.js:32`. |
| Schema/migrations | ok | `rtk node --test ... tests/validate-state.test.js` -> `tests 244`, `pass 244`, `fail 0`. |
| API contracts | ok | Public exports remain `classifyLifecycleOrder` at `scripts/lifecycle-order-guard.js:300` and `findOrphanWorktrees` at `scripts/detect-orphan-worktrees.js:72`. |
| File references | ok | Callers found by `rtk rg -n "classifyLifecycleOrder|findOrphanWorktrees" scripts skills tests docs meta`. |
| Test coverage | ok | Regression test at `tests/lifecycle-order-guard.test.js:39`; detector blocking tests at `tests/detect-orphan-worktrees.test.js:37` and `tests/detect-orphan-worktrees.test.js:52`. |

## Self-review against code-quality gates

- G1 read-before-claim: applied - source lines were read before recording the finding and fix.
- G2 soft-language: applied - review claims use captured verifier output.
- G3 anti-tautology: applied - the new assertion kills the `text(pr.state)` mutant by requiring `archive-missing-publication` for `NONE`.
- G4 fixture realism: N/A - no external fixture sample added.
- G7 anti-premature-abstraction: applied - no new helper abstraction introduced.
