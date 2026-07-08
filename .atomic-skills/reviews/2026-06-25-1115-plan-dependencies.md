---
date: 2026-06-25T11:15:29-03:00
topic: plan-dependencies
artifact: .atomic-skills/projects/atomic-skills/plan-dependencies/plan.md
design: .atomic-skills/projects/atomic-skills/plan-dependencies/design.md
skill: review-plan
reviewer: gpt-5-codex
codex_version: codex-cli 0.142.2
final_verdict: needs_changes
resolution: all fixed in plan/design before handoff
counts_final: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 4, emerged: 0}
schema_version: "1.0"
note: "Plan review after materialization. Pass 2 maintained all blind findings; all four findings were resolved in plan/design before handoff."
---

# Cross-Model Review - plan-dependencies

## Pass 1 - Blind

Verdict: needs_changes

Counts: 0 blocker, 0 critical, 4 major, 0 minor, 0 nit.

Summary: the phase ordering was viable, but core implementation contracts were
underspecified: persisted dependency edge shape, validation before dashboard
emission, archived prerequisite release semantics, and explicit dependency
mutation workflow.

### F-001 [major] dependsOnPlans contract missing

`dependsOnPlans[]` was introduced as the canonical persisted edge without the
entry schema, required keys, allowed values, duplicate semantics, or origin
payload.

Impact: F0, F1, and F2 could implement incompatible object shapes and break the
aiDeck/schema boundary.

Disposition: fixed.

### F-002 [major] graph validation not required before emission

The plan promised invalid dependency graphs would be blocked before dashboard
display, but no F2/F3 task required emitter/dashboard routes to invoke the F0
graph validation before writing or consuming aiDeck state.

Impact: direct `emit-consumer-state` runs could publish orphan, self-edge, cycle,
or cross-project plan edges into `.aideck/state`.

Disposition: fixed.

### F-003 [major] archived release semantics unsafe

`archived` was treated as a releasing terminal state, conflating completed
prerequisites with abandoned or removed work.

Impact: a blocked plan could become released after its prerequisite child was
archived without completed deliverables.

Disposition: fixed.

### F-004 [major] explicit dependency mutation path missing

The only planned mutation path for `dependsOnPlans[]` was the `fork-plan`
default, with no command or validated workflow for explicit dependencies between
existing plans or non-default direction cases.

Impact: operators would have to hand-edit frontmatter and bypass the idempotent
writer.

Disposition: fixed.

## Pass 2 - Informed

Verdict: needs_changes

Counts: 0 blocker, 0 critical, 4 major, 0 minor, 0 nit.

Pass 2 kept all blind findings and added no new findings from the revealed
constraints.

Maintained:

- F-001-blind -> F-001-final [major]
- F-002-blind -> F-002-final [major]
- F-003-blind -> F-003-final [major]
- F-004-blind -> F-004-final [major]

Dropped: none.

Emerged: none.

Non-finding question applied: `design.md` was added to `references[]`.

## Fix Log

- F-001: added the exact `dependsOnPlans[]` contract to the plan body and made F0
  require schema/helper coverage for exact shape, dedupe, origin, release
  semantics, and legacy omission.
- F-002: added F2/T2.1 acceptance requiring `emit-consumer-state` to fail before
  writing `planEdges` when graph fixtures are invalid.
- F-003: changed release semantics so `done` releases automatically and
  `archived` blocks by default unless the edge has explicit archived resolution
  and a recorded reason.
- F-004: added F1/T1.4 for `project depend` add/remove/list/resolve, including
  existing-plan dependencies and explicit archived resolution.
- Question: added the plan design file to `references[]`.

## Post-Fix Validation

- `rtk node scripts/lint-design.js .atomic-skills/projects/atomic-skills/plan-dependencies/design.md --migration`
- `rtk rg -n "\b(should|probably|may|typically|usually|I think|it seems|in theory|tends to)\b" .atomic-skills/projects/atomic-skills/plan-dependencies/design.md .atomic-skills/projects/atomic-skills/plan-dependencies/plan.md .atomic-skills/projects/atomic-skills/plan-dependencies/phases`
- `rtk node scripts/validate-state.js .atomic-skills/projects/atomic-skills/plan-dependencies/plan.md .atomic-skills/projects/atomic-skills/plan-dependencies/phases/f0-modelo-e-grafo-canonico.md .atomic-skills/projects/atomic-skills/plan-dependencies/phases/f1-acoplamento-com-planos-emergidos.md .atomic-skills/projects/atomic-skills/plan-dependencies/phases/f2-projecao-aideck-e-api-de-dependencias.md .atomic-skills/projects/atomic-skills/plan-dependencies/phases/f3-dashboard-caminho-de-execucao.md`
- `rtk node scripts/find-missing-summaries.js .atomic-skills/projects/atomic-skills/plan-dependencies`
- `rtk node scripts/find-missing-task-summaries.js .atomic-skills/projects/atomic-skills/plan-dependencies`
- `rtk node scripts/find-unweighted-tasks.js .atomic-skills/projects/atomic-skills/plan-dependencies`
- `rtk node scripts/find-signalless-tasks.js .atomic-skills/projects/atomic-skills/plan-dependencies`
