# automate-writer-runtime — plan pointer

**Slug:** `automate-writer-runtime`  
**Branch:** `plan/automate-writer-runtime`  
**Scope:** implement automate **#1 + A + B** (skill spawn recipe + Layer 3 host-local runner + plan-tree product fence)

## What this plan ships

1. **#1** — Concrete Grok/portable phase-writer spawn recipe (`spawn_subagent` + `general-purpose`, not explore-only); honesty that prose alone does not force spawn.
2. **A** — `scripts/automate-phase-run.js` prepare/validate + work-order/sealed-brief builders (`src/automate-work-order.js`, `src/automate-sealed-brief.js`, `src/automate-phase-run-lib.js`).
3. **B** — Product-source fence on plan branch (`src/automate-product-fence.js`) wired into `canDoneFromAutomateClaims` / `assert-automate-gate --gate done` via `--plan-diff-file` or `--base-ref`.

## Non-goals

Layer 4 daemon/spawn adapters; concurrent phase writers; claim lease-secret signing (option C).

## Key paths

- Plan: `.atomic-skills/projects/atomic-skills/automate-writer-runtime/plan.md`
- Design: `.../design.md` (critic approve_with_nits 2026-07-29)
- Realism: `docs/kb/automate-orchestrator-realism.md`
- Dogfood checklist: `docs/kb/automate-writer-runtime-dogfood.md`
- Skills: `skills/core/implement.md`, `skills/shared/implement-automate-maestro.md` (Step C prepare→spawn→validate; Step E product fence)

## Step C order (host)

assert spawn → `automate-phase-run prepare` → spawn general-purpose writer → `automate-phase-run validate` → merge → assert done (+ plan-diff fence)

## Guarantee

Fence blocks **close**, not process-forced spawn. Host product commit on plan branch under automate is a red flag.

## Session recovery

If interrupted mid-writer: check lease (`status/writer-leases/<slug>.json`), sibling WT, sealed brief under `status/automate/`, claim path. Clear lease only with acquire secret after settle. Residual WTs are operator cleanup.
