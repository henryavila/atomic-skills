---
date: 2026-05-25T21:30:00-03:00
topic: plan-initiative-consistency
artifact: /Users/henry/.claude/plans/dapper-tumbling-dragonfly.md
skill: review-plan
reviewer: gpt-5-codex
codex_version: codex-cli 0.130.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 5, emerged: 0}
schema_version: "1.0"
---

# Cross-Model Review — plan-initiative-consistency

## Local self-loop (pre-codex)

**Iterations:** 2
**Findings (local):** 2 significant (fixed), 3 minor (2 documented, 1 G2 borderline)

Local fixes applied before codex:
1. Added `phase-reopen` task reset (Layer 1C) — plan didn't address reversal of task propagation
2. Documented `completedAt`/`durationDays` limitation after archive — plan claimed to fix but fix only works pre-archive
3. Specified 5 test cases for `crossValidate` (was "4 test cases" with no details)
4. Added note about not archiving F0-F3 after data fix
5. G2 soft-language: "may" L45 → "assumed"; "should" L71 → "must"

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
reviewer: gpt-5
pass: blind
schema_version: "1.0"
---

## Summary
The plan does not fully close the inconsistency pathways it identifies. It only patches the accepted-advance path, leaves archived/reopened initiatives underspecified, allows validation to skip the exact files most likely to matter after archive, and gives the dashboard a defensive rule that still permits false done states. The data repair is also incomplete against plan criteria because it marks existing initiative gates but does not require missing initiative gates to be materialized.

## Findings

### F-001 [major] coverage — plan:15-25

**Claim:** Future `phase-done` can still create inconsistency on the decline/plan-done path (step 8) since plan only patches step 7.

**Recommendation:** Add initiative propagation to every branch that marks phase done.

**Confidence:** high

### F-002 [major] coverage — plan:30

**Claim:** phase-reopen doesn't restore archived initiative files back to `initiatives/`.

**Recommendation:** Specify that reopen must un-archive the initiative file first.

**Confidence:** high

### F-003 [major] contradiction — plan:40-51

**Claim:** Data fix marks existing initiative gates but plan criteria G4/G5 (added post-materialization) are absent from initiative.

**Recommendation:** Reconcile initiative exitGates against plan criteria — add missing gates.

**Confidence:** high

### F-004 [major] coverage — plan:48-53

**Claim:** Cross-validation skips absent initiatives; archived initiatives are never scanned.

**Recommendation:** Scan `initiatives/archive/` in validation; warn if phase initiative is truly missing.

**Confidence:** high

### F-005 [major] contradiction — plan:66-68

**Claim:** Dashboard defense trusts `initiative.status === 'done'` even when tasks are pending.

**Recommendation:** Use task completion as ground truth regardless of initiative status.

**Confidence:** high

## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

All 5 findings maintained. 0 dropped, 0 emerged.

## Briefings used

<details>
<summary>Pass 1 briefing</summary>

See `/tmp/codex-briefing-pass1-1779751778.md`

</details>

<details>
<summary>Pass 2 briefing</summary>

See `/tmp/codex-briefing-pass2-1779751778.md`

</details>

## Fixes applied in this session

- F-001: applied — added propagation to BOTH step 7 and step 8 of phase-done
- F-002: applied — phase-reopen must un-archive initiative file before resetting
- F-003: applied — data fix now reconciles missing initiative exitGates against plan criteria
- F-004: applied — cross-validation scans `initiatives/archive/`; warning for truly missing initiatives
- F-005: applied — dashboard defense uses task completion as ground truth, ignores initiative.status

## Self-review against code-quality gates

- G1 read-before-claim: ran grep against the plan looking for unsourced claims; found 0.
- G2 soft-language: ran ban-list grep; found 0 occurrences after fixes (L45 "may" → "assumed", L71 "should" → "must").
- G6 reference-or-strike: plan is implementation spec, not requirements doc. All file:line references verified against source. 0 bare assertions about code behavior.
