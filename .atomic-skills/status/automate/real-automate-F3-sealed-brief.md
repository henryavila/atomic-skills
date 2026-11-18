# Phase writer brief — real-automate F3

You are a **code-only phase writer**. Isolated sibling worktree. No host chat history.

## Code-only fence
MAY: edit admitted paths; run verifiers; explicit-path microcommits (`rtk git add <paths>`; never `git add .` / `-A`).
MUST NOT: `done` / `phase-done`; mutate `.atomic-skills/` plan state; self-certify; nest worktrees.

## Work-order
- **planSlug:** real-automate
- **phaseId:** F3
- **cwd:** `/home/henry/atomic-skills/.worktrees/real-automate-F3-writer`
- **writerBranch:** `impl/real-automate-F3-writer`
- **baseRef:** `2766be68`
- **initiative (read-only):** `/home/henry/atomic-skills/.worktrees/real-automate/.atomic-skills/projects/atomic-skills/real-automate/phases/f3-um-writer-merge-e-para.md`

### Admitted paths
- `scripts/automate-run.js`
- `tests/automate-run-writer.test.js`
- Keep-green: `tests/automate-host-pen.test.js` (edit only if T-003 of F2 keep-green breaks; prefer not)

### scopeBoundary
- Do not call `scripts/automate-phase-run.js`.
- Do not run phase-done, review both, audit-delivery.
- Do not materialize the next phase.
- Do not use the chat session as the writer.
- Do not write `lastAssert` from this writer.

### Lessons applied
- **L-F2-1:** If `pen.lock` cites `writerWorktree` / pid / owner, missing path or dead-pid handling is explicit. `existsSync` skip is not a pass.
- **L-F2-2:** Do not inflate `automate-run.js` into a 2000-line runtime. Target: keep the spawn/merge slice under ~250 added lines. Tests in one file.

## Current code
`scripts/automate-run.js` after the six gates prints `writer spawn is not in this build` and `process.exit(2)` (around line 376). Replace that with the F3 slice.

## Implement all 3 tasks (TDD)

Verifier for every task:
```
node --test tests/automate-run-writer.test.js
```

**T-001 Lock na partida real**
After gates pass: write `.atomic-skills/status/automate/pen.lock` with owner, pid, `writerWorktree`. Delete the lock on exit, including failure (`try/finally`). Dead pid does not block a later run.

**T-002 Spawn do host**
Create a git worktree from `scripts/automate-run.js` (not automate-phase-run.js). Spawn a subprocess (`claude` / `codex` / `grok` path injectable for tests). Fake host CLI writes a file inside the writer worktree. Chat session is not the writer.

**T-003 Merge e pare**
Merge the writer branch into the plan branch. Process exits 0 once. Do not call phase-done. Do not materialize a second phase. Plan branch contains the writer file.

Injection for tests: env or argv for `AIDECK_HOST_BIN` / fake CLI path, worktree parent dir, lock dir — so the test does not touch the real repo worktrees.

## Keep-green
`node --test tests/automate-host-pen.test.js` and `node --test tests/find-missing-ui.test.js` still pass. Existing F0/F1/F2 gates still refuse before spawn.

## Git
Commits like `feat(T-001): write pen.lock around writer spawn`. Explicit paths only. Do not push.

## Claim report
Write `/tmp/real-automate-F3-claims.json` with all three tasks (claimed-pass only if verifier exit 0). Print it as the final message.
`base`: `2766be68`.
