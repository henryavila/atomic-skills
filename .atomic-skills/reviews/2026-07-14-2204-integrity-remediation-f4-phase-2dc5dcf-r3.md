---
date: 2026-07-14T22:04:28-03:00
topic: integrity-remediation-f4-phase-2dc5dcf-r3
artifact: 67bd6e4a9d63b748321e51565e570514290a81a1..2dc5dcfd668c4341f616acb4835f5c8c3dfd3b3d
skill: review-code
reviewer: gpt-5-codex
mode: codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 1, major: 13, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 7, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 8, emerged: 6}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F4 phase 2dc5dcf r3

## Capture manifest

- Ref: `67bd6e4a9d63b748321e51565e570514290a81a1..2dc5dcfd668c4341f616acb4835f5c8c3dfd3b3d`.
- Captured diff: 386,532 bytes / 7,952 lines / 53 files.
- Diff SHA-256: `ee0b7f062cdfc5538b6e74ea7aa94f607954a582fde150f54146106ee5d8dadc`.
- Stable patch id: `0a3cbe9433b8d40673471108644a11e442389c10`.
- Pass 1 briefing: 711,225 bytes / 15,181 lines; SHA-256
  `4cf6ae4598d3ae3d8975e6287021f3b3268c67ea5b8ed4af09d0b87e73b09eac`.
- Pass 1 output: 13,149 bytes / 300 lines; SHA-256
  `94ee81b24d763d557796e9e469079f411f70049657a6debba245423a6a72d208`.
- Pass 2 briefing: 729,097 bytes / 15,599 lines; SHA-256
  `c5ac50c7c8b6a56e19724b0ed366639237463428127a4efde339ff07d98e67a6`.
- Pass 2 output: 24,284 bytes / 557 lines; SHA-256
  `002ed9ba493c3b71b8ad952b67dea0cb6201ccd41a498feca3d665758e1a23eb`.
- Mode: Codex, two-pass sealed envelope, high reasoning, read-only sandbox.
- The first informed-pass attempt used a larger 874 KB briefing and timed out
  after 600 seconds without output. The definitive retry used the same
  byte-identical captured diff in a smaller envelope; the timed-out artifacts
  remain diagnostic only and do not contribute findings or counts.

## Structural validation

- Blind pass: valid frontmatter, `pass: blind`, exact count
  `0B/1C/7M/0m/0n`, required sections and complete finding fields.
- Informed pass: valid frontmatter, `pass: informed`, exact count
  `0B/1C/13M/0m/0n`, required reconciliation sections and valid blind links.
- Reconciliation: all eight blind findings maintained, six emerged under the
  repository constraints, none dropped.

## Informed findings

| ID | Severity | Location | Claim / required remediation |
|---|---|---|---|
| F-001 | critical | `scripts/done-transaction.js` | Concurrent task closes with different timestamps can create two events/checkpoints. Lock by authoritative task identity, fresh-read and reuse the persisted close. |
| F-002 | major | `scripts/done-transaction.js` | `checkpointed` recovery trusts a stored checkpoint without reauthentication. Persist the bundle and re-run `findCheckpoint` before cleanup. |
| F-003 | major | `scripts/phase-done-transaction.js` | Recovery does not persist the successor obligation or identity. Store and digest a complete immutable successor manifest. |
| F-004 | major | `scripts/lifecycle-order-guard.js` | A detached or empty gate slice replaces the authoritative descriptor gates. Derive gates from the unique plan descriptor and require a bijective initiative mirror. |
| F-005 | major | `scripts/materialize-state.js` | CLI receipt checking trusts self-declared identity/sources. Bind the check to exactly one configured plan barrier. |
| F-006 | major | `scripts/materialize-state.js` | Historical review authorization does not require receipt mode equality. Require exact persisted mode. |
| F-007 | major | `scripts/materialize-state.js` | Successor authorization validates only the historical plan descriptor. Load exactly one historical initiative and validate identity, terminality, tasks and gate mirrors. |
| F-008 | major | `scripts/migrate-state-integrity.js` | Migration maps overwrite duplicate identities. Reject before any `set`/write and report both paths. |
| F-009 | major | `scripts/phase-done-transaction.js` | Concurrent phase closes with different timestamps can create multiple commits/events. Lock by authoritative phase identity and fresh-read terminal state. |
| F-010 | major | `scripts/validate-state.js` | Archived hardened phases bypass review provenance checks. Apply all terminal checks to `done` and `archived`. |
| F-011 | major | `scripts/materialize-state.js` | Existence of review and close commits does not prove ancestry. Require `reviewSha` to be an ancestor of `closeSha`. |
| F-012 | major | `scripts/materialize-state.js` | Completed-pair recovery cleans its marker after authorization outside the ledger lock. Reauthorize and clean within one critical section. |
| F-013 | major | `scripts/done-transaction.js` | Task close scope is not bound to the authoritative initiative. Derive/validate project, plan, phase and unique task from fresh state. |
| F-014 | major | `scripts/validate-state.js` | Lexical review paths follow symlinks outside the repository. Reject symlink components and verify realpath containment. |

