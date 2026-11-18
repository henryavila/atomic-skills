## Summary
Layer-1 helpers largely implement the intended fail-closed shapes (present-before-PASS evidence fields, dual-leg path honesty, intentVsDelivered non-empty under forbidSkip, stamp-first durable finalize). The main holes are at the Layer-2 enforcement boundary: `assert-automate-gate` still treats unstamped plans as gate-off despite F0 automate-default + skill P7 requiring session activation; F4 content floors never run from the CLI; dual-leg / major disposition are under-wired or contradicted by fixtures and `lifecycle-order-guard` review completeness.

## Issues

### Issue 1 -- Severity: bug
- File: scripts/assert-automate-gate.js:720-722
- Description: Layer-2 assert activates durable gates only via plan frontmatter stamp (`hasAutomateStamp` / `planExecutionMode`). It never passes `automateActive: true` / `isAutomateActive({})` into `canRunPhaseDone`, `canFinalizeOrArchive`, or claim-bound done. Under F0, bare pure-maestro is ON without a stamp (`isAutomateActive({}) === true`), but `assert --gate phase-done|finalize|claims|done` on an unstamped plan returns ok with empty evaluation/decision/plan-end/claim state (claims explicitly short-circuit at lines 802-805; phase-done passes only `planExecutionMode` at 961-983; finalize at 1004-1008). That violates the skill contract at skills/shared/implement-automate-maestro.md:11-16 (P7 / critic F-001: first-session-before-stamp must not skip present-before-PASS / intentVsDelivered / phase-done gates). Tests codify the hole as success (tests/assert-automate-gate.test.js:500-515, 778-791, 903-917).
- Suggestion: When resolving a plan for assert, set `automateActive: isAutomateActive({ planExecutionMode })` (or true whenever session default would run pure-maestro) and pass it into all Layer-1 gates; require claim report / phase-done / finalize predicates under that activation, not only under stamp. Keep stamp for maestro cursor / lastAssert if desired, but do not treat missing stamp as gate-off under automate-default.
- Status: open

### Issue 2 -- Severity: bug
- File: scripts/assert-automate-gate.js:961-983
- Description: F4 dual-leg / evaluation content floors are opt-in in Layer-1 (`phaseReviewAllowsClose` only runs `phaseReviewAuthenticity` when `checkAuthenticity === true` or `receiptContents` / `readFile` is provided — src/phase-review-gate.js:498-513; same pattern for evaluation at src/phase-evaluation-gate.js:324-337). The required HARD-GATE CLI never supplies any of those, so stub/binary/one-line receipts on disk never fail assert. Dual-leg honesty only requires two path *strings* (src/phase-review-gate.js:417-427); agents can stamp invent `localReceiptPath` + `codexReceiptPath` without readable non-stub bodies and still get exit 0 under stamp.
- Suggestion: Under stamp (and session automateActive once Issue 1 is fixed), default `checkAuthenticity: true` and inject `readFile` (fs read of receipt/report paths relative to cwd/state-root). Fail closed when paths missing, unreadable, binary, undersized, or one-line stubs. Add CLI tests that write stub vs good dual receipts on disk.
- Status: open

### Issue 3 -- Severity: bug
- File: tests/assert-automate-gate.test.js:743-748
- Description: Layer-2 happy-path phase-done fixtures expect exit 0 with `reviewGate.mode: both` and only `reviewFile` (no `localReceiptPath` / `codexReceiptPath` / `legs[]`) — also at lines 933-938. That shape is explicitly rejected by `phaseReviewHonesty` dual-leg floor (src/phase-review-gate.js:417-426: “single reviewFile alone is not enough”). `writePlan` in the same test file (160-172) cannot serialize dual-leg fields at all. Result: either the suite is red against current honesty, or dual-leg is not proven at the CLI boundary — false confidence for F4 receipt authenticity.
- Suggestion: Extend `writePlan` to emit `localReceiptPath`, `codexReceiptPath`, and/or `legs[]`; update happy-path fixtures to dual paths; add a negative test that single-reviewFile mode both exits 1 under stamp; optionally write receipt files and enable content checks (Issue 2).
- Status: open

### Issue 4 -- Severity: bug
- File: scripts/assert-automate-gate.js:961-983
- Description: `canRunPhaseDone` enforces `majorDispositionAllowsClose` when `openMajorFindings` / `majorFindings` are supplied (src/automate-orchestrator-gates.js:406-417), and skill prose requires open majors to block phase-done without accept|defer|fix (implement-automate-maestro.md:176-177; implement-decision-log.md:77). Assert never loads majors from review receipts / decision log and never passes them in, so the required HARD-GATE cannot fail on undispositioned majors.
- Suggestion: Parse phase review receipt (or durable major findings list) when present and pass `openMajorFindings` + disposition fields into `canRunPhaseDone`; fail closed if majors exist without an operator disposition token.
- Status: open

