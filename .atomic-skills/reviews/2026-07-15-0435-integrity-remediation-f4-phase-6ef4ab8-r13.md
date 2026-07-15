---
date: 2026-07-15T04:35:48-03:00
topic: integrity-remediation-f4-phase-6ef4ab8-r13
artifact: 67bd6e4a9d63b748321e51565e570514290a81a1..6ef4ab804f2646c9ea488c7928795ba2b42e87f0
skill: review-code
reviewer: gpt-5-codex
mode: codex
codex_version: 0.144.3
final_verdict: reject
counts_final: {blocker: 0, critical: 1, major: 5, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 5, emerged: 1}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F4 phase 6ef4ab8 r13

## Capture manifest

- Ref: `67bd6e4a9d63b748321e51565e570514290a81a1..6ef4ab804f2646c9ea488c7928795ba2b42e87f0`.
- Captured diff: 808,528 bytes / 16,736 lines / 105 files.
- Diff SHA-256: `5f526590b4678f89af1386d0d77c48bbda3cbecb545d1aa8fb10c39d84c4c39f`.
- Stable patch id: `75151b45be07bf1256923928153c48a5eb1733b9`.
- Pass 1 briefing: 3,354 bytes / 97 lines; SHA-256
  `70b70caf4f14116555d289552ed8b143bffdc975c44ebf4900f929c98d7ac421`.
- Pass 1 output: 7,257 bytes / 179 lines; SHA-256
  `7de4f0d2214f47970ea833f0153d4c5f26226f7cf0f25007b43070bc9d2c4d17`.
- Pass 2 briefing: 7,149 bytes / 158 lines; SHA-256
  `1c46679ee7d22f5f579ad0c536515a4328460f6fa441d55a5be2aeeec4158760`.
- Pass 2 output: 9,988 bytes / 229 lines; SHA-256
  `e37295c7bfce339218a5838718b775372f4834db44f8f1af8dc532dc6bccb3cb`.
- Mode: Codex, two-pass sealed review, high reasoning, read-only sandbox.
- Transport decision: the canonical 600-second blind invocation exited 142
  without an output file. The preceding r12 pass on the equivalent surface had
  taken 12m42s, so the authorized retry used a 900-second external alarm with
  every artifact, hash, model setting and sandbox permission unchanged. It
  completed in 11m14s; the informed pass completed inside the same ceiling.

## Structural validation

- Blind pass: valid frontmatter, `pass: blind`, exact count
  `0B/1C/4M/0m/0n`, required sections and complete finding fields.
- Informed pass: valid frontmatter, `pass: informed`, exact count
  `0B/1C/5M/0m/0n`, required reconciliation sections and valid blind links.
- Reconciliation: all five blind findings maintained; one informed finding
  emerged. No blind finding was dropped.
- Both outputs verified the frozen artifact hashes. No sandbox test failure was
  used as product evidence.

## Accepted informed findings

| ID | Severity | Location | Claim / required remediation |
|---|---|---|---|
| F-001 | critical | `scripts/done-transaction.js`, `scripts/phase-done-transaction.js` | A crash after task-state persistence lets phase close terminalize the initiative before task event/checkpoint recovery, after which task retry rejects terminal state. Phase close must reject incomplete task transactions/authentication, and marker-backed recovery must be allowed against terminal state. |
| F-002 | major | `scripts/done-transaction.js` | Active close overwrites the authoritative task weight with caller input/default. Derive event and persisted weight from the reloaded task and reject conflicting caller values. |
| F-003 | major | `scripts/phase-done-transaction.js` | Terminal phase reuse selects the numerically greatest ledger generation instead of the generation mirrored by current state. Require the authoritative generation; allow generation-less fallback only for unambiguous legacy state. |
| F-004 | major | `scripts/materialize-state.js` | The successor barrier counts every historical phase generation, so supported reopen/reclose blocks successors or lets an older event stand in for a missing current event. Select the generation authenticated in historical descriptor/initiative state and reconcile only within it. |
| F-005 | major | `meta/schemas/completion-event.schema.json` | Schema-only readers accept empty project/plan/phase/task identities that producer normalization rejects. Add non-empty constraints and parser-to-projection regressions. |
| F-006 | major | `src/completion-event-validator.js` | Regex-shaped but impossible timestamps pass the raw schema parser and are silently skipped by earned-value projection. Add shared semantic timestamp validation and end-to-end parser coverage. |

## Operator triage

- F-001..F-006 are accepted as in-phase integrity defects. None is deferred.
- F-001 is reachable after a normal injected crash: the shared lock serializes
  live operations but is released with a durable state-persisted marker, and
  phase preflight checks only task status. Terminal initiative validation then
  prevents task recovery.
- F-002..F-004 contradict existing state-authority and reopen contracts rather
  than introducing new product scope.
- F-005 and F-006 are parser defects because `readCompletionEventLog` consumes
  the JSON schema directly; it does not call the stricter producer normalizer.
- `triage_remaining` is zero. The r13 verdict remains `reject`; only TDD
  remediation plus a fresh sealed review can ratify F4.

## Remediation decisions for later validation

