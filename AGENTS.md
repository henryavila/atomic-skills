# Agent Coordination & Instructions

This repository is optimized for multiple AI agents. Each agent should prioritize its specific instruction file if it exists.

## Instruction Hierarchy

1.  **`ANTIGRAVITY.md`**: Primary instructions for Antigravity (agy).
2.  **`CLAUDE.md`**: Primary instructions for Claude Code.
3.  **`AGENTS.md`**: Shared cross-agent coordination and standards.

## Cross-Agent Standards

All agents working on this repository must adhere to the following:

### 1. Tool Abstraction
NEVER use hardcoded tool names in skill files (`.md`). Always use the template variables:
- `{{BASH_TOOL}}`, `{{READ_TOOL}}`, `{{WRITE_TOOL}}`, `{{REPLACE_TOOL}}`, `{{GREP_TOOL}}`, `{{GLOB_TOOL}}`, `{{INVESTIGATOR_TOOL}}`, `{{ASK_USER_QUESTION_TOOL}}`.

### 2. Argument Handling
Use `{{ARG_VAR}}` to reference command-line arguments.

### 3. Conditional Rendering
Use Handlebars-style blocks for agent-specific logic:
- `{{#if ide.antigravity}} ... {{/if}}`
- `{{#if ide.claude-code}} ... {{/if}}`

### 4. Documentation
- General Knowledge: `docs/kb/`
- Antigravity Compatibility: `docs/kb/antigravity-compatibility.md`

### 5. Install/Uninstall Parity
Every persistent install mutation MUST have a matching uninstall reversal or sit
in the documented allowlist. Enforced by
`tests/install-uninstall-roundtrip.test.js`. See `CLAUDE.md` →
"Install / Uninstall parity (HARD RULE)".

## Agent-Specific Roles

- **Claude Code**: Focus on high-fidelity TDD and complex refactoring using its internal toolset.
- **Antigravity**: Primary support for full lifecycle orchestration, subagent dispatch (`invoke_subagent`), interactive modal prompts (`ask_question`), and fast tool execution.
