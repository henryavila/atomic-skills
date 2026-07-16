---
date: 2026-07-16T06:34:48-03:00
topic: integrity-remediation-f4-phase-13b1b7d-r14
artifact: 67bd6e4a9d63b748321e51565e570514290a81a1..13b1b7d55ff0a66528026fc800f974c66f74de0f
skill: review-code
reviewer: gpt-5-codex
mode: codex
codex_version: 0.144.5
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 2, major: 0, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 2, major: 1, minor: 0, nit: 0}
framing_delta: {dropped: 2, maintained: 1, emerged: 1}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F4 phase 13b1b7d r14

## Capture manifest

- Ref: `67bd6e4a9d63b748321e51565e570514290a81a1..13b1b7d55ff0a66528026fc800f974c66f74de0f`.
- Captured diff: 841,339 bytes / 17,405 lines / 106 files.
- Diff SHA-256: `60837bb45a2afb9c6ad212f9e1a1ec6063aa303b39b70f6cd495994a718dd39f`.
- Stable patch id: `1f32e7d092c5a6e1bd73f77bc5dce57c30d47cb7`.
- Pass 1 briefing: 3,354 bytes / 97 lines; SHA-256
  `91fd8540e722296973aed9369428b3bfe63d00528d8d80de399fe1b24eb5d68c`.
- Pass 1 output: 4,205 bytes / 95 lines; SHA-256
  `191f6c1f2aff34d9c533f334e7073b0e5231c1489f359ff634d498f36e8d2d37`.
- Pass 2 briefing: 12,792 bytes / 307 lines; SHA-256
  `b5d288669e2c9e4cdc616e4f35e6e3699fd97b93b6139b835a4fcf74940ce195`.
- Pass 2 output: 4,640 bytes / 110 lines; SHA-256
  `5896fe1afb6d783e67e489ec7daacb6d3596f80eb62b7633c68dcc3532ed0851`.
- Mode: Codex, two-pass sealed review, high reasoning, read-only sandbox.
- Transport record: two attempts on 2026-07-15 ended before review because the
  environment could not resolve any DNS host; neither produced a review output.
  `/tmp` was cleared overnight, so the range was reconstructed only after HEAD
  and cleanliness were revalidated. The reconstructed diff and pass-1 briefing
  matched the prior byte counts and SHA-256 hashes exactly. The successful blind
  pass used a 900-second ceiling because equivalent F4 surfaces had exceeded the
  canonical 600-second default; all other invocation settings remained canonical.

## Structural validation

- Blind pass: valid frontmatter, `pass: blind`, exact count
  `0B/2C/1M/0m/0n`, required sections and complete finding fields.
- Informed pass: valid frontmatter, `pass: informed`, exact count
  `0B/2C/0M/0m/0n`, required reconciliation sections and valid blind links.
- Reconciliation: one blind finding maintained; two dropped; one informed
  finding emerged after the persisted successor contract was supplied.
- Both passes verified the frozen artifact identity. No transport error or
  sandbox limitation was used as product evidence.

## Accepted informed findings

| ID | Severity | Location | Claim / required remediation |
|---|---|---|---|
| F-001 | critical | `scripts/materialize-state.js:733-742` | Materialization performs a final hash check and whole-plan rename under a lock disjoint from plan/phase state mutations. A normal parallel-plan close or other coordinated state writer can land between check and rename and be overwritten. Introduce one plan-wide mutation lock shared by materialization and lifecycle/migration writers, with an explicit lock order and deterministic interleaving regression. |
| F-002 | critical | `scripts/phase-done-transaction.js:115-129` | The persisted successor manifest validates only shape. `materializeState` neither accepts nor binds that manifest to canonical paths, phase identity and candidate hashes; a no-op or mismatched effect can be marked `successor-materialized`. Bind the manifest inside materialization and require authenticated publication evidence before advancing recovery. |

## Dropped blind findings

- Blind F-001 required a separate post-publication path/hash receipt. The
  informed contract shows that the correct authority is to bind the persisted
  manifest to candidate bytes inside `materializeState`; a new generic receipt
  API alone would not establish that binding.
- Blind F-003 modeled an active same-user pathname swap after confinement. The
  persisted contract is component-by-component real-path confinement and
  fail-closed handling before external writes, not a security boundary against
  a hostile peer with the same filesystem credentials. No concrete legitimate
  writer in the reviewed surface replaces managed ancestry with symlinks.

## Operator triage

- F-001 is accepted. `materializeState` owns a per-plan materialization lock,
  while task/phase close and migration use phase-scoped transaction locks.
  Parallel plans can have different live phases, and each phase close publishes
  a whole-plan snapshot; the locks therefore do not serialize the shared file.
- F-002 is accepted. Existing tests intentionally pass arbitrary 64-hex hashes
  and a no-op `materializeSuccessor`, after which the coordinator advances and
  removes its marker. This is direct executable evidence that the manifest is
  not provenance authority.
- Neither accepted finding is deferred. `triage_remaining` stays at two
  critical findings until red regressions, implementation, full gates and a
  fresh sealed r15 review complete.

