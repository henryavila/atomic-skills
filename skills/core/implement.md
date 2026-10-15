**Entry (only path).** This session does not code, does not spawn, does not stamp, and does not run Steps A–I. Do Step 0 only far enough to resolve the plan slug and the absolute worktree, then run the launcher there and STOP. If `planApprovedAt` is a valid ISO timestamp, show the `/loop` line and stop. If it is missing, send the user to `project approve` and stop. Do not follow later steps in this session. Later harness text stays in this file for other sessions. It is not an entry.

**Two target kinds.** The arg may be (1) an **Atomic Skills plan** (`plan-slug` or `<project-id>/<plan-slug>`, or a path to `.atomic-skills/projects/**/plan.md`) or (2) a **foreign markdown plan** (`path/to/file.md` outside the inventory). Foreign targets require an **entry-time** {{ASK_USER_QUESTION_TOOL}} — **Promote to AS** (then `project adopt` + Flow A) or **Implement as Foreign** (colocated sidecar + worktree + automate; FINALIZE/ARCHIVE cleanup — **no promote at the end**). Do not run that lane in this session. Bind the worktree in Step 0, then the Launcher. Asset: `skills/shared/implement-foreign-plan.md`.

If {{ARG_VAR}} was provided, use it as the plan-slug, `<project-id>/<plan-slug>`, or `path/to/plan.md` after stripping mode flags. If not, ask the user: "Which plan are we implementing? I'll read its active phase's tasks." Default to the active plan/initiative if one is already selected. **The explicit arg selects plan, branch, and worktree before any resume gate or write** — see Step 0.

## Process

### Step 0 — Resolve target (plan / branch / worktree)

**Before any resume gate, dirty check, or write**, classify the arg, select the plan the user asked for, and bind its worktree. Helpers: `src/implement-target-kind.js` (`splitImplementPlanArg`, `classifyImplementTarget`, `classifyImplementArgv`, `normalizeForeignEntryChoice`) then `src/project-target-resolver.js` (`parsePlanArg`, `resolveImplementTarget`, `composePlanWorktreeAdd`) for Atomic Skills inventory targets. Skill prose must follow the same order.

0. **Parse mode flags (before plan selection).** From `{{ARG_VAR}}` / argv, call `parseImplementMode` in `src/implement-mode.js`. Tokens: `--mode=automate` / `mode:automate` / `--mode=1` / `--clear-execution-mode`. Absent mode → `mode: undefined` / `modeExplicit: false` (do **not** invent `cliMode: 'default'` — that forces Mode 1 and breaks stamp re-entry **and** automate-default). Unknown mode → refuse with a clear error (do not ignore). Residual plan arg = `splitImplementPlanArg(...).planArg` (or strip mode tokens yourself). Combine with plan / sidecar `executionMode` via `isAutomateActive({ cliMode: parsed.mode, planExecutionMode, clearExecutionMode })` — **no CLI + no clear + no non-automate stamp → true** (F0 default; foreign lane also defaults to automate).
   - **First durable stamp:** the invoking session does not stamp and does not ask `y`. It stops at the launcher. Durable `executionMode` is not this session's job.
   - **Clear / Mode 1:** this session does not call `clearExecutionModeStamp`, does not persist a mode change, does not enter Mode 1, and does not run Steps A–I. Resolve the plan and worktree, then run the Launcher and STOP.
   - When automate is active (default or stamp/CLI), this invocation does **not** enter Steps A–I. After Step 0 binds the worktree, run the **Launcher** below and STOP. The new session that receives the pasted `/loop` line is the orchestrator. A later session runs foreign automate from `implement-foreign-plan.md` (not AS `assert-automate-gate` inventory gates). This session does not.
