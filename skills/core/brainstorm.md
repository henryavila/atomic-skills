Turn an open idea into a committed, approved **design doc** — the divergent front-half of DESIGN. You interview the user, research the repo into a digest, always run `atomic-skills:debate --gate`, let the user ratify, write `design.md`, and have an independent critic gate it before any plan is written. brainstorm is the head of the lifecycle chain: its output is exactly the input `project new plan` decomposes.

If {{ARG_VAR}} was provided, use it as the project goal / problem statement. If not, ask the user: "What are we designing? State the problem and the goal in one or two sentences." Then ask for the `<project-id>` and `<plan-slug>` this design belongs to (the design doc lands at `projects/<project-id>/<plan-slug>/design.md`).

## Iron Law

NO PLAN WITHOUT AN APPROVED DESIGN.

Do not hand off to `project new plan`, and do not author any plan/source markdown, until a `design.md` exists, has passed the section lint, the critic has returned **Approved**, AND the user has explicitly approved it. A design the panel liked is not an approved design — approval is the critic verdict plus the user's word, never panel agreement.

**Multi-phase always runs the full process:** B0 Interview → B0b research-digest → B1 `debate --gate` → B2 user ratify → B3 write → B4 critic → B5 handoff. There is no skip ladder. Ad-hoc / single-task / `adopt` are DESIGN-exempt (R-ORCH-03) and never force this path.

<HARD-GATE>
Do NOT invoke any implementation or plan-authoring skill until you have presented a design and the user has approved it. (rented verbatim from T02 — docs/kb/analise-superpowers-v5.0.5.md:58-71)
If you are about to skip the critic ("the design is obviously fine"): STOP. The critic is the gate; an unchecked design is an opinion.
If you are about to skip Interview, research-digest, or debate because "one approach is obvious": STOP. Multi-phase always runs them.
</HARD-GATE>

## Mindset

You are widening before you narrow. The failure this skill exists to prevent is **premature convergence** — locking onto the first workable approach and writing it up as "the design", so the option that was never voiced is the one that would have been right. Interview and diverge first, decide second (the user ratifies), write third, gate fourth.

Separate WHAT/WHY from HOW. The design records the **decisions** (what we are building and why) and the **chosen approach** (how, with the alternatives that were weighed and rejected). It is not a task list and not code — those come downstream, from the decompose step that consumes this doc.

The gate is a critic, not the room. A panel that agrees can be a panel that conformed; consensus is a measure of perspective-spread, not of artifact-completeness. So the binary verdict comes from a separate fresh critic that checks the doc against evidence — never from "everyone liked it."

## Process

Keep this body thin. Detail lives in `skills/shared/brainstorm-assets/` — {{READ_TOOL}} each file when you hit that step.

### B0 — Interview (HARD)

{{READ_TOOL}} `skills/shared/brainstorm-assets/interview.md`.

Before research and before debate: run the **Interview / entrevista** (HALT questions: problem, in-scope, out-of-scope, done-when, stakes, sources). Echo a spine and require explicit ratify. Bare `ok`/`yes` without a spine is not acceptance. Stamp `interviewAccepted` on the process receipt when ratified. Do **not** invent the frame alone from the goal arg.

### B0b — Research digest (HARD)

{{READ_TOOL}} `skills/shared/brainstorm-assets/research.md`.

Produce `projects/<project-id>/<plan-slug>/research-digest.md` (repo-only; **no web**). ≥1 research pass; weak if zero paths, fewer than 3 useful bullets, or filler. A weak/empty digest blocks B1.

### B1 — Diverge (always `debate --gate`)

