# Local adversarial review — real-automate F0 (host pen + startup)

**Date:** 2026-09-25
**Mode:** local only (no host chat, no commit text, no author intent)
**Scope:** `scripts/automate-pen-hook.js`, `scripts/automate-run.js`, `scripts/find-unreviewed-plans.js`, `skills/shared/project-assets/hooks/automate-pen.sh`, `skills/shared/project-assets/project-setup.md`, `src/automate-host-pen.js`, `src/providers/skills-file-set.js`, `tests/automate-host-pen.test.js`
**Public symbols grepped (≤5 callers each):** `decidePen`, `pathInsideWorktree`, `assessPenRegistration`, `assessHostWrite`, `resolveAutomateHost`, `requiredPenTools`, `penMatcher`, `isExternalCliReceiptLine`, `reviewReceiptGap`, `findUnreviewedPlans`, `runSyntheticProbe`, `runHostWriteProbe`

## Severity counts

| Severity | Count |
|----------|------:|
| blocker  | 0 |
| critical | 2 |
| major    | 5 |
| minor    | 4 |
| note     | 3 |
| **total** | **14** |

Second checklist pass was performed after the first pass (logic, race, error handling, security, tests). Findings below are from that re-read, not from labels or comments in the tree.

---

## Findings

### F1 — Severity: critical

- **File:** `src/automate-host-pen.js:165-180` (allow-unknown), `src/automate-host-pen.js:16-21` (Claude write list), `skills/shared/project-assets/project-setup.md:80` and `src/providers/skills-file-set.js:215-216` (matcher)
- **Claim:** While a lock is held, `decidePen` denies only names in two exact-case Sets. Any other `toolName` returns `{ deny: false }`. Claude write tools in this same hook family already include `NotebookEdit` (`skills/shared/project-assets/hooks/pre-write.sh:347-351`, `stop.sh:192-214`). That name is absent from `AUTOMATE_HOSTS['claude-code'].writeTools`, from `penMatcher()`, and from both registered matchers. Runtime check: `decidePen({ lockHeld: true, toolName: 'NotebookEdit', filePath: '/repo/x.ipynb' })` → `{ deny: false }`. Same fail-open for lowercase `bash` (not `Bash`).
- **Impact:** The host never invokes the pen for `NotebookEdit` (matcher miss). If it did, the decision function would still allow it. A session with `pen.lock` / `probe.lock` held can still mutate product files through that write tool, and through any future write/shell name not copied into the Sets. The startup registration check cannot see the hole because `requiredPenTools('claude-code')` is `Write|Edit|MultiEdit|Bash`.
- **Recommendation:** Treat unmatched tools as deny while a lock is held (fail-closed), or keep an explicit read allowlist. Put `NotebookEdit` (and any other host write tool the sibling hooks already name) into `writeTools` **and** every matcher string. Compare tool names case-insensitively. Assert `decidePen({ lockHeld: true, toolName: 'NotebookEdit' }).deny === true` and that dropping `NotebookEdit` from the matcher fails `assessPenRegistration('claude-code', …)`.
- **Confidence:** 0.93

### F2 — Severity: critical

- **File:** `src/automate-host-pen.js:130-135` (used from `decidePen` at `src/automate-host-pen.js:175-176`)
- **Claim:** `pathInsideWorktree` only strips trailing slashes and then does `target === root || target.startsWith(root + '/')`. It does not `path.resolve`, does not collapse `..`, and does not refuse a root of `/`. Runtime: `pathInsideWorktree('/etc/passwd', '/') === true`; `pathInsideWorktree('/Volumes/External/code/x.js', '/') === true`; `pathInsideWorktree('/tmp/wt/../secret.js', '/tmp/wt') === true`; `pathInsideWorktree('/tmp/wt/sub/../../outside.js', '/tmp/wt') === true`. Sibling hook `pre-write.sh:39-72` already canonicalizes `..` for this reason. No test calls `pathInsideWorktree` with `..` or `/`.
- **Impact:** A lock whose `writerWorktree` is `/` (or `///`) makes every absolute write path “inside the worktree”, so `decidePen` allows every listed write tool against the host tree. A lock with a normal worktree still allows `/worktree/../host-file` and symlink-shaped strings. This is the only write allowlist the pen has.
- **Recommendation:** Resolve both paths (`path.resolve` at minimum; `realpath` if the worktree must not follow links), then require `rel === '' || !rel.startsWith('..') && !path.isAbsolute(rel)` via `path.relative`. Reject `writerWorktree` that resolves to `/` unless that is an explicit, tested policy. Add tests for `/`, `..`, sibling prefix `/tmp/wt` vs `/tmp/wt-evil`, and missing `writerWorktree`.
- **Confidence:** 0.96

