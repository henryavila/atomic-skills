# project — `consolidate` (merge-train integrate ≥2 ready worktrees) (lazy detail)

Loaded by the router for `/atomic-skills:project consolidate`.

> **Invocation:** `consolidate` is a **top-level**, **operator-prompted** verb — never
> automatic. It integrates **the plans that are READY** across **≥2 live worktrees** into
> one integration branch, then opens a single PR. With **<2 live worktrees it is a no-op**
> and you should use `finalize` (one plan → one PR) instead — `finalize` is untouched and
> carries **zero** of this machinery. `consolidate` does **not** merge to `main` directly
> and does **not** archive; those stay separate, post-PR steps.

## Why a separate verb (not an extension of finalize)

`finalize` is locked **1:1** (one plan branch → one PR). Consolidation is **1:N**: N
sibling worktrees forked from one point, merged onto a moving integration tip. The
industrial analog is a **local, ephemeral merge-train** (GitHub merge queue / Bors /
Zuul): serialized **eject-and-continue** — never an octopus (all-or-nothing, silent on
semantic conflicts) and never a long-lived Git-Flow `develop`.

## Step 0 — The gate (cheap pre-filter, then the robust predicate)

1. **Cheap pre-filter (free):** parse `git worktree list --porcelain`. With **<2 live
   worktrees**, STOP — this verb is a no-op; route the operator to `finalize`. This is the
   same `<2 → no-op` short-circuit `cross-wt-gate.js` uses, so the 1-worktree case pays
   nothing.
