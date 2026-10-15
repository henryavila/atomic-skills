# implement harness reference

Not an entry. Not a second path. The session that was asked to run `implement` stops at the launcher in `skills/core/implement.md`. The `/loop` session runs `skills/shared/implement-orchestrator-tick.md` and reads this file only when a printed action needs a gate (assert, done, phase-done, handoff, delivery audit). Do not start at Step 0.5.

### Step 0.5 — Resume gate (after target is home)

**STOP if this session was asked to run implement.** The launcher already ended it. Do not run this step here.

Run **only after** Step 0 reports home (`resumeGateAllowed`). The gate is authoritative for the **resolved** plan tree, not the tree you happened to invoke from:

1. Run `git status --porcelain` and `git log --oneline -3` via {{BASH_TOOL}} **in the plan worktree**. A dirty or unexpectedly-advanced tree on resume means the prior session left uncommitted or unrecorded work — **refuse** (HARD-GATE): surface the diff, have the user commit/stash, then retry.
2. Read the selected plan's active initiative `## Session handoff` block (if present). If it contains an unfilled `TODO`/`REPLACE_*`/`<…>` placeholder, the prior session did not finish writing it — **refuse** and surface which field is unfilled. A handoff with placeholders is not a handoff.
3. **Writer-lease HARD-GATE (always for the selected plan):** refuse resume **and** refuse `--clear-execution-mode` / Mode-1 entry if `assertLeaseAbsent` / `isLeaseBlocking` is true — **any** non-missing lease residue (`active`, `cleared`, `malformed`; see `src/writer-lease.js`) or a sibling phase merge is mid-flight. Acquire via exclusive create (`acquireLeaseFile` / `wx` → returns `{ path, secret, lease }` with on-disk `tokenHash` only); clear only with the **acquire secret** (`clearLeaseFile(statusRoot, planSlug, secret)`) after sync-wait + claim collect + merge settle — public identity fields alone never clear.
4. On a clean resume: the handoff IS your re-orientation — read its narrative + decision log + `nextAction`; do NOT cold-re-investigate. Any residual heavy read goes to a read-only subagent (below), never the main coding context.

### Step 0.7 — Grok phase scaffold reseed (start + post-compaction)

**Grok-local only** — contract `docs/kb/grok-phase-todo-projection.md`. Session checklist is a **projection only** (never close authority; GATE-R2 stays on verifiers / `done` / `phase-done`). Project **phases** of the active plan — **never** tasks `T-00N` as session todos.

After Step 0 reports home (and a clean Step 0.5 resume), **and after any host context compaction** that drops the session checklist:

1. Run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/refresh-state.js"`.
2. Run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/project-session-todos.js" --json` and **parse the JSON payload**.
3. On Grok, apply that payload with the session checklist tool (`todo_write`) **verbatim**: use the emitted `merge` flag and `todos[]` as returned — **do not recompute** merge/winner independently. The helper already encodes winner → `merge: false` (full phase reseed) and empty focus / no winner → `merge: true` + empty todos (no wipe).

**anti-proc:** while a plan is **anchored**, a concurrent process scaffold (`proc:*` from bundled flows) is **forbidden** as competing session todos. Keep process steps as handoff narrative, not a second checklist.

Skill path reseeds independently of SessionStart (Soft hooks are hint-only / fail-open). Host-thin pure-maestro may apply `todo_write` as **orchestration** without product-source edits — detail: `skills/shared/implement-automate-maestro.md`.

### Step 1 — Load the admitted tasks

**STOP if this session was asked to run implement.** The launcher already ended it. Do not load tasks or code here.

Resolve the active phase before accepting any pending task:

1. Read the active plan descriptor from `.atomic-skills/projects/<project-id>/<plan-slug>/plan.md` (legacy flat fallback only when that is the active state shape), find the active phase descriptor by `currentPhase` / `phaseId`, and resolve the expected materialized initiative path under `projects/<project-id>/<plan-slug>/phases/f<N>-*.md`.
2. If the parent plan phase descriptor exists but the matching initiative file is absent, this is a **descriptor-only phase**. **Refuse execution** (HARD-GATE): refuse writer spawn / product coding. Under **automate** (`isAutomateActive`): present the **phase-start package as draft only** (objective + task id/title + drafted BI — **no durable BI write yet**), operator **validate-only** on the BI spine, **explicit ratify**, **then** materialize from the phase source sidecar with the **ratified** spine (materialize accepts pre-ratified complete spine; does not invent from blank form; does not write BI before ratify). No silent host coding of the new phase before ratify. Under Mode 1: stop and tell the operator to run `atomic-skills:project materialize <phase-id>`. Do not enter degraded mode, do not execute a loose checklist, and do not infer tasks from the descriptor.
3. Read the active phase's initiative from `.atomic-skills/` (or the nested `projects/<id>/<slug>/phases/f<N>-*.md`) and parse its frontmatter before inspecting tasks.
4. Check the ratified `businessIntent` spine on **both** the parent plan phase descriptor and the initiative frontmatter. The complete required spine fields are: `value`, `workflow`, `rules`, `outOfScope`, `doneWhen`.
5. If either side is missing `businessIntent`, any required field is absent, blank, empty after trimming, or still contains `[NEEDS CLARIFICATION]`, **refuse execution** (HARD-GATE): stop and instruct `atomic-skills:project materialize <phase-id>` for descriptor-only state, or re-materialize/re-question the `businessIntent` spine before implementation continues. This is not the loose checklist/degraded-mode path.

