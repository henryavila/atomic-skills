---
date: 2026-07-14T16:29:03-03:00
topic: integrity-remediation-f0-phase-0ce031d-r21
artifact: b2a845a5d7e832c88622cb21c89aff6ee33927e1..0ce031d2cebe0a5059a388e99ff6df5432aec4eb
skill: review-code
reviewer: gpt-5-codex
mode: both
codex_version: 0.144.3
final_verdict: approve
counts_final: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
framing_delta: {dropped: 2, maintained: 0, emerged: 0}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F0 phase 0ce031d r21

## Capture manifest

- Ref: b2a845a5d7e832c88622cb21c89aff6ee33927e1..0ce031d2cebe0a5059a388e99ff6df5432aec4eb
- Captured diff: 5,544,627 bytes / 119,381 lines / 96 files
- SHA-256: 8d6ba853b3e38a85ad6b362ecc750d0391d97d94519287fee794786c9d49f5b8
- Patch id: c16e7c8c1b510c1bf859cff73ecce8683b669deb
- Raw Pass 1 SHA-256: 77d0fede3fa53ee933f73abc8d02af92a4eb223dc2fa035c0d5ed4fa76f36e56
- Raw Pass 2 SHA-256: af61f9be896e6891d74de74c6584d93b910cb3368769ed77e7c16fb401fb0e35
- Mode: both; Codex model override: codex-auto-review; reasoning: high; sandbox: read-only
- Worktree was clean before capture and remained read-only during both passes.

## Structural validation

- Pass 1: frontmatter, verdict, counts, pass id and both findings validated.
- Pass 2: frontmatter, approval verdict, zero counts and reconciliation headers validated.
- Reconciliation: both blind findings dropped; none maintained or emerged.

## Operator scope triage

- Blind F-001 major — dropped. Malformed present dispatch telemetry intentionally fails closed; the canonical `done` flow emits completion before refreshed task state is saved.
- Blind F-002 major — dropped. The installed status-browser contract intentionally uses the staged `.mjs` launcher and staged dashboard; direct executable and bundled-client fallbacks belong to `src/serve.js`.
- Delegated decision: preserve both explicit, previously ratified contracts. Neither blind finding identifies a regression under the informed constraints.
- Remaining substantive count at reviewed HEAD `0ce031d`: zero blocker, zero critical, zero major, zero minor. The informed pass approved the frozen phase diff.

## Final gate evidence

- T-006 verifier: 166/166 tests passed across 15 suites.
- F0-G1: 62/62 tests passed across 5 suites.
- F0-G2: 86/86 tests passed across 2 suites.
- Full repository suite: 1,769 passed, 0 failed, 8 skipped, 1,777 total across 186 suites; duration 23,869.49175 ms.
- Catalog/state validation: all 15 skills valid; all 166 state files and 26 plans cross-validated; `git diff --check` clean.
- Full-suite log SHA-256: 375ac7568c035a8ed4d65e34d2e4c7edde1ef1d78959844ae2d7564753b70b2b.
- The Codex read-only sandbox could not execute tests due tmpdir `EPERM`; the operator reran every closing gate on the exact reviewed clean HEAD and used those fresh results as dispositive evidence.

## Pass 1 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
Two major regressions remain in the changed runtime path. First, `task-done` completion emission now fails closed on malformed historical dispatch telemetry, so corruption in an optional sidecar can block append-only completion records. Second, the shipped `project status` browser launcher has drifted from `src/serve.js`: it still hardcodes `node "$AIDECK_BIN"` and requires a staged dashboard directory, so supported aiDeck launch configurations no longer work through the main user-facing path.

These are behavioral regressions, not style issues. The completion path needs to recover gracefully from unrelated telemetry damage, and the dashboard launcher needs to reuse or faithfully mirror the actual runtime contract before this should be approved.

## Findings

### F-001 [major] rollback/observability — scripts/append-completion.js:248-255

**Evidence:**
```js
 * `undefined` when the file is absent or no record matches (plan+phase+taskId).
 * Malformed present input throws with its physical line; missing Mode-1 telemetry
 * remains graceful and is not an error.
 */
export function readDispatchActuals(root, { planSlug, phaseId, taskId } = {}) {
  if (!hasText(taskId)) return undefined;
  const path = join(resolve(root), '.atomic-skills', 'status', 'dispatch-log.json');
  if (!existsSync(path)) return undefined;
  const log = parseDispatchLog(readFileSync(path, 'utf8'), { source: path });
```

**Claim:** A malformed historical line anywhere in `.atomic-skills/status/dispatch-log.json` now throws out of `readDispatchActuals()`, and `appendCompletion()` auto-invokes that helper for `task-done`, turning optional telemetry enrichment into a hard failure.

**Impact:** The current `done` flow closes the task before it emits the completion event, so corrupt dispatch telemetry can leave task state mutated without the append-only `task-done` record or the downstream analytics/checkpoint behavior that depends on that event.

**Recommendation:** Catch `readDispatchActuals()` failures inside `appendCompletion()` and degrade to “no derived actuals”, or move completion emission ahead of task-state mutation and add rollback if emission fails.

**Confidence:** high

---

### F-002 [major] compatibility/runtime — skills/shared/project-assets/project-view.md:220-221

**Evidence:**
```bash
if [ -z "$AIDECK_URL" ] && [ -z "$REGISTRATION_CONFLICT" ] && [ -f "$AIDECK_BIN" ] && [ -d "$DASHBOARD_DIR" ]; then
  nohup node "$AIDECK_BIN" serve --static-dir "$DASHBOARD_DIR" >/dev/null 2>&1 &
```

**Claim:** The primary `status`/`status --browser` launcher still assumes `AIDECK_BIN` is a JavaScript file on disk and that a staged dashboard directory must exist, which no longer matches the supported `src/serve.js` contract.

**Impact:** The main user-facing dashboard path breaks for supported executable overrides (the code and tests now allow direct executables) and for installs where `~/.atomic-skills/dashboard` is absent even though `serve.js` can fall back to aiDeck’s bundled client.

**Recommendation:** Stop duplicating the launch logic here; route through the existing JS helper, or mirror `src/serve.js` exactly by detecting JS-vs-executable launchers and making `--static-dir` conditional instead of hard-required.

**Confidence:** high

---

## Questions (non-findings)


## Out of scope

<!-- end raw Pass 1 output -->

## Pass 2 output

---
verdict: approve
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
No findings remain after applying the stated external constraints to the frozen diff and current changed files.

## Findings


## Questions (non-findings)

- _(none)_

## Out of scope

- Test execution in this session was environment-limited by read-only sandbox/tmpdir `EPERM` failures, so it was not used as dispositive evidence.

## Pass 2 reconciliation

### Dropped from blind pass

- F-001-blind [major] rollback/observability — DROPPED: the external constraints explicitly make malformed present dispatch telemetry fail closed by contract, and the current `done` flow in `skills/shared/project-assets/project-transitions.md` emits completion before refreshed task state is saved.
- F-002-blind [major] compatibility/runtime — DROPPED: the external constraints define `status --browser` around the installed `.mjs` launcher plus staged dashboard, while direct-executable and bundled-client fallback is only required on `src/serve.js`, so the cited asymmetry is not a regression in this phase.

### Maintained

- _(none)_

### Emerged

- _(none)_<!-- end raw Pass 2 output -->
