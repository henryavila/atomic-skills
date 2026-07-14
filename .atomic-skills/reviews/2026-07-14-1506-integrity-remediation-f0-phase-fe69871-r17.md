---
date: 2026-07-14T15:06:29-03:00
topic: integrity-remediation-f0-phase-fe69871-r17
artifact: b2a845a5d7e832c88622cb21c89aff6ee33927e1..fe698710fd7abad760820f8c78acfcf1b4b0f5b2
skill: review-code
reviewer: gpt-5-codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 2, minor: 2, nit: 0}
framing_delta: {dropped: 3, maintained: 1, emerged: 1}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F0 phase fe69871 r17

## Capture manifest

- Ref: b2a845a5d7e832c88622cb21c89aff6ee33927e1..fe698710fd7abad760820f8c78acfcf1b4b0f5b2
- Captured diff: 5,462,760 bytes / 117,825 lines / 91 files
- SHA-256: 041d59c3d58786992894488c2061743812edf2c8fd5bab8740646993b700f75a
- Patch id: 39873fa5cdfd2f3732a094652a55995cb2e46350
- Raw Pass 1 SHA-256: 783bc7b014443ef2551378b300b29308950a18ac6e73dd12635c522dfd2b43cf
- Raw Pass 2 SHA-256: 4a8ea6a0382b5af1208856c92966f7bdbe90a926425272a74b998c95c8dcc1a5
- Mode: codex; model override: codex-auto-review; reasoning: high; sandbox: read-only
- Worktree was clean before capture and remained read-only during both passes.

## Structural validation

- Pass 1: frontmatter, verdict, counts, pass id, four findings and mandatory fields validated.
- Pass 2: frontmatter, verdict, counts, reconciliation headers and two final findings validated.
- Reconciliation: three blind findings dropped, the immutable-anchor finding maintained, and the registration-authority finding emerged from the informed contract.

## Operator scope triage

- Blind F-001 major — dropped. The final shared-writer check-to-rename race is explicitly deferred to F4 and is not an F0 defect.
- Blind F-003 minor — dropped. Raw shell JSON interpolation existed byte-for-byte at the frozen base; F0 did not introduce a causal regression.
- Blind F-004 minor — dropped. Suppression of a present provisioner's non-zero exit also existed at the frozen base; F0 did not introduce a causal regression.
- Final F-001 major — validated and fixed. A recorded but unusable `startedCommit` now omits actuals; the timestamp heuristic remains only for legacy state where the anchor field is absent.
- Final F-002 major — validated and fixed. A server-chosen project id is authoritative only when the registration response proves the same `rootDir`; no delete/re-register attempt is made for a legitimate collision-resolved id.
- Delegated decisions: preserve the explicit F4 deferral and causal-finding bar; prefer omission over fabricated analytics; trust the server-selected id only with same-root evidence.
- Remaining substantive count after remediation at `6a5c1a6`: zero blocker, zero critical, zero major, zero minor. A fresh clean-checkpoint review remains required for phase approval.

## Remediation evidence

- RED: the focused analytics/serve set collected 31 tests, with 29 passing and both new regressions failing.
- GREEN: the same focused set passed 31/31 after remediation.
- Integrated analytics/runtime/render/parity set: 128/128 tests passed.
- Diff check was clean before the remediation commit.

## Pass 1 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 2, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The changed surface still has two substantive correctness defects. `refresh-state` can overwrite a newer `PROJECT-STATUS.md` snapshot because its publish path is still a check-then-rename race, and the new `startedCommit` actuals path still silently falls back to the fragile date heuristic when the commit anchor is unusable, which reintroduces inflated phase metrics after history rewrites.

The new dashboard/view shell recipes also have two concrete robustness regressions: project registration builds JSON by interpolating raw shell variables, which breaks on valid repository paths containing JSON-significant characters, and consumer provisioning failures are redirected to `/dev/null` and ignored, so the flow continues in a misconfigured state with no actionable error.

## Findings

### F-001 [major] race condition — scripts/refresh-state.js:187-206

