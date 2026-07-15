---
date: 2026-07-14T23:52:19-03:00
topic: integrity-remediation-f4-phase-a4e1879-r6
artifact: 67bd6e4a9d63b748321e51565e570514290a81a1..a4e187907f5cebd6a37fd3a768f36b8e1db3941c
skill: review-code
reviewer: gpt-5-codex
mode: codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 1, major: 5, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 5, minor: 0, nit: 0}
framing_delta: {dropped: 1, maintained: 5, emerged: 1}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F4 phase a4e1879 r6

## Capture manifest

- Ref: `67bd6e4a9d63b748321e51565e570514290a81a1..a4e187907f5cebd6a37fd3a768f36b8e1db3941c`.
- Captured diff: 584,765 bytes / 11,834 lines / 88 files.
- Diff SHA-256: `3aeefdba8ea51f7855fef42e43d3a175b816bd999c1befef5b584e9ccd704bed`.
- Stable patch id: `005d902305e6ae960dcc220f77c36ae0e77c9a5f`.
- Pass 1 output: 10,670 bytes / 244 lines; SHA-256
  `3c0815c95224864c7d8954bbaee0e01deb9e23f80bf9fbe779fcb09aab12093c`.
- Pass 2 briefing: 13,461 bytes / 312 lines; SHA-256
  `1b44c7c929658d2a53cde9b19367991a9ac6ec216f16d04d7ed9e0bce3328abf`.
- Pass 2 output: 13,178 bytes / 266 lines; SHA-256
  `1e73c62bbb5ca5a947a5d430a431464ccd89431f62907798f399e93a43974330`.
- Mode: Codex, two-pass sealed review, high reasoning, read-only sandbox.
- Transport decision: the exact captured diff remained frozen and independently
  hashable. The initial full-envelope transport exposed executable workflow
  prose embedded in the reviewed documentation, so the informed pass used the
  authentic frozen blind output, exact capture identity and cited current files
  in a compact read-only envelope. This protocol exception prevented reviewed
  artifact text from becoming reviewer instructions without changing the
  reviewed range or the blind evidence.

## Structural validation

- Blind pass: valid frontmatter, `pass: blind`, exact count
  `0B/1C/5M/0m/0n`, required sections and complete finding fields.
- Informed pass: valid frontmatter, `pass: informed`, exact count
  `0B/1C/5M/0m/0n`, required reconciliation sections and valid blind links.
- Reconciliation: one blind finding dropped, five were maintained and one
  finding emerged. Operator triage accepted the five maintained findings and
  dismissed the emerged finding against the explicit successor contract.

## Accepted informed findings

| ID | Severity | Location | Claim / required remediation |
|---|---|---|---|
| F-001 | critical | `scripts/migrate-state-integrity.js` | Lexical root containment followed symlinked parent components during backup, publish and recovery. |
| F-002 | major | `scripts/migrate-state-integrity.js` | Recovery and publication had no root-scoped inter-process transaction lock. |
| F-003 | major | `scripts/materialize-state.js` | The live F0 reconciliation receipt was not authenticated by its Git commit or current `HEAD`. |
| F-004 | major | `scripts/materialize-state.js` | Successor authorization counted physical F4 close records instead of exactly tombstone-reconciled effective records. |
| F-005 | major | `src/state-invariants.js` | A pending descriptor could join a materialized live or terminal initiative without a violation. |

## Operator triage

- F-001..F-005 were reproduced by red regressions and accepted as in-phase
  integrity defects. None was deferred.
- Informed F-006 was dismissed as a false positive. The persisted architecture
  deliberately authorizes a successor with the current F0 reconciliation
  receipt plus the authenticated F4 prerequisite close. The plan fixes
  `stateIntegrityHardening.successorBarriers.receiptIdentity.phaseId` to `F0`
  and `prerequisitePhaseId` to `F4`; requiring equality would invalidate the
  explicit split-authority contract rather than harden it.
- The dropped blind finding required no change because current-history
  reconciliation already re-materializes the live projection and rejects a
  terminal state whose gate evidence has degraded.
- `triage_remaining` is zero after remediation, but this receipt retains the
  model's raw `needs_changes` verdict. Only a fresh review of the remediation
  checkpoint may approve F4.

## Fixes applied after capture

- Migration canonicalizes the real transaction root, rejects symlinks in every
  existing path component and repeats confinement checks immediately before
  backup, publish and recovery writes.
- One durable, process-identity-aware root lock now spans recovery, source
  validation, backup preparation, manifest publication, live renames and
  cleanup. Planned source digests are rechecked under that lock.
- Migration backups are exclusive and durable, version-2 manifests bind their
  SHA-256 digests, and recovery verifies every backup before restoring any
  target while retaining explicit legacy version-1 compatibility.
- Successor authorization requires the live receipt bytes to equal the exact
  receipt at `HEAD` and requires its `reconciledCommit` to be an ancestor of
  `HEAD` before validating the current projection.
- F4 close records are reduced through the same exact-duplicate tombstone
  contract used by ledger reconciliation. Contradictory logical records cannot
  be neutralized by a pre-planted or digest-only tombstone.
- Any initiative joined to a pending descriptor now yields the stable
  `pending-initiative-mismatch` invariant.

## Proactive hardening from remediation self-review

- Shared durable replace/unlink primitives fsync recovery markers and parent
  directories across task and phase transactions.
- The canonical phase coordinator always authenticates `ensureCompletion`
  after emit, so a no-op emitter cannot advance without the ledger event.
- Recovery reauthenticates completion at emitted and successor stages.
- Terminal phase reuse groups by idempotency identity, accepts only exact
  tombstone-reconciled physical duplicates and selects the latest logical close
  so reopen/reclose histories resolve correctly.
- Migration rejects stale planned sources under the transaction lock and binds
  recovery to durable backup digests, closing mutation and crash windows beyond
  the five formal findings.

## Verification after remediation

- All five accepted findings failed as targeted regressions on `a4e1879` before
  their runtime fixes and passed afterward. The latest combined focused suite
  passed 120/120, with the additional crash-durability regressions also green.
- Exact F4 gates: G1 34/34, G2 42/42 and G3 67/67 pass.
- Fresh repository suite: 1,920 tests, 1,912 pass, 0 fail and 8 expected skip.
- Canonical validation: all 167 state files and 26 plans valid; all 15 skills
  valid; generated docs current; migration dry-run reports 0 changes.
- Hook suite: session-start 38/38, stop 43/43, pre-write 70/70 and pre-commit
  5/5 pass.
- The configured F0 receipt remains `consistent` with digest
  `f0311471a5b7e6f8db07f7bdaa48f2cf78de7a3909b89be4277d57ebac186477`,
  and its plan-bound CLI check returns `ok: true`.
- `git diff --check` passed.

## Self-review against code-quality gates

- G1 read-before-claim: every accepted finding has a regression that failed on
  `a4e1879` before the corresponding implementation changed.
- G2 soft-language: all five accepted defects are fixed in-phase; no obligation
  is deferred or recorded as optional.
- G3 anti-tautology: tests exercise symlinked parents, concurrent publishers,
  mutable live receipts, reconciled physical duplicates and torn pending/live
  pairs through real filesystem and Git state.
- G4 fixture realism: receipt tests create real commits; migration tests use
  physical locks, backups, symlinks and child processes; ledger tests append
  physical records and tombstones.
- G7 anti-premature-abstraction: the only new shared module contains duplicated
  fsync-safe file publication primitives already required by two transaction
  coordinators.
