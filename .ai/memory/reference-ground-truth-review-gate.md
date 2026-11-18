# Ground-truth review gate (plan ↔ code)

**When:** 2026-07-28. Mandatory before `implement`.

## Contract

Bidirectional plan review:

| Direction | Question |
|-----------|----------|
| **A** | Plan premises that assume X exists — does X exist? |
| **B** | Code that exists and the plan never models — can it impact the plan? |

Even **empty / no-product-code** repos must run the review and persist
`Status: complete-empty-repo` with A/B tables showing none + scan evidence.
Silence is not a pass. No operator skip flag unlocks implement.

## Persistence (both required)

1. Plan body section `## Ground-truth review` (Status + ### A + ### B)
2. `## Reviews` line: `- ground-truth: complete|complete-empty-repo|complete-with-findings | … @ <sha> (<ISO>)`

## Specialized mode (not folded into internal)

```text
atomic-skills:review-plan --mode=ground-truth <plan>
# alias: --mode=gt
```

Flow E in `review-plan` — only items 21–22. Receipt line **must** include
`mode=ground-truth` (or `mode=gt`) **and** `fp=<hex>` (substance fingerprint).
Stage 8a = internal; Stage 8a2 = ground-truth (separate invocation).

## Machine gate (structure + content floor + freshness)

```bash
node scripts/find-plans-missing-ground-truth.js <plan.md>
```

Checks: Reviews line (`mode=` + `fp=`), section Status+A+B, content floor
(Scanned/Counts/table-or-none), fingerprint freshness (plan + phase initiatives;
volatile keys + receipt sections excluded).

- Pure helpers: `src/ground-truth-review.js`
- Skill procedure: `skills/shared/project-assets/ground-truth-review.md`
- Wired into: `review-plan` Flow E, create-plan Stage 8a2/8c, `implement` Step 1.6,
  **`assert-automate-gate --gate spawn`** (JS fence), `project verify` check 11

## Non-goals

- Does not replace `- internal:` adversarial review
- Does not replace `project verify` state coherence
- Detector does not re-run GLOB of product code (LLM authors A/B); it enforces
  structure, content floor, attribution, and freshness of the stamped review
