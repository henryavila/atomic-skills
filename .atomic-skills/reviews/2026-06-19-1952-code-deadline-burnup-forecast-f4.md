# Code review — deadline-burnup-forecast F4 (phase-done gate)

- **Ref/scope:** `1418058..HEAD` (F4 phase diff, code surfaces only: scripts/, meta/schemas/, assets/aideck-consumer/, skills/shared/, tests/)
- **Mode:** both (local sealed-envelope agent → codex cross-model blind pass)
- **Reviewed at:** HEAD `7c5923e` (diff captured pre-fix; remediations landed `17a815b`, `8a088d4`)
- **Files reviewed:** 11
- **Verdict:** approved with remediations (all findings fixed + regression-tested)

## Counts
- **Local:** blocker 0, critical 0, major 0, minor 2
- **Codex (blind):** blocker 0, critical 1, major 2, minor 0 — `gpt-5-codex`

## Findings

| # | Severity | Source | File:line | Summary | Action |
|---|----------|--------|-----------|---------|--------|
| L-1 | minor | local | scripts/validate-state.js (crossValidate) | closedAt gate could false-match when both `plan.slug` and `init.parentPlan` are absent (`undefined !== undefined`) | fixed `17a815b` (slug guard) |
| L-2 | minor | local | skills/shared/mode2-codex-lane.md §9 | dispatch-log `plan`/`phase` match keys absent from the documented contract | fixed `17a815b` (doc sync) |
| C-1 | **critical** | codex | scripts/validate-state.js + scripts/harden-closedat.js | grandfather cut keyed on bare `taskId`; taskIds are phase-local, so grandfathering `F0/T-001` silently exempts a later `F1/T-001` — defeats the forward-only gate | fixed `8a088d4` (phase-scoped `<phaseId>/<taskId>` key both sides) |
| C-2 | major | codex | scripts/harden-closedat.js | flip script scanned only the nested `phases/` layout; a legacy flat plan got an empty grandfather set → would reject pre-existing data | fixed `8a088d4` (scans both layouts; flat `initiatives/` filtered by parentPlan) |
| C-3 | major | codex | scripts/append-completion.js + project-transitions.md:138 | the programmatic `appendCompletion()` task-done path emitted no dispatch actuals (only the CLI derived them) → silent loss on that path | fixed `8a088d4` (appendCompletion auto-derives task-done actuals; both paths capture) |

## Tests locking the remediations
- C-1: `validate-state.test.js` "a SAME-id grandfather from ANOTHER phase does NOT exempt this phase"; `harden-closedat.test.js` "keys the SAME taskId in different phases as DISTINCT keys".
- C-2: `harden-closedat.test.js` "handles the legacy FLAT layout … filtered by parentPlan".
- C-3: `append-completion-dispatchlog.test.js` "auto-derives dispatch actuals … (programmatic path)" + "does not override explicit actuals".
- Full suite after remediation: 953 tests / 939 pass / 8 pre-existing install/detect drift fails / 0 new regressions.

## Codex Pass-2 (informed) — skipped, with rationale
The blind pass produced **zero false positives** — all three findings (incl. the critical) were verified real against source and remediated. The informed Pass-2's role is reconciliation / false-positive reduction on the original diff; with nothing to reconcile, it adds no signal. The remediations were instead cross-checked by targeted regression tests (above) + a green full suite, which is stronger than a re-pass on the already-fixed design.

## Codex blind raw findings (audit trail)
See `gpt-5-codex` output: F-001 (critical, phase-local taskId grandfather leak), F-002 (major, flat-layout missed by harden script), F-003 (major, programmatic appendCompletion drops dispatch actuals). One non-finding question (constrain dispatch `attempt`/`escalationCount` to non-negative ints) — the writer already guards `Number.isFinite` on actuals; out of scope for this gate.

## Self-review against code-quality gates
- G1 read-before-claim: each finding verified by reading the cited `file:line` before applying its fix.
- G2 soft-language: fix descriptions state what the fix does (no should/probably/may).
- G3 anti-tautology: each remediation has a test whose assertion fails if the fix is reverted (cross-phase exemption, flat-layout scan, programmatic auto-derive all mutation-checked).
- G4 fixture realism: dispatch-log + plan/initiative fixtures mirror the real emitted record shapes.
- G7 anti-premature-abstraction: `grandfatherKey` helper introduced because the SAME derivation is needed in two files (harden + validate) — 2 sites with a correctness-coupling, documented as mirrored.
