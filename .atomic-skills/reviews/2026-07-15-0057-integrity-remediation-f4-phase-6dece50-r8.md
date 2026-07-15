---
date: 2026-07-15T00:57:57-03:00
topic: integrity-remediation-f4-phase-6dece50-r8
artifact: 67bd6e4a9d63b748321e51565e570514290a81a1..6dece50e9bb9d420507522557c8ee6e620b1ed48
skill: review-code
reviewer: gpt-5-codex
mode: codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 4, minor: 1, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 2, minor: 1, nit: 0}
framing_delta: {dropped: 0, maintained: 3, emerged: 2}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F4 phase 6dece50 r8

## Capture manifest

- Ref: `67bd6e4a9d63b748321e51565e570514290a81a1..6dece50e9bb9d420507522557c8ee6e620b1ed48`.
- Captured diff: 637,384 bytes / 13,152 lines / 91 files.
- Diff SHA-256: `8752073a43450638f3e249f807cc41432fa176b1871f184d6dfa76bc0ef2a1b8`.
- Stable patch id: `4b178aae0d2183ad338a605a82d1e1906865c55b`.
- Pass 1 briefing: 3,512 bytes / 97 lines; SHA-256
  `015abb6b6823d82471fd1de6827e238b1e985587fb48e436b091ee3acd471072`.
- Pass 1 output: 4,845 bytes / 113 lines; SHA-256
  `bc5f1f9857084b112d9eb444453013d454362c5fcce0b51822a9b82883be7e5e`.
- Pass 2 briefing: 5,269 bytes / 132 lines; SHA-256
  `ccefb3bf0357bc4845d3e35b53e501091af443a5c68cfd2465083ee8821ab589`.
- Pass 2 output: 8,599 bytes / 217 lines; SHA-256
  `9755ad6ffd9d440142bed30faf74d88bdd221252b6fedba56245914c9d12c190`.
- Mode: Codex, two-pass sealed review, high reasoning, read-only sandbox.
- Transport decision: the exact diff was captured once, hashed and exposed to
  both passes as an immutable read-only file. Both briefings used the same
  frozen path/fingerprint and explicit anti-framing instructions.

## Structural validation

- Blind pass: valid frontmatter, `pass: blind`, exact count
  `0B/0C/2M/1m/0n`, required sections and complete finding fields.
- Informed pass: valid frontmatter, `pass: informed`, exact count
  `0B/0C/4M/1m/0n`, required reconciliation sections and valid blind links.
- Reconciliation: three blind findings were maintained, none dropped and two
  majors emerged.

## Accepted informed findings

| ID | Severity | Location | Claim / required remediation |
|---|---|---|---|
| F-001 | major | `scripts/done-transaction.js` | Markerless task reuse depended on test-only, non-schema `initiative.__handoff` instead of durable close provenance. |
| F-002 | major | `scripts/phase-done-transaction.js` | Markerless terminal phase reuse replayed successor materialization after the original transaction was already complete. |
| F-003 | minor | `scripts/phase-done-transaction.js` | A malformed transaction envelope could run evidence production before validating `root` and `close`. |
| F-004 | major | `scripts/phase-done-transaction.js` | Terminal reuse sourced the successor manifest from caller-shaped state rather than durable accepted provenance. |
| F-005 | major | `scripts/done-transaction.js` | Markerless task repair could derive replacement actuals from a newer mutable dispatch record. |

## Operator triage

- F-001..F-005 were accepted as in-phase integrity defects. None was dropped,
  deferred or left for a later phase.
- F-002 and F-004 share one authority error and were fixed together: once the
  recovery marker is cleared, terminal phase reuse authenticates the immutable
  close/event/commit and is read-only. It ignores caller successor data and
  never calls successor materialization again.
- `triage_remaining` is zero after remediation. This receipt preserves the raw
  model verdict; only a fresh review can approve F4.

## Fixes applied after capture

