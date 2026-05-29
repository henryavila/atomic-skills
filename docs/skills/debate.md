# `atomic-skills:debate` — Multi-Agent Roundtable

> **Iron Law:** `NO SYNTHESIS WITHOUT INDEPENDENT VOICES.`

**Roundtable of independent subagent personas for divergent thinking**

Ask one model for "the architect''s view and the QA view" and both collapse toward the same voice — convergent, performative, useless for finding blind spots. `debate` spawns each persona as its own subagent so they genuinely disagree, and presents every response unabridged instead of digesting them into your summary. The roster is pluggable (inline list, `.claude/agents/*.md`, `personas/*.md`, or a shipped default), so it runs in any repo. It''s the divergent, human-in-the-loop step that produces the consolidated direction `parallel-dispatch` consumes.

## Purpose

Run a multi-persona roundtable as independent subagents for divergent thinking — design debates, brainstorming, adversarial review panels — with the human steering each round.

## Usage

**When to use:**
- You want genuinely divergent perspectives on an open question
- Debating a design, architecture, or product trade-off
- Brainstorming or widening the option space before deciding
- Running an adversarial review panel (dev + architect + QA cross-talk)

**When NOT to use:**
- You have a finalized, disjoint task list (use parallel-dispatch)
- You need a single converged answer or committed artifacts
- A one-shot factual question with no perspectives to weigh

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `topic` | positional | optional | Opening topic for the roundtable. If omitted, the skill asks after showing the roster. |
| `--solo` | flag | optional | Role-play all personas in one response instead of spawning subagents (fallback when the spawn tool is unavailable). |
| `--model` | option | optional | Force all subagents onto a specific model. _(defaults to model matched to each round's depth)_ |
| `--roster` | option | optional | Explicit roster file (YAML list or directory of persona files) instead of auto-detection. |

**Examples:**
- `/atomic-skills:debate "should we split the monolith now or after launch?"` — Debate an open decision using the auto-detected roster
- `/atomic-skills:debate --solo "review this API design"` — Single-LLM role-play fallback when subagents are unavailable
- `/atomic-skills:debate --roster personas/security-panel.yaml` — Convene a specific named panel from a roster file

## Metadata

**Related:** `parallel-dispatch`, `review-plan`, `review-code`

**Tags:** `brainstorming`, `multi-agent`, `roundtable`, `divergent`, `core`

**Version added:** `2.1.0`
