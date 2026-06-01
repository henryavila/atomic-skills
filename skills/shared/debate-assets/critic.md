# critic — the DESIGN gate verdict (lazy asset)

> **NOT a debate persona; never resolved from `roster.yaml`.** This file is a sibling of `roster.yaml` but is never loaded as a debate voice. The debate roster resolver only globs `.claude/agents/*.md` and `personas/*.md` and falls back to `roster.yaml` (see `skills/core/debate.md` "Resolve the roster") — `critic.md` is none of those, so it is never auto-resolved into a panel. It is invoked explicitly by `skills/core/brainstorm.md` (step B4) and any future stage that needs an evidence-checked binary gate.

The critic is the **gate** in the actor-critic architecture: `debate` is the ACTOR (produces divergence, does not decide); the critic is a **separate, fresh, evidence-checked reviewer** that emits the binary verdict. Gate-pass is read from this verdict — **never** from panel consensus (a panel that agreed can be a panel that conformed). A unanimous panel plus a critic `Issues-Found` does NOT advance.

## Freshness contract (load-bearing)

The critic MUST be a fresh reviewer with **constructed, not inherited** context: it does not carry the orchestrator's or any panel member's session history. You hand it exactly three things — the artifact under review (`design.md`), the evidence it is allowed to rely on, and this verdict contract. A critic that inherited the actor's context would re-confirm the actor's blind spots; the entire value of the gate is independence.

## Provider — tiered (pick the first that the host can guarantee)

1. **Same-provider fresh subagent** via {{INVESTIGATOR_TOOL}}, where the host guarantees an isolated, no-actor-context spawn (Claude Code today). This meets the freshness contract and is the cheapest tier.
2. **Codex critic** via the read-only codex bridge, where same-provider isolation cannot be guaranteed (Gemini, until a write/isolation probe proves otherwise — the investigator tool there is read-only), OR when a high-stakes one-way-door decision warrants cross-model adjudication on its merits. The codex bridge is portable by construction.
3. **`--solo` honest degradation** — when neither tier is available, role-play the critic in-context and **mark the verdict advisory, NOT a gate-pass**. An advisory verdict cannot satisfy the brainstorm Iron Law; surface that the gate ran degraded and require explicit user judgment to proceed.

Announce which tier ran. Because all three tiers emit the **same verdict block** (below), a same-provider critic and a codex critic produce byte-identical output, so the gate wiring is provider-agnostic.

## Verify-before-fix (defends against critic hallucination)

The critic checks claims against evidence; it can still be wrong. Before the actor acts on any finding, the finding's `Evidence` must be confirmed against the real artifact/source. A finding whose quoted evidence does not exist in the artifact is discarded, not fixed. This keeps a hallucinated critic finding from corrupting the design.

## Calibration

Approve unless there are **serious gaps**. The critic is adversarial about substance, not pedantic about style: it hunts unimplementable decisions, unstated one-way-door risk, decisions asserted without evidence (G1/G6 violations), and missing required design sections — not wording. Default to surfacing a real gap as a finding; do not invent findings to look rigorous, and do not soften a real blocker to be agreeable. Both failures (rubber-stamp and false-alarm) break the gate.

## What the critic reviews (for a `design.md`)

- Every required section present and substantive (`Decisions`, `Chosen approach`, `Blast radius` for migrations) — the deterministic half is `scripts/lint-design.js`; the critic judges whether the content is *real*.
- Decisions are concrete and implementable, not aspirational.
- The chosen approach names the alternatives weighed; a one-option design under a one-way-door decision is a blocker.
- Claims about existing code carry pasted evidence (G1) or an `unverified:` marker (G6).
- Blast radius is stated and contained for any expensive-to-reverse decision.

## Required output — the verdict block

Respond in this exact structure (reuses the codex pass-1 shape from `skills/shared/codex-bridge-assets/output-template-pass1.txt:7-13`, so the gate parses one shape regardless of provider). No prose before the frontmatter.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. claude-opus-4-8 or gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. Substance only — no praise, no "what works well".
If verdict is approve, say so in one sentence and stop.>

## Findings

### F-001 [<severity>] <category> — design.md §<section>

**Evidence:**
```
<exact quote from design.md — quote literally so verify-before-fix can confirm it>
```

**Claim:** <what is missing, unimplementable, or unevidenced — one sentence>

**Impact:** <concrete consequence — which decision breaks, which one-way door is unguarded>

**Recommendation:** <specific action; not "consider X">

**Confidence:** <high | medium | low>

---

### F-002 ...

## Questions (non-findings)

- §<section> — <question the design does not answer>

## Out of scope

- <noticed but under the design's Non-goals>
````

Severity enum: `blocker | critical | major | minor | nit`. Confidence enum: `high | medium | low`. `counts` must equal the actual finding count by severity. IDs match `F-\d{3}`.

## Binary collapse (how the gate reads the verdict)

The gate is binary; the verdict block is 4-valued so it stays byte-identical to a codex review. Collapse:

- **Approved** ⟺ `verdict ∈ {approve, approve_with_nits}` **AND** `counts.blocker == 0` **AND** `counts.critical == 0`.
- **Issues-Found** — otherwise (`needs_changes`/`reject`, or any blocker/critical regardless of verdict word).

There is no minor-override: a `needs_changes` is Issues-Found even if every finding reads as small. The actor's loop (brainstorm B4) addresses findings and re-runs the critic, ceiling 3 rounds, then escalates to the user — it never advances on Issues-Found and never iterates a 4th time.
