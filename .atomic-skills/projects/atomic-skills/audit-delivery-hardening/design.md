# Design — audit-delivery hardening

**Status:** ratified from multi-agent research (2026-08-04)  
**Plan:** `docs/plans/audit-delivery-hardening.md`  
**Tracking:** `plan.md` (this project)

## Problem

A green suite + blessed `review-code` pass still ships **half-migrated systems** (MCP/skills teaching old lifecycle, client band-aids, recovery gaps). `review-code` **forbids intent** in the briefing (anti-framing). Delivery acceptance **requires intent**. Collapsing both into one mode recreates the failure.

WIP `audit-delivery` has the right iron law but:

- orphan assets, PT enums in EN-only sources
- weak Intent Package admission
- residual = Lekto examples, not a protocol
- false-CLOSED paths (N/A abuse, mono-elo RESOLVED, HIGH accepted in chat, residual opt-out)
- fat body + audit-and-fix PM loop diluting the auditor

## Solution shape

```text
audit-delivery (system residual delivery audit)
  Intent Package → Spec Package (strip success narrative)
  → product + residual (default)
  → matrix with staged evidence + must-not rows
  → verdict CLOSED|PARTIAL|OPEN + Accept Records
  → report; STOP (read-only default)

fix / parallel-dispatch  →  re-run audit-delivery
review-code (blind)      →  after fix range (patch correctness)
```

## Decisions (D1–D12)

See plan § Design decisions. Highlights:

| Keep | Change |
|------|--------|
| Separate skill | EN SSOT enums |
| Intent required | Wire + expand assets |
| Residual mandatory | product+residual default |
| Opposite of review-code | Residual protocol OLD×surfaces |
| Report under `.atomic-skills/reviews/` | Accept Record for HIGH |
| Soft sibling links → **hard phase-done gate** | Demote audit-and-fix to recipe |

## Explicit rejects

- `review-code --mode=delivery`
- Soft-suggest / optional / skippable `audit-delivery` on phase close (D11 forbids)
- `operatorSkip` / `status: skipped` on `deliveryAuditGate` (unlike evaluation/review)
- Treating plan-end `intentVsDelivered` or green suite / `review-code` as substitute for the phase delivery audit
- Classic RTM / risk matrix bureaucracy
- Sealed anti-intent substitute for this skill
- Confidence % as closure pressure

## Phases ↔ P0–P2

| Phase | Bundle | Intent |
|-------|--------|--------|
| F0 | P0 craft | EN, parse-first, wire, reaudit entry, catalog |
| F1 | P0 teeth | Intent hard, residual protocol, axes, verdict |
| F2 | P1 evidence+UX | Stages, must-not, Spec Package, depth, siblings, **implement hard-gate** |
| F3 | P1 structure | Thin body, checklists, report, static guard |
| F4 | P2 advanced | Prosecution, critic, dual reaudit, cross, BI, recipe, dogfood |

## Success one-liner

**No phase-done without a real `audit-delivery` run + durable `deliveryAuditGate` (never skippable); no CLOSED without Intent matrix + residual protocol — craft-correct and composable with review-code / fix.**
