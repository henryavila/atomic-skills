# Design — Implement phase agents (host-thin automate)

## Context

`implement --mode=automate` (plan `implementation-automate-mode`, archived) already ships pure-maestro Steps A–I: one code-only phase writer, claim report, post-merge re-verify, evaluation agent, phase-done `review-code --mode=both`, plan-end `external-both` + `userValidationOk`. Machine STOP helpers live in `src/automate-orchestrator-gates.js` and `scripts/assert-automate-gate.js` (hardened further by `automate-skill-discipline`).

Dogfood on `curta` / `memory-first-generation` (2026-07-22) showed the **operator contract failed** even when product coding was mostly outsourced:

1. The **host session burned context** running product diagnostics, long pytest loops, ad-hoc YAML `done`/`phase-done`, fix orchestration, and review close — so the host *felt* like the implementer.
2. After F1 `phase-done`, F2 stayed **descriptor-only**; the skill HARD-refused correctly, but did **not** run a clear operator ritual: *pause → materialize/BI → next phase agent*.
3. Phase agents (and the host) made **load-bearing decisions** (timeouts, baseline fallbacks, review dispositions, delegated manual PASS) that were only partially logged; there is **no mandatory manual hardgate** that forces the user to accept those decisions before the phase is human-closed.

Operator intent (ratified in conversation, 2026-07-22):

- Skill implements each phase in an **agent** without consuming the current host context.
- **Stopping at the start of each phase** so the user validates materialize + `businessIntent` is **desired**, not a defect.
- Decisions the skill/agent takes must be **saved** for user review.
- **Review of decisions is a mandatory manual hardgate** (agent never writes PASS).

This design supersedes the informal memory note that told maestro to “not hand off materialize” as full-plan unattended flow. Materialize + BI remain **operator authority** at every phase start under automate.

verified_by: conversation audit path
`.worktrees/memory-first-generation` is product repo; skill ground truth is this monorepo’s `skills/core/implement.md` + `skills/shared/implement-automate-maestro.md` + `docs/kb/automate-orchestrator-realism.md`.

## Decisions

1. **Host-thin automate (role fence).** Under `executionMode: automate` / `--mode=automate`, the host session is a **thin dispatcher**: resolve plan/worktree, stamp mode, spawn phase agent(s), sync-wait, merge (git-ops only), run **verbatim** task/exit-gate verifiers for close authority, stamp durable state via thin CLI or documented transition helpers, and surface hardgates. The host **must not** edit product source and **must not** run product entrypoints for diagnostics (compose, build_edl, app servers) except the **exact** verifier commands admitted on tasks/exit gates. Diagnostics belong in a code-only fix-agent brief.

2. **One phase agent per phase, fresh context.** Each phase’s implementation work runs in a **spawned agent** with a constructed brief (work-order only — no host chat history). The next phase uses a **new** agent after the boundary ritual. The host session does not “continue coding/closing” as a mega-session that re-implements the whole A–I close loop in narrative bulk; it re-enters from durable handoff + nextAction.

3. **Phase-start pause is intentional.** Automate **does not auto-materialize**. If the active (or successor) phase is descriptor-only, the skill **stops** with a single operator-facing message: run `project materialize <phase>` and ratify `businessIntent`. After materialize, the operator re-invokes implement (or confirms continue) and the host spawns the **next** phase agent. This matches lazy materialization (`docs/kb/project-lazy-materialization.md`) and operator authority over spine fields.

4. **Durable decision log (per phase).** Every load-bearing decision during automate for a phase is appended to a **durable** artifact under the plan tree (path fixed in implementation; default: `.atomic-skills/projects/<id>/<slug>/decisions/<phaseId>.md` or equivalent schema-backed block). Categories include at least: routing (re-dispatch/stop), product/eng tradeoffs, review dispositions (`accept`/`defer`/`fix`), scopeBoundary exits, manual-gate delegation, verifier environment choices. Chat-only decisions do not count.

5. **Decision-review hardgate is manual and mandatory under automate.** After phase tasks + machine evaluation/review gates are green, `phase-done` (or an explicit preflight before advance) **HARD-BLOCKS** until the operator records **PASS** on the phase decision log (same ownership spirit as plan principle “only Henry writes PASS” on product manual gates). The agent/host **never** auto-writes decision-review PASS. FAIL reopens or parks until addressed. This gate is **distinct** from product exit gates (metrics/UX) and from `review-code` / evaluation agent.

