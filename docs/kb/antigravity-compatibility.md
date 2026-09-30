# Antigravity Compatibility Guide

This guide explains how Atomic Skills maintains first-party cross-agent compatibility for Google Antigravity (`agy`), without breaking Claude Code or other IDEs.

## 1. Tool Name Abstraction

Antigravity provides a rich set of native agentic tools. To maintain cross-agent compatibility, **NEVER** hardcode tool names like `run_command` or `view_file` in prompt templates. Always use the following template variables:

| Variable | Claude Code | Antigravity (`agy`) | Purpose |
|----------|-------------|---------------------|---------|
| `{{BASH_TOOL}}` | `Bash` | `run_command` | Shell execution |
| `{{READ_TOOL}}` | `Read tool` | `view_file` | Reading files |
| `{{WRITE_TOOL}}` | `Write tool` | `write_to_file` | Writing new files |
| `{{REPLACE_TOOL}}` | `Edit tool` | `replace_file_content` | Surgical text replacement |
| `{{GREP_TOOL}}` | `Grep` | `grep_search` | Searching file contents |
| `{{GLOB_TOOL}}` | `Glob` | `glob` | Listing files by pattern |
| `{{INVESTIGATOR_TOOL}}` | `Agent` | `invoke_subagent` | Subagent delegation |
| `{{ASK_USER_QUESTION_TOOL}}` | `AskUserQuestion tool` | `ask_question` | First-party interactive multi-choice user modal prompt |
| `{{ARG_VAR}}` | `$ARGUMENTS` | `$ARGUMENTS` | Accessing command / invocation arguments |

## 2. Conditional Rendering

Use Handlebars-style conditional blocks to handle logic that applies specifically to Antigravity:

```markdown
{{#if ide.antigravity}}
This instruction is ONLY rendered when installing or executing under Antigravity.
{{/if}}

{{#if ide.claude-code}}
This instruction is ONLY rendered for Claude Code.
{{/if}}
```

The alias `agy` is automatically normalized to `antigravity` by the template renderer.

## 3. Customization Directory and Skills Layout

- **Skills Path**: `.agent/skills/atomic-skills/<skill>/SKILL.md`
- **Root**: `.agent` is the standard project customization directory for Antigravity (alongside global `~/.gemini/antigravity-cli/`).
- **Isolation**: Using `.agent/` cleanly avoids collisions with Codex (`.agents/skills/atomic-skills/<skill>/SKILL.md`).
- **Asset references**: Resolved relative to `SKILL.md` or absolute package path.

## 4. Subagent Orchestration & Native Primitives

Unlike older CLI environments with read-only restrictions:
- Antigravity supports native subagents via `invoke_subagent` (`research` for read-only codebase/web exploration, `self` for full tool execution).
- Custom subagents can be declared via `define_subagent`.
- Running subagents and background tasks are tracked with `manage_subagents` and `manage_task`.
- Antigravity execution is reactive: agents do not loop or poll; wakeup is automatic when tasks or subagents send messages.

## 5. Summary of Rules for AI Agents

- **Rule 1**: No hardcoded tool names. Use variables (`{{BASH_TOOL}}`, `{{READ_TOOL}}`, etc.).
- **Rule 2**: Use `{{#if ide.antigravity}}` for Antigravity-specific behaviors.
- **Rule 3**: Use `ask_question` via `{{ASK_USER_QUESTION_TOOL}}` for structured option gates.
- **Rule 4**: Always cite evidence using `file:line` (standard across all supported agents).
