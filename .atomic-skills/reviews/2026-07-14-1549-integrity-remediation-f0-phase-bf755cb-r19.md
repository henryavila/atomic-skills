---
date: 2026-07-14T15:49:28-03:00
topic: integrity-remediation-f0-phase-bf755cb-r19
artifact: b2a845a5d7e832c88622cb21c89aff6ee33927e1..bf755cbb77811de9e6d417bf070dd49cdb5e2651
skill: review-code
reviewer: gpt-5-codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
framing_delta: {dropped: 3, maintained: 0, emerged: 1}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F0 phase bf755cb r19

## Capture manifest

- Ref: b2a845a5d7e832c88622cb21c89aff6ee33927e1..bf755cbb77811de9e6d417bf070dd49cdb5e2651
- Captured diff: 5,505,232 bytes / 118,605 lines / 94 files
- SHA-256: 57a7d0a8a5e5b43698fc4067a829803a542b93b7e7c2ea7d01eb48ed9d8d0630
- Patch id: 00279ca922e859aaec8a3ffb2a97c7971b8440d2
- Raw Pass 1 SHA-256: f4cc8f35cacec0692beb0759100691c16af530ede8e46a39504b7253f4445ed2
- Raw Pass 2 SHA-256: adef59f696382ed31efbbd2e6414ea8cb3c7789b46a95f79cbaca76bf9f4b8d1
- Mode: codex; model override: codex-auto-review; reasoning: high; sandbox: read-only
- Worktree was clean before capture and remained read-only during both passes.

## Structural validation

- Pass 1: frontmatter, verdict, counts, pass id, three findings and mandatory fields validated.
- Pass 2: frontmatter, verdict, counts, reconciliation headers and one final finding validated.
- Reconciliation: all three blind findings dropped under the informed contracts; one canonical root-identity finding emerged.

## Operator scope triage

- Blind F-001 major — dropped. Consumer CLI paths intentionally resolve from invocation CWD or remain absolute; repository confinement is not the F0 contract.
- Blind F-002 major — dropped. Present malformed dispatch telemetry intentionally fails closed instead of silently omitting actuals.
- Blind F-003 major — dropped. The markerless exception is intentionally narrow; `brainstorm` is an installed artifact and requires the package-root marker.
- Final F-001 major — validated and fixed. Registration root identity now uses canonical filesystem paths in both `serve.js` and the shell browser recipe, accepting symlink aliases of the same repository while preserving fail-closed behavior for missing or conflicting roots.
- Delegated decisions: preserve the three ratified contracts; canonicalize the root proof across both clients rather than patching only the reviewed JavaScript path.
- Remaining substantive count after remediation at `e95550d`: zero blocker, zero critical, zero major, zero minor. A fresh clean-checkpoint review remains required for phase approval.

## Remediation evidence

- RED: the focused project/serve set collected 100 tests, with 98 passing and both canonical-alias regressions failing.
- GREEN: the same focused set passed 100/100 after remediation.
- Integrated project/serve/install-uninstall set: 112/112 tests passed.
- Installed runtime closure: 7/7 tests passed.
- Skill catalog validation: all 15 skills valid at schema version 0.2.
- Diff check was clean before the remediation commit.

## Pass 1 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The diff introduces three substantive regressions on the executable surface. First, the new shared runtime-path helper does not enforce the “inside the consumer repo” boundary it claims to provide, so installed entrypoints can now read or mutate paths outside the working repository. Second, `append-completion` now lets malformed optional dispatch telemetry abort `task-done` completion writes, turning a sidecar parse problem into a lifecycle blocker. Third, the new package-root hardening in `brainstorm` breaks the documented source-checkout workflow that `project new plan` depends on.

These are correctness and compatibility issues, not style concerns. The path-boundary and completion-blocking regressions need code changes; the `brainstorm` regression needs either a verified checkout fallback or a caller-side redesign so plan creation still works from an uninstalled source tree.

## Findings

### F-001 [major] security — src/runtime-paths.js:15-19

**Evidence:**
```js
export function resolveConsumerPath(input, cwd = process.cwd()) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('consumer path must be a non-empty string')
  }
  return resolve(cwd, input)
}
```

**Claim:** `resolveConsumerPath()` does not enforce the consumer-repo boundary it documents, so `../` and absolute paths escape the repo and are then used by mutating entrypoints such as `scripts/plan-dependencies.js:18-25`.

**Impact:** An installed command can be pointed at arbitrary filesystem locations outside the current repository and will read or rewrite those files as if they were in-repo state, which is a path-traversal regression for both automation and interactive use.

**Recommendation:** Reject any resolved path whose `relative(cwd, resolved)` is `..`, starts with `../`, or re-resolves outside `cwd`, and add end-to-end tests that `decompose-plan`/`plan-dependencies` refuse `../` escapes.

**Confidence:** high

---

### F-002 [major] error_handling — scripts/append-completion.js:352-358

**Evidence:**
```js
export function appendCompletion(root, entry) {
  let effectiveEntry = entry;
  if (entry && entry.event === 'task-done' && entry.actuals == null) {
    const derived = readDispatchActuals(root, {
      planSlug: entry.planSlug, phaseId: entry.phaseId, taskId: entry.taskId,
    });
    if (derived !== undefined) effectiveEntry = { ...entry, actuals: derived };
  }
```

**Claim:** `appendCompletion()` now calls `readDispatchActuals()` without a guard even though `readDispatchActuals()` was changed to throw on malformed present input (`scripts/append-completion.js:243-255`), so a bad optional `dispatch-log.json` aborts `task-done` completion writes.

