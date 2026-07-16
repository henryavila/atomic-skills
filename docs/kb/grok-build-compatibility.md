# Grok Build Compatibility Guide

How Atomic Skills targets **Grok Build** as a first-class install host (plugin
package + tool map) and how that relates to the **Codex** tool profile (same
renderer fix — Codex must not free-ride Claude tool names).

## 1. Install surface (plugin package)

Grok is **not** installed under `.grok/skills/atomic-skills/`. The only durable
skill/asset root is the **plugin package**:

| Scope | Plugin root |
|-------|-------------|
| user | `~/.grok/plugins/atomic-skills/` |
| project | `<repo>/.grok/plugins/atomic-skills/` |

Layout:

| Path | Role |
|------|------|
| `plugin.json` | Package manifest (name `atomic-skills`, version, skills/hooks paths) |
| `skills/<name>/SKILL.md` | Rendered skills (no nested `atomic-skills/` namespace segment) |
| `_assets/` | Lazy detail + templates (`{{ASSETS_PATH}}`) |
| `hooks/hooks.json` | Project Soft/Strict hooks (filled in a later phase) |

`IDE_CONFIG.grok.delivery === 'plugin'`. Detection uses `.grok` (`IDE_DETECT_DIRS`).

## 2. Tool name abstraction

**Never** hardcode Claude tool names (`Bash`, `Read tool`) in skill bodies. Use
template variables; the renderer substitutes per IDE.

| Variable | Claude Code | Gemini CLI | Grok Build (provisional) | Codex CLI |
|----------|-------------|------------|--------------------------|-----------|
| `{{BASH_TOOL}}` | `Bash` | `run_shell_command` | `run_terminal_command` | `shell` |
| `{{READ_TOOL}}` | `Read tool` | `read_file` | `read_file` | `read_file` |
| `{{WRITE_TOOL}}` | `Write tool` | `write_file` | `write` | `apply_patch` |
| `{{REPLACE_TOOL}}` | `Edit tool` | `replace` | `search_replace` | `apply_patch` |
| `{{GREP_TOOL}}` | `Grep` | `grep_search` | `grep` | `grep_files` |
| `{{GLOB_TOOL}}` | `Glob` | `glob` | `list_dir` | `list_dir` |
| `{{INVESTIGATOR_TOOL}}` | `Agent` | `codebase_investigator` | `spawn_subagent` | `spawn_agent` |
| `{{ASK_USER_QUESTION_TOOL}}` | `AskUserQuestion tool` | plain-text multi-choice prompt | `ask_user_question` | plain-text multi-choice prompt |
| `{{ARG_VAR}}` | `$ARGUMENTS` | `$ARGUMENTS` | `$ARGUMENTS` | `$ARGUMENTS` |

Notes:

- **Grok map is provisional** — locked by `tests/render.test.js` for F0. A later
  phase may adjust ids if headless `grok -p` tool names differ from interactive
  Grok Build.
- **Codex** uses agent-facing names (`shell`, `apply_patch`, …), not Claude’s
  `Bash` / `Read tool`. Codex has no native ask-user tool; ASK falls back to the
  descriptive multi-choice string (same as Cursor/OpenCode free-ride).
- Hosts without a dedicated profile (Cursor, OpenCode, GitHub Copilot) still use
  the Claude-style default map for non-ASK tools; ASK uses the no-native string.

## 3. Conditional rendering

```markdown
{{#if ide.grok}}
Grok-only quirk (use sparingly — prefer tool vars).
{{/if}}

{{#if ide.codex}}
Codex-only quirk.
{{/if}}
```

Prefer tool variables over conditionals. Use `ide.grok` / `ide.codex` only when
behavior truly diverges (not just a different tool name).

## 4. Assets path

For Grok, `{{ASSETS_PATH}}` resolves to the plugin sibling of `skills/`:

- project scope: `.grok/plugins/atomic-skills/_assets`
- user scope: `~/.grok/plugins/atomic-skills/_assets`

Never place assets under a recursively scanned skills tree.

## 5. Rules for skill authors

1. No hardcoded host tool names — always `{{BASH_TOOL}}` / `{{READ_TOOL}}` / …
2. Do not invent a second tree under `.grok/skills/` for Atomic Skills content.
3. Update `tests/render.test.js` when changing a tool map.
4. Grok plugin install/uninstall parity is enforced by
   `tests/install-uninstall-roundtrip.test.js` (plugin tree only).
)
