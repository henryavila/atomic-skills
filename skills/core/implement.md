Drive the SPEC-admitted Tasks of a plan to DONE — the execution driver that sits at the tail of the lifecycle (DESIGN → PLAN → DECOMPOSE+SPEC → **IMPLEMENT** → VERIFY). You read the materialized Tasks `project` produced (each already carrying exact paths + `scopeBoundary[]` + `acceptance[]` + a deterministic `verifier:` the SPEC gate admitted), code them one at a time, and close each only through verify-on-done. Durable `.atomic-skills/` state is the snapshot; the `## Session handoff` block is how the next session resumes.

If {{ARG_VAR}} was provided, use it as the plan-slug (or `<project-id>/<plan-slug>`) to implement. If not, ask the user: "Which plan are we implementing? I'll read its active phase's tasks." Default to the active plan/initiative if one is already selected.

## Iron Law

CODING STAYS SINGLE-THREADED.

One writer touches the working tree at a time — never two concurrent agents editing files in the same tree. Subagents are for read-only investigation, never parallel coding. A task reaches `done` ONLY through verify-on-done (its deterministic verifier executed, passing, evidence written) — you never mark your own work done by assertion, and a cheap/foreign executor never self-certifies.

<HARD-GATE>
If you are about to mark a task `done` because it *looks* finished, without running its verifier through `verify-claim` / the verify-on-done patterns: STOP. Run the verifier. The pass is the evidence; "it works" is the claim.
If you are RESUMING and `git status` is dirty/stale OR the `## Session handoff` block has an unfilled `TODO`/`REPLACE_*` placeholder: STOP. Refuse to execute. Surface the missing pieces and resolve them (commit/stash, fill the handoff) before any task runs — a resume over an inconsistent snapshot corrupts the work.
If you are about to dispatch a read-only subagent or hand off a token-heavy read: STOP and write the snapshot FIRST (the handoff is the pre-dispatch checkpoint).
</HARD-GATE>

## Mindset

This is an **execution driver, not an orchestrator** — call it that so no one expects concurrency that single-threaded coding will never use. It is a serial loop with durable checkpoints: code a task, verify it, snapshot, repeat. The value is not speed; it is that the work is always recoverable from `.atomic-skills/` state and that no task closes on a claim instead of a fact.

The snapshot trigger is **event-driven, never a self-measured context gauge.** You cannot read your own remaining context window — the number is fabricated and the loss is silent (the host meter, where one exists, is advisory only). So you snapshot on *events* you can observe: after each task closes, before each subagent dispatch, at every phase boundary, and on request. That cadence — not a "I'm at 60%" guess — is what keeps the handoff fresh.

## Process

### Step 0 — Resume gate (every start)

Before touching any task, establish whether this is a fresh start or a resume, and refuse a broken resume:

1. Run `git status --porcelain` and `git log --oneline -3` via {{BASH_TOOL}}. A dirty or unexpectedly-advanced tree on resume means the prior session left uncommitted or unrecorded work — **refuse** (HARD-GATE): surface the diff, have the user commit/stash, then retry.
2. Read the active initiative's `## Session handoff` block (if present). If it contains an unfilled `TODO`/`REPLACE_*`/`<…>` placeholder, the prior session did not finish writing it — **refuse** and surface which field is unfilled. A handoff with placeholders is not a handoff.
3. On a clean resume: the handoff IS your re-orientation — read its narrative + decision log + `nextAction`; do NOT cold-re-investigate. Any residual heavy read goes to a read-only subagent (below), never the main coding context.

### Step 0.5 — Resolve the plan-worktree (lazy)

The plan's worktree is the durable **home** of the work — level 2 of the three-level nesting (plan-worktree → execution session → per-task Mode-2 worktree). **Mode 1 (Step 2) codes here, in the plan-worktree — not the primary tree**; Mode 2 seeds its per-task worktrees from this home. Binding the session to this home before loading tasks is what keeps two active plans from writing the same tree (the `multipleActivePlans` invariant resolved by `project`). Resolve by **branch, not by path**, reusing `skills/shared/worktree-isolation.md` § *Step 0 — detect existing isolation BEFORE creating one*; never nest.

