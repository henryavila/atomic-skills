---
date: 2026-07-14T15:30:28-03:00
topic: integrity-remediation-f0-phase-97d50e1-r18
artifact: b2a845a5d7e832c88622cb21c89aff6ee33927e1..97d50e10e59b7c60a7472b0b2682d5feebb50146
skill: review-code
reviewer: gpt-5-codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 3, minor: 0, nit: 0}
framing_delta: {dropped: 4, maintained: 0, emerged: 1}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F0 phase 97d50e1 r18

## Capture manifest

- Ref: b2a845a5d7e832c88622cb21c89aff6ee33927e1..97d50e10e59b7c60a7472b0b2682d5feebb50146
- Captured diff: 5,485,148 bytes / 118,240 lines / 93 files
- SHA-256: 53c647f18c44ccca1f57a078a81dfe10ba7e5319b405dc4c4dfd631cc117409a
- Patch id: 6a341b31056e821c087166cf55a9811cee03ddb8
- Raw Pass 1 SHA-256: c06cb867ee2f58e42fe5dfd733d7fa47b640408d4d1ceae914983945e5256695
- Raw Pass 2 SHA-256: aad2472df8eb334e20fd04070f4d3926c1ba1992b6e821b58142c0909d7a4d33
- Mode: codex; model override: codex-auto-review; reasoning: high; sandbox: read-only
- Worktree was clean before capture and remained read-only during both passes.

## Structural validation

- Pass 1: frontmatter, verdict, counts, pass id, four findings and mandatory fields validated.
- Pass 2: frontmatter, verdict, counts, reconciliation headers and one final finding validated.
- Reconciliation: all four blind findings dropped under the informed contracts; one same-root registration-authority finding emerged.

## Operator scope triage

- Blind F-001 critical — dropped. Markerless source checkout is an explicit compatibility path after package identity and required entrypoint proof; arbitrary consumers still fail closed.
- Blind F-002 major — dropped. User CLI paths are intentionally invocation-CWD-relative or absolute, with no repository-confinement contract.
- Blind F-003 major — dropped. Materialization candidates are caller-owned read-only inputs and may intentionally live outside the repository.
- Blind F-004 major — dropped. Present malformed dispatch telemetry intentionally fails closed; silent degradation would violate the ratified authority contract.
- Final F-001 major — validated and fixed. Both shell registration blocks now accept a collision-resolved id only when the returned root resolves to the current repository, retain legacy compatibility for a same-id response without rootDir, and disable the browser flow on a conflicting returned root.
- Delegated decisions: preserve the four ratified informed constraints; fail closed on explicit root conflict; keep only the narrow legacy same-id/no-root compatibility.
- Remaining substantive count after remediation at `03131d1`: zero blocker, zero critical, zero major, zero minor. A fresh clean-checkpoint review remains required for phase approval.

## Remediation evidence

- RED: `tests/project.test.js` collected 73 tests, with 72 passing and the new conflicting-root regression failing.
- GREEN: the same focused file passed 73/73 after remediation.
- Integrated project/serve/install-uninstall set: 110/110 tests passed.
- Installed runtime closure: 7/7 tests passed.
- Skill catalog validation: all 15 skills valid at schema version 0.2.
- Diff check was clean before the remediation commit.

## Pass 1 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The diff improves runtime self-containment, but three of the new trust boundaries are still bypassable. The highest-risk issue is the new “trusted package runtime” fallback in the skill bodies: when the install marker is absent, the flow trusts `$PWD` based only on `package.json.name` and one script path, which lets a consumer repo impersonate the package and get its own code executed as the “trusted” runtime.

The new installed entrypoints also accept filesystem paths that are documented as consumer-relative but are not actually confined to the consumer repo, and the materialization authority separately bypasses its own path-hardening for candidate files. A separate availability regression makes `task-done` completion emission fail hard on malformed dispatch telemetry instead of degrading without actuals.

## Findings

### F-001 [critical] security — skills/core/project.md:23-31