### F3 — Severity: major

- **File:** `skills/shared/project-assets/hooks/automate-pen.sh:12-24` and `scripts/automate-pen-hook.js:21-25`
- **Claim:** If `AUTOMATE_PEN_LOCK` is set, it wins over an on-disk `pen.lock`. If that override path is not a regular file, the shell `exit 0`s. The Node hook does the same: `process.env.AUTOMATE_PEN_LOCK || default`, then `if (!existsSync(lockPath)) process.exit(0)`. A missing override is allow, not deny.
- **Impact:** Any environment that reaches the PreToolUse process can disable a real `pen.lock` by exporting `AUTOMATE_PEN_LOCK` to a non-existent path (user profile, IDE launcher, polluted CI env). `runSyntheticProbe` deletes this variable (`scripts/automate-run.js:115-116`); `hostShapedWrite` does not (`scripts/automate-run.js:215-220`), so the same env also corrupts the “host refused the write” proof.
- **Recommendation:** Missing override must fail-closed (exit 2) or fall through to `pen.lock`/`probe.lock`. Strip `AUTOMATE_PEN_LOCK` / `AUTOMATE_PROBE_LOCK` in `hostShapedWrite` the same way `runSyntheticProbe` does. Test: real `pen.lock` present + `AUTOMATE_PEN_LOCK=/no/such/file` → exit 2.
- **Confidence:** 0.9

### F4 — Severity: major

- **File:** `scripts/automate-run.js:211-223`, `src/automate-host-pen.js:100-103`, `src/automate-host-pen.js:152-163`
- **Claim:** The host-write proof is not a host write. `hostShapedWrite` runs `bash -c <command from hooks.json>`, sets `invokedHook = !denied.error` (spawn of bash succeeded), and `refused = (status === 2)`. `assessPenRegistration` accepts any command whose string `.includes('automate-pen.sh')`. Combined, `echo automate-pen.sh; exit 2` with a full matcher yields `invokedHook: true`, `refused: true`, no sentinel → `assessHostWrite` ok. `bash -c` also executes metacharacters from the hook file. Tests only drive Codex with an absolute script path (`tests/automate-host-pen.test.js:271-289`) and treat `result.ok === true` as enough.
- **Impact:** Startup can certify a pen that the host will never run. A hooks.json substring is enough. `bash -c` on that string is command injection at `automate-run` time. Parent-side `bash automate-pen.sh` is the thing the comments refuse to count; this path is not stronger.
- **Recommendation:** Require the command to invoke the script as argv (or parse a single `bash <path-ending-in/automate-pen.sh>`), check stderr for the pen’s deny line, and do not set `invokedHook` on a generic bash spawn. Prefer `spawnSync('bash', [scriptPath], …)` after resolving the path. Add a negative test: matcher complete, command `echo automate-pen.sh; exit 2` → `runHostWriteProbe` not ok.
- **Confidence:** 0.88

### F5 — Severity: major

- **File:** `skills/shared/project-assets/hooks/automate-pen.sh:7-17`, `scripts/automate-run.js:96-119` and `247-248`
- **Claim:** `probe.lock` is a deny for every matched write/shell, same as `pen.lock`. Startup writes it under `--root` (the real project tree, not a temp dir). Cleanup is `try/finally` + parent `rmSync`. SIGKILL, a hung `node` after the write, or a crash between `writeFileSync(probe)` and `finally` leaves the file. There is no mtime/TTL/owner check.
- **Impact:** A killed `automate-run` wedges Claude/Codex/Grok PreToolUse: product writes and shells exit 2 until someone deletes `.atomic-skills/status/automate/probe.lock`. That is an availability failure of the same mechanism used as “startup proof”.
- **Recommendation:** Put the probe lock under `mkdtemp` (or `$TMPDIR`) and pass it only via `AUTOMATE_PROBE_LOCK`. If a tree-local probe must exist, write a pid+boot id and ignore/delete stale files. Document a recovery path. Test a leftover probe after a simulated kill.
- **Confidence:** 0.86

### F6 — Severity: major

