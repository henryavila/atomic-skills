Drive the SPEC-admitted Tasks of a plan to DONE — the execution driver that sits at the tail of the lifecycle (DESIGN → PLAN → DECOMPOSE+SPEC → **IMPLEMENT** → VERIFY). You read the materialized Tasks `project` produced (each already carrying exact paths + `scopeBoundary[]` + `acceptance[]` + a deterministic `verifier:` the SPEC gate admitted), code them one at a time, and close each only through verify-on-done. Microcommits anchor the recovered tree; durable `.atomic-skills/` state plus the `## Session handoff` block is how the next session resumes.

If {{ARG_VAR}} was provided, use it as the plan-slug (or `<project-id>/<plan-slug>`) to implement. If not, ask the user: "Which plan are we implementing? I'll read its active phase's tasks." Default to the active plan/initiative if one is already selected. **The explicit arg selects plan, branch, and worktree before any resume gate or write** — see Step 0.

**Mode detection (pure):** parse CLI tokens with `src/implement-mode.js` (`parseImplementMode`, `isAutomateActive`, `stampExecutionMode`, `clearExecutionModeStamp`). Opt-in `--mode=automate` (or `mode:automate`) enters **pure maestro** automate mode. Absent mode / `--mode=1` stays Mode 1 (this skill's default session-writer path). Plan stamp `executionMode: automate` re-enters automate on later runs until `--clear-execution-mode`. Automate is **off by default**. When `isAutomateActive` is true, the host session follows the pure-maestro spine (never product-source edits); Mode 1 iron law still binds the single **phase writer**.

**`executionMode` stamp (mandatory on first confirmed automate entry):**

1. On the **first** session where CLI is `--mode=automate` and the plan frontmatter has **no** `executionMode: automate` yet: after Step 0 binds the plan worktree and **before** pure-maestro Steps A–I, ask the operator to confirm entering durable automate (`y/N`).
2. On interactive **`y` only**: stamp plan frontmatter with `stampExecutionMode(plan, 'automate')` → `executionMode: automate`, persist + project-state microcommit, log the decision. **Never** stamp on a silent default or on `N`.
3. **Stamp alone** makes `isAutomateActive({ planExecutionMode: 'automate' })` true on later `implement <plan>` (no CLI mode required) until clear — review cadence + pure-maestro re-entry.
4. **Clear path:** `implement --clear-execution-mode` (parse sets `clearExecutionMode: true` → `isAutomateActive` false for the **session**) **and** remove the stamp with `clearExecutionModeStamp(plan)` (delete `executionMode` from frontmatter), persist, record in the decisions log. **HARD-GATE:** before honoring clear or falling into Mode 1, call `assertLeaseAbsent(statusRoot, planSlug)` / `isLeaseBlocking` — refuse while any lease residue exists (`active`, `cleared`, or `malformed`) or merge mid-flight. Explicit `--mode=1` overrides stamp for the **coding** session only; **durable finalize/archive gates still use stamp alone** (`planExecutionMode === 'automate'`) until `clearExecutionModeStamp` removes it. Full leave-automate requires clear/unstamp **after** the lease is clean.
5. Plans that never entered automate **omit** the field; schema treats it as optional — still validates.

## Iron Law

CODING STAYS SINGLE-THREADED (ONE WRITER PER WORKTREE).
MICROCOMMITS ARE THE SNAPSHOT.

One writer touches a given working tree at a time — never two concurrent agents editing files in the same tree. Concurrent Mode 2 worktrees are allowed only when each has exactly one writer and merge-back is serial through the primary. Subagents are for read-only investigation, never parallel coding in the same tree. A task reaches `done` ONLY through verify-on-done (its deterministic verifier executed, passing, evidence written) — you never mark your own work done by assertion, and a cheap/foreign executor **never self-certifies**. After every verified task close, create explicit-path microcommits for the implementation diff and the project-state close diff; a handoff over dirty task-owned work is an emergency note, not a checkpoint.

### Automate iron laws (when `isAutomateActive`)

1. **Host-thin pure maestro.** The host session is **host-thin**: it **never** edits product source under `--mode=automate`, and it does **not** run product diagnostic entrypoints (e.g. `compose`, `build_edl`, app servers) except **verbatim** task/exit-gate verifier commands. It dispatches, sync-waits, merges (git-ops only), re-verifies, reviews, and owns every `done` / `phase-done` / finalize state write.
2. **One fresh phase agent per phase, code-only.** Granularity is the phase initiative. Spawn **one fresh phase agent** (phase writer) per phase with a **constructed brief only** — **no host chat history**. The phase writer runs orient → code → pre-close self-check → implementation microcommits → **claim report**. It **must not** invoke `done`, `phase-done`, handoff mutation, rollups, lessons, or any durable `.atomic-skills/` write.
3. **Never self-certify.** A phase-writer claim is confidence, not closure. Only the orchestrator re-running the task verifier on the **MERGED** plan tree (via verify-claim / `done`) may close. **Agents never write decision-review PASS** — only the operator writes PASS on the manual hardgate.
4. **Never silent Mode-1 fallback.** Under automate, spawn failure or review/verifier fail means re-dispatch a code-only fix agent (max **2**) or stop for the operator — **not** the host session coding product source. Leaving automate requires explicit `--clear-execution-mode` / Mode-1 re-entry recorded in the decision log. **Silent auto-PASS** of drafted `businessIntent` or decision-review is forbidden.
5. **No concurrent phase writers** in v1, even when `parallelismAllowed` is true. Sequential phases only.
6. **planEndReviewOk** (and user validation) gate finalize/archive under automate — see plan-end path and `src/plan-end-review.js`. Under durable stamp, **skip is HARD-CLOSED** (`forbidSkip: true`); phase evaluation + phase-done `review-code --mode=both` are mandatory.
7. **phase-start package + operator validate-only.** Before spawning the phase agent, present a **phase-start package**: phase **objective**, **task list** (id + title), and a **drafted** `businessIntent`. Operator role is **validate-only** for task titles and `businessIntent` (edit allowed, then ratify). **Blank-fill BI** (dumping an empty form) and silent auto-PASS are forbidden.
8. **decision-review manual hardgate.** Under automate, **decision-review** is a mandatory **manual hardgate** before `phase-done`. The agent never writes decision-review PASS; only the **operator PASS** closes that gate.

<HARD-GATE>
If you are about to mark a task `done` because it *looks* finished, without running its verifier through the `done` / verify-on-done patterns: STOP. Run the verifier. The pass is the evidence; "it works" is the claim.
If a verified task changed files and you are about to continue without committing those exact paths: STOP. Run `git diff --name-only`, classify the paths, then use {{BASH_TOOL}} with `rtk git add <explicit-paths>` and a microcommit. Never use `git add .` or `git add -A`.
If you are RESUMING and `git status` is dirty/stale OR the `## Session handoff` block has an unfilled `TODO`/`REPLACE_*` placeholder: STOP. Refuse to execute. Surface the missing pieces and resolve them (commit/stash, fill the handoff) before any task runs — a resume over an inconsistent snapshot corrupts the work.
If you are about to dispatch a read-only subagent or hand off a token-heavy read: STOP and write the snapshot FIRST (the handoff is the pre-dispatch checkpoint).
If the caller's tree already governs another plan than the one requested (`caller-governs-other-plan`): STOP. Do not run the resume gate or write plan state here — re-enter the plan's worktree first.
</HARD-GATE>

## Mindset

This is an **execution driver, not an orchestrator** — call it that so no one expects concurrency that single-threaded coding will never use. It is a serial loop with durable checkpoints: code a task, verify it, commit it, close it, commit the state, repeat. The value is not speed; it is that the work is always recoverable from git plus `.atomic-skills/` state and that no task closes on a claim instead of a fact.

The snapshot trigger is **event-driven, never a self-measured context gauge.** You cannot read your own remaining context window — the number is fabricated and the loss is silent (the host meter, where one exists, is advisory only). So you snapshot on *events* you can observe: after each task closes, before each subagent dispatch, at every phase boundary, and on request. A snapshot means a microcommit plus a refreshed handoff. A handoff that records dirty files is a crash report, not a successful checkpoint.

## Process

### Step 0 — Resolve target (plan / branch / worktree)

**Before any resume gate, dirty check, or write**, select the plan the user asked for and bind its worktree. The pure helper is `src/project-target-resolver.js` (`parsePlanArg`, `resolveImplementTarget`, `composePlanWorktreeAdd`). Skill prose must follow the same order.

0. **Parse mode flags (before plan selection).** From `{{ARG_VAR}}` / argv, call `parseImplementMode` in `src/implement-mode.js`. Tokens: `--mode=automate` / `mode:automate` / `--mode=1` / `--clear-execution-mode`. Absent mode → `mode: undefined` / `modeExplicit: false` (do **not** invent `cliMode: 'default'` — that breaks stamp re-entry). Unknown mode → refuse with a clear error (do not ignore). Combine with plan frontmatter `executionMode` via `isAutomateActive({ cliMode: parsed.mode, planExecutionMode, clearExecutionMode })`.
   - **First automate entry stamp:** if CLI mode is `automate` and plan lacks `executionMode: automate`, require interactive operator confirm (`y`) then `stampExecutionMode` + persist **before** pure-maestro Steps A–I (see stamp rules above).
   - **Clear stamp / leave-automate HARD-GATE (before Mode 1):** if `clearExecutionMode` is true **or** the session would otherwise enter Mode 1 while a prior automate stamp exists, **first** resolve the selected plan (Step 0.1–0.3) and call `assertLeaseAbsent(statusRoot, planSlug)` in `src/writer-lease.js` (also `readLeaseResult` / `isLeaseBlocking` / `hasActiveLease`). **Refuse `--clear-execution-mode` and refuse Mode-1 entry** while any lease file residue exists (`active`, `cleared`, or `malformed`), or while a sibling phase merge is mid-flight. Clear/unstamp only when the lease is `missing` (clean) — never bypass the fence by flipping mode first. Only then: `clearExecutionModeStamp` on the plan frontmatter, persist, log, and treat automate as off for this session.
   - When automate is active, enter the **Automate mode — pure maestro loop** (Steps A–I below) after Step 1 hard gates pass; do not run Mode 1 Step 2 session-writer coding.
1. **Parse the arg.** `{{ARG_VAR}}` is a bare slug (`plan-b`) or `<project-id>/<plan-slug>` (`atomic-skills/plan-b`), after stripping mode flags. If missing, ask which plan; do not silently pick a different active plan when more than one is open.
2. **Select the plan** from nested inventory (`.atomic-skills/projects/*/*/plan.md`). Prefer exact slug (+ project when given). On ambiguity, disambiguate — never invent.
3. **Bind branch + worktree.** Read the plan's `branch:` (usually `plan/<slug>`). Compare to `git symbolic-ref --short HEAD` and `git worktree list --porcelain`.
   - Already on the plan branch → home; continue to Step 0.5 (resume gate) on **this** tree.
   - Plan worktree exists elsewhere → **HALT**. Tell the user to re-run `implement` inside that worktree. Do **not** run the resume gate or write plan state in the caller tree.
   - Worktree absent → create inside the repo (`.worktrees/<slug>`). If the branch **already exists**, reuse it **without `-b`** (`git worktree add .worktrees/<slug> <plan-branch>`). Only use `-b <plan-branch>` when the branch does not exist. Then **HALT** and re-enter.
   - **`caller-governs-other-plan`:** if the caller's branch is already the home of a *different* plan, **FAIL** (HARD-GATE). Do not evaluate dirty state for plan-b while sitting on plan-a's tree; do not write plan-b state into the caller tree.
4. **Legacy `branch:` null** — no worktree binding; record degraded and continue only when a single plan is clearly intended.

Reuse `skills/shared/worktree-isolation.md` § *Step 0 — detect existing isolation BEFORE creating one*; never nest. Materialization and implement writes land **only** in the worktree declared by the plan frontmatter `branch:`.

### Step 0.5 — Resume gate (after target is home)

Run **only after** Step 0 reports home (`resumeGateAllowed`). The gate is authoritative for the **resolved** plan tree, not the tree you happened to invoke from:

1. Run `git status --porcelain` and `git log --oneline -3` via {{BASH_TOOL}} **in the plan worktree**. A dirty or unexpectedly-advanced tree on resume means the prior session left uncommitted or unrecorded work — **refuse** (HARD-GATE): surface the diff, have the user commit/stash, then retry.
2. Read the selected plan's active initiative `## Session handoff` block (if present). If it contains an unfilled `TODO`/`REPLACE_*`/`<…>` placeholder, the prior session did not finish writing it — **refuse** and surface which field is unfilled. A handoff with placeholders is not a handoff.
3. **Writer-lease HARD-GATE (always for the selected plan):** refuse resume **and** refuse `--clear-execution-mode` / Mode-1 entry if `assertLeaseAbsent` / `isLeaseBlocking` is true — **any** non-missing lease residue (`active`, `cleared`, `malformed`; see `src/writer-lease.js`) or a sibling phase merge is mid-flight. Acquire via exclusive create (`acquireLeaseFile` / `wx` → returns `{ path, secret, lease }` with on-disk `tokenHash` only); clear only with the **acquire secret** (`clearLeaseFile(statusRoot, planSlug, secret)`) after sync-wait + claim collect + merge settle — public identity fields alone never clear.
4. On a clean resume: the handoff IS your re-orientation — read its narrative + decision log + `nextAction`; do NOT cold-re-investigate. Any residual heavy read goes to a read-only subagent (below), never the main coding context.

### Step 1 — Load the admitted tasks

Resolve the active phase before accepting any pending task:

1. Read the active plan descriptor from `.atomic-skills/projects/<project-id>/<plan-slug>/plan.md` (legacy flat fallback only when that is the active state shape), find the active phase descriptor by `currentPhase` / `phaseId`, and resolve the expected materialized initiative path under `projects/<project-id>/<plan-slug>/phases/f<N>-*.md`.
2. If the parent plan phase descriptor exists but the matching initiative file is absent, this is a **descriptor-only phase**. **Refuse execution** (HARD-GATE): stop and tell the operator to run `atomic-skills:project materialize <phase-id>`. Do not enter degraded mode, do not execute a loose checklist, and do not infer tasks from the descriptor.
3. Read the active phase's initiative from `.atomic-skills/` (or the nested `projects/<id>/<slug>/phases/f<N>-*.md`) and parse its frontmatter before inspecting tasks.
4. Check the ratified `businessIntent` spine on **both** the parent plan phase descriptor and the initiative frontmatter. The complete required spine fields are: `value`, `workflow`, `rules`, `outOfScope`, `doneWhen`.
5. If either side is missing `businessIntent`, any required field is absent, blank, empty after trimming, or still contains `[NEEDS CLARIFICATION]`, **refuse execution** (HARD-GATE): stop and instruct `atomic-skills:project materialize <phase-id>` for descriptor-only state, or re-materialize/re-question the `businessIntent` spine before implementation continues. This is not the loose checklist/degraded-mode path.

After that hard pre-check passes, confirm each pending task carries the SPEC interior: one or more exact `outputs[].path` targets, `scopeBoundary[]` explicit exclusions (DO-NOT constraints), `acceptance[]`, and a deterministic `verifier:` (`kind shell|test|query`). A task missing any of these was not admitted (R-ORCH-23) — surface it and stop; do not improvise the missing spec.

### Automate mode — pure maestro loop (when `isAutomateActive`)

When `isAutomateActive` is true, **do not** run Mode 1 Step 2 (session codes). After Step 1 hard gates pass, run the pure-maestro spine.

**<HARD-GATE — load maestro asset before any spawn>**
If `isAutomateActive` and you have **not** `{{READ_TOOL}}` `skills/shared/implement-automate-maestro.md` **in this turn** before acquiring a writer lease or spawning a phase writer: **STOP**. Read that file first. The resident summary below is not a substitute for Steps A–I (claim exclusivity, D.5 merge, evaluationGate, plan-end `external-both`).

**Load the full A–I loop + claim/complex/evaluationGate/plan-end rules:**
`{{READ_TOOL}} skills/shared/implement-automate-maestro.md`

Also: phase writer `{{READ_TOOL}} skills/shared/implement-phase-writer.md`; isolation/lease `{{READ_TOOL}} skills/shared/worktree-isolation.md` + `src/writer-lease.js`; evaluation `{{READ_TOOL}} skills/shared/implement-phase-evaluator.md`; **decision log** (automate durable append + decision-review operator-only PASS) `{{READ_TOOL}} skills/shared/implement-decision-log.md` + `src/decision-log.js` (`appendDecision` / `listDecisions`); STOP helpers `src/automate-orchestrator-gates.js` (`canSpawnPhaseWriter`, `canCloseTasksFromClaims`, `canRunPhaseDone`, `canFinalizeOrArchive`). Machine preflight: `preflightPhaseDone` blocks under `executionMode: automate` without a valid `evaluationGate` (`phase-done-evaluation-open`).

**Summary (host-thin):** phase-start package (objective + tasks + drafted BI; operator validate-only) → one fresh phase agent per phase → merge → post-merge `done` → evaluation agent + `evaluationGate` → **decision-review** manual hardgate (operator PASS only; agents never write PASS) → `phase-done` with `review-code --mode=both` → next phase (materialize if descriptor-only) → plan-end **`external-both`** (codex|grok|claude) + user validation via durable stamp.

### Step 2 — Execute one task (single-threaded) — Mode 1 only

**Skip this entire step when `isAutomateActive`.** Mode 1 session-writer path only.

For the chosen task, in this order:

1. **Orient.** Read the task's `outputs[].path`, `acceptance[]`, and `scopeBoundary[]`. Treat `outputs[].path` as the exact implementation targets. Treat `scopeBoundary[]` as explicit exclusions (DO-NOT constraints), never as an allowlist. If implementation requires an unlisted target or would violate an exclusion, stop and report the exact path and reason; do not silently widen. A required violation of `scopeBoundary[]` is a runtime scope exit and a `businessIntent` re-question event because execution has drifted from the ratified spine.

   **D6.1 `businessIntent` re-question events (exactly two):**

   1. A critic/review reports drift from the original `businessIntent`.
   2. Implement Step 2.1 reports a required violation of a `scopeBoundary` exclusion with the exact path and reason.

   These are the only two `businessIntent` re-question points for this plan. `lint-source.js` is explicitly not the D6.1b runtime trigger: it validates admitted `scopeBoundary[]` at admit time, before implementation, and this flow adds no new static detector machinery.
2. **Distill heavy reads (optional).** If a read would flood context, snapshot first, then delegate a read-only summary to {{INVESTIGATOR_TOOL}}. The subagent never edits.
3. **Code the change.** Make the minimum single-threaded edit inside scope; use `atomic-skills:fix` when a failing test needs root-cause work.
4. **Pre-close check.** Run the deterministic verifier/check before committing implementation code when the task has one, using the cheapest real command available. This is implementation confidence, not closure evidence: `done <task-id>` is the closure authority and reruns the task verifier from `tasks[].verifier`, then writes `tasks[].evidence`. Do not copy a pre-close `verify-claim` transcript into task evidence.
5. **Commit the implementation diff.** Use `rtk git diff --name-only`, stage only task-owned explicit paths, never `git add .` / `-A`, and commit with a task-scoped subject.
6. **Load closure authority (required).** Before invoking `done`, `{{READ_TOOL}}` both:
   - `{{ASSETS_PATH}}/project-transitions.md` (the **canonical done flow** — status, evidence, event, rollups, checkpoint)
   - `{{ASSETS_PATH}}/verifier-exec.md` (per-kind verifier executor + GATE-R2 evidence shape)
   Closure **delegates** to that flow. Do **not** reimplement `done` inside implement; do not invent a second evidence path.
7. **Close it.** After the implementation commit and the loads above, run `done <task-id>` via the project skill. The `done` flow executes the per-task verifier before setting `status: done`, writes evidence + `nextAction` + **`## Session handoff` in the same durable save**, emits an identity-deduped `task-done` completion event, refreshes state, and owns the single project-state checkpoint commit. GATE-R2 enforces evidence. Handoff is **inside** that checkpoint (not a follow-up edit) so resume never sees a clean HEAD with a stale handoff — status, evidence, and handoff share the same commit. Retry of the same close is idempotent (`decideDoneTerminal` / `appendCompletion` — zero duplicate events or terminal rewrites).
8. **Confirm the close checkpoint.** If `done` reports that its checkpoint commit succeeded, do not create a second close commit (including "fix handoff" commits). If it reports an uncommitted state diff, stop and resolve only the explicit state paths it names. Leaving handoff dirty after the checkpoint is a close failure.
9. **Snapshot check.** After a healthy close the worktree is clean (or only explicitly unrelated dirty files); the handoff block already in the checkpoint records that. Only refresh handoff outside `done` on non-close events (pre-dispatch, phase boundary, on request).

### Step 3 — Phase boundary

When the last task of the phase closes, `done` announces the phase transition.

- **Mode 1:** Run `phase-done` (`{{ASSETS_PATH}}/project-transitions.md`): it executes every pending exit-gate verifier (verify-on-done), runs the mandatory `review-code` phase-diff gate, advances the plan, and writes phase-boundary microcommits for each logical state checkpoint.
- **Automate (`isAutomateActive`):** Fixed order — all phase tasks `done` → **evaluation agent** (read-only; see `skills/shared/implement-phase-evaluator.md`) → stamp `phases[].evaluationGate` via `buildEvaluationGate` / `canRunPhaseDone` → **decision-review** mandatory manual hardgate (operator PASS only; the agent never writes decision-review PASS) → then `phase-done` with `review-code --mode=both` (default under automate; F2 owns transition wiring). Do not skip the evaluation agent, the evaluationGate stamp, or auto-PASS decision-review. On evaluation blocker/critical, reopen/fix (max 2 re-dispatches) before phase-done. Orchestrator writes re-dispatch / skip / disposition / scope-exit to the durable **decision log** (`skills/shared/implement-decision-log.md`, `src/decision-log.js`) **before continuing**.

Snapshot at the boundary. Do not auto-advance — the user opts in (intrusive-actions rule). Finalize/archive after the last phase still require `planEndReviewOk` and that the **user validates** implementation (automate / `userValidationOk` in `src/plan-end-review.js`).

**Session cut-over (advisory, v1).** At a phase boundary, if the next pending task is structurally unrelated to the recent working set, you MAY recommend writing the handoff and starting a fresh session (a tightly-scoped fresh context beats a large stale one). This is advisory only — see `docs/design/project-orchestrator/06-session-boundary-and-telemetry.md` (F-E1). It never forces a cut, and it never reads a self-reported context-%.

## The `## Session handoff` block (the resume contract)

The handoff lives in the active initiative body (durable `.atomic-skills/` state — there is no separate scratch file, R-EXEC-08). It is written event-driven (Step 2.6, before each dispatch, at phase boundaries, on request). It MUST carry these five elements, and **literals are verbatim — never paraphrased** (a paraphrased command/path/error is a different command/path/error):

```markdown
## Session handoff
- **Narrative:** where we are, in 2–4 sentences — the phase, what just landed, what is mid-flight.
- **Decision log:** the load-bearing choices made this session and why (so the next session does not re-litigate them).
- **Single nextAction:** ONE concrete next step (e.g. "Run `done T-004`, then start T-005 in src/foo.js"). Exactly one — not a list.
- **Verbatim state:** the exact paths, commands, and error text in play — pasted, not summarized. `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js" .atomic-skills/...`, the failing assertion, the file:line.
- **Uncommitted changes:** the `git status --porcelain` list at snapshot time. Expected value after a healthy task close is "clean tree" or explicitly unrelated pre-existing files; task-owned dirty files mean the microcommit checkpoint was skipped and must be fixed before continuing.
```

`resume` reads this block and refuses if the tree is dirty/stale or any field is an unfilled placeholder (Step 0). A self-sufficient handoff is the entire cost of a cheap resume — the next session re-orients from it, not from a cold investigation.

## Microcommit discipline

Microcommits are part of the execution loop, not an end-of-session cleanup. The smallest healthy unit is:

1. Implementation commit after a real pre-close check: {{BASH_TOOL}} `rtk git add <explicit-paths>` then `rtk git commit -m "feat(T-NNN): <summary>"`.
2. State close commit is owned by `done <task-id>`: it stages the explicit state paths it writes and commits `rtk git commit -m "chore(project): checkpoint <plan> <phase> <task-id>"`. The implement driver verifies that checkpoint happened instead of creating a duplicate close commit.
3. Phase boundary commit after `phase-done`: {{BASH_TOOL}} `rtk git add <explicit-state-paths>` then `rtk git commit -m "chore(project): advance <plan> <phase>"`.

Never use `git add .` or `git add -A`. If a formatter or generator changes additional files, classify them into the relevant microcommit or stop and explain why they are unrelated.

## Heavy reads via subagents (snapshot-before-dispatch)

Coding is single-threaded; only **reads** fan out. When a read would flood the main context, dispatch a read-only {{INVESTIGATOR_TOOL}} subagent with a constructed brief, and **snapshot immediately before** the dispatch (R-EXEC-15) so a crash mid-read loses nothing. The subagent returns a distilled summary; the editing still happens in the one main thread.

{{#if ide.claude-code}}
Optional accelerator (Claude Code): fan the read-only investigation subagents out in parallel natively. Coding stays single-threaded regardless — parallelism is for reads only.
{{/if}}

{{#if ide.grok}}
On Grok Build, heavy reads use `spawn_subagent` (explore). Prefer one focused read-only subagent unless the host clearly supports parallel spawn; coding stays single-threaded either way. Do not invent plugin agent types for v1 — tool vars + built-in explore/plan are enough.
{{/if}}

## Mode 2 — Codex cross-provider execution (the DEFAULT executor for spec-ready tasks when the lane is on)

When the Codex lane is on, Mode 2 hands spec-ready execution to Codex in an isolated `git worktree`; Opus plans, reviews, and owns state. Read the full contract in `{{READ_TOOL}} skills/shared/mode2-codex-lane.md` before dispatching. Four invariants:

1. **Routing is per-task.** Use Codex only when routing enables it and the task has exact paths, settled design, `scopeBoundary[]`, `acceptance[]`, and a deterministic verifier; otherwise Mode 1, with reason recorded.
2. **Opus plans + reviews, never executes.** The cheap/Codex executor self-**checks** but never self-**certifies** — the executed verifier on the merged tree is the adjudicator (`verify-claim`, R-EXEC-28).
3. **State-tree fence.** Codex writes only scoped source inside its worktree and NEVER the durable `.atomic-skills/` project state — Opus owns every state transition (Decision #11).
4. **Merge-back is serial.** Merge one worktree at a time and re-run the verifier on the MERGED primary; conflicts or post-merge FAIL leave the task `active`.

## Degraded mode (explicit ad-hoc only)

Degraded mode is the absorbed `executing-plans` loop for work the user has **explicitly declared ad-hoc** (Iron Law: "or the user must explicitly declare ad-hoc"). It is **not** a bypass for plan tasks that lack SPEC/verifiers.

**Enter degraded mode only when:**
1. The user said "ad-hoc" / "one-off" / "no plan" (verbatim declaration), **and**
2. There is no active plan initiative driving the session.

**Never enter degraded mode when:**
- A plan task is missing admitted outputs/scopeBoundary/acceptance/verifier — **STOP and surface the SPEC gap** (Step 1 hard-stop). Do not improvise.
- A descriptor-only phase is active — refuse and `materialize` first.
- Mode 2 / Codex is expected — degraded has no tiering, no worktrees, no Mode 2.

In degraded mode: do one item, verify it with the cheapest real check available, microcommit it, snapshot, next. The same single-threaded code→verify→commit→snapshot rhythm without lifecycle scaffolding.

## Cross-agent note

The spine is portable: tasks read from durable `.atomic-skills/` state, verifiers run via {{BASH_TOOL}}, heavy reads via the read-only {{INVESTIGATOR_TOOL}}, handoff/resume via durable markdown. No host-orchestration tooling drives the loop, so it runs identically on every IDE; the Claude-Code accelerators (native parallel read fan-out, native worktree tools) are admitted only inside Claude-Code-only conditional blocks and are never the only path.

## Code-quality gates

This flow is bound by `docs/kb/code-quality-gates.md`:

- **G1 read-before-claim** — before stating what a task's code does or that a verifier passed, paste the source lines / the captured run output.
- **G2 soft-language ban** — no `should`/`probably`/`works`/`looks done` in a completion claim or the handoff narrative; a task is `done` with `passed: true` evidence or it is not done.
- **G6 reference-or-strike** — every claim in the handoff carries a verbatim path/command/error or is struck; a vague "fixed the thing" is deleted on the next read.

## Self-review against gates

Before declaring a phase's implementation done, append to the initiative's self-review block:

```
- G1 read-before-claim: applied — each closed task links source lines / the verifier run that closed it
- G2 soft-language: applied — completion claims are passed:true evidence, handoff scanned for the ban list
- G6 reference-or-strike: applied — handoff literals are verbatim paths/commands/errors
```

Silent application is forbidden; the checkpoint ships in the durable state.

## Red Flags

Resident **triggers** only — if a thought matches one, STOP and read its full refutation in `{{READ_TOOL}} skills/shared/implement-antipatterns.md` (§ Red Flags — full refutations) before acting:

- "I'll spin up two agents to code two tasks in parallel and merge."
- "It looks finished — mark it done and run the verifier later."
- "The subagent/Codex reported it's done, so it's done."
- "I'm probably running low on context, let me wrap up."
- "The handoff narrative reads cleaner if I summarize the error instead of pasting it."
- "The tree's a little dirty but I know what I was doing — resume anyway."
- "This change violates one scopeBoundary exclusion, I'll just include it."
- "This task is roughly specified, but Codex is the default now — it'll figure out the rest."
- "Codex is the default executor now, so I'll let it edit `.atomic-skills/` state / touch a file outside its `scopeBoundary[]`."
- "The spec isn't fully settled, but I'll dispatch Codex and let it fill the gaps as it goes."
- "All six Codex tasks came back reporting their verifiers passed — I'll mark the batch done and merge."
- "All three worktrees passed in isolation — I'll merge all three, then run the verifier once at the end."
- "It passed in the worktree and the merge applied cleanly — the re-run on the primary is redundant."
- "The merge conflict is trivial — I'll force-resolve it and `git worktree remove --force` to keep moving."
- "The user/lead told me to code tasks in parallel — the files don't overlap, so it's safe."
- "Eight verifiers passed this session, the ninth is identical — running it is busywork."
- "The handoff has a TODO but the user said keep going — I'll stub the unfilled piece and work around it."
- "The user prefers terse handoffs — 'ran validate-state' is clear enough."
- "Automate is active but the phase writer died — I'll just code the remaining tasks myself (silent Mode-1 fallback)."
- "The phase writer said all verifiers passed — mark them done without re-running on the merged tree."
- "I'll spawn two phase writers for independent phases in parallel under automate."
- "I'll nest the phase worktree under the plan worktree to keep paths tidy."
- "Automate is on but I need to see the failure — I'll run compose / build_edl (or start the app server) from the host to diagnose."
- "The phase is small — I'll just close the entire phase Steps A through I myself as a host mega-session without spawning a phase agent."
- "I'll auto-write decision-review PASS (or silently auto-PASS the drafted businessIntent) so we can phase-done."
- "I'll dump a blank businessIntent form on the operator instead of a drafted phase-start package — they'll fill it."

If you thought any of the above: STOP. Go back to the step you were skipping.

## Rationalization

The full Temptation→Reality table (every rationalization above, refuted with its rule cite) lives in `{{READ_TOOL}} skills/shared/implement-antipatterns.md` (§ Rationalization) — read it when you catch yourself reaching for one of these. The load-bearing ones, in one line each: concurrent coding corrupts (serial by law, R-EXEC-13); the verifier is the only thing separating `done` from a claim (GATE-R2); a foreign executor self-checks but never self-certifies — re-run on the merged tree (R-EXEC-28/29); merge-back is serial (R-XAGENT-03); you cannot read your own context % — snapshot on events (R-ORCH-32); handoff literals are verbatim (R-EXEC-10); refuse a dirty/placeholder resume (R-ORCH-33); Codex-as-default is still gated on the F1 spec-ready + F2 verifier routing gates and the state-tree fence (R-EXEC-44/43, Decision #11).

## Closing

Output of a clean run: the phase's tasks each closed through a verified PASS (evidence in durable state), the `## Session handoff` block current and self-sufficient, the tree committed or its uncommitted changes recorded verbatim, and — at a phase boundary — `phase-done` run with its exit-gate verifiers and review gate. implement never closes a task on a claim and never codes two tasks at once.

Under `--mode=automate` / pure maestro **host-thin**: host never edits product source and never runs product diagnostics except verbatim verifiers; phase-start package (objective + tasks + drafted BI) with operator validate-only; one fresh phase agent per phase; orchestrator owns merge, post-merge re-verify, `done`, evaluation agent, decision-review manual hardgate (operator PASS only — agents never write PASS), and `phase-done`; never self-certify; never silent Mode-1 fallback or silent auto-PASS; finalize/archive require `planEndReviewOk` and that the user validates implementation.
