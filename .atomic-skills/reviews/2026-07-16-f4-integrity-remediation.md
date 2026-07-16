# Review — integrity-remediation F4
**Date:** 2026-07-16
**Mode:** local adversarial (external subagent)
**Scope:** F4 state authority + recoverable transitions (T-001..T-008)
**Branch:** `plan/integrity-remediation` vs `origin/develop`
**Range reviewed:** feat commits `b03f76a`..`c00b73d` (+ close fix `1509196`; tip at review time includes F3 materialize `53f548b`)
**Verdict:** PASS_WITH_FINDINGS

## Summary

F4 delivers the intended pure-function spine for structural integrity:

| Area | Deliverable | Gate evidence |
|------|-------------|----------------|
| T-001 | `src/state-invariants.js` — project+plan+phase join, uniqueness, terminal pending-gate | F4-G1: 41 pass |
| T-002 | `src/transition.js` — DAG validate; `proposeAdvance` → complete / ready / blocked | F4-G1 |
| T-003 | `lifecycle-order-guard` preflight + commit guard; no defer/skip terminal path | F4-G2 / G3 |
| T-004 | `verifiedCommit` / `reviewGate.at` git-SHA format + HEAD fingerprint stale check | F4-G2 |
| T-005 | `done-transaction` + `appendCompletion` identity dedupe | F4-G2: 25 pass |
| T-006 | history receipt + `assertSuccessorBarrier` + fault materialize tests | F4-G3: 40 pass + receipt ok |
| T-007 | `dispatch-log.js` NDJSON single writer/parser | F4-G3 |
| T-008 | detect-completion Still-open anchors; reconcile ≠ closure authority | T-008 suite green |

**Reproduced green (this review):**

- F4-G1: `validate-state-integrity` + `state-integrity-migration` + `transition-integrity` → 41 pass
- F4-G2: `phase-done-transaction` + `done-transaction` + `append-completion-actuals` → 25 pass
- F4-G3: materialize-transaction/history/barrier + lifecycle-gate-bypass + dispatchlog → 40 pass; `materialize-state --check-history-receipt` → `classification: consistent`, `closeSha: c44c405…` (real commit)

Adversarial re-check finds **no critical fail-open that silently corrupts foreign bytes** when callers feed honest slices, but **four majors** where the F4 narrative over-claims machine enforcement: (1) commit guard never reads authoritative `plan.phases[].exitGate.criteria`, so empty/`omit` `exitGates` vacuous-passes while plan criteria stay pending; (2) `materializePair` / CLI publish path treat the F4-G3 successor barrier as **opt-in**, so F3 can publish with F4-G3 still pending; (3) HEAD anchors are format-only and agent-supplyable without per-gate `verifiedCommit`; (4) terminal integrity only flags `pending` gates, not `failed`/`deferred`, and live F4 closed without a durable plan `reviewGate`.

## Findings

### F-001 [major] bypass / authority — `scripts/lifecycle-order-guard.js` `commitGuardPhaseDone` / `exitGatesOf`

**Claim:** Commit guard authorizes terminal phase-done from the caller-supplied `exitGates` / `phase.exitGates` only. It does **not** merge or re-read `plan.phases[].exitGate.criteria`, which skill prose (`project-transitions.md` Stage B/D) calls authoritative.

**Evidence (manual probe, this review):**

```js
// plan.phases[F4].exitGate.criteria includes F4-G3:pending
// input.exitGates = []  (agent forgot / empty initiative surface)
commitGuardPhaseDone(...) → { blocked: false, allowed: true }
decidePhaseDoneTerminal(...) → {
  terminal: true,
  writes: ['initiative:status:done', 'plan:phase:status:done', 'archive:move', 'project-status'],
  events: ['phase-done:F4'],
}
```

Open-gate / defer tests in `tests/lifecycle-gate-bypass.test.js` only cover the case where F4-G3 **is present** on the input slice as `pending`/`deferred`/`failed`. They do not assert the plan-criteria surface.

**Impact:** An agent (or any direct caller) that omits gates, or loads only an initiative with empty `exitGates[]` while the plan still has open criteria, gets a green commit guard and a non-empty terminal effect set — the exact bypass class T-003 / F4-G3 claim to eliminate for F4-G3.

**Recommendation:** In `commitGuardPhaseDone` / `preflightPhaseDone`, when `input.plan` is present, union gate statuses from `plan.phases[phaseId].exitGate.criteria` with initiative `exitGates` (plan criteria authoritative on conflict). Fail closed if plan has criteria and the combined set is empty or any criterion is not `met`. Add a lifecycle-gate-bypass fixture for “plan F4-G3 pending + empty input exitGates → zero terminal”.

