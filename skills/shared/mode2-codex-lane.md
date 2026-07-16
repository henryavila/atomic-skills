# Mode 2 — Codex cross-provider execution lane (a lazy reference asset)

The full mechanics of `implement.md`'s **Mode 2**: Opus PLANS+REVIEWS while
OpenAI Codex EXECUTES mechanical, independently-verifiable tasks in an isolated
`git worktree`, to conserve the scarce flat-rate Opus weekly quota — **not**
per-token dollars (a non-goal under flat-rate). A **helper, not a core skill** —
it carries no Iron Law of its own; the owned discipline (single-threaded coding,
serial merge-back, a foreign executor never self-certifies — including the
dispatch path) lives in `skills/core/implement.md` and `skills/core/verify-claim.md`,
which are pressure-tested. Not in `meta/catalog.yaml`. Full purpose + the
worth-it verdict: `docs/design/project-orchestrator/03-execution-mode2-spec.md`.

⚠️ **Codex is the DEFAULT executor when the lane is on — and quality rests on two
hard gates.** When `routing.json` enables the lane, a **spec-ready,
verifier-bearing** task routes to Codex by default (§1); Mode 1 (self-exec, single
strong model, serial, durable snapshots) is the **fallback** for not-spec-ready
work, a missing deterministic verifier, or an undispatchable lane. The
**state-tree fence holds as a principle**: Codex writes only scoped source inside
an isolated `git worktree` and **never** the durable `.atomic-skills/` project
state — the orchestrator (Opus) owns every state transition (canon Decision #11,
**narrowed**: the old "throwaway-repo-only / never real work" framing was specific
to the closed dogfood migration; Codex now does real code work, it just never
touches project state).

---

## 1. Enable surface (R-EXEC-44) — Codex is the DEFAULT executor when the lane is on

ONE gate turns the lane on; once on, Codex is the **default** executor for every
eligible task — the operator opts **OUT** per batch, not in:

1. **Operator config:** `.atomic-skills/status/routing.json` (validated by
   `meta/schemas/routing.schema.json`) with `mode2Enabled: true` and
   `codexLane.enabled: true`. **Absent file ⇒ Mode-1-only defaults** — the
   shipped schema default stays `false`, so a fresh install with no Codex
   configured is never silently routed anywhere; turning the lane on is a
   deliberate, file-backed act, not implicit.
2. **Per-batch opt-OUT (not opt-in):** with the lane on, a task that clears the
   spec-readiness gate (§3 F1) **and** carries a deterministic verifier (§3 F2)
   routes to Codex **by default** — no explicit per-run flag is needed. The
   operator can send a batch back to Mode 1 at any time by opting it OUT; the
   default direction is Codex, the exception is Mode 1. **Opt-out mechanism:** an
   explicit operator instruction on the batch ("run these in Mode 1") — the skill
   (the dispatcher) honors it and records the reason; there is no silent
   auto-route the operator cannot countermand. (Mode 2 routing is LLM-driven by
   this skill body, not a separate JS dispatcher; `routing.json` is config the
   skill reads, validated by `validate-state`, not executed by code.)

The quality this default rests on is carried by the **spec + the verifier**, not
by the executor's identity (SDD: a complete spec removes the ambiguity that makes
a handoff lossy). So the two §3 disqualifiers below are what keep the default
safe and are never weakened by it.

A failed precondition (Codex not authenticated, no dispatchable lane) ⇒ Mode 1
for the affected work, with the reason **recorded** (R-EXEC-30) — never a silent
collapse, never a failure. Any `$/token` justification is rejected outright; it
has no field in `routing.json` by design.

## 2. Firing threshold (R-EXEC-32) — per-task by default; independence governs PARALLELISM only

The router runs **per task**. With `thresholds.minBatchTasks: 1` (the Codex-default
config), every spec-ready, verifier-bearing task routes to Codex on its own —
there is no magnitude floor below which eligible work is withheld from the lane.

`minBatchTasks` and pairwise scope-independence are **no longer a routing fence**
(they did the old "is this worth offloading?" job, now dropped with the
scarce-resource trigger). They govern only **parallelism** — how many eligible
worktrees may run concurrently:

