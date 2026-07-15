---
date: 2026-07-15T00:24:32-03:00
topic: integrity-remediation-f4-phase-95c86da-r7
artifact: 67bd6e4a9d63b748321e51565e570514290a81a1..95c86daf5652dcf89849d0da1e5d455df5c728b2
skill: review-code
reviewer: gpt-5-codex
mode: codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 1, major: 2, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 3, minor: 0, nit: 0}
framing_delta: {dropped: 1, maintained: 3, emerged: 0}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F4 phase 95c86da r7

## Capture manifest

- Ref: `67bd6e4a9d63b748321e51565e570514290a81a1..95c86daf5652dcf89849d0da1e5d455df5c728b2`.
- Captured diff: 615,721 bytes / 12,692 lines / 88 files.
- Diff SHA-256: `002a2d79132af41b96e3cd276753a0c5c2455c48c3c482f6a7b10fad3d8bfef1`.
- Stable patch id: `1735c59330d9a915d56ec8082101ea5832703360`.
- Pass 1 briefing: 3,512 bytes / 97 lines; SHA-256
  `38114f252afe75256092cf87a5494d0251eac68e7bf448c4c83370a1e999ee46`.
- Pass 1 output: 8,424 bytes / 190 lines; SHA-256
  `721e62289802529c1016ef2c19d322cc1c61a4d7d319633551c5e4779a3c9b2f`.
- Pass 2 briefing: 5,122 bytes / 130 lines; SHA-256
  `19aab442667a098595b957466a7cc075f45ad8bc4d92e3d3558d7f149ad64446`.
- Pass 2 output: 5,203 bytes / 122 lines; SHA-256
  `e5b53ff9ad3c2990612b4fffc19271f47e913d1f7695971de40de84b4284d53f`.
- Mode: Codex, two-pass sealed review, high reasoning, read-only sandbox.
- Transport decision: the exact diff was captured once, hashed and exposed to
  both passes as an immutable read-only file. Briefings carried its path and
  fingerprint instead of embedding 615 KB of repository Markdown as executable
  prompt text. The operator used the user's standing authorization to continue
  past the large-diff gate and preserved the same artifact in both passes.

## Structural validation

- Blind pass: valid frontmatter, `pass: blind`, exact count
  `0B/1C/3M/0m/0n`, required sections and complete finding fields.
- Informed pass: valid frontmatter, `pass: informed`, exact count
  `0B/1C/2M/0m/0n`, required reconciliation sections and valid blind links.
- Reconciliation: three blind findings were maintained, one was dropped and no
  new finding emerged.

## Accepted informed findings

| ID | Severity | Location | Claim / required remediation |
|---|---|---|---|
| F-001 | critical | `scripts/phase-done-transaction.js` | Phase completion re-authenticated a candidate without the required aggregate `actuals`, conflicting with a compliant emitter or silently dropping telemetry. |
| F-002 | major | `scripts/append-completion.js` | Ledger lines were treated as durable after `appendFileSync` without fsyncing the file and parent directory before marker cleanup. |
| F-003 | major | `scripts/done-transaction.js` | Task retries re-derived mutable dispatch `actuals` instead of freezing the values owned by the original close. |

## Operator triage

- F-001..F-003 were reproduced under six red regressions and accepted as
  in-phase integrity defects. None was deferred.
- Blind F-004 was dismissed after informed verification. Successor
  authorization authenticates the historical F4 close and review ancestry
  separately, then combines that prerequisite close with the current F0
  reconciliation receipt. Requiring the F0 receipt's `closeSha` to belong to
  `reconciledCommit` would conflate those complementary authorities.
- `triage_remaining` is zero after remediation. This receipt retains the model's
  raw `needs_changes` verdict; only a fresh review may approve F4.

## Fixes applied after capture

- Phase close validates aggregate actuals before any marker, freezes them in the
  durable marker, supplies the same value to the emitter and mandatory ledger
  authentication, and adopts marker-owned telemetry on recovery rather than a
  changed retry payload.
- Completion appends now use an explicit descriptor, fsync the ledger and parent
  directory before returning, and re-sync an already visible matching record so
  a prior append-then-fsync failure cannot be mistaken for durable success.
- Existing idempotent records supply their immutable actuals when a retry omits
  them; dispatch telemetry is derived only when no matching completion exists.
- Task close derives dispatch actuals before its first recovery marker, stores
  them in the immutable close bundle and uses those persisted values for event
  retries and missing-event repair after dispatch-log drift.
- Phase-transition documentation now makes `input.actuals` and marker ownership
  explicit while retaining the exactly-one aggregate event contract.

## Proactive hardening from remediation self-review

- The malformed-actuals boundary rejects unknown fields before creating any
  phase recovery state.
- A multiprocess run exposed macOS returning `EINVAL` when another contender
  removes an empty lock-guard directory during claim publication. Guard setup
  now retries that documented removal race just as it retries `ENOENT`; five
  repeated multiprocess runs passed 10/10 afterward.

## Verification after remediation

- Red phase: 6 expected failures and 36 neighboring passes on `95c86da` before
  production changes. The additional malformed-input boundary passed after the
  fix.
- Focused ledger/actuals/concurrency surface: 107/107 pass.
- Exact F4 gates: G1 34/34, G2 49/49 and G3 67/67 pass.
- Fresh repository suite: 1,927 tests, 1,919 pass, 0 fail and 8 expected skip.
- Canonical validation: all 167 state files and 26 plans valid; all 15 skills
  valid; generated docs current; migration dry-run reports 0 changes.
- Hook suite: session-start 38/38, stop 43/43, pre-write 70/70 and pre-commit
  5/5 pass.
- The configured F0 receipt remains `consistent` with projection digest
  `f0311471a5b7e6f8db07f7bdaa48f2cf78de7a3909b89be4277d57ebac186477`,
  and its plan-bound CLI check returns `ok: true`.
- `git diff --check` passed.

## Self-review against code-quality gates

- G1 read-before-claim: source, direct callers and persisted contracts were read
  before each finding was accepted; the dropped provenance claim was verified
  against the complete successor authorization path.
- G2 soft-language: all accepted findings were fixed in-phase; none is deferred
  or described as optional.
- G3 anti-tautology: removing marker actuals, re-deriving after dispatch drift,
  skipping the file-sync boundary or rebuilding the phase candidate without
  actuals breaks a named regression assertion.
- G4 fixture realism: tests use physical recovery markers, completion and
  dispatch ledgers, child processes and injected post-append/fsync failures.
- G5 red phase: all six formal regressions failed for their expected mechanisms
  on the reviewed checkpoint before runtime changes.
- G7 anti-premature-abstraction: three local mechanism helpers were added inside
  the existing completion-ledger authority; no new module or public authority was
  introduced, and transaction bundles retain the existing ownership model.
