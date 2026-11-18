# Local adversarial review — real-automate F0 fix (host pen + startup)

**Date:** 2026-09-25
**Mode:** local only (no host chat, no commit text, no author intent)
**Scope:** `src/automate-host-pen.js`, `scripts/automate-pen-hook.js`, `skills/shared/project-assets/hooks/automate-pen.sh`, `tests/automate-host-pen.test.js`, `src/providers/skills-file-set.js`, `skills/shared/project-assets/project-setup.md`, `scripts/automate-run.js`, `scripts/find-unreviewed-plans.js`
**Public symbols probed:** `decidePen`, `pathInsideWorktree`, `parseApplyPatchPaths`, `extractPenHookScriptToken`, `resolvePenHookScript`, `assessPenRegistration`, `assessHostWrite`, `isExternalCliReceiptLine`, `runSyntheticProbe`, `runHostWriteProbe`

Runtime checks used a Node ESM import of the current modules (no test runner, no git). Second checklist pass after the first read.

## Severity counts

| Severity | Count |
|----------|------:|
| blocker  | 0 |
| critical | 0 |
| major    | 5 |
| minor    | 3 |
| note     | 3 |
| **total** | **11** |

Prior fail-opens (unknown tools, `NotebookEdit` matcher miss, `/` and `..` prefix matching, missing `AUTOMATE_PEN_LOCK` → allow, `echo automate-pen.sh; exit 2` substring, `verdict=needs_changes` / `exit=127`) are not present in the current bodies. Findings below are what still holds against the substance.

---

## Findings

### F1 — Severity: major

- **File:** `src/automate-host-pen.js:161-165` (basename-only token), `src/automate-host-pen.js:194-196` (no path allowlist after expand), `scripts/automate-run.js:225-242` (spawns that path)
- **Claim:** `extractPenHookScriptToken` accepts any `bash`/`/bin/bash`/`/usr/bin/bash` argv whose last token's basename is `automate-pen.sh`. `resolvePenHookScript` then `path.resolve`s that token and only re-checks `basename(resolved) === 'automate-pen.sh'`. `hostShapedWrite` spawns `bash [scriptPath]` with `AUTOMATE_PROBE_LOCK` set. Runtime: `extractPenHookScriptToken('bash /tmp/evil/automate-pen.sh')` → `'/tmp/evil/automate-pen.sh'`; `resolvePenHookScript(..., '/proj', {})` → `'/tmp/evil/automate-pen.sh'`. The suite's spoof is only `echo automate-pen.sh; exit 2` (`tests/automate-host-pen.test.js:157-178`, `527-547`).
- **Impact:** A `hooks.json` command of `bash /tmp/evil/automate-pen.sh` (file present) is a registered pen. The host-write probe executes that file, not the package hook. A stub that exits 2 when `AUTOMATE_PROBE_LOCK` exists and exits 0 otherwise yields `invokedHook: true`, `refused: true`, no sentinel → `assessHostWrite` ok, while live PreToolUse (no probe lock) allows every write. The new argv parser blocks the substring case and still certifies a same-basename stand-in.
- **Recommendation:** After expand, require the resolved path to be the package/install copy (suffix `.atomic-skills/status/hooks/automate-pen.sh` or `_assets/hooks/automate-pen.sh` under `ROOT` / `GROK_PLUGIN_ROOT`) and/or compare sha256 to the shipped script. Spawn only that path. Negative test: `bash /tmp/x/automate-pen.sh` with a probe-aware stub → `runHostWriteProbe` not ok.
- **Confidence:** 0.9

### F2 — Severity: major

- **File:** `src/automate-host-pen.js:184-196` (expand), `src/providers/skills-file-set.js:200-201` (shipped command)
- **Claim:** The Grok Soft envelope command is `bash "${GROK_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-$PWD}/.grok/plugins/atomic-skills}/_assets/hooks/automate-pen.sh"`. `resolvePenHookScript` expands `\$\{name:-default\}` with `[^}]*` for the default, so the first match is `${GROK_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-$PWD}` and the inner `}` terminates it. Runtime against `/proj`:
  - `GROK_PLUGIN_ROOT` unset, `CLAUDE_PROJECT_DIR=/proj` → `/proj/_assets/hooks/automate-pen.sh` (missing `.grok/plugins/atomic-skills`)
  - `GROK_PLUGIN_ROOT=/plugins/atomic-skills` → `/plugins/atomic-skills/.grok/plugins/atomic-skills}/_assets/hooks/automate-pen.sh` (literal `}` in the path)
  Claude/Codex `${CLAUDE_PROJECT_DIR:-$PWD}/.atomic-skills/status/hooks/automate-pen.sh` expands correctly. `extractPenHookScriptToken` still returns the Grok token (basename matches), so `assessPenRegistration('grok', generated)` can be ok while `resolvePenHookScript` points at a file that does not exist.
