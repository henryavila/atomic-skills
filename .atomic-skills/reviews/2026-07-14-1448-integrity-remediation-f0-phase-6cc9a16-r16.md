---
date: 2026-07-14T14:48:52-03:00
topic: integrity-remediation-f0-phase-6cc9a16-r16
artifact: b2a845a5d7e832c88622cb21c89aff6ee33927e1..6cc9a16333dcd4b8154c3f6b663cb894795e13f0
skill: review-code
reviewer: gpt-5-codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 1, minor: 1, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
framing_delta: {dropped: 3, maintained: 0, emerged: 2}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F0 phase 6cc9a16 r16

## Capture manifest

- Ref: b2a845a5d7e832c88622cb21c89aff6ee33927e1..6cc9a16333dcd4b8154c3f6b663cb894795e13f0
- Captured diff: 5,447,403 bytes / 117,565 lines / 90 files
- SHA-256: cd2f0c3ecebf4d6ce2e12994f48ca4f142ef6917aaeae7eb2d2bbcc5135f505d
- Patch id: 431df1bbfac3c1f5dfa66c24056626819fd87014
- Raw Pass 1 SHA-256: f6f66b88b03769318b780fa1b851ed586df15c5c22503b47194a0044d0b2a18f
- Raw Pass 2 SHA-256: 16736e0ea4676bf793af9f725d675302243b97063b2cf9beab23827989e1b4f3
- Mode: codex; model override: codex-auto-review; reasoning: high; sandbox: read-only
- Worktree was clean before capture and remained read-only during both passes.

## Structural validation

- Pass 1: frontmatter, verdict, counts, pass id, three findings and mandatory fields validated.
- Pass 2: frontmatter, verdict, counts, reconciliation headers and two final findings validated.
- Reconciliation: all three blind findings dropped and two findings emerged from the portable temporary-file constraint.

## Operator scope triage

- Blind F-001 major — dropped. Candidate paths are caller-owned read-only inputs and deliberately may live outside the managed root; managed destination paths remain contained and symlink-checked.
- Blind F-002 major — dropped. Consumer CLI paths are intentionally invocation-CWD-relative or absolute, not implicitly Git-root-relative.
- Blind F-003 major — dropped. Malformed present dispatch telemetry is deliberately fail-closed by the ratified F0 contract.
- Final F-001 major/F-002 minor — validated and fixed. Both flows now allocate a mode-600 file with a terminal random X run under `TMPDIR` (or `/tmp`), and the regression executes both allocation blocks before both materialization blocks.
- Delegated decisions: keep caller-owned input and CWD contracts unchanged; retain fail-closed telemetry; remove the unnecessary `.json` suffix instead of introducing a temp-directory abstraction; require two distinct existing randomized paths and cleanup.
- Remaining substantive count after remediation at `15a6dde`: zero blocker, zero critical, zero major, zero minor. A fresh clean-checkpoint review remains required for phase approval.

## Remediation evidence

- RED: the focused consumer-runtime suite collected seven tests, with six passing and the allocation regression failing on the literal `XXXXXXXX` path.
- GREEN: the same focused suite passed 7/7 after remediation.
- Integrated runtime/render/parity set: 97/97 tests passed across consumer resolution, project rendering, runtime closure, and install/uninstall parity.
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
The changed runtime surface still has three substantive correctness/security gaps. Two are path-boundary regressions in the new installed entrypoints and materialization authority: one breaks repository-relative resolution whenever the command is launched from a subdirectory, and one bypasses the transaction script’s own root/symlink hardening for candidate inputs. The third turns a non-authoritative dispatch sidecar into a hard blocker for `task-done` completion writes.

These are merge-blocking because they affect the newly introduced installed-runtime flows directly: the public CLIs can target the wrong files, `materialize-state` can ingest bytes from outside the managed repo, and a malformed dispatch log can stop `done`/`reconcile` from emitting completion events at all.

## Findings

### F-001 [major] security — scripts/materialize-state.js:733-740

**Evidence:**
```js
    const candidatePlanContent = typeof planContent === 'string'
      ? planContent
      : (planCandidatePath ? readFileSync(resolve(absoluteRoot, planCandidatePath), 'utf8') : undefined);
    const candidateInitiativeContent = typeof initiativeContent === 'string'
      ? initiativeContent
      : (initiativeCandidatePath
        ? readFileSync(resolve(absoluteRoot, initiativeCandidatePath), 'utf8')
        : undefined);
```

**Claim:** `materializeState()` reads `--plan-candidate` and `--initiative-candidate` with raw `resolve(...)`, so candidate files are not constrained by `safeRelativePath()` or `assertNoSymlinkComponents()` even though the live paths, marker, lock, and tx dir are.

**Impact:** The documented `materialize-state` authority can ingest arbitrary files outside the managed repo root, including absolute paths and `../` escapes, and publish their bytes into trusted state. That breaks the repo-isolation boundary this transaction code is otherwise explicitly enforcing.

**Recommendation:** Validate both candidate paths with the same root/symlink checks used for `planPath` and `initiativePath` before reading them. Reject absolute paths and escapes unless the contract is explicitly widened and audited.

**Confidence:** high

---

### F-002 [major] compatibility — src/runtime-paths.js:14-19

**Evidence:**
```js
/** Resolve a user-supplied path relative to the consuming repository. */
export function resolveConsumerPath(input, cwd = process.cwd()) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('consumer path must be a non-empty string')
  }
  return resolve(cwd, input)
}
```

**Claim:** The helper claims to resolve paths relative to the consuming repository, but it actually resolves them relative to the current process directory, and the new installed CLIs call it for `--source`, `--signals`, and dependent plan paths.

