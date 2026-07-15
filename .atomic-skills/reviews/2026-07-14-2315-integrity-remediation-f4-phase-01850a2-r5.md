---
date: 2026-07-14T23:15:35-03:00
topic: integrity-remediation-f4-phase-01850a2-r5
artifact: 67bd6e4a9d63b748321e51565e570514290a81a1..01850a21045bd02051fc5051ff86be69f4c86b06
skill: review-code
reviewer: gpt-5-codex
mode: codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 1, major: 10, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 8, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 9, emerged: 2}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F4 phase 01850a2 r5

## Capture manifest

- Ref: `67bd6e4a9d63b748321e51565e570514290a81a1..01850a21045bd02051fc5051ff86be69f4c86b06`.
- Captured diff: 542,175 bytes / 10,919 lines / 85 files.
- Diff SHA-256: `b1e84a748aa131a7a729420c7be168b07180f822a42b35e2d5ddd2a43d17a842`.
- Stable patch id: `838402cbc1b4e2d529a2d4311c3f1c33ff9a34c1`.
- Pass 1 briefing: 773,183 bytes / 16,854 lines; SHA-256
  `3945bbfae667c3ab5f038e1f896502200418885414e0859257166fc50950a342`.
- Pass 1 output: 14,455 bytes / 330 lines; SHA-256
  `8af4f37a08b9d66ef6498a0f3690bd5303a53b1989cf111f014b7330666b3287`.
- Pass 2 briefing: 792,345 bytes / 17,303 lines; SHA-256
  `388f0647082e6113f148c901267b8d92a7a06be798703d93ffbaa56887607b0c`.
- Pass 2 output: 17,653 bytes / 423 lines; SHA-256
  `081e324a239531916aed550fd2344e6912841e57ec2c5551a547c94b6f3b9056`.
- Mode: Codex, two-pass sealed envelope, high reasoning, read-only sandbox.

## Structural validation

- Blind pass: valid frontmatter, `pass: blind`, exact count
  `0B/1C/8M/0m/0n`, required sections and complete finding fields.
- Informed pass: valid frontmatter, `pass: informed`, exact count
  `0B/1C/10M/0m/0n`, required reconciliation sections and valid blind links.
- Reconciliation: all nine blind findings were maintained and two migration/
  ledger defects emerged from the informed exactly-once analysis.

## Informed findings

| ID | Severity | Location | Claim / required remediation |
|---|---|---|---|
| F-001 | critical | `scripts/phase-done-transaction.js` | Evidence candidates for plan/phase/initiative were overwritten by stale authoritative objects, so a normal pending mirrored gate could not close. |
| F-002 | major | `scripts/phase-done-transaction.js` | Recovery was keyed by `closedAt`; a retry with a new timestamp could strand a committed marker. |
| F-003 | major | `scripts/done-transaction.js` | Event-persisted/checkpointed recovery trusted the marker completion instead of reauthenticating or repairing the ledger. |
| F-004 | major | `scripts/transaction-lock.js` | Lock directory creation and owner publication were separate, allowing an ownerless interval and competing reclaim. |
| F-005 | major | `scripts/done-transaction.js` | Already-done reuse rebuilt evidence, next action and handoff from the retry caller rather than persisted provenance. |
| F-006 | major | `scripts/materialize-state.js` | Successor receipt identity was slug-bound but not bound to the owning project path. |
| F-007 | major | `scripts/validate-state.js`, `scripts/materialize-state.js` | Splitting on `..` misparsed valid triple-dot review ranges. |
| F-008 | major | `scripts/migrate-state-integrity.js` | POSIX-only path splitting false-greened Windows paths. |
| F-009 | major | `scripts/migrate-state-integrity.js` | Per-file truncating writes had no atomic multi-file publication or crash recovery. |
| F-010 | major | `scripts/migrate-state-integrity.js` | Migration could write before rejecting duplicate phase/task/gate IDs. |
| F-011 | major | `scripts/append-completion.js` | `ensureCompletion` selected the first idempotency key match and ignored unneutralized duplicates. |

## Operator triage

- F-001..F-011 were reproduced and accepted as in-phase integrity defects under
  the operator's delegated decision. None was deferred.
- Negative regressions covered candidate mirror closure, scope-key recovery,
  completion repair, atomic lock publication, persisted provenance, project
  ownership, triple-dot ranges, Windows paths, transactional rollback,
  duplicate identities and duplicate ledger records.
- The receipt retains the model's `needs_changes` verdict for the reviewed
  artifact. `triage_remaining` is zero because every finding was remediated
  after capture; only a fresh review of the new checkpoint may approve F4.

## Fixes applied after capture

- Phase evidence production now returns one authenticated candidate bundle.
  Only exit-gate/review fields may differ from the fresh authoritative state,
  and both persisted mirrors must be coherent before the commit guard runs.
- Phase recovery discovers exactly one marker by logical project/plan/phase
  scope, adopts its immutable close payload and rejects duplicate markers.
- Task recovery re-runs ledger authentication at every durable stage, repairs a
  missing event, rejects a malformed/conflicting marker completion and uses
  persisted task evidence, next action and handoff for terminal reuse.
- Scope locks publish a complete owner record through an atomic no-clobber hard
  link. The live lock is one regular file and release remains token-bound.
- Successor authorization requires the canonical nested project plan path and
  exact configured `receiptSources.planPath` before checking the receipt.
- One shared review-receipt parser accepts a full SHA or exact two-/three-dot
  full-SHA range and rejects malformed or mixed-width ranges.
- Migration path parsing accepts both separators, rejects duplicate invariant
  IDs before planning, creates exclusive byte-identical backups, durably stages
  every output, publishes under a manifest and rolls the entire set back on
  failure or the next startup after a crash. Recovery paths are root-bound and
  symlink-resistant.
- Completion reuse inspects every matching idempotency record. Multiple records
  are accepted only when exactly one append-only reconciliation tombstone binds
  the canonical digest and ordered duplicate digests.

## Verification after remediation

- Red regressions reproduced all eleven findings before the runtime fixes.
- Focused remediation suite: 184/184 pass; final self-review hardenings: 143/143 pass.
- Exact F4 gates: G1 30/30, G2 40/40 and G3 64/64 pass.
- Fresh repository suite at the remediation checkpoint: 1,911 tests, 1,903
  pass, 0 fail, 8 expected skip.
- Canonical validation: all 167 state files and 26 plans valid; all 15 skills
  valid; generated docs current; migration dry-run reports 0 changes.
- The configured F0 receipt remains `consistent` with digest
  `f0311471a5b7e6f8db07f7bdaa48f2cf78de7a3909b89be4277d57ebac186477`,
  and its plan-bound CLI check returns `ok: true`.
- Hook suite and `git diff --check` passed.

## Self-review against code-quality gates

- G1 read-before-claim: every accepted finding has a regression that failed on
  `01850a2` before its corresponding implementation changed.
- G2 soft-language: the critical and ten majors are fixed in-phase; no
  obligation is deferred or recorded as optional.
- G3 anti-tautology: tests inject failure before/after durable boundaries,
  mutate timestamps and provenance, remove ledger events, create duplicates,
  cross project identities and publish one of two migration sources.
- G4 fixture realism: successor tests use real Git history and structured
  receipts; transaction tests use physical markers/ledgers; migration tests
  compare exact bytes and persisted recovery manifests.
- G7 anti-premature-abstraction: shared logic was introduced only for the
  duplicated review-range parser and the migration transaction boundary; all
  other fixes extend the existing authorities and recovery stages.