**Evidence:**
```js
function publishProjectIndex(indexPath, expected, next) {
  const temporaryPath = `${indexPath}.refresh-${process.pid}-${randomUUID()}.tmp`;
  const mode = statSync(indexPath).mode & 0o777;
  let fd = null;
  let published = false;

  try {
    fd = openSync(temporaryPath, 'wx', mode);
    fchmodSync(fd, mode);
    writeFileSync(fd, next, 'utf8');
    fsyncSync(fd);
    closeSync(fd);
    fd = null;

    if (readFileSync(indexPath, 'utf8') !== expected) return false;

    renameSync(temporaryPath, indexPath);
```

**Claim:** The project-index publisher still has a lost-update race because another writer can change `indexPath` after the equality check and before `renameSync`, and this stale `next` will overwrite the newer file.

**Impact:** Concurrent `refresh-state` runs can silently roll back a fresher `PROJECT-STATUS.md` projection, leaving the active-plan/phase index stale or inconsistent until some later refresh happens to repair it.

**Recommendation:** Serialize index writers with a shared lock or implement a real CAS around the final publish step; do not rely on an unlocked read-then-rename window.

**Confidence:** high

---

### F-002 [major] correctness — scripts/append-completion.js:76-86

**Evidence:**
```js
// Prefer the immutable commit anchor; accept it only when it is a real
// ancestor of HEAD, else fall back to the (fragile) date heuristic.
let base = '';
if (hasText(sinceCommit)) {
  try {
    git(['merge-base', '--is-ancestor', sinceCommit, 'HEAD']); // throws unless ancestor
    base = git(['rev-parse', sinceCommit]);
  } catch { base = ''; }
}
if (!base && hasText(since)) {
  base = git(['rev-list', '-1', `--before=${since}`, 'HEAD']);
}
```

**Claim:** When a phase has a recorded `startedCommit` but that anchor is no longer an ancestor, the code silently falls back to the date heuristic instead of failing closed.

**Impact:** After rebases, squashes, or branch mistakes, phase actuals can be computed from the wrong base commit and inflate `filesChanged`/`loc*`/`commits`, corrupting earned-value and phase-completion analytics while still looking valid.

**Recommendation:** If `sinceCommit` is present but unusable, return `undefined` (or require an explicit override) rather than re-entering the date heuristic.

**Confidence:** medium

---

### F-003 [minor] compatibility — skills/shared/project-assets/project-view.md:183-185

**Evidence:**
```md
registration=$(curl -sf -X POST "$url/api/projects/register" \
  -H 'Content-Type: application/json' \
  -d "{\"rootDir\":\"$PWD\",\"projectId\":\"$pid\"}" 2>/dev/null)
```

**Claim:** The dashboard registration recipe constructs JSON by interpolating raw shell variables, so valid path contents like `"` or `\` produce invalid JSON.

**Impact:** Repositories or worktrees with JSON-significant characters in their absolute path fail to register with aiDeck, so `status --browser` opens without the project being available even though the filesystem path itself is valid.

**Recommendation:** Build the request body with a JSON encoder (`node -e`, `jq -nc`, etc.) instead of embedding `$PWD`/`$pid` directly inside a quoted JSON literal.

**Confidence:** high

---

### F-004 [minor] error handling — skills/shared/project-assets/project-view.md:146-151

**Evidence:**
```md
PROV="$PKG_ROOT/src/provision-consumer.js"
[ -f "$PROV" ] || {
  echo "atomic-skills package root is stale: missing src/provision-consumer.js" >&2
  exit 1
}
node "$PROV" >/dev/null 2>&1
```

**Claim:** The view flow suppresses `provision-consumer.js` output and does not check its exit status, so provisioning failures are silently ignored.

**Impact:** A broken or partially installed consumer can fall through to later registration/open steps and surface as opaque 404/empty-dashboard behavior instead of failing at the actual cause.

**Recommendation:** Make provisioning fail-fast, e.g. `node "$PROV" >/dev/null 2>&1 || { echo "...failed..." >&2; exit 1; }`, and preserve stderr on failure.

**Confidence:** high

---

## Questions (non-findings)

## Out of scope
## Pass 2 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The frozen diff still ships one direct contract violation in completion analytics: `append-completion.js` silently re-enters the timestamp heuristic when a recorded `startedCommit` is unusable, even though the F0 contract requires omitting actuals in that case. That can still corrupt `filesChanged`/`loc*`/`commits` after rebases or history rewrites.

A second regression appears in the new aiDeck registration flow. `serve.js` now treats a collision-resolved `projectId` returned by `/api/projects/register` as a failure unless it can delete and reclaim the caller’s preferred id, but the same changed surface documents that the server-returned id may legitimately replace the local candidate. That makes `ensureAideck` reject valid registrations on project-id collisions.

## Findings

### F-001 [major] correctness — scripts/append-completion.js:76-86

**Evidence:**
```js
    // Prefer the immutable commit anchor; accept it only when it is a real
    // ancestor of HEAD, else fall back to the (fragile) date heuristic.
    let base = '';
    if (hasText(sinceCommit)) {
      try {
        git(['merge-base', '--is-ancestor', sinceCommit, 'HEAD']); // throws unless ancestor
        base = git(['rev-parse', sinceCommit]);
      } catch { base = ''; }
    }
    if (!base && hasText(since)) {
      base = git(['rev-list', '-1', `--before=${since}`, 'HEAD']);
    }
