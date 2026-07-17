# Design — Implementation Automate Mode

## Context

`atomic-skills:implement` is today an **execution driver**, not an orchestrator: the host session codes SPEC-admitted tasks serially, closes each only through verify-on-done, and owns durable `.atomic-skills/` state. Mode 2 (Codex lane) can hand **per-task** mechanical execution to an isolated worktree while the host still plans, merges, and owns state.

Operators want a third, explicit **automate mode** for multi-phase plans:

1. The **session works as orchestrator only** (maestro): dispatch, verify, review, close state — not as the phase coder.
2. **One writer agent per phase** implements that phase's tasks end-to-end under the same single-writer-per-worktree iron law.
3. **CROSS-MODEL REVIEW** runs on every phase boundary and on big/complex tasks (not only when the destructive-diff signal fires).
4. At **plan end** (finalize/archive path), run **all available family-different external reviewers** (`external-both` = Codex then Grok, host-filtered).

Ground truth this design rests on (G1):

```
skills/core/implement.md:7
CODING STAYS SINGLE-THREADED (ONE WRITER PER WORKTREE).

skills/core/implement.md:22
This is an **execution driver, not an orchestrator** — call it that so no one expects concurrency that single-threaded coding will never use.

skills/shared/project-assets/project-transitions.md:222
When DESTRUCTIVE is true, run **`--mode=both`** … Otherwise run `--mode=local`.

skills/shared/codex-bridge-assets/review-mode-ux.md:18
| `external-both` | external Codex **then** Grok on the same cleaned artifact; merge via `src/external-both-merge.js` …
```

verified_by: pasted lines from the live repo above.

## Decisions

1. **Opt-in mode, not a new default.** Automate mode is entered only by explicit invocation (`implement --mode=automate <plan>` or equivalent flag parsed from `{{ARG_VAR}}`). Mode 1 (session writer) and Mode 2 (per-task Codex) stay available and unchanged for plans that do not opt in. unverified: exact CLI surface string until implement Step 0 is edited; intent is a stable mode token `automate`.

2. **Session = pure maestro.** In automate mode the host session **never** edits product source. It: resolves plan/branch/worktree; materialize-gates; builds the phase work-order; spawns **one** phase writer; re-runs deterministic verifiers on the tree the orchestrator owns; runs review gates; executes `done` / `phase-done` / finalize state transitions; writes handoff. If the phase agent fails or review requires a code fix, the orchestrator **re-dispatches** a fix agent (same isolation rules) — it does not fall back to self-coding without an explicit user override recorded in the handoff.

3. **One writer agent per phase (not per task) — code-only subset of the implement loop.** Granularity is the **phase initiative**. The phase writer is a **foreign executor**, not a full Mode-1 `implement` session: for each pending SPEC-admitted task in that phase it runs only **orient → code → pre-close verifier self-check → explicit-path implementation microcommits → claim report** (per-task: commit SHAs, paths touched, verifier command + exit transcript). It **must not** invoke `done`, `phase-done`, handoff mutation, rollups, lessons, or any durable `.atomic-skills/` write. The orchestrator re-runs each verifier (verify-claim / `done` path) and is the sole closer — same “never self-certifies” law as Mode 2. This is coarser than Mode 2's per-task Codex dispatch and finer than one agent for the whole plan. Parallel phase agents are **forbidden** even when phases are `parallelismAllowed` until a later design revisits isolation; v1 is sequential phases only under automate.

4. **State-tree fence stays with the orchestrator.** The phase writer may edit scoped product source and create **implementation** microcommits only. The phase writer **never** mutates durable `.atomic-skills/` project state (`plan.md`, phase initiatives, rollups, lessons, review receipts, handoff). The orchestrator owns every `done`/`phase-done`/`finalize` write and the project-state checkpoint commits, same fence as Mode 2's Codex lane.