**Impact:** One malformed telemetry line in `.atomic-skills/status/dispatch-log.json` can block `done`/`reconcile` flows from appending completion events, leaving task state transitions stuck behind corruption in a non-authoritative sidecar.

**Recommendation:** Catch `readDispatchActuals()` failures inside `appendCompletion()` and degrade to “no actuals” while surfacing a warning, preserving the completion write path; add a regression test that malformed dispatch telemetry does not prevent `appendCompletion()` from writing a valid record.

**Confidence:** high

---

### F-003 [major] compatibility — skills/core/brainstorm.md:11-17

**Evidence:**
```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null)" || {
  echo "atomic-skills package root unavailable; reinstall atomic-skills" >&2
  exit 1
}
[ -f "$PKG_ROOT/scripts/lint-design.js" ] || {
  echo "atomic-skills package root is stale: missing scripts/lint-design.js" >&2
  exit 1
}
```

**Claim:** `atomic-skills:brainstorm` now hard-fails when the install marker is absent, but `project new plan` explicitly delegates Stage 2 to `atomic-skills:brainstorm` (`skills/shared/project-assets/project-create-plan.md:72`), so plan bootstrap no longer works from an uninstalled source checkout.

**Impact:** Contributors and dogfood sessions running from this repo’s checkout cannot execute the documented `project new plan` flow unless they first perform an install that writes `~/.atomic-skills/package-root`, despite the checkout already containing the needed scripts and other flows now supporting a verified source-root fallback.

**Recommendation:** Reuse the same verified source-checkout fallback already implemented in `skills/core/project.md` / `project-create-plan.md` for `brainstorm` (and the matching pattern in the other core skills that adopted this hard fail), then add a checkout-mode test that `project new plan` can reach Stage 2 without a preexisting install marker.

**Confidence:** high

---

## Questions (non-findings)

- None.

## Out of scope

- Archived review transcript prose under `.atomic-skills/reviews/`; I treated those as audit artifacts, not executable truth sources.
<!-- end raw Pass 1 output -->

## Pass 2 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
After applying the stated F0 constraints, the three blind-pass findings do not stand: cwd-relative consumer paths are intentional, malformed present dispatch telemetry is specified to fail closed, and `brainstorm` is not required to run from an uninstalled checkout. One compatibility regression remains in the aiDeck registration path.

The new root-identity check accepts a returned `rootDir` only when the two strings match after `path.resolve()`. That is weaker than the documented contract that a returned `rootDir` is authoritative when it resolves to the current repo: canonical and aliased paths to the same repository diverge under symlinks, mounted worktrees, and similar real deployments.

## Findings

### F-001 [major] compatibility — src/serve.js:299-339

**Evidence:**
```js
function sameResolvedPath(a, b) {
  try {
    return resolve(a) === resolve(b)
  } catch {
    return false
  }
}

async function ensureProjectRegistration(baseUrl, rootDir) {
  const projectId = resolveRegisteredProjectId(rootDir)
  const first = await postProjectRegistration(baseUrl, rootDir, projectId)
  if (first.status !== 'ok') return first.status

  const registered = first.project?.projectId
  if (!registered) return 'ok'
  const registeredRoot = first.project?.rootDir
  if (registered === projectId) {
    return !registeredRoot || sameResolvedPath(registeredRoot, rootDir) ? 'ok' : 'failed'
  }

  // aiDeck may resolve a project-id collision by returning a different stable
  // id. That response is authoritative only when it still identifies this root.
  return registeredRoot && sameResolvedPath(registeredRoot, rootDir) ? 'ok' : 'failed'
}
```

**Claim:** The returned aiDeck `rootDir` is validated with lexical `resolve()` equality instead of canonical filesystem identity, so the same repository is rejected when one side is a symlinked or aliased path.

**Impact:** `atomic-skills serve` can fail closed against a valid same-repo registration, including collision-resolved ids, when the workspace is opened through a symlink, bind mount, or worktree alias. In that state the dashboard flow becomes unavailable even though aiDeck registered the correct repository.

**Recommendation:** Canonicalize both paths before comparison with `realpathSync` (or equivalent filesystem identity checks), and add a regression test where `process.cwd()` is a symlinked alias of the repo while aiDeck returns the canonical `rootDir`.

**Confidence:** high

---

## Questions (non-findings)

- _(none)_

## Out of scope

- Historical transcript content under `.atomic-skills/reviews/` was treated as audit material only, not as executable truth.

## Pass 2 reconciliation

### Dropped from blind pass

- F-001-blind [major] security — DROPPED: the external constraints explicitly state user-supplied CLI paths are intentionally relative to invocation `cwd` (or absolute), so repo-root containment is not the F0 contract.
- F-002-blind [major] error_handling — DROPPED: the external constraints explicitly require malformed present dispatch telemetry to fail closed rather than degrade to “no actuals”.
- F-003-blind [major] compatibility — DROPPED: the external constraints explicitly limit markerless source-checkout fallback to the resident `project` router; `brainstorm` is an installed artifact that must fail closed without the package-root marker.

### Maintained

- _(none)_

### Emerged

- F-001-final [major] compatibility — emerged: the external aiDeck contract says a returned `rootDir` is authoritative when it resolves to the current repo, which exposed that the implementation compares only `resolve()` strings and rejects canonical/symlink aliases of the same repository.

<!-- end raw Pass 2 output -->
