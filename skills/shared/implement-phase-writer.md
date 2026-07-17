# Phase writer — work-order, claim report, and code-only contract (lazy asset)

Consumed by `skills/core/implement.md` when `isAutomateActive` (pure maestro). The **phase writer** is a foreign, **code-only** executor for one phase initiative: it implements SPEC-admitted tasks and returns a **claim report**. It never closes state. The orchestrator re-verifies on the MERGED plan tree and is the sole owner of `done` / `phase-done` / handoff / `.atomic-skills/` durable writes.

Not a top-level skill. No Iron Law of its own beyond the implement pure-maestro fence.

---

## Code-only contract (HARD fence)

The phase writer **MAY**:

- Orient on the phase **work-order** (task ids, paths, `scopeBoundary[]`, `acceptance[]`, `verifier`).
- Edit product/source paths inside each task's admitted targets (respect `scopeBoundary[]` exclusions).
- Run pre-close self-check verifiers for confidence.
- Create **implementation** microcommits with explicit paths only (`rtk git add <paths>` — never `git add .` / `-A`).
- Return a structured **claim report** for every task it attempted.

The phase writer **MUST NOT**:

- Invoke `done`, `phase-done`, finalize, archive, or any project-skill state transition.
- Mutate durable `.atomic-skills/` project state (plan.md, phase initiatives, rollups, lessons, review receipts, handoff).
- Self-certify: a claim report is not closure; the orchestrator never treats "writer said pass" as `done`.
- Call `done` or write task evidence / completion events.
- Nest a phase worktree under the plan worktree path (sibling isolation only — see `worktree-isolation.md`).
- Include or depend on orchestrator chat history in its brief (constructed brief only).

**Never call `done`.** The orchestrator alone closes tasks after post-merge re-verify.

---

## Phase work-order

Built by the orchestrator (implement Step B) for **this phase only** — all pending SPEC-admitted tasks, not the whole plan.

### Required fields

| Field | Meaning |
|-------|---------|
| `planSlug` | Plan slug (and project id when nested). |
| `phaseId` | Active phase id (e.g. `F1`). |
| `initiativePath` | Path to the phase initiative file (read-only for the writer — do not write). |
| `tasks[]` | Ordered list of pending tasks for this phase. |
| `tasks[].taskId` | Stable id (e.g. `T-004`). |
| `tasks[].paths` | Exact `outputs[].path` implementation targets. |
| `tasks[].scopeBoundary` | Explicit exclusions (DO-NOT constraints), not an allowlist. |
| `tasks[].acceptance` | Admitted acceptance criteria. |
| `tasks[].verifier` | Deterministic verifier (`kind` + `command` / test target + `expectExitCode` when present). |
| `worktreePath` | Sibling phase worktree cwd for the writer. |
| `writerBranch` | Named branch the writer commits on (merge target is the plan branch). |
| `baseRef` | Ref the sibling worktree was seeded from (usually plan-branch HEAD at spawn). |

Optional but recommended: `tasks[].weight`, `tasks[].tags` (for orchestrator-side `isComplexTask` after merge — the writer does not run cross-model review).

### Construction rules

- Only tasks of **this** phase with status pending/active that already passed SPEC admission.
- Paths and verifiers are copied **verbatim** from the initiative — never paraphrased.
- The work-order is the spine of the constructed brief (below).

---

## Constructed brief (spawn payload)

The orchestrator builds a **constructed brief** for the phase writer. It is a self-contained packet:

1. Code-only contract summary (this file's HARD fence).
2. The full **phase work-order**.
3. Minimal scoped context the writer needs (file excerpts, prior microcommit SHAs on plan branch if relevant).
4. Output contract: return a **claim report** (shape below) — no narrative-only completion.

**MUST NOT include orchestrator chat history.** Do not paste the maestro session transcript, prior operator chit-chat, or unrelated tool dumps. Chat history is lossy, non-portable, and leaks decisions the writer must not reverse. If context is missing, the writer stops and reports a blocked claim for that task — it does not invent scope.

Portable spawn uses host primitives (`{{BASH_TOOL}}`, isolated subagent / `spawn_subagent` where available). Host-only Workflow/Task APIs stay behind `{{#if ide.*}}` and are never the only path.

---

## Claim report

Returned after the writer exits (implement Step D). One entry per task the work-order listed (including failed/blocked).

### Shape (per task)

| Field | Type | Meaning |
|-------|------|---------|
| `taskId` | string | Task id from the work-order. |
| `status` | `claimed-pass` \| `claimed-fail` \| `blocked` \| `skipped` | Writer confidence only — **not** durable state. |
| `commitShas` | string[] | Implementation commit SHAs on the writer branch (empty if none). |
| `paths` | string[] | Paths touched / committed (explicit list). |
| `verifierCommand` | string | Exact command the writer self-checked (verbatim). |
| `exitCode` | number \| null | Exit code of that self-check (`null` if not run). |
| `transcript` | string | Tail of verifier stdout/stderr (verbatim; keep bounded). |
| `notes` | string (optional) | Scope-exit, blocked reason, or conflict note — no soft "looks done". |

### Aggregate envelope (recommended)

```text
claimReport:
  planSlug, phaseId, worktreePath, writerBranch
  finishedAt
  tasks: [ { taskId, status, commitShas, paths, verifierCommand, exitCode, transcript, notes? }, ... ]
```

### Adjudication (orchestrator only)

1. **SYNC WAIT** until the writer process exits; refuse to act on partial in-flight claims.
2. **Merge** sibling worktree → plan branch (git-ops only) **before** any re-verify or `done` (Step D.5).
3. For each `claimed-pass` task on the **MERGED** tree: re-run `tasks[].verifier` (verify-claim / `done` path).
4. Verifier fail ⇒ do **not** `done`; re-dispatch code-only fix agent (max 2) or stop for operator.
5. Complex tasks (`isComplexTask`): `review-code --mode=both` before `done`; blocker/critical block close.
6. Only orchestrator `done <taskId>` writes durable state.

A missing claim entry for a work-order task is treated as incomplete — do not invent pass.

---

## HARD-GATE — resume refuse

When automate is active, **refuse** implement resume (Step 0.5) when **any** of:

1. Plan worktree is dirty / unexpectedly advanced (`git status --porcelain` non-empty for task-owned work).
2. `## Session handoff` has unfilled `TODO` / `REPLACE_*` / placeholder fields.
3. A **phase-writer lease** is still active (`src/writer-lease.js` — `isLeaseActive`) — phase writer still running or lease not cleared after prior spawn.
4. Sibling phase merge is mid-flight (incomplete merge state).

**HARD-GATE:** do not spawn a second phase writer while a lease is active. Clear the lease only after sync-wait + claim collect + merge settle (see worktree-isolation + implement Step D/D.5).

---

## Fix-agent re-dispatch

On post-merge verifier fail, content merge conflict, complex-review blocker/critical, or evaluation blocker/critical: orchestrator re-dispatches a **code-only** fix agent under the same fence (same work-order subset / fix range, claim report, never `done`). Max **2** re-dispatches then mandatory operator stop. Never silent Mode-1 self-code while automate is active.

---

## Cross-links

- Maestro loop: `skills/core/implement.md` (Automate mode — pure maestro Steps A–I).
- Isolation + lease: `skills/shared/worktree-isolation.md`, `src/writer-lease.js`.
- Evaluation agent (after all phase tasks done): `skills/shared/implement-phase-evaluator.md`.
- Antipatterns: `skills/shared/implement-antipatterns.md` (self-certify, concurrent writers, nest, silent Mode-1).
