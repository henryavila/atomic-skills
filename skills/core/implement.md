Drive the SPEC-admitted Tasks of a plan to DONE — the execution driver that sits at the tail of the lifecycle (DESIGN → PLAN → DECOMPOSE+SPEC → **IMPLEMENT** → VERIFY). You read the materialized Tasks `project` produced (each already carrying exact paths + `scopeBoundary[]` + `acceptance[]` + a deterministic `verifier:` the SPEC gate admitted), code them one at a time, and close each only through verify-on-done. Microcommits anchor the recovered tree; durable `.atomic-skills/` state plus the `## Session handoff` block is how the next session resumes.

If {{ARG_VAR}} was provided, use it as the plan-slug (or `<project-id>/<plan-slug>`) to implement. If not, ask the user: "Which plan are we implementing? I'll read its active phase's tasks." Default to the active plan/initiative if one is already selected.

## Iron Law

CODING STAYS SINGLE-THREADED.
MICROCOMMITS ARE THE SNAPSHOT.

One writer touches the working tree at a time — never two concurrent agents editing files in the same tree. Subagents are for read-only investigation, never parallel coding. A task reaches `done` ONLY through verify-on-done (its deterministic verifier executed, passing, evidence written) — you never mark your own work done by assertion, and a cheap/foreign executor never self-certifies. After every verified task close, create explicit-path microcommits for the implementation diff and the project-state close diff; a handoff over dirty task-owned work is an emergency note, not a checkpoint.

<HARD-GATE>
If you are about to mark a task `done` because it *looks* finished, without running its verifier through the `done` / verify-on-done patterns: STOP. Run the verifier. The pass is the evidence; "it works" is the claim.
If a verified task changed files and you are about to continue without committing those exact paths: STOP. Run `git diff --name-only`, classify the paths, then use {{BASH_TOOL}} with `rtk git add <explicit-paths>` and a microcommit. Never use `git add .` or `git add -A`.
If you are RESUMING and `git status` is dirty/stale OR the `## Session handoff` block has an unfilled `TODO`/`REPLACE_*` placeholder: STOP. Refuse to execute. Surface the missing pieces and resolve them (commit/stash, fill the handoff) before any task runs — a resume over an inconsistent snapshot corrupts the work.
If you are about to dispatch a read-only subagent or hand off a token-heavy read: STOP and write the snapshot FIRST (the handoff is the pre-dispatch checkpoint).
</HARD-GATE>

## Mindset

This is an **execution driver, not an orchestrator** — call it that so no one expects concurrency that single-threaded coding will never use. It is a serial loop with durable checkpoints: code a task, verify it, commit it, close it, commit the state, repeat. The value is not speed; it is that the work is always recoverable from git plus `.atomic-skills/` state and that no task closes on a claim instead of a fact.

The snapshot trigger is **event-driven, never a self-measured context gauge.** You cannot read your own remaining context window — the number is fabricated and the loss is silent (the host meter, where one exists, is advisory only). So you snapshot on *events* you can observe: after each task closes, before each subagent dispatch, at every phase boundary, and on request. A snapshot means a microcommit plus a refreshed handoff. A handoff that records dirty files is a crash report, not a successful checkpoint.

## Process

### Step 0 — Resume gate (every start)

Before touching any task, establish whether this is a fresh start or a resume, and refuse a broken resume:

1. Run `git status --porcelain` and `git log --oneline -3` via {{BASH_TOOL}}. A dirty or unexpectedly-advanced tree on resume means the prior session left uncommitted or unrecorded work — **refuse** (HARD-GATE): surface the diff, have the user commit/stash, then retry.
2. Read the active initiative's `## Session handoff` block (if present). If it contains an unfilled `TODO`/`REPLACE_*`/`<…>` placeholder, the prior session did not finish writing it — **refuse** and surface which field is unfilled. A handoff with placeholders is not a handoff.
3. On a clean resume: the handoff IS your re-orientation — read its narrative + decision log + `nextAction`; do NOT cold-re-investigate. Any residual heavy read goes to a read-only subagent (below), never the main coding context.

### Step 0.5 — Resolve the plan-worktree (lazy)

The plan worktree is the durable home: Mode 1 codes here, Mode 2 seeds per-task worktrees from here. Bind by **branch, not path**, before loading tasks; reuse `skills/shared/worktree-isolation.md` § *Step 0 — detect existing isolation BEFORE creating one*; never nest.

1. Read the active plan's `branch:` field (`.atomic-skills/projects/<id>/<slug>/plan.md`) and the current tree's branch via `git symbolic-ref --short HEAD`.
2. **`branch:` null / unset (legacy plan)** — no worktree binding; run in the current tree (degraded). Record the reason; never invent a branch.
3. **`branch:` equals the current tree's branch** — already home; **no-op**, proceed to Step 1. (The common resume case.)
4. **`branch:` differs from the current tree** — the work belongs in the plan's home, not here:
   a. Resolve by branch with `git worktree list --porcelain`; reuse an existing `plan/<slug>` worktree.
   b. If absent, ask via {{ASK_USER_QUESTION_TOOL}} before `git worktree add .worktrees/<slug> -b <plan-branch> <base-ref>`; keep it inside the repo.
   c. **HALT** and tell the user to re-run `implement` inside that worktree. Do not write across trees.