```

**Claim:** When `startedCommit` is present but no longer usable, the code silently falls back to the timestamp heuristic instead of omitting actuals.

**Impact:** Rebases, squashes, or bad anchors can still produce inflated or shifted phase actuals that look valid, corrupting earned-value and completion analytics for `phase-done` events.

**Recommendation:** If `sinceCommit` is present and fails validation/resolution, return `undefined` immediately instead of consulting `since`; add a regression test that covers a recorded but non-ancestor commit.

**Confidence:** high

---

### F-002 [major] compatibility — src/serve.js:330-342

**Evidence:**
```js
  const registered = first.project?.projectId
  if (!registered || registered === projectId) return 'ok'

  const registeredRoot = first.project?.rootDir
  if (!registeredRoot || !sameResolvedPath(registeredRoot, rootDir)) return 'failed'

  const del = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(registered)}`, { method: 'DELETE' })
  if (!del.ok && del.status !== 404) return 'failed'

  const second = await postProjectRegistration(baseUrl, rootDir, projectId)
  if (second.status !== 'ok') return second.status
  const secondId = second.project?.projectId
  return !secondId || secondId === projectId ? 'ok' : 'failed'
```

**Claim:** `ensureProjectRegistration` rejects a valid server-chosen `projectId` for the same `rootDir` unless a delete-and-retry sequence reclaims the caller’s preferred id.

**Impact:** On legitimate aiDeck project-id collisions, `ensureAideck` can fail or restart even though the server already registered the repo under a collision-resolved id, so `atomic-skills serve`/browser flows can come up without a usable project registration.

**Recommendation:** Accept the `project.projectId` returned by `/api/projects/register` when its `rootDir` matches the current repo, mirroring the changed registration contract; only perform cleanup as a best-effort canonicalization, and add a regression test where both register responses return a stable collision-resolved id.

**Confidence:** medium

## Questions (non-findings)

- _(none)_

## Out of scope

- The final `refresh-state` check-to-rename shared-writer race, because the briefing explicitly marks it as deferred to F4 rather than an F0 defect.
- The raw JSON interpolation and suppressed provisioner exit in `project-view.md`, because the briefing states both behaviors predate this diff and are only reportable if F0 introduced a new independent failure.

## Pass 2 reconciliation

### Dropped from blind pass

- F-001-blind [major] race condition — DROPPED: the briefing explicitly states the final `refresh-state` check-to-rename shared-writer race is deferred to F4 and is not an F0 defect.
- F-003-blind [minor] compatibility — DROPPED: the briefing states the raw `-d "{\"rootDir\":\"$PWD\",...}"` interpolation already existed in the base version, so this is not a causal F0 regression.
- F-004-blind [minor] error handling — DROPPED: the briefing states the base version already suppressed a present provisioner’s non-zero exit, so F0 did not independently introduce this behavior.

### Maintained

- F-002-blind → F-001-final [major] — same

### Emerged

- F-002-final [major] compatibility — emerged: the added constraint that `/api/projects/register` may return a collision-resolved id that replaces the local candidate exposes `src/serve.js` as incorrectly treating that valid response as failure unless it can reclaim the preferred id.
