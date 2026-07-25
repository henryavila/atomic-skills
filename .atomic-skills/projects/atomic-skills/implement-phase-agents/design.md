# Design — Implement phase agents (host-thin automate)

## Context

`implement --mode=automate` (plan `implementation-automate-mode`, archived) already ships pure-maestro Steps A–I: one code-only phase writer, claim report, post-merge re-verify, evaluation agent, phase-done `review-code --mode=both`, plan-end `external-both` + `userValidationOk`. Machine STOP helpers live in `src/automate-orchestrator-gates.js` and `scripts/assert-automate-gate.js` (hardened further by `automate-skill-discipline`).

Dogfood on `curta` / `memory-first-generation` (2026-07-22) showed the **operator contract failed** even when product coding was mostly outsourced:

1. The **host session burned context** running product diagnostics, long pytest loops, ad-hoc YAML `done`/`phase-done`, fix orchestration, and review close — so the host *felt* like the implementer.
2. After F1 `phase-done`, F2 stayed **descriptor-only**; the skill HARD-refused correctly, but did **not** run a clear operator ritual: *pause → materialize/BI → next phase agent*.
3. Phase agents (and the host) made **load-bearing decisions** (timeouts, baseline fallbacks, review dispositions, delegated manual PASS) that were only partially logged; there is **no mandatory manual hardgate** that forces the user to accept those decisions before the phase is human-closed.

Operator intent (ratified in conversation, 2026-07-22, refined same day):

- Skill implements each phase in an **agent** without consuming the current host context.
- **Stopping at the start of each phase** is desired — but the skill does **not** dump a blank `businessIntent` form on the user.
- At phase start under automate the skill **must present a validation package**:
  1. **Phase objective** (goal / summary from the plan descriptor),
  2. **Task list** (ids + titles that describe what will be done),
  3. A **drafted `businessIntent` spine** (value, workflow, rules, outOfScope, doneWhen) derived from the phase goal + tasks + plan principles.
- **Operator work is validation only:** accept or edit **task names/titles** and the **businessIntent**. The operator does not invent the spine from a blank page; the agent drafts, the operator ratifies (or edits then ratifies). Silent auto-PASS of BI without operator ack is still forbidden.
- Decisions the skill/agent takes during implementation must be **saved** for user review.
- **Review of decisions is a mandatory manual hardgate** at phase end (agent never writes PASS).

This design supersedes the informal memory note that told maestro to “not hand off materialize” as full-plan unattended flow. Phase-start remains a human gate; under automate the skill **prepares** the package (including materialize + draft BI) so the human only validates.

verified_by: conversation audit path
`.worktrees/memory-first-generation` is product repo; skill ground truth is this monorepo’s `skills/core/implement.md` + `skills/shared/implement-automate-maestro.md` + `docs/kb/automate-orchestrator-realism.md`.

## Decisions

1. **Host-thin automate (role fence).** Under `executionMode: automate` / `--mode=automate`, the host session is a **thin dispatcher**: resolve plan/worktree, stamp mode, spawn phase agent(s), sync-wait, merge (git-ops only), run **verbatim** task/exit-gate verifiers for close authority, stamp durable state via thin CLI or documented transition helpers, and surface hardgates. The host **must not** edit product source and **must not** run product entrypoints for diagnostics (compose, build_edl, app servers) except the **exact** verifier commands admitted on tasks/exit gates. Diagnostics belong in a code-only fix-agent brief.

2. **One phase agent per phase, fresh context.** Each phase’s implementation work runs in a **spawned agent** with a constructed brief (work-order only — no host chat history). The next phase uses a **new** agent after the boundary ritual. The host session does not “continue coding/closing” as a mega-session that re-implements the whole A–I close loop in narrative bulk; it re-enters from durable handoff + nextAction.

3. **Phase-start validation package (draft → human ratify).** Before spawning the phase agent for a phase under automate, the skill **stops** and presents one package:
   - phase objective (goal/summary),
   - task list (id + title; titles must describe the work),
   - **drafted** `businessIntent` spine for the phase.
   If the phase is still descriptor-only, the skill **orchestrates materialize** (writes initiative from sidecar + attaches the draft BI) as part of preparing that package — it does **not** tell the user “go create businessIntent yourself.” The operator’s only required work is **validate or edit** task titles and the BI, then explicit ratify (not a generic “ok”). After ratify, the host spawns a **fresh** phase agent. Auto-stamping BI as PASS without ratify remains forbidden (`find-weak-business-intent` / proof-of-work still apply to quality).

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
  → host: resolve + stamp
  → phase-start package (every phase, before spawn):
       if descriptor-only → materialize from sidecar
       present: phase objective + task list (id, title) + DRAFTED businessIntent
       STOP for operator: validate/edit task titles + BI → explicit ratify
  → host: spawn phase agent (fresh) with ratified work-order only
  → agent: code-only + append decisions to durable log
  → host: merge → re-verify verifiers → orchestrator done (thin)
  → host: evaluation + review-code both (existing)
  → HARDGATE: operator reviews decisions log → PASS only human
  → phase-done
  → next phase: repeat phase-start package with NEW agent (never blank BI form)
```

### Approaches weighed

| Approach | Verdict |
|----------|---------|
| **A. Host-thin + agent-per-phase + draft-BI phase-start package + decision-review hardgate** | **Chosen** — agent drafts objective/tasks/BI; operator only validates; decisions audited at end |
| **B. Keep host-fat pure-maestro (v1)** | Rejected — dogfood proved role collapse and context burn |
| **C. Full unattended multi-phase daemon (Layer 4)** | Rejected for this plan — multi-month; fights multi-host model (`automate-orchestrator-realism.md`); operator wants phase-start pauses |
| **D. Silent auto-PASS of LLM-filled BI without ratify** | Rejected — operator remains authority; draft ≠ PASS |
| **E. Stop and force operator to blank-fill BI / invent tasks** | Rejected — operator work must be validation of names + BI, not authoring from scratch |

## Non-goals

- Full maestro daemon / cross-host spawn supervisor (Layer 4).
- Making automate the default for all plans.
- Silent auto-PASS of drafted `businessIntent` without operator ratify (draft + present is in scope; PASS without ack is not).
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
- **Blank-form phase start (“you fill businessIntent”)** — wrong operator load; skill must draft objective + tasks + BI for validation.
- **Silent auto-PASS of drafted BI** — draft is allowed; PASS without explicit ratify is not.

## Self-review against code-quality gates

- G1 read-before-claim: applied — ground truth cited: implement maestro assets, automate-orchestrator-realism, prior plans implementation-automate-mode / automate-skill-discipline, dogfood memory note.
- G2 soft-language: applied — scanned; requirements use must/HARD-BLOCK language.
- G6 reference-or-strike: applied — behavioral claims tied to existing paths or marked as new work in this plan’s phases.
