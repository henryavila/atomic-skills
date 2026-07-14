---
date: 2026-07-14T20:57:12-03:00
topic: integrity-remediation-f4-phase-61fd6f1-r2
artifact: 67bd6e4a9d63b748321e51565e570514290a81a1..61fd6f1b1e05851cad8a0c6b0d8a2ff8ab87cd31
skill: review-code
reviewer: gpt-5-codex
mode: codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 12, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 9, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 9, emerged: 3}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F4 phase 61fd6f1 r2

## Capture manifest

- Ref: `67bd6e4a9d63b748321e51565e570514290a81a1..61fd6f1b1e05851cad8a0c6b0d8a2ff8ab87cd31`.
- Captured diff: 339,623 bytes / 7,023 lines / 51 files.
- Diff SHA-256: `f95df7059cb425064ea5088960833b0d90c86ef111dba62a69e93f96113304d2`.
- Stable patch id: `bfc4a129f12e32a34af68639c5bb01f58e5e70d9`.
- Pass 1 briefing: 778,738 bytes / 17,979 lines; SHA-256
  `8db6ff91b502fca57627b0289e78b401f592633694106d2c3c118443857f541e`.
- Pass 1 output: 12,353 bytes / 288 lines; SHA-256
  `afd77e3b54c2bd91ac6815f1c06e4f8464ee769db3067096c7c21a5a8b536bc5`.
- Pass 2 briefing: 795,220 bytes / 18,383 lines; SHA-256
  `3b898f3f2a127247e18a8b7e97f5365a00cb669aca2e01110eba568fa7510379`.
- Pass 2 output: 16,038 bytes / 405 lines; SHA-256
  `80478fb36fdc05efdd8bfd142797bad094664805a93be25fbefbed0464dc539a`.
- Mode: Codex, two-pass sealed envelope, high reasoning, read-only sandbox.
- The accepted envelope contained the byte-identical captured diff and the full
  high-risk files; the reviewed tree was clean at capture.

## Structural validation

- Blind pass: valid frontmatter, `pass: blind`, exact count
  `0B/0C/9M/0m/0n`, required sections and complete finding fields.
- Informed pass: valid frontmatter, `pass: informed`, exact count
  `0B/0C/12M/0m/0n`, required reconciliation sections and valid blind links.
- Reconciliation: nine blind findings maintained, three emerged under the
  repository constraints, none dropped.

## Informed findings

| ID | Location | Claim / impact | Required remediation | Confidence |
|---|---|---|---|---|
| F-001 | `scripts/lifecycle-order-guard.js:237` | A detached `tasks: []` could bypass pending tasks in the authoritative initiative. | Validate only the joined initiative tasks and reject mismatched slices. | high |
| F-002 | `skills/shared/project-assets/project-transitions.md:181` | The documented close path bypassed `executePhaseDoneTransaction`. | Route every terminal effect through the transaction coordinator. | high |
| F-003 | `scripts/phase-done-transaction.js:111` | A moved HEAD blocked retry before the recovery marker was read. | Resume committed markers first and reauthenticate their stored close commit. | high |
| F-004 | `scripts/validate-state.js:546` | Receipt prose containing a SHA could satisfy review provenance despite a rejecting verdict. | Parse receipt frontmatter and require approving verdict, artifact tip and mode. | high |
| F-005 | `scripts/validate-state.js:532` | Explicit-target validation resolved commits and receipts from `process.cwd()`. | Resolve the owning repository and reject cross-root joins. | high |
| F-006 | `scripts/materialize-state.js:1177` | Reconciliation rewrote a mismatched evidence anchor to the review SHA. | Treat anchor mismatch as ambiguous and never repair it. | high |
| F-007 | `scripts/done-transaction.js:73` | Re-closing a done task could replace `closedAt` and create another event. | Preserve the immutable close identity or reject drift. | high |
| F-008 | `scripts/append-completion.js:377` | Stale-lock reclaim and PID reuse could remove a replacement owner. | Serialize reclamation and bind ownership to process-start identity. | high |
| F-009 | `scripts/materialize-state.js:1626` | The ledger lock was released between successor authorization and publication. | Hold authorization and both live renames under one ledger lock. | high |
| F-010 | `src/state-invariants.js:150` | Hardened materialized initiatives could omit `parentPlan` or `phaseId` and join by slug. | Require all explicit identity fields. | high |
| F-011 | `scripts/validate-state.js:699` | A terminal plan gate missing from the initiative mirror was silently skipped. | Require a bijective gate mirror before comparing evidence. | high |
| F-012 | `scripts/validate-state.js:940` | Duplicate initiative identities were overwritten in a map before validation. | Detect duplicate keys and retain both source paths in the diagnostic. | high |

