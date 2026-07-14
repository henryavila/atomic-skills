---
date: 2026-07-14T12:23:37-03:00
topic: integrity-remediation-f0-phase-6b45b14-r10
artifact: b2a845a5d7e832c88622cb21c89aff6ee33927e1..6b45b14f0c15931374bfcdeb3b801bf4daa24b7d
skill: review-code
reviewer: gpt-5-codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
framing_delta: {dropped: 2, maintained: 1, emerged: 0}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F0 phase 6b45b14 r10

## Capture manifest

- Ref: b2a845a5d7e832c88622cb21c89aff6ee33927e1..6b45b14f0c15931374bfcdeb3b801bf4daa24b7d
- Captured diff: 5,204,340 bytes / 114,590 lines / 75 files
- SHA-256: f75414c083cbecf680c8b7981545ae64c2132893bfa77e55d8dd7f4ff9e03f9d
- Patch id: f0dafc2d8423be9e511fa3a26e8c7368f81e140f
- Mode: codex; model override: codex-auto-review; reasoning: high; sandbox: read-only
- Worktree was clean before capture and remained read-only during both passes.

## Structural validation

- Pass 1: frontmatter, verdict, counts, pass id, three findings and mandatory fields validated.
- Pass 2: frontmatter, verdict, counts, reconciliation headers and one final finding validated.
- Reconciliation: two blind findings dropped; one blind finding narrowed and maintained; none emerged.

## Operator scope triage

- Final F-001 major — validated after narrowing. `materialize <phase>` already stamps its post-render candidate, but initial F0 creation through `new plan`/`adopt` had no `startedCommit` route.
- Blind F-002 major — dropped. The URL-unsafe direct-execution check in `refresh-state.js` predates the frozen base and is not an F0 regression.
- Blind F-003 major — dropped from F0. The final check→rename race is explicitly reserved for the shared-writer authority in F4.
- The user-delegated conservative choice was to fix the surviving initial-F0 contract by TDD and preserve the two dropped items as causality/deferment decisions rather than rewriting the raw review.
- Remaining substantive count after remediation at `fd9af30`: zero blocker, zero critical, zero major, zero minor. A fresh clean-checkpoint review remains required for phase approval.

## Remediation evidence

- RED: the direct materializer, installed CLI consumer, create-plan contract and lifecycle E2E all observed an absent `startedCommit` on the emitted F0.
- GREEN: `materializeDecomposition()` validates and threads the optional anchor, `writeInitiativeFile()` persists it, the CLI accepts `--started-commit`, and both `new plan` and `adopt` resolve/pass `git rev-parse HEAD` when available.
- Focused integration: 134/134 materialization/decompose/runtime tests and 64/64 skill script-resolution tests passed; all 15 skills validated.
- Full regression: 1,763 tests collected — 1,755 passed, 8 skipped, 0 failed.
- Validators: 166 state files / 26 plans / 1 routing config valid; all 15 skills valid; diff-check clean.

## Pass 1 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The phase introduces useful scaffolding for runtime resolution, materialization, and derived-state refresh, but three load-bearing regressions remain in the changed surface. One breaks the new earned-value anchor contract by never persisting `startedCommit`; one leaves `refresh-state.js` non-executable from installed paths containing spaces; and one acknowledges but does not close a remaining lost-update race in `PROJECT-STATUS.md` publication.

Because these issues affect emitted state correctness, installed-runtime compatibility, and concurrent state safety, the diff should not be approved as-is.

## Findings

### F-001 [major] correctness — src/decompose.js:810-845

**Evidence:**
```js
  const initFm = {
    schemaVersion: '0.1',
    slug: initSlug,
    title,
    goal: init.goal || `TODO: fill goal for ${init.phaseId}`,
    ...(typeof init.summary === 'string' && init.summary.trim() !== '' ? { summary: init.summary } : {}),
    status: active ? 'active' : 'pending',
    branch: branch || null,
    started: iso,
    lastUpdated: iso,
    nextAction: typeof init.nextAction === 'string' && init.nextAction.trim() !== ''
      ? init.nextAction
      : (tasks[0] ? `Start ${tasks[0].id}: ${tasks[0].title}` : null),
    parentPlan: planSlug,
    phaseId: init.phaseId,
    ...(businessIntent ? { businessIntent } : {}),
```

**Claim:** The shared initiative writer never emits `startedCommit`, so newly materialized phases cannot satisfy the new immutable-anchor contract that later actuals computation prefers.

**Impact:** Every phase created through `writeInitiativeFile()` falls back to the timestamp heuristic in `computePhaseActuals()` instead of a commit SHA anchor, so rebases/squashes/amends can shift the base commit and over/under-count `filesChanged`, LOC, and commit totals on `phase-done`.

**Recommendation:** Add an optional `startedCommit` field to `writeInitiativeFile()` and thread it through both `materializeDecomposition()` and the `materialize <phase>` flow; add regression tests that assert the field is persisted and then consumed by phase-actuals paths.

**Confidence:** high

---