- **Impact:** `hostShapedWrite` for a stock Grok `hooks.json` hits `!scriptPath || !existsSync(scriptPath)`, emits `invokedHook: false`, and `runHostWriteProbe` fails. Grok `--automate` startup never proves the installed plugin hook. Tests never exercise this string; they register `bash "${script}"` with an absolute tree path (`tests/automate-host-pen.test.js:502-515`).
- **Recommendation:** Expand nested `${}` (innermost-first, or a real shell `printf %s` of the token) until stable. Assert `resolvePenHookScript(generatePluginHooksSoft command, root, {CLAUDE_PROJECT_DIR: root})` equals `join(root, '.grok/plugins/atomic-skills/_assets/hooks/automate-pen.sh')` and the `GROK_PLUGIN_ROOT` override equals `join(pluginRoot, '_assets/hooks/automate-pen.sh')` with no stray `}`.
- **Confidence:** 0.98

### F3 — Severity: major

- **File:** `src/automate-host-pen.js:295-336` (`collectWritePaths` + `decidePen`), `scripts/automate-pen-hook.js:69-88`
- **Claim:** A listed write tool is allowed when every collected path is inside the worktree. `collectWritePaths` unions `filePath` / `filePaths` with `parseApplyPatchPaths(patch)`. The regex only matches `*** (Add File|Delete File|Update File|Move to):`. If `filePath` is in-tree and the patch body does not match, `paths` is `[filePath]` and `decidePen` allows. Runtime: `decidePen({ lockHeld: true, toolName: 'apply_patch', filePath: '/work/ok.js', patch: 'not a real patch\n--- /etc/passwd\n', writerWorktree: '/work' })` → `{ deny: false }`. Same call with no `filePath` and unparsed patch → deny (empty paths). The hook prefers `toolInput.file_path|path|target_file|notebook_path` even when `tool_name` is `apply_patch` and the body lives in `patch`/`input`/`diff`. `parseApplyPatchPaths('*** Update: src/a.js\n*** Rename File: /etc/passwd\n')` → `[]`.
- **Impact:** Codex `apply_patch` is the only Codex write tool. Any payload that carries an in-tree dummy path plus a hunk format the regex misses is treated as an in-tree write. The worktree exception then does not constrain the patch the host will apply.
- **Recommendation:** For `apply_patch` (and any tool whose real targets are the patch), require at least one parsed hunk path and ignore unrelated `file_path`. Deny when `patch` is non-empty and `parseApplyPatchPaths` returns `[]`. Cover `*** Update:` / `*** Rename File:` or fail-closed on unknown headers. Test the dummy-`file_path` + opaque patch case.
- **Confidence:** 0.86

### F4 — Severity: major

- **File:** `scripts/find-unreviewed-plans.js:59-65`
- **Claim:** `--require-external` now requires `exit=0` and `verdict` in `CLEAN|PASS|PASSED|ok`, but those tokens are the first `\bexit=` / `\bverdict=` / `(command|cli)=\S` anywhere after the label. `\b` matches inside `--exit=0`. `command=` only needs one non-space character. Runtime:
  - `- grok: command=node foo --exit=0 | exit=1 | verdict=CLEAN` → `true`
  - `- grok: command=echo verdict=CLEAN | exit=0 | verdict=needs_changes` → `true`
  - `- grok: command=true | exit=0 | verdict=ok` → `true`
  - `- internal-review: command=grok | exit=0 | verdict=CLEAN` → `true` (`^internal$` does not match `internal-review`)
  Tests only use a clean `command=grok review … | exit=0 | verdict=CLEAN|PASSED|ok` line and a standalone `exit=127` / `verdict=needs_changes` (`tests/automate-host-pen.test.js:446-489`).
- **Impact:** `automate-run` still accepts a session-typed markdown line. A failed CLI (`exit=1`, `verdict=needs_changes`) passes if the command string contains `--exit=0` or `verdict=CLEAN`. `verdict=ok` plus `command=true` is a three-token forge. The flag blocks a lone `- internal:` line and then green-lights token order accidents.
- **Recommendation:** Parse `command`/`cli`, `exit`, `verdict` as field assignments (`(?:^|[|,]\s*)key\s*=`), not first `\bkey=` on the rest of the line. Drop `ok` or require `CLEAN|PASS|PASSED` only. Reject `command` values that are not a path/executable with a space-or-flag argument. Keep reserved-label exclusions as prefix matches (`internal*`, `cross-model*`). Tests: the four runtime lines above must exit 1 under `--require-external`.
- **Confidence:** 0.94