**Evidence:**
```md
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || true)"
if [ -z "$PKG_ROOT" ]; then
  CANDIDATE="$PWD"
  if node -e 'try { const pkg=JSON.parse(require("node:fs").readFileSync(process.argv[1])); process.exit(pkg.name === "@henryavila/atomic-skills" ? 0 : 1); } catch { process.exit(1); }' \
    "$CANDIDATE/package.json" 2>/dev/null && [ -f "$CANDIDATE/scripts/detect-completion.js" ]; then
    PKG_ROOT="$CANDIDATE"
```

**Claim:** The new “trusted runtime” fallback trusts any current working tree that spoofs `@henryavila/atomic-skills` and contains the expected script, so missing/unreadable install markers redirect high-stakes flows to repo-owned code.

**Impact:** A malicious or misconfigured consumer repository can hijack `project`, `new plan`, and `materialize` flows into executing arbitrary local scripts with the user’s permissions while the agent believes it is using the package runtime.

**Recommendation:** Remove the `$PWD` fallback, or replace it with provenance stronger than package-name equality (for example, resolve the installed package from `node_modules` and realpath-match it against the marker, otherwise fail closed).

**Confidence:** high

---

### F-002 [major] security — src/runtime-paths.js:14-20

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

```js
const planDir = resolveConsumerPath(planDirArg)
...
addPlanDependency(planDir, dependency)
```

```js
const sourcePath = resolveConsumerPath(option(options, '--source', { required: true }))
...
: readFileSync(resolveConsumerPath(businessIntentFile), 'utf8')
```

```js
const signalsPath = resolveConsumerPath(option(options, '--signals', { required: true }))
```

**Claim:** `resolveConsumerPath` does not reject absolute or escaping paths, and the new installed entrypoints feed user-supplied `--source`, `--signals`, and plan-directory arguments directly into it.

**Impact:** `plan-dependencies.js` can write outside the consumer repo, while `decompose-plan.js` and `bootstrap-project.js` can read arbitrary host files via `..` or absolute paths instead of staying inside the intended consumer workspace.

**Recommendation:** Replace this helper with `safeRelativePath`-style confinement that rejects absolute/escaping inputs, and add layout checks for write-capable commands so they only touch the expected `.atomic-skills/projects/...` targets.

**Confidence:** high

---

### F-003 [major] security — scripts/materialize-state.js:733-740

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

```js
const planRel = safeRelativePath(absoluteRoot, planPath, 'planPath');
const initiativeRel = safeRelativePath(absoluteRoot, initiativePath, 'initiativePath');
validateMaterializationTopology(planRel, initiativeRel);
assertNoSymlinkComponents(absoluteRoot, planRel, 'planPath');
assertNoSymlinkComponents(absoluteRoot, initiativeRel, 'initiativePath');
```

**Claim:** The materialization authority hardens live plan/initiative paths but bypasses the same confinement for `--plan-candidate` and `--initiative-candidate`.

**Impact:** A caller can source staged transaction bytes from arbitrary files outside the repo and publish them into `.atomic-skills` state, defeating the containment guarantees the transaction code otherwise enforces.

**Recommendation:** Apply the same relative-path and symlink validation to candidate-path arguments, or only accept inline content / temp files created under the transaction directory.

**Confidence:** high

---

### F-004 [major] error_handling — scripts/append-completion.js:251-255

**Evidence:**
```js
export function readDispatchActuals(root, { planSlug, phaseId, taskId } = {}) {
  if (!hasText(taskId)) return undefined;
  const path = join(resolve(root), '.atomic-skills', 'status', 'dispatch-log.json');
  if (!existsSync(path)) return undefined;
  const log = parseDispatchLog(readFileSync(path, 'utf8'), { source: path });
```

```js
export function appendCompletion(root, entry) {
  let effectiveEntry = entry;
  if (entry && entry.event === 'task-done' && entry.actuals == null) {
    const derived = readDispatchActuals(root, {
      planSlug: entry.planSlug, phaseId: entry.phaseId, taskId: entry.taskId,
    });
```

