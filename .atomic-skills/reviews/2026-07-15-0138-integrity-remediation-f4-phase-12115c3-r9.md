---
date: 2026-07-15T01:38:17-03:00
topic: integrity-remediation-f4-phase-12115c3-r9
artifact: 67bd6e4a9d63b748321e51565e570514290a81a1..12115c3548a4fd2ada683731c859f8c63c9de7e0
skill: review-code
reviewer: gpt-5-codex
mode: codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 3, major: 4, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 2, major: 4, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 6, emerged: 1}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F4 phase 12115c3 r9

## Capture manifest

- Ref: `67bd6e4a9d63b748321e51565e570514290a81a1..12115c3548a4fd2ada683731c859f8c63c9de7e0`.
- Captured diff: 660,582 bytes / 13,642 lines / 93 files.
- Diff SHA-256: `03f77edc46f5c47ada8dff2edacd92be3385a2f8d38fed5eb9053c92e87f34f0`.
- Stable patch id: `c4f8c4c1eefc0fd4cada351e64aa3248e3393e6b`.
- Pass 1 briefing: 3,512 bytes / 97 lines; SHA-256
  `943d28c8c9bb308e9a6fae25c770c900d01b3de2982963b0d401d95b13d02ebb`.
- Pass 1 output: 8,395 bytes / 208 lines; SHA-256
  `0b44b1052c2d8659b9a5e4ee55b61962caf38fee7459ea94aae21118b7441c77`.
- Pass 2 briefing: 5,338 bytes / 133 lines; SHA-256
  `c0f3e58033071d0c044f17da328b00ac99f6097d7d3cb2e75ee95800231eae85`.
- Pass 2 output: 15,275 bytes / 347 lines; SHA-256
  `61bb1d82c1bce2f11ee3746ab63691c10e61e783debbfbf2154525d03f51c46f`.
- Mode: Codex, two-pass sealed review, high reasoning, read-only sandbox.
- Transport decision: the exact diff was captured once, hashed and exposed to
  both passes as an immutable read-only file. Both briefings used the same
  frozen path/fingerprint and explicit anti-framing instructions.

## Structural validation

- Blind pass: valid frontmatter, `pass: blind`, exact count
  `0B/2C/4M/0m/0n`, required sections and complete finding fields.
- Informed pass: valid frontmatter, `pass: informed`, exact count
  `0B/3C/4M/0m/0n`, required reconciliation sections and valid blind links.
- Reconciliation: all six blind findings were maintained, none dropped and one
  critical emerged.

## Accepted informed findings

| ID | Severity | Location | Claim / required remediation |
|---|---|---|---|
| F-001 | critical | `scripts/migrate-state-integrity.js` | A migration creator paused before owner publication could lose its directory to reclamation and later remove a live replacement. |
| F-002 | critical | `scripts/transaction-lock.js` | Stale classification was not bound to the owner object later quarantined, permitting removal of a live replacement. |
| F-003 | major | state lock/marker/ledger paths | Lexical `.atomic-skills`, `analytics` and `status` paths followed repository-controlled symlinks outside the root. |
| F-004 | major | `src/durable-file.js` and callers | Unconditional directory fsync failed on Windows after a filesystem mutation. |
| F-005 | major | `scripts/emit-consumer-state.js` | Burnup/SPI silently retained the first duplicate idempotency key without exact tombstone authentication. |
| F-006 | major | `scripts/migrate-state-integrity.js` | Legacy v1 manifests authorized restoration from backups with no authenticated digest. |
| F-007 | critical | task/phase transaction coordinators | Task closes and phase close mutated one initiative under disjoint lock identities, so normal concurrent closes could overwrite state. |

## Operator triage

- F-001..F-007 were accepted as in-phase integrity defects. None was dropped,
  deferred or left for a later phase.
- F-001 and F-002 now share one process-claim guard protocol; F-003 uses one
  component-wise repository confinement primitive across ledger, lock and
  recovery marker paths.
- `triage_remaining` is zero after remediation. This receipt preserves the raw
  model verdict; only a fresh review can approve F4.

## Fixes applied after capture

- A shared owner-authenticated bakery/ticket guard now serializes migration,
  transaction and completion-lock creation, stale classification, reclamation
  and release. Migration owner publication cannot be reclaimed during its
  grace interval, and transaction reclamation rechecks inode and owner token
  before quarantining the observed file.
