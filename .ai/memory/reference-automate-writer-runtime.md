# automate-writer-runtime — plan pointer

**Slug:** `automate-writer-runtime`  
**Branch:** `plan/automate-writer-runtime`  
**Scope:** implement automate **#1 + A + B** (skill spawn recipe + Layer 3 host-local runner + plan-tree product fence)

## What this plan ships

1. **#1** — Concrete Grok/portable phase-writer spawn recipe (general-purpose, not explore-only); honesty that prose alone does not force spawn.
2. **A** — `scripts/automate-phase-run.js` prepare/validate + work-order/sealed-brief builders.
3. **B** — Product-source fence on plan branch wired into `assert-automate-gate --gate done`.

## Non-goals

Layer 4 daemon/spawn adapters; concurrent phase writers; claim lease-secret signing (option C).

## Key paths

- Plan: `.atomic-skills/projects/atomic-skills/automate-writer-runtime/plan.md`
- Design: `.../design.md` (critic approve_with_nits 2026-07-29)
- Realism: `docs/kb/automate-orchestrator-realism.md`

## Next

`implement automate-writer-runtime` (or Mode 1 if dogfooding host coding of the package itself carefully).