**Impact:** Launching the new entrypoints from any subdirectory of a repo silently points them at the wrong files or nonexistent paths. For example, `decompose-plan`, `bootstrap-project`, and `plan-dependencies` all become cwd-sensitive instead of repo-root-sensitive, so the installed runtime is not location-independent inside the consumer repo.

**Recommendation:** Resolve against an explicit repo root, not `process.cwd()`. Either require/pass a `--root` for these commands or derive the worktree root (`git rev-parse --show-toplevel`) before joining user-relative paths.

**Confidence:** high

---

### F-003 [major] error handling — scripts/append-completion.js:352-358

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

**Claim:** Every `task-done` completion without explicit `actuals` now propagates `readDispatchActuals()` failures, so a malformed `.atomic-skills/status/dispatch-log.json` aborts the completion write instead of degrading to “no derived actuals”.

**Impact:** A single bad line in the merge-unioned dispatch sidecar can block `done`/`reconcile` from emitting `task-done` events, which in turn prevents normal phase progression in Mode-2 worktrees even though the sidecar is auxiliary telemetry rather than canonical state.

**Recommendation:** Catch parse/validation failures at the `appendCompletion()` call site and fall back to writing the completion event without derived dispatch actuals, while surfacing the telemetry corruption separately.

**Confidence:** medium

## Questions (non-findings)

- None.

## Out of scope

- Archived review transcript content beyond locating current-source context.

## Pass 2 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 1, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
After applying the explicit F0 contracts, the three blind-pass findings do not stand: external materialization candidates are intentionally allowed outside the repo, consumer CLI paths are intentionally CWD-relative, and dispatch-log parsing is intentionally fail-closed.

One substantive defect remains in the changed surface: both documented `create-plan` materialization flows use a `mktemp` template that is not actually unpredictable on the stated macOS/BSD host, which collapses the temp-file isolation the prose requires. The current regression test also skips that allocation block entirely, so this contract is not protected.

## Findings

### F-001 [major] security — skills/shared/project-assets/project-create-plan.md:175-176

**Evidence:**
```md
```bash
BUSINESS_INTENT_FILE="$(mktemp /tmp/atomic-skills-business-intent.XXXXXXXX.json)" || exit 1
printf '%s\n' "$BUSINESS_INTENT_FILE"
```

```bash
BUSINESS_INTENT_FILE="$(mktemp /tmp/atomic-skills-business-intent.XXXXXXXX.json)" || exit 1
printf '%s\n' "$BUSINESS_INTENT_FILE"
```
```

**Claim:** Both the new-plan and adopt materialization recipes use a `mktemp` pattern whose `X` run is not terminal, so on the stated macOS/BSD host it produces a predictable literal path instead of an unpredictable temp file.

**Impact:** The two public flows can collide on the same `/tmp/atomic-skills-business-intent.XXXXXXXX.json` path, and the gap between “allocate path” and the later `{{WRITE_TOOL}}` write lets another local process or concurrent invocation replace or reuse that file. That can inject the wrong `businessIntent`, leak user-authored content, or make one capture fail spuriously.

**Recommendation:** Replace this with a BSD/GNU-safe allocation pattern that keeps the random `X` suffix terminal, such as allocating a temp directory with `mktemp -d /tmp/atomic-skills-business-intent.XXXXXXXX` and writing `business-intent.json` inside it, then clean up the directory on both success and failure.

**Confidence:** high

---

### F-002 [minor] tests — tests/consumer-runtime-resolution.test.js:228-230

**Evidence:**
```js
const recipes = [...createPlan.matchAll(
  /```bash\n[ \t]*(BUSINESS_INTENT_FILE="<exact-path-printed-above>"[\s\S]*?)\n[ \t]*```/g
)].map((match) => match[1])
```

**Claim:** The regression test only extracts the second fenced recipe block that starts after temp-path allocation, so it never executes or validates the broken `mktemp` command documented in `project-create-plan.md`.

**Impact:** The portability and isolation contract for temp-file allocation is currently untested, which is why the macOS/BSD `mktemp` regression ships while the “recipe execution” test still passes.

**Recommendation:** Extend the test to execute or directly validate the actual allocation snippet as documented, and assert that the produced path is randomized, does not contain the literal `XXXXXXXX`, and is cleaned up correctly on supported BSD/GNU shells.

**Confidence:** high

## Questions (non-findings)

- _(none)_

## Out of scope

- Archived `.atomic-skills/reviews/*.md` transcript content except where current changed executable/test files independently proved a defect.

## Pass 2 reconciliation

### Dropped from blind pass

- F-001-blind [major] security — DROPPED: the stated contract explicitly makes `--plan-candidate` and `--initiative-candidate` caller-owned read-only inputs that may live outside the repository, so lack of repo-containment on those inputs is not a defect.
- F-002-blind [major] compatibility — DROPPED: the stated runtime contract explicitly says user-supplied CLI paths are relative to the invocation CWD (or absolute), and the installed-runtime tests inject `cwd` accordingly.
- F-003-blind [major] error handling — DROPPED: the stated telemetry contract explicitly requires present malformed `dispatch-log.json` content, or non-empty records missing routing identity, to fail closed rather than degrade silently.

### Maintained

- _(none)_

### Emerged

- F-001-final [major] security — emerged: the explicit temp-file-allocation constraint makes the `mktemp /tmp/atomic-skills-business-intent.XXXXXXXX.json` command itself a contract violation on the stated macOS/BSD host.
- F-002-final [minor] tests — emerged: the same constraint required checking the exact `mktemp` command, and the current regression test proves it only executes the post-allocation recipe block, leaving that contract untested.
