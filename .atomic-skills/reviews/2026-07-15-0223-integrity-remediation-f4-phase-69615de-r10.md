---
date: 2026-07-15T02:23:27-03:00
topic: integrity-remediation-f4-phase-69615de-r10
artifact: 67bd6e4a9d63b748321e51565e570514290a81a1..69615de4f43a85b77e032245f2e51e5ef9baf9e8
skill: review-code
reviewer: gpt-5.6-sol
mode: codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 3, major: 3, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 4, major: 2, minor: 0, nit: 0}
framing_delta: {dropped: 3, maintained: 3, emerged: 3}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F4 phase 69615de r10

## Capture manifest

- Ref: `67bd6e4a9d63b748321e51565e570514290a81a1..69615de4f43a85b77e032245f2e51e5ef9baf9e8`.
- Captured diff: 698,829 bytes / 14,272 lines / 97 files.
- Diff SHA-256: `bd310982b55e30b147ae308deb06416ac077f43790e01479ea317e4b0022ba7a`.
- Stable patch id: `22bc7be43e26a3b2ebb37fbf89eca2f1eca887ce`.
- Pass 1 briefing SHA-256:
  `eed0a4d01a41a840fe0cdc39006478a1159e9448a42f72a21b0b4ab0fa9ba937`.
- Pass 1 output: 9,617 bytes / 222 lines; SHA-256
  `1ff32dff83a46e7e34a7a33ca645b5e129ab098c93f66d4141e7788abc4a9e1e`.
- Pass 2 briefing SHA-256:
  `24d718853011c8e89b217ae1a763f014176d07d3dbee6afc34855d4580f0ae3e`.
- Pass 2 output: 10,628 bytes / 242 lines; SHA-256
  `1dc89d77fe1ed696abb1549ec3592db553ba3721c8d992dbbd5e5e3691888dc0`.
- Mode: Codex, two-pass sealed review, high reasoning, read-only sandbox.
- Transport decision: the explicit `-m gpt-5-codex` request was rejected by
  the account before review. The exact same sealed briefing was rerun through
  Codex CLI 0.144.3 with its default transport, which reported
  `gpt-5.6-sol`. The generated review frontmatter still self-declared
  `gpt-5-codex`; this receipt records the observed transport as authoritative.

## Structural validation

- Blind pass: valid frontmatter, `pass: blind`, exact count
  `0B/4C/2M/0m/0n`, required sections and complete finding fields.
- Informed pass: valid frontmatter, `pass: informed`, exact count
  `0B/3C/3M/0m/0n`, required reconciliation sections and valid blind links.
- Reconciliation: three blind findings were maintained, three dropped and
  three informed findings emerged.

## Accepted informed findings

| ID | Severity | Location | Claim / required remediation |
|---|---|---|---|
| F-001 | critical | `scripts/lifecycle-order-guard.js` | Detached `reviewGate` input replaced the authoritative descriptor review and could authorize a close. |
| F-002 | critical | `scripts/materialize-state.js` | A prerequisite `closeSha` from a detached branch was accepted without belonging to the authenticated receipt HEAD ancestry. |
| F-003 | critical | `scripts/done-transaction.js` | Task state persisted schema-invalid `weightBasis`, while weight/basis validation happened only after state mutation. |
| F-004 | major | `scripts/emit-consumer-state.js` | Projection silently discarded malformed or schema-invalid completion ledger lines. |
| F-005 | major | `scripts/append-completion.js` | Reconciliation accepted a matching tombstone without first requiring a valid completion-event schema. |
| F-006 | major | `src/confined-path.js` | Newly created confined marker/lock directories were not synchronized into each parent directory. |

## Operator triage

- F-001..F-006 were accepted as in-phase integrity defects. None was deferred.
- The blind migration recovery finding was retained as operator finding F-O01
  even though the informed pass dropped it. Manifest v2 authenticated only the
  durable backup, not the current source bytes, so automatic recovery could
  overwrite a third-party edit that matched neither side of the transaction.
- The candidate-path finding was dropped: migration candidates are caller-owned
  temporary read inputs, not coordinator-owned persistent paths.
- The duplicate same-project phase-slug finding was dropped: project/slug is
  the declared unique phase identity, so the duplicate corpus is invalid rather
  than an alternate resolvable authority.
