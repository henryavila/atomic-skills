---
date: 2026-07-14T13:14:03-03:00
topic: integrity-remediation-f0-phase-61bdcd9-r12
artifact: b2a845a5d7e832c88622cb21c89aff6ee33927e1..61bdcd95d507795dbfb02674d1e16d7b2e802673
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

# Cross-Model Review — integrity-remediation F0 phase 61bdcd9 r12

## Capture manifest

- Ref: b2a845a5d7e832c88622cb21c89aff6ee33927e1..61bdcd95d507795dbfb02674d1e16d7b2e802673
- Captured diff: 5,237,214 bytes / 115,244 lines / 77 files
- SHA-256: c6445ea1f5f98b6b176aabe47c129d71047e677d34087fc578cf561a9e5322e4
- Patch id: 6e4d649e189e9706b496b07420cb057ad39b99dc
- Mode: codex; model override: codex-auto-review; reasoning: high; sandbox: read-only
- Worktree was clean before capture and remained read-only during both passes.

## Structural validation

- Pass 1: frontmatter, verdict, counts, pass id, three findings and mandatory fields validated.
- Pass 2: frontmatter, verdict, counts, reconciliation headers and two final findings validated.
- Reconciliation: two blind findings dropped, one maintained and one emerged.

## Operator scope triage

- Final F-001 major — validated. `project-view` could execute consumer-local package-owned `src` helpers when the install marker was absent.
- Final F-002 major — validated. The descriptor-only materialization flow could execute a consumer-local transactional authority through the same unchecked fallback.
- Blind F-002 major — dropped. A present malformed dispatch ledger is deliberately fail-closed; absence/no matching valid record is the graceful case, and completion is emitted before task state is saved.
- Blind F-003 major — dropped. The F0 smoke contract deliberately reports refresh `indexErrors`/`seriesError` as partial warnings while manifest/API mismatches remain blocking.
- Delegated decision: retain source-checkout development support only after proving `package.json.name === "@henryavila/atomic-skills"` and the required shipped entrypoint. A consumer without the install marker now fails closed with an actionable reinstall error. All package-owned calls in the two affected flows reuse the verified absolute `PKG_ROOT`.
- Remaining substantive count after remediation at `3521ade`: zero blocker, zero critical, zero major, zero minor. A fresh clean-checkpoint review remains required for phase approval.

## Remediation evidence

- RED: the new static guard found the unchecked `project-view` provision/normalize helpers and the `project-materialize` transaction authority; 65 tests collected, 63 passed and 2 failed before the docs were repaired.
- GREEN: the guard passed 65/65 after both flows adopted the trusted-root preflight. The status-script fixture now records the real package runtime instead of relying on a consumer-cwd fallback.
- Focused integration: 134/134 skill-resolution, installed-runtime, runtime-closure, consumer-install and materialization lifecycle tests passed.
- T-006 verifier: 163/163 materialization, refresh, dispatch-log and decompose tests passed.
- Full regression: 1,765 tests collected — 1,757 passed, 8 skipped, 0 failed.
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
Three substantive regressions remain in the changed runtime surface. The installed-runtime isolation fix is incomplete because skill recipes still fall back to `.` for package-owned entrypoints and can execute consumer-local JavaScript when the package-root marker is absent. The completion-event path also changed from graceful degradation to fail-closed on malformed dispatch telemetry, which can block task-close analytics emission. Finally, the aiDeck smoke verifier now explicitly returns success on partial refresh failures, so it can false-green stale or missing derived dashboard state.

## Findings

### F-001 [major] runtime isolation — skills/shared/project-assets/project-view.md:95-99

**Evidence:**
```md
# Provision (idempotent) the single ~/.aideck/consumers/atomic-skills/ consumer
# from the shipped template through the recorded package runtime.
PROV="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/src/provision-consumer.js"
[ -f "$PROV" ] || PROV=""
[ -n "$PROV" ] && node "$PROV" >/dev/null 2>&1
```

