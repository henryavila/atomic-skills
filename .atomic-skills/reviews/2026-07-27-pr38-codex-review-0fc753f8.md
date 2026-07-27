# Codex review — PR #38 plan/automate-default-and-operator-gates vs origin/develop

- provider: codex (gpt-5.5)
- mode: `codex review --base origin/develop`
- sandbox: read-only
- review-id: 0fc753f8
- at: 2026-07-27

## Findings (extracted)

The patch introduces a failing test fixture and several gate-enforcement gaps that allow required automate review/intent checks to be bypassed or silently skipped. These issues should be fixed before considering the change correct.

Full review comments:

- [P1] Add dual receipts to the phase-done fixture — /Volumes/External/code/atomic-skills/.worktrees/automate-default-and-operator-gates/tests/decision-review-gate.test.js:209-214
  These new `canRunPhaseDone` tests use `mode: 'both'` with only `reviewFile`, but `phaseReviewHonesty` now rejects that before it reaches the decision-review check. As a result `node --test tests/decision-review-gate.test.js` fails both tests in this block with the dual-leg error instead of exercising present-before-PASS; add dual receipt paths to this fixture.

- [P2] Require an external leg for both-mode review — /Volumes/External/code/atomic-skills/.worktrees/automate-default-and-operator-gates/src/phase-review-gate.js:420-420
  For `mode: 'both'`, this accepts any two paths, so `localReceiptPath` plus `reviewFile` passes even with no codex/grok/claude receipt. That lets a local-only review satisfy the automate cross-model phase gate; require at least one explicit external leg/path instead of only checking `dual.paths.length`.

- [P2] Honor local authenticity checks without receiptContents — /Volumes/External/code/atomic-skills/.worktrees/automate-default-and-operator-gates/src/phase-review-gate.js:244-244
  When a caller requests local receipt checking via `checkAuthenticity: true` or supplies only `readFile`, this branch skips the check because it is gated on `opts.receiptContents != null` and then returns ok. That means local override stubs are accepted despite the caller explicitly asking for authenticity validation; resolve/read the local `reviewFile` whenever content checking is requested.

- [P2] Plumb major findings into the phase-done gate — /Volumes/External/code/atomic-skills/.worktrees/automate-default-and-operator-gates/src/automate-orchestrator-gates.js:407-410
  The new major-disposition check only looks at fields passed directly to `canRunPhaseDone`, but the actual `assert-automate-gate --gate phase-done` path never supplies `openMajorFindings`, `majorFindings`, or a disposition. In normal CLI use this hard gate therefore sees no findings and cannot block open major review findings; wire a durable source or CLI data into this call path before relying on the gate.

- [P2] Emit rows for unplanned output paths — /Volumes/External/code/atomic-skills/.worktrees/automate-default-and-operator-gates/src/plan-end-intent-surface.js:676-681
  This loop identifies output paths that were not mentioned by intent, but it never appends anything to `rows`. Unplanned delivered files therefore disappear from `intentVsDelivered` instead of being marked `extra`, weakening the automate plan-end scope check; push an `extra` row here or remove the dead loop.