## Operator triage

- F-001..F-012 were reproduced or confirmed against the cited authority and
  accepted as in-phase integrity defects under the user's delegated decision.
- No finding was deferred. All twelve can authorize contradictory terminal
  state, fabricated provenance, duplicated analytics, or stale successor
  publication in surfaces introduced or hardened by F4.
- The receipt retains the model's `needs_changes` verdict for the reviewed
  artifact. `triage_remaining` is zero because every accepted finding was
  remediated after capture; a fresh review of the corrected commit is still
  mandatory and this receipt cannot authorize phase closure.

## Fixes applied after capture

- F-001/F-002/F-003: phase closure now uses the authoritative initiative task
  set, the operator contract calls `executePhaseDoneTransaction`, and committed
  recovery markers resume unfinished stages after `closeSha` reauthentication.
- F-004/F-005: review provenance is parsed structurally against the exact
  artifact tip, mode and approving verdict at the owning repository root;
  cross-repository joins fail closed.
- F-006: a non-null evidence-anchor mismatch is ambiguous, never repairable,
  and is not written to the receipt.
- F-007: a done task accepts only its original immutable `closedAt`; timestamp
  drift cannot create a new transaction or earned-value event.
- F-008: completion-ledger acquisition uses serialized guard claims, atomic
  owner publication, token-checked release and process-start identity. An
  eight-process stale-owner race exercises replacement-owner safety.
- F-009: final receipt authorization and both successor renames run while the
  completion-ledger lock remains held.
- F-010/F-011/F-012: hardened materialized identities are explicit, terminal
  gate mirrors are bijective, and state collection reports duplicate identities
  rather than overwriting them.
- The strict repository-root change initially exposed two non-git migration
  fixture failures. A red regression proved that legacy `plans/` and
  `initiatives/` were assigned different roots; the fallback now derives the
  root from `plans`, `initiatives`, or `projects`, and all 48 migration tests pass.

## Verification after remediation

- Focused F4 gates previously passed: G1 23/23, G2 23/23 and G3 51/51.
- Lifecycle integration: 44/44; phase materialization: 114/114; project/docs/
  compatibility/skills: 268/268; completion/history/successor: 41/41;
  completion locking: 20/20.
- Migration regression: 48/48.
- Fresh full repository suite: 1,866 tests, 1,858 pass, 0 fail, 8 expected skip;
  186 suites; 30,850.70375 ms.
- Canonical state: all 167 files valid, 26 plans cross-validated and one routing
  config valid. `git diff --check` passed.

## Self-review against code-quality gates

- G1 read-before-claim: all findings were checked against source and exercised
  by fresh tests after remediation.
- G2 soft-language: triage is binary; every finding is accepted and in-phase.
- G3 anti-tautology: regressions exercise detached tasks, retry after moved HEAD,
  rejecting receipts, cross-root provenance, anchor mismatch, re-close drift,
  multiprocess stale-lock reclamation, publication locking and duplicate state.
- G4 fixture realism: history and successor tests use repository-shaped state,
  receipts, commits and ledgers; the root regression uses both supported layouts.
- G7 anti-premature-abstraction: new helpers are restricted to shared ownership,
  provenance and collection boundaries used by the hardened flows.
