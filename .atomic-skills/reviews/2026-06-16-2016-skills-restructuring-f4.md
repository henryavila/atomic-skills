---
verdict: needs_changes→all fixed
counts: {blocker: 0, critical: 0, major: 1, minor: 2, nit: 0}
reviewer: claude (local sealed envelope, clean-context agent)
pass: local
mode: local
ref: d5f85754d504d1e0522df7d97977f6be166b9e04..9406177f2d3f2a1ff991b1103eb01c4633ded502
schema_version: "1.0"
---

## Summary

Phase F4 review (the `project review` audit subcommand + `review-plan`
slug/provenance resolution). The clean-context agent confirmed the
compose-not-reimplement claim holds (leg 2 invokes existing scripts, leg 3
reads+runs `project-verify.md`, legs 4/5 delegate `review-plan`/`review-code`
in full), all introduced pointers resolve, and no literal tool names leaked.
It found one real **major** defect — the new `review` would block on
`review-plan`'s unguarded Step 0b cross-ref picker, contradicting its
non-interactive contract — plus two minor consistency gaps. All three fixed
in-phase.

## Findings

### F-001 [major] Non-interactive contract violation — skills/shared/project-assets/project-review.md:47 ↔ skills/core/review-plan.md (Step 0b)

**Claim:** `project review` leg 4 invoked `review-plan <plan_path> --mode=<local|both>`
with no cross-ref flag. `review-plan`'s Non-interactive abort guards only the
Step 0a *mode* picker; the Step 0b *cross-ref* picker has no TTY guard and fires
an interactive `{{ASK_USER_QUESTION_TOOL}}` when no `--cross-ref=`/`--no-cross-ref`
is passed. T4.2's frontmatter `references[]`/`supersedes` seeding makes the
"detected artifacts" option appear more often, increasing the prompt likelihood.

**Impact:** a read-only, "non-interactive and cheap" audit (project-review.md:18)
would block on a user question.

**Fix applied:** leg 4 now invokes `review-plan … --no-cross-ref`; added an
explanatory note (project-review.md:49) documenting why, and that cross-ref
coverage is available by running `review-plan --cross-ref=…` directly.

### F-002 [minor] `review` absent from the pre-mutation gate skip list — skills/core/project.md:93

**Claim:** the read-only skip list enumerated `status` views, `verify`, `why`,
`scope-creep` — `review` (READ-ONLY per project-review.md:26) was in neither the
mutating list nor the skip list, so the reconciliation gate could fire its prompt
before a read-only review.

**Fix applied:** added `review` to the skip list (project.md:93).

### F-003 [minor] `--mode=` supported but missing from router grammar/dispatch — skills/core/project.md:18,40

**Claim:** project-review.md:18 documents `--mode=local|both`, but the grammar
line and dispatch row advertised only `[<slug>] [--with-code]` — a discoverability
gap (routing matched on the `review` verb, so no functional break).

**Fix applied:** added `[--mode=local|both]` to the grammar line (project.md:18)
and `review --mode=` to the dispatch row (project.md:40).

## Fixes applied in this session

All 3 findings fixed in-phase. Deterministic re-verification after fixes:
T4.3 task verifier `exit 0`; F4-G1 compound verifier (incl. `npm run validate-skills`
→ "All 15 skills valid") `exit 0`.

## Self-review against code-quality gates

- G1 read-before-claim: each fix read the cited source lines (project.md:93, :18, :40;
  project-review.md:47) before editing.
- G2 soft-language: fix descriptions state what the fix does (passes `--no-cross-ref`,
  adds `review` to skip list); no should/probably/may.
- G3 anti-tautology: N/A — no tests added (doc/instruction changes).
- G4 fixture realism: N/A.
- G7 anti-premature-abstraction: no new helper introduced; three independent edits.
