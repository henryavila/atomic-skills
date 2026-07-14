---
date: 2026-07-14T14:14:01-03:00
topic: integrity-remediation-f0-phase-e96ddbc-r14
artifact: b2a845a5d7e832c88622cb21c89aff6ee33927e1..e96ddbc02dab6920c6acccb4b12a4d2220b709b2
skill: review-code
reviewer: gpt-5-codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
framing_delta: {dropped: 2, maintained: 1, emerged: 1}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F0 phase e96ddbc r14

## Capture manifest

- Ref: b2a845a5d7e832c88622cb21c89aff6ee33927e1..e96ddbc02dab6920c6acccb4b12a4d2220b709b2
- Captured diff: 5,409,515 bytes / 116,864 lines / 88 files
- SHA-256: 1cc9ec7e1a38dba61f387b7918367788e66ad0a9a69fe6ce5489e7e0834b1346
- Patch id: cd91c3c6fa505eaced005f084337bc86934c3976
- Raw Pass 1 SHA-256: 92658443047aa53fe0de26e677191028236e3ba6b12f11f5712da75bd5a03cf2
- Raw Pass 2 SHA-256: 6c9c58c5f4ec70e164c2d97548a10e46a7545846504f50d1b5a910f1e02ea5b3
- Mode: codex; model override: codex-auto-review; reasoning: high; sandbox: read-only
- Worktree was clean before capture and remained read-only during both passes.

## Structural validation

- Pass 1: frontmatter, verdict, counts, pass id, three findings and mandatory fields validated.
- Pass 2: frontmatter, verdict, counts, reconciliation headers and two final findings validated.
- Reconciliation: two blind findings dropped, one maintained and one emerged.

## Operator scope triage

- Final F-001 major — validated and fixed. `materialize-state` now accepts the schema-valid `nextAction: null` only when `tasks.length === 0`; non-empty task sets still require one concrete next action. A transaction-level regression publishes and rereads the zero-task phase.
- Final F-002 major — validated and fixed. The resident `project` router now falls back to `$PWD` only after proving `package.json.name === "@henryavila/atomic-skills"` and the shipped `detect-completion.js` entrypoint. A router-level regression executes the rendered shell block with no install marker.
- Blind F-001 major — dropped. The final refresh check→rename window is the explicitly deferred F4 shared-writer boundary.
- Blind F-002 major — dropped. Marker-first recovery independent of caller-owned candidate files is the documented and tested retry contract for this transaction.
- Delegated decisions: preserve zero-task phases as a valid schema state instead of narrowing the writer/schema; retain the concrete-next-action requirement for every phase with tasks; restore source-checkout development only under package identity plus entrypoint proof; keep arbitrary consumers fail-closed.
- Remaining substantive count after remediation at `141a170`: zero blocker, zero critical, zero major, zero minor. A fresh clean-checkpoint review remains required for phase approval.

## Remediation evidence

- RED: `project.test.js` plus `materialize-bootstrap.test.js` collected 111 tests, with 109 passing and the two new regressions failing before production/docs changed.
- GREEN: the same focused set passed 111/111 after remediation.
- T-006 verifier: 165/165 materialization, refresh, dispatch-log and decompose tests passed.
- F0-G1 verifier: 61/61 installed-runtime, closure, implement contract and lifecycle tests passed.
- F0-G2 verifier: 83/83 project and install/uninstall parity tests passed.
- Full regression: 1,769 tests collected — 1,761 passed, 8 skipped, 0 failed.
- Validators: 166 state files / 26 plans / 1 routing config valid; all 15 skills valid; runtime closure checked 934 rendered files across 12 IDE/scope combinations; `project.md` byte budget green at 22,910 bytes; diff-check clean.