After that hard pre-check passes, confirm each pending task carries the SPEC interior: one or more exact `outputs[].path` targets, `scopeBoundary[]` explicit exclusions (DO-NOT constraints), `acceptance[]`, and a deterministic `verifier:` (`kind shell|test|query`). A task missing any of these was not admitted (R-ORCH-23) — surface it and stop; do not improvise the missing spec.

6. **Ground-truth review HARD-GATE (mandatory; cannot be skipped).** Before any
   product coding, Mode 1 task loop, or automate phase-writer spawn, prove the
   plan carries a durable plan↔code ground-truth receipt (Directions A+B). Run
   via {{BASH_TOOL}} against the resolved plan file (not the tree-wide scan):

   ```bash
   PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
   node "$PKG_ROOT/scripts/find-plans-missing-ground-truth.js" \
     .atomic-skills/projects/<project-id>/<plan-slug>/plan.md
   ```

   - **Exit 0** → continue.
   - **Non-zero** → **REFUSE** (HARD-GATE). Do not code, do not spawn a phase
     writer, do not enter degraded mode for plan tasks. Surface the detector
     output verbatim and instruct: run the **specialized** ground-truth mode
     (not internal):
     `atomic-skills:review-plan --mode=ground-truth <plan>`
     (alias `--mode=gt`; Flow E — items 21–22; persists `## Ground-truth review`
     with content floor and `- ground-truth: … | mode=ground-truth | fp=<hex> | …`
     — see `skills/shared/project-assets/ground-truth-review.md`). Re-run the
     detector until exit 0. Under automate, `assert-automate-gate --gate spawn`
     also enforces this fence in JS (not prose-only).
   - **Empty / no-product-code repo is not an exemption** — the review must
     still have been run and persisted as `complete-empty-repo` (or complete
     with A/B "none" + scan evidence). There is **no** operator skip flag and
     **no** chat waiver that unlocks implement without the receipt.

7. **Validated flow HARD-GATE (mandatory; cannot be skipped).** Before any
   product coding, Mode 1 task loop, or automate phase-writer spawn, prove the
   plan carries a ratified flow artefact. Ready without flow is legal;
   `process.yaml` NEVER satisfies; implement does **not** run show+ratify.
   Run via {{BASH_TOOL}} against the resolved plan file:

   ```bash
   PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
   node "$PKG_ROOT/scripts/find-missing-flow.js" \
     .atomic-skills/projects/<project-id>/<plan-slug>/plan.md --strict
   ```

   - **Exit 0** → continue.
   - **Non-zero** → **REFUSE** (HARD-GATE). Do not code, do not spawn. Surface
     the detector and instruct `atomic-skills:project flow`. Re-run until exit
     0. Automate: `assert-automate-gate --gate spawn` also fences this in JS.
   - **No** `operatorSkip`, **no** chat waiver. Foreign: same detector on the
     source `plan.md` (`dirname(plan.md)/flow/` via `flowPathsForPlan`, never
     the sidecar). Ad-hoc without a plan file is N/A; a plan file always gates.

### Approved-plan orchestrator tick

The calling session already stopped at the Launcher. It showed one `/loop` line and told the user to paste it into a new session. Do not run this section from that session. The new session follows `skills/shared/implement-orchestrator-tick.md`: one tick, then exit. It does not print another `/loop`. It does not write `userValidatedAt`. Without `planApprovedAt`, there is no command — `project approve` first.

### Automate mode — pure maestro loop (when `isAutomateActive`)

**STOP if this session was asked to run implement.** The launcher already ended it. This section is reference for a later session. Do not enter it from the invoking session.

When `isAutomateActive` is true, **do not** run Mode 1 Step 2 (session codes). After Step 1 hard gates pass, run the pure-maestro spine.

