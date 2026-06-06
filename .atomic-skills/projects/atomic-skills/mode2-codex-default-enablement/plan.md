---
schemaVersion: "0.1"
slug: mode2-codex-default-enablement
title: Mode 2 — make Codex the default implementer (Opus plans, Codex executes)
version: "1.0"
status: active
started: 2026-06-06T20:28:44Z
lastUpdated: 2026-06-06T20:28:44Z
branch: dogfood/self-host-migration
currentPhase: F0
parallelismAllowed: false
phases:
  - id: F0
    slug: mode2-codex-default-enablement
    title: Mode 2 — make Codex the default implementer
    goal: "Flip the implement skill so a SPEC-READY task carrying a deterministic
      verifier routes to the Codex workspace-write lane BY DEFAULT (no
      per-invocation opt-in), while preserving every quality-carrying guardrail:
      the spec-completeness dispatch gate, the deterministic-verifier
      requirement, single-threaded serial merge-back, verifier-re-run on the
      merged tree, and foreign-executor-never-self-certifies."
    dependsOn: []
    subPhaseCount: 4
    status: active
    exitGate:
      summary: 4 criteria to meet — default flipped, quality-carriers preserved,
        suite green, adversarially reviewed.
      criteria:
        - id: G-1
          description: "QUALITY-CARRIERS PRESERVED (the research finding): the
            spec-completeness dispatch hard-gate (R-EXEC-43), the deterministic
            kind:test/kind:shell verifier requirement (F2), foreign-executor
            never-self-certifies (R-EXEC-28), serial merge-back (R-XAGENT-03),
            and verifier-re-run on the MERGED tree (R-EXEC-29) all remain HARD
            and verbatim — none weakened by the default flip."
          status: pending
          verifier:
            kind: shell
            command: "grep -q 'never self-certif' skills/core/implement.md &&
              grep -q 'MERGED' skills/core/implement.md && grep -q 'serial'
              skills/shared/mode2-codex-lane.md && grep -q
              'requireDeterministicVerifier' meta/schemas/routing.schema.json"
            expectExitCode: 0
        - id: G-2
          description: "DEFAULT FLIPPED: with routing.json enabled, a spec-ready task
            with a deterministic verifier routes to Codex WITHOUT a
            per-invocation opt-in; the F1 gate is reframed from 'cohesive loses
            quality' to 'not spec-ready ⇒ Opus specs harder or self-implements';
            an ineligible task still falls to Mode 1 with a recorded reason."
          status: pending
          verifier:
            kind: manual
            description: Read implement.md §Mode 2 + mode2-codex-lane.md §1/§3 and confirm
              the default-flip + F1 reframe; confirm routing.json validates and
              enables the lane.
        - id: G-3
          description: "GREEN: npm test + npm run validate-skills + the compatibility
            strip-test all pass after the edits; no host-only term leaks outside
            a Claude-Code conditional."
          status: pending
          verifier:
            kind: test
            runner: node --test
            pattern: tests/
        - id: G-4
          description: Adversarial review (review-plan on this initiative, then
            review-code on the diff) run and its blocker/critical findings
            resolved before the change is considered done.
          status: pending
          verifier:
            kind: manual
            description: Confirm a review-plan + review-code pass exists with zero
              unresolved blocker/critical findings.
    summary: Torna o Codex o implementador padrão (task spec-ready + verificador →
      Codex automático), preservando todas as travas de qualidade.
planActive: true
planTitle: Mode 2 — make Codex the default implementer (Opus plans, Codex executes)
references:
  - kind: repo-path
    label: The execution driver this change rewires (Mode 1 ↔ Mode 2 default)
    path: skills/core/implement.md
  - kind: repo-path
    label: The Mode 2 lane mechanics (enable surface + gate reframed here)
    path: skills/shared/mode2-codex-lane.md
  - kind: repo-path
    label: The routing config schema (enable surface)
    path: meta/schemas/routing.schema.json
  - kind: repo-path
    label: Original Codex-only Mode 2 spec + worth-it verdict this revises
    path: docs/design/project-orchestrator/03-execution-mode2-spec.md
