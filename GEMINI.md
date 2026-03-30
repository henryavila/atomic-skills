# Gemini CLI Instructions

This repository is optimized for Gemini CLI. Use this file for Gemini-specific behaviors and constraints.

## Primary Tooling
- **Research**: Use `{{GREP_TOOL}}`, `{{GLOB_TOOL}}`, and `{{INVESTIGATOR_TOOL}}`.
- **Reading**: Use `{{READ_TOOL}}` with line ranges (`start_line`, `end_line`) for large files to be context-efficient.
- **Editing**: Use `{{REPLACE_TOOL}}` for surgical edits. Avoid multiple calls to `{{REPLACE_TOOL}}` for the same file in a single turn.

## Skill Installation
When installing skills for Gemini CLI, the installer (`npx @henryavila/atomic-skills install`) provides two profiles:
1. `gemini`: Installs to `.gemini/skills/` (Markdown format). Recommended for complex skills.
2. `gemini-commands`: Installs to `.gemini/commands/` (TOML format). Used for slash commands like `/as-fix`.

## Standards & Constraints
- **Evidence**: ALWAYS provide evidence (line numbers, tool output) for every claim.
- **TDD**: Follow the TDD process defined in the `as-fix` skill.
- **Compatibility**: When modifying skills, ensure you use the abstract tool variables defined in `AGENTS.md` and `docs/kb/gemini-cli-compatibility.md`.

## Hierarchical Context
- Refer to `AGENTS.md` for cross-agent coordination.
- Refer to `CLAUDE.md` to understand how other agents might interact with this repository.
