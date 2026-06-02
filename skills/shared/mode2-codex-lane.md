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

⚠️ **Default OFF and FENCED OUT of the live tree.** Mode 1 (self-exec, single
strong model, serial, durable snapshots) is the unconditional default. Mode 2 is
available only when the operator turns it on (below) AND is FENCED OUT of the
live `.atomic-skills/` state entirely — Codex write-mode is proven on a throwaway
git repo, never pointed at the real tree (canon Decision #11).

---

## 1. Enable surface (R-EXEC-44) — never implicit

Two gates, BOTH required, or it's Mode 1:

1. **Operator config:** `.atomic-skills/status/routing.json` (validated by
   `meta/schemas/routing.schema.json`) with `mode2Enabled: true` and a
   `codexLane.enabled: true`. **Absent file ⇒ Mode-1-only defaults** — there is
   no implicit enablement.
2. **Per-invocation opt-in:** an explicit flag on the run. A config that is
   "on" does not silently route a batch; the operator opts in per batch.

A failed precondition (Codex not authenticated, no dispatchable lane) ⇒ Mode 1
for the affected work, with the reason **recorded** (R-EXEC-30) — never a silent
collapse, never a failure. Any `$/token` justification is rejected outright; it
has no field in `routing.json` by design.

## 2. Firing threshold (R-EXEC-32) — the gate only ever ESCALATES

The chooser runs once per implementation **batch** and only above a
magnitude+independence floor, so trivial work never sees the gate. It fires iff:

- `N ≥ K` dispatch-eligible tasks (`K` = `thresholds.minBatchTasks`, default 3); AND
- ≥2 are pairwise scope-independent — **reuse `parallel-dispatch` §1.3 pairwise
  {{GREP_TOOL}} disjointness**, do not re-derive it; AND
- the batch is not classified cohesive/coupled.

Below threshold → Mode 1, silently, no ceremony.

## 3. Cost-justification gate (R-EXEC-33) — two hard fences + one trigger

| # | Question | Role |
|---|----------|------|
| **F1** | Are the batch tasks **independent + mechanical** (disjoint exact file sets, no hard cross-task dependency)? | **HARD DISQUALIFIER** — cohesive ⇒ Mode 1, overrides everything. A **confirmed answer**, never inferred (misclassifying cohesive-as-independent is the highest-stakes failure — the split-author loss regime). |
| **F2** | Does **every** task carry a deterministic `kind:test`/`kind:shell` verifier judgeable WITHOUT Opus re-reading the diff? | **HARD DISQUALIFIER** — `manual`/none ⇒ Mode 1. **Auto-checked** from `task.verifier.kind`; no human. |
| **T1** | Is idle Codex quota available to offload (and/or is wall-clock a real deadline)? | **ENABLER** (levers 2+3). |
| (precond) | Is an executor lane actually dispatchable now? | NO ⇒ degrade to Mode 1 (preflight checks 1-2 of `{{ASSETS_PATH}}/codex-bridge-assets/preflight-checks.txt`). |

**Decision rule:** enable Mode 2 iff `F1 ∧ F2 ∧ precondition ∧ T1`. Persist the
decision + the satisfied lever + reason (telemetry §9). The "Opus headroom %"
self-assessment is dropped from the firing logic — it is not programmatically
readable, so it cannot gate automatically.

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

## 9. Telemetry — sidecar `dispatch-log.json` (R-EXEC-42), NOT a schema bump

Append one record per task to `.atomic-skills/status/dispatch-log.json` (a
sidecar — do NOT bump the Task schema to 0.2 for this until the lane is proven).
Shape:

```json
{
  "taskId": "T-101",
  "executorTier": "cheap | standard",
  "executor": "codex | subagent",
  "attempt": 1,
  "verifierKind": "test | shell",
  "verifierPassed": true,
  "escalatedTo": null,
  "escalationCount": 0,
  "startedAt": "<isoTimestamp>",
  "finishedAt": "<isoTimestamp>",
  "codexWorktreeRef": "<branch-or-path>"
}
```

Plus the persisted gate decision (the satisfied lever + reason). Success metric
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
