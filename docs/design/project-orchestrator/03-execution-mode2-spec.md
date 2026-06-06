# Plan-Execution Stage Spec — Mode 2 (Opus-Plans / Other-Model-Executes)

> ⚠️ **SUPERSEDED for the DEFAULT (2026-06-06).** This spec built the Codex lane as **default-OFF, opt-in, gated `F1∧F2∧precondition∧T1`**. That decision was revised: Codex is now the **DEFAULT** executor for spec-ready, verifier-bearing tasks (opt-OUT per batch), F1 reframed from "cohesive loses" to **spec-readiness**, and **T1 dropped** (`F1∧F2∧precondition`). The research + decision are in `.atomic-skills/projects/atomic-skills/mode2-codex-default-enablement/`; the live mechanics are in `skills/shared/mode2-codex-lane.md` + `skills/core/implement.md`. The §1 PURPOSE (scarce-resource analysis, `$/token` non-goal) and the safety invariants (never-self-certify, serial merge-back, verifier-on-merged-tree, state-tree fence) below remain in force; only the routing default + the gate changed.

> Status: PURPOSE codified for the first time. HOW pre-existed (R-EXEC-17..31); WHY was conversation-resident. This spec closes that gap and **re-scopes the build per adversarial critique** — the headline Opus-conservation lever does NOT survive for the Anthropic-subagent tier, so the recommended build is **Codex-lane-only, gated on a hard prerequisite**.

---

## 1. PURPOSE — the headline (read this to decide)

Under a **flat-rate Claude Max subscription the dollar-per-token saving is ~zero**, so any "execution is cheaper on a smaller model" pitch is dead and is an explicit NON-GOAL. The only scarce resources that actually bind are: **(1, PRIMARY) Opus weekly rate-limit/quota** — the hardest ceiling a heavy user hits, and once Opus throttles all planning/review judgment stops; **(2, SECONDARY) cross-provider offload** — moving execution onto OpenAI/Codex quota you already pay for, the *only* lane that takes work entirely off the Claude account; **(3, TERTIARY) wall-time throughput** — running independent tasks concurrently while Opus plans the next batch. Mode 2 exists to keep Opus off the critical path of *mechanical, fully-specified, independently-verifiable* execution so its scarce weekly budget is spent only where it is irreplaceable (decomposition, the dispatch gate, review, escalation judgment).

**Enable Mode 2 only at this conjunction:** (a) the work decomposes into tasks that each clear the dispatch hard-gate — exact paths, non-empty `scopeBoundary[]`, no placeholders, and a **deterministic** `kind:test`/`kind:shell` verifier (NOT `kind:manual`); (b) tasks are mechanical / loosely-coupled / **independent**, never one cohesive multi-file change; (c) a non-Opus executor is actually dispatchable (Codex CLI authenticated with quota; on Gemini that is the *only* lane); (d) at least one scarce-resource pressure is real *right now* (idle Codex quota to offload, or a wall-clock deadline); and (e) the verifier is trustworthy enough that **Opus does not re-read every diff** — if it must, the saving evaporates.

**It is theater (costs more / degrades quality / saves nothing) when:** the justification is $/token (rejected at the gate); the coding is cohesive/tightly-coupled (AkitaOnRails 2026 + Anthropic orchestrator-worker ~15× both show split-author *loses*); there is no near-free auto-running verifier (FrugalGPT cascade collapses → Opus re-reviews → net negative); no executor lane is dispatchable; or the batch is too small for the per-task worktree/verifier/merge overhead to amortize. **And — the critical correction — routing execution Opus→Sonnet/Haiku does NOT serve lever 1: Anthropic subagents spend the *same shared weekly Claude Max ceiling* that throttles everything, plus handoff + escalation overhead on top. The Anthropic-subagent tier is justified by lever 3 at best, and lever 3 is already covered by `parallel-dispatch`. The genuinely novel, defensible capability is the single Codex cross-provider lane.**

