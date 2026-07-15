---
date: 2026-07-15T02:47:19-03:00
topic: integrity-remediation-f4-phase-5c3e1cc-r11
artifact: 67bd6e4a9d63b748321e51565e570514290a81a1..5c3e1ccbdc6800cace0ec7f1253122f29995fea4
skill: review-code
reviewer: gpt-5.6-sol
mode: codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 2, major: 3, minor: 0, nit: 0}
framing_delta: {dropped: 2, maintained: 3, emerged: 2}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F4 phase 5c3e1cc r11

## Capture manifest

- Ref: `67bd6e4a9d63b748321e51565e570514290a81a1..5c3e1ccbdc6800cace0ec7f1253122f29995fea4`.
- Captured diff: 734,190 bytes / 15,079 lines / 101 files.
- Diff SHA-256: `278e3d00462c7e49502921c198b71f0b628fe61594b9a7cb863c0a677246bebc`.
- Stable patch id: `f69f904d92635fae199612d25777cb423e9cb263`.
- Pass 1 briefing SHA-256:
  `367c5a5b6f253510bf7f1bc8e98f815fde01c8ef14d20076b527ab268c42e037`.
- Pass 1 output: 9,002 bytes / 201 lines; SHA-256
  `078defa8faf247fa06ddbc2c45116acc30172755102973fb605c5bb2214ce0c7`.
- Pass 2 briefing SHA-256:
  `c0ef89979a6d74c462d1cedb0b480177b140e9ec749f570450f7c077ef52a82b`.
- Pass 2 output: 10,760 bytes / 230 lines; SHA-256
  `30ef07097d951cdb26e6b41cdbbaaff32c69c2ae0b9712987f9e91c35a30f0db`.
- Mode: Codex, two-pass sealed review, high reasoning, read-only sandbox.
- Transport decision: Codex CLI 0.144.3 reported its default model as
  `gpt-5.6-sol`. The generated review frontmatter self-declared
  `gpt-5-codex`; this receipt records the observed transport as authoritative.

## Structural validation

- Blind pass: valid frontmatter, `pass: blind`, exact count
  `0B/2C/3M/0m/0n`, required sections and complete finding fields.
- Informed pass: valid frontmatter, `pass: informed`, exact count
  `0B/0C/5M/0m/0n`, required reconciliation sections and valid blind links.
- Reconciliation: three blind findings were maintained, two dropped and two
  informed findings emerged.
- The reviewer's attempted targeted test run failed only because its read-only
  sandbox denied `mkdtemp` under the host temporary directory; no test result
  from that environmental run was used as product evidence.

## Accepted informed findings

| ID | Severity | Location | Claim / required remediation |
|---|---|---|---|
| F-001 | major | `scripts/migrate-state-integrity.js` | The source digest is checked before staging but not at the publication boundary, so an ordinary state writer can be overwritten. |
| F-002 | major | `scripts/append-completion.js` | A partial final append leaves malformed tail bytes that strict readers cannot authenticate or recover automatically. |
| F-003 | major | `.gitattributes` | The append-only completion ledger lacks `merge=union`, allowing cross-worktree completion loss or manual conflict resolution. |
| F-004 | major | `scripts/materialize-state.js` | The history-specific completion parser accepts arbitrary JSON objects instead of enforcing the shared completion-event schema. |
| F-005 | major | `scripts/dispatch-log.js` | The canonical dispatch writer lacks confined path resolution, shared locking and file/parent durability before success. |

## Operator triage

- F-001..F-005 were accepted as in-phase integrity defects. None was deferred.
- The blind receipt-signature critical was dropped under the documented trust
  boundary: repository/Git state is operator-controlled workflow provenance,
  not a cryptographic boundary against an arbitrary repository author.
- The blind same-UID path-replacement critical was dropped under the documented
  concurrency boundary: confinement must reject pre-existing symlinks and
  non-directories, not defend against a malicious peer replacing parents
  between syscalls.
- `triage_remaining` is zero. The historical model verdict remains
  `needs_changes`; only a fresh review of the remediated checkpoint can approve
  F4.

## Remediation decisions for later validation

1. Revalidate every migration source digest after all durable preparation and
   immediately before the first publication rename. Any drift aborts without
   overwriting the ordinary writer and recovery preserves unknown bytes.