The Step 0 resume gate's `git status --porcelain` is authoritative for the resolved tree; if Step 0.5 halts, re-run the resume gate after re-entry.

### Step 1 — Load the admitted tasks

Resolve the active phase before accepting any pending task:

1. Read the active plan descriptor from `.atomic-skills/projects/<project-id>/<plan-slug>/plan.md` (legacy flat fallback only when that is the active state shape), find the active phase descriptor by `currentPhase` / `phaseId`, and resolve the expected materialized initiative path under `projects/<project-id>/<plan-slug>/phases/f<N>-*.md`.
2. If the parent plan phase descriptor exists but the matching initiative file is absent, this is a **descriptor-only phase**. **Refuse execution** (HARD-GATE): stop and tell the operator to run `atomic-skills:project materialize <phase-id>`. Do not enter degraded mode, do not execute a loose checklist, and do not infer tasks from the descriptor.
3. Read the active phase's initiative from `.atomic-skills/` (or the nested `projects/<id>/<slug>/phases/f<N>-*.md`) and parse its frontmatter before inspecting tasks.
4. Check the ratified `businessIntent` spine on **both** the parent plan phase descriptor and the initiative frontmatter. The complete required spine fields are: `value`, `workflow`, `rules`, `outOfScope`, `doneWhen`.
5. If either side is missing `businessIntent`, any required field is absent, blank, empty after trimming, or still contains `[NEEDS CLARIFICATION]`, **refuse execution** (HARD-GATE): stop and instruct `atomic-skills:project materialize <phase-id>` for descriptor-only state, or re-materialize/re-question the `businessIntent` spine before implementation continues. This is not the loose checklist/degraded-mode path.

After that hard pre-check passes, confirm each pending task carries the SPEC interior: one or more exact `outputs[].path` targets, `scopeBoundary[]` explicit exclusions (DO-NOT constraints), `acceptance[]`, and a deterministic `verifier:` (`kind shell|test|query`). A task missing any of these was not admitted (R-ORCH-23) — surface it and stop; do not improvise the missing spec.

### Step 2 — Execute one task (single-threaded)

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
6. **Close it.** After the implementation commit, run `done <task-id>`. The `done` flow executes the per-task verifier before setting `status: done`, writes evidence and phase-transition signals, refreshes state, and owns the project-state checkpoint commit. GATE-R2 enforces evidence.
7. **Confirm the close checkpoint.** If `done` reports that its checkpoint commit succeeded, do not create a second close commit. If it reports an uncommitted state diff, stop and resolve only the explicit state paths it names.
8. **Snapshot.** Refresh `## Session handoff`; after a healthy close it records a clean tree or explicitly unrelated dirty files.

### Step 3 — Phase boundary

When the last task of the phase closes, `done` announces the phase transition. Run `phase-done` (`{{ASSETS_PATH}}/project-transitions.md`): it executes every pending exit-gate verifier (verify-on-done), runs the mandatory `review-code` phase-diff gate, advances the plan, and writes phase-boundary microcommits for each logical state checkpoint. Snapshot at the boundary. Do not auto-advance — the user opts in (intrusive-actions rule).

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

## Degraded mode (folds `executing-plans`)

When there is no plan structure to drive — a loose checklist, a one-off change, or a plan whose tasks lack admitted verifiers — implement degrades to a single disciplined inline loop: do one item, verify it with the cheapest real check available, microcommit it, snapshot, next. No tiering, no worktrees, no Mode 2. This is the absorbed `executing-plans` behavior: the same single-threaded code→verify→commit→snapshot rhythm without the lifecycle scaffolding. It never invents the missing spec; if a task needs a verifier it does not have, surface that gap rather than closing the task on a claim.

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

If you thought any of the above: STOP. Go back to the step you were skipping.

## Rationalization

The full Temptation→Reality table (every rationalization above, refuted with its rule cite) lives in `{{READ_TOOL}} skills/shared/implement-antipatterns.md` (§ Rationalization) — read it when you catch yourself reaching for one of these. The load-bearing ones, in one line each: concurrent coding corrupts (serial by law, R-EXEC-13); the verifier is the only thing separating `done` from a claim (GATE-R2); a foreign executor self-checks but never self-certifies — re-run on the merged tree (R-EXEC-28/29); merge-back is serial (R-XAGENT-03); you cannot read your own context % — snapshot on events (R-ORCH-32); handoff literals are verbatim (R-EXEC-10); refuse a dirty/placeholder resume (R-ORCH-33); Codex-as-default is still gated on the F1 spec-ready + F2 verifier routing gates and the state-tree fence (R-EXEC-44/43, Decision #11).

## Closing

Output of a clean run: the phase's tasks each closed through a verified PASS (evidence in durable state), the `## Session handoff` block current and self-sufficient, the tree committed or its uncommitted changes recorded verbatim, and — at a phase boundary — `phase-done` run with its exit-gate verifiers and review gate. implement never closes a task on a claim and never codes two tasks at once.
