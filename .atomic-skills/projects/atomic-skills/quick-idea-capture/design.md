# Design — Quick Idea Capture

> DESIGN front-half produced interactively in session "save-quick-idea" (2026-06-09).
> The divergence (jsonl vs markdown storage, capture-intelligence modes, promotion
> coupling) happened in conversation and converged with the user before this file.
> This file is the committed DESIGN artifact the PLAN precondition (R-ORCH-09) requires.

## Context

While implementing something, an idea for an adjustment or a new feature surfaces.
Until now there was no cheap place to drop it. The workaround — asking the `project`
skill to create a standalone initiative per idea — has two concrete costs: it burns
tokens (the `new initiative` flow resolves project-id, asks several questions,
synthesizes a degenerate plan, runs detect-scope, validates schema), and it pollutes
project control with loose initiatives the user later cannot interpret. The need is an
idea inbox: register an idea in seconds, near-zero token, retrievable later, without it
becoming a first-class tracked unit until the user decides to act on it.

## Decisions

- **D1 — Trigger.** A new subcommand of the existing `project` skill: `/atomic-skills:project idea`. Triage/promotion live in the same skill (`idea list`, `idea promote <n>`). Not a separate top-level skill — keeps the surface coherent with `new`/`park`/`status`.
- **D2 — Capture is a two-mode fork, chosen per idea.** Invoking `idea` first asks "Analisar a proposta" or "Só salvar". **Só salvar**: collect title + description, then a deterministic `node scripts/idea-add.js` append (no analysis, no questions beyond title/desc, ~0 model token). **Analisar**: collect title + description, run a LIGHT project analysis (read PROJECT-STATUS.md + memory, not a deep scan), ask clarifying questions to validate understanding and bound scope, then save the refined idea. The user pays tokens only when they opt into Analisar.
- **D3 — Storage is one human-readable markdown file.** `.atomic-skills/projects/<project-id>/ideas.md` (per-project, flat fallback `.atomic-skills/ideas.md`). NOT jsonl — the only jsonl in the tree is the aiDeck machine-to-machine intent log; ideas are human-facing (the user re-reads them), so they follow the repo's markdown+frontmatter ethos. A single scannable file ("open one file, see all ideas"), each idea a short section with a meta line carrying id, date, branch, and status.
- **D4 — No ratify gate at capture.** Raw ideas enter ungated. The schema-enforced `context` block (solves/trigger/assumesStillValid) that `parked[]`/`emerged[]` require is exactly the token cost to avoid at capture. Discipline is applied on the way OUT (promotion), not on the way IN.
- **D5 — Promotion is always a separate step.** Neither capture mode materializes work. `idea promote <n>` extracts an idea and routes it through the EXISTING emergence ladder (park / new-task / new initiative / new plan) with the ratify gate, then marks the idea `triaged→<target>` (kept for audit, never deleted). Capture and execution stay decoupled — an idea never becomes a commitment without an explicit decision.
- **D6 — Dashboard integration is deferred (phase 2).** MVP ships capture + store + `idea list` + `idea promote` via terminal. A dashboard "💡 Ideas: N" card reading `ideas.md` is a later phase, out of scope for F0/F1.
- **D7 — Inbox does NOT replace park/emerge.** `park`/`emerge` remain the path for work that anchors to the active initiative and is ratified now. The idea inbox is the ungated front door for project-wide ideas with no active anchor; promotion feeds INTO park/emerge.

## Chosen approach

Two phases, additive only (no change to `decompose.js`, schemas, or the plan/initiative
model):

- **F0 — Cheap capture (the inbox MVP).** A deterministic `scripts/idea-add.js` that
  resolves and appends to `ideas.md` (creates it with a header when absent, assigns the
  next incremental id, stamps date/branch/status:pending). A new lazy detail file
  `skills/shared/project-assets/project-idea.md` holding the two-mode capture fork and
  `idea list`. Router wiring in `skills/core/project.md` (grammar + dispatch row + a
  zero-token `IDEAS N pending` line in the no-args summary), plus install/uninstall
  parity for the new asset (enforced by the existing roundtrip test).
- **F1 — Promotion via the emergence ladder.** Extend `project-idea.md` + the router with
  `idea promote <n>`, which extracts the chosen idea, routes it through
  `project-emergence.md` (ratify gate reused, not reinvented), and flips the idea's meta
  line to `triaged→<target>` via a small deterministic `scripts/idea-mark.js`.

The split keeps the load-bearing guarantee — cheap capture — in F0, and isolates the
heavier ladder reuse in F1. The store stays lightweight; full structured frontmatter
(context, tasks, verifiers) only ever appears AFTER promotion, inside the real initiative
model.

## Non-goals

- No dashboard panel in F0/F1 (D6).
- No new schema keys and no change to `src/decompose.js` or `meta/schemas/` — `ideas.md`
  is outside schema-validated state.
- No automatic promotion — `Só salvar` never promotes; `Analisar` never promotes (D5).
- No replacement of `park`/`emerge` (D7).

## Open implementation notes (resolved during F0, not blockers)

- **Script distribution.** `idea-add.js`/`idea-mark.js` must reach an installed repo the
  same way the existing `scripts/*.js` the skills already call (`detect-completion.js`
  etc.) do — confirm and reuse that mechanism during T-001.
- **ideas.md path resolution.** `idea-add.js` resolves the target the same way the skill
  does: single `projects/*/` → use it; multiple → require `--project-id`; none → repo
  basename.
