---
date: 2026-07-14T12:46:35-03:00
topic: integrity-remediation-f0-phase-642a2ef-r11
artifact: b2a845a5d7e832c88622cb21c89aff6ee33927e1..642a2efdca6de77b83d5a6d37bf200152eb5c33f
skill: review-code
reviewer: gpt-5-codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 1, minor: 1, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 2, minor: 1, nit: 0}
framing_delta: {dropped: 1, maintained: 2, emerged: 0}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F0 phase 642a2ef r11

## Capture manifest

- Ref: b2a845a5d7e832c88622cb21c89aff6ee33927e1..642a2efdca6de77b83d5a6d37bf200152eb5c33f
- Captured diff: 5,222,575 bytes / 114,936 lines / 76 files
- SHA-256: 538d8ffa96b873d08e75703d7b59d8c65858de6cc2bb6f7cc39ffa8c0ed33d7a
- Patch id: 4a5c9ac48ff6339cec3aa53554be94ee8cb6e7ab
- Mode: codex; model override: codex-auto-review; reasoning: high; sandbox: read-only
- Worktree was clean before capture and remained read-only during both passes.

## Structural validation

- Pass 1: frontmatter, verdict, counts, pass id, three findings and mandatory fields validated.
- Pass 2: frontmatter, verdict, counts, reconciliation headers and two final findings validated.
- Reconciliation: one blind finding dropped; two maintained; none emerged.

## Operator scope triage

- Final F-001 major — validated. A malformed phase projection returned `null`, leaving a stale index row while `indexErrors` remained empty.
- Final F-002 minor — validated. The new anchor validator accepted mutable rev expressions with seven or more characters.
- Blind F-002 major — dropped. A present malformed dispatch ledger is deliberately fail-closed; absence/no matching valid record is the graceful case, and the event is emitted before close state is persisted.
- Under the delegated conservative policy, both surviving findings were reproduced independently and fixed without weakening the prior fail-closed dispatch decision.
- Remaining substantive count after remediation at `6d3f512`: zero blocker, zero critical, zero major, zero minor. A fresh clean-checkpoint review remains required for phase approval.

## Remediation evidence

- RED 1: malformed F0 frontmatter produced zero `indexErrors` while its `PROJECT-STATUS.md` row remained stale.
- RED 2: `materializeDecomposition()` accepted `HEAD~123` as an immutable start commit.
- GREEN: projection read/parse failures now travel through the existing partial-failure channel while valid projections continue; anchors accept only 7–64 hexadecimal characters.
- Focused integration: 139/139 refresh/serve/verifier/decompose/runtime/dispatch tests passed.
- Full regression: 1,764 tests collected — 1,756 passed, 8 skipped, 0 failed.
- Validators: 166 state files / 26 plans / 1 routing config valid; all 15 skills valid; diff-check clean.

## Pass 1 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The diff introduces new state-refresh, completion-telemetry, and phase-materialization plumbing, but three correctness gaps remain. `refresh-state` silently drops malformed phase frontmatter while still reporting a clean index refresh, `appendCompletion` now lets any malformed `dispatch-log.json` entry abort unrelated `task-done` writes, and the new `startedCommit` anchor only checks string length, so mutable rev syntax can be stored where an immutable commit id is required.

These issues affect operator visibility, task-close reliability, and earned-value correctness. The negative coverage added in this pass does not cover malformed initiative projections or non-SHA `startedCommit` inputs.

## Findings

### F-001 [major] observability — scripts/refresh-state.js:81-83

**Evidence:**
```js
function initiativeProjection(filePath) {
  const parsed = parseFrontmatter(readFileSync(filePath, 'utf8'));
  if (parsed.error) return null;
}

for (const filePath of markdownFiles(phasesDir)) {
  const projection = initiativeProjection(filePath);
  if (projection) projections.push({ ...projection, planSlug });
}
```

**Claim:** A malformed phase initiative is silently skipped during `PROJECT-STATUS.md` refresh instead of being reported as an index error.

**Impact:** If a phase file stops parsing, its existing status row stays stale and `refresh-state` can still look clean, so `serve`/verification flows miss the fact that the project index no longer reflects live state.

**Recommendation:** Make projection parse failures explicit: throw or return structured errors from `initiativeProjection`, collect them in `indexErrors`, and surface the refresh as a partial failure instead of silently omitting that phase.

**Confidence:** high

---

### F-002 [major] error handling — scripts/append-completion.js:251-258

**Evidence:**
```js
export function readDispatchActuals(root, { planSlug, phaseId, taskId } = {}) {
  if (!hasText(taskId)) return undefined;
  const path = join(resolve(root), '.atomic-skills', 'status', 'dispatch-log.json');
  if (!existsSync(path)) return undefined;
  const log = parseDispatchLog(readFileSync(path, 'utf8'), { source: path });
  const matching = log.filter((r) => (
    r.plan === planSlug && r.phase === phaseId && r.taskId === taskId
  ));
}

export function appendCompletion(root, entry) {
  let effectiveEntry = entry;
  if (entry && entry.event === 'task-done' && entry.actuals == null) {
    const derived = readDispatchActuals(root, {
      planSlug: entry.planSlug, phaseId: entry.phaseId, taskId: entry.taskId,
    });
```

