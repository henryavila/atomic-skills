# Plan-end external-both — implement-phase-agents

- **mode:** external-both
- **host family:** grok
- **range:** c11f30d..edfe50c
- **at:** edfe50c173f16738dd99db31a6b610c1df97a85d
- **verifiedAt:** 2026-07-23T13:30:59.000Z

## Legs

| Provider | Status | familyDifferent | Notes |
|----------|--------|-----------------|-------|
| codex | succeeded | true | 3× P2 (commitGuard alias, flat parentPlan, F0–F2 decisionReview backfill) — **fixed** in same plan-end turn |
| claude | succeeded | true | 0 blocker; 1 critical (assert fails-closed only with durable stamp — by design); majors residual dispositioned accept |
| grok | skipped | false | same-family as host — not a counting leg |

## Codex findings disposition

1. **commitGuard top-level executionMode** — **fixed** (`planExecutionModeOf` in commitGuardPhaseDone)
2. **flat spawn multi-plan** — **fixed** (parentPlan match; no filename-only flat hits)
3. **F0–F2 missing decisionReview** — **fixed** (backfill passed stamps from historical operator PASS evidence)

## Claude findings disposition

1. **critical: assert without stamp is inactive** — **accept** residual: durable stamp is the authority (`isDurableAutomateActive`); session-only automate without stamp is out of durable finalize contract
2. **majors** (resolver divergence, category enum soft, decisionReviewOf override, host-thin prose-only) — **accept** residual / follow-up non-blocking for plan-end

## Verdict

planEndReviewOk eligible: mode external-both, ≥1 family-different succeeded legs (codex+claude), non-empty reviewFile + verifiedAt.

**Remaining for finalize/archive:** operator `userValidatedAt` (user validation hardgate).