**<HARD-GATE — load maestro asset before any spawn>**
If `isAutomateActive` and you have **not** `{{READ_TOOL}}` `skills/shared/implement-automate-maestro.md` **in this turn** before acquiring a writer lease or spawning a phase writer: **STOP**. Read that file first. The resident summary below is not a substitute for Steps A–I (claim exclusivity, D.5 merge, evaluationGate, plan-end `external-both`).

**Load the full A–I loop + claim/complex/evaluationGate/plan-end rules:**
`{{READ_TOOL}} skills/shared/implement-automate-maestro.md`

Also: phase writer `{{READ_TOOL}} skills/shared/implement-phase-writer.md`; isolation/lease `{{READ_TOOL}} skills/shared/worktree-isolation.md` + `src/writer-lease.js`; evaluation `{{READ_TOOL}} skills/shared/implement-phase-evaluator.md`; STOP helpers `src/automate-orchestrator-gates.js` (`canSpawnPhaseWriter`, `canCloseTasksFromClaims`, `canDoneFromAutomateClaims` claim-bound done, `canRunPhaseDone`, `canFinalizeOrArchive`) + `complexTaskAllowsDone`; **Layer-2 assert CLI** `scripts/assert-automate-gate.js` (required before Steps C/E/G/I — non-zero exit forbids advance; `--gate done` is claim-bound under stamp); **Layer-2.5 maestro cursor** `src/maestro-cursor.js` (update on each A–I boundary; assert refuses illegal step; after phase-done **`awaiting-operator-advance`** until **`clearContinue`** with `operator-continue`; Step A uses `cursorAllowsStepA`); **Layer-3 runner** `scripts/automate-phase-run.js` (Step C: **prepare → spawn → validate** via `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/automate-phase-run.js"`). Machine preflight: `preflightPhaseDone` blocks under `executionMode: automate` without a valid `evaluationGate` (`phase-done-evaluation-open`).
**Step A under pause:** if `cursorAllowsStepA` / cursor step is `awaiting-operator-advance`, **refuse** loading/spawning the next phase until `clearContinueFile` with the operator continue token. Do not treat phase-done y-accept alone as continue when the cursor is paused.

**Summary:** one code-only phase writer per phase → merge → post-merge `done` → evaluation agent + `evaluationGate` → **distill lessons + stamp `lessonsState` (recorded+path or explicit none, no operator question)** → `review-code --mode=both` → decision-review (ask only on tradeoff or scope-exit) → **run `audit-delivery` + stamp `deliveryAuditGate` (never skippable)** → `phase-done` → **host `clearContinue` (`operator-continue`, no question)** → next phase (inherit the ratified plan direction) → plan-end **`external-both`** (codex|grok|claude) + user validation via durable stamp. **Assert gates at C/E/G/I** via `assert-automate-gate` before each advance (phase-done requires evaluation **and** lessons **and** `deliveryAuditGate`); **advance the maestro cursor** on every A–I boundary so the step matches. **Never skip skill steps** under automate (evaluation, lessons, review, audit-delivery, assert).
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
7. **Close it.** After the implementation commit and the loads above, run `done <task-id>` via the project skill. The `done` flow executes the per-task verifier before setting `status: done`, writes evidence + `nextAction` + **`## Session handoff` in the same durable save**, emits an identity-deduped `task-done` completion event, refreshes state, and owns the single project-state checkpoint commit. GATE-R2 enforces evidence. Handoff is **inside** that checkpoint (not a follow-up edit) so resume never sees a clean HEAD with a stale handoff — status, evidence, and handoff share the same commit. Retry of the same close is idempotent (`decideDoneTerminal` / `appendCompletion` — zero duplicate events or terminal rewrites). **Mode 1 post-done Grok projection** is owned by `project-transitions.md` (`done` step 5b: after `refresh-state` → `project-session-todos` → apply via `todo_write` on Grok) — do not invent a second close path or mark session todos completed to *cause* durable close.
8. **Confirm the close checkpoint.** If `done` reports that its checkpoint commit succeeded, do not create a second close commit (including "fix handoff" commits). If it reports an uncommitted state diff, stop and resolve only the explicit state paths it names. Leaving handoff dirty after the checkpoint is a close failure.
9. **Snapshot check.** After a healthy close the worktree is clean (or only explicitly unrelated dirty files); the handoff block already in the checkpoint records that. Only refresh handoff outside `done` on non-close events (pre-dispatch, phase boundary, on request).

### Step 3 — Phase boundary

When the last task of the phase closes, `done` announces the phase transition.