### F5 — Severity: major

- **File:** `src/automate-host-pen.js:241-251`
- **Claim:** `pathInsideWorktree` uses `path.resolve` + `path.relative` and rejects `..` and filesystem-root worktrees. It does not `realpath` / `lstat`. Runtime: worktree `…/wt` with symlink `wt/etc-link → /etc` → `pathInsideWorktree('…/wt/etc-link/passwd', '…/wt') === true`. Tests cover `/tmp/wt/../secret.js`, `/`, and `/tmp/wt-evil` (`tests/automate-host-pen.test.js:99-107`) and never a symlink. Sibling `pre-write.sh:38-39` documents that it also skips symlink resolution, for a weaker gate.
- **Impact:** This is the only write allowlist while the lock is held. A listed write tool whose path is a symlink (or a path through a symlink) inside the writer worktree is allowed and the host follows the link. Git worktrees can contain committed symlinks; shells are denied so `ln -s` is blocked, but existing links are enough. `/` and `..` string traversal is closed; link traversal is not.
- **Recommendation:** `realpath` both sides (or `lstat` each segment and refuse a symlink whose target is outside the worktree) before `relative`. If realpath is unavailable, deny. Test: symlink inside the worktree pointing at `/etc/passwd` → `pathInsideWorktree` false and `decidePen` deny.
- **Confidence:** 0.88

### F6 — Severity: minor

- **File:** `src/automate-host-pen.js:213-215`, `scripts/automate-run.js:335-336`
- **Claim:** `assessPenRegistration` still does `(entry.hooks || []).some((hook) => extractPenHookScriptToken(hook.command) != null)` with no null check on `entry` or `hook`. `penHookCommand` skips `entry == null` and `hook && typeof hook.command === 'string'` (`scripts/automate-run.js:67-72`). Runtime: `PreToolUse: [null, {…}]` throws `TypeError: Cannot read properties of null (reading 'hooks')`; `hooks: [null]` throws on `command`. `main()` has no `try/catch` around `assessPenRegistration`. `hostShapedWrite` calls `penHookCommand` first, then `assessPenRegistration`; a later valid command plus an earlier null entry throws before `emit()`.
- **Impact:** Startup dies on an uncaught `TypeError` instead of a blocker line. The child `--host-write-probe` can exit non-zero without `HOST_WRITE_PROBE=`, which the parent already treats as not-ok (fail-closed). Malformed JSON arrays are enough.
- **Recommendation:** Mirror `penHookCommand`'s guards. Catch around registration in `main()` and push `String(err)`. Test `PreToolUse: [null, realPenEntry]`.
- **Confidence:** 0.93

### F7 — Severity: minor

- **File:** `skills/shared/project-assets/hooks/automate-pen.sh:19-20`, `skills/shared/project-assets/project-setup.md:63`
- **Claim:** Startup probes now use `mkdtemp` + `AUTOMATE_PROBE_LOCK` and no longer write or delete `--root/.atomic-skills/status/automate/probe.lock` (`scripts/automate-run.js:98-156`, `205-248`). The shell still treats on-disk `probe.lock` as a deny (`elif [[ -f "$ON_DISK_PROBE" ]]`). Setup text still says `probe.lock` is the startup proof and that the hook allows every call unless `pen.lock` or `probe.lock` exists. There is no mtime/TTL/pid check and no recovery path.
- **Impact:** A leftover on-disk `probe.lock` from an older build (or any writer of that path) still wedges Claude/Codex/Grok PreToolUse until someone deletes the file. New crashes do not plant that file; old ones still do. Operators reading setup.md will look at the wrong lock.
- **Recommendation:** Ignore on-disk `probe.lock` unless it is the current `AUTOMATE_PROBE_LOCK` target, or require pid+boot id and delete stale files. Update setup.md to describe the tmpdir probe. Document `rm` of `status/automate/probe.lock` as recovery.
- **Confidence:** 0.8

### F8 — Severity: minor

- **File:** `tests/automate-host-pen.test.js:65-76`, `492-497`, `157-178`, `313-325`
- **Claim:** Several inverted behaviors stay green. (1) “requires Codex apply_patch and each host shell” only `replace('apply_patch|', '')` and never removes `Bash`/`shell`/`run_terminal_command`. (2) “startup calls `--require-external`” is a source regex on `automate-run.js`, not a spawn that fails when the flag is dropped. (3) Grok/plugin command resolution is never asserted (F2). (4) Same-basename script spoof is never asserted (F1). (5) Receipt first-match / `command=true` is never asserted (F4). (6) “ships the pen hook” still regex-matches generator/setup text for `NotebookEdit` / `automate-pen.sh`.
- **Impact:** The suite can stay green while the matcher shell list, Grok envelope expand, startup argv, or receipt parser regress. That is false coverage for the gates this slice added.
- **Recommendation:** Drop each host shell from the matcher and expect `assessPenRegistration` fail. Spawn `automate-run` against a fake detector to prove the flag. Add the runtime cases named in F1/F2/F4/F5.
- **Confidence:** 0.85