0b. **Classify target kind (before inventory select).** Call `classifyImplementTarget({ arg: planArg })` (inject real `exists` / path resolve at runtime). Branch:
   - **`missing-arg`** — ask which plan (slug or path); do not invent.
   - **`path-not-found`** — refuse with the missing path; do not invent a slug.
   - **`atomic-plan` / `atomic-plan-path`** — continue Step 0.1+ (inventory / that plan.md). `atomic-plan-path` is already an AS `plan.md`; do **not** offer foreign entry choice.
   - **`foreign-plan`** — **entry choice HARD-GATE (start only).** Use {{ASK_USER_QUESTION_TOOL}} with exactly two options (no silent default):
     1. **Promote to Atomic Skills plan** — run `atomic-skills:project adopt <sourcePath>` (preview + confirmation + materialize per `project-create-plan.md` adopt). Then re-enter implement as Flow A on the new inventory slug. **Promote is entry-time only** — never offer promote at FINALIZE/ARCHIVE.
     2. **Implement as Foreign** — bind the worktree `plan/<slug>` and the colocated `*.implement.yaml` sidecar. `{{READ_TOOL}} skills/shared/implement-foreign-plan.md` only for those paths. Then run the Launcher and STOP. This session does not spawn, code, stamp, admit SPEC, run work phases, or run **FINALIZE** / **ARCHIVE**. Do **not** continue Steps 0.1–3 / Step 1 AS inventory load for this choice.
1. **Parse the arg (Atomic Skills path only).** After classification is `atomic-plan` or `atomic-plan-path`, residual arg is a bare slug (`plan-b`) or `<project-id>/<plan-slug>` (`atomic-skills/plan-b`), or resolve slug from the AS plan.md path. If missing, ask which plan; do not silently pick a different active plan when more than one is open.
2. **Select the plan** from nested inventory (`.atomic-skills/projects/*/*/plan.md`). Prefer exact slug (+ project when given). On ambiguity, disambiguate — never invent.
3. **Bind branch + worktree.** Read the plan's `branch:` (usually `plan/<slug>`). Compare to `git symbolic-ref --short HEAD` and `git worktree list --porcelain`.
   - Already on the plan branch → home. Slug and absolute worktree are resolved. Run the launcher below on **this** tree and STOP. Do not continue to Step 0.5 in this session.
   - Plan worktree exists elsewhere → **HALT**. Tell the user to re-run `implement` inside that worktree. Do **not** run the resume gate or write plan state in the caller tree.
   - Worktree absent → create inside the repo (`.worktrees/<slug>`). If the branch **already exists**, reuse it **without `-b`** (`git worktree add .worktrees/<slug> <plan-branch>`). Only use `-b <plan-branch>` when the branch does not exist. Then **HALT** and re-enter.
   - **`caller-governs-other-plan`:** if the caller's branch is already the home of a *different* plan, **FAIL** (HARD-GATE). Do not evaluate dirty state for plan-b while sitting on plan-a's tree; do not write plan-b state into the caller tree.
4. **Legacy `branch:` null** — no worktree binding; record degraded. When a single plan is clearly intended, run the Launcher and STOP. Do not run Steps A–I.

Reuse `skills/shared/worktree-isolation.md` § *Step 0 — detect existing isolation BEFORE creating one*; never nest. Materialization and implement writes land **only** in the worktree declared by the plan frontmatter `branch:` (AS) or the foreign work-order `branch` (foreign lane).

### Launcher (only path)

This session does not code and does not run Steps A–I. After Step 0 resolves the plan slug and the absolute worktree, stop here. Do not spawn. Do not stamp. Do not run the tick.

If plan frontmatter `planApprovedAt` is a valid ISO timestamp, run this via {{BASH_TOOL}}:

```bash
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/orchestrator-tick.js" --card --plan <slug> --worktree <absolute-worktree>
```

Show the stdout verbatim in one fenced block. That stdout is a single `/loop` line. Tell the user to paste that command as the first message of a new session, then STOP.

If `planApprovedAt` is missing or not a valid ISO timestamp, do not print the command. Send them to `project approve`. STOP.

This is the only entry path.

## END OF ENTRY

The invoking session stopped at the Launcher. Do not read on in order to act.
The `/loop` session does not execute Steps 0.5–3, Mode 1, or A–I from this file.
Its only procedure is `skills/shared/implement-orchestrator-tick.md`.
Text below is retained harness. It is not a second path.

These laws bind the /loop session only when it performs a printed tick action; the invoking session does not execute them.

## Iron Law

CODING STAYS SINGLE-THREADED (ONE WRITER PER WORKTREE).
MICROCOMMITS ARE THE SNAPSHOT.

