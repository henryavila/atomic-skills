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
| `decisionLogPath` | Durable phase **decision log** path (JSONL) the orchestrator will append to / audit — e.g. `.atomic-skills/projects/<project-id>/<plan-slug>/decisions/<phaseId>.jsonl`. See `skills/shared/implement-decision-log.md`. **Informational for the writer:** under code-only fence the writer does **not** write this path (host owns durable `.atomic-skills/` appends); the writer **must** surface product tradeoffs so the host can record them. |

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

Portable spawn uses host primitives (`{{BASH_TOOL}}`, isolated subagent / `spawn_subagent` where available). Host-only Workflow/Task APIs stay behind host-conditional ide blocks (`ide.*`) and are never the only path.

---

## Claim report

Returned after the writer exits (implement Step D). One entry per task the work-order listed (including failed/blocked). Machine validation: `src/claim-report.js` (`parseClaimReport`, `validateClaimReport`, `validatedRangeForDone`, `validateClaimReachability`).

### Shape (per task)

| Field | Type | Meaning |
|-------|------|---------|
| `taskId` | string | Task id from the work-order. **Required.** |
| `status` | `claimed-pass` \| `claimed-fail` \| `blocked` \| `skipped` | Writer confidence only — **not** durable state. |
| `commitShas` | string[] | Implementation commit SHAs on the writer branch. **Required non-empty for open claims unless `base`+`head` set.** |
| `base` | string (optional) | Exclusive range start (with `head`) — preferred pin for multi-task exclusivity. |
| `head` | string (optional) | Exclusive range end (with `base`). |
| `paths` | string[] | Paths touched / committed (explicit list). **Required array.** |
| `verifierCommand` | string | Exact command the writer self-checked (verbatim). **Required for open claims.** |
| `exitCode` | number \| null | Exit code of that self-check (`null` if not run). **Required for open claims.** |
| `transcript` | string | Tail of verifier stdout/stderr (verbatim; keep bounded; may be empty string). **Required for open claims.** |
| `notes` | string (optional) | Scope-exit, blocked reason, conflict note, or **product tradeoff** that changed behavior outside pure task text — no soft "looks done". Tradeoffs and scope-exits must be explicit so the orchestrator can append a **decision log** entry (`category: tradeoff` or `scope-exit`) at `decisionLogPath` before continuing. |

**Commit identity rule:** each open claim (`claimed-pass` / `claimed-fail`) MUST supply **either** a non-empty `commitShas[]` **or** both `base` and `head`. `blocked` / `skipped` may omit commits when none were made.

**Exclusivity (HARD):** do **not** share the same bare SHA across open claims without each task having its own exclusive `base`+`head` range. Ambiguous overlapping multi-task SHAs fail `validateClaimReport` — the orchestrator refuses `review-code` / `done` until the writer returns a clean exclusive report.

### Aggregate envelope (recommended)

```text
claimReport:
  planSlug, phaseId, worktreePath, writerBranch
  finishedAt
  tasks: [ { taskId, status, commitShas | (base, head), paths, verifierCommand, exitCode, transcript, notes? }, ... ]
```

### Adjudication (orchestrator only)

1. **SYNC WAIT** until the writer process exits; refuse to act on partial in-flight claims.
2. **`validateClaimReport`** — reject incomplete fields or overlapping multi-task SHAs; re-dispatch if invalid.
3. **Merge** sibling worktree → plan branch (git-ops only) **before** any re-verify or `done` (Step D.5).
4. **Post-merge claim reachability (HARD):** before any verifier or `done`, prove every open claim's commit identity is **reachable on the plan branch** (ancestors of plan-branch `HEAD`). For each claimed SHA and each `base`/`head`:
   - `git merge-base --is-ancestor <sha> HEAD` must exit 0, **or**
   - pass a reachable set/predicate into `validateClaimReachability` from `src/claim-report.js`.
   Reject missing objects and non-ancestors (partial merge, cherry-pick-only, wrong branch). Do not close tasks whose claimed commits are not on the merged tree; re-dispatch the writer/fix agent for a clean reachable report.
