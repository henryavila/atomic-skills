---
date: 2026-07-14T16:09:08-03:00
topic: integrity-remediation-f0-phase-9225131-r20
artifact: b2a845a5d7e832c88622cb21c89aff6ee33927e1..92251310c01debf3135ee2d24b1b94b3e16c4117
skill: review-code
reviewer: gpt-5-codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 2, minor: 1, nit: 0}
framing_delta: {dropped: 1, maintained: 2, emerged: 0}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F0 phase 9225131 r20

## Capture manifest

- Ref: b2a845a5d7e832c88622cb21c89aff6ee33927e1..92251310c01debf3135ee2d24b1b94b3e16c4117
- Captured diff: 5,524,359 bytes / 118,961 lines / 95 files
- SHA-256: 503d7d711348b202ae7056acf94315d1ceec0c9e70a80ae1cea8f55290a9e4f6
- Patch id: 2d8a38fc575d8e9b8b0ebc72d7b2b92d802a7c7f
- Raw Pass 1 SHA-256: 879b580f5058cc82ead2977225f5d438157d892a935daeac9b5596b184714eec
- Raw Pass 2 SHA-256: 4e4e8bfdf134a0337b6a83d6b8f7da1a8e79ea7564dd5bad270f01f1dd527ca2
- Mode: codex; model override: codex-auto-review; reasoning: high; sandbox: read-only
- Worktree was clean before capture and remained read-only during both passes.

## Structural validation

- Pass 1: frontmatter, verdict, counts, pass id, three findings and mandatory fields validated.
- Pass 2: frontmatter, verdict, counts, reconciliation headers and two final findings validated.
- Reconciliation: the markerless core-skill finding dropped; launcher and index-authority findings remained.

## Operator scope triage

- Blind F-003 minor — dropped. Markerless compatibility is intentionally limited to the resident project router and verified recipes; installed core skills remain marker-first.
- Final F-001 major — validated and fixed. Fresh-start `ensureAideck()` now honors `opts.aideckBin`, runs only JavaScript entrypoints through Node, and executes other path launchers directly.
- Final F-002 major — validated and fixed. A symlinked `PROJECT-STATUS.md` may publish only through the approved `CANONICAL-PROJECT-STATUS.md` target in the same real project directory; plan and phase files are rejected before index publication.
- Delegated decisions: preserve marker-first core skills; match the existing launcher classification in both serve paths; keep the supported canonical index indirection while rejecting all other same-project targets.
- Remaining substantive count after remediation at `909e7e6`: zero blocker, zero critical, zero major, zero minor. A fresh clean-checkpoint review remains required for phase approval.

## Remediation evidence

- RED: the focused serve/refresh set collected 44 tests, with 41 passing and three new regressions failing.
- GREEN: the same focused set passed 44/44 after remediation.
- Integrated project/serve/refresh/install-uninstall set: 130/130 tests passed.
- Installed runtime closure: 7/7 tests passed.
- Skill catalog validation: all 15 skills valid at schema version 0.2.
- Diff check was clean before the remediation commit.

## Pass 1 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The diff introduces two concrete runtime regressions and one core-skill availability regression. `ensureAideck()` now mis-launches path-based aiDeck executables by forcing any path through `node`, and the new `PROJECT-STATUS.md` symlink support only constrains the target to the project directory, which still allows overwriting unrelated project files on refresh.

The skill-runtime hardening also removed the verified source-checkout fallback from several core skills. That turns a missing or stale `~/.atomic-skills/package-root` marker into a hard stop even when the user is already inside a valid atomic-skills checkout.

## Findings

### F-001 [major] compatibility — src/serve.js:396-404

**Evidence:**
```js
const bin = resolveAideckBin()
const args = ['serve']
if (port) args.push(`--port=${port}`)
const staticDir = resolveStaticDir()
if (staticDir) args.push('--static-dir', staticDir)

const isPath = bin.includes('/') || bin.includes('\\')
const cmd = isPath ? process.execPath : bin
const cmdArgs = isPath ? [bin, ...args] : args
```

**Claim:** `ensureAideck()` treats every path-like `bin` as a JavaScript entrypoint and launches it as `node <path>`, which breaks valid executable overrides such as `/custom/path/to/aideck`.

**Impact:** Operators using `AIDECK_BIN` or any non-`.js` absolute/relative aiDeck launcher cannot auto-start the dashboard; the fallback path that should recover from a stopped server instead fails to spawn it.

**Recommendation:** Reuse the same classification already used by `spawnAideck()` (`.js`/`.mjs` => `node`, otherwise execute the binary directly) and add a behavioral test that starts `ensureAideck()` with an executable-path override.

**Confidence:** high

---

### F-002 [major] data_integrity — scripts/refresh-state.js:229-245

**Evidence:**
```js
function refreshProjectIndex(indexPath, readProjections) {
  const isSymlink = lstatSync(indexPath).isSymbolicLink();
  const publishPath = isSymlink
    ? realpathSync(indexPath)
    : indexPath;
  if (isSymlink) {
    const projectPath = realpathSync(dirname(indexPath));
    const targetRelative = relative(projectPath, publishPath);
    if (
      targetRelative === '..'
      || targetRelative.startsWith(`..${sep}`)
      || isAbsolute(targetRelative)
    ) {
      throw new Error(
        `${basename(indexPath)} symlink resolves outside its managed project directory`,
      );
    }
  }
```