- Repository state paths now canonicalize the real root, validate every path
  component, reject symlinks/non-directories, create parents one component at a
  time and keep the resulting file beneath the root.
- Directory synchronization is centralized in one platform-aware helper. File
  fsync remains mandatory; Windows skips only unsupported directory fsync.
- Completion-series projection uses the producer's exact duplicate/tombstone
  semantics. Exact reconciled repeats count once; contradictory or
  unneutralized groups throw instead of becoming order-dependent metrics.
- Migration recovery recognizes v1 manifests for diagnosis but refuses to
  restore their unauthenticated backup bytes.
- Task and phase closes now share the `phase-state/projectId/planSlug/phaseId`
  lock, matching the initiative object both operations mutate.
- Transition documentation records the shared lock identity, symlink
  confinement, portable durability boundary and canonical ledger projection.

## Proactive hardening from remediation self-review

- Intermediate `analytics` and `status` symlinks have dedicated regressions in
  addition to the original `.atomic-skills` symlink cases.
- The new common helpers are syntax-checked directly, and every state-writing
  caller uses the same portable directory-sync and confinement contracts.

## Verification after remediation

- Red phase: the first focused run produced 8 failures across 68 tests, one for
  every targeted mechanism (the portability fixture exposed two expected
  failures). After production fixes, two remaining failures were proven to be
  fixture errors: macOS `/var` aliasing under a simulated Windows platform and
  an incorrect manifest filename predicate. Correcting only those fixtures
  yielded 97/97 focused tests passing.
- Direct syntax/confinement/durability recheck: 29/29 tests pass after adding
  intermediate symlink coverage; `git diff --check` passes.
- Exact F4 gates: G1 35/35, G2 55/55 and G3 67/67 pass.
- Fresh repository suite: 1,942 tests, 1,934 pass, 0 fail and 8 expected skip.
- Canonical validation: all 167 state files and 26 plans valid; all 15 skills
  valid; generated docs current; migration dry-run reports 0 changes.
- Hook suite: session-start 38/38, stop 43/43, pre-write 70/70 and pre-commit
  5/5 pass.
- The configured F0 receipt remains `consistent` with projection digest
  `f0311471a5b7e6f8db07f7bdaa48f2cf78de7a3909b89be4277d57ebac186477`,
  and its plan-bound CLI check returns `ok: true`.

## Decisions recorded for later validation

1. Use one shared process-claim guard for every lock family instead of three
   subtly different stale-owner protocols.
2. Bind transaction reclamation twice: serialize it under the guard, then
   compare device/inode and owner token immediately before quarantine.
3. Treat every existing symlink component below the canonical repository root
   as invalid for coordinator-owned state, even when its resolved target would
   currently remain inside the checkout.
4. Preserve file fsync on all platforms while skipping only directory fsync on
   Windows, matching the platform's supported durability boundary.
5. Make analytics projection obey the ledger's exact reconciliation contract;
   corrupted duplicates are state errors, not a first-record-wins policy.
6. Keep v1 migration manifests readable for diagnostics but require explicit
   operator recovery rather than automatically trusting unauthenticated bytes.
7. Serialize at the mutated aggregate: every task close and phase close for one
   phase initiative uses the same `phase-state` identity.

## Self-review against code-quality gates

- G1 read-before-claim: the three owner protocols, all marker/ledger paths,
  durability callers, series projection and both close coordinators were read
  before choosing shared authorities.
- G2 soft-language: all seven accepted findings were fixed in this checkpoint;
  none is deferred.
- G3 anti-tautology: removing guard serialization, inode/token rechecks,
  component confinement, Windows branching, canonical duplicate validation,
  v1 rejection or shared phase scope breaks a named regression.
- G4 fixture realism: tests use real competing processes, filesystem renames,
  symlinks, recovery files and a loader shim that makes directory descriptors
  fail on simulated Windows.
- G5 red phase: the targeted suite failed on the eight expected mechanisms
  before the corresponding production changes.
- G7 anti-premature-abstraction: process ownership and confinement were shared
  only after three runtime lock implementations and four state path families
  demonstrated the same invariant.

## Next action

Commit this r9 remediation checkpoint, then run a fresh sealed Codex r10 review
over the fixed F4 base range. F4 remains active until that new review approves.
