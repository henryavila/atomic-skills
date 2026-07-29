# Dogfood checklist — automate writer runtime (1 + A + B)

**Status:** checklist for operators (not a claim that dogfood already passed).  
**Related:** `docs/kb/automate-orchestrator-realism.md`, plan `automate-writer-runtime`.

This document walks **prepare → spawn → validate → merge → assert done** after
shipping skill recipe (#1), Layer 3 runner (A), and plan-tree product fence (B).

**Non-claim:** Layer 4 (daemon multi-host spawn) is **not** shipped.

## Preconditions

1. Plan stamped or session under `isAutomateActive` (automate default or `--mode=automate`).
2. Active phase **materialized** with complete `businessIntent` spine.
3. Ground-truth receipt present (`assert-automate-gate --gate spawn` enforces).
4. Maestro cursor advanced to **C** before spawn assert.
5. No blocking writer lease (`isLeaseBlocking` false / missing).

## Happy path (ordered)

### 1. Assert spawn

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
node "$PKG_ROOT/scripts/assert-automate-gate.js" \
  --plan <slug> --gate spawn
# exit 0 required
```

### 2. Runner prepare (Layer 3)

```bash
node "$PKG_ROOT/scripts/automate-phase-run.js" prepare \
  --plan <slug> --phase <phaseId> [--project <id>] \
  --plan-worktree <plan-wt-abs> [--repo-root <repo>]
```

Record from stdout (hold **leaseSecret** in memory only — never commit):

| Field | Use |
|-------|-----|
| `sealedBriefPath` | Writer prompt |
| `worktreePath` | Spawn cwd (sibling WT — never nested under plan WT) |
| `writerBranch` | Merge source later |
| `baseRef` | Product fence + reachability range |
| `claimReportPath` | Where writer writes claims |
| `leaseSecret` | `clearLeaseFile` after merge settle |

### 3. Spawn phase writer (host-invoked)

- **Grok:** `spawn_subagent` with `subagent_type: general-purpose` (NOT explore),
  isolation/cwd = sibling `worktreePath`, prompt = sealed brief.
- **Portable:** isolated subagent / host primitive with same cwd + sealed brief.
- **Forbidden:** host product coding on the plan branch under automate.

Sync-wait until the writer exits.

### 4. Runner validate

```bash
node "$PKG_ROOT/scripts/automate-phase-run.js" validate \
  --claim-report <claimReportPath> \
  --plan-branch <plan-branch> \
  --writer-branch <writerBranch>
```

Non-zero ⇒ re-dispatch writer/fix or stop. Do not invent claim fields.

### 5. Merge (git-ops only)

Host merges writer branch → plan branch (commands printed by validate).
Content conflicts ⇒ re-dispatch code-only fix agent (not host product hand-edit).

### 6. Assert done (+ product fence)

```bash
# Reachable SHAs on plan HEAD (one per line)
git rev-list --ancestry-path <baseRef>..HEAD > /tmp/reachable.txt   # or merge-base checks
git diff --name-only <baseRef>..HEAD > /tmp/plan-diff.txt

node "$PKG_ROOT/scripts/assert-automate-gate.js" \
  --plan <slug> --gate done \
  --claim-report <claimReportPath> \
  --reachable-file /tmp/reachable.txt \
  --plan-diff-file /tmp/plan-diff.txt
  # or: --base-ref <baseRef>  (CLI runs git diff --name-only)
```

Exit 0 required. Then re-verify each task on the **merged** plan tree and
orchestrator `done <task-id>` only when verifiers pass (+ complex gates when needed).

### 7. Clear lease + teardown

- `clearLeaseFile(statusRoot, planSlug, leaseSecret)` only after merge settle.
- `git worktree remove <worktreePath>` when work is on the plan branch.
- Residual WTs after crash are operator cleanup — never nest under plan worktree.

## Fail case — Mode-1 plan-tree product commit

**Scenario:** under automate stamp, the host (or Mode-1 session) commits product
paths (e.g. `src/foo.js`) directly on the plan branch **without** those paths
appearing in a validated claim report for the phase.

**Expected:**

1. `assert-automate-gate --gate done` with `--plan-diff-file` / `--base-ref`
   covering that range exits **non-zero**.
2. Message matches plan-tree **product fence** / not covered.
3. Orchestrator must **not** close tasks. Recovery: re-dispatch a code-only
   phase writer (sibling WT + claim paths covering the product diff) or
   explicit leave-automate after clean lease.

**Not expected:** Layer 4 process-forced spawn. Fence blocks **close**, not spawn.

## Guarantee honesty

| Layer | Guarantee |
|-------|-----------|
| #1 Skill recipe | Correct spawn tool call is unambiguous (soft) |
| A Runner | Hard writer channel for work-order / lease / brief / validate |
| B Product fence | Fail-closed done when product paths lack claim coverage |
| Layer 4 | **Non-goal** — not shipped |

Prose alone does not force spawn. Host product commit on the plan branch under
automate is a red flag.

## Package surface

- `scripts/automate-phase-run.js`
- `src/automate-phase-run-lib.js`
- `src/automate-work-order.js`
- `src/automate-sealed-brief.js`
- `src/automate-product-fence.js`
- package `files` includes `scripts/` and `src/`