**Always** invoke `atomic-skills:debate --gate` for multi-phase DESIGN, with B0 decision forks as the bounded agenda. Default 3 heterogeneous voices and a **mandatory contrarian** every round. The panel is the ACTOR — it produces divergence and a machine-readable Synthesis verdict; **it does not decide**. Present every voice unblended (debate's Iron Law).

Anti-theater: if ≥2 approaches were framed, require ≥1 `Rejected alternatives` entry or non-empty `dissent[]`; if a single approach remains, still run the contrarian and record `single_approach: true` plus the objection.

### B2 — Decide (the user ratifies)

Produce an Orchestrator Synthesis of the panel: the recommended direction as a concrete decision, the 2–3 load-bearing reasons attributed to the voices that made them, and the dissent preserved verbatim. Then ask the user to ratify. **The user decides, not the panel.** Every approach weighed and not chosen becomes a `Rejected alternatives` entry — dissent is recorded, not smoothed over.

### B3 — Write the design doc

Write `projects/<project-id>/<plan-slug>/design.md` with the sections in **The design doc** below (include `## Interview` from B0), then commit it (canonical tracked artifact, unlike throwaway `source.md`). Run the section lint before going further:

```bash
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/lint-design.js" projects/<project-id>/<plan-slug>/design.md
# add --migration when any decision is a one-way door (requires the Blast radius section)
```

A non-zero exit means a required section is missing or empty — fix the doc, do not proceed. This lint is the deterministic, zero-token half of the gate; the critic is the judgment half.

### B4 — Validate (the critic gate)

Invoke the critic per `skills/shared/debate-assets/critic.md` — a **fresh, independent** reviewer (NOT a debate persona, NOT carrying this session's context), tiered by provider (same-provider-fresh where the host isolates it, codex critic where it does not, solo-advisory only as honest degradation). The critic reads `design.md` against the evidence and emits the codex-shaped verdict block; the gate reads its binary collapse:

- **Approved** (`approve`/`approve_with_nits`, zero blocker/critical) → proceed to B5.
- **Issues-Found** (`needs_changes`/`reject`, or any blocker/critical) → address the findings, rewrite `design.md`, re-run the critic. **Ceiling: 3 critic rounds.** If still Issues-Found after the 3rd, STOP and escalate to the user — never iterate a 4th time, never silently advance on an un-Approved design.

### B5 — Handoff

{{READ_TOOL}} `skills/shared/brainstorm-assets/process-receipt.md` and write/update `.atomic-skills/status/design-gates/<projectId>-<slug>.json` so Interview, digest, debate, critic, and user approval are recorded (`status: ready` only when complete). Helpers: `scripts/design-gates.js`.

**HARD-BLOCK before handoff** — refuse to hand off to `project new plan` unless the process receipt is ready and the design is not weak:

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
DESIGN_MD="projects/<project-id>/<plan-slug>/design.md"
DIGEST_MD="projects/<project-id>/<plan-slug>/research-digest.md"
DESIGN_GATE=".atomic-skills/status/design-gates/<projectId>-<slug>.json"

node "$PKG_ROOT/scripts/lint-design.js" "$DESIGN_MD"
node "$PKG_ROOT/scripts/find-missing-design-process.js" "$DESIGN_GATE"
node "$PKG_ROOT/scripts/find-weak-design.js" "$DESIGN_MD" "$DIGEST_MD"
# optional: node "$PKG_ROOT/scripts/design-gates.js" ready . <projectId> <slug>
```

Any non-zero exit **HARD-BLOCKS** handoff — fix Interview/debate/digest/critic/user approval or rewrite weak sections; do not announce handoff on a partial receipt. Ad-hoc / single-task / `adopt` never take this multi-phase path (R-ORCH-03).

Only on critic **Approved** AND explicit user approval AND detectors exit 0: announce the design path, the headline decision, and hand off — `atomic-skills:project new plan <plan-slug>` consumes the approved `design.md` as its source-of-truth for the PLAN stage. brainstorm's job ends here; it never writes the plan itself.

## The design doc

`design.md` is committed markdown (no frontmatter required). These sections are mandatory and enforced by `scripts/lint-design.js` (and expanding toward Interview / Context / Non-goals as required):

- `## Decisions` — WHAT we are building and WHY, as concrete decisions (not a wish-list). **(lint-required)**
- `## Chosen approach` — HOW, naming the approaches that were weighed and the recommendation that won. **(lint-required)**
- `## Blast radius` — for any one-way-door / migration decision: what is expensive-to-reverse and the containment. **(lint-required when `--migration`)**

Plus, for a usable design: `## Interview` (ratified B0 spine), `## Context` (why this exists), `## Non-goals` (what this explicitly is not), `## Open questions` (what the design could not resolve + what evidence would), and `## Rejected alternatives` (the dissent from B2, preserved). Every required section must carry real content — a header over a `TODO`/`TBD`/`REPLACE_*` placeholder fails the lint.

## Cross-agent note

The panel and critic are dispatched as {{INVESTIGATOR_TOOL}} subagents and verdicts pass through durable text (the committed `design.md` and the critic's verdict block) — no host-orchestration tooling drives the spine, so it runs identically on every IDE. Where the host cannot guarantee a fresh isolated subagent (the investigator tool is read-only), the critic falls back to the codex bridge per `critic.md`.

{{#if ide.claude-code}}
Optional accelerator (Claude Code): fan the panel + critic out in parallel natively.
{{/if}}

## Code-quality gates

This flow is bound by `docs/kb/code-quality-gates.md` — it applies **G1** (read-before-claim), **G2** (soft-language ban), and **G6** (reference-or-strike). See the KB for the definitions + good/bad examples; the self-review block below is where they shape `design.md`.

## Self-review against gates

Before declaring the design ready, append a `## Self-review against code-quality gates` block to `design.md`:

```
- G1 read-before-claim: applied — <claims about existing code, each with pasted source lines> / not-applicable — <entirely new work>
- G2 soft-language: applied — scanned for the ban list, <N> rewritten / 0 occurrences
- G6 reference-or-strike: applied — <K> assertions, each carries verified_by/unverified
```

Silent application is forbidden; the checkpoint ships in the committed doc.

## Red Flags

- "There's clearly one right approach, I'll just write it up." → That is premature convergence. Still run Interview, research-digest, and `debate --gate`; the contrarian must still speak.
- "I'll skip the Interview — the goal arg is enough." → Interview is HARD. Bare goal text is not a ratified spine.
- "Research digest can be empty / one filler bullet — we already know the code." → Empty or weak digest fails B0b. ≥3 useful bullets and ≥1 repo path.
- "I'll run the panel and whatever it agrees on is the design." → Panel consensus is not the gate. The user ratifies (B2); the critic decides (B4).
- "Let me sketch the tasks while I design." → WHAT/WHY before HOW-as-tasks. The design records decisions + chosen approach; the task list is downstream, from decompose.
- "The design is obviously fine; I'll skip the critic." → An unchecked design is an opinion. The critic is the gate.
- "Three critic rounds and still Issues-Found — one more pass will land it." → No. Ceiling is 3; the 4th pass is the signal to escalate to the user, not to grind.
- "The panel split, I'll just pick one and not mention the other." → Dissent is preserved as a Rejected-alternatives entry, never smoothed over.
- "design.md is approved, I'll write the plan here to save a step." → brainstorm hands off to `project new plan`; it never authors the plan itself.
- "We aligned on A yesterday / the lead prefers it — I'll just document it cleanly." → Prior alignment is not evidence A is right. Still Interview, research, and debate; if a sharper alternative surfaces, escalate it.
- "I'll write the one approach plus a throwaway 'considered X, rejected as non-scalable' line to look like I compared." → Fabricated Rejected-alternative is fake rigor. Record only comparisons that actually happened.
- "The user said skip the design doc, so I'll dump the task list and document the decisions later." → "Skip the doc" ≠ "skip the decisions." Write Decisions + Chosen approach first, then derive tasks.
- "The critic is slow / the user didn't ask for it / I'll self-review and run it later." → None of those is a reason. Run the critic before declaring the design done.

If you thought any of the above: STOP. Go back to the phase you were skipping.

## Closing

Output of a clean run: a committed `projects/<id>/<slug>/design.md` (lint-clean, gates self-reviewed), `research-digest.md`, design-gates receipt with `interviewAccepted`, a critic **Approved** verdict, the user's explicit approval, and a handoff line to `atomic-skills:project new plan <slug>`. Nothing downstream of the design is brainstorm's to write.
