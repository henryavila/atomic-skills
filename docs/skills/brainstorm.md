# `atomic-skills:brainstorm` — Divergent DESIGN front-half

> **Iron Law:** `NO PLAN WITHOUT AN APPROVED DESIGN.`

**Diverge, decide, then write a critic-gated design.md before any plan**

The failure this prevents is premature convergence — locking onto the first workable approach and writing it up as "the design". `brainstorm` widens before it narrows: it frames the real forks, diverges via a gate-mode debate panel (only when the decision is expensive-to-reverse), lets the user ratify, writes a sectioned `design.md`, and gates it with a fresh independent critic — never panel consensus. PLAN refuses to start without that approved, lint-clean design.

## Purpose

Drive an open idea to a committed, section-linted, critic-approved design.md — diverging across real alternatives before converging — so the plan that follows is built on a deliberate decision, not the first approach that happened to work. The head of the lifecycle chain that `project new plan` decomposes.

## Usage

**When to use:**
- Starting a multi-phase plan whose approach is not yet decided
- There are ≥2 viable approaches and the decision is expensive to reverse
- You need a committed design.md before decomposing into tasks

**When NOT to use:**
- An ad-hoc or single-task change (triage exempts it from DESIGN)
- The design is already committed and critic-approved
- You only need divergent perspectives, not a committed artifact (use debate)

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
