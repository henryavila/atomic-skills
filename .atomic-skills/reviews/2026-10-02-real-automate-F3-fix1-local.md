# F3-fix1 residual local review
**Verdict:** needs_changes
**Counts:** blocker 1, critical 1, major 3, minor 3, note 2

**Ref:** `scripts/automate-run.js`, `tests/automate-run-writer.test.js` (F3-fix1 uncommitted). Callers of `writePenLock` / `inspectPenLock` / `startHost` / `runWriterSession`: these two files only (`runWriterSession` from `main`).
**Mode:** local, adversarial. No fixes applied. Two-pass read of the captured diff then both files from line 1.
**Contract:** exclusive `pen.lock` (O_EXCL, owner-only unlink, coordinator pid), unique-or-reused `impl/<slug>-<phaseId>-writer`, spawn argv + immediate spawn-error, empty `writerWorktree` fail-closed, leftover-branch second run.

| # | Severity | Finding |
|---|----------|---------|
| F-001 | blocker | Writer worktree `add -B` and finally `worktree remove` + `branch -D` run outside the exclusive lease/`pen.lock`. LEASE_EXISTS and concurrent losers destroy the shared writer branch/tree. |
| F-002 | critical | `isPidAlive` treats `EPERM` as dead. `reclaimStalePenLock` unlinks a live foreign-uid lock. |
| F-003 | major | `startHost` `wait()` timeout only SIGKILLs; it never `finish()`es. Missed `exit` after kill hangs the coordinator with lock+lease held. |
| F-004 | major | `finally` throws on lease residue and lets `clearLeaseFile` throw, masking the try error (including a completed merge). |
| F-005 | major | "Kills a still-living writer" asserts `lock.pid` dead after C1 switched that pid to the coordinator; the check is true because `spawnSync` already exited. |
| F-006 | minor | `hostArgv` swallows invalid JSON and whitespace-splits the raw string. |
| F-007 | minor | "Second run" never plants a leftover `impl/<slug>-<phase>-writer` branch; it only reruns after `finally` `branch -D`. |
| F-008 | minor | Missing-bin test matches generic `implement --automate failed`. |
| N-001 | note | `wait()` snapshots `spawnErr` but not `exit`; same-turn `wait()` hides it. |
| N-002 | note | Host stdout/stderr are `ignore`; `result.stderr` is empty on non-spawn exits. |

---

## F-001 [blocker] writer git objects mutated and deleted without the exclusive lease/lock

- **File:** `scripts/automate-run.js:519-522`, `scripts/automate-run.js:530-547`, `scripts/automate-run.js:575-580`
- **Test gap:** `tests/automate-run-writer.test.js:526-541` (C2 drives this path and does not assert branch/worktree survival)

Worktree path and writer branch are deterministic (`<parent>/<slug>-<phaseId>-writer`, default `impl/<slug>-<phaseId>-writer`). Exclusive create of the lease and of `pen.lock` happens *after* this:

```javascript
  gitExec(root, ['worktree', 'remove', '--force', worktreePath]);
  rmSync(worktreePath, { recursive: true, force: true });
  gitOrThrow(root, ['worktree', 'add', '-B', writerBranch, worktreePath, 'HEAD'], 'git worktree add');
  // ...
  try {
    lease = acquireLeaseFile(...); // LEASE_EXISTS thrown here
    writePenLock(...);
```

`finally` always runs after `add -B` because `add` is outside `try`:

```javascript
    gitExec(root, ['worktree', 'remove', '--force', worktreePath]);
    rmSync(worktreePath, { recursive: true, force: true });
    gitExec(root, ['branch', '-D', writerBranch]);
    if (lockHeld) removePenLock(lockPath, ownerPid);
```

On `LEASE_EXISTS`, `lockHeld` is false and `leaseSecret` is null. The session still `-B` resets the shared branch to `HEAD`, then `branch -D` deletes it, then leaves the foreign lease in place.

Reachable cases:

1. C2 setup (lease file present, no `pen.lock`): the test already takes this path. It only checks `pen.lock` was not written.
2. Crash of a prior coordinator: `reclaimStalePenLock` unlinks dead-pid `pen.lock`; leftover `writer-leases/<slug>.json` still exists; next run destroys leftover writer commits (`-B` then `-D`) and still fails `LEASE_EXISTS`.
3. Two concurrent sessions after an absent lock: both pass reclaim; both `worktree add -B` on the same path (the second `worktree remove --force` wipes the first); winner takes the lease; loser hits `LEASE_EXISTS` and in `finally` deletes the winner's worktree and writer branch while the winner writes `pen.lock` and `spawn`s with `cwd: worktreePath`.

wx on `pen.lock` and O_EXCL on the lease do not protect git objects that were mutated before acquire and deleted on the losing path.

---

## F-002 [critical] `EPERM` from `kill(pid, 0)` is treated as a dead pid; reclaim steals a live lock

- **File:** `scripts/automate-run.js:334-342`, `scripts/automate-run.js:361-362`, `scripts/automate-run.js:391-396`
- **Contrast:** `src/parallel-state.js:69-77` (`EPERM` = alive)

```javascript
export function isPidAlive(pid) {
  // ...
  try {
    process.kill(n, 0);
    return true;
  } catch {
    return false;
  }
}
```

`process.kill(n, 0)` throws `ESRCH` when the pid is gone and `EPERM` when the process exists but the caller cannot signal it. The blanket `catch` returns false. `inspectPenLock` then returns `stale-dead-pid`. `reclaimStalePenLock` calls `removePenLock(lockPath)` *without* `ownerPid` and unlinks.

A live coordinator running as another uid (shared checkout, CI user vs developer, container vs host) has its `pen.lock` stolen. Combined with F-001, the stealing session then `worktree remove --force` / `-B` / `branch -D` on the victim's writer tree. This was an F3 residual; the fix1 diff does not touch `isPidAlive`.

---

## F-003 [major] `wait()` timeout does not settle the promise

- **File:** `scripts/automate-run.js:466-481`

```javascript
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      }, timeoutMs);
      const finish = (result) => { /* settled + clearTimeout + resolveWait */ };
      child.on('error', (err) => finish({ status: 1, stderr: err.message }));
      child.on('exit', (code) => finish({ status: code == null ? 1 : code, stderr: '' }));
      if (spawnErr) finish({ status: 1, stderr: spawnErr.message });
```

Timeout only attempts `SIGKILL`. `finish` is not called. Completion depends on a later `'exit'` or `'error'`. If `kill` throws (pid already gone, never assigned) and `'exit'` already fired before the `wait()` listeners were attached, no second `'exit'` is emitted. `wait()` hangs. `runWriterSession`'s `finally` does not run. `pen.lock` (wx, live coordinator pid) and the writer lease stay held until an external kill of the coordinator.

`AUTOMATE_WRITER_TIMEOUT_MS` does not bound the function it names.

---

## F-004 [major] throw inside `finally` masks the session error and can reject a completed merge

- **File:** `scripts/automate-run.js:575-588`

```javascript
    if (lockHeld) removePenLock(lockPath, ownerPid);
    if (leaseSecret) {
      const leftover = leasePath(statusRoot, slug);
      const cleared = clearLeaseFile(statusRoot, slug, leaseSecret);
      if (!cleared && existsSync(leftover)) {
        throw new Error(`clearLeaseFile left residue (${leftover})`);
      }
    }
```

`clearLeaseFile` also throws (`LEASE_MALFORMED`, `LEASE_SECRET_MISMATCH`) and those throws originate in `finally`.

A throw from `finally` replaces the try rejection (`host CLI exited …`, merge failure) and replaces a `return 0` after `merged; stopping`. Lock unlink already ran (`lockHeld`). If clear did not remove the file, the lease remains. Next run: no `pen.lock`, F-001 git teardown, `LEASE_EXISTS`. Operator sees residue, not the host/merge error; a successful merge still leaves the plan blocked.