6. **Keep existing machine gates; add the human decision layer.** Do not remove evaluation agent, `evaluationGate`, phase `review-code --mode=both`, lessons distill, writer lease, claim reachability, or plan-end `external-both` + `userValidationOk`. Decision-review is an **additional** phase-close requirement under automate, not a replacement.

7. **Extend existing skill surface — no new top-level skill.** Changes land in `skills/core/implement.md`, `skills/shared/implement-automate-maestro.md`, phase-writer/evaluator/antipatterns assets, `src/automate-orchestrator-gates.js` (and related pure helpers), `scripts/assert-automate-gate.js`, schemas as needed, tests. No `skills/core/automate.md`.

8. **Supersedes UX of v1 pure-maestro, not the machine foundation.** Plan `implementation-automate-mode` (archived) and `automate-skill-discipline` remain the foundation for mode parse, claims, leases, and no-skip machine gates. This plan changes **operator-facing automate UX** and adds decision-review + host-thin fences; it does not rewrite Mode 1 session-writer or Mode 2 Codex lane.

9. **Thin orchestrator transitions preferred.** Prefer CLI/script entrypoints for `done` / decision-log append / decision-review stamp over reimplementing YAML in the host chat (reduces “host looks like implementer”). Full CLI surface may be phased; F0 freezes the contract even if some transitions remain prose+helper until later phases.

10. **Re-dispatch budgets stay explicit.** Max re-dispatch rounds remain bounded; post-review golden fixes use a separate budget class recorded in the decision log — never silent Mode-1 host coding.

## Chosen approach

**Name: Host-thin phase agents + phase-start materialize stop + mandatory decision-review hardgate.**

### Runtime shape

```text
implement --mode=automate
  → host: resolve + stamp + (if descriptor-only) STOP: materialize + BI
  → host: spawn phase agent (fresh) with work-order only
  → agent: code-only (or expanded role if later tasks admit) + append decisions to durable log
  → host: merge → re-verify verifiers → orchestrator done (thin)
  → host: evaluation + review-code both (existing)
  → HARDGATE: operator reviews decisions log → PASS only human
  → phase-done
  → if next phase descriptor-only: STOP with nextAction materialize
  → after materialize: spawn NEW phase agent (fresh context)
```

### Approaches weighed

| Approach | Verdict |
|----------|---------|
| **A. Host-thin + agent-per-phase + decision-review hardgate** | **Chosen** — matches operator intent; keeps lazy BI authority; auditable decisions |
| **B. Keep host-fat pure-maestro (v1)** | Rejected — dogfood proved role collapse and context burn |
| **C. Full unattended multi-phase daemon (Layer 4)** | Rejected for this plan — multi-month; fights multi-host model (`automate-orchestrator-realism.md`); operator wants phase-start pauses |
| **D. Auto-materialize with LLM-filled BI** | Rejected — spine is operator authority; lazy materialization constitution |

## Non-goals

- Full maestro daemon / cross-host spawn supervisor (Layer 4).
- Making automate the default for all plans.
- Auto-materialize or LLM-authored `businessIntent` PASS.
- Changing Mode 1 session-writer or Mode 2 Codex lane contracts.
- Product work in consumer repos (`curta`, etc.) as part of this plan.
- Replacing product manual gates (e.g. G1-M metrics) with decision-review alone.

## Open questions

1. Exact on-disk schema for decision entries (markdown-only vs schema JSON frontmatter) — decide in F1 with validate-state impact measured.
2. Whether decision-review PASS lives as `phases[].decisionReview` on plan frontmatter, a sibling file under `decisions/`, or gate-signoff-style file — pick one in F1; preflight must be machine-checkable.
3. How far “thin CLI” for `done` goes in this plan vs deferring to a follow-up — F0/F2 may keep helper scripts + prose if full CLI is oversized.

## Rejected alternatives

- **Host continues mega-session A–I with role banner only** — UX cosmetic; does not free context or force decision audit.
- **Decision log only at plan-end (`userValidationOk`)** — too late; phase-local decisions must be accepted before advance.
- **Evaluator agent writes decision PASS** — violates “only human writes PASS” for this hardgate.
- **Materialize auto-run from descriptor `.source.json` without operator** — invents BI; forbidden by lazy materialization design.

## Self-review against code-quality gates

- G1 read-before-claim: applied — ground truth cited: implement maestro assets, automate-orchestrator-realism, prior plans implementation-automate-mode / automate-skill-discipline, dogfood memory note.
- G2 soft-language: applied — scanned; requirements use must/HARD-BLOCK language.
- G6 reference-or-strike: applied — behavioral claims tied to existing paths or marked as new work in this plan’s phases.