---

### F-002 [major] fail-open / barrier — `scripts/materialize-state.js` `materializePair` + CLI publish

**Claim:** F4-G3 / T-006 state that materializing/activating F3 requires a valid F0 history receipt and non-deferred F4 terminal close. The barrier exists (`assertSuccessorBarrier`, `--require-f4-barrier`) and tests pass **when the barrier is invoked**. Default publish does **not** invoke it.

**Evidence:**

```360:379:scripts/materialize-state.js
export function materializePair(opts) {
  // ...
  successorBarrier = null,
  // ...
  if (successorBarrier) {
    assertSuccessorBarrier(successorBarrier);
  }
```

CLI publish path (`main` without `--require-f4-barrier`) calls `materializePair({ planPath, initiativePath, planContent, initiativeContent })` with **no** `successorBarrier`.

Manual probe: `materializePair` with F4-G3 still `pending` on the plan, target F3, **no** `successorBarrier` → `{ ok: true }`, initiative written.

Skill contract (`project-materialize.md`) tells the agent to run `--require-f4-barrier` first — agent-mediated, not API-default.

**Impact:** Any caller of the “single authority” publish primitive (or a skill that skips the prose preflight) can activate F3 / other F4 successors without a receipt and with F4-G3 still open. Weakens the non-deferrable F4-G3 barrier to “optional flag + documentation”.

**Recommendation:** When target initiative `phaseId` (or plan activation) transitively depends on barrier phase `F4` (or configured barrier), **always** run `assertSuccessorBarrier` inside `materializePair` (auto-detect from staged plan content). Keep explicit `successorBarrier` for overrides/tests. Make CLI publish pass `--target-phase` / infer phaseId from initiative and refuse without receipt when dependency holds. Add a regression: materialize F3 with pending F4-G3 and **no** barrier opts → throw, zero writes.

---

### F-003 [major] false-green / HEAD anchor — T-004 vs `checkMetInvariant` + commit guard

**Claim:** T-004 acceptance requires gate evidence to carry `verifiedCommit` and “SHA existente”; commit guard re-runs on HEAD change. Implementation is weaker:

1. `checkMetInvariant` **tolerates absent** `verifiedCommit` on legacy `met` criteria (documented); only rejects non-SHA **when present**.
2. Commit guard accepts **agent-supplied** `expectedFingerprint === fingerprint` with **zero** `evidence.verifiedCommit` on any gate (happy path in `lifecycle-gate-bypass.test.js` does this).
3. `isGitSha` is format-only (7–40 hex); no `git cat-file -e` / object existence check anywhere in pure guards (T-004 wording “SHA existente” is not machine-checked).
4. `requireFingerprint: false` is a supported opt-out that disables the entire fingerprint block.

**Evidence:** Manual probe — commit guard allows `{ exitGates:[{id:'G1',status:'met'}], fingerprint: FP, expectedFingerprint: FP }` with no verifiedCommit. `checkMetInvariant` returns `[]` for shell met + `evidence: { passed: true }` without verifiedCommit. Arbitrary hex `deadbeef…` passes `isGitSha` / GATE-R3 format.

**Impact:** After a review fix that changes HEAD, an agent can re-stamp `expectedFingerprint` to the new HEAD without re-running verifiers, as long as prior evidence lacked `verifiedCommit` or the agent omits those fields. Format-valid fake SHAs satisfy schema/validate-state. Undermines “evidence anchors the closed tree” for new closes that skip stamping.

**Recommendation:** For post-F4 closes (or when any deterministic verifier is present): require `evidence.verifiedCommit` on every `met` exit criterion before commit guard allows; derive `expectedFingerprint` only from those commits (ignore lone agent `expectedFingerprint` when evidence is present/required). Optionally add a thin I/O helper `assertGitObject(sha)` used by skill CLI wrappers — keep pure guard format-only but document “existente” as skill-layer. Tighten tests so F4-G2 happy path always includes verifiedCommit on gates.

---

### F-004 [major] validation gap — `checkTerminalGates` + live F4 close without plan `reviewGate`

**Claim:** Terminal integrity only rejects **pending** gates on done/archived phases. A hand-edited `status: done` phase with criteria `failed` / `deferred` / `declined` produces **no** `TERMINAL_PENDING_GATE` (or any other integrity code). Separately, GATE-R3 (`checkReviewGate`) tolerates **absent** `reviewGate` on done phases (legacy); only dishonest present claims are rejected.

