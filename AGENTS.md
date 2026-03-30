# Agent Coordination & Instructions

This repository is optimized for multiple AI agents. Each agent should prioritize its specific instruction file if it exists.

## Instruction Hierarchy

1.  **`GEMINI.md`**: Primary instructions for Gemini CLI.
2.  **`CLAUDE.md`**: Primary instructions for Claude Code.
3.  **`AGENTS.md`**: Shared cross-agent coordination and standards.

## Cross-Agent Standards

All agents working on this repository must adhere to the following:

### 1. Tool Abstraction
NEVER use hardcoded tool names in skill files (`.md`). Always use the template variables:
- `{{BASH_TOOL}}`, `{{READ_TOOL}}`, `{{WRITE_TOOL}}`, `{{REPLACE_TOOL}}`, `{{GREP_TOOL}}`, `{{GLOB_TOOL}}`, `{{INVESTIGATOR_TOOL}}`.

### 2. Argument Handling
Use `{{ARG_VAR}}` to reference command-line arguments.

### 3. Conditional Rendering
Use Handlebars-style blocks for agent-specific logic:
- `{{#if ide.gemini}} ... {{/if}}`
- `{{#if ide.claude-code}} ... {{/if}}`

### 4. Documentation
- General Knowledge: `docs/kb/`
- Gemini Compatibility: `docs/kb/gemini-cli-compatibility.md`

## Agent-Specific Roles

- **Claude Code**: Focus on high-fidelity TDD and complex refactoring using its internal toolset.
- **Gemini CLI**: Focus on broad codebase investigation and multi-agent orchestration via `codebase_investigator`.