2. Publish completion-ledger updates as an atomic durable replacement under the
   existing global ledger lock, so a crash exposes either the complete old
   ledger or the complete new ledger and never a partial JSON tail.
3. Mark `.atomic-skills/analytics/completions.jsonl` with `merge=union` and
   prove two branch-local appends survive an actual Git union merge as valid
   canonical NDJSON.
4. Make history materialization consume the shared strict completion-event
   parser while preserving physical line metadata for diagnostics and repairs.
5. Resolve dispatch state through confined path authorities, serialize all
   reads/appends through one process-owned ledger lock, and fsync the file and
   containing directory before returning success.

## Remediation status

All five informed findings were reproduced and fixed without defer:

- Migration derives every `phase-state` lock scope from the validated target
  frontmatter and project-scoped path, holds those process-owned locks across
  durable preparation/publication, and compares all source digests immediately
  before the first rename. The exported API cannot opt out or lie about a scope
  for a repository `.atomic-skills` tree.
- Completion and dispatch ledgers publish each logical append through a fully
  staged, fsynced sibling replacement under their shared global lock. A crash
  during a partial staged append leaves the old complete ledger visible; after
  rename only the complete new ledger can be visible. Existing bytes remain an
  immutable ordered prefix.
- `.atomic-skills/analytics/completions.jsonl` now resolves to Git's built-in
  union driver. An integration test creates two real branches, appends one
  canonical event on each and verifies that an actual merge preserves all
  schema-valid records.
- `parseCompletionEventLogEntries` is the shared schema-backed parser with
  physical line metadata. History materialization and completion writers now
  reject malformed or schema-invalid records through this one authority.
- Dispatch paths resolve only through the confined repository authority. Reads
  and writes share the process-owned `dispatch-ledger` scope lock; writers
  validate existing content and fsync file plus parent before reporting
  success. Eight concurrent writer processes preserve all eight records.

The local phase review also found and closed one additional API bypass: a
caller could initially supply no `stateScopes` or unrelated scope tuples to the
low-level migration helper. Scope is now derived rather than caller asserted.

## Verification after remediation

- Initial red phase: 87 targeted tests, 80 pass and exactly 7 expected failures
  across the five accepted findings. The additional scope-derivation regression
  then failed 1/1 before its fix.
- Focused post-fix suite: 95/95 pass, including multiprocess completion and
  dispatch writers, transaction locks, migration CAS, schema parsing and a real
  Git union merge.
- Exact F4 gates: G1 40/40, G2 58/58 and G3 74/74 pass. The configured F0
  history receipt separately returns `ok: true` with projection digest
  `f0311471a5b7e6f8db07f7bdaa48f2cf78de7a3909b89be4277d57ebac186477`.
- Expanded durability/merge/schema suite: 51/51 pass.
- Fresh repository suite: 1,963 tests, 1,955 pass, 0 fail and 8 expected skip.
- Canonical validation: all 167 state files and 26 plans cross-validate;
  AIDeck reports 26 plans, 97 phases, 88 initiatives, 280 tasks and 151 gates
  valid; all 15 skills validate; generated docs are current; migration dry-run
  reports 0 changes.
- Hook suite: session-start 38/38, stop 43/43, pre-write 70/70 and pre-commit
  5/5 pass. `git diff --check` passes.

## Self-review against code-quality gates

- G1 read-before-claim: migration lock ordering, both ledger writers, history
  parser and cross-branch merge behavior were traced through their callers and
  recovery paths before selecting shared invariants.
- G2 soft-language: all five informed findings and the API bypass found by the
  local review are fixed in this checkpoint; none is deferred.
- G3 anti-tautology: removing the pre-publish digest check/lock, atomic staged
  append, completion union attribute, strict history parser or confined durable
  dispatch path breaks a named regression.
- G4 fixture realism: tests exercise real child processes, real Git branches
  and merge, symlinked parents, injected partial writes, durable manifests and
  schema-invalid NDJSON.
- G5 red phase: every accepted mechanism failed before its production fix, and
  the subsequently discovered API bypass received its own red proof.
- G7 anti-premature-abstraction: the durable append helper is shared only after
  both completion and dispatch ledgers required the identical crash boundary;
  the strict parser was already the canonical completion schema authority.

## Next action

Create the local r11-remediation checkpoint and execute a fresh sealed Codex
r12 review over that commit. No push, PR or publication is authorized.
