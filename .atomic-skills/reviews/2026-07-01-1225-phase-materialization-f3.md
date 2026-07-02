# phase-materialization F3 - review-code local

- **Date:** 2026-07-01 12:25 UTC
- **Scope:** `2037d802..de4fb488d2e122f688443db7029b2101aea0522e`
- **Mode:** local clean-context agent
- **Verdict:** approved_with_remediation
- **Counts:** 0B/0C/4M/0m/0n

## Capture

Destructive signal: false. The F3 diff adds a lazy `materialize` detail file,
router wiring, transition prose, and static contract tests. It does not delete
whole non-test files, does not contain schema/data drop tokens, and is not
deletion-dominated.

The local review ran in a spawned clean-context agent against the captured diff
for `2037d802..HEAD`. The reviewer saw only the diff and modified file list, not
the implementation conversation or intent narrative.

## Findings And Remediation

### M1 - Validation target skipped the materialized phase file

Severity: major.

`project-materialize.md` told the operator to run `validate-state.js` against
`plan.md` plus the bare `phases/` directory. The validator discovers known roots,
so that shape can validate only the plan and miss a malformed newly written
initiative.

Fix in `de4fb488d2e122f688443db7029b2101aea0522e`: the validation command now
passes the explicit newly written phase file path, and the test asserts that
contract.

### M2 - `materialize` was behind an active-initiative-only gate

Severity: major.

The router listed `materialize` inside the generic active initiative
pre-mutation gate, while a valid descriptor-only target can have no initiative
yet. That could block the command before it creates the initiative it exists to
create.

Fix in `de4fb488d2e122f688443db7029b2101aea0522e`: the router records the
`materialize` exception, and `project-transitions.md` mirrors the active-gate
exception for no-active-initiative materialization.

### M3 - Parallel transition materialization was over-constrained

Severity: major.

`materialize` required the requested phase to equal `currentPhase`, but
`phase-done` can activate more than one phase in parallel mode while
`currentPhase` points only at the first selected phase.

Fix in `de4fb488d2e122f688443db7029b2101aea0522e`: direct invocations still
require `currentPhase`, but internal transition calls pass the selected active
phase id set, so parallel-choice phases beyond the first can materialize.

### M4 - Existing successor initiatives were reused without activation

Severity: major.

`phase-done` said to skip `materialize` when the successor initiative file
already exists, but did not set the matching descriptor or initiative to
`active`.

Fix in `de4fb488d2e122f688443db7029b2101aea0522e`: the reuse path now explicitly
sets the selected phase descriptor and existing initiative to `status: active`,
refreshes `lastUpdated`, and runs `refresh-state`.

## Verification

- `rtk node --test tests/phase-materialization/materialize-verb.test.js` exited
  0: 9 tests, 9 pass, 0 fail.
- `rtk node --test tests/install.test.js tests/skill-byte-budget.test.js`
  exited 0: 45 tests, 45 pass, 0 fail.
- `rtk npm test` exited 0: 1507 tests, 1499 pass, 0 fail, 8 skipped.
- `rtk npm run validate-skills` exited 0: all 15 skills valid.
- `rtk node scripts/validate-state.js .atomic-skills/projects/atomic-skills/phase-materialization/plan.md .atomic-skills/projects/atomic-skills/phase-materialization/phases/f3-verbo-materialize-gate-de-validacao-de.md`
  exited 0: both files valid, one plan cross-validated.

## Self-review against code-quality gates

- G1 read-before-claim: applied - every remediation above is anchored in the
  reviewed file and guarded by static tests.
- G2 soft-language: applied - phase transition and materialize contracts are
  imperative and name the blocking conditions explicitly.
- G6 reference-or-strike: applied - the review report records each finding and
  the commit that fixed it.
- Review convergence: no blocker/critical findings remained; all four major
  findings were fixed before the phase gate was stamped.
