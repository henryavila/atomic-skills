Turn an open idea into a committed, approved **design doc** — the divergent front-half of DESIGN. You widen the option space (diverge), drive to a decision the user ratifies, write `design.md`, and have an independent critic gate it before any plan is written. brainstorm is the head of the lifecycle chain: its output is exactly the input `project new plan` decomposes.

If {{ARG_VAR}} was provided, use it as the project goal / problem statement. If not, ask the user: "What are we designing? State the problem and the goal in one or two sentences." Then ask for the `<project-id>` and `<plan-slug>` this design belongs to (the design doc lands at `projects/<project-id>/<plan-slug>/design.md`).

## Iron Law

NO PLAN WITHOUT AN APPROVED DESIGN.

Do not hand off to `project new plan`, and do not author any plan/source markdown, until a `design.md` exists, has passed the section lint, the critic has returned **Approved**, AND the user has explicitly approved it. A design the panel liked is not an approved design — approval is the critic verdict plus the user's word, never panel agreement.

<HARD-GATE>
Do NOT invoke any implementation or plan-authoring skill until you have presented a design and the user has approved it. (rented verbatim from T02 — docs/kb/analise-superpowers-v5.0.5.md:58-71)
If you are about to skip the critic ("the design is obviously fine"): STOP. The critic is the gate; an unchecked design is an opinion.
</HARD-GATE>

## Mindset

You are widening before you narrow. The failure this skill exists to prevent is **premature convergence** — locking onto the first workable approach and writing it up as "the design", so the option that was never voiced is the one that would have been right. Diverge first (real, independent voices), decide second (the user ratifies), write third, gate fourth.

Separate WHAT/WHY from HOW. The design records the **decisions** (what we are building and why) and the **chosen approach** (how, with the alternatives that were weighed and rejected). It is not a task list and not code — those come downstream, from the decompose step that consumes this doc.

The gate is a critic, not the room. A panel that agrees can be a panel that conformed; consensus is a measure of perspective-spread, not of artifact-completeness. So the binary verdict comes from a separate fresh critic that checks the doc against evidence — never from "everyone liked it."

## Process

### B0 — Frame (no subagents)

Read the ground truth before framing anything. Use {{GREP_TOOL}}/{{GLOB_TOOL}}/{{READ_TOOL}} to map the subsystems the idea touches; cite what you find (G1 — paste the lines you rely on, do not infer from filenames). Then frame **3–7 decision questions** — the genuine forks where a wrong call is expensive. These questions ARE the agenda for B1. If you cannot name at least one fork where two reasonable approaches diverge, this is not a design problem: skip the panel (see the ladder below) and go straight to B3.

Classify the blast radius now: is any decision a **one-way door** (data-model, public contract, migration, anything expensive-to-reverse)? Record it — it drives the gate ladder and whether the design doc needs a `Blast radius` section.

### B1 — Diverge (panel, conditional)

**DESIGN gate ladder (R-ORCH-16/17).** Run a panel ONLY when **≥2 viable approaches exist AND at least one decision is expensive-to-reverse**. A single viable approach, or a cheap-to-reverse decision, does not earn a panel — skip straight to B2 with your framed options. State which branch you took and why.