### F9 — Severity: note

- **File:** `scripts/automate-run.js:380`
- **Claim:** CLI entry is still `import.meta.url === \`file://${process.argv[1]}\``. Tests and the `--host-write-probe` child spawn an absolute path (`scripts/automate-run.js:267-270`). A relative `node scripts/automate-run.js` or a Windows `argv[1]` with backslashes does not match `file://` URLs, so `main()` never runs (exit 0, no gates).
- **Impact:** Relative invocation can no-op. The in-process probe child is safe because the parent passes `fileURLToPath(import.meta.url)`.
- **Recommendation:** Compare `fileURLToPath(import.meta.url)` to `resolve(process.argv[1])`.
- **Confidence:** 0.6

### F10 — Severity: note

- **File:** `scripts/automate-pen-hook.js:16-21`
- **Claim:** The hook waits for stdin `'end'`. `'error'` becomes `''` (empty tool + lock → deny). No byte limit, no timeout. If a host writes the JSON and leaves the pipe open, `node` never decides and the tool call hangs while the lock is held.
- **Impact:** Availability only, and only if a host leaves stdin open. Not demonstrated against a live host in this review.
- **Recommendation:** Bound the read (byte limit + timeout) and fail-closed on timeout.
- **Confidence:** 0.55

### F11 — Severity: note

- **File:** `scripts/find-unreviewed-plans.js:55-57`, `86-90`
- **Claim:** `--require-external` still requires a `- internal:` line first (`reviewReceiptGap`). Labels `internal-review` and `cross-model-review` are not reserved. Fenced examples inside `## Reviews` are not skipped. `runSyntheticProbe` still sends a hard-coded `apply_patch` payload (`scripts/automate-run.js:106-108`) regardless of `--host`. Empty/`.*` matchers still fail `parts.includes(tool)` (`src/automate-host-pen.js:222-226`).
- **Impact:** A plan with a real CLI receipt and no internal line still fails startup. A lookalike label or a fenced sample can satisfy the external check (together with F4). The synthetic probe cannot catch a Claude-only `decidePen('Write')` regression. A broader-than-pipe matcher is refused.
- **Recommendation:** If internal remains mandatory, say so in the `--require-external` failure text. Reserve prefix matches. Ignore fenced code. Parameterize the synthetic payload with `AUTOMATE_HOSTS[host].writeTools[0]`. Treat empty matcher as all-tools-covered, or document and test that a full pipe list is mandatory.
- **Confidence:** 0.7

---

## Checklist (second pass)

1. **Logic bugs** — F2 (nested `${}` expand vs shipped Grok command), F3 (dummy `filePath` + unparsed patch), F6 (null `PreToolUse` entry), F11 (empty matcher, internal-first). Re-read `decidePen` 319-338 and `resolvePenHookScript` 175-197 after the runtime probe.
2. **Race conditions** — F7 leftover on-disk `probe.lock`. `existsSync` then `readFileSync` on the lock (`scripts/automate-pen-hook.js:41-58`) is fail-closed if the file vanishes after the check (`JSON.parse` throws → `writerWorktree = null` → writes denied). Fail-open if a lock appears after `firstExisting` returns null is the no-lock allow path; window is small; not filed separately.
3. **Error handling** — lock JSON `catch` at `automate-pen-hook.js:56-58` continues with `writerWorktree = null` (deny: fail-closed). Stdin error → empty tool → deny. F6 is the uncaught registration throw. `hostShapedWrite` `invokedHook = !denied.error` (`scripts/automate-run.js:241`) is true for any successful `bash` spawn, including F1's stub.
4. **Security** — F1 (same-basename hook / differential stub), F3 (apply_patch path set), F4 (forged/first-match receipt), F5 (symlink allowlist). Missing `AUTOMATE_PEN_LOCK` now falls through (`automate-pen.sh:13-20`); not re-filed.
5. **Tests** — F8, plus the runtime cases under F1/F2/F3/F4/F5. `tests/automate-host-pen.test.js:109-145` now encodes unknown-tool deny (including `read_file` / `NotebookEdit` without a path).

No blocker-class issue on the second pass. Zero-findings clause does not apply.