## Pass 1 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The changed surface still contains three correctness regressions. The new `PROJECT-STATUS.md` writer acknowledges that its conflict check is not authoritative, so a concurrent write that lands after the equality check and before `renameSync()` is still silently lost. The new materialization authority also recovers any pending marker before it even reads the caller’s candidate bytes, which means a retry with corrected plan/initiative content can return success while publishing the stale staged pair from the interrupted run instead. Finally, staged validation now rejects `nextAction: null`, even though the canonical writer emits `null` for zero-task initiatives and the schema explicitly allows it.

These are not style issues; they affect observable behavior under normal retry/concurrency paths and leave at least one legitimate state shape unmaterializable.

## Findings

### F-001 [major] race-condition — scripts/refresh-state.js:201-206

**Evidence:**
```js
    // Optimistic conflict check for updates made since the snapshot read. This
    // is intentionally not a complete cross-writer CAS: F-001 defers authority
    // over the final check→rename window to the shared-writer work in F4.
    if (readFileSync(indexPath, 'utf8') !== expected) return false;

    renameSync(temporaryPath, indexPath);
```

**Claim:** `publishProjectIndex()` still has a lost-update window because it only compares file contents before `renameSync()` and holds no lock or final authoritative CAS across the check→rename boundary.

**Impact:** Any concurrent edit to `PROJECT-STATUS.md` that lands after the equality check but before `renameSync()` is silently overwritten, so newly added rows, comments, or manual repairs can disappear even though the function reports success.

**Recommendation:** Make the publish step authoritative: hold a writer lock for the whole read/check/publish sequence, or use an atomic compare-and-swap strategy that validates the same snapshot at the final replacement point before committing the rename.

**Confidence:** high

---

### F-002 [major] recovery/rollback — scripts/materialize-state.js:720-727

**Evidence:**
```js
    // Recovery is deliberately first and does not depend on caller-owned
    // candidate files, which may be gone after an interrupted invocation.
    if (existsSync(markerPath)) {
      const marker = readMarker(markerPath, absoluteRoot, planRel, initiativeRel);
      if (marker.paths.plan !== planRel || marker.paths.initiative !== initiativeRel) {
        throw new Error('pending materialization marker targets different live paths; refusing writes');
      }
      return recover(absoluteRoot, markerPath, marker, faultAt);
    }
```

**Claim:** A retry with corrected `planContent`/`initiativeContent` or new candidate files is ignored whenever a marker exists, because the function returns from `recover()` before it even reads the caller’s requested bytes.

**Impact:** After an interrupted materialization, rerunning with fixed task data, summaries, or business intent can report success while publishing the stale staged pair from the previous attempt, leaving the live plan/initiative different from what the caller just asked to apply.

**Recommendation:** If the caller supplied candidates during recovery, compare them against the staged/live transaction bytes and fail when they differ; only recover silently when the requested candidate pair matches the pending transaction exactly.

**Confidence:** high

---

### F-003 [major] compatibility — scripts/materialize-state.js:486-488

**Evidence:**
```js
  if (typeof initiative.nextAction !== 'string' || initiative.nextAction.trim() === '') {
    errors.push('materialized initiative nextAction is required');
  }
```

**Claim:** `validateStagedPair()` rejects schema-valid zero-task initiatives by requiring a non-empty `nextAction`, even though the canonical writer emits `null` when there is no first task (`src/decompose.js:832-834`) and the initiative schema allows `nextAction` to be `null` (`meta/schemas/initiative.schema.json:63`).

**Impact:** A descriptor-only phase with zero tasks cannot be materialized through the new transaction authority, despite being representable by the existing writer and accepted by the schema/state model.

**Recommendation:** Allow `initiative.nextAction === null` when `initiative.tasks.length === 0`, and add a regression test that materializes a zero-task phase through `materializeState()`.

**Confidence:** high

---

## Questions (non-findings)


## Out of scope

- Archived review transcripts were not treated as findings unless backed by the current changed source.

