# F3 residual local review
**Verdict:** needs_changes
**Counts:** blocker 1, critical 4, major 6, minor 4, note 3

Callers: `runWriterSession` only `scripts/automate-run.js:601`. `writePenLock` only `scripts/automate-run.js:493,501` and `tests/automate-run-writer.test.js:338`. `inspectPenLock` only `scripts/automate-run.js:380` and the writer tests. `startHost` only `scripts/automate-run.js:494`.

## Blocker

### B1 — leftover writer branch makes every later run fail
- File: `scripts/automate-run.js:471`, `scripts/automate-run.js:481`, `scripts/automate-run.js:525-526`
- `writerBranch` is a fixed `impl/${slug}-${phaseId}-writer`. `git worktree add -b` creates that branch and fails if it exists. `finally` force-removes the worktree and `rmSync`s the directory. It never deletes, resets, or reuses the branch.
- After the first success or the first failure past line 481, the next invocation throws `git worktree add: fatal: a branch named 'impl/…-writer' already exists`. Happy-path retry is broken. Tests never invoke the runner twice on one repo (`tests/automate-run-writer.test.js:353-423`, `462-477`).

## Critical

### C1 — `pen.lock` is not exclusive; `finally` unlinks it even when this session does not own it
- File: `scripts/automate-run.js:363-372`, `scripts/automate-run.js:493-501`, `scripts/automate-run.js:518-521`
- `writePenLock` is `writeFileSync` overwrite. No `O_EXCL`, no pid CAS, no tmp+rename.
- `finally` always `removePenLock(lockPath)` after `reclaimStalePenLock` at 462, including when `acquireLeaseFile` throws at 488-491 before this session writes a lock.
- Two sessions sharing `lockDir` (two slugs: two leases, one `pen.lock`): last `writeFileSync` wins; the first `finally` unlinks the second session's lock while its writer is still running. The pen fence is then open.

### C2 — dead-pid reclaim of `pen.lock` does not reclaim the lease; crash / failed clear permanently blocks the plan
- File: `scripts/automate-run.js:488-492`, `scripts/automate-run.js:522-524`
- `acquireLeaseFile` is exclusive-create per slug (`src/writer-lease.js:326-334`). There is no stale-lease path keyed on writer pid.
- `clearLeaseFile` errors are swallowed. Unlink failure inside `clearLeaseFile` returns `false` and is not checked.
- `kill -9` after 492 skips `finally`. Next run: `reclaimStalePenLock` drops the dead `pen.lock`, then `acquireLeaseFile` throws `LEASE_EXISTS`. Dead pid did not block; the uncleared lease did. Secret died with the process, so the lease cannot be cleared by this code.

### C3 — host is spawned with empty argv and `stdio: 'ignore'`
- File: `scripts/automate-run.js:427-428`, `scripts/automate-run.js:494-498`, `scripts/automate-run.js:42`
- `spawn(opts.bin, [], { cwd, env, stdio: 'ignore' })`. No plan, phase, prompt, or argv. stdin/stdout/stderr discarded.
- Default bins are `claude` / `codex` / `grok` (`HOST_BINS`). That process cannot implement, and with stdin ignored it does not receive an operator session. Non-zero/timeout at 502-504 skips merge. Merge is only reached when `--host-bin` / `AIDECK_HOST_BIN` injects a self-exiting fake (`tests/automate-run-writer.test.js:177-196`, `243-244`).

### C4 — spawn `error` listener is attached only inside `wait()`; failed spawn can crash the process
- File: `scripts/automate-run.js:427-444`, `scripts/automate-run.js:499-500`
- `startHost` returns immediately after `spawn`. Listeners are registered only when `wait()` runs.
- Missing bin: `child.pid` is not an integer, line 500 throws, `wait()` never runs. ChildProcess `'error'` (ENOENT) has no listener. EventEmitter throws on unhandled `'error'`. `main` at 601-608 may report a clean failure and then the unhandled error still fires.

## Major

### M1 — `writePenLock` accepts an empty `writerWorktree` by resolving it to cwd (L-F2-1)
- File: `scripts/automate-run.js:364-367`
- `resolve(String(fields.writerWorktree || ''))` on `''` / missing is `process.cwd()`. The `!writerWorktree` check is after resolve, so it never fires. `existsSync(cwd)` is true. Empty cited path is written as a live lock on the current working directory. No directory check, no containment under `worktreeParent`, no symlink rejection. Tests cover only a missing non-empty path (`tests/automate-run-writer.test.js:333-348`).