## Remediation decisions for later validation

1. Add a plan-wide transaction lock keyed by canonical project/plan identity.
   Lock order is plan-state → phase-state → materialization/completion internals.
   Task close, phase close, state migration and materialization must share the
   outer plan authority. Nested use receives an explicit, unforgeable lock
   capability; ambient/reentrant bypass is forbidden because spawned async work
   could otherwise inherit authority.
2. Extend the successor manifest binding into `materializeState`. Before marker
   creation and before idempotent success, canonical plan/initiative paths,
   target phase/plan identity and SHA-256 of the exact candidate bytes must equal
   the persisted manifest. Persist the bound manifest and digest in the
   materialization marker so recovery reauthenticates the same contract.
3. `effects.materializeSuccessor` must return publication evidence generated by
   the bound materialization path. The phase coordinator advances from `emitted`
   only after validating that evidence against `marker.successor`; no-op,
   omitted, forged-shape or mismatched results retain the recovery marker.
4. Regressions must deterministically pause between the last plan hash check and
   rename, perform a competing coordinated writer, and prove no overwrite. The
   manifest suite must independently mutate phase identity, both paths and both
   candidate hashes, plus cover crash/retry and idempotent recovery.

## Remediation status

Remediated locally on 2026-07-16. Both accepted criticals were reproduced by
failing regressions before production changes. The sealed r14 verdict remains
`needs_changes`; this status records remediation rather than retroactive
approval. A fresh r15 review of the remediation checkpoint is still required
to ratify F4.

## Fixes applied in this session

- F-001: task close, phase close, state migration and materialization now share
  a plan-wide `plan-state(projectId/planSlug)` authority. The fixed order is
  plan-state → phase-state → materialization/completion internals. Nested
  materialization receives the exact active lock object as an explicit
  capability authenticated by a module-private `WeakSet`, its lock path and
  current owner token; copied, wrong-scope and expired objects fail closed.
  Migration acquires sorted plan scopes before sorted phase scopes. A
  deterministic child-process regression holds the plan lock, lands a
  coordinated valid plan update, then proves that materialization rejects its
  stale candidate and preserves the writer's exact bytes. A separate parallel
  plan regression proves different phase scopes cannot load shared plan
  snapshots concurrently.
- F-002: the shared successor authority normalizes and digests the complete
  manifest. `materializeState` now binds both canonical paths, plan/phase
  identity and both exact candidate SHA-256 values before marker publication;
  it persists that manifest and digest through crash recovery and returns
  publication evidence on first completion, recovery and idempotent retry.
  `executePhaseDoneTransaction` advances from `emitted` only after the result's
  evidence exactly matches its marker-owned successor and the two confined live
  files still hash to that manifest under the same plan lock. No-op,
  forged-digest and exact-shape evidence without live publication fail while
  retaining the emitted recovery marker.

## Verification after remediation

- Initial focused red run: 82 tests, 78 pass and four expected failures. The
  failures independently proved missing publication authentication, ignored
  manifest binding, disjoint plan/materialization locks and absent nested lock
  capability. Final focused set: 85/85 pass; the later strengthened
  interleaving subset is 7/7.
- Exact F4 gates: G1 42/42, G2 72/72 and G3 78/78 pass. The F0 history receipt
  returns `ok: true` with classification `consistent`.
- Full package suite, freshly rerun after the live-byte evidence hardening:
  1,995 tests, 1,987 pass, 0 fail and 8 contractual skips.
- State and generated-contract gates: 167 files / 26 plans cross-validated;
  canonical aiDeck state 26 plans, 97 phases, 88 initiatives, 280 tasks and 151
  task gates; 15 skills valid; generated docs and schema current; schema drift
  2/2; migration dry-run 0 changes; `git diff --check` clean.
- Hook gates: session-start 38/38, stop 43/43, pre-write 70/70 and pre-commit
  5/5 pass. The installed aiDeck loader acceptance remains covered by the full
  suite. The existing live server was not restarted or used as local proof.

## Self-review against code-quality gates

- G1 read-before-claim: cited coordinator, materializer, lock, migration and
  public workflow source were read before accepting each finding.
- G2 soft-language: decision and remediation statements name verified failure
  mechanisms; no tentative completion claim is recorded.
- G3 anti-tautology: planned regressions cross real lock/publication boundaries
  and will fail when either lock sharing or manifest-byte binding is removed.
- G4 fixture realism: planned cases extend the production-shaped transaction,
  marker, candidate plan and initiative fixtures already used by the suites.
- G7 anti-premature-abstraction: the plan lock capability is admitted by four
  state-mutation boundaries; manifest binding remains in the existing
  materialization authority rather than a second reconciler.
- Final code review found no unresolved accepted finding. Removing the outer
  plan lock exposes both cross-phase overlap and stale materialization; removing
  any manifest path/identity/hash or publication-digest comparison fails a
  named boundary regression.

## Next action

Create the local r14 remediation checkpoint and execute a fresh sealed Codex
r15 review against the fixed F4 base. No push, PR, publication or external
service mutation is authorized.