One writer touches a given working tree at a time — never two concurrent agents editing files in the same tree. Concurrent Mode 2 worktrees are allowed only when each has exactly one writer and merge-back is serial through the primary. Subagents are for read-only investigation, never parallel coding in the same tree. A task reaches `done` ONLY through verify-on-done (its deterministic verifier executed, passing, evidence written) — you never mark your own work done by assertion, and a cheap/foreign executor **never self-certifies**. After every verified task close, create explicit-path microcommits for the implementation diff and the project-state close diff; a handoff over dirty task-owned work is an emergency note, not a checkpoint.

### Automate iron laws (when `isAutomateActive`)

1. **Host-thin pure maestro + product entrypoint ban.** The host session is **host-thin**: it **never** edits product source under `--mode=automate`, and it does **not** run a **product entrypoint** for diagnostics or app execution. **Forbidden** (deny class, not an exhaustive CLI list): product source edits; **product entrypoint** classes such as `compose`, `build_edl`, app servers, product diagnostics, `npm run dev` / similar app entrypoints — except **verbatim** task/exit-gate verifier commands. **Allow host class** (open — not a closed allowlist): plan-branch **git-ops** (merge, worktree add/remove/list, merge-base, status, log, diff, rev-parse, symbolic-ref, explicit-path state microcommits); Atomic Skills **state scripts** (`done` / `phase-done` helpers, refresh-state, validate-state, assert-automate-gate, decision-log append); **review-code** invocation; and task/exit-gate verifier commands **copied verbatim** from `task.verifier` / exit-gate verifier text. Do **not** ban those verbatim verifiers or plan-branch git-ops. On product failure, re-dispatch a code-only **fix agent** — never host product-debug under automate. The host dispatches, sync-waits, merges (git-ops only), re-verifies, reviews, and owns every `done` / `phase-done` / finalize state write.
2. **One fresh phase agent per phase, code-only.** Granularity is the phase initiative. Spawn **one fresh phase agent** (phase writer) per phase with a **constructed brief only** — **no host chat history**. The phase writer runs orient → code → pre-close self-check → implementation microcommits → **claim report**. It **must not** invoke `done`, `phase-done`, handoff mutation, rollups, lessons, or any durable `.atomic-skills/` write.
3. **Never self-certify.** A phase-writer claim is confidence, not closure. Only the orchestrator re-running the task verifier on the **MERGED** plan tree (via verify-claim / `done`) may close. **Agents never write decision-review PASS** — only the operator writes PASS on the manual hardgate. **present-before-PASS:** host presents the **decision package** body in the same hardgate turn as PASS|FAIL; stamp requires `packagePresentedAt` and/or `packagePath` under automate (session default or stamp).
4. **Never silent Mode-1 fallback.** Under automate, spawn failure or review/verifier fail means re-dispatch a code-only fix agent (max **2**) or stop for the operator — **not** the host session coding product source. Leaving automate requires explicit `--clear-execution-mode` / Mode-1 re-entry recorded in the decision log. **Silent auto-PASS** of a plan-direction `businessIntent` that is not yet ratified is forbidden. Later phases inherit a ratified spine when `find-weak-business-intent` exits 0. Decision-review auto-PASS is allowed only when the log has no `tradeoff` or `scope-exit`. **{{ASK_USER_QUESTION_TOOL}}** questions under automate are plan direction, open blocker/critical/major, decision-review on those entries, and plan-end validation. Free-text token recovery after decline is forbidden — re-Ask or STOP.
5. **One writer per worktree, serial merge.** When `planApprovedAt` is set, the orchestrator tick may dispatch several writers in one wakeup whose `outputs[].path` sets are disjoint and whose dependencies are done. Overlapping paths stay serial. Merge back to the plan branch is always one part at a time. Without that stamp, do not run the tick.
6. **planEndReviewOk** (and user validation) gate finalize/archive under automate — see plan-end path and `src/plan-end-review.js`. Under automate, plan-end is **intent-vs-delivered** (not generic diff alone): build surfaces → `review-code --mode=external-both` with **Intent vs delivered** brief → stamp receipt with non-empty **`intentVsDelivered`** rows (`matched`|`partial`|`missing`|`extra`) → operator **`userValidatedAt`** → `assert-automate-gate --gate finalize`. Empty `intentVsDelivered` fails finalize.
7. **assert-automate-gate before every pure-maestro advance.** Under automate, before spawn (Step C), done-batch (Step E), `phase-done` (Step G), or finalize/archive (Step I), run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/assert-automate-gate.js" --plan <slug> --gate spawn|claims|done|phase-done|finalize` (see `skills/shared/implement-automate-maestro.md`). **Non-zero exit ⇒ STOP** — do not acquire a second lease, do not `done`, do not `phase-done`, do not finalize. Layer-1 helpers alone are not enough if the agent skips calling them; the CLI is the machine-checkable call site. **Step E is claim-bound** under durable stamp: `assert-automate-gate --gate done` + `canDoneFromAutomateClaims` / `canCloseTasksFromClaims` after reachability; complex tasks need `complexTaskAllowsDone` before each orchestrator `done`.
8. **Maestro cursor on every A–I boundary.** Under automate, keep the thin maestro cursor (Layer 2.5 — `src/maestro-cursor.js`, path `.atomic-skills/status/automate/<slug>.json`) current: `ensureCursor` on first entry (A or B), `advanceCursor`/`writeCursorFile` at each step boundary so assert sees step **C** before spawn, **E** before done, **G** before phase-done, **I** before finalize. After successful phase-done call **`recordPhaseDonePause`** → step **`awaiting-operator-advance`** (blocks spawn + Step A). Operator continue requires **`clearContinue`** with explicit token `operator-continue` (or `operatorContinue: true`) → **H** — generic ok is not enough. Never delete the cursor or lease to force progress.
9. **lastAssert before state mutation.** After `assert-automate-gate --gate done` or `phase-done` (exit 0), the CLI stamps **`lastAssert`** on the cursor. Before writing task `status: done` or terminal phase-done, call **`lastAssertAllows(cursor, gate)`** (`src/maestro-cursor.js`). If missing/false/wrong gate: **STOP** and re-run assert. Prevents “assert failed or skipped, but I closed anyway.”
<HARD-GATE>
If you are about to mark a task `done` because it *looks* finished, without running its verifier through the `done` / verify-on-done patterns: STOP. Run the verifier. The pass is the evidence; "it works" is the claim.
If a verified task changed files and you are about to continue without committing those exact paths: STOP. Run `git diff --name-only`, classify the paths, then use {{BASH_TOOL}} with `rtk git add <explicit-paths>` and a microcommit. Never use `git add .` or `git add -A`.
If you are RESUMING and `git status` is dirty/stale OR the `## Session handoff` block has an unfilled `TODO`/`REPLACE_*` placeholder: STOP. Refuse to execute. Surface the missing pieces and resolve them (commit/stash, fill the handoff) before any task runs — a resume over an inconsistent snapshot corrupts the work.
If you are about to dispatch a read-only subagent or hand off a token-heavy read: STOP and write the snapshot FIRST (the handoff is the pre-dispatch checkpoint).
If the caller's tree already governs another plan than the one requested (`caller-governs-other-plan`): STOP. Do not run the resume gate or write plan state here — re-enter the plan's worktree first.
If `isAutomateActive` and you are about to spawn a phase writer, run orchestrator `done`, run `phase-done`, or finalize/archive **without** a fresh `assert-automate-gate` exit 0 for the matching `--gate` (spawn / claims|done / phase-done / finalize): STOP. Non-zero assert forbids advancing (including illegal maestro cursor step).
If `isAutomateActive` and you are about to advance a pure-maestro step **without** updating the maestro cursor on that A–I boundary (or you are tempted to `rm` the cursor/lease file to force progress): STOP. Advance via `src/maestro-cursor.js`; never delete status files to skip gates.
If `isAutomateActive` and the maestro cursor is **`awaiting-operator-advance`**, and you are about to run pure-maestro **Step A**, spawn, materialize-as-auto-chain, or multi-phase auto-run **without** `clearContinue` (`continueToken: 'operator-continue'` / `operatorContinue: true`): STOP. The session that was asked to run implement does not clear that pause and does not tick. It shows the `/loop` command. The new session runs one tick from `skills/shared/implement-orchestrator-tick.md`. Without `planApprovedAt`, generic ok is not a continue token.
If you are about to code or spawn a phase writer and `find-plans-missing-ground-truth.js` on the plan path is non-zero (or you skipped running it): STOP. Ground-truth review receipt is mandatory; empty-repo still requires a persisted complete-empty-repo result — no chat waiver.
If you are about to code or spawn a phase writer and `find-missing-flow.js --strict` on the plan path is non-zero (or you skipped running it): STOP. Validated flow is mandatory. `process.yaml` never satisfies. Instruct `atomic-skills:project flow`. No operatorSkip, no chat waiver. Ad-hoc without a plan file is N/A; a plan file always gates.
</HARD-GATE>