---

## F-005 [major] still-living-writer test no longer observes the writer pid

- **File:** `tests/automate-run-writer.test.js:481-497`
- **Cause:** `scripts/automate-run.js:546` writes `ownerPid = process.pid` (coordinator), not `writerPid`

```javascript
      if (existsSync(h.snapshot)) {
        const lock = JSON.parse(readFileSync(h.snapshot, 'utf8'));
        assert.equal(isPidAlive(lock.pid), false);
      }
```

The fake CLI copies `pen.lock` then writes `$$` to `snapshot.pid`. After C1, `lock.pid` is the `automate-run.js` coordinator. The test process waits on `spawnSync`; when this assertion runs that coordinator has already exited. `isPidAlive(lock.pid)` is false even if `finally` never called `killQuiet(writerPid)` and the bash `sleep` is still running. The test still checks `pen.lock` is gone (so `finally` ran) but the kill-before-release claim is untested. `snapshot.pid` is unread here.

---

## F-006 [minor] invalid `AUTOMATE_HOST_ARGS` JSON is split as shell words

- **File:** `scripts/automate-run.js:439-451`

`JSON.parse` failure is swallowed. `["--prompt"` becomes tokens `["--prompt"`. The host is spawned with garbage argv and a zero exit is treated as a successful writer session. C3 only covers well-formed JSON.

---

## F-007 [minor] B1 second-run test does not plant a leftover writer branch

- **File:** `tests/automate-run-writer.test.js:514-524`

The residual was `git worktree add -b` failing when `impl/<slug>-<phase>-writer` still existed after `worktree remove`. This test runs a full session twice. Production `finally` already `branch -D`, so the second `add -B` is not exercising leftover-branch reuse. Crash leftover (worktree gone, branch remains, no `finally`) is untested.

---

## F-008 [minor] C4 missing-bin matcher accepts any `runWriterSession` failure

- **File:** `tests/automate-run-writer.test.js:596-608`

```javascript
      assert.match(
        `${res.stdout}\n${res.stderr}`,
        /ENOENT|did not start|no such file|implement --automate failed/i,
      );
```

`main` prefixes every `runWriterSession` rejection with `implement --automate failed:`. A worktree-add failure, lease error, or merge error satisfies the assertion. The test does require `pen.lock` absent, which is true on any throw before `lockHeld = true` as well as after `finally`. It does not prove the spawn `'error'` path ran.

---

## N-001 [note] `wait()` does not snapshot `'exit'` the way it snapshots `'error'`

- **File:** `scripts/automate-run.js:462-480`

`spawnErr` is assigned on the immediate `'error'` listener so a pre-`wait()` spawn failure still settles. `'exit'` is not recorded. Current `runWriterSession` calls `wait()` in the same turn as `spawn`, so `'exit'` is still queued. An `await` inserted between `startHost` and `wait()` hangs until F-003's timeout kill (and hangs for good if kill does not re-emit `'exit'`).

---

## N-002 [note] host stdio stdout/stderr are ignored

- **File:** `scripts/automate-run.js:456-460`, `scripts/automate-run.js:479`

`stdio: ['pipe', 'ignore', 'ignore']` plus `stdin.end()`. `'exit'` always finishes with `stderr: ''`. Spawn `ENOENT` still surfaces via the `'error'` event. Host CLI failure text is dropped; `host CLI exited ${status}` is the only signal.

---

Closed against this diff (not re-filed): empty/`missing` `writerWorktree` no longer `resolve('')` to cwd (`365-373`, test `356-380`); `writePenLock` uses `flag: 'wx'` (`378`, test `382-401`); `removePenLock(lockPath, ownerPid)` refuses a non-matching pid (`382-388`, test `404-422`); coordinator pid stays on the lock through spawn (`546`, test `499-512`); `startHost` registers `'error'` before `wait()` (`462-465`); `hostArgv` reads `AUTOMATE_HOST_ARGS` (`439-451`, `550`, test `579-594`).