2. **Robust READY predicate (not the raw count):** the raw worktree count is a proxy that
   misfires (a stale orphan worktree inflates it; one worktree can carry >1 plan; a ready
   plan's worktree may already be torn down). The real candidate set is **distinct terminal
   plans with an unmerged, integrable head on the same fork base**, composed from existing
   pure functions:
   - `isTerminalPlan` / `resolveFinalizePlanScope` (`scripts/finalize-plan-scope.js`) — plan
     readiness (archived, or done, or active-with-every-phase-done). A non-terminal plan is
     **excluded**, never swept in (fail-closed).
   - `findOrphanWorktrees` (`scripts/detect-orphan-worktrees.js`) — **subtract** worktrees
     whose feature is already merged.
   - the MERGED/`headRefOid` proof shape from `isTeardownSafe` (`scripts/worktree-teardown.js`)
     for already-published heads.
   If a plan is excluded because it is non-terminal, print the predecessor command
   before continuing: `phase-done` for its current open phase, or `done <task-id>`
   when the active phase still has open tasks. If the derived candidate set is
   **<2**, degrade to the single-plan `finalize` path.

## Step 1 — Order + the merge-train loop (`scripts/consolidate.mjs`)

Resolve the integration ref (`scripts/integration-ref.js`, same as finalize) and build the
integration tip from it. Enable `git rerere` (recorded resolutions replay across the train).
Process candidates in a deterministic order (largest / most-conflicting first — order
affects only cascade cost, not the build+test verdict). For each candidate:

Before the first merge, `scripts/consolidate.mjs` writes
`.atomic-skills/status/consolidate-run.json` (or the explicit `--run-file`) with
`runId`, `base`, ordered `branches`, `candidates[]`, and `status: "running"`.
After every candidate it updates that same file with `merged` / `skipped` /
`ejected` state and the audit lines. If the process halts for semantic conflicts,
the file records `status: "blocked"`, `stop.branch`, and the ejected paths. Resume
with `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/consolidate.mjs" --workdir <dir> --resume`; `--resume` reloads
the original `base` and ordered branches from the run file and refuses mismatched
`--base` / `--branches` arguments. Do not reconstruct a stopped train from current
git history alone — git tells what is merged, while the run record tells which
train was intended and where the operator stopped.

- **Merged-then-reverted** (head already in base history + a `Revert "…"` of its merge):
  re-merge is a no-op; do **revert-of-revert** (`git revert <the-revert>`), a clean
  single-parent restore — never a silent skip. (`classifyBranchIntegration`.)
- Otherwise `git merge` onto the tip. On conflict, classify **each** conflicted path with
  the **typed allowlist** below and apply the mechanical policy; collect anything outside
  the allowlist as **ejected**.
- **Eject-and-continue (fail-closed):** if a candidate has ejected (semantic/unknown) paths,
  its **mechanical** conflicts are already resolved + staged; **HALT** and route the
  remaining files to the human (or LLM). The human resolves only those, commits, and re-runs
  — already-merged candidates are skipped (idempotent). A candidate with **zero** ejects
  auto-commits and the train continues.

## Step 1.5 — SIGNAL-DRIVEN resolution (the proof) — `scripts/consolidation-resolve.js`

`classifyConflictPath` is **pure, never-throws, FAIL-CLOSED**, and keyed on **signals the
file/git already carries — NOT a hardcoded path list**. A path list only recognizes the
files ONE repo produced (it auto-resolves nothing on any other repo, and "validating" it by
re-running on the same repo is circular). Each class below is a signal that generalizes; a
path with **no** signal resolves to **`eject`** (route to human). A mis-classification would
produce a tree that builds+tests green while having dropped a side's real work — which the
gate cannot catch — so the floor is "prove a signal or route to a human."

| Class | **Signal** (generic) | Policy |
|---|---|---|
| lockfile | basename ∈ {`package-lock.json`,`yarn.lock`,`pnpm-lock.yaml`,`Cargo.lock`,`poetry.lock`,`go.sum`,`Gemfile.lock`,`composer.lock`,`.terraform.lock.hcl`,…} | regenerate (relock) |
| config-union | basename ∈ {`.gitignore`,`.gitattributes`} | union (lossless) |
| generated-artifact | `@generated` / `DO NOT EDIT` / `code generated by` **header** in the first lines | resolve → **regenerate** → assert-green |
| union-attr | git marks it **`merge=union`** (`git check-attr` — consumed, not duplicated) | union |
| runtime-regenerable | matched by **`.gitignore`** (`git check-ignore`) | take-delete + re-emit |
| pointwise-state | parses as a JSON object carrying a **timestamp** key | last-writer-wins |
| **everything else** | **no signal** | **eject → human/LLM** |

**Per-repo CONFIG (default empty → generic), for classes with no generic signal:**
`generatedGlobs` (header-less generated artifacts), `narrativeGlobs` (human narrative
indexes → take-ours + **mandatory verify**), `runtimeGlobs` (regenerables whose `.gitignore`
signal is unreliable mid-merge). For atomic-skills these are e.g.
`assets/aideck-consumer/schema.json`, `**/PROJECT-STATUS.md`, `.atomic-skills/focus.json` —
an explicit, auditable **config**, not paths baked into the generic engine.

**Discipline (Iron Law R-XAGENT-03 extended):** auto-resolve ONLY on a proven signal; every
mechanical resolution emits a per-path **audit line** (path · class · action). Genuine
semantic source merges and the structural-**supersession DECISION** (which whole side wins,
e.g. an engine rewrite over old wiring) are **always** human — the tool may offer
"take-all-from-branch-X" but never infers the winner. The `.atomic-skills/projects/**`
tracking tree has no mechanical signal → stays **eject** until the Decision-5 ownership
partition lands.

**Note on the ledgers:** they auto-union ONLY where `merge=union` is actually wired in the
tree's `.gitattributes` (Fase 0). On branches that predate that wiring they correctly eject
— the honest behavior is "union what git marks," so landing the `merge=union` attribute on
the integration base first is a prerequisite for zero-touch ledger merges.

## Step 2 — Deterministic gate + green-the-suite tail

Once every candidate is integrated, run the **regen** then the **deterministic gate** on the
integrated tree — the recognized floor (speculative-merge-then-build-and-test): regenerate
build artifacts, then the target project's own build → typecheck → test → lint (detected
generically via `cross-wt-gate.js` `detectProjectCommands`, never hardcoded). A green floor
is necessary but not sufficient for "semantically clean"; the LLM/semantic layer stays
**advisory** and operator-prompted. Note the residual **footprint-fixture drift** the gate
catches (hardcoded skill/asset counts the merge did not conflict on but the merged tree
invalidates) — fix it here as the tail step; it is the one mechanical-looking cost the gate,
not the resolver, surfaces.

## Step 3 — Publish (operator-prompted) + after

Show the integrated diff + the proposed PR and **HALT**. On confirm, push the integration
branch and open **one** PR against the integration ref (reuse `finalize` Step 3/4 — push +
`gh pr create` + record the `pr-url`). The merge happens on GitHub; `archive` + worktree
teardown stay separate, post-merge.

## Scope (this command's boundary)

- **Always operator-prompted**; shows the audit + diff + proposed PR and halts.
- **<2 live worktrees → no-op** (use `finalize`); the 1-worktree path is byte-identical to today.
- **Auto-resolves only the mechanical allowlist**; fail-closed eject for everything else.
- **Never auto-merges the `.atomic-skills/projects/**` tracking tree** (Decision-5 deferred).
- **Never merges to `main` directly and never archives** — opens one PR; merge + archive are later.
