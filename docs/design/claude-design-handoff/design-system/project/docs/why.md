# Why aiDeck exists

This document is the load-bearing context. Read it before doing anything else. Without understanding why aiDeck was conceived, you will build the wrong thing.

## The triggering problem

In May 2026, the user observed a specific failure mode in the `atomic-skills:project-status` skill while working on `sda-v2` — a Laravel + Nuxt SaaS project.

In a single session (~15 message exchanges), the user and AI assistant produced:
- **843 lines** of structured planning document
- **9 phases** with goals, dependencies, exit gates
- **61 sub-phases** with descriptions and verifiers
- Principles, glossary, references — a complete redesign plan

The `project-status` skill was **never invoked** during this work.

### Why this is bad

The skill was installed and configured. The user had it set up specifically to "never lose track of where I am". And yet:

1. The skill has a `HARD-GATE` that requires anchoring to an initiative before code changes. But the gate's scope was "source code". The plan was written to `docs/superpowers/plans/v3-redesign/` — not source code. Gate didn't fire.
2. The skill has a `bootstrap` mode that scans for in-flight work. But `bootstrap` only runs when invoked. No automatic trigger.
3. The skill's `new <slug>` flow creates an initiative with `tasks: {}` empty. There's no mechanism to decompose a structured plan into pre-populated tasks.
4. After the plan was created, the user had:
   - **843 lines of plan structure outside the skill**
   - **Empty `.atomic-skills/initiatives/`**
   - A migration cost: redistribute 843 lines into 9 initiatives manually

The full feedback document is at `/Volumes/External/code/sda-v2/feedback/atomic-skills-project-status-2026-05-19.md`. Key conclusions:

> A skill that's "deliberately isolated" as a gatekeeper for code changes will be silent during the planning phase that produces the structure those code changes will implement. The mismatch between when the skill enforces (code edit time) and when the work happens (planning time) is foundational.

> Six improvement options were tabled, all with trade-offs. The most strategic was Option E: make the plan live in the skill itself — initiative body IS the plan. Eliminate dual-source.

## The design session

The user and AI then iterated through ~10 design exchanges. Each turn refined the model:

1. **First, considering smaller fixes**: better triggers, HARD-GATE expansion, soft prompts. All were patches.
2. **Then, the structural insight**: project-status is too flat for real multi-phase work. Phases need first-class representation.
3. **Then, the philosophical question**: should the skill stay a "gatekeeper isolated" tool, or become a "GPS structural" tool? The user chose GPS.
4. **Then, the UI question**: terminal output is the wrong medium for a 9×61 hierarchy with cross-references. Need visual.
5. **Then, the architecture question**: build dashboard inside atomic-skills, or as separate runtime? Separate.
6. **Then, the scope question**: is this just for project-status, or for the family of atomic-skills? Family — 7 of 12 skills benefit from rich visualization.
7. **Finally, the product question**: is this a dashboard, or the UI of the ecosystem? The latter. Help page, reviews as HTML, cross-cutting views.

aiDeck is the crystallization of those exchanges.

## What aiDeck IS

A local runtime that:

1. **Watches canonical files** in `.atomic-skills/<consumer>/` — YAML frontmatter + markdown body.
2. **Renders rich visual surfaces** in a browser (Vue 3 dashboard) for the data inside.
3. **Exposes an MCP server** so AI agents read, mutate, annotate, and exchange feedback with humans.
4. **Provides a help page** that surfaces the entire atomic-skills ecosystem to the user.

The dashboard is bidirectional: humans annotate, flag, decide; AI reads those signals via MCP inbox.

The runtime never owns state. Files are canonical. Disabling aiDeck never breaks the project. Re-enabling re-renders without migration.

## What aiDeck IS NOT