---

## 2. Is it specified today?

| Dimension | Verdict | Evidence |
|---|---|---|
| **HOW** (modes, routing, Codex profile, hard-gate, verifier-as-judge, state wiring) | **SPECIFIED** (R-EXEC-17..31) and grounded in real assets | `codex-bridge-assets/invocation-canonical.txt` (read-only contract + `run_with_timeout` 124/142 + `-a never` + no-yolo); `common.schema.json#/$defs/exitCriterionVerifier` (`kind:shell\|test\|query\|manual`) |
| **WHY** (problem, levers, enable-conditions, gate content, routing config, success metric, handoff contract) | **WAS NOT — now is** (this doc, R-EXEC-16/32..45) | grep across `skills/ meta/ docs/` returns zero `R-EXEC`/`R-ORCH`/`R-XAGENT`, no `routing.json`, no `implement.md`, no `merge-back`/`workspace-write` terms |

**Gap list, now closed:** purpose statement (§1, R-EXEC-16) · gate content (§3.2, R-EXEC-33) · routing config schema (§3.7, R-EXEC-41) · success metric + telemetry (§3.8, R-EXEC-42/45) · handoff contract (§3.4, R-EXEC-40) · merge-back v1 (§3.6, R-EXEC-39) · runtime gate over optional schema fields (§3.3, R-EXEC-43) · enable-conditions (R-EXEC-44).

**Latent defects found and resolved here:** (i) the two prior draft specs *collide* on R-EXEC-32/33/34 — this doc uses **one** non-colliding numbering (§4). (ii) The near-free verifier the cost thesis depends on **does not exist** — `project-transitions.md:178,192` STUB `kind:test`/`kind:query` auto-execution in v0.1 — so verifier auto-exec is promoted from "open decision" to a **hard blocking prerequisite** (§5).

---

## 3. The execution-stage spec

### 3.1 Mode 1 vs Mode 2 chooser

Mode 1 (self-exec, single strong model, sequential, durable `.atomic-skills/` snapshots) is the **unconditional default** (R-EXEC-17). The chooser runs once per implementation **batch**, only ever **escalates** to Mode 2, and only above a magnitude+independence floor so trivial work never sees the gate:

- **Firing threshold (R-EXEC-32):** gate fires iff (a) `N ≥ K` dispatch-eligible tasks (`K` default **3**, config `mode2.minBatchTasks`); (b) ≥2 are pairwise scope-independent — **reuse `parallel-dispatch` Phase 1.3 pairwise-grep**, do not re-derive; (c) the batch is not classified cohesive/coupled. Below threshold → Mode 1, silently, no ceremony.

### 3.2 Cost-justification gate (R-EXEC-33 — closes the dangling R-ORCH-24)

The critique is right that six self-assessed questions are a deterrent. **The gate is collapsed to two hard fences + one offload trigger**; the levers that change nothing observable are demoted:

| # | Question | Role | Source |
|---|---|---|---|
| **F1** | Are the batch tasks **independent + mechanical** (disjoint exact file sets, no hard cross-task dep)? | **HARD DISQUALIFIER** — cohesive ⇒ Mode 1, overrides all | confirmed answer, not inferred (highest-stakes misclassification) |
| **F2** | Does **every** task carry a deterministic `kind:test`/`kind:shell` verifier judgeable without Opus re-reading the diff? | **HARD DISQUALIFIER** — `manual`/none ⇒ Mode 1 | **auto-checkable** from `task.verifier.kind`; no human |
| **T1** | Is idle OpenAI/Codex quota available and do you want to offload this batch (and/or is wall-clock a real deadline)? | **ENABLER** (levers 2+3) | Y/N |
| **(precond)** | Is an executor lane actually dispatchable now? | precondition; NO ⇒ degrade to Mode 1 (R-EXEC-30) | `which codex` + `codex --version` (preflight checks 1-2); harness subagent capability |

