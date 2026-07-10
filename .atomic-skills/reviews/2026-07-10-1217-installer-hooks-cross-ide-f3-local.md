# Review - installer-hooks-cross-ide F3

reviewedAt: 2026-07-10T12:17:03Z
scope: 46e7748^..HEAD plus ignored local `.codex/hooks.json`
mode: local
isolation: degraded inline review in Codex session
capturedDiffBytes: 17329
destructiveDiff: false

### Analysis Summary

**Ref/scope:** 46e7748^..HEAD plus ignored local `.codex/hooks.json`
**Mode:** local
**Files reviewed:** 7
**Passes (local):** 2
**Counts (local):** blocker: 0, critical: 0, major: 1, minor: 0

| # | Finding | Severity | Mode | File:line | Action |
|---|---------|----------|------|-----------|--------|
| 1 | Final validation verifier covered a subset of state and missed invalid F3 initiative state. | major | local | .atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/f3-reparo-local-e-validacao-final.md:116 | applied |

**Reviews saved at:** `.atomic-skills/reviews/2026-07-10-1217-installer-hooks-cross-ide-f3-local.md`
**Final status:** Code approved after applied fix
**Suggestion:** keep `.codex/hooks.json` local because it is intentionally ignored by global git config.

## Findings

### 1. Final validation verifier omitted the active F3 initiative

- **What fails:** A malformed F3 initiative passed outside the final task verifier's coverage because the verifier originally called `validate-state.js` on `plan.md` and an archived F0 initiative only.
- **Why:** `validate-state.js` validates only the explicit files passed to it. Passing a subset does not validate the active F3 initiative frontmatter.
- **Impact:** T-002 and later phase gates had a path to close while F3 state was invalid.
- **Recommendation:** Run `node scripts/validate-state.js` over the full state in the final verifier, then run the project/install tests and `session-start` hook suite.
- **Fix applied:** F3 G-2 and T-002 now use full-state `node scripts/validate-state.js`; T-002 verifier then runs `node --test tests/project.test.js tests/install-uninstall-roundtrip.test.js` and `bash tests/hooks/session-start.test.sh`.
- **Verification:** The full verifier passed: full state validation reported 162 valid files; project/install tests reported 67 pass, 0 fail; `session-start.test.sh` reported 38 passed, 0 failed.

## Checklist

| Checklist item | Status | Evidence |
|----------------|--------|----------|
| Logic bugs | finding #1 | `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/phases/f3-reparo-local-e-validacao-final.md:116` now validates full state before tests. |
| Race conditions | N/A | State/config-only change; no shared runtime path introduced. |
| Error handling | ok | `.codex/hooks.json:8`, `.codex/hooks.json:18`, `.codex/hooks.json:29` use the documented wrapper fallback. |
| Schema/migrations | ok | `node scripts/validate-state.js` passed on the full state after the fix. |
| API contracts | ok | `.codex/hooks.json:3`, `.codex/hooks.json:13`, `.codex/hooks.json:23` register only the documented Codex project hook events. |
| File references | ok | `.codex/hooks.json:8`, `.codex/hooks.json:18`, `.codex/hooks.json:29` point at existing `.atomic-skills/status/hooks/*.sh` scripts. |
| Test coverage | ok | `tests/project.test.js`, `tests/install-uninstall-roundtrip.test.js`, and `tests/hooks/session-start.test.sh` passed. |

## Self-review against code-quality gates

- G1 read-before-claim: read `.codex/hooks.json`, F3 initiative, F3 plan descriptor, hook setup docs, and test output before recording the finding.
- G2 soft-language: scanned finding and fix descriptions; no `should`/`probably`/`maybe` language.
- G3 anti-tautology: no new test assertion added; existing verifier now exercises full-state validation.
- G4 fixture realism: no new fixture added.
- G7 anti-premature-abstraction: no helper introduced.