- **Not a markdown previewer.** mdprobe exists for that. aiDeck consumes structured data, not arbitrary MD.
- **Not a project management tool.** No "estimate hours", no "assign to Bob", no due-date alerts. The atomic-skills mental model is execution-focused, not management-focused.
- **Not a CI dashboard.** Doesn't surface test runs, build statuses, deploys. Different problem.
- **Not a multi-user collaboration tool.** Local-first. One developer per machine. No accounts, no auth, no cloud sync.
- **Not an LLM playground.** It surfaces work BY AI, but is not itself a place to prompt an LLM.
- **Not a generic "agent observability" framework.** Specific to atomic-skills consumers. Other consumers may integrate later (v0.2+ has a custom-consumer manifest), but aiDeck is opinionated about the data shape.

## Real scale to be supported

The reference test target is **sda-v2 v3-redesign**:

- **1 plan** with 843 lines of narrative, principles, glossary, 8 tracks, dependency graph
- **9 phases** (F0-F8), each with goal + exit gate + audience + 4-12 sub-phases
- **~10 initiatives** (one per phase), each with 5-12 tasks
- **61 sub-phase tasks** total, with cross-references between phases
- **Exit gate verifiers**: shell commands, SQL queries, test patterns, manual approvals
- **External imports**: framework imported from `/Volumes/External/code/arch`
- **Cross-document references**: PRD, RUNBOOK §2-§7, BMAD artifacts, gitignored data dumps
- **Special phases**: F1 has UI Gate (3 viewports + dark + smoke + i18n); F4∥F5 parallel allowed

If aiDeck cannot render this real plan correctly, it has failed. The data shapes, schemas, and UI must accommodate this scale from v0.1.

## Why MCP-first

Three reasons:

1. **AI is the primary user.** The dashboard is for humans, but the actor doing the work is the AI. The AI needs a structured way to read state and announce changes. Free-form file watching is fragile.
2. **Cross-IDE compatibility.** MCP is supported by Claude Code, Cursor, and others. A single MCP server makes aiDeck plug-and-play across editor environments.
3. **Bidirectional channel needs structure.** "Human annotated this task" is a piece of state with a schema. Exposing it via MCP gives AI agents a deterministic way to discover and consume human input.

REST endpoints exist for the browser. They duplicate some MCP functionality. That's accepted because the browser cannot speak MCP and the user experience must not require a separate service.

## Why files canonical

Three reasons:

1. **Resilience.** aiDeck is a development tool that will crash, be killed, change versions, get reinstalled. Each event must NOT corrupt project state. Files survive.
2. **Portability.** Skills must work without aiDeck. Terminal-only, CI, automation, scripted analysis — all need direct file access. Adding aiDeck as a required runtime breaks these.
3. **Audit trail.** Every change is a file change. Git diffs are meaningful. Reviewers can read the state. No opaque DB to inspect.

The cost: aiDeck cannot cache aggressively, must re-parse on file changes, must handle race conditions on concurrent writes. Acceptable trade.

## Why dark-first

Developers work in dark IDEs. Light theme jarring. A dashboard meant to live next to the editor must match. Light mode is a v0.2 addition.

## Why Hono + Vue 3

- **Hono**: tiny (≈2kb), modern, ESM-native, SSE-friendly, Node-friendly. Express is older but heavier. Fastify is fine but overkill. No need for framework breadth.
- **Vue 3 (Composition API + `<script setup>`)**: developer-friendly, well-typed, sane defaults, Vite-native. React is heavier and would invite more abstraction. Svelte is excellent but the user wants Vue.
- **Vite**: HMR pro Vue. Industry standard. No reasonable alternative for a SPA dashboard.

## Anti-goals (do NOT do)

- Do not add a database
- Do not add a cache that's authoritative (caches must be re-derivable from files)
- Do not add cloud sync
- Do not add multi-user authentication
- Do not add telemetry, analytics, or "phone home" version checks
- Do not couple to specific IDE (Claude Code only). MCP makes it agnostic.
- Do not invent new file formats. YAML + Markdown + JSONL. No proprietary serialization.
- Do not exceed v0.1 scope without updating decisions.md and getting user confirmation.

## When this doc is wrong

This document encodes intent at a moment in time. If the user contradicts it, the user wins. Update this doc to match, in a separate commit.

If you find yourself building something that conflicts with this doc and the user hasn't approved the conflict, **stop and ask**.