- Pairwise scope-independent tasks (reuse `parallel-dispatch` §1.3 pairwise
  {{GREP_TOOL}} disjointness) may have their Codex worktrees dispatched
  concurrently; coupled tasks are still coded one at a time.
- **One writer per worktree** (Iron Law): each worktree has exactly one coding
  agent; never two concurrent writers in the same tree. Concurrency is across
  isolated worktrees only.
- Merge-back is serial regardless (§8) — the single-threaded law holds at the
  merge even when execution fanned out.

Raising `minBatchTasks` above 1 simply withholds the lane until that many
eligible tasks accumulate — a pure worktree/merge-overhead amortization knob,
never a quality gate.

## 3. Routing gate (R-EXEC-33) — two hard disqualifiers; Codex is the default otherwise

With the lane on, a task routes to Codex **by default**; it falls back to Mode 1
only when a hard disqualifier fires or the lane is undispatchable:

| # | Question | Role |
|---|----------|------|
| **F1 (spec-readiness)** | Is the task **SPEC-READY** — exact paths, non-empty `scopeBoundary[]`, `acceptance[]`, no placeholders, and a **settled design** (not one that only emerges *during* implementation)? | **HARD DISQUALIFIER** — not-spec-ready ⇒ Mode 1, and Opus either specifies it harder until it IS ready or implements it directly. This is a property of the **task**, never a verdict on Codex: a complete spec *carries* the quality (SDD removes the ambiguity that makes a handoff lossy); an incomplete spec forces the executor to guess. |
| **F2 (verifier)** | Does **every** task carry a deterministic `kind:test`/`kind:shell` verifier judgeable WITHOUT Opus re-reading the diff? | **HARD DISQUALIFIER** — `manual`/none ⇒ Mode 1. **Auto-checked** from `task.verifier.kind`; no human. This verifier is what lets Opus stay off the diff; without it the quality safety net (and the saving) evaporates. |
| (precond) | Is an executor lane actually dispatchable now? | NO ⇒ degrade to Mode 1 (preflight checks 1-2 of `{{ASSETS_PATH}}/codex-bridge-assets/preflight-checks.txt`). |

**Decision rule:** route to Codex iff `F1 ∧ F2 ∧ precondition`. There is **no
longer a scarce-resource "should we offload?" trigger** gating the firing — under
the operator's chosen default, Codex executing spec-ready, verifier-bearing work
*is* the baseline, not a contingent optimization (idle Codex quota or a deadline
are still fine reasons, just no longer *required*). The "Opus headroom %"
self-assessment stays out of the firing logic — not programmatically readable.
Persist the routing decision + reason (telemetry §9).

## 4. Per-task routing + tier map + runtime gate (R-EXEC-18/19/43)

Routing is **per-task, never per-feature**. Tier map (from `routing.json.tierMap`):
1-2 files + complete spec → cheap; multi-file integration → standard;
architecture/design/review/escalation → **Opus, which NEVER executes** (the
schema rejects an Opus model as a `tierMap` executor target). Codex is a
cross-provider lane, not a tier rung.

**Runtime dispatch gate (R-EXEC-43):** `task.scopeBoundary`/`acceptance`/`verifier`
are OPTIONAL in `initiative.schema.json`, so the dispatch hard-gate is enforced
**at dispatch time as a runtime check**, NOT by making fields schema-required
(that would break every existing task). A task missing exact paths, a non-empty
`scopeBoundary[]`, or a deterministic verifier is **refused dispatch and runs
Mode 1 self-exec for that task only** — not the whole batch.

## 5. Handoff work-order contract (R-EXEC-40) — the executor RECEIVES intent

The executor is **contextually isolated** from the Opus session (stateless
relative to it) but **not dumb**. Build the work-order by reusing
`atomic-skills:prompt`'s briefing discipline. Required content:

1. Target files split **Create / Modify / Test** with exact absolute paths.
2. **Inline approach narrative + design rationale (intent).**
3. `scopeBoundary[]` verbatim + a `parallel-dispatch`-style DO-NOT block (no
   `git add -A`, no push, stop-and-report on scope-exit).