- `triage_remaining` is zero after remediation. The historical model verdict
  remains `needs_changes`; only a fresh review can approve F4.

## Fixes applied after capture

- Phase close now reads review authority only from the candidate descriptor.
  Detached review slices are ignored when no descriptor review exists and are
  rejected on drift when it does.
- Successor authorization requires the prerequisite `closeSha` to be an
  ancestor of the commit that authenticates the current reconciliation receipt.
- Task close constructs and schema-validates its prospective completion before
  creating a marker or persisting state. `weightBasis` is frozen in the event
  bundle and omitted from the task schema.
- `src/completion-event-validator.js` is the shared completion-event schema
  authority. Producer reconciliation and consumer projection both fail closed
  with physical-line diagnostics for malformed or schema-invalid ledger data.
- Reconciliation tombstones must satisfy the same strict event schema before
  they can neutralize an exact duplicate set.
- Component-wise confined directory creation synchronizes each newly created
  name into its parent using the repository's portable directory-fsync helper.
- Migration manifest v3 authenticates backup, pre-migration source and target
  digests. Recovery validates every backup and current source before restoring
  anything, preserves unknown concurrent bytes, and leaves recovery artifacts
  intact. v1/v2 manifests require manual recovery because they cannot prove the
  current-byte compare-and-swap precondition.

## Verification after remediation

- Red phase: the first focused run produced 10 expected failures across 148
  tests, covering all seven accepted mechanisms. Production fixes then exposed
  two stale authority fixtures and one legacy tombstone fixture; correcting the
  fixtures without weakening assertions yielded the focused suite green.
- Exact F4 gates: G1 38/38, G2 58/58 and G3 70/70 pass. The configured F0
  history receipt separately returns `ok: true`.
- Fresh repository suite: 1,954 tests, 1,946 pass, 0 fail and 8 expected skip.
- Canonical validation: all 167 state files and 26 plans cross-validate;
  AIDeck reports 26 plans, 97 phases, 88 initiatives, 280 tasks and 151 gates
  valid; all 15 skills validate; generated docs are current; migration dry-run
  reports 0 changes.
- Hook suite: session-start 38/38, stop 43/43, pre-write 70/70 and pre-commit
  5/5 pass.
- `git diff --check` passes. The configured F0 receipt remains `consistent`
  with projection digest
  `f0311471a5b7e6f8db07f7bdaa48f2cf78de7a3909b89be4277d57ebac186477`.

## Decisions recorded for later validation

1. Make the persisted descriptor the sole review authority. Caller-provided
   plan/phase slices may prove consistency but can never create review evidence.
2. Bind prerequisite history to the authenticated current branch: `closeSha`
   must be an ancestor of the commit whose bytes contain the accepted receipt.
3. Validate the exact prospective completion before every state mutation and
   keep event-only `weightBasis` out of persisted task state.
4. Use one schema-backed completion ledger parser for every structural reader;
   corrupted lines are integrity errors, not records to skip.
5. Require reconciliation records themselves to satisfy the canonical event
   schema before their digest relationship is considered.
6. Treat every newly created confined directory component as a durability
   boundary and fsync its parent immediately after creation.
7. Use manifest v3 source/target digests as a compare-and-swap recovery guard.
   Older manifests remain diagnosable but cannot authorize automatic restore.

## Self-review against code-quality gates

- G1 read-before-claim: review authority, successor ancestry, task schema,
  producer/consumer ledger paths, reconciliation and migration recovery were
  traced end-to-end before selecting shared invariants.
- G2 soft-language: all six informed findings plus F-O01 were fixed in this
  checkpoint; none is deferred.
- G3 anti-tautology: removing descriptor ownership, ancestry verification,
  pre-write validation, strict ledger parsing, tombstone validation, component
  fsync or manifest CAS breaks a named regression.
- G4 fixture realism: tests exercise actual git branches, corrupt NDJSON,
  persisted state, schema validation, filesystem durability calls and recovery
  artifacts.
- G5 red phase: all accepted mechanisms failed under targeted regression tests
  before their production fixes.
- G7 anti-premature-abstraction: only the completion schema validator became a
  shared module after producer, reconciler and consumer independently required
  the same contract.

## Next action

Commit this r10 remediation checkpoint, then run a fresh sealed Codex r11 review
over the fixed F4 base range. F4 remains active until that new review approves.