### M2 — `isPidAlive` treats `EPERM` as dead; `reclaimStalePenLock` then deletes a live lock
- File: `scripts/automate-run.js:335-340`, `scripts/automate-run.js:382-384`
- `process.kill(n, 0)` `EPERM` means the pid exists. The `catch` returns `false`. `inspectPenLock` returns `stale-dead-pid`. `reclaimStalePenLock` unlinks. A live writer this process cannot signal loses the pen.

### M3 — kill is not a process group and death is not joined before the lock is dropped
- File: `scripts/automate-run.js:427-428`, `scripts/automate-run.js:431-433`, `scripts/automate-run.js:446-453`, `scripts/automate-run.js:518-521`
- `spawn` is not `detached`. `killQuiet` / `child.kill('SIGKILL')` target only the direct child. Grandchildren (bash `sleep` in the fake CLI at `tests/automate-run-writer.test.js:192-194`; real host children) stay alive.
- `killQuiet` swallows every error. `finally` does not loop on `isPidAlive`. `removePenLock` runs immediately after the signal. A still-running writer (or descendant) sees no lock.

### M4 — timeout kill does not resolve `wait()`; a failed SIGKILL hangs the session
- File: `scripts/automate-run.js:431-442`
- The timer only `child.kill('SIGKILL')`. `resolveWait` runs only on `'exit'` or `'error'`. If kill throws/no-ops and `'exit'` already fired or never fires, the promise never settles. `finally` never runs: lock, lease, and worktree remain.

### M5 — checkout + merge run in the operator `root`, not in an isolated tree
- File: `scripts/automate-run.js:511-515`
- If `HEAD` ≠ `planBranch`, `git checkout planBranch` mutates the operator worktree. Dirty files fail checkout or mix into the merge. A conflicted `git merge --no-edit` throws; `finally` deletes the writer worktree and leaves `root` in a merging state. No dirty-tree check, no `--abort`.

### M6 — “kills a still-living writer” does not fail when the pid is still alive
- File: `tests/automate-run-writer.test.js:407-419`
- The pid assertion is inside `if (existsSync(h.snapshot))`. Missing snapshot → only “lock file gone” and non-zero status. That is compatible with a hang killed by `spawnSync` timeout, a writer still running, or a descendant leak (M3). T-001 kill-before-release is not enforced.

## Minor

### m1 — `writePenLock` does not validate `pid`
- File: `scripts/automate-run.js:369-372`, `scripts/automate-run.js:355-359`
- `pid` is serialized as given. JSON `true` becomes `Number(true) === 1` in `inspectPenLock`. Pid 1 is alive → lock held until init dies. Same for any long-lived pid planted in the file.

### m2 — `Number(env.AUTOMATE_WRITER_TIMEOUT_MS || 60_000)` on garbage is NaN
- File: `scripts/automate-run.js:502`
- `Number('abc')` is `NaN`. `setTimeout(fn, NaN)` fires immediately. Writer is SIGKILL'd on the next turn.

### m3 — `statusRoot = dirname(lockDir)`
- File: `scripts/automate-run.js:483`, `scripts/automate-run.js:458-460`
- Lease files go in `dirname(lockDir)/writer-leases/`. A custom `--lock-dir` / `AUTOMATE_LOCK_DIR` that is not `…/status/automate` writes leases next to an arbitrary directory (`/tmp/writer-leases` if lock dir is `/tmp/locks`).

### m4 — `inspectPenLock` never evaluates the cited `writerWorktree`
- File: `scripts/automate-run.js:343-361`
- Kind is pid-only. A lock that cites a missing, empty, or escaped worktree with a live pid is `held`. Combined with M2/pid reuse, that lock stays until an unrelated pid dies. Write-path L-F2-1 does not apply on read.

## Notes

### N1 — no test that a second `runAutomate` on the same harness succeeds
- File: `tests/automate-run-writer.test.js:352-477`
- B1 is untested. Dead-pid reuse (`387-405`) is a first run against a planted lock, not a second real session.

### N2 — no integration test that a live pid lock refuses spawn
- File: `tests/automate-run-writer.test.js:269-298` vs `352-405`
- Unit test covers `inspectPenLock` `held`. `main`/`runWriterSession` reclaim-and-refuse is not exercised with a live foreign pid.

### N3 — T-003 “does not materialize” is a source string scan
- File: `tests/automate-run-writer.test.js:479-489`
- `assert.doesNotMatch(src, /phase-done/)` / `/materialize/` on `automate-run.js`. Does not prove runtime behavior beyond one run's stdout.

---

**Gate:** needs_changes. Do not ratify F3 while B1 (retry), C1 (pen exclusivity), C2 (lease residue), C3 (host argv/stdio), and C4 (unhandled spawn error) remain.