4. The deterministic verifier command **verbatim** (for the executor to
   self-**CHECK** before returning — it can never self-**CERTIFY**).
5. The relevant `.atomic-skills/` state slice (the Mode-1 snapshot).
6. Edit-contract by capability: whole-file rewrite for the weakest tier,
   unified diff/patch for stronger; for Codex, document worktree seeding +
   `git -C <worktree> diff` readback.

**CRITICAL INVERSION of `review-code`'s anti-framing Iron Law:** a fresh-context
*reviewer* is DENIED intent (intent poisons review — see
`{{ASSETS_PATH}}/codex-bridge-assets/anti-framing-directive.txt`). An *executor*
is the opposite — it **RECEIVES** intent because it needs the rationale to build
correctly. State this so the two contracts are never confused: the verifier-judge
and any cross-model reviewer remain intent-denied; only the executor gets intent.

## 6. Dispatch lanes + portability (R-EXEC-35/36)

- **Codex workspace-write lane — THE lane that matters.** The only in-harness
  path to a foreign WRITING model and the only lever that moves work entirely
  off the Claude account. Command + the exact deltas from the read-only bridge:
  `{{ASSETS_PATH}}/codex-bridge-assets/invocation-workspace-write.txt` (flip
  sandbox, cwd = an isolated worktree per `skills/shared/worktree-isolation.md`,
  drop ONLY the worktree clean-tree preflight, everything else verbatim). Briefing
  via stdin; diff read back with `{{BASH_TOOL}}` (`git -C <worktree> diff`).
- **Anthropic-subagent lane — DEFERRED.** Sonnet/Haiku subagents draw on the
  *same* shared weekly Claude ceiling, so they do not serve the primary
  Opus-conservation lever; the throughput case is already `parallel-dispatch`'s
  job. Tracked at `.atomic-skills/projects/atomic-skills/mode2-anthropic-subagent-tier/`.
- **Portability:** on Gemini `{{INVESTIGATOR_TOOL}}` is likely read-only ⇒ the
  subagent tier collapses ⇒ **Mode 2 on Gemini = Codex-only** (`routing.json`
  `ideOverrides.gemini.subagentExecutor: false`). Neither lane dispatchable ⇒ Mode 1.

## 7. Verification + escalation cascade (R-EXEC-37/38)

Executor produces a diff → run the task's deterministic verifier (un-stubbed) as
a near-free judge. **PASS on the merged tree ⇒ verify-done, zero Opus tokens.**
FAIL ⇒ escalate **exactly one tier up** (Codex/cheap → standard → Opus-review →
human), re-running the *same* verifier each rung — never silently retrying the
same tier with the failure appended. Opus **REVIEWS, never authors** at its rung.
Only paths to done: verifier-pass or strong-model approval.

**Count the escalation tokens (R-EXEC-38):** per-task Opus spend =
`(decompose + gate share) + p_fail × (Opus re-entry tokens)`, against the Mode-1
solo-Opus authoring counterfactual. If `(re-plan + re-review) ≥ solo-author cost`,
record the batch **FAILED** and tighten the routing thresholds.

## 8. Merge-back (R-EXEC-39 / R-XAGENT-03) — serial, operator-prompted

Mode 2 worktrees pass *in isolation* concurrently but **merge back one at a
time**, serialized through the primary tree, each re-verified on the MERGED
primary before the next. The full procedure (no two-worktree concurrent merge;
conflict or post-merge FAIL aborts the done transition, leaves the task active,
never force-removes the worktree) is in `skills/shared/worktree-isolation.md`
§ *Merge-back when a BATCH of worktrees exists*. v1 is operator-prompted; the
unattended serial-rebase is the deferred v2.

## 9. Telemetry — sidecar `dispatch-log.json`, NDJSON (R-EXEC-42), NOT a schema bump

Append one record per task to `.atomic-skills/status/dispatch-log.json` (a
sidecar — do NOT bump the Task schema to 0.2 for this until the lane is proven).