## Mindset

**Branch on mode — do not blur them:**

| Mode | Role | What the host session does |
|------|------|----------------------------|
| **Mode 1** | **execution driver** | Session-writer path: you **are** the single-threaded coder. Serial loop with durable checkpoints — code a task, verify it, commit it, close it, commit the state, repeat. Not a multi-agent orchestrator; no one expects concurrency that single-threaded coding will never use. |
| **Automate** (`isAutomateActive`) | **pure maestro** (orchestrator-only) | Host session is **orchestrator-only** — never edits product source. Dispatches one code-only phase writer, sync-waits, merges (git-ops only), re-verifies, runs evaluation, owns `done` / `phase-done` / finalize. The **phase writer** is the execution driver for code; the maestro is not. |

The value in both modes is not speed; it is that the work is always recoverable from git plus `.atomic-skills/` state and that no task closes on a claim instead of a fact. Under automate, that recoverability includes the maestro cursor (pause at `awaiting-operator-advance` after phase-done until operator `clearContinue`).

The snapshot trigger is **event-driven, never a self-measured context gauge.** You cannot read your own remaining context window — the number is fabricated and the loss is silent (the host meter, where one exists, is advisory only). So you snapshot on *events* you can observe: after each task closes, before each subagent dispatch, at every phase boundary, and on request. A snapshot means a microcommit plus a refreshed handoff. A handoff that records dirty files is a crash report, not a successful checkpoint.