## Operator triage

- F-001..F-014 were reproduced or confirmed and accepted as in-phase integrity
  defects under the operator's delegated decision. None was deferred.
- The receipt retains the model's `needs_changes` verdict for the reviewed
  artifact. `triage_remaining` is zero because every accepted finding was
  remediated after capture; only a fresh review of the remediation checkpoint
  can authorize phase closure.
- Five additional valid defects surfaced in the timed-out attempt's blind
  analysis and local audit: recovery replay/payload drift, duplicate phase IDs,
  F0 review receipts read from live state instead of `closeSha`, archive prose
  that bulk-closed plan work, and mirror validation that compared only
  `evidence.passed`. They were remediated proactively despite not contributing
  to the official r3 counts.
- Final integration exposed two compatibility gaps caused by enforcing those
  invariants on the live corpus. The migration now copies the authoritative
  full deterministic gate evidence into 28 uniquely joined initiative mirrors,
  and legacy review receipts authenticate a missing frontmatter `mode` only
  from one non-contradictory `Mode:` declaration in their immutable capture
  manifest at `closeSha`. Both paths were added under red regressions.

## Fixes applied after capture

- Task and phase coordinators now use process-identity-aware scope locks whose
  keys exclude timestamps, reload authoritative state inside the lock, resume
  only unfinished stages and reuse terminal state without duplicate effects.
- Task recovery persists an immutable close bundle/digest, rejects evidence or
  handoff drift, binds scope to the authoritative initiative and reauthenticates
  the stored checkpoint.
- Phase recovery persists and validates a complete successor identity/path/hash
  manifest; effect presence must exactly match the persisted obligation.
- Commit guards derive tasks and gates from unique authoritative joins, reject
  duplicate phase identities and require status/evidence equality across gate
  mirrors.
- Historical checks bind CLI receipt expectations to a configured plan barrier,
  read review receipts from `closeSha`, require exact mode and ancestry, and
  validate the archived prerequisite initiative, closed tasks and gate mirrors.
- Completed successor recovery reauthorizes and cleans under the completion
  ledger lock. Migration duplicates, archived review provenance, symlinked
  receipts and full deterministic evidence drift now fail closed.
- Archive instructions separate standalone policy from plan-anchored closure;
  plan work must already have been closed by `done`/`phase-done` and cannot be
  bulk-completed or deferred by `archive`.

## Verification after remediation

- The initial red regression run proved 19 failures across 171 tests; every
  failure corresponded to an accepted r3 or proactive integrity defect.
- Focused coordinator/guard suite: 52/52 pass.
- Expanded r3 regression suite: 190/190 pass, then final hardening suite 50/50.
- Fresh final repository suite: 1,887 tests, 1,879 pass, 0 fail, 8 expected
  skip.
- Canonical validation passed for all 167 state files and 26 plans after the
  28-file evidence migration; all 15 skills and generated docs passed.
- The configured F0 receipt was reconciled as `consistent` with digest
  `f0311471a5b7e6f8db07f7bdaa48f2cf78de7a3909b89be4277d57ebac186477`,
  and its plan-bound CLI check returned `ok: true`.
- `git diff --check` passed.

## Self-review against code-quality gates

- G1 read-before-claim: each finding was mapped to source and a fresh negative
  regression before implementation.
- G2 soft-language: triage is binary; every official and extra defect is fixed
  in-phase with no deferred wording.
- G3 anti-tautology: tests exercise concurrent timestamps, checkpoint loss,
  manifest drift, detached gates, receipt identity/mode/ancestry, historical
  initiative contradictions, duplicate identities, lock coverage and symlinks.
- G4 fixture realism: history tests use real Git commits, review receipts,
  archived initiatives, completion ledgers and fault-injected recovery.
- G7 anti-premature-abstraction: the one new shared lock is restricted to the
  two close coordinators that require the same identity-scoped exclusion rule.