**Evidence:**

- Probe: `checkTerminalGates({ status:'done', exitGate:{ criteria:[{id:'G1',status:'failed'}] } })` → `[]` (same for `deferred`).
- Live tree at review time: plan phase F4 is `status: done` with F4-G1..G3 `met` + verifiedCommit, but **no** `reviewGate` block on the plan descriptor (initiative reviewGate was removed in `1509196` as invalid). `checkReviewGate` would return `[]`. F3 is already materialized (`currentPhase: F3`, commit `53f548b`).

**Impact:** validate-state does not catch terminal phases closed with non-met non-pending gates, nor done-without-review after F4’s own T-004/GATE-R3 story. Process: this phase closed and advanced before the review file this gate was meant to produce — consistent with absent-reviewGate tolerance, inconsistent with “review before done” prose.

**Recommendation:** Expand terminal integrity: done/archived requires every criterion `status === 'met'` (or explicitly document deferred-as-terminal non-goal). Consider plan-level opt-in `reviewGateRequiredFrom` (mirror closedAt hardening) so new phases cannot be done without `reviewGate`. For this plan, stamp plan F4 `reviewGate` to this review file + HEAD after merge of findings disposition.

---

### F-005 [major] robustness — `scripts/dispatch-log.js` (and `append-completion.js`) isMain guard

**Claim:** F4/T-007 adds `dispatch-log.js` as the shared NDJSON module. Its CLI bootstrap is:

```js
if (import.meta.url === pathToFileURL(process.argv[1]).href) { ... }
```

When `process.argv[1]` is undefined (`node --input-type=module -e 'import …'`, some embedders), `pathToFileURL` throws **at module evaluation**, so any import of `append-completion` → `dispatch-log` crashes before exports run.

**Evidence:** Reproduced:

```text
node --input-type=module -e "import './scripts/dispatch-log.js'"
→ TypeError: The "path" argument must be of type string. Received undefined
```

Sibling scripts (`idea-add.js`, `idea-mark.js`, `materialize-state.js`) already guard with `process.argv[1] && …`. Unit tests use `node --test <file>` so argv[1] is set — **suite stays green**.

**Impact:** Not a silent integrity bypass; hard-crash of completion/dispatch consumers under embedding entrypoints. Still a load-bearing F4 module defect and a false-green relative to “single parser always safe to import”.

**Recommendation:** Match hardened pattern:

```js
const isMain = Boolean(process.argv[1])
  && import.meta.url === pathToFileURL(process.argv[1]).href;
```

Apply to `dispatch-log.js` and `append-completion.js`. Add a one-liner test that imports the module via a child without argv[1] or unit-tests the isMain expression.

---

### F-006 [minor] architecture — pure decision modules are not write-path enforcers

**Claim:** `decideDoneTerminal`, `decidePhaseDoneTerminal`, and `classifyLifecycleOrder` are pure and excellent for tests; nothing in the repo is a single CLI that refuses FS mutation without a green decision. Enforcement remains skill prose + agent compliance (`project-transitions.md`, `implement.md`).

**Impact:** Residual class shared with F0 setup sentinel. A determined agent can still YAML-edit `status: done`. F4 improves the **checkable** surface; it does not close agent non-compliance.

**Recommendation:** Accept for F4; track a future “mutating verb preflight CLI” (status edit / phase-done / done wrappers) that loads disk state, runs pure guards, and exits non-zero before writes. Not a gate fail.

---

### F-007 [minor] concurrency — append-only logs without locking

**Claim:** `appendCompletion` and `appendDispatchLog` dedupe/append without file locks. Two concurrent writers can both miss the identity key and double-append; consumers dedupe by key so analytics stay correct, but the log grows duplicates (history reconcile classifies as repairable).

**Impact:** Acceptable for single-threaded agent use (same residual as F0 materialize marker). Document; optional flock later.

---

### F-008 [nit] receipt / barrier coupling to integrity-remediation constants

**Claim:** Default receipt path and barrier ids are hardcoded (`docs/audits/integrity-remediation-f0-reconciliation.json`, phase `F4`, gate `F4-G3`). Fine for this plan; other plans reusing the primitive must pass overrides. Skill text acknowledges plan-local reuse.

**Recommendation:** Keep defaults; document in materialize skill that non-integrity plans must pass explicit barrier opts or skip auto-barrier when no F4-G3 exists (once F-002 auto-barrier lands, detect via plan criteria presence).

---

### F-009 [nit] `classifyHistoryReconcile` allows `repairable` through `checkHistoryReceipt`

