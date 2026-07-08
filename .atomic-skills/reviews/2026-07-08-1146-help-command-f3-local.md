# Review: help-command F3

Ref/scope: `61349088f34701cfe7781c41097434cb89247c16..58357c52831158668fd3cc8854f50d34af2c78ba`
Mode: local
Reviewed at: 2026-07-08T11:46:36Z
Review isolation: local review ran inline because subagent spawning is not permitted by this session's tool policy; isolation degraded.
Destructive diff: false

## Summary

verdict: clean after fix
total_findings: 1 applied, 0 remaining
counts before fix: blocker=0 critical=0 major=1 minor=0
counts after fix: blocker=0 critical=0 major=0 minor=0
passes: 2

| # | Summary | Severity | File:line | Action |
|---|---------|----------|-----------|--------|
| 1 | Router byte-budget compaction removed the explicit `schemaVersion` acceptance policy for `0.1`/`0.2`, weakening the operator contract while preserving only writer behavior. | major | skills/core/project.md:9 | applied in commit `58357c5` |

## Checklist

| Checklist item | Status | Evidence |
|----------------|--------|----------|
| Logic bugs | fixed finding #1 | skills/core/project.md:9 |
| Race conditions | N/A | no shared mutable runtime path in reviewed help/install/docs changes |
| Error handling | ok | src/runtime-layers/effects/stage-runtime-artifacts.js conflict path rejects non-owned targets and tests cover source/sourceTree/content |
| Schema/migrations | ok | scripts/validate-state.js scopes closedAtHardening by `__projectId`; tests/validate-state.test.js covers same-slug cross-project case |
| API contracts | ok | tests/project.test.js covers `help`, `help --html`, and `next` dispatch to project-help.md |
| File references | ok | tests/help/help-vocab.test.js reads `meta/catalog.yaml` and imported help fixtures; `npm test` passes |
| Test coverage | ok | `npm test` and `node --test tests/help/help-vocab.test.js` passed at reviewed HEAD |

## Verification

- `rtk node --test tests/project.test.js` -> tests 51, pass 51, fail 0
- `rtk node --test tests/skill-byte-budget.test.js` -> tests 8, pass 8, fail 0
- `rtk npm test` -> tests 1610, pass 1608, fail 0, skipped 2
- `rtk node --test tests/help/help-vocab.test.js` -> tests 4, pass 4, fail 0

## Self-review against code-quality gates

- G1 read-before-claim: re-read `skills/core/project.md` with line numbers before and after the fix; finding cites `skills/core/project.md:9`.
- G2 soft-language: scanned finding/action language; 0 hedge terms requiring rewrite.
- G3 anti-tautology: no new test assertions added during the review fix.
- G4 fixture realism: N/A; no fixtures added during the review fix.
- G7 anti-premature-abstraction: no helper or abstraction added.
