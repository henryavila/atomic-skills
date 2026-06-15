# `atomic-skills:design-brief` — DS + screens prompts, contamination-free

> **Iron Law:** `NEVER SILENCE BEHAVIOUR OR PHILOSOPHY — SILENCE IS FOR VISUAL FORM ONLY.`

**Generate DS + screens prompts for a design agent, contamination-free**

The failure this prevents is the inverse of over-design: it is under-specification. "Don't dictate the visuals" is a layer-1-only rule; extending that silence to the interaction model and the product philosophy lets the design agent fill the gaps with its conventional default — which is usually the product's anti-pattern. `design-brief` keeps silence on visual form but pins behaviour and who-decides-what with concrete values mined from the real code, names the forbidden anti-pattern on risky screens, and ships the DS-first so every screen consumes the inherited Design System instead of redefining it.

## Purpose

Generate the two design prompts (Design System, then screens that consume the inherited DS) from a real app and its product intent, encoding the three-layer model: visual form stays the design agent's (silence), while interaction behaviour and philosophy are product requirements specified with concrete values — so the redesign is faithful, not a plausible anti-pattern.

## Usage

**When to use:**
- You are handing an existing app to a design agent (e.g. claude.ai/design) for a redesign
- You need a Design System prompt plus per-screen prompts that consume it
- A prior hand-written brief produced anti-patterns by leaving behaviour/philosophy unspecified

**When NOT to use:**
- You only need the product decision, not the design prompts (use brainstorm)
- There is no real app to mine behavioural parameters from
- The design system and screens already exist and are faithful

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `scope` | positional | optional | The target app/scope (repo path + product intent). If omitted, the skill asks interactively. |

**Examples:**
- `/atomic-skills:design-brief "redesign the review dashboard at src/dashboard"` — Mine the app + intent, emit the DS prompt then the screens prompts
- `/atomic-skills:design-brief` — Skill asks for the app/scope and the product intent interactively

## Metadata

**Dependencies:** `git`

**Related:** `brainstorm`, `project`

**Tags:** `design`, `prompts`, `anti-contamination`, `core`

**Version added:** `2.3.0`