1. Add an explicit task-close completeness authority usable under the existing
   phase lock. Phase close authenticates every done task generation and rejects
   outstanding/incomplete markers. Task recovery may cross terminal initiative
   state only when an existing marker or already-done provenance proves it is
   repairing the same close, never creating a new close.
2. Freeze effective task weight from authoritative task state before building
   the prospective completion or marker; mismatch with caller input fails
   closed, and absence on both sides degrades to one.
3. Filter terminal phase completions by mirrored authoritative generation. A
   generation-less state accepts exactly one effective legacy record and never
   silently selects among generated history.
4. Successor validation reads and compares historical generation mirrors at
   `closeSha`, filters phase events to that generation, and collapses only exact
   duplicates within it. Legacy historical state remains compatible only with
   one unambiguous generation-less effective event.
5. Add `minLength: 1` to completion scope identities and the task-only task id.
   Keep null requirements for aggregate/reconciliation records.
6. Extend the shared completion parser with semantic date validation after
   schema validation, preserving explicit-offset syntax and rejecting invalid
   calendar/clock/offset values with physical-line diagnostics.

## Remediation status

Remediated locally on 2026-07-15. All six accepted findings were reproduced by
failing regressions before their production changes, and the additional
self-review case for a generated done task without its completion event was
also red before the guard was extended. The sealed r13 verdict remains
`reject`; this status records remediation, not retroactive approval. A fresh
r14 review of the remediation checkpoint is still required to ratify F4.

## Fixes applied in this session

- F-001: phase close now rejects any incomplete task-close marker and
  authenticates the exact completion generation, idempotency identity and
  weight for every done task. A task recovery may repair the same close after
  the initiative became terminal; it cannot create a different close. Marker
  absence is meaningful because the coordinator removes it only after the
  completion event and checkpoint have been durably authenticated.
- F-002: task close derives weight from the authoritative reloaded task,
  rejects a conflicting caller value and uses the frozen value consistently in
  prospective validation, the durable bundle and the completion ledger.
- F-003: terminal phase reuse accepts only the generation mirrored by current
  state. Generation-less legacy state is accepted only when exactly one
  effective phase completion remains after reconciliation.
- F-004: successor materialization authenticates the historical phase
  generation at `closeSha`, selects only events from that generation and
  reconciles duplicates inside that generation. An older close can neither
  block nor stand in for the current close.
- F-005: completion scope identities and task-only `taskId` are non-empty in
  the canonical schema; schema-only parser/projection paths now carry negative
  coverage for empty identities.
- F-006: the shared completion validator now checks calendar, clock and offset
  semantics after schema validation. Producer and projection reject impossible
  regex-shaped timestamps through the same authority and preserve physical-line
  diagnostics.
- Self-review: generated terminal task state must also have its exact
  completion event; a missing event fails the phase guard, while a matching
  generated event passes.

## Verification after remediation

- Initial focused red run: 123 tests, 113 pass and 10 expected failures across
  all six findings. Additional self-review red run: 34 phase tests, 33 pass and
  one expected failure for the missing generated-task event.
- Final focused regression set: 125/125 pass.
- Exact F4 gates: G1 42/42, G2 69/69 and G3 78/78 pass. The F0 history receipt
  check returns `ok: true` with classification `consistent`.
- Full repository suite, executed as the package's exact `node --test` command
  with `npm_config_offline=true` after registry DNS retries stalled the npm
  transport: 1,988 tests, 1,980 pass, 0 fail and 8 contractual skips.
- State and generated-contract gates: 167 files / 26 plans cross-validated;
  canonical aiDeck state 26 plans, 97 phases, 88 initiatives, 280 tasks and 151
  task gates; 15 skills valid; generated docs and schema current; schema drift
  2/2; migration dry-run 0 changes; `git diff --check` clean.
- Hook gates: session-start 38/38, stop 43/43, pre-write 70/70 and pre-commit
  5/5 pass.
- The installed aiDeck 0.2.0 loader accepts the manifest. The already-running
  server at `127.0.0.1:7777` still has no consumers registered, so its live
  smoke remains an external-state failure; the server was not restarted.

## Self-review against code-quality gates

- G1 read-before-claim: cited coordinator, guard, schema, parser and projection
  source were read before accepting every finding.
- G2 soft-language: decision and fix descriptions use verified failure
  mechanisms; no unqualified speculative claim is recorded.
- G3 anti-tautology: planned regressions cross real coordinator/parser/history
  boundaries rather than asserting helper output alone.
- G4 fixture realism: crash markers, state mirrors and ledger lines extend the
  repository's existing production-shaped fixtures. The regressions exercise
  real coordinator, ledger and historical checkout boundaries.
- G7 anti-premature-abstraction: the task-close completeness helper is shared
  only at the phase coordinator boundary established by the red failures; the
  semantic timestamp helper is shared by the existing producer and parser
  validation boundaries.
- Final code review found no unresolved accepted finding. The lock order remains
  phase-state then completion-ledger, matching the documented coordinator
  order, and terminal recovery stays restricted to an already-done task.

## Next action

Create the local r13 remediation checkpoint and execute a fresh sealed Codex
r14 review against the fixed phase base. No push, PR or publication is
authorized.
