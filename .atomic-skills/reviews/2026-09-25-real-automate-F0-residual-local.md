# real-automate F0 residual — local re-check

**Scope (read-only product):** `src/automate-host-pen.js`, `scripts/automate-pen-hook.js`, `skills/shared/project-assets/hooks/automate-pen.sh`, `scripts/find-unreviewed-plans.js`, `tests/automate-host-pen.test.js`  
**Method:** current source vs the 11 previously reported holes; `node --test tests/automate-host-pen.test.js` (29/29 pass).  
**Date:** 2026-09-25

## Remaining counts (blocker / critical / major only)

**0 blocker / 0 critical / 0 major.**

None of those severities remain. Each previously reported item was checked in current source; all 11 are **FIXED**.

## Item status

### 1. pathInsideWorktree `..` and `/` — FIXED

- **Was:** relative `..` and a filesystem-root writer worktree (`/`) counted as in-tree.
- **Now:** `src/automate-host-pen.js:376-393` — `writerWorktree` resolved to `/` (or empty) is rejected; `relative(realRoot, realTarget)` of `..` or `..${sep}` is rejected; Windows-root `rel` is rejected.
- **Evidence:** `tests/automate-host-pen.test.js:100-108`.

### 2. decidePen unknown tools / NotebookEdit while locked — FIXED

- **Was:** unknown tools (and/or NotebookEdit) allowed while the lock is held.
- **Now:** `src/automate-host-pen.js:41` lists `NotebookEdit` as a Claude write tool; `src/automate-host-pen.js:503-525` denies shells, denies listed writes with no in-tree path, and fail-closes every other tool (no read allowlist).
- **Evidence:** `tests/automate-host-pen.test.js:110-156`.

### 3. AUTOMATE_PEN_LOCK missing override disabling pen.lock — FIXED

- **Was:** a set-but-missing `AUTOMATE_PEN_LOCK` skipped on-disk `pen.lock` and allowed the write.
- **Now:** `skills/shared/project-assets/hooks/automate-pen.sh:12-23` uses the override only when `-f`; otherwise falls through to on-disk `pen.lock` / probe. `scripts/automate-pen-hook.js:39-50` `firstExisting([override, on-disk pen, probeOverride, on-disk probe])`.
- **Evidence:** `tests/automate-host-pen.test.js:409-425`.

### 4. bash `/tmp/evil/automate-pen.sh` same-basename spoof — FIXED

- **Was:** registration accepted any path whose basename was `automate-pen.sh`.
- **Now:** `src/automate-host-pen.js:162-165,213-234,256-257` — token must end in a trusted suffix; resolved path must realpath-equal an allowed package/root/plugin hook file. `/tmp/evil/automate-pen.sh` is not a token; a trusted-suffix path outside the tree fails `resolvePenHookScript`.
- **Evidence:** `tests/automate-host-pen.test.js:200-233,751-792`.

### 5. `bash -n automate-pen.sh` registration — FIXED

- **Was:** `bash -n <trusted-script>` counted as a registered pen (syntax-check, never a PreToolUse deny).
- **Now:** `src/automate-host-pen.js:238,251-253` — after `bash`, exactly one remaining token (the script). Flags (`-n`, `-c`, …) fail the token count.
- **Evidence:** `tests/automate-host-pen.test.js:216-217,773-789`.

### 6. nested Grok `${}` expand — FIXED

- **Was:** outer `${GROK_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-$PWD}/…}` did not expand innermost-first, so the Grok plugin hook path did not resolve.
- **Now:** `src/automate-host-pen.js:262-297` — up to 8 passes of innermost `${VAR:-default}` (`[^{}]*` default) then `$VAR`; leftover `${` fails closed.
- **Evidence:** `tests/automate-host-pen.test.js:182-198`.

### 7. apply_patch dummy filePath + opaque patch — FIXED

- **Was:** a dummy in-tree `filePath` plus a non-empty opaque/unknown patch was allowed (hunk paths ignored).
- **Now:** `src/automate-host-pen.js:473-478` — non-empty `apply_patch` patch uses only `parseApplyPatchPaths`; dummy `filePath` is ignored. `src/automate-host-pen.js:415-439` returns `[]` for opaque text and unknown `***` kinds → `decidePen` denies empty path sets (`src/automate-host-pen.js:514-516`).
- **Evidence:** `tests/automate-host-pen.test.js:290-322`.

### 8. relative `src/a.js` resolved against writerWorktree — FIXED

- **Was:** relative writes were joined to the writer worktree, so a chat-session `src/a.js` looked in-tree.
- **Now:** `src/automate-host-pen.js:367-384` — relative paths resolve against `hostCwd` (`process.cwd` / `CLAUDE_PROJECT_DIR` / `GROK_WORKSPACE_ROOT`), never against `writerWorktree`.
- **Evidence:** `tests/automate-host-pen.test.js:324-348`.

### 9. symlink escape — FIXED

- **Was:** lexical `startsWith(worktree)` allowed `worktree/escape → /etc` (or sibling tree).
- **Now:** `src/automate-host-pen.js:167-205,385-392` — existing prefixes of both root and target are `lstat`/`realpath`'d; a symlink out of the tree fails the `relative` check.
- **Evidence:** `tests/automate-host-pen.test.js:350-371`.

### 10. `--require-external` first `\bexit=` substring spoof — FIXED

- **Was:** `\bexit=` treated `note=exit=0` / `--exit=0` as a passing `exit` field.
- **Now:** `scripts/find-unreviewed-plans.js:50-64,76-96` — fields are `(?:^|[|,])\s*key\s*=` assignments; exactly one numeric `exit=0` and one `verdict=CLEAN|PASS|PASSED`; `note=exit=0` and `--exit=0` are not `exit`.
- **Evidence:** `tests/automate-host-pen.test.js:648-692`.

### 11. null PreToolUse entry throw — FIXED

- **Was:** `PreToolUse: [null, …]` threw during `assessPenRegistration` (startup crash instead of a listed blocker).
- **Now:** `src/automate-host-pen.js:103-108,319-325` — non-array PreToolUse → `[]`; `entry == null` / non-object skipped; `hook != null` before reading `command`. Mixed null+real still registers; null-only is a blocker reason, not a throw.
- **Evidence:** `tests/automate-host-pen.test.js:235-249`.

## Verdict

After checking each of the 11 items against current source and the 29-test suite: **no remaining blocker, critical, or major findings.**