---

# Mode 2 — make Codex the default implementer (Opus plans, Codex executes)

> Standalone initiative — degenerate 1-phase plan (single phase `F0`). The phase
> file under `phases/` holds the real work; this `plan.md` is the layout wrapper.

**Goal:** make the workflow the user wants — **Opus plans, Codex implements** —
the *default* path of the `implement` skill, not an opt-in fenced exception.

## Why this is not a quality loss (the research that justifies it)

The prior Mode 2 spec (`03-execution-mode2-spec.md`) kept Codex execution OFF by
default, citing "split-author loses on cohesive coding" (AkitaOnRails 2026 +
Anthropic orchestrator-worker ~15×). A 2026-06-06 research pass found that claim
is **real but narrow, and over-applied here**:

- The **Anthropic ~15×** finding is about *parallel research subagents
  coordinating in real time* ("LLM agents are not yet great at coordinating and
  delegating to other agents in real time"), **not** a sequential
  Opus-plans → Codex-implements handoff on a fully-specified task. The citation
  does not cover this use case.
- **Spec-Driven Development** literature (arxiv 2602.00180; GitHub Spec Kit / AWS
  Kiro / OpenSpec ecosystem, 2025-2026) finds the opposite for *well-specified*
  work: "human-refined specs significantly improve LLM-generated code quality,
  with controlled studies showing error reductions of up to 50%." A complete
  spec **eliminates the ambiguity that forces the implementer to guess** — which
  is exactly the failure mode the loss-claim describes.
- **Planner/Executor** separation (Plan-and-Act, arxiv 2503.09572) *improves*
  quality by removing the cognitive load of planning-while-coding; the executor
  can legitimately be a different model.

**The reconciliation:** quality is carried by the SPEC + the VERIFIER, not by the
identity of the implementer. The cost does not vanish — it *moves* from
implementation effort to (a) specification completeness and (b) verifier
trustworthiness. So Codex-as-default is safe **iff** those two carriers stay
hard. That is the design constraint of this initiative.

## The decision (recorded)

1. **Default flips.** When `routing.json` enables the Codex lane, a task that
   clears the spec-completeness dispatch gate AND carries a deterministic
   `kind:test`/`kind:shell` verifier routes to **Codex by default** — no
   per-invocation opt-in. The operator opts *out* per batch, not in.
2. **F1 is reframed, not removed.** The old F1 ("cohesive ⇒ Mode 1 because
   split-author loses") becomes "**not spec-ready ⇒ Opus specifies it harder or
   implements it directly**". The escape hatch is now about *spec readiness*, a
   property of the task, not a verdict on Codex.
3. **The quality-carriers stay HARD and verbatim** (G-1): spec-completeness gate
   (R-EXEC-43), deterministic verifier (F2), never-self-certify (R-EXEC-28),
   serial merge-back (R-XAGENT-03), verifier-re-run on the MERGED tree
   (R-EXEC-29). The default flip touches *routing*, never *verification*.
4. **The state-tree fence is kept as a principle, narrowed in scope.** Codex
   never writes the durable `.atomic-skills/` project STATE directly — the
   orchestrator (Opus) owns state transitions; Codex works only inside a scoped
   `git worktree` on source files bounded by `scopeBoundary[]`. The
   "throwaway-repo-only, never real work" framing (specific to the past dogfood
   migration window, now closed at F2) is dropped — Codex may implement real
   code tasks; it just never touches project state.
5. **`minBatchTasks` lowered to 1** (was 3). The batch floor was a pure
   worktree/merge *overhead* amortization threshold, never a quality gate;
   "Codex as default" means a single eligible task also routes to it. Raise it
   again if per-task worktree overhead proves not worth it.

## Open knob the user may want to revisit

- `minBatchTasks: 1` trades per-task worktree+merge overhead for "Codex on every
  eligible task". If single-task overhead is annoying, bump it back up.
