# Code review — plan/automate-writer-runtime vs develop

**Mode:** both (local → codex) — **local completed**; external Codex **deferred** after local triage mutated the tree (byte-identical CAPTURED_DIFF invariant — re-run codex on tip if desired).
**Provider:** local (sealed subagent)
**Ref:** `92e9735f..0c145068` then fixes on tip
**Files:** 45 in original capture; product focus src/scripts/tests/skills

## Counts (local blind)

| Severity | Count |
|----------|------:|
| blocker | 0 |
| critical | 3 |
| major | 7 |
| minor | 5 |

## Findings → action

| # | Severity | Finding | Action |
|---|----------|---------|--------|
| 1 | critical | Fence opt-in under stamp done | **fixed** — `requireProductFence` when stamp; assert wires it |
| 2 | critical | claimed-fail could pass done | **fixed** — `requireAllClaimedPass: true` in canDoneFromAutomateClaims |
| 3 | critical | Lease stuck if brief write fails | **fixed** — clearLease on post-acquire failure; lease before worktree |
| 4 | major | Fence path-only (forgable claims) | **documented residual** — design non-goal process identity; deferred option C |
| 5 | major | --base-ref uses process cwd | **partial** — operator must run assert in plan worktree (documented) |
| 6–10 | major | stale WT/branch, empty WO, ordering, skill optional fence | **fixed** empty WO + ordering + stale branch refuse + skill HARD fence |
| 11–15 | minor | HEAD symbolic, regex escape, validate identity, casefold, tests | **fixed** SHA pin + regex escape + tests for criticals |

## Fixes applied in this session

- `src/automate-orchestrator-gates.js` — claim-pass + requireProductFence
- `scripts/assert-automate-gate.js` — requireProductFence under stamp
- `src/automate-work-order.js` — empty open tasks fail closed
- `src/automate-phase-run-lib.js` — lease-first, clearOnFail, baseRef SHA, stale branch refuse, phaseId escape
- `skills/shared/implement-automate-maestro.md` — fence mandatory under stamp
- `tests/automate-orchestrator-gates.test.js` — regressions

## Self-review against code-quality gates

- G1 read-before-claim: verified assert done and canDone paths before/after fix
- G2 soft-language: fix commit messages state behavior, not "should"
- G3 anti-tautology: claimed-fail and requireProductFence tests break if flag removed
- G4 fixture realism: N/A
- G7 anti-premature-abstraction: no new helper layer

## Final status

**Code approved with caveats** (residual major: claim path forgery without range verification — design-known; cwd for --base-ref).

Plan-scoped suite: 132+ new regressions green after fixes.