### Issue 5 -- Severity: bug
- File: scripts/lifecycle-order-guard.js:261-281
- Description: `reviewGateComplete` under durable automate only accepts `mode === 'both' | 'external-both'` and does not require dual-leg paths, non-empty `reviewFile` when the key is absent, or content authenticity. It therefore diverges from `phaseReviewHonesty` / `AUTOMATE_PHASE_BOTH_MODES` (src/phase-review-gate.js:23-29, 417-427), which accept `both-codex|both-grok|both-claude` and require ≥2 receipt paths. Commit-guard can accept a single-reviewFile “both” stamp that assert/honesty would reject (or reject a valid `both-codex` dual-leg stamp assert would accept). Split-brain between preflight/commit path and Layer-1/2.
- Suggestion: Delegate durable review completeness to `phaseReviewHonesty` / `phaseReviewAllowsClose` (same dual-leg + mode set), or import `AUTOMATE_PHASE_BOTH_MODES` and dual-leg path checks so both paths share one definition.
- Status: open

### Issue 6 -- Severity: suggestion
- File: src/decision-review-gate.js:69-102
- Description: present-before-PASS machine evidence accepts non-empty `packagePath` alone (and/or any ISO-ish `packagePresentedAt`) with no proof the host rendered package body in the same turn. Skill prose forbids path-only / “package apresentado” without body (implement-decision-log.md:155-159; implement-automate-maestro.md:143). `buildDecisionReview` (213-250) also allows `status=passed` without present evidence fields, so incomplete stamps can be written and only fail later at phase-done.
- Suggestion: Require `packagePresentedAt` ISO for passed under automate (path optional companion); have `buildDecisionReview` refuse passed without present evidence; optionally require package path exists when packagePath is set. Host presentation of body remains policy, but stamp shape should not green-light path-only dogfood.
- Status: open

### Issue 7 -- Severity: suggestion
- File: src/plan-end-review.js:174-189
- Description: Under automate, `intentVsDeliveredOk` only checks non-empty array + status ∈ matched|partial|missing|extra. A single forged row `{ status: 'matched' }` (or all-`missing`) satisfies `planEndReviewOk` / finalize with a real external-both receipt + userValidatedAt. No binding to `buildIntentVsDeliveredRows` / intent surface, so the machine gate does not enforce “did we build what we planned?” beyond field presence.
- Suggestion: Require rows produced from intent surface (min rows vs intent items, or hash/id coverage), and/or reject all-missing-only when intent surface is non-empty unless operator override token is present.
- Status: open

### Issue 8 -- Severity: nit
- File: src/phase-evaluation-gate.js:1-6
- Description: Module header says skip/accept residual are forbidden while the stamp holds, but `evaluationGateHonesty` allows `status=skipped` with `operatorSkip===true` + reason (262-281), and `phaseEvaluationAllowsClose` does not further forbid skip under automate. Comment/docs oversell hardness relative to code.
- Suggestion: Align header/docs with operator-owned skip as the only allowed skip path, or fail closed on skipped under durable automate if that is the real policy.
- Status: open

## Gate integrity notes
- **Verified bypass:** unstamped plan + `assert --gate phase-done|finalize|claims|done` → ok without operator/evaluation/plan-end/claim predicates (scripts/assert-automate-gate.js:802-805, 720-722, 961-983, 1004-1008; tests/assert-automate-gate.test.js:500-515, 778-791, 903-917). Conflicts with skills/shared/implement-automate-maestro.md:11-16.
- **Verified fail-open:** F4 receipt/report content floors never enabled by assert CLI (src/phase-review-gate.js:498-513; src/phase-evaluation-gate.js:324-337; scripts/assert-automate-gate.js:961-983).
- **Verified under-wire:** `majorDispositionAllowsClose` only if caller supplies findings — CLI does not (src/automate-orchestrator-gates.js:406-417; scripts/assert-automate-gate.js:961-983).
- **Verified split-brain:** lifecycle `reviewGateComplete` lacks dual-leg / both-* parity with `phaseReviewHonesty` (scripts/lifecycle-order-guard.js:261-281 vs src/phase-review-gate.js:23-29, 417-427).
- **Verified present-before-PASS field gate:** under stamp or `automateActive: true`, missing package evidence fails `decisionReviewAllowsPhaseDone` (src/decision-review-gate.js:156-178); unit tests cover this (tests/decision-review-gate.test.js). Not enforced by assert when unstamped (Issue 1).
- **Verified plan-end intentVsDelivered empty block under durable automate** when stamp/`automateActive` set (src/plan-end-review.js:234-238, 361-383); empty field fails; status-only forge still passes (Issue 7).
- **Verified isAutomateActive default ON** (src/implement-mode.js:241-242; tests/implement-mode.test.js:143-167); durable helper remains stamp/`automateActive` flag only (src/plan-end-review.js:291-299) — intentional for finalize stamp-first, but assert never sets session flag.
- **Could not fully verify without running suite:** whether dual-leg honesty currently reds assert happy-path tests (Issue 3) — code paths conflict; fixture cannot express dual-leg.
- **normalizeStatusRoot double-projects strip** looks sound for F4 path fix (src/decision-log.js:107-132); tests cover strip (tests/decision-log.test.js:58-74). No residual double-projects bypass found in review.
- **exitGateMirror** (src/lifecycle-order-guard.js:62-134) is pure and fail-closed for terminal-pending; not wired into assert phase-done (out of CLI path — not a silent bypass of assert itself).