- Task close now persists a schema-backed `tasks[].completionProvenance` with
  the immutable next action, complete handoff and frozen task actuals. A
  markerless repair reads only this task-owned authority and fails closed when
  historical provenance is absent.
- Markerless task repair retains the exact original actuals, including their
  intentional absence, and never consults a newer dispatch record.
- Markerless terminal phase reuse is authentication-only. It neither trusts nor
  replays caller-supplied successor manifests, because marker cleanup already
  proves successor publication (when accepted) and the final clean check.
- Phase transaction inputs are validated immediately after pure preflight and
  before any evidence-producing effect.
- Tests that previously exercised commit guards with structurally invalid
  partial envelopes now use realistic root/identity/close/effect contracts.
- Transition documentation records both durable task provenance and the
  read-only terminal reuse rule.

## Proactive hardening from remediation self-review

- The shared completion event schema admits both task and phase actual fields,
  while `tasks[].completionProvenance` intentionally admits only task telemetry.
  A red regression demonstrated that `done` could persist phase-only
  `filesChanged`; the coordinator now rejects phase-only actuals before any
  recovery marker, state write or event.
- A second regression proved that caller actuals cannot be injected when the
  persisted provenance intentionally omitted them.

## Verification after remediation

- Red phase: the initial focused surface produced 17 failures across 144 tests,
  including all five intended mechanisms and cascading task-retry failures.
  The proactive phase-only actuals regression then failed independently because
  the close incorrectly succeeded.
- Focused task transaction suite: 21/21 pass after remediation.
- Exact F4 gates: G1 34/34, G2 54/54 and G3 67/67 pass.
- Fresh repository suite: 1,933 tests, 1,925 pass, 0 fail and 8 expected skip.
- Canonical validation: all 167 state files and 26 plans valid; all 15 skills
  valid; generated docs current; migration dry-run reports 0 changes.
- Hook suite: session-start 38/38, stop 43/43, pre-write 70/70 and pre-commit
  5/5 pass.
- The configured F0 receipt remains `consistent` with projection digest
  `f0311471a5b7e6f8db07f7bdaa48f2cf78de7a3909b89be4277d57ebac186477`,
  and its plan-bound CLI check returns `ok: true`.
- No `__handoff` references remain on runtime/schema/test/documentation scope;
  `git diff --check` passed.

## Decisions recorded for later validation

1. Persist markerless recovery authority per task, not at initiative top level:
   initiative handoff and next action advance over time and cannot authenticate
   an older close.
2. Keep markerless terminal phase reuse read-only instead of inventing a second
   durable successor replay protocol: the existing marker is removed only after
   publication and clean proof complete.
3. Treat complete transaction envelopes as a prerequisite to evidence effects;
   partial coordinator calls are invalid, while pure guard classifiers remain
   independently testable.
4. Restrict task completion provenance to attempts, duration and escalations so
   persisted state and its schema cannot diverge from the event contract.

## Self-review against code-quality gates

- G1 read-before-claim: runtime, schema, transition prose, direct tests and the
  marker lifecycle were read before selecting each authority.
- G2 soft-language: every accepted finding and the proactive contract mismatch
  was fixed in this checkpoint; none is deferred.
- G3 anti-tautology: removing persisted provenance, re-enabling successor replay,
  moving validation after evidence or accepting `filesChanged` breaks a named
  regression assertion.
- G4 fixture realism: transaction tests use real temporary roots, recovery
  markers, completion/dispatch ledgers and complete effect envelopes.
- G5 red phase: intended mechanisms failed before the corresponding production
  changes, including the independently discovered task/phase actuals mismatch.
- G7 anti-premature-abstraction: the fix extends the existing task schema and
  transaction coordinators without adding a competing state or replay authority.

## Next action

Commit this r8 remediation checkpoint, then run a fresh sealed Codex r9 review
over the fixed F4 base range. F4 remains active until that new review approves.