**Claim:** Optional dispatch telemetry now throws through `appendCompletion` on malformed `dispatch-log.json`, with no fallback path for writing the completion record without derived actuals.

**Impact:** One truncated or malformed dispatch-log line can stop later `task-done` completion events from being appended, breaking earned-value analytics and potentially any transition flow that treats completion emission as part of success.

**Recommendation:** Keep strict parsing for explicit diagnostics, but catch `readDispatchActuals` failures inside `appendCompletion`, surface the telemetry error, and continue writing the completion event without `actuals`.

**Confidence:** medium

## Questions (non-findings)

- None.

## Out of scope

- Archived review transcript prose was treated as audit history, not as executable source.

## Pass 2 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The external constraints eliminate the four blind-pass findings: the source-checkout fallback is an allowed compatibility path, consumer CLI paths are intentionally CWD-relative or absolute, materialization candidates may intentionally live outside the repo, and malformed dispatch telemetry is required to fail closed.

One changed runtime path still violates the stated F0 contract. The resident `project-view.md` shell flow accepts any syntactically valid `project.projectId` returned by aiDeck registration and never verifies `project.rootDir`, even though the returned id is only authoritative when aiDeck proves it still belongs to the current repo. That can redirect `status --browser` to another repo’s registered project data.

## Findings

### F-001 [major] correctness — skills/shared/project-assets/project-view.md:183-194

**Evidence:**
```md
             registration=$(curl -sf -X POST "$url/api/projects/register" \
               -H 'Content-Type: application/json' \
               -d "{\"rootDir\":\"$PWD\",\"projectId\":\"$pid\"}" 2>/dev/null)
             registered_pid=$(printf '%s' "$registration" | node -e '
               let s=""; process.stdin.on("data", d => s += d).on("end", () => {
                 try { const id = JSON.parse(s)?.project?.projectId;
                   if (typeof id === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(id)) process.stdout.write(id);
                 } catch (_) {}
               });
             ' 2>/dev/null)
             [ -n "$registered_pid" ] && pid="$registered_pid"
             AIDECK_URL="$url"
```

**Claim:** The shell-side aiDeck registration flow makes any valid returned `projectId` authoritative without checking `project.rootDir`, so it can switch the dashboard probe to a registration that belongs to another repo.

**Impact:** When aiDeck returns a collision-resolved or stale `projectId` for a different root, `status --browser` can probe `/api/consumers/atomic-skills/projects/$pid/data/...` for the wrong project and open another repo’s dashboard state instead of failing closed.

**Recommendation:** Parse both `project.projectId` and `project.rootDir` in both registration blocks. Accept an unchanged id when `rootDir` is absent for legacy compatibility, but accept a different returned id only when the returned `rootDir` resolves to `$PWD`; otherwise abort the browser flow. Add a regression in `tests/project.test.js` for a conflicting returned `rootDir`.

**Confidence:** high

---

## Questions (non-findings)

- _(none)_

## Out of scope

- Archived `.atomic-skills/reviews/*` transcripts were treated as historical audit artifacts, not executable evidence.

## Pass 2 reconciliation

### Dropped from blind pass

- F-001-blind [critical] security — DROPPED: the external constraint explicitly allows the markerless source-checkout fallback after package-identity and entrypoint proof, and states arbitrary consumers fail closed.
- F-002-blind [major] security — DROPPED: the external constraint states user-supplied CLI paths are intentionally relative to invocation CWD or absolute, with no repo-containment contract.
- F-003-blind [major] security — DROPPED: the external constraint states materialization candidate paths are caller-owned read-only inputs and may intentionally live outside the repository.
- F-004-blind [major] error_handling — DROPPED: the external constraint requires malformed present dispatch telemetry to fail closed rather than degrading silently.

### Maintained

- _(none)_

### Emerged

- F-001-final [major] correctness — emerged: the external constraint makes aiDeck’s returned `projectId` authoritative only when `project.rootDir` resolves to the current repo, which exposed that `project-view.md` never checks the returned `rootDir`.

<!-- end raw Pass 2 output -->