## Retained mode and stamp (not this entry)

The invoking session does not execute this block. It does not stamp, code, spawn, or run Steps A–I. The `/loop` session does not execute it unless a printed tick action says to.

**Mode detection (pure):** parse CLI tokens with `src/implement-mode.js` (`parseImplementMode`, `isAutomateActive`, `stampExecutionMode`, `clearExecutionModeStamp`). **Automate is the default** implement path (plan `automate-default-and-operator-gates` F0; supersedes archived `implementation-automate-mode` opt-in-only P1). Bare `implement` / absent mode with no clear flag → `isAutomateActive` **true** → pure-maestro. **Mode 1** (session-writer) requires an **explicit** escape: `--mode=1` / `mode:1` / known Mode-1 tokens. Explicit `--mode=automate` / `mode:automate` remains valid. Plan stamp `executionMode: automate` re-enters automate on later runs until `--clear-execution-mode`. When `isAutomateActive` is true, the pure-maestro spine (never product-source edits) is harness for a later session, not this entry. Mode 1 iron law still binds the single **phase writer** (or the session-writer under explicit Mode 1). This session does not run that spine.

**`executionMode` stamp (durable automate entry / re-entry):**

1. Harness, not this entry. On the **first** automate-default session (bare `implement` or `--mode=automate`) when frontmatter has **no** `executionMode: automate`: after Step 0 binds the plan worktree and **before** Steps A–I, stamp `stampExecutionMode(plan, 'automate')`. Do not ask `y/N`. The session is already pure-maestro; the stamp is what plan-end gates read. The invoking session does not stamp. It stops at the launcher.
2. Persist, project-state microcommit, and log the decision. `--mode=1` does not stamp.
3. **Stamp alone** makes `isAutomateActive({ planExecutionMode: 'automate' })` true on later `implement <plan>` (no CLI mode required) until clear — review cadence + pure-maestro re-entry. **Unstamp alone** does not mean Mode 1: next bare implement is still automate-default (F0).
4. **Clear path / Mode 1 escape:** `implement --clear-execution-mode` (parse sets `clearExecutionMode: true` → `isAutomateActive` false for the **session**) and/or remove the stamp with `clearExecutionModeStamp(plan)` (delete `executionMode` from frontmatter), persist, record in the decisions log. **HARD-GATE:** before honoring clear or falling into Mode 1, call `assertLeaseAbsent(statusRoot, planSlug)` / `isLeaseBlocking` — refuse while any lease residue exists (`active`, `cleared`, or `malformed`) or merge mid-flight. Explicit `--mode=1` overrides stamp **and** session default for the **coding** session only; **durable finalize/archive gates still use stamp alone** (`planExecutionMode === 'automate'`) until `clearExecutionModeStamp` removes it. Full leave-automate requires clear/unstamp **after** the lease is clean.
5. Plans that never stamped **omit** the field; schema treats it as optional — still validates. Omission no longer means Mode 1; it means automate-default for the session (P7: session default must still feed machine gates via stamp and/or `automateActive: true`).

