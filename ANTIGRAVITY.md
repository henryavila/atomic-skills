# Antigravity Instructions

This repository is optimized for Antigravity (agy). Use this file for Antigravity-specific behaviors, tool mapping, and orchestration constraints.

## Primary Tooling
- **Execution**: Use `run_command` (`{{BASH_TOOL}}`). Run long tasks with `WaitMsBeforeAsync` appropriately and manage with `manage_task`.
- **Reading**: Use `view_file` (`{{READ_TOOL}}`) with line ranges (`StartLine`, `EndLine`) for large files to be context-efficient.
- **Editing**: Use `replace_file_content` (`{{REPLACE_TOOL}}`) for surgical edits (single contiguous block per call) or `write_to_file` (`{{WRITE_TOOL}}`) for new files.
- **Search**: Use `grep_search` (`{{GREP_TOOL}}`) and `glob` (`{{GLOB_TOOL}}`).
- **Subagents**: Use `invoke_subagent` (`{{INVESTIGATOR_TOOL}}`) with built-in subagents (`research` for read-only codebase/web search, `self` for full-featured subagents) or define custom subagents with `define_subagent`. Manage them via `manage_subagents` and communicate via `send_message`.
- **User Prompts / Modals**: Use native `ask_question` (`{{ASK_USER_QUESTION_TOOL}}`) for structured multi-choice options with write-in support.

## Skill Installation
When installing skills for Antigravity, the installer (`npx @henryavila/atomic-skills install`) provides the canonical profile:
- `antigravity` (alias `agy`): Installs to `.agent/skills/atomic-skills/<skill>/SKILL.md` (Markdown, canonical customization directory `.agent`). Keeps full isolation alongside Codex's `.agents`.

## Standards & Constraints
- **Evidence**: ALWAYS provide evidence (line numbers, tool output) for every claim.
- **TDD**: Follow the TDD process defined in the `as-fix` skill.
- **Compatibility**: When modifying skills, ensure you use the abstract tool variables defined in `AGENTS.md` and `docs/kb/antigravity-compatibility.md`.
- **Subagent Orchestration**: Antigravity natively supports async subagents and background tasks. You do NOT need to poll in a loop — Antigravity wakes up reactively on subagent messages or background task completion.

## Hierarchical Context
- Refer to `AGENTS.md` for cross-agent coordination.
- Refer to `CLAUDE.md` to understand how other agents might interact with this repository.