**Format: NDJSON (newline-delimited JSON).** Each record is ONE compact JSON
object on its OWN single line; the file is a stream of such lines, NOT a single
pretty-printed JSON array. This is load-bearing: the sidecar is git-tracked and
parallel feature worktrees append to it concurrently, so it carries `merge=union`
in `.gitattributes`. git's union driver is lossless ONLY for line-oriented files —
a multi-line JSON array would union-merge into invalid JSON (a `}` directly
followed by `{` with no separating comma). One-object-per-line keeps every
concurrent append a self-contained, individually-valid JSON line.

**Single writer/parser (F4/T-007):** always use `scripts/dispatch-log.js` —
never hand-rewrite the file as a JSON array, never `JSON.parse` the whole file.

- Append: `node scripts/dispatch-log.js [<root>] append --json '<compact-object>'`
  (or programmatic `appendDispatchLog(root, record)`). Writes ONE compact line +
  `\n` via `appendFileSync` only.
- Read / validate: `node scripts/dispatch-log.js [<root>] read|validate` (or
  `readDispatchLog` / `validateDispatchLog`). Parses line-by-line; a malformed
  line **fails closed** with its 1-based line number — corruption is never
  silently skipped.
- Actuals consumer: `scripts/append-completion.js` `readDispatchActuals` reads
  through the same module (F4/T-002).

Record shape (written as a single line):

```json
{"taskId":"T-101","plan":"<plan-slug>","phase":"<phaseId>","executorTier":"cheap | standard","executor":"codex | subagent","attempt":1,"verifierKind":"test | shell","verifierPassed":true,"escalatedTo":null,"escalationCount":0,"startedAt":"<isoTimestamp>","finishedAt":"<isoTimestamp>","codexWorktreeRef":"<branch-or-path>","routingReason":"<why this task routed here>"}
```

`plan` + `phase` are REQUIRED match keys, not optional: the task-actuals
consumer (`readDispatchActuals`) keys on `plan`+`phase`+`taskId` to attach
`attempts`/`durationMs`/`escalations` to the `task-done` completion event. A
record that omits them never matches and silently degrades that task to
actuals-omitted — so a writer that follows this contract MUST emit `plan` and
`phase` (taskIds repeat across phases; `taskId` alone is ambiguous).

Plus the persisted routing decision + reason (no "satisfied lever" — the
scarce-resource trigger was dropped in §3; record simply that the task cleared
F1+F2 and the lane was on, or the reason it fell back to Mode 1). Success metric
is a **counterfactual** vs a Mode-1 estimate (R-EXEC-45), never absolute tokens:
PRIMARY = Opus tokens not spent on execution; SECONDARY = Codex-served fraction +
wall-clock; GUARDRAIL = per-tier first-pass / escalation rate (FAILED if bounce
erases the conserved budget). No dashboard.

## 10. Degraded fallback (R-EXEC-30)

No dispatchable lane at gate time, or a lane fails mid-batch (Codex missing,
subagent spawn denied on Gemini) ⇒ the affected tasks fall back to Mode 1
self-exec, recorded as the gate-decision reason — never a silent collapse.

## Claude Code accelerator (optional)

{{#if ide.claude-code}}
On Claude Code, the native worktree tools (`EnterWorktree`/`ExitWorktree`) and
native parallel read fan-out can manage the per-worktree lifecycle with cleaner
bookkeeping. They are an accelerator only — the same isolation + serial merge-back
discipline applies, and the portable `git worktree` + codex-bridge path remains
the contract on every other host. Coding (and the merge-back) stay serial regardless.
{{/if}}

This accelerator block is stripped on every other host; the portable lane above
is the path everywhere. Both routes leave identical durable state.

## Cross-agent note

The lane is portable: the gate reads `routing.json`, tasks read durable
`.atomic-skills/` state, Codex runs via `{{BASH_TOOL}}` + the codex bridge, the
verifier runs via `{{BASH_TOOL}}`, the merge-back is operator-prompted `git`. No
host-orchestration tooling drives it, so it degrades cleanly to Codex-only (or
Mode 1) wherever a writable subagent lane is unavailable.