- **Mode 1:** Run `phase-done` (`{{ASSETS_PATH}}/project-transitions.md`): it executes every pending exit-gate verifier (verify-on-done), runs the mandatory `review-code` phase-diff gate, **and** the **delivery-audit HARD-GATE** below, advances the plan, and writes phase-boundary microcommits for each logical state checkpoint.
- **Automate (`isAutomateActive`):** Fixed order — all phase tasks `done` → **evaluation agent** (read-only; see `skills/shared/implement-phase-evaluator.md`) → **persist evaluationReport under `.atomic-skills/reviews/`** → stamp authentic `evaluationGate` (`passed` + non-empty **`reportPath`**, or operator **`operatorSkip`**+reason / disposition — never forge) → **distill lessons** (draft → stamp **`lessonsState: recorded` + `lessonsPath`**, or **`none`** on a clean phase — no operator question) → **`review-code --mode=both`** (default under automate) → stamp honest **`reviewGate`** (`mode: both` + `at` + `reviewFile`; local only with **`overrideReason`**) → decision-review (stamp passed with `packagePath` when the log has no tradeoff or scope-exit; otherwise {{ASK_USER_QUESTION_TOOL}} PASS|FAIL) → **run `atomic-skills:audit-delivery`** against the phase Intent Package / BI spine → **persist report** under `.atomic-skills/reviews/` → stamp **`phases[].deliveryAuditGate`** via `buildDeliveryAuditGate` (`status: passed` + non-empty **`reportPath`** + verdict **`CLOSED|PARTIAL`** + **`verifiedAt`** — **OPEN never stamps passed**; **no `operatorSkip` / no `status: skipped`** — skip is illegal) → **then** **`assert-automate-gate --gate phase-done` (exit 0 required — evaluation + lessons + review + `deliveryAuditAllowsClose`)** → **then** terminal `phase-done` writes. Do not assert before review + delivery audit; do not skip evaluation, lessons, review, **audit-delivery**, or the assert. Plan-end `intentVsDelivered` is **not** a substitute for `deliveryAuditGate`. On evaluation blocker/critical, reopen/fix (max 2 re-dispatches) before phase-done. Evaluation pass does not finalize. Orchestrator writes dispositions to the durable decisions log.

**<HARD-GATE — deliveryAuditGate on every phase-done (Mode-1 + pure-maestro; NEVER skippable)>**
Before terminal `phase-done` / advance (both Mode-1 session-writer and pure-maestro):

1. Run **`atomic-skills:audit-delivery`** for this phase (Intent Package from handoff / BI spine / phase acceptance — not a chat-only blessing).
2. Persist the durable report under `.atomic-skills/reviews/`.
3. Stamp **`phases[].deliveryAuditGate`**: `{ status: 'passed', reportPath, verdict: 'CLOSED'|'PARTIAL', verifiedAt }` (`src/phase-delivery-audit-gate.js` / `buildDeliveryAuditGate`). **OPEN never stamps passed.** Missing gate, empty `reportPath`, `status: skipped`, `operatorSkip`, reason-only, forge, or treating **review-code** / green suite / plan-end **`intentVsDelivered`** as substitute → **STOP** (`deliveryAuditGateHonesty` / `deliveryAuditAllowsClose` / `canRunPhaseDone` fail closed under automate).
4. Only then run `phase-done` / `assert-automate-gate --gate phase-done`.

There is **no** skip path, tip-only path, or “small phase / no product intent” waiver for this gate.
</HARD-GATE>
Snapshot at the boundary. Do not auto-advance — the user opts in (intrusive-actions rule). Finalize/archive after the last phase still require `planEndReviewOk` (under automate: **intent-vs-delivered** brief + non-empty receipt `intentVsDelivered` — see `src/plan-end-intent-surface.js` / Step I in `implement-automate-maestro.md`), that the **user validates** implementation (automate / `userValidationOk` in `src/plan-end-review.js` — operator-owned, never auto-PASS), and **`assert-automate-gate --gate finalize` exit 0**.

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
On Grok Build: heavy reads use `spawn_subagent` (`explore` only). Phase writer under automate uses `spawn_subagent` with **`subagent_type: general-purpose`** (NOT explore), cwd = sibling worktree, sealed brief — full recipe in `skills/shared/implement-automate-maestro.md` Step C. **Host product coding under `isAutomateActive` is forbidden** (Iron Law single-writer applies to the writer in the sibling tree, not permission for host Mode-1 on the plan branch). Do not invent plugin agent types for v1.
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

