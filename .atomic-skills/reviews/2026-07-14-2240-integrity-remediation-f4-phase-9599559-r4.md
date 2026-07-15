---
date: 2026-07-14T22:40:13-03:00
topic: integrity-remediation-f4-phase-9599559-r4
artifact: 67bd6e4a9d63b748321e51565e570514290a81a1..9599559959f05d9edb97ad656dc68b758b9d1eee
skill: review-code
reviewer: gpt-5-codex
mode: codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
framing_delta: {dropped: 1, maintained: 3, emerged: 2}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F4 phase 9599559 r4

## Capture manifest

- Ref: `67bd6e4a9d63b748321e51565e570514290a81a1..9599559959f05d9edb97ad656dc68b758b9d1eee`.
- Captured diff: 518,021 bytes / 10,417 lines / 84 files.
- Diff SHA-256: `5a78e04ec81cab16b2e3b561a41387529884a656f7db20421a3c9473bd79fbc2`.
- Stable patch id: `e065a46d703c106058cb4d524a022f42da8fe581`.
- Pass 1 briefing: 704,398 bytes / 15,302 lines; SHA-256
  `a153fcf94be87ee70a7664725bfb3fa4715d5f33507495c114317e7b21dae36e`.
- Pass 1 output: 11,180 bytes / 238 lines; SHA-256
  `7cfac4630230e141838c2c455822de16f80f7e8787cbb2724ded28fbc056a3b0`.
- Pass 2 briefing: 720,059 bytes / 15,658 lines; SHA-256
  `08653fec4e58f10fbdbb012b9820aa4f40a0f67eb751605e90c9e8656d77dc1d`.
- Pass 2 output: 10,184 bytes / 221 lines; SHA-256
  `6d59dcd979363220e3080d789079f176470e6451f880827e38c3597cd596fc24`.
- Mode: Codex, two-pass sealed envelope, high reasoning, read-only sandbox.

## Structural validation

- Blind pass: valid frontmatter, `pass: blind`, exact count
  `0B/0C/4M/0m/0n`, required sections and complete finding fields.
- Informed pass: valid frontmatter, `pass: informed`, exact count
  `0B/0C/5M/0m/0n`, required reconciliation sections and valid blind links.
- Reconciliation: three blind findings maintained, one dropped after the
  transaction-level guard was inspected, and two transaction-reuse defects
  emerged from the exactly-once constraints.

## Informed findings

| ID | Severity | Location | Claim / required remediation |
|---|---|---|---|
| F-001 | major | `src/state-invariants.js` | A non-terminal materialized descriptor can join a terminal initiative. Reject terminal matches for active/paused descriptors. |
| F-002 | major | `scripts/done-transaction.js` | A terminal initiative can still receive a new task close. Make terminal initiative state immutable. |
| F-003 | major | `scripts/materialize-state.js` | Successor authorization validates the current descriptor and historical initiative but not the current prerequisite initiative. Resolve and validate the current mirror before publication. |
| F-004 | major | `scripts/done-transaction.js` | An already-done task with no marker returns success without authenticating completion and checkpoint. Resume from durable state under the immutable original identity. |
| F-005 | major | `scripts/phase-done-transaction.js` | Terminal mirrors with no marker return success without guard, close commit, canonical event or successor authentication. Revalidate every terminal proof before reuse. |

## Operator triage

- F-001..F-005 were reproduced and accepted as in-phase integrity defects under
  the operator's delegated decision. None was deferred.
- The red regression run produced eight failures across the four affected test
  files: one invariant join, two task-close, three phase-close and two successor
  barrier failures.
- The receipt retains the model's `needs_changes` verdict for the reviewed
  artifact. `triage_remaining` is zero because all five findings were remediated
  after capture; only a fresh review of the remediation checkpoint may approve
  F4.

## Fixes applied after capture

- State validation now emits stable `nonterminal-status-mismatch` evidence when
  an active/paused descriptor resolves only to a `done`/`archived` initiative.
- Task close accepts only live `active`/`paused` initiatives. An already-done
  task restores its original `closedAt`, creates a `state-persisted` recovery
  marker, authenticates or repairs its single completion event and checkpoint,
  proves cleanliness and only then reports reuse.
- Terminal phase reuse derives review authority from the persisted descriptor,
  reruns the close guard at the immutable review anchor, requires exactly one
  canonical phase completion, binds it to an authenticated close commit and
  idempotently rechecks any persisted successor obligation.
- Successor authorization recursively resolves exactly one current prerequisite
  initiative across live/archive paths and validates terminal status, immutable
  task closes and the complete gate mirror before consulting historical proof.
- Operator instructions now state the same immutable/recovery contracts, so the
  documented transition cannot reintroduce the removed shortcuts.

## Verification after remediation

- Focused transaction/invariant suite: 61/61 pass.
- Full phase-materialization family: 123/123 pass.
- Additional recovery and detached-authority regressions: 30/30 pass across
  `done-transaction` and `phase-done-transaction`.
- Fresh repository suite: 1,897 tests, 1,889 pass, 0 fail, 8 expected skip.
- Canonical validation: all 167 state files and 26 plans valid; all 15 skills
  valid; generated docs current; migration dry-run reports 0 changes.
- The configured F0 receipt remains `consistent` with digest
  `f0311471a5b7e6f8db07f7bdaa48f2cf78de7a3909b89be4277d57ebac186477`,
  and its plan-bound CLI check returns `ok: true`.
- `git diff --check` passed.

## Self-review against code-quality gates

- G1 read-before-claim: every r4 finding has a negative regression that failed
  on the reviewed checkpoint before the runtime change was applied.
- G2 soft-language: all five accepted defects are fixed in-phase; no review
  obligation is deferred or described as optional.
- G3 anti-tautology: regressions delete and drift current prerequisite state,
  inject terminal task mutation, remove completion/checkpoint proof, forge a
  detached review slice and mismatch event-to-commit identity.
- G4 fixture realism: successor tests use real Git history, archived initiative
  files, structured receipts and the append-only completion ledger.
- G7 anti-premature-abstraction: current/historical initiative closure shares one
  validator; transaction changes reuse the existing recovery stages and ledger
  authority rather than adding a parallel writer.
