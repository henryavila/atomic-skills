---
date: 2026-07-14T17:52:58-03:00
topic: integrity-remediation-f4-phase-34bfccd-r1
artifact: 67bd6e4a9d63b748321e51565e570514290a81a1..34bfccd2be29f68b4d5325637ae138d2e406aaba
skill: review-code
reviewer: gpt-5-codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 8, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 5, emerged: 3}
triage_remaining: {blocker: 0, critical: 0, major: 8, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F4 phase 34bfccd r1

## Capture manifest

- Ref: `67bd6e4a9d63b748321e51565e570514290a81a1..34bfccd2be29f68b4d5325637ae138d2e406aaba`
- Captured diff: 266,007 bytes / 5,317 lines / 46 files.
- Diff SHA-256: `4a7ee57045068b6d677db235e4e2b07d0706442cdcc2fa904aa26cf3a28974b9`.
- Stable patch id: `09a2c55353f240c93c1c87e45c71a82d027e30cf`.
- Pass 1 output SHA-256: `318db8bd311afef8e9eb5c227875798a8c86d51edcbb7e6c35f9c6bbbd3e201a`.
- Pass 2 output SHA-256: `4b8800e76d600e1fe39a9bbe76df2e6d96a3454f650a4718a6e6f3f0a586ffca`.
- Pass 1 briefing SHA-256: `781543706895e362a32da7b44d40982a0aaa26a1c03233c21300176a35dcbfaf`.
- Pass 2 briefing SHA-256: `fb2de0a14a1edc32fdcf0be68b5b24d48865b4040e81472fcb9d739f21399c31`.
- Mode: codex; two-pass sealed envelope; reasoning high; sandbox read-only.
- The working tree was clean at capture. The first CLI attempt exceeded the 1,048,576-character transport limit before model execution; the accepted envelope retained the byte-identical diff and all 46 modified files, replacing three redundant full caller bodies with one 78-line direct-caller excerpt.

## Structural validation

- Blind pass: valid YAML frontmatter, `pass: blind`, exact count `0B/0C/5M/0m/0n`, required headings and five-field findings.
- Informed pass: valid YAML frontmatter, `pass: informed`, exact count `0B/0C/8M/0m/0n`, required reconciliation headings and valid blind references.
- Reconciliation: five blind findings maintained; three findings emerged from repository constraints; none dropped.

## Informed findings

| ID | Location | Claim / impact | Required remediation | Confidence |
|---|---|---|---|---|
| F-001 | `scripts/phase-done-transaction.js:27` | Missing `commit` reports success; failures after commit leave terminal state without event/successor recovery. | Require effects, persist stages, and resume idempotently. | high |
| F-002 | `scripts/append-completion.js:294` | Concurrent read-check-append can duplicate one idempotency key. | Serialize the ledger and add a multiprocess race test. | high |
| F-003 | `scripts/lifecycle-order-guard.js:237` | `{tasks: []}` can pass preflight without plan/descriptor/initiative identity. | Require a unique authoritative join before allow. | high |
| F-004 | `src/state-invariants.js:3` | Hardened terminal state accepts `deferred` gates although the close guard treats them as open. | Require `met` plus passing evidence for hardened plans. | high |
| F-005 | `scripts/materialize-state.js:1461` | The successor barrier proves only historical terminal status and reads review metadata from live state. | Validate historical review/gates and bind the close event to `closeSha`. | high |
| F-006 | `scripts/materialize-state.js:1338` | Duplicate repair rewrites the append-only ledger and can lose concurrent appends. | Preserve physical lines; append an auditable reconciliation marker under an exclusive ledger lock. | high |
| F-007 | `scripts/materialize-state.js:733` | Marker recovery rolls forward before revalidating the receipt authorization. | Persist authorization digest and roll back if it becomes stale. | high |
| F-008 | `scripts/materialize-state.js:1378` | Receipt identity and paths are self-declared and not bound to the configured F0 projection. | Compare identity and canonical sources with barrier-derived expectations. | high |

## Operator triage

- F-001..F-005 and F-007..F-008: confirmed against the cited source and accepted for TDD remediation.
- F-006: the F4/T-006 acceptance criterion explicitly permits a uniquely identified historical duplicate repair with a byte-identical backup. The destructive rewrite is not required by that criterion, so the repair will change to append-only tombstoning under the canonical ledger lock; this preserves both the acceptance criterion and the immutable audit contract.
- Delegated decision: all eight findings are in-phase because each can bypass or corrupt an F4 authority introduced by this phase. No finding is deferred.

## Fixes applied in this session

- F-001: `phase-done` now derives one close key, requires commit/find/emit/clean effects,
  persists atomic `prepared → committed → emitted → successor-materialized` recovery
  stages, rejects a missing full `closeSha`, and resumes post-commit failures without
  recommit or duplicate completion.
- F-002: every completion-ledger append now shares an exclusive ledger lock; the
  idempotent read-check-append is one critical section and an eight-process race
  proves one physical line for one key. Payload drift behind the key fails closed.
- F-003: phase preflight requires plan, unique descriptor, initiative and exact
  `parentPlan`/`phaseId`/`slug` joins before tasks can authorize progression.
- F-004: hardened terminal plans accept only `met` gates with
  `evidence.passed: true` in both mirrors; deferred compatibility remains legacy-only.
- F-005: the F3 barrier reads review/gates from `closeSha`, proves the review receipt
  existed at that commit, and requires exactly one canonical phase-done event bound
  to the same `closeSha`.
- F-006: duplicate history repair retains every original ledger line and appends a
  schema-validated reconciliation tombstone under the same ledger lock. The backup
  remains byte-identical and rejects pre-planted symlinks.
- F-007: successor authorization identity, sources, close SHA and receipt digest are
  persisted in the materialization marker; recovery revalidates them and rolls back
  instead of rolling forward when stale.
- F-008: the plan schema and configured F3 barrier now carry the exact F0 identity
  and canonical source paths; receipt checks compare those expectations before using
  self-declared content.
- Verification after remediation: focused integration 93 pass / 0 fail; materialize
  regression 133 pass / 0 fail; fresh full repository suite exit 0. This r1 receipt
  intentionally retains `needs_changes`; a fresh Codex review at the corrected HEAD
  remains mandatory.

## Self-review against code-quality gates

- G1 read-before-claim: every finding was checked against source and its remediation
  was verified by a fresh regression run.
- G2 soft-language: triage decisions use binary confirmed/in-phase language; zero banned hedges.
- G3 anti-tautology: regressions exercise missing commit, post-event failure,
  multiprocess duplication, absent identity, deferred/evidence-less terminal gates,
  status-only close, forged event, stale recovery and receipt substitution.
- G4 fixture realism: materialization regressions derive from `createHistoryFixture`
  and retain repository-shaped F0/F4 plan, initiative, receipt and ledger surfaces.
- G7 anti-premature-abstraction: the ledger lock is shared only by normal append,
  idempotent append, receipt reads and reconciliation writes.