The spine is portable across Claude Code, Codex, Antigravity, and Grok Build: tasks read from durable `.atomic-skills/` state, verifiers run via {{BASH_TOOL}}, the phase writer is one write-capable {{INVESTIGATOR_TOOL}} call (host argument shapes in `skills/shared/implement-automate-maestro.md` Step C), handoff/resume via durable markdown. No host-orchestration tooling drives the loop, so it runs identically on every IDE; the Claude-Code accelerators (native parallel read fan-out, native worktree tools) are admitted only inside Claude-Code-only conditional blocks and are never the only path.

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
- "I'll spawn two writers onto the same worktree or onto overlapping paths."
- "I'll code or spawn in the session that was asked to run implement, instead of showing the /loop command."
- "The plan is approved, so I'll ask the operator whether to continue."
- "I'll stamp userValidatedAt so the tick can finish."
- "I'll nest the phase worktree under the plan worktree to keep paths tidy."
- "I'll skip assert-automate-gate — the pure helpers already exist in my head."
- "I'll host-code product source on the plan branch under automate (Mode-1 plan-tree commit)."
- "Skill prose said spawn — skip the Layer 3 automate-phase-run runner."
- "Stamp is automate but I'll silently drop into Mode 1 coding without clear-execution-mode."
- "Bare `implement` is session-writer Mode 1 — I'll code product source myself without `--mode=1`."
- "No product code yet / greenfield — skip ground-truth and start coding."
- "Internal review receipt exists — ground-truth is optional for implement."
- "User said go ahead without the ground-truth section — waive the detector."
- "process.yaml exists — skip flow."
- "User said waive flow."
- "I'll run project flow ceremony inside implement."
- "Ad-hoc with a plan file — skip flow (only no plan file is N/A)."
- "Foreign sidecar is the flow path."
- "This is path/to/plan.md — I'll just code the checklist (skip entry {{ASK_USER_QUESTION_TOOL}})."
- "Foreign lane finished — promote/adopt into .atomic-skills at FINALIZE."
- "Foreign plan — skip worktree / skip ground-truth / mark done without verifier on the sidecar."
- "I'll only recommend audit-delivery after phase-done instead of running it."
- "I'll skip audit-delivery / stamp deliveryAuditGate skipped / operatorSkip — small phase."
- "review-code / green suite / plan-end intentVsDelivered already ran — skip delivery audit."
- "I'll forge deliveryAuditGate passed without a real reportPath."
If you thought any of the above: STOP. Go back to the step you were skipping.

## Rationalization

The full Temptation→Reality table (every rationalization above, refuted with its rule cite) lives in `{{READ_TOOL}} skills/shared/implement-antipatterns.md` (§ Rationalization) — read it when you catch yourself reaching for one of these. The load-bearing ones, in one line each: concurrent coding corrupts (serial by law, R-EXEC-13); the verifier is the only thing separating `done` from a claim (GATE-R2); a foreign executor self-checks but never self-certifies — re-run on the merged tree (R-EXEC-28/29); merge-back is serial (R-XAGENT-03); you cannot read your own context % — snapshot on events (R-ORCH-32); handoff literals are verbatim (R-EXEC-10); refuse a dirty/placeholder resume (R-ORCH-33); Codex-as-default is still gated on the F1 spec-ready + F2 verifier routing gates and the state-tree fence (R-EXEC-44/43, Decision #11).

## Closing

Output of a clean run: the phase's tasks each closed through a verified PASS (evidence in durable state), the `## Session handoff` block current and self-sufficient, the tree committed or its uncommitted changes recorded verbatim, and — at a phase boundary — `phase-done` run with its exit-gate verifiers and review gate. implement never closes a task on a claim and never codes two tasks at once.

Under **automate default** (bare `implement` / `--mode=automate` / stamp) / pure maestro: the session never edits product source; one code-only phase writer per phase; orchestrator owns merge, post-merge re-verify, `done`, evaluation agent, **lessons distill + stamp**, **audit-delivery + `deliveryAuditGate`**, and `phase-done`; never self-certify; never silent Mode-1 fallback; **never skip skill steps** (evaluation, lessons, review, audit-delivery, assert); run `assert-automate-gate` before spawn/done/phase-done/finalize (non-zero forbids advance; phase-done requires evaluation **and** `lessonsState` **and** valid `deliveryAuditGate`); keep the **maestro cursor** current on each A–I boundary (`awaiting-operator-advance` after phase-done); never delete cursor/lease to force progress; finalize/archive require `planEndReviewOk` and that the user validates implementation. Mode 1 is the **explicit** escape (`--mode=1`), not the bare-implement path — and Mode-1 still hard-requires `deliveryAuditGate` before phase-done.