1. Read the active plan's `branch:` field (`.atomic-skills/projects/<id>/<slug>/plan.md`) and the current tree's branch via `git symbolic-ref --short HEAD`.
2. **`branch:` null / unset (legacy plan)** — no worktree binding; run in the current tree (degraded). Record the reason; never invent a branch.
3. **`branch:` equals the current tree's branch** — already home; **no-op**, proceed to Step 1. (The common resume case.)
4. **`branch:` differs from the current tree** — the work belongs in the plan's home, not here:
   a. Resolve an existing home by branch: `git worktree list --porcelain`; if a linked worktree already has `plan/<slug>` checked out, that IS the home — reuse it, do not create a second.
   b. **Materialize if absent**, operator-prompted via {{ASK_USER_QUESTION_TOOL}}: `git worktree add .worktrees/<slug> -b <plan-branch> <base-ref>` — `.worktrees/<slug>` INSIDE the repo (project convention; the `.worktrees/` nest is git-ignored), branch `plan/<slug>`, seeded from the plan's base ref. Never the sibling-dir placement; never silently.
   c. **HALT and instruct** the user to re-run `implement` from inside that worktree. A skill cannot change the session cwd, and editing files in a tree other than the one the Step 0 resume gate checked would split the dirty-tree check from the coding tree — so the session must re-enter there. Do not write across trees.

The Step 0 resume gate's `git status --porcelain` is authoritative for the **resolved** tree: when Step 0.5 halts to a different worktree, the resume gate re-runs there on re-entry (a clean tree precedes any task).

### Step 1 — Load the admitted tasks

Read the active phase's initiative from `.atomic-skills/` (or the nested `projects/<id>/<slug>/phases/f<N>-*.md`). Confirm each pending task carries the SPEC interior: exact `Files`, `scopeBoundary[]`, `acceptance[]`, and a deterministic `verifier:` (`kind shell|test|query`). A task missing any of these was not admitted (R-ORCH-23) — surface it and stop; do not improvise the missing spec.

### Step 2 — Execute one task (single-threaded)

For the chosen task, in this order:

1. **Orient.** Read the task's `Files`, `acceptance[]`, and `scopeBoundary[]`. Stay inside the boundary — a change outside `scopeBoundary[]` is a scope exit; stop and report, do not silently widen.
2. **Distill heavy reads (optional).** If understanding the change requires reading a large surface, delegate that READ to a read-only {{INVESTIGATOR_TOOL}} subagent that returns a distilled ≤1–2k-token summary — **write the snapshot BEFORE dispatching** (the dispatch order is always: snapshot, then dispatch). The subagent reads; you write. It never edits files.
3. **Code the change.** Make the minimum edit that satisfies `acceptance[]`, single-threaded, within scope. Test-first where it drives the design (the discipline lives in `atomic-skills:fix`).
4. **Verify before claiming done.** Run the task's deterministic verifier through `atomic-skills:verify-claim` (which delegates to the canonical Verifier execution patterns in `{{ASSETS_PATH}}/project-transitions.md`). PASS requires the real run: the exit code matches the verifier's expectation (default 0) AND, for `kind: test`, `testsCollected > 0`. A FAIL routes to `atomic-skills:fix` — whose root-cause + boundary-instrumentation discipline draws on `skills/shared/debug-techniques.md` (§1 root-cause tracing, §2 boundary instrumentation when the failure spans modules) — or to the user; never to done.
5. **Close it.** On a verified PASS, run `done <task-id>` (`{{ASSETS_PATH}}/project-transitions.md`), which writes the evidence and detects the phase transition. `validate-state` (GATE-R2) then re-enforces that a `done` task with a deterministic verifier carries passing evidence.
6. **Snapshot.** Write/refresh the `## Session handoff` block (below). This is the after-each-task cadence event.

### Step 3 — Phase boundary

When the last task of the phase closes, `done` announces the phase transition. Run `phase-done` (`{{ASSETS_PATH}}/project-transitions.md`): it executes every pending exit-gate verifier (verify-on-done), runs the mandatory `review-code` phase-diff gate, and advances the plan. Snapshot at the boundary. Do not auto-advance — the user opts in (intrusive-actions rule).

