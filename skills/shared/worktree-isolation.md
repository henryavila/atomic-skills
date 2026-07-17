# Worktree isolation — a lazy helper asset

Per-agent / per-task filesystem isolation: a dedicated working tree so one executor's edits, lockfiles, and build artifacts never collide with the primary tree or another agent's. A **helper, not a core skill** — there is no "make me a worktree" user intent; it is consumed by `skills/core/implement.md` (Mode 2 Codex workspace-write executor) and `skills/core/parallel-dispatch.md` (per-agent isolation when tasks share a lockfile / build dir / root config). Not in `meta/catalog.yaml`; carries no Iron Law of its own.

**The portable primitive is raw `git worktree`** via {{BASH_TOOL}} — it runs identically on every host and is the same primitive the Codex workspace-write lane seeds from. The native harness worktree tool is an optional Claude-Code-only accelerator (below), never the only path.

---

## Step 0 — detect existing isolation BEFORE creating one

Do not nest isolation. Check first:

- **Already in a worktree?** Run `git rev-parse --git-common-dir` and compare to `git rev-parse --git-dir`; if they differ, the current tree is already a linked worktree — reuse it, do not create a second.
- **Already isolated by the harness?** If the executor was spawned into its own sandbox/container, a git worktree adds nothing — skip it.
- **Submodule guard.** Run `git rev-parse --show-superproject-working-tree`; if non-empty you are inside a submodule, where `git worktree` behaves surprisingly. Surface this and create the worktree from the superproject root, not the submodule.

A redundant worktree is pure overhead and a teardown hazard. Reuse-or-skip beats create-anyway.

## Create a worktree (portable)

From the primary tree, branched off the task's base ref:

```bash
# Branch does NOT exist yet — create it:
git worktree add -b <task-branch> <path-outside-the-repo> <base-ref>
# e.g. git worktree add -b impl/t-003 ../.wt-t-003 HEAD

# Branch already exists — reuse the branch without `-b` (Git fails if you pass -b):
git worktree add <path-outside-the-repo> <existing-branch>
# e.g. git worktree add .worktrees/plan-b plan/plan-b
```

- **Path placement.** For plan homes prefer inside-repo `.worktrees/<slug>` (git-ignored). For Mode 2 task isolation, put the worktree OUTSIDE the primary tree's path (a sibling dir) so file watchers, globs, and the build never recurse into it. Confirm with `git check-ignore` that the path is not accidentally tracked.
- **Branch, never detached.** Prefer a named branch and a clean merge target. A detached worktree strands commits.
- **Reuse without `-b`.** When the plan/task branch already exists, omit `-b` and attach a worktree to that branch. Passing `-b` against an existing branch is a hard failure (`fatal: a branch named '…' already exists`).
- **Base ref.** When creating a new branch, seed from the exact ref the task plans against (usually `HEAD` of the primary tree's current branch), so the diff is attributable.

## Use it

Point the executor's `cwd` at the worktree path. Read its diff with `git -C <path> diff` (or `git -C <path> status`) — never assume; read what actually changed. The primary tree stays byte-frozen while the executor works in isolation; the single-threaded-coding invariant (`implement.md`) is preserved because only the isolated executor writes inside its own tree.

## Teardown — merge-before-remove, never lose work

The dangerous moment is removal. **Verify the work is captured before you remove the worktree** — a `git worktree remove` of a tree with un-merged commits discards them silently.

1. Confirm the executor's verifier passed in the worktree (the completion evidence — see `verify-claim.md`).
2. **Merge/rebase back onto the primary branch** (operator-prompted in v1 — see `implement.md` Mode 2), then **re-run the verifier on the merged tree** before marking the task done (two adjacent-file tasks can each pass in isolation and conflict on merge).
3. Only after the work is on the primary branch: `git worktree remove <path>` (add `--force` only when you have confirmed there is nothing to lose). Then `git worktree prune` to clear stale metadata.
4. If a merge conflicts: abort the done transition, leave the task active, surface the conflict — do NOT force-remove the worktree (that is the work you would lose).

Run `git worktree list` to audit live worktrees; a leaked worktree from a crashed run is reclaimed with `prune`.

## Merge-back when a BATCH of worktrees exists (Mode 2, serial — R-XAGENT-03)

When Mode 2 dispatched several tasks into several worktrees, they pass *in isolation* concurrently — but they **merge back one at a time**, serialized through the primary tree. The single-threaded-coding Iron Law (`implement.md`) does not stop at the worktree edge; it extends to the merge, because the merge is where independent writers actually meet. The v1 procedure is **operator-prompted** (no unattended auto-rebase — that is the deferred v2):

1. **Pick ONE worktree** whose in-worktree verifier already passed. Never start a second merge while one is in flight — there is no concurrent two-worktree merge path.
2. **Merge/rebase it onto the primary branch** (operator-prompted), from the primary tree.
3. **Re-run that task's deterministic verifier on the MERGED primary tree** — not the worktree. An in-worktree pass is necessary, never sufficient: a second task that touched an adjacent file can have changed the primary since this worktree's base ref. Only a pass *here* is the entry token to `done` (`verify-claim.md`).
4. **On pass:** mark the task done, then `git worktree remove <path>` + `git worktree prune`. **On conflict or post-merge verifier FAIL:** abort the done transition, leave the task `active`, surface it — do NOT force-resolve-and-remove (force-removing the worktree discards the un-merged work). Route the failure to `atomic-skills:fix` or the user.
5. **Then, and only then, take the next worktree** — back to step 1. Each merge re-verifies against the tree the *previous* merge produced, so a conflict surfaces at the task that caused it, not as a tangled multi-task blob.

This is the deterministic serial step R-XAGENT-03 requires: pass-in-worktree → serial merge onto primary → re-verify on the merged primary → only then done; conflicts and post-merge fails leave the task active and never lose work.

## Claude Code accelerator (optional)

{{#if ide.claude-code}}
On Claude Code, the native worktree harness tools manage the same lifecycle with cleaner integration: `EnterWorktree(...)` creates + enters an isolated worktree and `ExitWorktree(...)` tears it down (auto-removing it if unchanged). Prefer these where available — they are the same isolation guarantee with less bookkeeping. The Step-0 detection, submodule guard, and merge-before-remove discipline above still apply; the native tool replaces only the raw `git worktree add/remove` mechanics, not the safety checks.
{{/if}}

This accelerator block is stripped on every other host, where the portable `git worktree` commands above are the path. Both routes leave identical durable state, so callers (`implement`, `parallel-dispatch`) do not branch on host.

## How implement.md and parallel-dispatch.md consume this

- `implement.md` **Mode 2 (Codex workspace-write)** → create an isolated worktree, point Codex's `--sandbox workspace-write` at it, read the diff back, then **merge back serially** (the *Merge-back when a BATCH of worktrees exists* procedure above) with a mandatory post-merge re-verify on the primary. Codex never writes the primary tree; worktrees never merge concurrently.
- `parallel-dispatch.md` → offer a per-agent worktree when dispatched tasks share a lockfile, build dir, or root config that would collide under concurrent writers (the collision class parallel-dispatch alone cannot solve).