5. **Phase-boundary CROSS-MODEL REVIEW is mandatory under automate.** When automate mode is active, `phase-done` does **not** use the current DESTRUCTIVE→`both` / else→`local` ladder for the default path. Default review mode for every phase close is **`both`** (local then host external default — family-different). User may record an explicit downgrade to `local` only as an override (same receipt discipline as today's destructive override). `--skip-review` remains the only full skip and must be recorded.

6. **Big/complex tasks get CROSS-MODEL REVIEW before close.** A task is **complex** under automate when any of: `tasks[].weight` ≥ plan/config threshold (default **3**), tags include `destructive`/`decommission`/`drop`/`complex`, or the implement-time DESTRUCTIVE signal is true on its implementation range. For such tasks, before orchestrator-owned `done`, run `review-code --mode=both` on the task's commit range (same pin as phase-done under automate; `resolveReviewRoute` still applies same-family remap rules). **Blocker and critical findings block `done`** until fixed via re-dispatch or operator disposition; **major findings surface for operator triage** and do not auto-block unless the operator escalates. Non-complex tasks close with verifier-only (existing GATE-R2) — no forced per-task cross-model.

7. **Plan-end review uses all available external cross providers.** On plan finalize/archive under automate (or a dedicated plan-end gate before `status: done`/`archived`), run `review-code` with **`external-both`** on the plan integration range (base `integrationRef`/`develop`…HEAD or plan branch range documented in finalize). Same-family legs are filtered by existing `resolveReviewRoute` (Grok host → Codex only; Codex host → Grok only). Receipt must land under `.atomic-skills/reviews/` and be linked from the plan `## Reviews` section.

   **Machine-checkable plan-end predicate (HARD-BLOCK):**
   ```
   planEndReviewOk =
     receipt exists
     AND (
       count(succeeded family-different external legs) ≥ 1
       OR explicit --skip-plan-end-review recorded with non-empty reason
     )
   ```
   Host family filtering that leaves a **single** external leg is OK when that leg `succeeded`. A receipt where every leg is `skipped`/`failed` and there is no recorded skip ⇒ **HARD-BLOCK** finalize/archive. Partial success (one of two externals succeeded) satisfies the ≥1 rule; merge keeps the successful half per existing `external-both` merge semantics.

8. **Surface = extend existing skills, no new top-level skill.** Changes land in `skills/core/implement.md` (mode entry + maestro loop + phase dispatch), `skills/shared/project-assets/project-transitions.md` (automate-aware phase-done review policy + complex-task hook if owned there), `skills/shared/project-assets/project-finalize.md` (plan-end external-both gate), plus thin helpers/tests as needed (`src/` pure functions for complex-task predicate, mode parse). Mode 2 assets remain the per-task Codex path; automate reuses worktree-isolation / verify-claim / review-code contracts rather than reimplementing them.

9. **Attended gates stay human; decisions are visible before finalize.** Automate mode does **not** mean unattended merge to develop or silent ratify. Intrusive actions (phase advance, finalize PR, ratify on lessons, user-manual exit gates) still prompt the operator. Verifier-passing task close may proceed without re-asking when the task is non-manual and evidence is machine-checked; that is existing GATE-R2, not new auto-merge. **Load-bearing operator rule:** every phase-writer and evaluation-agent decision that affects routing, skip, re-dispatch, scope exit, or review severity disposition is written into the initiative `## Session handoff` decision log (and/or a durable phase decision block) so the user can audit them. **Finalize and archive run only after the user has validated the implementation and those decisions** — never auto-archive after the last phase turns green.

10. **Phase evaluation agent (in addition to the phase writer).** After the orchestrator closes the phase's tasks (and before or inside phase-done), spawn a **separate evaluation agent** (fresh context, not the writer) whose job is to assess whether the phase's implemented feature meets the phase goal, exit gates, and businessIntent spine. The evaluator does not edit product source or project state; it returns a structured assessment (pass/fail + findings). Blocker/critical evaluation findings block phase-done until re-dispatch or operator disposition. This is distinct from `review-code` (diff adversarial review) and from the phase writer (code-only).

11. **Portability.** Phase dispatch uses portable primitives (`{{BASH_TOOL}}`, read-only `{{INVESTIGATOR_TOOL}}` / `spawn_subagent` where the host supports isolated writers). Host-only Workflow/Task APIs stay behind existing `{{#if ide.*}}` accelerators and are never the only path (R-XAGENT-01).

12. **`planEndReviewOk` is machine-enforced on finalize and archive under automate.** A durable plan-end receipt (per-leg succeeded|failed|skipped + optional skip reason) is required. Archive cannot complete for `executionMode: automate` plans without `planEndReviewOk` true. Soft “point the operator at finalize” is not enough.

13. **Evaluation order is fixed.** All phase tasks `done` → evaluation agent (read-only, structured pass/fail) → only then phase-done `review-code --mode=both`. Evaluator never writes state; orchestrator logs dispositions. Evaluation blocker/critical re-dispatches a code-only fix agent (max 2) or stops for operator; does not silently mark phase done.

14. **`isAutomateActive` is a pure helper.** Inputs: CLI mode, plan `executionMode`, explicit clear flag. Single definition shared by implement, phase-done, finalize, status. Landed in F0 alongside mode parse.

## Chosen approach

**Name: Maestro + phase-writer (opt-in on `implement`), review policy layered on transitions/finalize.**

### How it works (runtime)

```
implement --mode=automate <plan>
  Step 0     resolve plan / branch / worktree (existing)
  Step 0.5   resume gate (existing) — refuse if dirty tree or a phase-writer still running
  Step A     load active phase + businessIntent + SPEC tasks (existing hard gates)
  Step B     snapshot handoff; build phase work-order (all pending tasks of THIS phase only)
  Step C     spawn ONE phase-writer with constructed brief (no orchestrator chat history):
               code-only contract — no done/phase-done/state writes
  Step D     SYNC WAIT until writer exits; collect claim report; refuse self-certify
  Step D.5   Orchestrator merges sibling phase worktree → plan branch (git-ops only);
               content conflicts ⇒ re-dispatch code-only fix agent; refuse mid-merge resume
  Step E     for each task the agent claims finished (on MERGED plan tree only):
               re-run verifier (verify-claim / done path)
               verifier fail ⇒ do NOT done; re-dispatch fix agent or stop for operator
               if complex → review-code --mode=both on VALIDATED task commit range;
                 blocker/critical → re-dispatch fix agent before done
               only on verifier pass (+ complex review clear + durable receipt) → done <task-id>
  Step F     when phase tasks closed → spawn ONE evaluation agent (fresh, not the writer);
               structured pass/fail on goal + gates + businessIntent;
               blocker/critical → reopen affected tasks or blocking follow-ups;
                 re-dispatch fix agent (max 2); re-run verifiers/complex reviews on fix range
  Step G     phase-done with review mode = both (automate override);
               durable decisions log visible for user audit
  Step H     next phase: re-enter Step A (new writer + later new evaluator; contexts discarded)
  Step I     after last phase → plan-end external-both (planEndReviewOk)
               → USER validates implementation + decisions
               → only then operator finalize / archive
```

### Approaches weighed

| Approach | Summary | Verdict |
|---|---|---|
| **A. Maestro + one writer agent per phase** (chosen) | Session orchestrates; phase agent codes all phase tasks; orchestrator owns state + reviews | Matches user constraints; reuses implement loop + state fence; sequential, single writer |
| **B. Session remains Mode-1 writer + only reinforce reviews** | No phase agents; only change review policy | Rejected: does not deliver "session as orchestrator" / "one agent per phase" |
| **C. New skill `automate` wrapping implement** | Separate entry skill | Rejected for v1: doubles catalog surface; same code paths as implement Step 0–3; user chose extend-implement |
| **D. One agent per task always (Mode 2 default for whole plan)** | Task-level Codex/subagent for everything | Rejected as *this* mode: user fixed phase granularity; Mode 2 remains available separately for mechanical batches |

### Isolation detail (v1)

- **Exclusive write windows:** at most one writer process on a given tree at a time. The orchestrator **sync-waits** for the phase writer to exit before any orchestrator source-adjacent work or `done`/state mutations.
- **Writer lease (machine HARD-GATE):** before spawn, the orchestrator writes a durable lease at `.atomic-skills/status/writer-leases/<plan-slug>.json` `{planSlug, phaseId, startedAt, hostId, worktreePath}`. Resume refuses automate if the lease exists and is not cleared (or tree dirty for unknown reasons). Clear lease only after sync-wait + claim collect completes.
- **Sibling isolation, never nest under the plan worktree:** the plan home is already a linked worktree (`.worktrees/<plan-slug>`). Phase isolation cuts a **sibling** worktree from the git common-dir / primary repo root (same pattern as Mode 2), **not** a nest under `.worktrees/<plan-slug>/…`. Reuse `worktree-isolation.md` Step 0 “do not nest” with this carve-out documented.
- **Default in v1:** prefer sibling phase worktree for the phase writer always (safer). Shared plan-tree exclusive spawn is only allowed when a host allowlist preflight passes (capability matrix: sync wait + exclusive write proven).
- **Merge-back is orchestrator git-ops only:** the orchestrator may run merge/status/checkout that do **not** hand-edit product file contents. Any content conflict resolution is a **new code-only fix-agent dispatch** under the same fence. Refuse resume while merge is mid-flight. Post-merge re-verify is mandatory before `done`.
- **Never:** two phase writers concurrent; phase writer writing `.atomic-skills/` state; orchestrator hand-editing product source; nesting a phase worktree inside the plan worktree path.

### Review policy matrix under automate

| Moment | Mode | Notes |
|---|---|---|
| Non-complex task close | verifier only | GATE-R2 unchanged |
| Complex task close | `--mode=both` | Before orchestrator `done`; blocker/critical block; major triage |
| Phase-done | `--mode=both` mandatory default | Overrides DESTRUCTIVE-only ladder while automate is active |
| Plan-end (finalize/archive) | `external-both` + `planEndReviewOk` | ≥1 succeeded family-different leg OR recorded `--skip-plan-end-review` |

### Complex-task predicate (deterministic)

```
complex = weight >= threshold (default 3)
       OR tags ∩ {destructive, decommission, drop, complex} ≠ ∅
       OR DESTRUCTIVE(diff of task commits) == true
```

Pure helper preferred (`src/` + unit tests) so `implement` and any transition hook share one definition. verified_by: `tasks[].weight` already exists in `meta/schemas/initiative.schema.json` (optional numeric complexity proxy).

## Non-goals

- Replacing Mode 1 or Mode 2 defaults for all plans.
- Unattended merge to `develop` / auto-merge PRs / auto-ratify lessons.
- Parallel multi-phase writers in v1.
- Making Anthropic Sonnet/Haiku the phase writer as a new paid tier story (host subagent is fine; the deferred Mode-2 Anthropic executor tier is unrelated).
- Changing `external-both` merge semantics or inventing a third external provider beyond Codex + Grok.
- Forcing cross-model on every task (cost explosion); only complex + phase + plan-end.
- A dashboard-only "automate" button without skill contract.

## Blast radius

Not a data-model migration, but three contracts change for **opt-in** runs only:

1. **implement identity** — mode branch redefines who may write source; bugs here can leave dirty trees or double-writers. Containment: mode flag default off; resume gate refuses dirty trees; iron law tests extended for automate path.
2. **phase-done review policy** — automate forces `both` every phase (cost + wall time). Containment: only when automate active / plan records `executionMode: automate` (or session flag); non-automate keeps DESTRUCTIVE ladder.
3. **finalize gate** — plan-end uses `planEndReviewOk` (≥1 succeeded family-different external leg OR recorded `--skip-plan-end-review` with reason). Zero successful legs without skip HARD-BLOCKS archive. Containment: receipt records per-leg `succeeded|failed|skipped`; never treat all-skipped as pass.

`executionMode: automate` is additive-optional in schema (pre-automate plans omit it) but **mandatory to stamp** after first confirmed automate entry so status/phase-done/finalize share one durable mode bit. Clear only via explicit unstamp path.

## Open questions

1. ~~executionMode stamp~~ — **CLOSED:** first successful `implement --mode=automate` entry **must** stamp `executionMode: automate` after operator confirm (interactive y). Precedence: CLI `--mode=automate` opts in for this session; stamp alone re-enters **review cadence + pure-maestro** on later `implement <plan>` until operator runs explicit unstamp / `--mode=1` re-entry. Stamp clear path: `implement --clear-execution-mode` or project mutation recorded in decision log.
2. Default `weight` threshold for complex (3) — confirm after first dogfood plan; until then default 3 and document intentional double-review cost (task both + phase both).
3. ~~Spawn failure path~~ — **CLOSED:** under automate, no writing-subagent capability ⇒ **refuse with clear message** OR optional recorded degrade to Mode-2-style **sibling** Codex phase worktree. Mode-1 self-code is **forbidden** while `executionMode: automate` (operator must clear stamp / leave automate to self-code).
4. Complex-task severity gate: **closed in Decision 6** — blocker/critical block `done`; major surfaces for operator triage **with required disposition record** (accept/defer/fix) before close.
5. Max re-dispatch rounds for verifier/review/evaluator fail before mandatory operator stop — default **2** re-dispatches then stop (confirm in implement).

## Rejected alternatives

- **Session stays the coder; only harden reviews** — fails the maestro + per-phase agent requirements.
- **New top-level skill `automate`** — catalog and discoverability cost without a different runtime; user chose extend implement/transitions/finalize.
- **One agent per task for this mode** — collapses into Mode 2; user fixed phase granularity.
- **Always `external-both` on every phase** — over-cost vs host-default `both` at phase + full external stack only at plan end (user: all available cross at end of plan).
- **Unattended full pipeline** — violates intrusive-actions / ratify / finalize operator model already load-bearing in project skill.

## Self-review against code-quality gates

- G1 read-before-claim: applied — claims about implement iron law, phase-done review ladder, and `external-both` cite pasted source lines under Context
- G2 soft-language: applied — scanned; decisions use mandatory / forbidden / default, not "should/probably"
- G6 reference-or-strike: applied — live-repo claims carry verified_by; CLI token string and phase-writer host capability marked unverified where not yet coded