5. For each `claimed-pass` task on the **MERGED** tree: re-run `tasks[].verifier` (verify-claim / `done` path).
6. Verifier fail ⇒ do **not** `done`; re-dispatch code-only fix agent (max 2) or stop for operator.
7. **Complex tasks** (`isComplexTask` with `destructiveDiff` from the **validated claim range**): `review-code --mode=both` on that range before `done`; blocker/critical block close; major needs disposition `accept|defer|fix`; durable receipt before `done`. Non-complex → verifier-only GATE-R2.
8. Only orchestrator `done <taskId>` writes durable state — and only after reachability + post-merge verifier pass.

A missing claim entry for a work-order task is treated as incomplete — do not invent pass.

---

## HARD-GATE — resume refuse

**Refuse** implement resume (Step 0.5) **and** refuse `--clear-execution-mode` / Mode-1 entry for the selected plan when **any** of:

1. Plan worktree is dirty / unexpectedly advanced (`git status --porcelain` non-empty for task-owned work).
2. `## Session handoff` has unfilled `TODO` / `REPLACE_*` / placeholder fields.
3. A **phase-writer lease** is blocking (`src/writer-lease.js` — `isLeaseBlocking` / `assertLeaseAbsent` / `readLeaseResult`; any non-missing status: `active`, `cleared`, `malformed`) — phase writer still running, lease not cleared, or torn file requiring operator recovery.
4. Sibling phase merge is mid-flight (incomplete merge state).

**HARD-GATE:** do not spawn a second phase writer while a lease is blocking. Acquire via exclusive create (`acquireLeaseFile` → `{ path, secret, lease }`). Clear only with the acquire secret (`clearLeaseFile(..., secret)`) after sync-wait + claim collect + merge settle (see worktree-isolation + implement Step D/D.5).

---

## Product tradeoffs → decision log

When implementation requires a **product or eng tradeoff** that changes behavior **outside pure task text** (not already spelled in `acceptance[]` / SPEC), the phase writer:

1. Does **not** silently widen scope or invent durable state.
2. Records the tradeoff in the claim report `notes` (and any blocked/skipped reason) so it is greppable.
3. Relies on the work-order **`decisionLogPath`** (when provided) as the durable target the **orchestrator** uses for `appendDecision` — the writer itself remains code-only and **must not** mutate plan.md phase status fields or write decision-review PASS.

Scope-exit (required violation of `scopeBoundary[]`) is always a stop + report: path + reason in `notes` / blocked claim; orchestrator appends `category: scope-exit` to the decision log before any continue/re-question path.

Full shape: `skills/shared/implement-decision-log.md` + `src/decision-log.js`.

---

## Fix-agent re-dispatch

On post-merge verifier fail, content merge conflict, complex-review blocker/critical, or evaluation blocker/critical: orchestrator re-dispatches a **code-only** fix agent under the same fence (same work-order subset / fix range, claim report, never `done`). Max **2** re-dispatches then mandatory operator stop. Never silent Mode-1 self-code while automate is active. Orchestrator appends a **decision log** entry (`category: routing`) for each re-dispatch **before** continuing.

---

## After claims — orchestrator only (not the writer)

The phase writer stops at the claim report. What follows is **never** the writer's job:

1. Merge sibling → plan branch; **prove claim reachability** on plan-branch HEAD; post-merge re-verify; orchestrator `done` per task.
2. When **all** phase tasks are `done`: spawn the **evaluation agent** (fresh, read-only — `implement-phase-evaluator.md`).
3. On evaluation blocker/critical: reopen tasks or blocking follow-ups; re-dispatch code-only fix agent (max 2); re-run verifiers/complex reviews; only then continue.
4. Stamp `phases[].evaluationGate` (`buildEvaluationGate` / `canRunPhaseDone`) — then `phase-done` with `review-code --mode=both` (**not** `external-both`).
5. After last phase: plan-end **`external-both`** (`planEndReviewOk`; legs codex|grok|claude) + **user validates** → `canFinalizeOrArchive` → finalize/archive.

The writer **never** runs the evaluation agent, never calls phase-done, and never self-certifies the phase.

---

## Cross-links

- Maestro loop: `skills/core/implement.md` (Automate mode — pure maestro Steps A–I).
- Decision log (path, fields, operator-only PASS): `skills/shared/implement-decision-log.md`, `src/decision-log.js`.
- Isolation + lease: `skills/shared/worktree-isolation.md`, `src/writer-lease.js`.
- Evaluation agent (after all phase tasks done): `skills/shared/implement-phase-evaluator.md`.
- Antipatterns: `skills/shared/implement-antipatterns.md` (self-certify, concurrent writers, nest, silent Mode-1).