**Decision rule:** enable Mode 2 iff `F1=YES AND F2=YES AND precondition=YES AND T1=YES`. The latent "Opus headroom %" and "away-from-keyboard" self-assessments are **dropped from the firing logic** — Opus headroom is not programmatically readable (so it can't gate automatically) and away-from-keyboard contradicts v1 merge-back (§3.6). **Any $/token framing is rejected outright.** The decision + satisfied lever + reason is persisted (R-EXEC-42).

### 3.3 Per-task routing + tier map + runtime gate

Routing is **per-task, never per-feature** (R-EXEC-18/19). Tier map: 1-2 files + complete spec → cheap (Haiku); multi-file integration → standard (Sonnet); architecture/design/review/escalation → **Opus, which NEVER executes**. Codex is a cross-provider lane, not a tier rung.

**Runtime dispatch gate (R-EXEC-43):** because `task.scopeBoundary`/`acceptance`/`verifier` are **OPTIONAL** in `initiative.schema.json` (`task.required = [id,title,status,lastUpdated]`), the R-EXEC-25 hard-gate is enforced **at dispatch time as a runtime check**, NOT by making fields schema-required (that would break every existing task). A task missing exact paths, non-empty `scopeBoundary[]`, or a deterministic verifier is **refused dispatch and runs Mode 1 self-exec for that task only** (not the whole batch).

### 3.4 Handoff work-order contract (R-EXEC-40)

The executor is **contextually isolated** from the Opus session — stateless relative to it, **not dumb** (Sonnet/Codex are strong coders). The work-order is fully self-contained, generated by reusing `atomic-skills:prompt`'s briefing discipline. Required content:

1. Target files split **Create / Modify / Test** with exact absolute paths.
2. **Inline approach narrative + design rationale (intent).**
3. `scopeBoundary[]` verbatim + a `parallel-dispatch`-style DO-NOT block (no `git add -A`, no push, stop-and-report on scope-exit).
4. The deterministic verifier command **verbatim** (for the executor to self-**CHECK** before returning — it can never self-**CERTIFY**, R-EXEC-28).
5. The relevant `.atomic-skills/` state slice (the Mode-1 snapshot).
6. Edit-contract by capability: whole-file rewrite for weakest tier, unified diff/patch for stronger.

**CRITICAL INVERSION of `review-code`'s anti-framing Iron Law:** a fresh-context *reviewer* is **denied** intent (intent narrative poisons review up to −93pp, see `anti-framing-directive.txt`). An *executor* is the opposite — it **RECEIVES** intent because it needs the rationale to build correctly. This inversion is stated explicitly so the two contracts are never confused. The verifier-judge and any cross-model reviewer remain intent-denied.

### 3.5 Dispatch — lanes + Gemini portability

Orchestration is expressed **portably** (`{{INVESTIGATOR_TOOL}}` for subagents, `{{BASH_TOOL}}` + the codex bridge for Codex); native Workflow/Task appears only behind `{{#if ide.claude-code}}`.

- **Codex workspace-write lane (R-EXEC-35) — THE lane that matters.** Mirrors `invocation-canonical.txt` and changes only what must change: flip `--sandbox read-only` → `--sandbox workspace-write`; run inside a dedicated `git worktree add` from the task's base ref; keep `-a never`, `exec`, `--skip-git-repo-check`, the portable `run_with_timeout` (both **124 and 142** ⇒ timeout, perl-alarm macOS fallback), and the **DO-NOT list verbatim (no `--yolo`, no `--full-auto`, no `--dangerously-bypass`)**. Preflight reuses checks 1-2 (binary present + callable) but **drops ONLY the clean-tree gate** for the worktree (a writing executor expects to dirty it) while keeping it on the worktree's PARENT before cutting. Briefing via stdin (`- < BRIEFING`); diff read back with `git -C <worktree> diff`.
- **Anthropic-subagent lane (R-EXEC-34) — DEFERRED, see §5.** If ever built: dispatch via `{{INVESTIGATOR_TOOL}}` (model per tier map) in the same working tree; subagent runs the verifier and reports but cannot self-certify. **Justified by lever 3 only — and lever 3 is `parallel-dispatch`'s job.**
- **Portability caveat (R-EXEC-36):** on Gemini `{{INVESTIGATOR_TOOL}}` is likely read-only ⇒ subagent tier collapses ⇒ **Mode 2 on Gemini = Codex-only.** Neither lane dispatchable ⇒ Mode 1 (R-EXEC-30).

### 3.6 Verification + escalation cascade (R-EXEC-37/38)

Executor produces diff → run the task's deterministic verifier (un-stubbed, R-EXEC-27) as a near-free judge. **PASS ⇒ verify-done, zero Opus tokens.** FAIL ⇒ escalate **exactly one tier up** (Codex/Haiku→Sonnet→Opus-review→human), re-running the *same* verifier each rung, never silently retrying the same tier with the failure output appended to the briefing. Opus **REVIEWS, never authors** at its rung. Only paths to done: verifier-pass OR strong-model approval (R-EXEC-28).

**Escalation tokens are counted (R-EXEC-38):** per-task Opus spend = `(decompose + gate share) + p_fail × (Opus re-entry tokens)`, measured against the Mode-1 solo-Opus authoring counterfactual. If per-tier first-pass rates make `(re-plan + re-review) ≥ solo-author cost`, the batch is recorded **FAILED** and routing thresholds tighten.

### 3.7 Merge-back (R-EXEC-39) + routing config (R-EXEC-41)

- **Merge-back v1 = operator-prompted manual** from the Codex worktree, then the verifier **MUST re-run against the MERGED tree** (not just in-worktree) before the state machine may mark done (R-EXEC-29). Two adjacent-file tasks can each pass in-worktree and conflict on merge. Conflict ⇒ abort the done transition, surface, leave task `active`. **Honest caveat per critique:** v1 manual merge requires the operator **at** the keyboard, so the away-from-keyboard pitch is **OFF the table for v1** — lever 3 is scoped to *attended deadline* batches until v2 (deterministic serial rebase + reverify) ships.
- **Routing config (R-EXEC-41):** new `meta/schemas/routing.schema.json` validating `.atomic-skills/status/routing.json` (joins `npm run validate-state`; note `validate-state.js` hardcodes the 3-schema loader at lines 23-48 — adding a 4th schema requires editing it). Fields: `mode2Enabled` (default false), `tierMap` (Opus never an executor target), `codexLane {enabled, model, timeoutSeconds:600, sandbox const 'workspace-write'}`, `thresholds {minBatchTasks:3, requireDeterministicVerifier:true}`, `ideOverrides {gemini:{subagentExecutor:false}}`. **Absent file ⇒ Mode-1-only defaults.**

### 3.8 Success metric + telemetry (R-EXEC-42/45)

Counterfactual against a Mode-1 estimate, never absolute tokens. **PRIMARY** (lever 1): Opus tokens not spent on execution; honest proxy = recovered weekly Opus headroom *(see open decision — likely human-attested, hence partly unfalsifiable)*. **SECONDARY:** fraction of execution served by Codex (off-Claude-bucket); batch wall-clock vs sequential Mode-1 estimate. **GUARDRAIL:** per-tier verifier first-pass / escalation rate — FAILED if bounce-back erases the conserved budget. Telemetry (R-EXEC-42): per-task `{executorTier, executor(subagent|codex), attempt, verifierKind, verifierPassed, escalatedTo, startedAt, finishedAt, codexWorktreeRef?}`. **Where:** start as a **sidecar `.atomic-skills/status/dispatch-log.json`** (no schema churn), NOT the `task.executionLog` v0.2 schema bump — defer the migration until the Codex lane is proven (critique: the primary series is un-instrumentable today, so don't pay schema cost for an immeasurable metric yet).

### 3.9 Degraded fallback (R-EXEC-30, extended)

No dispatchable lane at gate time, or a lane fails mid-batch (Codex missing, subagent spawn denied on Gemini) ⇒ affected tasks fall back to Mode 1 self-exec, recorded as the gate decision reason — never a silent collapse.

---

## 4. New / amended requirements

| id | requirement | acceptance | priority |
|---|---|---|---|
| **R-EXEC-16** | Codify the WHY: Mode 2 conserves the scarce flat-rate resources — Opus weekly quota (PRIMARY), cross-provider Codex offload (SECONDARY, sole Gemini lane), wall-time (TERTIARY) — **NOT** per-token dollars. State the non-goal verbatim. **Amend:** Opus conservation is a real win **only via the Codex lane**; the subagent lane spends the same shared Claude ceiling and does NOT serve lever 1. | A requirement file states all three levers, the `$/token` non-goal, and the subagent-lever-1 caveat; grep finds `flat-rate` + `Opus weekly` + `NOT justified by per-token`. Mode 1 stays default. | blocker |
| **R-EXEC-32** | Per-batch chooser: defaults Mode 1, only escalates. Gate fires iff `N≥K` (default 3, `mode2.minBatchTasks`) AND ≥2 pairwise-independent (reuse `parallel-dispatch` pairwise-grep) AND not cohesive. | 1-task or cohesive batch ⇒ no gate, Mode 1; `N≥3` independent ⇒ gate presented. | blocker |
| **R-EXEC-33** | Collapsed gate: F1 independent+mechanical (HARD DISQ if cohesive, confirmed answer), F2 deterministic `test`/`shell` verifier (HARD DISQ if manual/none, **auto-checked** from `task.verifier.kind`), T1 idle-Codex-quota/deadline enabler, precondition lane-dispatchable. Rule: enable iff `F1∧F2∧precondition∧T1`. Reject `$/token` framing. Persist decision+reason. | Two hard disqualifiers + enabler + precondition + boolean rule written; cohesive or manual-only ⇒ Mode 1 regardless; F2 checked without a human; decision persisted. | blocker |
| **R-EXEC-34** | Anthropic-subagent lane via `{{INVESTIGATOR_TOOL}}` (tier map), same tree, R-EXEC-40 briefing, returns diff + verifier self-check, never self-certifies. **DEFERRED** (see §5 — lever 3 is `parallel-dispatch`'s job). | If built: lane via `{{INVESTIGATOR_TOOL}}`, native Task only under `{{#if ide.claude-code}}`, Opus never executes. | deferred |
| **R-EXEC-35** | Codex workspace-write lane: mirror `invocation-canonical.txt`, flip sandbox to `workspace-write`, isolated `git worktree`, keep `-a never`/`exec`/`--skip-git-repo-check`/`run_with_timeout`(124+142)/DO-NOT list verbatim, drop ONLY clean-tree preflight for the worktree; stdin briefing; `git -C <worktree> diff` readback. | Command differs from read-only canonical ONLY in sandbox flag + worktree cwd; DO-NOT list + timeout wrapper preserved verbatim; worktree isolated. | **core (the build)** |
| **R-EXEC-36** | Host portability: Gemini read-only investigator ⇒ Codex-only; neither lane ⇒ Mode 1. | Read-only-subagent host routes all to Codex; no Codex + no writable subagent ⇒ Mode 1. | core |
| **R-EXEC-37** | Single-tier-step escalation cascade; verifier re-runs each rung; Opus reviews (never authors); done only via verifier-pass or strong approval. | Cascade is one-step; verifier re-runs; Opus only on repeated fail as reviewer; cheap/Codex never reach done without pass/approval. | core |
| **R-EXEC-38** | Count escalation/re-review tokens vs Mode-1 counterfactual; declare batch FAILED + tighten thresholds when `re-plan+re-review ≥ solo-author`. | Formula + failure condition written; telemetry captures `escalationCount` + per-tier pass rate. | core |
| **R-EXEC-39** | Codex merge-back v1 = operator-prompted manual; verifier MUST re-run on MERGED tree before done; conflict ⇒ abort done, leave active, surface. v2 serial-rebase deferred. | No Codex task done on in-worktree-only pass; post-merge re-verify mandatory; conflict leaves active. | core |
| **R-EXEC-40** | Handoff work-order contract: 6 content items; **executor RECEIVES intent (inversion of `review-code` anti-framing law)**; reuse `atomic-skills:prompt`; Codex briefing documents worktree seeding + diff readback. | Template enumerates 6 items; intent-inversion sentence cites `anti-framing-directive.txt`; Codex path documents seeding. | core |
| **R-EXEC-41** | `meta/schemas/routing.schema.json` ↔ `.atomic-skills/status/routing.json`, wired into `validate-state` (note 3-schema loader edit); Opus never an executor target; gemini override = codex-only; absent file ⇒ Mode-1 defaults. | Schema exists + validated; missing file ⇒ Mode-1; gemini override disables subagent lane. | core |
| **R-EXEC-42** | Telemetry as **sidecar `dispatch-log.json`** (not v0.2 schema bump): `executorTier`, `verifierPassed`, `attempt`, `escalationCount`, timestamps, `codexWorktreeRef`, plus persisted gate decision. | Post-batch sidecar contains the fields + gate decision; success-metric series derivable. | core |
| **R-EXEC-43** | Enforce dispatch hard-gate at runtime over OPTIONAL schema fields; missing field ⇒ refuse dispatch ⇒ Mode 1 for that task only; do NOT make fields schema-required. | Schema-valid task lacking verifier/scopeBoundary runs Mode 1; schema unchanged. | core |
| **R-EXEC-44** | Enable only via explicit surface (`routing.json` + per-invocation flag), never implicit; preconditions (codex authenticated; writable subagent dispatch) checked; failed precondition ⇒ Mode 1 with recorded reason. | Documented flag/config path; absent ⇒ Mode 1; failed precondition degrades with persisted reason. | core |
| **R-EXEC-45** | Success metric as counterfactual: PRIMARY Opus-tokens-not-spent (proxy: recovered headroom), SECONDARY Codex-served fraction + wall-clock, GUARDRAIL per-tier first-pass/escalation; reads R-EXEC-42 records. | Four series + FAILED condition map 1:1 to telemetry; no dashboard. | nice-to-have |
| **R-EXEC-PREREQ** | **(new, blocking)** Un-stub `kind:test`/`kind:shell` auto-execution. The near-free deterministic judge does not exist (`project-transitions.md:178,192`); the cascade economics are vapor without it. | `done`/verify auto-runs the verifier command and captures exit code; no Mode 2 lane ships before this. | **blocker** |

---

## 5. Worth-it verdict + scope recommendation

**Verdict: BUILD THE CODEX-LANE-ONLY SLICE — and only *after* the verifier prerequisite. DEFER the Anthropic-subagent tier and most of the apparatus.** The headline rationale survives the flat-rate correction for exactly one lane.

- **Why not build-all:** The PRIMARY lever (Opus conservation) does **not** hold for the Anthropic-subagent tier. Sonnet/Haiku subagents draw on the **same shared weekly Claude Max ceiling** that does the actual throttling; routing Opus→Sonnet conserves the Opus *sub-limit* but spends the same binding bucket **plus** handoff + execution + verifier + escalation overhead — net **wash-to-negative** for lever 1. The spec's own benchmark citations (AkitaOnRails 2026, Anthropic orchestrator-worker ~15×) say split-author loses on cohesive coding; the *only* regime where the subagent lane could pay is independent-mechanical batches — **which `parallel-dispatch` already covers** with its Q1-Q4 hard-gate, pairwise-grep disjointness, bug-budget `1−(1−p)^N`, and mandatory audit. So the subagent half is largely a re-skin of an existing tool.

- **The genuine, novel delta is the Codex workspace-write lane** — the *only* in-harness path to a foreign WRITING model, the *only* lever that moves work entirely off the Claude account (lever 2), and on Gemini the *only* Mode 2 lane at all. Build: **R-EXEC-35** (workspace-write Codex executor as a guarded extension of the read-only bridge) + **R-EXEC-39/40** (operator-prompted merge-back with mandatory post-merge re-verify + the handoff contract) + **R-EXEC-43** (runtime gate) + the **2-question gate** (R-EXEC-33 collapsed: F1 independent, F2 verifier-present) + minimal sidecar telemetry (R-EXEC-42 as `dispatch-log.json`). Nothing else.

- **Hard blocking prerequisite (R-EXEC-PREREQ):** un-stub `kind:test`/`kind:shell` auto-execution. Today `project-transitions.md:178,192` stub them; without a near-free auto-running judge, "Opus only re-enters on fail" is false — Opus must read every diff (R-EXEC-28), which costs ~what authoring would. **As the repo stands, Mode 2 delivers NEGATIVE Opus savings. Do not ship any lane before this.**

- **If the subagent throughput case is ever wanted:** extend `parallel-dispatch` with a per-task tier hint — far cheaper than a parallel chooser + routing.json + tier-map that re-derives the same independence machinery.

**Bounding conditions to enable (all must hold):** verifier auto-exec shipped; idle separately-billed Codex quota; ≥~5 provably-independent mechanical tasks each with a deterministic `test`/`shell` verifier; operator attended for v1 merge-back (away-from-keyboard is a v2 claim); and conserved/offloaded value > handoff + worktree + N merge prompts + N re-verifications. Outside this, Mode 1 is strictly better.

---

## 6. Open decisions (genuine forks)

1. **Verifier un-stub home (R-EXEC-PREREQ):** does auto-running `test`/`shell` land in `project-transitions.md` (benefits all closes) or stay local to the implement skill (no blast radius, but a second verify path)? — *recommend: in `project-transitions.md`, it's the canonical verify workflow.*
2. **Opus headroom readout (gate/metric):** is weekly Opus quota programmatically readable from the Claude Code session, or human-attested? If attested, the PRIMARY metric is estimate-only and the "did the week's quota last" proxy is unfalsifiable post-hoc — confirm before wiring R-EXEC-45.
3. **Merge-back v2:** deterministic serial rebase + reverify (unattended) — trigger (auto vs opt-in) and dependency-order source (`crossTaskRefs.depends_on`? declared order?). Required to honestly claim the away-from-keyboard use case.
4. **`minBatchTasks` floor K:** fixed 3, or scale by estimated authoring tokens / task size? The real driver is fixed per-task worktree+verifier overhead, not raw count.
5. **Telemetry home longer-term:** keep the sidecar `dispatch-log.json`, or bump Task schema v0.1→v0.2 with `task.executionLog` (schemaVersion is `const "0.1"`; touches every task + needs a migration)? — *recommend: sidecar until the Codex lane is proven.*
6. **Codex worktree primitive:** raw `git worktree add/remove` via `{{BASH_TOOL}}` (portable to Gemini) vs `EnterWorktree`/`ExitWorktree` harness tools (Claude-Code-only, cleaner). Since Gemini is Codex-only anyway, a harness dependency *might* be acceptable — decide.
7. **Cohesion classification:** model-inferred heuristic vs user-confirmed answer for F1. Misclassifying cohesive-as-independent is the highest-stakes failure (the AkitaOnRails loss regime) — *recommend: confirmed answer, not inference.*
8. **`validate-state.js` 4th-schema wiring:** adding `routing.schema.json` requires editing the hardcoded 3-schema loader (lines 23-48). Confirm this won't break the existing cross-validation contract.