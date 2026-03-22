# ⚛ Atomic Skills

**Each skill is an atom: self-contained, indivisible, ready to act.**

*Stop rewriting prompts.*

Install optimized developer skills in any AI-powered IDE. One command, all your tools.

## Quick Start

```bash
npx atomic-skills install
```

The interactive installer asks your language, which IDEs you use, and which optional modules to enable. Skills are installed directly into your project — no global config needed.

## Supported IDEs

| IDE | Directory | Invocation |
|-----|-----------|------------|
| Claude Code | `.claude/skills/` | `/as-name` |
| Cursor | `.cursor/skills/` | `/as-name` |
| Gemini CLI | `.gemini/commands/` | `/as-name` |
| Codex | `.agents/skills/` | `$as-name` |
| OpenCode | `.opencode/skills/` | `/as-name` |
| GitHub Copilot | `.github/skills/` | `/as-name` |

## Available Skills

| Skill | Description |
|-------|-------------|
| `as-fix` | Root cause diagnosis + TDD fix |
| `as-resume` | Generate handoff prompt for clean session |
| `as-save-and-push` | Review, save learnings, commit and push |
| `as-review-plan-internal` | Adversarial plan review for gaps |
| `as-review-plan-vs-artifacts` | Review plan against artifacts |

## Modules

Optional modules add extra capabilities to your workflow.

### Memory

Persistent memory across sessions. The agent saves learnings, decisions, and feedback between conversations.

- Enabled during install with configurable path (default: `.ai/memory/`)
- Adds the `as-init-memory` skill

## Update

Re-run the installer to update skills to the latest version. Modified files trigger a conflict prompt — you choose to overwrite, keep, or view the diff.

```bash
npx atomic-skills install
```

## Uninstall

```bash
npx atomic-skills uninstall
```

Removes all generated skill files and the manifest. The `.atomic-skills/` entry in `.gitignore` is kept for safety.

## Languages

- Portugues (BR)
- English

The installer UI and skill prompts follow the language you choose. Frontmatter metadata (`name`, `description`) is always in English for IDE compatibility.

## License

MIT
