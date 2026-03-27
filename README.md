<p align="center">
  <img src="assets/header.png" alt="Atomic Skills — Small. Specific. Capable." width="100%" />
</p>

Optimized prompts you install once and invoke in any AI IDE. Each skill is an atom — small enough to stay focused, specific enough to leave no ambiguity, capable enough to make the agent actually follow through.

*Stop rewriting prompts.*

```bash
npx @henryavila/atomic-skills install
```

> **Built for Claude Code.** Skills work across multiple IDEs, but every prompt is optimized for Claude Code's tool system (Read, Edit, Grep, Glob, Bash, Agent). Techniques like Iron Laws, HARD-GATEs, and Rationalization tables are designed around how Claude reasons and where it cuts corners. Other agents benefit from the structure, but Claude Code gets the most out of it.

## Why Atomic?

AI agents skip steps, rationalize shortcuts, and ignore vague instructions. Atomic Skills solve this with battle-tested techniques baked into every prompt:

- **Small** — one skill, one job. No bloat, no dependencies between skills
- **Specific** — every step names the tool, demands evidence, defines what "done" looks like
- **Capable** — Iron Laws, HARD-GATEs, Red Flags, Rationalization tables. Techniques that turn "the agent should do X" into "the agent will do X"

## Supported IDEs

| IDE | Directory | Invocation |
|-----|-----------|------------|
| **Claude Code** | `.claude/skills/` | `/as-name` |
| Cursor | `.cursor/skills/` | `/as-name` |
| Gemini CLI | `.gemini/commands/` | `/as-name` |
| Codex | `.agents/skills/` | `$as-name` |
| OpenCode | `.opencode/skills/` | `/as-name` |
| GitHub Copilot | `.github/skills/` | `/as-name` |

## Skills

| Skill | What it does |
|-------|-------------|
| `as-fix` | Diagnoses root cause, writes failing test, fixes with TDD |
| `as-resume` | Investigates project context (git, memory, rules, skills), generates handoff prompt for clean session |
| `as-save-and-push` | Reviews conversation, saves learnings, formats code, commits logically, and pushes |
| `as-review-plan-internal` | Adversarial review — finds gaps, contradictions, and ambiguity in plans. Verifies file existence with tools, not trust |
| `as-review-plan-vs-artifacts` | Cross-references plan against specs and artifacts for coverage |
| `as-prompt` | Generates an optimized prompt from a task description — explores codebase, resolves file paths, applies guardrails and task-specific rationalizations |

## Techniques

Each skill uses a combination of these techniques to prevent agent shortcuts:

| Technique | What it does | Example |
|-----------|-------------|---------|
| **Iron Law** | One non-negotiable rule at the top | `NO FIX WITHOUT ROOT CAUSE` |
| **HARD-GATE** | Mandatory stop before a dangerous action | "If modifying code without a test: STOP" |
| **Red Flags** | List of thoughts that mean you're skipping steps | "I already know what the bug is" |
| **Rationalization Table** | Maps tempting shortcuts to why they fail | "The fix is obvious" → "Obvious to whom? Prove it" |
| **Evidence Requirement** | Every claim must cite line numbers or tool output | "Cite file:line, not 'I checked'" |
| **Escalation Limit** | Max attempts before asking the human | "5 hypotheses failed → escalate" |

## Modules

Optional modules add specialized workflows. The installer explains each one before you decide.

### Memory

Persistent context across sessions. The agent saves learnings, decisions, and feedback that survive between conversations.

- Configurable path (default: `.ai/memory/`)
- Adds the `as-init-memory` skill
- Supports Claude Code's `autoMemoryDirectory` for direct integration (no redirect needed)
- Available in both project and user scope installations

## Install, Update, Uninstall

```bash
npx @henryavila/atomic-skills install       # First install or update
npx @henryavila/atomic-skills uninstall     # Remove everything
```

The interactive installer asks your language, scope (project or user), which IDEs you use, and which modules to enable.

- **Project scope**: skills installed in the repo (shared with team)
- **User scope**: skills installed in `~/` (available in all your repos)

On update, modified files trigger a conflict prompt — overwrite, keep, or view the diff.

## Languages

- Português (BR)
- English

Skill prompts follow your chosen language. Metadata (`name`, `description`) is always in English for IDE compatibility.

## License

MIT