Drive the SPEC-admitted Tasks of a plan to DONE — the execution driver that sits at the tail of the lifecycle (DESIGN → PLAN → DECOMPOSE+SPEC → **IMPLEMENT** → VERIFY). Materialized Tasks from `project` already carry exact paths + `scopeBoundary[]` + `acceptance[]` + a deterministic `verifier:` the SPEC gate admitted. Closing them is verify-on-done, and it is not this session's job. Microcommits anchor the recovered tree; durable `.atomic-skills/` state plus the `## Session handoff` block is how the next session resumes.

**Clear stamp / leave-automate HARD-GATE (not this entry):** if `clearExecutionMode` is true **or** the session would otherwise enter Mode 1 (`--mode=1` while a prior automate stamp exists), **first** resolve the selected plan (Step 0.1–0.3) and call `assertLeaseAbsent(statusRoot, planSlug)` in `src/writer-lease.js` (also `readLeaseResult` / `isLeaseBlocking` / `hasActiveLease`). **Refuse `--clear-execution-mode` and refuse Mode-1 entry** while any lease file residue exists (`active`, `cleared`, or `malformed`), or while a sibling phase merge is mid-flight. Clear/unstamp only when the lease is `missing` (clean) — never bypass the fence by flipping mode first. Only then: `clearExecutionModeStamp` on the plan frontmatter when leaving durable automate, persist, log, and treat automate as off for this session.

**Foreign lane (not this entry):** `{{READ_TOOL}} skills/shared/implement-foreign-plan.md` is the later-session lane (worktree `plan/<slug>`, colocated `*.implement.yaml` sidecar, ground-truth mandatory, admit SPEC, automate default, work phases, then terminal **FINALIZE** + **ARCHIVE** for validation/PR and worktree/branch cleanup). The invoking session does not follow it.

## Retained harness (not a path)

The `/loop` session does not re-enter this file to code. When a printed action needs a gate, it reads `skills/shared/implement-orchestrator-tick.md`, then `skills/shared/implement-automate-maestro.md` and `skills/shared/implement-harness-reference.md`.

Bare `implement` is `mode=automate`. `parseImplementMode` and `isAutomateActive` decide the session. The host is pure maestro and code-only: it never edits product source. The phase writer brief is `implement-phase-writer.md`. Evaluation is `implement-phase-evaluator.md`.

<HARD-GATE>
Before spawn, done, phase-done, or finalize, run `assert-automate-gate` as `implement-automate-maestro.md` specifies. `canRunPhaseDone` requires `evaluationGate`, lessons, and `deliveryAuditGate`. `canFinalizeOrArchive` requires `planEndReviewOk` with `external-both` and the user's `userValidatedAt`. Complex tasks stay claim-bound. The Session handoff is written inside the same durable save as `done`. Do not create a second close commit. Close is idempotent.
</HARD-GATE>

{{#if ide.grok}}
On Grok Build the loop session spawns workers with `spawn_subagent` (`subagent_type: general-purpose`), cwd = the sibling worktree, sealed brief. The orchestrator does not code.
{{/if}}