**Claim:** Any malformed line anywhere in `.atomic-skills/status/dispatch-log.json` now makes `appendCompletion()` throw before appending an unrelated `task-done` event.

**Impact:** One corrupt Mode-2 telemetry sidecar can block completion-event emission for unrelated tasks, turning optional dispatch metadata into a hard failure on the task-close path.

**Recommendation:** Catch dispatch-log parse failures inside `appendCompletion` and degrade to “no actuals” with a warning, or at minimum isolate failure to the matching record instead of the entire file.

**Confidence:** high

---

### F-003 [minor] data integrity — src/decompose.js:749-754

**Evidence:**
```js
function normalizeStartedCommit(value, owner) {
  if (value == null) return null;
  if (typeof value !== 'string' || value.trim().length < 7) {
    throw new Error(`${owner}: startedCommit must be a git commit id with at least 7 characters`);
  }
  return value.trim();
}
```

**Claim:** The new `startedCommit` validator accepts any 7+ character string, including mutable refs or rev expressions, even though the field is treated as an immutable commit id.

**Impact:** A caller can persist values like branch names or `HEAD~1`, so later actuals computation can resolve a moving target instead of the phase-start commit and silently skew earned-value metrics.

**Recommendation:** Validate `startedCommit` as a hex commit hash (`[0-9a-f]`, abbreviated or full length by policy) and add a negative test for non-hash rev syntax.

**Confidence:** high

---

## Questions (non-findings)

## Out of scope

- Archived review transcripts under `.atomic-skills/reviews/` were not treated as primary evidence.

## Pass 2 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 1, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
After applying the stated constraints, two findings remain. `refresh-state` still turns malformed phase frontmatter into a silent omission, so the `PROJECT-STATUS.md` refresh path can look clean while serving stale initiative rows. The new `startedCommit` plumbing also accepts arbitrary 7-character strings, which violates the “immutable HEAD SHA” contract and allows moving rev syntax to be persisted as the earned-value anchor.

The blind-pass dispatch-log finding does not stand: the constraint explicitly requires fail-closed behavior when a present sidecar is malformed or lacks routing identity. Verdict remains `needs_changes` because the surviving issues affect state-refresh observability and actuals integrity.

## Findings

### F-001 [major] observability — scripts/refresh-state.js:81-83

**Evidence:**
```js
function initiativeProjection(filePath) {
  const parsed = parseFrontmatter(readFileSync(filePath, 'utf8'));
  if (parsed.error) return null;
}
```

**Claim:** A malformed phase file is converted into `null` instead of a surfaced refresh error, so `refreshState()` has no way to report that broken projection through `indexErrors`.

**Impact:** `PROJECT-STATUS.md` can retain a stale row for that phase while `serve` and `verify-aideck-consumer` still report a clean refresh, violating the partial-failure channel required for malformed phase projections.

**Recommendation:** Change `initiativeProjection` to return structured failures for parse/schema problems, collect them in `refreshProjectIndexes()`, and append them to `indexErrors` instead of silently dropping the phase.

**Confidence:** high

---

### F-002 [minor] data integrity — src/decompose.js:749-754

**Evidence:**
```js
function normalizeStartedCommit(value, owner) {
  if (value == null) return null;
  if (typeof value !== 'string' || value.trim().length < 7) {
    throw new Error(`${owner}: startedCommit must be a git commit id with at least 7 characters`);
  }
  return value.trim();
}
```

**Claim:** The new `startedCommit` validator accepts any 7+ character string, including mutable refs and rev expressions, even though this field is the immutable phase-start commit anchor.

**Impact:** Persisting values such as `main` or `HEAD~1` lets later phase actuals resolve against a moving target at close time, silently undercounting or overcounting commits/files after subsequent branch movement or new commits.

**Recommendation:** Restrict `startedCommit` to hex commit IDs only, reject rev syntax and ref names at write time, and add negative tests for inputs like `HEAD~1` and `main`.

**Confidence:** high

## Questions (non-findings)

- _(none)_

## Out of scope

- Archived review transcripts under `.atomic-skills/reviews/` were not treated as primary evidence.

## Pass 2 reconciliation

### Dropped from blind pass

- F-002-blind [major] error handling — DROPPED: the external constraint explicitly defines malformed present `dispatch-log.json` input or incomplete routing identity as fail-closed on the task-close path, so this behavior is intentional and in scope by design.

### Maintained

- F-001-blind → F-001-final [major] — same
- F-003-blind → F-002-final [minor] — same

### Emerged

- _(none)_