### F-002 [major] compatibility — scripts/refresh-state.js:287-290

**Evidence:**
```js
// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = resolve(process.argv[2] || process.cwd());
  const r = refreshState(target);
```

**Claim:** The CLI entry check is path-string based instead of URL-safe, so direct `node .../scripts/refresh-state.js` invocations stop working when the installed path contains spaces or other characters that must be URL-encoded.

**Impact:** The changed skills and hooks call `refresh-state.js` from the installed package root; on common installations such as `~/My Projects/...`, the script will silently skip its CLI body and leave rollups, focus markers, and dashboard state stale after transitions.

**Recommendation:** Replace this check with the same robust pattern already introduced elsewhere (`pathToFileURL(resolve(process.argv[1])).href` or the shared `isDirectExecution()` helper), and add a CLI smoke test under a path with spaces.

**Confidence:** high

---

### F-003 [major] race — scripts/refresh-state.js:159-164

**Evidence:**
```js
    // Optimistic conflict check for updates made since the snapshot read. This
    // is intentionally not a complete cross-writer CAS: F-001 defers authority
    // over the final check→rename window to the shared-writer work in F4.
    if (readFileSync(indexPath, 'utf8') !== expected) return false;

    renameSync(temporaryPath, indexPath);
```

**Claim:** `publishProjectIndex()` still has a lost-update window between the final re-read and `renameSync()`, so a concurrent writer that lands after the check is overwritten without detection or retry.

**Impact:** `PROJECT-STATUS.md` can report success while discarding another concurrent update, including manual prose edits or another refresh's row changes; the file is derived, but the overwritten bytes are still user-visible state and can be lost.

**Recommendation:** Serialize index publication with the same shared state writer/lock used for other state mutations, or use a real CAS/lock primitive that closes the check→rename gap; add a regression test that injects a competing write after the final read and before rename.

**Confidence:** high

---

## Questions (non-findings)

- `src/serve.js:258` — When `.atomic-skills/projects/` contains more than one real project, should `serve` refuse or prompt instead of inventing a basename-derived `projectId`?

## Out of scope

- Archived review transcripts listed in the briefing were treated as audit artifacts only, not as primary evidence sources.

## Pass 2 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The only blind-pass issue that remains in scope is the new F0 materialization path. `materializeDecomposition()` now creates the initial active phase that the earned-value pipeline later treats as commit-anchored, but it still emits that phase without `startedCommit`. That leaves every newly created plan’s first phase on the fragile timestamp fallback the new contract was introduced to avoid.

The other two blind findings do not survive the supplied constraints: the `refresh-state.js` direct-exec path check predates the frozen base, and the remaining `PROJECT-STATUS.md` publish race is explicitly deferred to F4. The diff still needs changes because the surviving regression affects persisted actuals in the append-only completion log.

## Findings

### F-001 [major] correctness — src/decompose.js:1130-1141

**Evidence:**
```js
  files.push(
    writeInitiativeFile(initiatives[0], planSlug, {
      iso,
      branch,
      active: true,
      stateRoot,
      planDir,
      projectId,
      businessIntent,
      seenSlugs,
      seenPaths,
    }),
  );
```

**Claim:** The initial active F0 emitted by `materializeDecomposition()` has no path to persist `startedCommit`, so `new plan`/adopt always create a legacy-style phase without the commit anchor the new actuals contract prefers.

**Impact:** The first `phase-done` on every newly created plan falls back to the committer-date heuristic in `computePhaseActuals()` instead of a stable SHA anchor, so rebase/squash/amend can misstate `filesChanged`, `locAdded`, `locRemoved`, and `commits` in the immutable completion log.

**Recommendation:** Add `startedCommit` plumbing to the F0 materialization path: accept it in `materializeDecomposition()`/`writeInitiativeFile()` or stamp the returned F0 candidate immediately after render, have the `new plan`/adopt path pass `git rev-parse HEAD` when git is available, and add a regression test that asserts the generated F0 frontmatter contains the anchor.

**Confidence:** high

---

## Questions (non-findings)

- `src/serve.js:258` — When `.atomic-skills/projects/` contains more than one real project, should `serve` refuse or prompt instead of deriving a fallback `projectId` from the cwd basename?

## Out of scope

- Archived `.atomic-skills/reviews/*.md` transcripts were treated as audit artifacts only, not as primary evidence.

## Pass 2 reconciliation

### Dropped from blind pass

- F-002-blind [major] compatibility — DROPPED: the `refresh-state.js` direct-execution path-space issue is unchanged since 2026-06-15 and therefore is not a regression in the frozen diff.
- F-003-blind [major] race — DROPPED: the remaining `PROJECT-STATUS.md` check→rename race is explicitly deferred to F4 and is not an F0 defect under the supplied constraints.

### Maintained

- F-001-blind → F-001-final [major] — same; narrowed from all materialization paths to the initial `materializeDecomposition()` F0 path because the later `materialize <phase>` flow already stamps `startedCommit`.

### Emerged

- _(none)_
