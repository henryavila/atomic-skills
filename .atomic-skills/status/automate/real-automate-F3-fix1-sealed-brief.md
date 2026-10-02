# Phase writer brief — real-automate F3 review-fix

You are a **code-only** writer in `/home/henry/atomic-skills/.worktrees/real-automate-F3-fix1` on `impl/real-automate-F3-fix1` at `4d99c1e9`.

## Fence
- Edit ONLY `scripts/automate-run.js` and `tests/automate-run-writer.test.js`.
- Do NOT touch `.atomic-skills/`, `writer-lease.js`, `automate-phase-run.js`.
- Do NOT call `done` / `phase-done`. Explicit-path commits. Never `git add .`. Do not push.
- Do NOT inflate automate-run.js (L-F2-2). Keep the fix small. Existing 14 tests must stay green; add tests for the named findings only.

## Findings to close (TDD — failing tests first)

Read:
- `.atomic-skills/reviews/2026-10-02-real-automate-F3-residual-local.md`
- `.atomic-skills/reviews/2026-10-02-real-automate-F3-residual-codex.md`
(from the plan tree if missing here: `/home/henry/atomic-skills/.worktrees/real-automate/.atomic-skills/reviews/`)

### B1 — leftover writer branch (blocker)
`git worktree add -b impl/${slug}-${phaseId}-writer` never deletes/reuses the branch. Second run fails. `finally` removes the worktree only.
Fix: unique branch per attempt **or** reuse without `-b` when the branch exists **and** delete/reset the branch in `finally`. Test: two successive `runAutomate` on the same fixture both exit 0.

### C1 — pen.lock not exclusive; finally unlinks a lock this session does not own
`writePenLock` is overwrite. `finally` always `removePenLock`.
Fix: exclusive create (`wx` / O_EXCL). Remove the lock only if this session owns it (pid/token match). Do not unlink if acquireLeaseFile throws before this session wrote the lock. Coordinator pid (`process.pid`) owns the lock through merge (do not switch the lock pid to the child so a second run can steal during merge).

### C2 — lease residue after crash (in this file only)
Do not swallow `clearLeaseFile` failure (throw). If `acquireLeaseFile` throws LEASE_EXISTS, do not delete someone else's `pen.lock`; put the lease path in the error. Do not edit `src/writer-lease.js`.

### C3 — empty argv / stdio ignore (bounded)
`spawn(bin, [], { stdio: 'ignore' })`. Fake-host tests still work. Pass a non-empty argv from env/`args.hostArgs` (default `[]` only when injected fake does not need args). Attach stdin so a script can run. Do **not** invent a full Claude/Codex prompt protocol (F4). Test: spawn receives argv from `AUTOMATE_HOST_ARGS` or equivalent.

### C4 — spawn error listener only inside wait()
Register `'error'` on the child in `startHost` immediately. Missing bin must not become an unhandled EventEmitter error. Test: missing `hostBin` path exits nonzero and leaves no lock.

### M1 / L-F2-1 — empty writerWorktree
Do not `resolve('')` to cwd. Empty/missing `writerWorktree` throws before write. Test: empty string fails closed, no lock file.

## Verifier
```
node --test tests/automate-run-writer.test.js
```
Keep-green: `node --test tests/automate-host-pen.test.js` and `node --test tests/find-missing-ui.test.js`.

## Claim report
Write `/tmp/real-automate-F3-fix1-claims.json` with taskId `T-001` (lock/retry) covering the product files. `claimed-pass` only if verifier exit 0. `base`: `4d99c1e9`. Print the JSON as the final message.
