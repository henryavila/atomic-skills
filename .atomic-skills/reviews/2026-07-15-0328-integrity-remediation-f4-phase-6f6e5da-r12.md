---
date: 2026-07-15T03:28:10-03:00
topic: integrity-remediation-f4-phase-6f6e5da-r12
artifact: 67bd6e4a9d63b748321e51565e570514290a81a1..6f6e5daf421c8cd0821b7d4ef5dbd929eaa17b47
skill: review-code
reviewer: gpt-5.6-sol
mode: codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 3, major: 2, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 3, major: 2, minor: 0, nit: 0}
framing_delta: {dropped: 1, maintained: 4, emerged: 1}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F4 phase 6f6e5da r12

## Capture manifest

- Ref: `67bd6e4a9d63b748321e51565e570514290a81a1..6f6e5daf421c8cd0821b7d4ef5dbd929eaa17b47`.
- Captured diff: 764,042 bytes / 15,723 lines / 103 files.
- Diff SHA-256: `e53e0d8563ef17e1f94453675cc2bbdde027de6521d011d855de8dadfc28a859`.
- Stable patch id: `b509b73933e124597ce7640df1fb6ae7a7ccaf0c`.
- Pass 1 briefing: 3,889 bytes / 103 lines; SHA-256
  `17f7daa01474d8fbc7a3b2e5d45230c610f7b279bf95d197a6fde8c06a219c68`.
- Pass 1 output: 9,482 bytes / 227 lines; SHA-256
  `7fb7c8f461ed13d0437c681be60dd7bcc37fac0094d10d046c930f77c4b52e76`.
- Pass 2 briefing: 8,297 bytes / 176 lines; SHA-256
  `f8790aae590796650c9e18e35ca979a23b89eadd655c6a471fff693d8bd0bd9e`.
- Pass 2 output: 9,278 bytes / 226 lines; SHA-256
  `fd33613be13e251efaebda38f2d528fe6d1de67072bf553817c6fee5f44a0d01`.
- Mode: Codex, two-pass sealed review, high reasoning, read-only sandbox.
- Transport decision: Codex CLI 0.144.3 reported its default model as
  `gpt-5.6-sol`; this receipt records that observed transport as authoritative.

## Structural validation

- Blind pass: valid frontmatter, `pass: blind`, exact count
  `0B/3C/2M/0m/0n`, required sections and complete finding fields.
- Informed pass: valid frontmatter, `pass: informed`, exact count
  `0B/3C/2M/0m/0n`, required reconciliation sections and valid blind links.
- Reconciliation: four blind findings were maintained, one dropped and one
  informed finding emerged.
- The reviewer's attempted targeted test run failed only because its read-only
  sandbox denied `mkdtemp` with `EPERM`; no environmental result was used as
  product evidence.

## Accepted informed findings

| ID | Severity | Location | Claim / required remediation |
|---|---|---|---|
| F-001 | critical | `scripts/migrate-state-integrity.js` | Standalone recovery holds only the migration-root lock, so an ordinary phase writer can be overwritten after validation and before restore. Persist authenticated phase scopes, acquire them canonically for recovery and recheck immediately before each rename. |
| F-002 | critical | `scripts/done-transaction.js`, `scripts/phase-done-transaction.js` | Timestamp-derived identities double-count independent closes of one authoritative generation and conflate real reopen/reclose generations. Persist immutable close generations in authoritative task/phase state and derive keys from them. |
| F-003 | critical | `scripts/materialize-state.js`, `scripts/append-completion.js` | Two branches can append timestamp-distinct reconciliation tombstones for the same duplicate set, after which strict readers reject the union permanently. Give tombstones an order-independent stable identity, insert by ensure semantics and collapse equivalent physical duplicates logically. |
| F-004 | major | `scripts/dispatch-log.js` | The pre-lock absence check lets a reader miss the first writer that already owns the dispatch lock. Resolve and check existence only while holding the ledger lock. |
| F-005 | major | `meta/schemas/completion-event.schema.json`, `scripts/append-completion.js` | The shared schema admits invalid timestamps and task-attributed `phase-done` events that projections later omit or lifecycle validation ignores. Enforce the same timestamp and event/task predicates in schema, producer and parser consumers. |

## Operator triage