**Claim:** The new symlink guard only checks that `PROJECT-STATUS.md` stays somewhere under the project directory; it does not verify that the target is actually an index file, so a symlink to `plan.md` or a phase file inside the same project will be accepted and then rewritten.

**Impact:** A malformed or malicious same-project symlink can corrupt unrelated state files during `refresh-state`, including session-start/serve-triggered refreshes, by replacing their contents with rendered project-index rows.

**Recommendation:** Restrict symlink targets to an explicit allowlist of canonical project-index locations/filenames, not merely “inside this directory,” and add a regression test for a same-project misdirection such as `PROJECT-STATUS.md -> plan-a/plan.md`.

**Confidence:** high

---

### F-003 [minor] availability — skills/core/brainstorm.md:11-18

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

**Claim:** This new preamble hard-fails when the install marker is missing, with no verified source-checkout fallback; the same pattern was also added to other core skills (`design-brief`, `implement`).

**Impact:** Core workflows stop working from a fresh repo checkout, after uninstall, or when `package-root` is stale, even though the required scripts are present in the current atomic-skills checkout.

**Recommendation:** Use the same checked `$PWD` fallback pattern already used by the project router flows, so the skills still work from a valid source checkout while remaining fail-closed for arbitrary consumer directories.

**Confidence:** medium

---

## Questions (non-findings)


## Out of scope

- Archived review transcripts under `.atomic-skills/reviews/` beyond using them as audit context.
<!-- end raw Pass 1 output -->

## Pass 2 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
Two diff-introduced regressions remain after applying the external constraints. The aiDeck recovery path in `ensureAideck()` no longer honors the documented launcher contract: it ignores the explicit `--aideck-bin` override on auto-start and forces any path-like launcher through `node`, which breaks valid direct executables. Separately, the new `PROJECT-STATUS.md` symlink support only checks directory containment, so a same-project symlink to `plan.md` or a phase file will be accepted and overwritten during refresh.

The blind-pass core-skill availability finding does not stand. The constraints explicitly limit markerless source-checkout fallback to the resident `project` router and require installed core skills such as `brainstorm` to fail closed when the package-root marker is absent.

## Findings

### F-001 [major] compatibility — src/serve.js:396-404

**Evidence:**
```js
const bin = resolveAideckBin()
const args = ['serve']
if (port) args.push(`--port=${port}`)
const staticDir = resolveStaticDir()
if (staticDir) args.push('--static-dir', staticDir)

const isPath = bin.includes('/') || bin.includes('\\')
const cmd = isPath ? process.execPath : bin
const cmdArgs = isPath ? [bin, ...args] : args
```

**Claim:** `ensureAideck()` drops the explicit `opts.aideckBin` override and then treats every path-like launcher as a JavaScript entrypoint, violating the required contract for both `--aideck-bin` and `AIDECK_BIN`.

**Impact:** When aiDeck must be auto-started from a stopped state, a valid override such as `--aideck-bin /path/to/aideck` is ignored, and a direct executable from `AIDECK_BIN` is launched as `node /path/to/aideck`, causing recovery to fail for legitimate local builds and wrapper binaries.

**Recommendation:** Derive `bin` as `opts.aideckBin ?? resolveAideckBin()` and reuse the same dispatch rule as `spawnAideck()` (`.js`/`.mjs` via Node, all other paths executed directly). Add an `ensureAideck()` regression test for both a JS entrypoint override and a direct executable override.

**Confidence:** high

---

### F-002 [major] data_integrity — scripts/refresh-state.js:229-245

**Evidence:**
```js
function refreshProjectIndex(indexPath, readProjections) {
  const isSymlink = lstatSync(indexPath).isSymbolicLink();
  const publishPath = isSymlink
    ? realpathSync(indexPath)
    : indexPath;
  if (isSymlink) {
    const projectPath = realpathSync(dirname(indexPath));
    const targetRelative = relative(projectPath, publishPath);
    if (
      targetRelative === '..'
      || targetRelative.startsWith(`..${sep}`)
      || isAbsolute(targetRelative)
    ) {
      throw new Error(
        `${basename(indexPath)} symlink resolves outside its managed project directory`,
      );
    }
  }
```

**Claim:** The symlink guard enforces only “stays under the same project directory,” so `PROJECT-STATUS.md` may point at any in-project file, including `plan.md` or a phase markdown file, and that non-index target will be rewritten as index output.

**Impact:** A malformed or malicious same-project symlink can corrupt authoritative plan or phase state during `refresh-state`, including refreshes triggered from session startup or dashboard flows, by replacing those files with rendered project-index rows.

**Recommendation:** Reject any symlink target that is not an approved project-index file in the same real project directory, and add regressions for `PROJECT-STATUS.md -> plan.md` and `PROJECT-STATUS.md -> phases/f1-*.md`.

**Confidence:** high

## Questions (non-findings)

- _(none)_

## Out of scope

- Archived `.atomic-skills/reviews/` transcripts except as audit context.

## Pass 2 reconciliation

### Dropped from blind pass

- F-003-blind [minor] availability — DROPPED: the external constraints explicitly state that markerless source-checkout fallback is limited to `skills/core/project.md`, while installed core skills such as `brainstorm`, `design-brief`, and `implement` must require the installed package-root marker and fail closed.

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same

### Emerged

- _(none)_

<!-- end raw Pass 2 output -->

