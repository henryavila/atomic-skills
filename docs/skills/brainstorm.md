# `atomic-skills:brainstorm` — Divergent DESIGN front-half

> **Iron Law:** `NO PLAN WITHOUT AN APPROVED DESIGN.`

**Interview, research, debate --gate, then write a critic-gated design.md before any plan**

The failure this prevents is premature convergence — locking onto the first workable approach and writing it up as "the design". `brainstorm` widens before it narrows: it runs a user **Interview**, a repo **research-digest**, always invokes `atomic-skills:debate --gate`, lets the user ratify, writes a sectioned `design.md`, and gates it with `lint-design` plus a fresh independent critic — never panel consensus. PLAN refuses to start without that approved, lint-clean design.

## Purpose

Drive an open idea to a committed, section-linted, critic-approved design.md — diverging across real alternatives before converging — so the plan that follows is built on a deliberate decision, not the first approach that happened to work. The head of the lifecycle chain that `project new plan` decomposes.

## Multi-phase flow (always)

| Step | What |
|------|------|
| **B0 Interview** | HALT questions (problem, scope, non-goals, done-when, stakes, sources); ratify spine — detail in `skills/shared/brainstorm-assets/interview.md` |
| **B0b research-digest** | Repo-only digest at `projects/<id>/<slug>/research-digest.md` — `brainstorm-assets/research.md` |
| **B1 debate --gate** | Always for multi-phase; panel is actor, not judge |
| **B2 user ratify** | User decides; dissent → Rejected alternatives |
| **B3 write + lint-design** | `design.md` + `scripts/lint-design.js` |
| **B4 critic** | Independent binary Approved / Issues-Found |
| **B5 handoff** | design-gates receipt + `project new plan` |

Ad-hoc / single-task / `adopt` stay DESIGN-exempt (R-ORCH-03). No skip ladder on multi-phase.

## Usage

**When to use:**
- Starting a multi-phase plan whose approach is not yet decided
- You need a committed design.md before decomposing into tasks
- You want Interview + research + debate recorded before PLAN

**When NOT to use:**
- An ad-hoc or single-task change (triage exempts it from DESIGN)
- The design is already committed and critic-approved
- You only need divergent perspectives, not a committed artifact (use debate)
- Retroactive capture of a pre-lifecycle plan (`project adopt` — no DESIGN gate)

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `goal` | positional | optional | The problem/goal to design. If omitted, the skill asks interactively. |

**Examples:**
- `/atomic-skills:brainstorm "self-host the project lifecycle"` — Run the DESIGN front-half and land a critic-approved design.md
- `/atomic-skills:brainstorm` — Skill asks for the problem, goal, project-id, and slug interactively

## Metadata

**Dependencies:** `git`

**Related:** `debate`, `project`, `review-plan`

**Tags:** `design`, `brainstorming`, `lifecycle`, `core`

**Version added:** `2.2.0`
