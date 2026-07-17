---
kind: plan-review
slug: implementation-automate-mode
mode: external-both
providers: [codex, grok]
verdict: needs_changes_then_patched
counts_codex: {blocker: 0, critical: 2, major: 3}
counts_grok: {blocker: 0, critical: 5, major: 3}
reviewedAt: 2026-07-17T19:05:00.000Z
---

# external-both plan review — implementation-automate-mode

## Provider status
- codex: succeeded (gpt-5-codex, pass1) → reviews/2026-07-17-1902-iam-codex-pass1.md
- grok: succeeded (grok-4.5, pass1) → reviews/2026-07-17-1902-iam-grok-pass1.md

## Merged critical themes (applied)
1. **P4 nested vs sibling** — canonical sibling from common-dir; never nest under plan worktree
2. **executionMode stamp** — MUST on first confirmed automate entry; clear path required
3. **Archive hard-block** — planEndReviewOk + userValidationOk; no soft pointer success path
4. **userValidationOk** — pure helper + schema field; not rg-only
5. **Post-eval reopen** — reopen tasks / follow-ups; re-verify before phase-done
6. **Merge-before-done** — D.5 merge sibling before task re-verify/done
7. **Claim ranges** — validate base/head per task for complex both
8. **Rematerialize** — F0 initiative + F1–F4 descriptors re-synced from source.md

## Residual majors (implement-time, non-blocking for plan start)
- Review cost dedupe (task both + phase both overlapping ranges)
- Weight threshold dogfood confirmation
- Max re-dispatch rounds default 2 (design OQ; confirm in implement)

## Verdict for plan creation
Patched plan is SPEC-clean and ready for F0 implementation. Re-run external-both after F1 materialize if desired.
