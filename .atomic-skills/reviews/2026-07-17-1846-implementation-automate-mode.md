---
kind: plan-review
slug: implementation-automate-mode
mode: internal
verdict: approve
counts: {blocker: 0, critical: 0, major: 0, minor: 1, nit: 1}
reviewedAt: 2026-07-17T18:50:00.000Z
---

# Plan review — implementation-automate-mode (internal)

## Summary
Plan implements opt-in automate mode: pure maestro session, code-only phase writer, evaluation agent per phase, forced both at phase/complex tasks, external-both + planEndReviewOk at plan end with user validation before finalize. SPEC-admitted 15 tasks across 5 phases. No blockers.

## Findings

### F-001 [minor] F1–F4 descriptor-only until materialize
**Claim:** F1+ are `.source.json` only; evaluation agent and finalize gates are not yet initiative-level until `materialize F1` etc.
**Impact:** Expected lazy-materialization; operators must materialize before implement of later phases.
**Recommendation:** Keep as-is; document in nextAction after F0.

### F-002 [nit] F2-G2 verifier pipes rg into rg
**Claim:** `rg -n 'complex' ... | rg -n 'both|review-code'` can fail if first rg has no match (pipefail) or miss multiline intent.
**Impact:** Fragile exit gate shell.
**Recommendation:** Prefer single `rg -n 'complex.*(both|review-code)|review-code.*both'` during implement F2.

## Verdict
approve — ready for Stage 8c receipt gate and external-both cross-model.