- **File:** `scripts/find-unreviewed-plans.js:45-57` and `81-82`; wired from `scripts/automate-run.js:336`
- **Claim:** `--require-external` only checks that some Reviews line is not labeled `internal` / `ground-truth` / `cross-model…` and that the rest matches `\b(command|cli)\s*=\s*\S`, `\bexit\s*=\s*\d+`, `\bverdict\s*=\s*\S`. `verdict=needs_changes`, `verdict=FAIL`, and `exit=1` all count. `command=true` counts. The suite’s passing fixture is a hand-written line (`tests/automate-host-pen.test.js:247-260`). No caller of `isExternalCliReceiptLine` besides `reviewReceiptGap`.
- **Impact:** `automate-run` will accept a plan whose only “external” review failed, was skipped, or was typed by the session. The flag blocks a lone `- internal:` line (that part holds) and then green-lights any three tokens. That is not a CLI receipt.
- **Recommendation:** Require `verdict` in a pass set (`CLEAN`/`PASS`/equivalent) and `exit=0`. Keep the reserved-label exclusions. If the receipt must be real, bind to a sidecar file the CLI wrote (path + hash), not a markdown line. Tests: `verdict=needs_changes` → exit 1; `command=` empty → exit 1; inverted pass-set must fail.
- **Confidence:** 0.84

### F7 — Severity: major

- **File:** `scripts/automate-pen-hook.js:46-51` plus `src/automate-host-pen.js:174-178`; Codex write tool at `src/automate-host-pen.js:22-25`
- **Claim:** The only Codex write tool is `apply_patch`. The hook reads `file_path` / `path` / `target_file` / `notebook_path` only. Codex patch payloads carry hunks, not those keys, so `filePath` is `''`, `pathInsideWorktree` is false, and every `apply_patch` is denied even when `writerWorktree` is set. There is no parse of patch headers (`*** Add File:`, `*** Update File:`).
- **Impact:** The documented worktree exception cannot work on Codex. Either writers can never patch inside their tree, or someone will weaken `decidePen` later to allow empty-path `apply_patch` and then every Codex patch bypasses the path check.
- **Recommendation:** Parse paths out of the patch body (and any structured `changes` field). Deny if any path is outside the worktree. If F0 has no writer, still lock the contract with a test: `apply_patch` + patch touching `/wt/a.js` and `/etc/passwd` → deny.
- **Confidence:** 0.8

### F8 — Severity: minor

- **File:** `src/automate-host-pen.js:99-104`
- **Claim:** `entries.find((entry) => (entry.hooks || []).some(...))` dereferences `entry.hooks` without a null check. `penHookCommand` in `scripts/automate-run.js:65-66` skips null entries; `assessPenRegistration` does not. A `PreToolUse: [null, {…}]` config throws inside `main()` with no `try/catch` (`scripts/automate-run.js:318`).
- **Impact:** Startup dies on an uncaught `TypeError` instead of appending a blocker and exiting 1. Same throw in `hostShapedWrite` after a command was already found, so the child can exit non-zero without `HOST_WRITE_PROBE=`.
- **Recommendation:** Mirror `penHookCommand`’s null/type guard. Catch around registration in `main()` and push `pen.reason` / `String(err)`.
- **Confidence:** 0.87

### F9 — Severity: minor

- **File:** `src/automate-host-pen.js:111-115`
- **Claim:** A missing or empty `matcher` is treated as “missing every required tool”. Hosts that omit matcher to run PreToolUse on all tools (broader than the pipe list) fail registration. A matcher of `.*` also fails `parts.includes('Write')`.
- **Impact:** A strictly stronger hook install is refused. Operators can “fix” that by pasting a pipe string that does not match how the host actually filters, splitting registration from invocation.
- **Recommendation:** Empty matcher ⇒ all tools covered (or document that a full pipe list is mandatory and test both). If the host uses regex matchers, test `includes` vs actual match semantics.
- **Confidence:** 0.7

### F10 — Severity: minor

- **File:** `tests/automate-host-pen.test.js:62-73`, `133-143`, `264-268`; `tests/install.test.js:509-511`; `tests/project.test.js:441-446` and `609-614`
- **Claim:** Several new paths would not go red if the behavior inverted. (1) “each host shell on the pen entry” only deletes `apply_patch|` and never removes `Bash`/`shell`/`run_terminal_command`. (2) “startup calls `--require-external`” is a source regex on `automate-run.js`, not a spawn that fails when the flag is dropped at runtime. (3) “ships the pen hook on the Grok plugin” regex-matches `skills-file-set.js` text; `project.test.js` still only reads `PreToolUse[0]` (pre-write). (4) `install.test.js` still allowlists `session-start.sh|stop.sh|pre-write.sh|config.json` and never names `automate-pen.sh`. (5) No test for `NotebookEdit`, `pathInsideWorktree('..')`, or command-substring spoof (F1/F2/F4).
- **Impact:** The suite can stay green while the matcher, Grok envelope, or startup argv regress. That is false coverage for a fail-closed pen.
- **Recommendation:** Assert installed `hooks.json` has a second PreToolUse whose command ends with `automate-pen.sh` and whose matcher includes each `requiredPenTools(host)`. Spawn `automate-run` against a fake detector to prove the flag. Add `automate-pen.sh` to the install hook list. Add the negative cases in F1/F2/F4.
- **Confidence:** 0.9

