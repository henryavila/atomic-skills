---
date: 2026-06-02T16:57:35-03:00
topic: rmig14-fix-commits-revalidation
artifact: a1f20d6..HEAD
skill: review-code
reviewer: gpt-5-codex
codex_version: codex-cli 0.134.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
framing_delta: {dropped: 1, maintained: 0, emerged: 1}
schema_version: "1.0"
---

# Cross-Model Review — rmig14-fix-commits-revalidation

**Mode:** both (local sealed-envelope agent → codex cross-model 2-pass) on the frozen
`a1f20d6..HEAD` diff (the two R-MIG-14 review-fix commits: `3432c17` + `de9f9e9`; 5 files, +288).
Byte-identical `CAPTURED_DIFF` (`git diff a1f20d6..HEAD`) consumed by both phases. Triggered via
`atomic-skills:project review-due` to validate the fix-commits applied after the prior R-MIG-14 review
(`2026-06-02-1515-rmig14-aideck-modelb-consumer.md`).

## Local pass (sealed-envelope agent — same model, clean context)

verdict: findings_exist · 1 major / 2 minor · passes: 2

| # | Summary | Severity | File:line | Disposition |
|---|---------|----------|-----------|-------------|
| L1 | `health.js` emits `daysStale: null` + `malformed` field, which would violate the legacy vendored `healthReportSchema` (`z.number()`) | major | health.js:23 (vs vendor/aideck-runtime/src/schemas/validators/project-status.ts:271-273) | **NOT a live-path bug — record.** `parseHealthReport`/`healthReportSchema` have ZERO call sites on the model-B consumer path (confirmed by grep); the manifest declares no tool-OUTPUT schema; `schema.json` validates entity files only. The `daysStale:null`+`malformed:true` shape is the intentional L6 surfacing. Follow-up if aiDeck's legacy zod is ever reused for consumer health output: widen to `daysStale: z.number().nullable()` + `malformed: z.boolean().optional()`. |
| L2 | New `plan-has-no-currentPhase` rationale arm is untested | minor | get-next-action.js:56 | **Accepted — add test.** Every plan fixture sets `currentPhase`; the ternary's else arm is unexercised. |
| L3 | Handler throws bare `Error` on missing slug; not-found vs internal_error mapping owned by the (unvendored) consumer runner | minor | get-next-action.js:14,33 | **Record — out of scope.** Consistent with every sibling handler (`get-dependencies`, `mark-task-done`, …); the error-code mapping lives in the external runner. Repo-wide follow-up if the runner blanket-maps bare throws to `internal_error`. |

## Pass 1 (codex blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

### F-001 [major] Performance — assets/aideck-consumer/handlers/_lib.js:31-36

**Claim:** For an initiative with many pending tasks whose `blockedBy` entries reference absent IDs,
every blocker now scans the whole `tasks` array via `tasks.find`, so `get_next_action` can degrade to
quadratic work before returning no action.

**Recommendation:** Build a `Map`/`Set` of task IDs→status once, then check
`statusById.get(bid) === 'done'`; add a regression case with many unknown blockers.

**Confidence:** high

(Full Pass-1 output archived at `/tmp/codex-pass1-out-20260602-165735.md` during the run.)

## Pass 2 (codex informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The blind-pass performance finding does not stand under the supplied data-size constraint. However,
the informed pass exposes a correctness regression in the unscoped `get_next_action` path: once
unknown blockers correctly count as blocking, the handler can stop at the first active initiative and
falsely report that no actionable work exists without checking later active initiatives.

### F-001 [major] Correctness — assets/aideck-consumer/handlers/get-next-action.js:60-75

**Evidence:**
```js
  const active = initiatives.find((i) => i.status === 'active')
  if (active) {
    const t = firstUnblockedPendingTask(active)
    if (t) { return { ... } }
  }
  return { description: 'No next action — no active initiative with unblocked pending tasks', ... }
```

**Claim:** With no args, if the first active initiative has no actionable task and a later active
initiative does, the handler returns "no active initiative with unblocked pending tasks" because it
selects the first active initiative before checking task actionability.

**Impact:** Users asking for a global next action can be told there is no available work even when
another active initiative has an unblocked pending task, causing actionable work to be skipped.

