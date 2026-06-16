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

When the Codex lane is on, Mode 2 hands spec-ready, independently-verifiable execution to a foreign WRITING model (OpenAI Codex in an isolated `git worktree`) so Opus stays on planning + review. The full contract — routing gate, per-task dispatch gate, work-order handoff, escalation cascade, sidecar telemetry — is the **single source** in `{{READ_TOOL}} skills/shared/mode2-codex-lane.md`; read it before dispatching. The four load-bearing invariants (do not re-derive them here):

1. **Routing (per-TASK, never per-feature).** Default to Codex only when `.atomic-skills/status/routing.json` has `mode2Enabled: true` + `codexLane.enabled: true` AND the task clears F1 (spec-readiness: exact paths, settled design, `scopeBoundary[]`, `acceptance[]`) + F2 (deterministic verifier). Absent routing.json ⇒ Mode 1. The operator opts a batch **OUT** to Mode 1, never in; a failed precondition runs Mode 1 with the reason recorded (R-EXEC-44/30).
2. **Opus plans + reviews, never executes.** The cheap/Codex executor self-**checks** but never self-**certifies** — the executed verifier on the merged tree is the adjudicator (`verify-claim`, R-EXEC-28).
3. **State-tree fence.** Codex writes only scoped source inside its worktree and NEVER the durable `.atomic-skills/` project state — Opus owns every state transition (Decision #11).
4. **Merge-back is serial (R-XAGENT-03).** Worktrees may pass in isolation concurrently, but merge back one at a time; re-run the verifier on the MERGED primary (an in-worktree pass is necessary, never sufficient). A conflict or post-merge FAIL aborts the done transition — leave the task `active`, surface it, never force-resolve-and-remove the worktree.

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

Resident **triggers** only — if a thought matches one, STOP and read its full refutation in `{{READ_TOOL}} skills/shared/implement-antipatterns.md` (§ Red Flags — full refutations) before acting:

- "I'll spin up two agents to code two tasks in parallel and merge."
- "It looks finished — mark it done and run the verifier later."
- "The subagent/Codex reported it's done, so it's done."
- "I'm probably running low on context, let me wrap up."
- "The handoff narrative reads cleaner if I summarize the error instead of pasting it."
- "The tree's a little dirty but I know what I was doing — resume anyway."
- "This change is one line outside the scopeBoundary, I'll just include it."
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
