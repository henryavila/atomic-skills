# F4 — Live proof-on-throwaway-repo for the Codex write-mode lane (DONE, 2026-06-02)

The one piece of WF-IMPL-2 that was specified + pressure-tested but never
exercised against a real Codex run. F4-G1 required: *a real Codex
`--sandbox workspace-write` run completes a 3-task batch in worktrees, merges
serially with post-merge re-verify, and writes `dispatch-log.json` — all on a
throwaway repo, fenced from the live `.atomic-skills/` tree.* **Met.**

## Setup (throwaway repo, fenced)

- Repo: `/tmp/codex-lane-proof-20260602T123950Z` (`git init`, disposable).
- 3 RED `node:test` suites committed first (`test/add|slugify|reverse.test.js`),
  each `require()`-ing a `src/*.js` that did not yet exist → suite RED at base
  commit `55b0799`.
- `.atomic-skills/status/routing.json` authored with `mode2Enabled: true` +
  `codexLane.enabled: true` (sandbox `workspace-write`, `timeoutSeconds: 300`,
  `minBatchTasks: 3`). **Validated against `meta/schemas/routing.schema.json`
  with ajv → VALID** (the real schema, not a throwaway copy).
- Tooling present: `codex-cli 0.134.0`, `perl` (no GNU `timeout`/`gtimeout` on
  this macOS host → the perl-`alarm` branch of `run_with_timeout` was the one
  actually exercised, confirming the portable fallback the memory flagged).

## Gate decision (R-EXEC-32/33)

`N = 3 ≥ K = 3`; the three file sets (`src/add.js`, `src/slugify.js`,
`src/reverse.js`) are pairwise disjoint ⇒ ≥2 scope-independent; **F1** (mechanical
+ independent) ✓, **F2** (every task a deterministic `node --test` verifier) ✓,
**precond** (Codex dispatchable) ✓, **T1** (idle Codex quota) ✓ ⇒ **Mode 2 fires.**

## Dispatch (R-EXEC-35 / `invocation-workspace-write.txt` verbatim)

For each task: parent clean-tree preflight passed → `git worktree add -b impl/t-10X
<sibling-path> HEAD` (worktree OUTSIDE the repo) → per-task briefing built per the
handoff work-order contract (R-EXEC-40: Create/Modify/Test split, intent narrative,
`scopeBoundary[]` + DO-NOT block, verifier verbatim) → Codex run with cwd = the
worktree:

```
run_with_timeout 300 codex -a never exec \
  -c model_reasoning_effort=high \
  --sandbox workspace-write \
  --skip-git-repo-check --ephemeral \
  -o <out> - < BRIEFING.md 2>/dev/null
```

All three exited `0`. Each produced **only its scoped `src/*.js`** (confirmed via
`git -C <worktree> status --porcelain` — only the scoped file + my orchestration
sidecars appeared). Each Codex run self-**checked** its verifier (`pass 1, fail 0`)
and reported staying in scope — but was never trusted to self-**certify**.

## Serial merge-back (R-XAGENT-03 / worktree-isolation.md §Merge-back)

One worktree at a time, never concurrent: commit the scoped file onto `impl/t-10X`
→ `git merge` onto `main` → **re-run that task's verifier on the MERGED primary
tree** (T-101 fast-forward; T-102/T-103 real merges over the tree the previous
merge produced) → pass ⇒ done + `worktree remove`/`prune`. Final primary:

- `node --test` full suite on `main` → **all GREEN** (`fail 0`).
- `main` history: scaffold → T-101 / merge → T-102 / merge → T-103 / merge.
- `src/add.js` + `src/slugify.js` + `src/reverse.js` all present on `main`.
- `dispatch-log.json` sidecar = **3 records, all 11 spec fields present, all
  `verifierPassed: true`, `escalationCount: 0`** (shape asserted in-script
  against the §9 contract).

## Fence verification

After the run, the live `.atomic-skills/` tree was untouched: no `status/` dir,
no leaked `routing.json`/`dispatch-log.json`, `validate-state` still **23 valid /
7 plans GREEN**. Codex write-mode never pointed at the real tree (canon Decision #11).

## Empirical findings routed back to the lane spec (NOT failures — clarifications)

The run succeeded; two seams in the prose surfaced that the lane spec should name
explicitly so the next operator does not re-derive them:

1. **Who commits the executor's diff?** The briefing's DO-NOT block forbids the
   executor from `git commit`/`git add -A` (correct — scope safety), so the
   worktree branch carries the work as an *uncommitted* diff. But
   `worktree-isolation.md` §Merge-back step 2 ("Merge/rebase it onto the primary
   branch") assumes the branch already has a commit to merge. The **orchestrator**
   must capture the scoped file as a commit on the task branch *before* `git merge`
   — and must `git add <scoped-path>`, never `-A` (an `-A` would sweep the
   BRIEFING/output sidecars into the merge). Worth one sentence in step 2.
2. **`git worktree remove` vs orchestration sidecars.** Removal failed with
   *"contains modified or untracked files"* because the briefing + `-o` output +
   timestamp files live inside the worktree dir and are untracked. The procedure's
   step 3 already anticipates this ("add `--force` only when you have confirmed
   there is nothing to lose") — once the scoped work is committed + merged to
   primary, the residue is pure orchestration sidecars, so `--force` is the correct,
   safe call. Confirmed, not a gap; but the sidecar-placement is worth noting (put
   briefing/output OUTSIDE the worktree to avoid needing `--force` at all).

Both are additive doc clarifications, not behavioral changes — the lane works as
specified. They are logged here as the F4 exit-gate's "failures route back to the
lane spec" channel; folding them into `worktree-isolation.md` is an optional
follow-up, not a blocker.

## Verdict

**F4-G1 met.** The prose lane has now had its one empirical validation: a real
foreign-model writing run, isolated per-worktree, serially merged with mandatory
post-merge re-verification, telemetry written, live tree fenced. Mode 2 stays
default-OFF; this proves the path works before any real enablement is ever
considered.