### F11 — Severity: minor

- **File:** `scripts/automate-run.js:96-109` and `246-248`
- **Claim:** `runSyntheticProbe` / `runHostWriteProbe` `mkdirSync` and write under `--root` even when `--host` / `--plan` are already invalid. A refused run still creates `.atomic-skills/status/automate/` in the target tree. `runSyntheticProbe` always uses an `apply_patch` payload, so a Claude-only regression in `decidePen('Write')` would not fail that probe.
- **Impact:** Noise in git status on failed startup; probe does not cover the host it is supposed to certify except via the later, spoofable host-shaped path.
- **Recommendation:** Probe in a temp directory, or skip probes when host/plan are already missing. Parameterize the synthetic payload with `AUTOMATE_HOSTS[host].writeTools[0]`.
- **Confidence:** 0.75

### F12 — Severity: note

- **File:** `scripts/automate-pen-hook.js:14-19`
- **Claim:** The hook waits for stdin `'end'`. `'error'` becomes `''` (then empty tool + lock → deny). If a host writes the JSON and does not close stdin, `node` never decides and the tool call hangs while the lock is held.
- **Impact:** Availability only, and only if a host leaves the pipe open. Not demonstrated against a live host in this review.
- **Recommendation:** Bound the read (byte limit + timeout) and fail-closed on timeout.
- **Confidence:** 0.55

### F13 — Severity: note

- **File:** `scripts/automate-run.js:363`
- **Claim:** CLI entry is `import.meta.url === \`file://${process.argv[1]}\``. Tests spawn with an absolute path (`tests/automate-host-pen.test.js:305-310`). A relative `node scripts/automate-run.js` or a Windows `argv[1]` with backslashes does not match `file://` URLs.
- **Impact:** Relative invocation can no-op (exit 0, no gates). The `--host-write-probe` child uses `fileURLToPath(import.meta.url)` so that path is safe.
- **Recommendation:** Compare `fileURLToPath(import.meta.url)` to `resolve(process.argv[1])`.
- **Confidence:** 0.6

### F14 — Severity: note

- **File:** `scripts/find-unreviewed-plans.js:50-52` and `81-82`
- **Claim:** `--require-external` still requires a `- internal:` line first. Labels `internal-review` and `cross-model-review` are not reserved (`^internal$` / `^cross-model(\s|$|\()`). Fenced examples inside `## Reviews` are not skipped.
- **Impact:** A plan with a real CLI receipt and no internal line still fails startup. A plan can also satisfy the external check with a lookalike label or an example block.
- **Recommendation:** If internal remains mandatory, say so in the CLI failure text. Reserve prefix-matches for `internal*` / `cross-model*`. Ignore fenced code in the Reviews section.
- **Confidence:** 0.65

---

## Checklist (second pass)

1. **Logic bugs** — F1 (unknown-tool allow), F2 (`/` and `..`), F7 (Codex patch paths), F8 (null entry throw), F9 (empty matcher), F14 (label matching). Re-read `decidePen` 165-180 and `pathInsideWorktree` 130-135 after the runtime probe.
2. **Race conditions** — F5 (leftover `probe.lock`). TOCTOU on `existsSync` then `readFileSync` in `automate-pen-hook.js:25-35` is fail-closed if the file vanishes (lockHeld already true) and fail-open if it appears after the check; not filed separately (window is small; F3 is the env-shaped fail-open).
3. **Error handling** — lock JSON `catch` at `automate-pen-hook.js:33-35` continues with `writerWorktree = null` (writes denied: fail-closed, not filed). Stdin error → empty tool → deny (fail-closed). F8 is the uncaught registration throw. `collectPlanFile` still swallows read errors (`find-unreviewed-plans.js:110-112`); pre-existing, not introduced by the options plumbing.
4. **Security** — F1 (matcher/decision bypass), F2 (path allowlist), F3 (env override), F4 (`bash -c` + substring), F6 (forged receipt).
5. **Tests** — F10, plus missing assertions named under F1/F2/F4. `tests/automate-host-pen.test.js:94` encodes the unknown-tool allow (`read_file` → not denied) and does not distinguish reads from unlisted writes.

No additional blocker-class issue on the second pass. Zero-findings clause does not apply.