**Claim:** When `~/.atomic-skills/package-root` is missing, this recipe resolves to `./src/provision-consumer.js` and executes repo-local code instead of failing closed.

**Impact:** Running `project status` in a consumer repository can execute the repository’s own `src/provision-consumer.js` (or any same-named local entrypoint in similar recipes), causing unintended code execution, masking a broken install, and mutating the wrong project state.

**Recommendation:** Remove the `|| echo .` fallback for package-owned `src/`/`scripts/` entrypoints and hard-fail when the package-root marker is unreadable. Add a guard test that rejects this fallback pattern in rendered skill bodies.

**Confidence:** high

---

### F-002 [major] error handling — scripts/append-completion.js:248-358

**Evidence:**
```js
 * Malformed present input throws with its physical line; missing Mode-1 telemetry
 * remains graceful and is not an error.
 */
export function readDispatchActuals(root, { planSlug, phaseId, taskId } = {}) {
  if (!hasText(taskId)) return undefined;
  const path = join(resolve(root), '.atomic-skills', 'status', 'dispatch-log.json');
  if (!existsSync(path)) return undefined;
  const log = parseDispatchLog(readFileSync(path, 'utf8'), { source: path });
  const matching = log.filter((r) => (
    r.plan === planSlug && r.phase === phaseId && r.taskId === taskId
  ));

export function appendCompletion(root, entry) {
  let effectiveEntry = entry;
  if (entry && entry.event === 'task-done' && entry.actuals == null) {
    const derived = readDispatchActuals(root, {
      planSlug: entry.planSlug, phaseId: entry.phaseId, taskId: entry.taskId,
    });
    if (derived !== undefined) effectiveEntry = { ...entry, actuals: derived };
  }
```

**Claim:** A malformed `dispatch-log.json` now throws out of `appendCompletion()` instead of degrading to “no actuals” for `task-done` events.

**Impact:** One bad telemetry line can break completion-event emission during `done`/`phase-done` flows, either blocking the close path or leaving state transitions without their append-only analytics record even though dispatch telemetry is auxiliary.

**Recommendation:** Catch parse/validation failures at the `appendCompletion()` boundary and omit derived actuals when the sidecar is corrupt, while surfacing the corruption separately for repair.

**Confidence:** high

---

### F-003 [major] verification — scripts/verify-aideck-consumer.mjs:141-150

**Evidence:**
```js
if (shouldSmoke) {
  head('[derived state refresh]');
  const refreshed = refreshState(REPO_ROOT);
  const refreshErrors = [
    ...(Array.isArray(refreshed.indexErrors) ? refreshed.indexErrors : []),
    ...(refreshed.seriesError ? [refreshed.seriesError] : []),
  ];
  if (refreshErrors.length > 0) {
    warnings++;
    console.log(c.warn(`  ⚠ refresh-state had a partial failure: ${refreshErrors.join('; ')}`));
  } else {
```

**Claim:** In `--smoke` mode, refresh failures are downgraded to warnings instead of failing the verifier.

**Impact:** `verify-aideck-consumer --smoke` can exit 0 while derived aiDeck state generation is already known to be stale or incomplete, creating a false-green release signal for dashboard readiness.

**Recommendation:** Treat `seriesError` and project-index refresh failures as blocking in smoke mode, and update the smoke contract/tests accordingly so the verifier fails when refresh-state cannot fully regenerate the dashboard inputs.

**Confidence:** high

## Questions (non-findings)

## Out of scope

- Archived review transcripts under `.atomic-skills/reviews/` were treated as audit artifacts only, not as executable source of truth.

## Pass 2 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The blind-pass telemetry and smoke-verifier complaints do not survive the stated F0 contracts: dispatch-log corruption is intentionally fail-closed, and `verify-aideck-consumer --smoke` is intentionally PASS-with-warning on partial refresh failures. Two runtime-isolation defects remain.