**Session cut-over (advisory, v1).** At a phase boundary, if the next pending task is structurally unrelated to the recent working set, you MAY recommend writing the handoff and starting a fresh session (a tightly-scoped fresh context beats a large stale one). This is advisory only — see `docs/design/project-orchestrator/06-session-boundary-and-telemetry.md` (F-E1). It never forces a cut, and it never reads a self-reported context-%.

## The `## Session handoff` block (the resume contract)

The handoff lives in the active initiative body (durable `.atomic-skills/` state — there is no separate scratch file, R-EXEC-08). It is written event-driven (Step 2.6, before each dispatch, at phase boundaries, on request). It MUST carry these five elements, and **literals are verbatim — never paraphrased** (a paraphrased command/path/error is a different command/path/error):

```markdown
## Session handoff
- **Narrative:** where we are, in 2–4 sentences — the phase, what just landed, what is mid-flight.
- **Decision log:** the load-bearing choices made this session and why (so the next session does not re-litigate them).
- **Single nextAction:** ONE concrete next step (e.g. "Run `done T-004`, then start T-005 in src/foo.js"). Exactly one — not a list.
- **Verbatim state:** the exact paths, commands, and error text in play — pasted, not summarized. `npm run validate-state .atomic-skills/...`, the failing assertion, the file:line.
- **Uncommitted changes:** the `git status --porcelain` list at snapshot time (or "clean tree").
```

`resume` reads this block and refuses if the tree is dirty/stale or any field is an unfilled placeholder (Step 0). A self-sufficient handoff is the entire cost of a cheap resume — the next session re-orients from it, not from a cold investigation.

## Heavy reads via subagents (snapshot-before-dispatch)

Coding is single-threaded; only **reads** fan out. When a read would flood the main context, dispatch a read-only {{INVESTIGATOR_TOOL}} subagent with a constructed brief, and **snapshot immediately before** the dispatch (R-EXEC-15) so a crash mid-read loses nothing. The subagent returns a distilled summary; the editing still happens in the one main thread.