**Recommendation:** Iterate active initiatives and return the first whose `firstUnblockedPendingTask`
is non-null; only return the global no-action response after all active initiatives are checked. Add a
test where the first active initiative is blocked and the second active initiative is actionable.

**Confidence:** high

## Pass 2 reconciliation

### Dropped from blind pass
- F-001-blind [major] Performance — DROPPED: the external constraint states initiative `tasks[]` and
  per-task `blockedBy[]` lists are human-authored and single-digit to low-tens, so the large-initiative
  timeout impact is not credible for this consumer path. (Operator note: the `Map` refactor is still a
  free, strictly-better hardening and is applied below.)

### Maintained
- _(none)_

### Emerged
- F-001-final [major] Correctness — emerged: the contract confirms unknown blockers must count as
  blocking, which means the unscoped fallback must keep scanning later active initiatives after the
  first has no actionable task; the current code does not.

## Conformance vs prior review

This review re-validates the fix commits that applied the prior R-MIG-14 review
(`2026-06-02-1515-rmig14-aideck-modelb-consumer.md`). Per the "validate fix-commits after review
application" rule, bundle-fixes can introduce new bugs — here one regression surfaced (the perf one,
introduced by dropping the `Set`) and one latent pre-existing bug was exposed (the global-fallback
first-active-only short-circuit). Both addressed below.

## Briefings used

Captured diff = `git diff a1f20d6..HEAD` (5 files, 18879 bytes). Pass-1 briefing (blind, factual
non-goals only) at `/tmp/codex-briefing-pass1-20260602-165735.md`; Pass-2 briefing (Pass-1 +
verifiable external constraints + Pass-1 output) at `/tmp/codex-briefing-pass2-20260602-165735.md`.
Anti-framing directive applied in both phases; neither phase referenced the local pass.

## Fixes applied in this session

User approved "apply all three" (apply / edit / skip). Suite 726 → 729 green.

- **FIX-1 — [codex F-001 informed · major · correctness]** `get-next-action.js:60` — the global
  no-args fallback now **iterates all active initiatives** (`for (const active of
  initiatives.filter((i) => i.status === 'active'))`) and returns the first with an actionable task,
  instead of `find`-ing only the first active one. Test: *"global fallback scans PAST a blocked first
  active initiative to an actionable later one"* — verified mutation-killer (fails on the HEAD version).
- **FIX-2 — [codex F-001 blind · perf · dropped-on-severity, applied as free hardening]** `_lib.js:31`
  — `firstUnblockedPendingTask` builds a `Map<id,status>` once; blocker checks are now O(1). Semantics
  unchanged (unknown id → `undefined` ≠ 'done' ⇒ BLOCKING). Covered by the F-003 block + a new test
  *"blocks a task when ANY blocker is unresolved, even if another blocker IS done"*.
- **FIX-3 — [local L2 · minor]** added coverage for the `plan-has-no-currentPhase` rationale arm
  (*"stays scoped with a no-currentPhase rationale"*).
- **NOT fixed (recorded):** local L1 (`health` `daysStale:null` — not on the model-B path; vendored zod
  unused), local L3 (bare `throw` — consistent with every sibling handler; error-code mapping owned by
  the external runner).

## Self-review against code-quality gates

- **G1 read-before-claim:** pasted the exact source hunks before each edit; verified `_lib.js:24-34`
  and `get-next-action.js:60-71` via Read before/after.
- **G2 soft-language:** scanned fix descriptions for `should/probably/may/typically` — 0 occurrences.
- **G3 anti-tautology:** FIX-1 test named the mutation (`find` first-active vs iterate — confirmed RED
  on HEAD); FIX-2 test named the mutation (a done blocker must not rescue an unknown one); FIX-3 is
  coverage-only (the branch pre-existed) — declared as such, not a regression-guard.
- **G4 fixture realism:** in-memory fixtures mirror `meta/schemas/initiative.schema.json` record shape
  (slug/status/tasks/blockedBy); N/A for external-data sampling.
- **G7 anti-premature-abstraction:** no new helper introduced — reused `firstUnblockedPendingTask` + a
  local `Map`.