Both surviving issues come from the new package-root fallback contract. Changed skill bodies still execute package-owned `src/` and `scripts/` entrypoints via `|| echo .` without first proving that `.` is the atomic-skills checkout. In a consumer repo where `~/.atomic-skills/package-root` is missing, those commands can run repo-local files instead of the installed runtime, which defeats the claimed authority and safety guarantees of the affected flows.

## Findings

### F-001 [major] runtime isolation — skills/shared/project-assets/project-view.md:95-99

**Evidence:**
```md
PROV="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/src/provision-consumer.js"
[ -f "$PROV" ] || PROV=""
[ -n "$PROV" ] && node "$PROV" >/dev/null 2>&1

NORM="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/src/normalize.js"
[ -f "$NORM" ] || NORM=""
[ -n "$NORM" ] && node "$NORM" "$PWD/.atomic-skills"
```

**Claim:** `project-view` executes package-owned `src/` helpers through a `.` fallback without verifying that the current working directory is the atomic-skills checkout.

**Impact:** If `~/.atomic-skills/package-root` is absent, opening the dashboard or running the repair path in a consumer repository can execute that repository’s own `src/provision-consumer.js` or `src/normalize.js`, causing unintended code execution and mutating the wrong state instead of failing closed.

**Recommendation:** Remove the unconditional `|| echo .` fallback for package-owned `src/` entrypoints, or guard it with an explicit checkout verification before allowing `.`. If the verification fails, abort with an actionable install/runtime error.

**Confidence:** high

---

### F-002 [major] runtime isolation — skills/shared/project-assets/project-materialize.md:162

**Evidence:**
```md
`{{BASH_TOOL}} node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/materialize-state.js" --root . --plan .atomic-skills/projects/<project-id>/<plan-slug>/plan.md --initiative .atomic-skills/projects/<project-id>/<plan-slug>/phases/<resolved-phase-file>.md --plan-candidate <temporary-plan-candidate> --initiative-candidate <temporary-initiative-candidate> --expected-plan-hash <sha256-of-live-plan> --tx-id <unique-tx-id>`.
```

**Claim:** The materialization flow invokes its transactional write authority through the same unchecked `.` fallback, so a missing package-root marker can redirect `project materialize` to `./scripts/materialize-state.js` in the consumer repo.

**Impact:** On an absent-marker install, a high-stakes state transition can execute consumer-local code instead of the shipped materializer, bypassing the staged-write, marker, and rollback guarantees that this step claims to provide.

**Recommendation:** Do not allow mutating `scripts/*.js` authorities to fall back to `.` unless the command first proves it is running from the atomic-skills checkout; otherwise stop with a runtime-resolution error. Update the skill-body guard test to reject unconditional `|| echo .` script fallbacks in consumer-executed flows.

**Confidence:** high

## Questions (non-findings)

- _(none)_

## Out of scope

- Archived review transcript snippets under `.atomic-skills/reviews/` were not treated as evidence without independent proof in current changed code.

## Pass 2 reconciliation

### Dropped from blind pass

- F-002-blind [major] error handling — DROPPED: the external constraint makes malformed present dispatch telemetry deliberately fail-closed when the sidecar exists, so throwing from `readDispatchActuals`/`appendCompletion` is intentional.
- F-003-blind [major] verification — DROPPED: the external constraint binds `verify-aideck-consumer --smoke` to PASS-with-warning for partial refresh failures, so exit 0 on `indexErrors`/`seriesError` is intentional.

### Maintained

- F-001-blind → F-001-final [major] — same

### Emerged

- F-002-final [major] runtime isolation — emerged: the package-root constraint explicitly states the current `|| echo .` shell expression does not verify that `cwd` is the atomic-skills checkout, and the changed materialization flow still relies on that unchecked fallback for a mutating authority.