{{#if ide.claude-code}}
Optional accelerator (Claude Code): fan the read-only investigation subagents out in parallel natively. Coding stays single-threaded regardless — parallelism is for reads only.
{{/if}}

## Mode 2 — Codex cross-provider execution (the DEFAULT executor for spec-ready tasks when the lane is on)

**When the Codex lane is enabled (`routing.json`), Mode 2 is the DEFAULT executor** for any task that is spec-ready and carries a deterministic verifier; **Mode 1 (above) is the fallback** for not-spec-ready work, a missing verifier, or an undispatchable lane. Mode 2 hands *spec-ready, independently-verifiable* execution to a foreign WRITING model (OpenAI Codex via a `--sandbox workspace-write` extension of the read-only bridge, inside an isolated `git worktree` per `skills/shared/worktree-isolation.md`) so Opus stays on planning + review and off mechanical coding. **The quality is carried by the spec + the verifier, not the executor's identity** (SDD: a complete spec removes the ambiguity that makes a handoff lossy) — so the two routing gates below are never weakened by making Codex the default. Opus PLANS+REVIEWS only and NEVER executes; routing is per-TASK never per-feature; the executed verifier is the escalation judge; the cheap/Codex executor self-**checks** but never self-**certifies** (`verify-claim`). The full lane mechanics — the routing gate (F1 spec-readiness + F2 deterministic verifier), the per-task runtime dispatch gate, the handoff work-order contract (the executor RECEIVES intent), the escalation cascade, and the sidecar telemetry — live in **`skills/shared/mode2-codex-lane.md`**; the original Codex-only spec is in `docs/design/project-orchestrator/03-execution-mode2-spec.md`, revised to this default by `.atomic-skills/projects/atomic-skills/mode2-codex-default-enablement/`.

Mode 2 routes to Codex when (R-EXEC-44) `.atomic-skills/status/routing.json` has `mode2Enabled: true` + `codexLane.enabled: true` (validated by `meta/schemas/routing.schema.json`; **absent file ⇒ Mode-1 defaults**, so a fresh install with no Codex is never silently routed anywhere) AND the task clears the two routing gates (F1 spec-ready, F2 deterministic verifier). The operator opts a batch **OUT** to Mode 1, never in. The **state-tree fence holds**: Codex writes only scoped source inside its `git worktree` and **never** the durable `.atomic-skills/` project state — Opus owns every state transition (canon Decision #11, **narrowed**: the throwaway-repo-only framing was specific to the closed dogfood migration; Codex now does real code work, it just never touches project state). A failed precondition (Codex unauthenticated, no dispatchable lane; on Gemini the investigator tool is read-only so Mode 2 = Codex-only) runs Mode 1 for that work with the reason **recorded**, never a silent collapse, never a failure (R-EXEC-30).

**Merge-back is serial — the Iron Law extends to the merge (R-XAGENT-03).** Several worktrees may pass *in isolation* concurrently, but they **merge back one at a time** through the primary tree (the full procedure is in `skills/shared/worktree-isolation.md` § *Merge-back when a BATCH of worktrees exists*). The single-threaded-coding law does not stop at the worktree edge — the merge is where independent writers actually meet, so two worktrees merging concurrently is the same corruption, moved one step later. After each merge you **re-run that task's verifier on the MERGED primary tree** — an in-worktree pass is necessary but never sufficient (an adjacent-file task may have changed the primary since this worktree's base ref); only a pass on the merged tree is the entry token to `done`. A **conflict or post-merge FAIL aborts the done transition**: leave the task `active`, surface it, and never force-resolve-and-remove the worktree (that discards the un-merged work).

## Degraded mode (folds `executing-plans`)

When there is no plan structure to drive — a loose checklist, a one-off change, or a plan whose tasks lack admitted verifiers — implement degrades to a single disciplined inline loop: do one item, verify it with the cheapest real check available, snapshot, next. No tiering, no worktrees, no Mode 2. This is the absorbed `executing-plans` behavior: the same single-threaded code→verify→snapshot rhythm without the lifecycle scaffolding. It never invents the missing spec; if a task needs a verifier it does not have, surface that gap rather than closing the task on a claim.

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

- "I'll spin up two agents to code two tasks in parallel and merge." → Coding stays single-threaded (Iron Law). Concurrent writers on one tree is the corruption this skill forbids; parallelism is for reads only.
- "It looks finished — mark it done and run the verifier later." → "Later" is how a fabricated-met enters state. The verifier pass is the entry token to done (HARD-GATE), not a follow-up.
- "The subagent/Codex reported it's done, so it's done." → A foreign executor self-checks but never self-certifies. Re-run the verifier on the committed/merged tree; read the diff, not the narrative.
- "I'm probably running low on context, let me wrap up." → You cannot read your own context %; the number is fabricated. Snapshot on events (after task / before dispatch / phase boundary), not on a self-measured gauge.
- "The handoff narrative reads cleaner if I summarize the error instead of pasting it." → Literals are verbatim. A paraphrased command/path/error is a different one and strands the next session.
- "The tree's a little dirty but I know what I was doing — resume anyway." → Refuse. A resume over a dirty/stale tree or a placeholder handoff corrupts the work (HARD-GATE).
- "This change is one line outside the scopeBoundary, I'll just include it." → A change outside `scopeBoundary[]` is a scope exit. Stop and report; do not silently widen the task.
- "This task is roughly specified, but Codex is the default now — it'll figure out the rest." → No. F1 is **spec-readiness**: a task without exact paths, a settled design, `scopeBoundary[]`, and `acceptance[]` routes to Mode 1, where Opus either specifies it harder until it IS ready or implements it directly. Codex-as-default rests on a complete spec carrying the quality; handing it a vague spec is exactly the lossy handoff the gate prevents — "it's the default" is not a licence to skip F1.
- "Codex is the default executor now, so I'll let it edit `.atomic-skills/` state / touch a file outside its `scopeBoundary[]` to finish the task." → No. The state-tree fence holds regardless of default status: Codex writes only scoped source in its worktree and NEVER the durable `.atomic-skills/` project state — Opus owns every state transition. A change outside `scopeBoundary[]` is a scope exit: stop and report. Being the default executor widens nothing.
- "The spec isn't fully settled, but I'll dispatch Codex and let it fill the gaps as it goes." → Gap-filling by the executor IS the guess that makes split-author lossy. An unsettled design is a not-spec-ready task (F1) — route it to Mode 1 (Opus settles the design, then either re-dispatches a now-ready task or self-implements). "I'll let it improvise" is not the enable surface; a complete spec is.
- "All six Codex tasks came back reporting their verifiers passed — I'll mark the batch done and merge." → A batch self-report is not the verifier; a foreign executor self-checks but never self-certifies, and trusting N reports at once is the same self-certification multiplied by N. Re-run each task's verifier on the MERGED tree, one serial merge at a time — the report is the executor's confidence, the merged-tree pass is the evidence.
- "All three worktrees passed in isolation — I'll merge all three, then run the verifier once at the end." → Merge-back is serial: one worktree merges at a time, re-verified on the primary before the next (R-XAGENT-03). Concurrent merges are the single-threaded law violated at the merge step, and one end-of-batch verifier cannot tell you WHICH merge broke — it tangles three tasks into one failure. And "the lead/user told me to batch-merge and move on" does not waive it: a directive to go faster targets speed, not the rule — the serial merge IS the fast path under a deadline (a bounded N-merge loop that stops at the first red with a named culprit), and the deadline is the condition the rule exists for, not an exception to it.
- "It passed in the worktree and the merge applied cleanly — that's done, the re-run on the primary is redundant." → An in-worktree pass is necessary, never sufficient: an adjacent-file task may have changed the primary since this worktree's base ref, so a clean *apply* is not a clean *result*. Only the verifier passing on the MERGED tree is the entry token to done. "Clean fast-forward, so byte-identical" does not exempt it either: byte-identity is a claim you are asserting, not a fact the verifier confirmed — and a fast-forward *after* sibling merges this session means your branch was moved onto changes its verifier never saw (a true no-op ff over the same bytes only happens when nothing else landed). The run costs seconds — assert nothing, re-run on the merged tree.
- "The merge conflict is trivial — I'll force-resolve it and `git worktree remove --force` to keep moving." → A conflict ABORTS the done transition: leave the task active and surface it. Force-removing a worktree with un-merged work discards exactly the work you'd be claiming done — route the conflict to `fix`/the user, never past the gate. Sunk hours and a demo countdown are not an exemption: the deadline is the condition the gate exists for, and a "finished" task whose force-resolved merged state never passed a verifier is exactly the false-green the gate stops — "it's only 30 seconds" buys a corrupted primary, not a closed task.
- "The user/lead told me to spin up an agent per task and code them in parallel — the files don't overlap, so it's safe." → A direct instruction to parallelize CODING does not waive the Iron Law, and the deadline is the condition the law exists FOR, not an exception to it. Disjoint file lists still race on the index, lockfiles, the build, and shared state — and the merge is where concurrent writers corrupt. Fan out the reads; code serially.
- "Eight verifiers passed this session, the ninth is identical — running it is busywork; I'll stake my name on it." → A pass streak is not evidence for the next case, staking your confidence IS the self-certification the gate forbids, and "the next layer / CI catches it" is the false-green propagating downstream. The verifier costs seconds — run it.
- "The handoff has a TODO but the user said keep going — I'll stub the unfilled piece and work around it." → Stubbing or working around an unfilled handoff IS resuming on it, and "keep going" / "I'll fill it later" is not permission to lift the gate. Fill the one line or refuse; the time you'd save is the corruption the gate prevents.
- "The user prefers terse handoffs and can ask me to expand later — 'ran validate-state' is clear enough." → Verbatim is not verbose: paste the one literal. "They can ask later" assumes a live session the next one does not have — `resume` reads the block cold.

If you thought any of the above: STOP. Go back to the step you were skipping.

## Rationalization

| Temptation | Reality |
|------------|---------|
| "Two writers will finish twice as fast" | Concurrent coders on one tree race on the same files and corrupt each other. The driver is serial by law; the only speedup is read fan-out (R-EXEC-13). |
| "Running the verifier every task is ceremony" | The verifier is the ONLY thing separating `done` from a claim. Skipping it is exactly the fabricated-met hole GATE-R2 then HARD-FAILS. |
| "The executor ran the test and said it passed" | Self-check ≠ self-certify. The adjudicator is re-execution against the committed/merged tree, never the executor's confidence (R-EXEC-28). |
| "I should checkpoint when I'm ~60% full" | You cannot read your own context window; that gate is fabricated and fails silently. Checkpoint on observable events, not a gauge (R-ORCH-32). |
| "Paraphrasing the error keeps the handoff readable" | The next session acts on the literal. A summarized error/command/path is a different one — verbatim or it is useless (R-EXEC-10). |
| "Resume looks fine, the dirty tree is unrelated" | Unrelated-looking uncommitted work is exactly what a clean resume must not absorb. Refuse, surface, resolve, then run (R-ORCH-33). |
| "Codex is the default, so this loosely-specified task can go to it too" | The default is gated on F1 **spec-readiness**: no exact paths / unsettled design / no `scopeBoundary[]`+`acceptance[]` ⇒ Mode 1, where Opus specs it harder or self-implements. A complete spec is what carries the quality across the handoff (SDD); a vague one routes to Mode 1, default or not (R-EXEC-44/43). |
| "It's the default executor, so letting Codex touch `.atomic-skills/` state or a file just outside scope is fine" | The state-tree fence is independent of default status: Codex writes only scoped source in its worktree, never the durable project state — Opus owns every transition (Decision #11). Out-of-`scopeBoundary[]` is a scope exit: stop and report. Default ≠ wider scope. |
| "The design isn't settled but I'll dispatch Codex and let it fill the gaps" | Executor gap-filling IS the lossy guess split-author is blamed for. An unsettled design is not-spec-ready (F1) ⇒ Mode 1: Opus settles it, then re-dispatches a ready task or codes it. "Let it improvise" is not the enable surface; a complete spec is. |
| "All the dispatched tasks reported pass — close the batch" | A batch self-report is not the verifier — it is the executor's confidence ×N. Re-run each verifier on the MERGED tree, serial merge by serial merge; the only entry token to done is the merged-tree pass, never the report (R-EXEC-28). |
| "They all passed in isolation — merge the batch, verify once" | Merge-back is serial (R-XAGENT-03): one merge, re-verify on the primary, then the next. Concurrent merges break the single-threaded law at the merge; a single end-of-batch verifier can't name which merge failed. A lead's "just batch-merge them" is a push for speed, not a waiver — and serial-merge IS the bounded fast path under a deadline. |
| "Passed in the worktree + clean merge apply = done" | A clean apply is not a clean result — an adjacent-file task may have moved the primary under this base ref. The only adjudicator is the verifier re-run on the MERGED tree (R-EXEC-29). "Clean fast-forward = byte-identical" is itself an unverified claim, and a ff after sibling merges moved your branch onto code its verifier never saw — re-run, it costs seconds. |
| "The conflict's tiny, force-resolve and force-remove the worktree" | A conflict aborts the done transition: task stays active, surfaced. `worktree remove --force` over un-merged work discards the very work being claimed — route to fix/user, never past the gate. Two sunk hours and a 10-minute demo don't exempt it; the deadline is what the gate exists for, and a never-verified merged state is the false-green it stops. |
| "The user told me to parallelize the coding, and the files don't overlap" | A directive to go faster is not a waiver of a single-threaded law; disjoint files still collide on the index/lockfile/build/shared state, and the merge is where concurrent writers corrupt. The law removes the decision — fan out the reads, code serially. |
| "Eight passed, I'll stake my reputation the ninth does too" | A pass streak is not evidence for the next case, and staking confidence IS self-certification — the only path to done is the executed verifier, not your track record (R-EXEC-28). |
| "The user said keep going, I'll stub around the unfilled handoff" | Working around a placeholder is resuming on it. "Keep going" / "I'll fill it later" does not lift the gate; fill the one line or refuse (R-ORCH-33). |
| "The user likes terse handoffs and can ask me to expand" | Verbatim ≠ verbose — paste the one literal. The next session reads the handoff cold (no live session to ask); a paraphrased command is a different command (R-EXEC-10). |

## Closing

Output of a clean run: the phase's tasks each closed through a verified PASS (evidence in durable state), the `## Session handoff` block current and self-sufficient, the tree committed or its uncommitted changes recorded verbatim, and — at a phase boundary — `phase-done` run with its exit-gate verifiers and review gate. implement never closes a task on a claim and never codes two tasks at once.