- F-001..F-005 are accepted as in-phase integrity defects. None is deferred.
- The blind Git receipt-provenance finding is dropped under the documented
  operator trust boundary. Live receipt/gate bytes are intentional close
  candidates before the close commit; the close guard binds them to reviewed
  HEAD/mode, and successor/history validation later reads the committed bytes
  with `git show <closeSha>:<path>` plus ancestry checks.
- `triage_remaining` is zero. The historical model verdict remains
  `needs_changes`; only a fresh sealed review of a remediated checkpoint can
  approve F4.

## Remediation decisions for later validation

1. Migration manifest v4 persists canonical, authenticated phase scopes.
   Startup and standalone recovery acquire the union of durable and incoming
   scopes in sorted order and retain them through validation and every rename;
   each restore performs a final source CAS at its publication boundary.
2. Authoritative task and phase state persists a monotonic completion
   generation. Same-generation branch closes share an idempotency identity;
   reopen/reclose advances the generation; conflicts within one generation
   fail closed. Legacy timestamp identities remain readable.
3. Reconciliation selects canonical/duplicate digests independently of input
   order, derives a stable tombstone key, uses locked ensure insertion and
   treats repeated equivalent physical tombstones as one logical marker while
   rejecting conflicting payloads for that key.
4. Dispatch readers acquire `dispatch-ledger` before path resolution or the
   sole existence check. A multiprocess test pauses the first writer after
   lock acquisition and proves the reader blocks until publication.
5. Completion timestamps use the repository's shared ISO timestamp contract.
   `task-done` requires a non-empty task id; `phase-done` and `reconcile`
   require null. Parser-to-projection tests prove malformed append-only records
   are rejected instead of silently undercounted.

## Remediation status

Remediated locally. F-001..F-005 have production fixes and regression coverage;
no accepted finding was deferred. The historical reviewer verdict remains
`needs_changes`, so the phase still requires a fresh r13 review of the new
checkpoint before its gates can be ratified.

Additional local review found and fixed four integration defects before the
checkpoint:

1. canonical completion selection still depended on physical merge order;
2. phase mirror validation did not compare completion generations;
3. phase-close could commit before normalizing the prospective completion;
4. successor validation rejected equivalent branch closes whose `closeSha`
   was an ancestor of the reconciliation commit instead of the commit itself.

The generated AIDeck consumer schema was rebuilt after the full suite exposed
schema drift. Its loader accepts the manifest and the canonical state validates;
the optional live-server smoke remained environmental because an already
running server had scanned before this consumer was provisioned. Restarting
that external process was intentionally left outside the worktree checkpoint.

## Red/green and gate evidence

- Initial focused red: 151 tests, 140 pass and 11 expected failures spanning
  F-001..F-005; an additional validator regression failed 1/1 before its fix.
- Expanded green: 185/185 across completion schema/producer/projection,
  migration recovery, task/phase generations, dispatch concurrency and real
  Git union-merge reconciliation.
- Exact F4 gates: F4-G1 42/42, F4-G2 62/62 and F4-G3 76/76; the plan-bound F0
  history receipt returned `ok: true` with classification `consistent`.
- Full repository suite after rebuilding the generated schema: 1,969 pass,
  0 fail and 8 skip across 1,977 tests / 186 suites.
- State validators: 167 files, 26 plans and one routing config valid; canonical
  AIDeck state reports 26 plans, 97 phases, 88 initiatives, 280 tasks and 151
  gates; all 15 skills validate.
- Operational checks: docs generators clean; migration dry-run reports zero
  changes; hook suites report 38/38, 43/43, 70/70 and 5/5; `git diff --check`
  is clean; generated AIDeck schema drift check passes 2/2.

## Self-review against code-quality gates

- G1 read-before-claim: accepted mechanisms were traced through migration
  startup/recovery, authoritative close state, ledger reconciliation,
  dispatch publication and earned-value projection before choosing fixes.
- G2 soft-language: all five findings are accepted for this phase; none is
  parked or reduced to documentation.
- G3 anti-tautology: each regression will exercise a real conflicting writer,
  branch union, reopen generation, paused first writer or parser-to-projection
  boundary.
- G4 fixture realism: the planned coverage includes child processes, actual
  Git branches/worktrees, durable manifests and schema-invalid NDJSON.
- G5 red phase: production changes are gated on fresh expected failures for
  each accepted mechanism.

## Next action

Create the local r12 remediation checkpoint and execute a fresh sealed Codex
r13 review over the fixed F4 base range. No push, PR or publication is
authorized.
