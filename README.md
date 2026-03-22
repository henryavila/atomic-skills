<p align="center">
  <img src="assets/header.png" alt="Atomic Skills — Small. Specific. Capable." width="100%" />
</p>

Optimized prompts you install once and invoke in any AI IDE. Each skill is an atom — small enough to stay focused, specific enough to leave no ambiguity, capable enough to make the agent actually follow through.

*Stop rewriting prompts.*

```bash
npx @henryavila/atomic-skills install
```

## Why Atomic?

AI agents skip steps, rationalize shortcuts, and ignore vague instructions. Atomic Skills solve this with battle-tested techniques baked into every prompt:

- **Small** — one skill, one job. No bloat, no dependencies between skills
- **Specific** — every step names the tool, demands evidence, defines what "done" looks like
- **Capable** — Iron Laws, HARD-GATEs, Red Flags, Rationalization tables. Techniques that turn "the agent should do X" into "the agent will do X"

## Supported IDEs

| IDE | Directory | Invocation |
|-----|-----------|------------|
| Claude Code | `.claude/skills/` | `/as-name` |
| Cursor | `.cursor/skills/` | `/as-name` |
| Gemini CLI | `.gemini/commands/` | `/as-name` |
| Codex | `.agents/skills/` | `$as-name` |
| OpenCode | `.opencode/skills/` | `/as-name` |
| GitHub Copilot | `.github/skills/` | `/as-name` |

## Skills

| Skill | What it does |
|-------|-------------|
| `as-fix` | Diagnoses root cause, writes failing test, fixes with TDD |
| `as-resume` | Investigates project context, generates handoff prompt for clean session |
| `as-save-and-push` | Reviews conversation, saves learnings to memory, commits and pushes |
| `as-review-plan-internal` | Adversarial review — finds gaps, contradictions, and ambiguity in plans |
| `as-review-plan-vs-artifacts` | Cross-references plan against specs and artifacts for coverage |

## Modules

Optional modules add specialized workflows. The installer explains each one before you decide.

### Memory

Persistent context across sessions. The agent saves learnings, decisions, and feedback that survive between conversations.

- Configurable path (default: `.ai/memory/`)
- Adds the `as-init-memory` skill

## Install, Update, Uninstall

```bash
npx @henryavila/atomic-skills install       # First install or update
npx @henryavila/atomic-skills uninstall     # Remove everything
```

The interactive installer asks your language, which IDEs you use, and which modules to enable. Skills are installed into your project — no global config.

On update, modified files trigger a conflict prompt — overwrite, keep, or view the diff.

## Languages

- Português (BR)
- English

Skill prompts follow your chosen language. Metadata (`name`, `description`) is always in English for IDE compatibility.

## License

MIT
