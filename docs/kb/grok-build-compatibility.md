# Grok Build Compatibility Guide

How Atomic Skills targets **Grok Build** as a first-class install host (plugin
package + tool map) and how that relates to the **Codex** tool profile (same
renderer fix — Codex must not free-ride Claude tool names).

## 1. Install surface (plugin package + host registry)

Grok is **not** installed under `.grok/skills/atomic-skills/` and **never**
under Codex's `.agents/skills/` tree. Delivery is a **plugin package** outside
Codex's reach, then registered with the host plugin system so Grok treats it as
native:

| Scope | Plugin root (journal-owned) |
|-------|-----------------------------|
| user | `~/.grok/plugins/atomic-skills/` |
| project | `<repo>/.grok/plugins/atomic-skills/` |

**Why this path:** Codex renders skills into `.agents/skills/` with Codex tool
names (`shell`, `spawn_agent`). Grok also scans `.agents/` for compat. Putting
Atomic Skills for Grok only under `.grok/plugins/` keeps a Grok-rendered body
(`run_terminal_command`, `spawn_subagent`) and avoids the Codex collision.

**Install steps (when `--ide` includes `grok`):**

1. **Journal** — materialise the plugin package (skills, `_assets`, Soft
   `hooks/hooks.json`, `plugin.json`) under `.grok/plugins/atomic-skills/`.
2. **Host registry** (outside the journal, fail-open) —
   `grok plugin install --trust <absPluginRoot>` so `grok plugin list` shows
   `atomic-skills`. Re-install tries `grok plugin update atomic-skills` when
   already registered.
3. **Foreign-skills isolation** (outside the journal, user
   `~/.grok/config.toml`) — add every non-Grok Atomic Skills root that Grok
   harness-scans to `[skills].ignore`, so Grok does **not** list
   Cursor/Codex/Claude-rendered Atomic Skills (wrong tool names) next to the
   plugin package. Without this, `/project` shows both `atomic-skills:project`
   and `user:project`. Surgical: other `ignore` entries and unrelated config
   keys are preserved.

**Uninstall steps:**

1. `grok plugin uninstall atomic-skills --confirm` (host registry).
2. Remove the managed `[skills].ignore` entries **only if** no remaining
   install (user or project) still lists `grok` in its manifest.
3. Journal reverse — removes the package tree + auto-update surface.

If the `grok` binary is missing, host registry steps are skipped; the
filesystem package and foreign-skills isolation still install/uninstall cleanly.
Set `ATOMIC_SKILLS_SKIP_GROK_HOST=1` to force-skip only the host CLI bridge
(hermetic tests); isolation still runs.

### Multi-IDE: Codex vs Grok (no shared skill body)

| Host | Skill root | Tool map |
|------|------------|----------|
| Codex | `.agents/skills/atomic-skills/` | `shell`, `spawn_agent`, … |
| Grok | `.grok/plugins/atomic-skills/` (+ host plugin) | `run_terminal_command`, `spawn_subagent`, … |

Grok also scans `.agents/`, `.cursor/`, and `.claude/` for harness compat —
without isolation it would surface those trees as `user:*` skills alongside
the plugin. The installer therefore writes:

```toml
# ~/.grok/config.toml  (managed surgically by atomic-skills)
[skills]
ignore = [
  "~/.agents/skills/atomic-skills",
  "~/.cursor/skills/atomic-skills",
  "~/.claude/skills/atomic-skills",
  "~/.claude/commands/atomic-skills",
]
```

Do **not** flip `[compat.cursor] skills = false` / `[compat.claude] skills =
false` globally — that would hide the user's non-Atomic Skills under those
vendors. Namespace-scoped `ignore` is enough.

Codex does **not** scan `.grok/plugins/`; no reverse isolation is required.

Layout:

| Path | Role |
|------|------|
| `plugin.json` | Package manifest (name `atomic-skills`, version, skills/hooks paths) |
| `skills/<name>/SKILL.md` | Rendered skills (no nested `atomic-skills/` namespace segment) |
| `_assets/` | Lazy detail + templates (`{{ASSETS_PATH}}`) |
| `hooks/hooks.json` | Project Soft hooks (SessionStart + PreToolUse dual-vocab); Strict adds Stop at setup |

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

## 6. Plugin inspect / list smoke

After `npx @henryavila/atomic-skills install --ide grok` (project or user
scope), verify the plugin package is the only skill root, the host registry
lists the plugin (when `grok` is on PATH), and the manifest is complete.

