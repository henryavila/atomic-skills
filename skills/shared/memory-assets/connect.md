# init-memory — connect to Claude Code (lazy asset)

Read during init-memory's wiring step (Process step 5). Holds the connection
detail kept out of the resident skill: how Claude Code resolves the default memory
path, the two ways to point it at `{{memory_path}}`, and the per-IDE wiring
procedure. The skill's structure-creation steps (1-4) stay resident and never
depend on this file until step 5 runs.

## Critical Context — How Claude Code Reads Memory

Claude Code loads auto-memory from `~/.claude/projects/{project_dir}/memory/MEMORY.md` by default,
where `{project_dir}` is the project path with `/` replaced by `-`
(e.g., `/home/user/myapp` → `-home-user-myapp`).

Moving files to `{{memory_path}}` does NOT make Claude read them automatically.
Two ways to connect:

**Path A — `autoMemoryDirectory` (recommended):**
Configure an absolute path in `.claude/settings.local.json` or `~/.claude/settings.json`.
Does NOT accept relative paths. Does NOT accept project settings (`.claude/settings.json`).

**Path B — Redirect (fallback):**
Create a `MEMORY.md` in the default directory that points to `{{memory_path}}`.
Fragile — new memory files become invisible if the redirect is not updated.

## Step 5 — Connect to Claude Code

Detect the IDE in use by checking for `.claude/`, `.cursor/`, `.gemini/`, etc.

**If Claude Code (`.claude/` exists):**

Check if `autoMemoryDirectory` is already configured:
```bash
{{GREP_TOOL}} -r "autoMemoryDirectory" .claude/settings*.json ~/.claude/settings.json 2>/dev/null
```

**If configuration found:**
Check if it points to `$CANONICAL_PATH`.
- If it already points to `$CANONICAL_PATH`: report "autoMemoryDirectory already configured correctly" and skip to step 6.
- If it points to a different directory (e.g., the old `.memory/`): offer to update it to `$CANONICAL_PATH`.

**If NOT configured**, present:

> Claude Code reads memory from `$AUTO_MEMORY_DIR` by default.
> To read from `{{memory_path}}` directly, I need to configure `autoMemoryDirectory`.
>
> A) Configure in `.claude/settings.local.json` (recommended)
> B) Create manual redirect in the default directory (fragile)
> C) Skip — configure later

**If option A:**
If `.claude/settings.local.json` does not exist, create it.
Add `"autoMemoryDirectory": "$CANONICAL_PATH"` to the JSON.
Example result:
```json
{
  "autoMemoryDirectory": "/home/user/myapp/.ai/memory"
}
```

**If option B:**
Create `$AUTO_MEMORY_DIR/MEMORY.md` with this content:
```markdown
# Auto Memory - Redirect
This project's memory is in `{{memory_path}}` inside the repository.
Read `{{memory_path}}MEMORY.md` for general context.
Save new learnings to `{{memory_path}}`, not here.
```

**If other IDE:** skip this step.