When the panel runs: invoke `atomic-skills:debate` in **gate-mode** with the B0 questions as the bounded agenda. Default 3 heterogeneous voices, with a **mandatory contrarian** every round. The panel is the ACTOR — it produces divergence and a machine-readable Synthesis verdict; **it does not decide**. Present every voice unblended (debate's Iron Law).

### B2 — Decide (the user ratifies)

Produce an Orchestrator Synthesis of the panel (or of your framed options, if no panel ran): the recommended direction stated as a concrete decision, the 2–3 load-bearing reasons attributed to the voices that made them, and the dissent preserved verbatim. Then ask the user to ratify. **The user decides, not the panel.** Every approach that was weighed and not chosen becomes a `Rejected alternatives` entry — dissent is recorded, not smoothed over.

### B3 — Write the design doc

Write `projects/<project-id>/<plan-slug>/design.md` with the sections in **The design doc** below, then commit it (it is a canonical tracked artifact, unlike the throwaway `source.md` draft). Run the section lint before going further:

```bash
node scripts/lint-design.js projects/<project-id>/<plan-slug>/design.md
# add --migration when any decision is a one-way door (requires the Blast radius section)
```

A non-zero exit means a required section is missing or empty — fix the doc, do not proceed. This lint is the deterministic, zero-token half of the gate; the critic is the judgment half.

### B4 — Validate (the critic gate)

Invoke the critic per `skills/shared/debate-assets/critic.md` — a **fresh, independent** reviewer (NOT a debate persona, NOT carrying this session's context), tiered by provider (same-provider-fresh where the host isolates it, codex critic where it does not, solo-advisory only as honest degradation). The critic reads `design.md` against the evidence and emits the codex-shaped verdict block; the gate reads its binary collapse:

- **Approved** (`approve`/`approve_with_nits`, zero blocker/critical) → proceed to B5.
- **Issues-Found** (`needs_changes`/`reject`, or any blocker/critical) → address the findings, rewrite `design.md`, re-run the critic. **Ceiling: 3 critic rounds.** If still Issues-Found after the 3rd, STOP and escalate to the user — never iterate a 4th time, never silently advance on an un-Approved design.

### B5 — Handoff

Only on critic **Approved** AND explicit user approval: announce the design path, the headline decision, and hand off — `atomic-skills:project new plan <plan-slug>` consumes the approved `design.md` as its source-of-truth for the PLAN stage. brainstorm's job ends here; it never writes the plan itself.

## The design doc

`design.md` is committed markdown (no frontmatter required). These sections are mandatory and enforced by `scripts/lint-design.js`:

- `## Decisions` — WHAT we are building and WHY, as concrete decisions (not a wish-list). **(lint-required)**
- `## Chosen approach` — HOW, naming the 2–3 approaches that were weighed and the recommendation that won. **(lint-required)**
- `## Blast radius` — for any one-way-door / migration decision: what is expensive-to-reverse and the containment. **(lint-required when `--migration`)**

Plus, for a usable design: `## Context` (why this exists), `## Non-goals` (what this explicitly is not), `## Open questions` (what the design could not resolve + what evidence would), and `## Rejected alternatives` (the dissent from B2, preserved). Every required section must carry real content — a header over a `TODO`/`TBD`/`REPLACE_*` placeholder fails the lint.

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

- "There's clearly one right approach, I'll just write it up." → That is premature convergence — the failure this skill prevents. Frame the fork or prove there is no fork (B0), don't assume it away.
- "I'll run the panel and whatever it agrees on is the design." → Panel consensus is not the gate. The user ratifies (B2); the critic decides (B4).
- "Let me sketch the tasks while I design." → WHAT/WHY before HOW-as-tasks. The design records decisions + chosen approach; the task list is downstream, from decompose.
- "The design is obviously fine; I'll skip the critic." → An unchecked design is an opinion. The critic is the gate.
- "Three critic rounds and still Issues-Found — one more pass will land it." → No. Ceiling is 3; the 4th pass is the signal to escalate to the user, not to grind.
- "The panel split, I'll just pick one and not mention the other." → Dissent is preserved as a Rejected-alternatives entry, never smoothed over.
- "design.md is approved, I'll write the plan here to save a step." → brainstorm hands off to `project new plan`; it never authors the plan itself.
- "We aligned on A yesterday / the lead prefers it — I'll just document it cleanly." → Prior alignment, authorship, and "nobody objected" are comfort signals, not evidence A is right — that is how premature convergence feels from the inside. Fear of "looking indecisive" for reopening is a social cost, not a technical reason; re-widening at the design stage is the cheapest possible correction, never churn. Frame ≥2 real alternatives on the merits; if a sharper one surfaces, escalate it, don't bury it.
- "I'll write the one approach plus a throwaway 'considered X, rejected as non-scalable' line to look like I compared." → That is a fabricated Rejected-alternative — fake rigor, worse than none. A Rejected-alternatives entry records a comparison that ACTUALLY happened; a one-line strawman you never weighed fails the critic's "names the alternatives weighed" check.
- "The user said skip the design doc, so I'll dump the task list and document the decisions later." → "Skip the doc" ≠ "skip the decisions." Write Decisions + Chosen approach in 3–4 terse lines first, then derive the tasks. Tasks from absent decisions are plausible-looking and quietly wrong; "backfill later" is the skip.
- "The critic is slow / the user didn't ask for it / I'll self-review and run it later." → None of those is a reason. Slowness is friction (spawn it, work in parallel); user-silence is not skip-permission; self-review re-confirms your own blind spots; "later" means advancing un-Approved now. Run the critic before declaring the design done.

If you thought any of the above: STOP. Go back to the phase you were skipping.

## Closing

Output of a clean run: a committed `projects/<id>/<slug>/design.md` (lint-clean, gates self-reviewed), a critic **Approved** verdict, the user's explicit approval, and a handoff line to `atomic-skills:project new plan <slug>`. Nothing downstream of the design is brainstorm's to write.