```bash
# Host registry (after install with grok binary present)
grok plugin list
# expect a row for atomic-skills pointing at ~/.grok/plugins/atomic-skills
#   or <repo>/.grok/plugins/atomic-skills
grok plugin validate ~/.grok/plugins/atomic-skills   # or project path
```

**Filesystem contract (always available):**

```bash
# Project scope
test -f .grok/plugins/atomic-skills/plugin.json
test -d .grok/plugins/atomic-skills/skills
test -f .grok/plugins/atomic-skills/hooks/hooks.json
test -d .grok/plugins/atomic-skills/_assets
# Dual tree must NOT exist
test ! -e .grok/skills/atomic-skills

# Required keys + version pin against the *installed package*, not the
# consumer repo's package.json (cwd may be any project that only hosts the plugin).
node -e "
const fs=require('fs');
const path=require('path');
const {createRequire}=require('module');
const p=JSON.parse(fs.readFileSync('.grok/plugins/atomic-skills/plugin.json','utf8'));
function installedPkgVersion() {
  // 1) Runtime marker written by install (points at package root)
  try {
    const root=fs.readFileSync(path.join(process.env.HOME||'','/.atomic-skills/package-root'),'utf8').trim();
    if (root) {
      const v=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
      if (v) return v;
    }
  } catch {}
  // 2) Resolvable published package
  try {
    const req=createRequire(path.join(process.cwd(),'package.json'));
    const pkgPath=req.resolve('@henryavila/atomic-skills/package.json');
    return JSON.parse(fs.readFileSync(pkgPath,'utf8')).version;
  } catch {}
  // 3) Dev checkout only: cwd IS the atomic-skills package
  try {
    const local=JSON.parse(fs.readFileSync('package.json','utf8'));
    if (local.name==='@henryavila/atomic-skills') return local.version;
  } catch {}
  console.error('cannot resolve installed @henryavila/atomic-skills version');
  process.exit(1);
}
const expected=installedPkgVersion();
for (const k of ['name','version','description','skills','hooks']) {
  if (!(k in p)) { console.error('missing', k); process.exit(1); }
}
if (p.name !== 'atomic-skills') process.exit(1);
if (p.version !== expected) {
  console.error('version mismatch', p.version, '!=', expected);
  process.exit(1);
}
if (p.skills !== './skills/' || p.hooks !== './hooks/hooks.json') process.exit(1);
console.log('plugin.json OK', p.name, p.version);
"
```

**User scope** — same paths under `~/.grok/plugins/atomic-skills/`.

**Host UI (when available):** if Grok Build exposes a plugin list/inspect
command in your installed CLI version, `atomic-skills` should appear with
version matching the **installed** package (`~/.atomic-skills/package-root` →
`package.json`, or `@henryavila/atomic-skills/package.json` resolve) — not the
consumer project's `package.json`. The filesystem contract above is the
automated gate (`tests/install.test.js`); host UI listing is a manual smoke.

## 7. Trust, hooks-trust, and Soft fail-open

Grok Build may require **folder trust** and/or **hooks trust** before plugin
hooks execute in a project clone. Atomic Skills Soft hooks are designed to be
safe when untrusted:

| Situation | Expected behavior |
|-----------|-------------------|
| Project folder not trusted | Skills may still load from the plugin package (read-only skill bodies); hooks do not run |
| Plugin present but hooks untrusted (`/hooks-trust` not granted) | Soft SessionStart / PreToolUse **fail-open**: no SessionStart digest, no PreToolUse provenance gate; agent continues without blocking |
| Soft installed, Strict not opted in | SessionStart + PreToolUse only; no Stop / scope-drift gate |
| Auto-update only (`~/.grok/hooks/atomic-skills-auto-update.json`) | Independent of project plugin trust — version-check SessionStart may still fire at user scope |

**Operator steps (project Soft):**

1. Install with `--ides grok` (or multi-IDE including `grok`).
2. Open the repo in Grok Build; grant folder trust if prompted.
3. If hooks do not fire, grant hooks trust for the project plugin
   (`/hooks-trust` or host Settings → Hooks) so
   `.grok/plugins/atomic-skills/hooks/hooks.json` is allowed.
4. Confirm Soft entries: `jq '.hooks | keys' .grok/plugins/atomic-skills/hooks/hooks.json`
   → expect `SessionStart` and `PreToolUse` (no `Stop` until Strict setup).

**Do not** treat missing hook fire as an install failure when trust is
withheld — that is intentional Soft fail-open. Install parity still requires
the hook **files** to reverse cleanly on uninstall.

Marketplace publish and MCP project-state servers remain non-goals (design D10).
)
