# `atomic-skills:brainstorm` — Divergent DESIGN front-half

> **Iron Law:** `NO PLAN WITHOUT AN APPROVED DESIGN.`

**Interview, research, debate --gate, then critic-gated design.md**

The failure this prevents is premature convergence — locking onto the first workable approach and writing it up as "the design". `brainstorm` widens before it narrows: it runs a user **Interview**, a repo **research-digest**, always invokes `atomic-skills:debate --gate`, lets the user ratify, writes a sectioned `design.md`, and gates it with `lint-design` plus a fresh independent critic — never panel consensus. Detail lives in `skills/shared/brainstorm-assets/`. PLAN refuses to start without that approved, lint-clean design.

## Purpose

Drive an open idea to a committed, section-linted, critic-approved design.md — diverging across real alternatives before converging — so the plan that follows is built on a deliberate decision, not the first approach that happened to work. Multi-phase always runs B0 Interview → B0b research-digest → B1 `debate --gate` → B2 user ratify → B3 write + `lint-design` → B4 critic → B5 handoff (no skip ladder; assets under `brainstorm-assets/`). The head of the lifecycle chain that `project new plan` decomposes.

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
