# Gemini CLI Compatibility Guide

This guide explains how Atomic Skills maintains cross-agent compatibility, specifically for Gemini CLI, without breaking Claude Code or other IDEs.

## 1. Tool Name Abstraction

Gemini CLI uses different tool names than Claude Code. To maintain compatibility, **NEVER** hardcode tool names like `Bash` or `Read tool` in prompt templates. Use the following variables:

| Variable | Claude Code (Default) | Gemini CLI | Purpose |
|----------|----------------------|------------|---------|
| `{{BASH_TOOL}}` | `Bash` | `run_shell_command` | Shell execution |
| `{{READ_TOOL}}` | `Read tool` | `read_file` | Reading files |
| `{{WRITE_TOOL}}` | `Write tool` | `write_file` | Writing new files |
| `{{REPLACE_TOOL}}` | `Edit tool` | `replace` | Surgical text replacement |
| `{{GREP_TOOL}}` | `Grep` | `grep_search` | Searching file contents |
| `{{GLOB_TOOL}}` | `Glob` | `glob` | Listing files by pattern |
| `{{INVESTIGATOR_TOOL}}` | `Agent` | `codebase_investigator` | Subagent delegation |
| `{{ASK_USER_QUESTION_TOOL}}` | `AskUserQuestion tool` | `ask the user via a multiple-choice prompt (no native tool — render the question + options in plain text)` | Multi-choice user prompt. Only Claude Code has a native tool; Gemini and all other IDEs in the ELSE branch (Cursor, Codex CLI, Opencode, GitHub Copilot, generic) fall back to the descriptive string and render the prompt in plain text. |
| `{{ARG_VAR}}` | `$ARGUMENTS` | `{{args}}` | Accessing command arguments (Gemini native/commands use `{{args}}`; Claude uses `$ARGUMENTS`) |

## 2. Conditional Rendering

Use Handlebars-style conditional blocks to handle logic that only applies to a specific IDE.

```markdown
{{#if ide.gemini}}
This instruction is ONLY for Gemini CLI.
Use the `{{INVESTIGATOR_TOOL}}` to research the codebase.
{{/if}}

{{#if ide.claude-code}}
This instruction is ONLY for Claude Code.
{{/if}}
```

## 3. Skills vs. Commands

- **Skills (`.gemini/skills/atomic-skills-<skill>/SKILL.md`)**: Canonical Gemini contract. Gemini discovers only `SKILL.md` and `*/SKILL.md` under `.gemini/skills/` (one-level depth) — nested `atomic-skills/<skill>/SKILL.md` is invisible to the scanner.
- **Commands (`.gemini/commands/atomic-skills-<skill>.toml`)**: Optional TOML adapters. Use real TOML serialization and `{{args}}` for argument substitution (never `$ARGUMENTS`). Enabled only when the user selects `gemini-commands` explicitly; dual Gemini+Codex selection keeps native skills.

The installer supports both via the `gemini` (default/native) and `gemini-commands` (optional) IDE targets.

## 4. Development Workflow for New Skills

When creating or updating a skill:
1. Use the abstract `{{TOOL_NAME}}` variables everywhere.
2. Verify if Gemini CLI needs a specific "Step 0" (e.g., `commands reload` is handled by the user, but the prompt should be aware of tool differences).
3. If a tool behavior differs (e.g., `replace` requires more context than `Edit tool`), use `{{#if ide.gemini}}` to provide the extra guidance.
4. Test the rendered output for both `claude-code` and `gemini` using the `npm test` suite (ensure `render.test.js` is updated).

## 5. Summary of Rules for AI Agents

- **Rule 1**: No hardcoded tool names. Use variables.
- **Rule 2**: Use `{{#if ide.gemini}}` for Gemini-specific quirks.
- **Rule 3**: Gemini prefers `read_file` with line ranges for efficiency; ensure the prompt encourages this.
- **Rule 4**: Always cite evidence using `file:line` (standard across all supported agents).