## Pass 2 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The informed pass leaves two substantive regressions. `materialize-state.js` still rejects `nextAction: null`, even though the canonical writer and the initiative schema both permit `null` for zero-task initiatives, so the new materialization authority cannot publish a state shape the rest of the system already accepts. Separately, the resident `project` router now requires `~/.atomic-skills/package-root` unconditionally and dropped the verified source-checkout fallback that the disclosed runtime-resolution contract allows, so router-driven flows can fail from a valid checkout before lazy details get a chance to self-resolve.

The blind `refresh-state` race does not survive the stated F0 boundary: the constraints explicitly defer that shared-writer window to F4. The blind recovery-first concern also drops because the changed materialize flow now documents and tests marker-first recovery as the intended retry contract.

## Findings

### F-001 [major] compatibility — scripts/materialize-state.js:486-487

**Evidence:**
```text
scripts/materialize-state.js
  if (typeof initiative.nextAction !== 'string' || initiative.nextAction.trim() === '') {
    errors.push('materialized initiative nextAction is required');
  }

src/decompose.js
  nextAction: typeof init.nextAction === 'string' && init.nextAction.trim() !== ''
    ? init.nextAction
    : (tasks[0] ? `Start ${tasks[0].id}: ${tasks[0].title}` : null),

meta/schemas/initiative.schema.json
  "nextAction": { "type": ["string", "null"] },
```

**Claim:** `validateStagedPair()` hard-requires a non-empty string `nextAction`, even though the canonical writer and schema both emit and allow `null` when an initiative has zero tasks.

**Impact:** A zero-task phase cannot be materialized through `materialize-state.js`; the transaction authority rejects state that the existing writer and validator consider valid, so a legitimate phase activation fails before any publish.

**Recommendation:** Accept `nextAction: null` when `tasks.length === 0`, and add a regression test that materializes a zero-task initiative through `materializeState()`.

**Confidence:** high

---

### F-002 [major] compatibility — skills/core/project.md:18-23

**Evidence:**
```md
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || true)"
[ -n "$PKG_ROOT" ] && [ -f "$PKG_ROOT/package.json" ] || {
  echo "runtime unavailable" >&2; exit 1
}

Print `DRIFT` only when `node "$PKG_ROOT/scripts/detect-completion.js" --json` reports `drift: true`
```

**Claim:** The resident `project` router now hard-fails unless `~/.atomic-skills/package-root` exists, and it no longer provides the verified source-checkout fallback that the runtime-resolution contract allows.

**Impact:** Running `/atomic-skills:project` from a valid `@henryavila/atomic-skills` checkout without an installed marker aborts router-level behavior such as the no-args DRIFT probe and any lazy detail that relies on the resident `PKG_ROOT`, blocking local source-checkout use even though the shipped entrypoints are present.

**Recommendation:** Add the same verified fallback used by the self-contained detail files: if the marker is absent, accept `$PWD` only after proving `package.json.name === "@henryavila/atomic-skills"` and the required entrypoint exists, then cover that path with a router-level regression test.

**Confidence:** high

## Questions (non-findings)

- _(none)_

## Out of scope

- The final `refresh-state` check→rename shared-writer race in `scripts/refresh-state.js` is explicitly deferred to F4 by the stated contract.

## Pass 2 reconciliation

### Dropped from blind pass

- F-001-blind [major] race-condition — DROPPED: the external constraints explicitly state that the final `refresh-state` shared-writer check→rename race is deferred to F4 and is not an F0 defect.
- F-002-blind [major] recovery/rollback — DROPPED: the changed `project-materialize.md` contract and `tests/phase-materialization/materialize-bootstrap.test.js` both define retry as marker-first recovery that does not depend on caller-owned candidate files, so this behavior is intentional in the reviewed artifact.

### Maintained

- F-003-blind → F-001-final [major] — same

### Emerged

- F-002-final [major] compatibility — emerged: the disclosed runtime-resolution constraint makes the new resident resolver in `skills/core/project.md` reviewable against the required source-checkout fallback, which the current router no longer provides.