**Claim:** Receipt check returns ok for both `consistent` and `repairable` (duplicate completion events with unique keys). Intentional for authentication-while-repairable; successor barrier therefore does not force a clean unique log.

**Recommendation:** Optional strict mode `--require-consistent` for F6 release qualification.

## Residual risks

- **Agent non-compliance** remains the dominant operational risk until mutating verbs call pure guards on disk state (F-001/F-002/F-006).
- **Mid-window / no flock** on materialize marker and NDJSON appends under concurrent agents.
- **F0 restore path** still non-atomic `writeFileSync` (F0 F-004 residual; not re-opened as F4 scope failure).
- **Live plan already advanced to F3** before this review file existed; barrier was exercised in `53f548b` chore, but reviewGate stamping lagged (F-004).
- **Fingerprint opt-outs** (`requireFingerprint: false`, `requireReview: false`) are available to any pure-guard caller — tests use them; production skill must not.

## What looks solid (adversarial credit)

- **Identity join** is correctly project-scoped; bare slug foreign-project match is slug-collision, not silent join. Lazy descriptor exception is tight (pending + subPhaseCount 0 + sidecar).
- **DAG authority** is dependsOn-driven, not numeric id order; linear non-numeric F0→F4→F3 chain elects correctly; self-loop / 2–3 cycles / unknown deps fail closed; zero-eligible with open work is `blocked`, not plan-done.
- **When gates are present on the input slice**, defer/pending/failed produce empty terminal effect sets — T-003 tests are honest for that interface.
- **When verifiedCommit is present**, HEAD drift after review correctly blocks (`phase-done-fingerprint-stale` / `phase-done-review-stale`) — T-004 core path is right.
- **appendCompletion** identity dedupe and done recovery marker ordering (state before event; no second close commit for handoff) match T-005.
- **History receipt** digests F0 projection (descriptor slice, initiative, sidecars, creation-gate, gate evidence, completion keys) without hashing whole plan.md; live check remains consistent after F4 close + F3 materialize.
- **assertSuccessorBarrier** correctly refuses pending/failed F4-G3, missing receipt, non-terminal F4, and transitive F1; skips non-successors.
- **dispatch-log** fail-closed parse with 1-based line numbers is the right NDJSON contract (modulo isMain crash).
- **T-008** Still-open only bumps schema-supported anchors; docs distinguish detection vs closure authority.

## Gate check

| Gate | Status | Notes |
|------|--------|-------|
| **F4-G1** | **Met with caveats** | Integrity + migration + transition suites green (41). Lazy descriptor preserved; bad shapes fail. Residual: terminal non-pending bad gates not rejected (F-004); sidecar discovery improved in `1509196`. |
| **F4-G2** | **Met with caveats** | Idempotent done + phase-done transaction tests green (25). HEAD stale path works **when verifiedCommit is stamped**. Residual: optional verifiedCommit + agent expectedFingerprint (F-003); commit guard not bound to plan criteria (F-001). |
| **F4-G3** | **Met with caveats** | Fault/history/barrier/dispatch tests green (40); live receipt consistent. Barrier **implementation** is sound; **default publish path does not enforce it** (F-002). Defer/skip blocked only when gate appears on decision input (F-001). |

## Verdict rationale

Gates’ shell verifiers are green and the pure authorities are a real upgrade over pre-F4 permissive joins and zero-eligible→plan-done. No critical data-clobber or journal-unsafe materialize regression found in F4 scope. Majors are **enforcement completeness and false-green interfaces** (empty gates, opt-in barrier, soft anchors, terminal failed gates, isMain crash) — same severity band as F0 PASS_WITH_FINDINGS. Do **not** treat F4-G3 as a hard API guarantee until F-001 and F-002 are closed.

**PASS_WITH_FINDINGS** — ship as phase-complete with explicit follow-ups before relying on F4 as the sole structural authority for destructive F1 work.

## Counts

| Severity | Count |
|----------|-------|
| blocker | 0 |
| critical | 0 |
| major | 5 (F-001..F-005) |
| minor | 2 (F-006, F-007) |
| nit | 2 (F-008, F-009) |

**0B / 0C / 5M / 2m / 2n**

## Suggested fix order (non-blocking for this review commit)

1. F-001 + F-002 (authority completeness) before F1 materialize is trusted from arbitrary agents  
2. F-005 (isMain) — one-line hardening  
3. F-003 + F-004 (anchor / terminal honesty)  
4. Stamp plan F4 `reviewGate` to this file after disposition  
