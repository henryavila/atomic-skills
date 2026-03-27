Standardize this project's memory to `{{memory_path}}` (canonical, versioned in git).

Announce when starting: "I will standardize this project's memory to `{{memory_path}}`."

## Fundamental Rule

NO DELETION WITHOUT CONFIRMED BACKUP.
Original memory directories can only be removed AFTER confirming that
ALL files were successfully copied to `{{memory_path}}`.
Confirm = run `ls` on both directories and compare.

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

## MEMORY.md Limits

- Only the first **200 lines** (or 25KB) are loaded at startup
- Topic files are read on demand
- Content beyond line 200 is **silently truncated**

## Process

### 1. Detect existing memory and resolve paths

Resolve this project's auto-memory path:
```bash
PROJECT_DIR=$(pwd | sed 's|/|-|g; s|^-||')
AUTO_MEMORY_DIR="$HOME/.claude/projects/-${PROJECT_DIR}/memory"
echo "Default auto-memory: $AUTO_MEMORY_DIR"
ls "$AUTO_MEMORY_DIR" 2>/dev/null
```

Resolve the absolute path for the canonical memory:
```bash
CANONICAL_PATH=$(realpath {{memory_path}} 2>/dev/null || echo "$(pwd)/{{memory_path}}")
echo "Canonical memory: $CANONICAL_PATH"
```

Scan known locations:
- `{{memory_path}}`
- `.memory/`
- `docs/memory/`
- `$AUTO_MEMORY_DIR` — default auto-memory (may have content)

Search for references and existing configurations:
```bash
grep -r "memory\|autoMemoryDirectory" CLAUDE.md AGENTS.md .claude/settings*.json ~/.claude/settings.json 2>/dev/null
```

If you find unexpected directories, list them and ask the user.

### 2. Present findings and request confirmation

**If no memory was found in any location:**
Inform the user and skip directly to step 4 (create memory from scratch).

**If memory was found:** list with origin, file count, and total size.

Present as Structured Options:

> Found memory in:
> 1. `.memory/` (8 files, 12KB)
> 2. `$AUTO_MEMORY_DIR` (3 files, 4KB) — Claude Code auto-memory
>
> Options:
> A) Migrate everything to `{{memory_path}}`
> B) Select which to migrate
> C) Cancel

Wait for a response before proceeding.

### 3. Migrate files

- Create `{{memory_path}}` if it does not exist
- Copy the approved files to `{{memory_path}}`
- If there are multiple `MEMORY.md` files, merge them into a single index
- Run `ls` on the destination to confirm all files arrived

<HARD-GATE>
DO NOT remove the original directories yet.
Removal only happens in step 8, after ALL validation.
If the user asks to remove now: explain that validation
ensures safety and removal comes at the end.
</HARD-GATE>

### 4. Organize content

- **Already has structure** (multiple thematic files): preserve as-is
- **No memory at all**: create `{{memory_path}}MEMORY.md` with an empty index
- **Single blob** (one giant file with everything mixed): separate into thematic
  files grouped by affinity. Descriptive names matching the domain.
  Only mandatory file: `MEMORY.md` as the index.

Verify that `MEMORY.md` has **less than 200 lines**. If over, move detailed
content to topic files and keep only links in the index.

### 5. Connect to Claude Code

Detect the IDE in use by checking for `.claude/`, `.cursor/`, `.gemini/`, etc.

**If Claude Code (`.claude/` exists):**

Check if `autoMemoryDirectory` is already configured:
```bash
grep -r "autoMemoryDirectory" .claude/settings*.json ~/.claude/settings.json 2>/dev/null
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

### 6. Update project instructions

- If the project's instruction file does NOT exist: create it with a memory section
- If it ALREADY exists AND `autoMemoryDirectory` was configured (step 5A):
  DO NOT add memory instructions — Claude already reads it automatically.
  Every line in CLAUDE.md costs tokens in EVERY session.
- If it ALREADY exists AND using redirect (step 5B) or other IDE:
  Add the minimum:
  ```
  ## Memory
  Consult `{{memory_path}}MEMORY.md` before implementing.
  Update memory when learning something relevant for future sessions.
  ```

### 7. Update broken references

Run `grep -r` on the old memory paths throughout the entire project.

- **Operational files** (project instructions, agent configs):
  update references to `{{memory_path}}`
- **Historical docs** (plans, designs, specs): list the references
  but DO NOT change without asking — they are historical records

### 8. Validation and cleanup

Verify by running each command (not just "verify"):

- Run `ls {{memory_path}}` — should show the migrated files
- Run `wc -l {{memory_path}}MEMORY.md` — should be < 200 lines
- Verify the Claude Code connection:
  - If autoMemoryDirectory: `grep autoMemoryDirectory .claude/settings*.json ~/.claude/settings.json`
  - If redirect: `cat "$AUTO_MEMORY_DIR/MEMORY.md" 2>/dev/null | head -5`
- Verify that project instructions DO NOT have redundant memory instructions
  (if autoMemoryDirectory was configured)

If EVERYTHING passed: remove the original directories (the ones that were migrated).
For each directory to remove, list the full path and ask for confirmation:

> Remove original directory `.memory/`? (files are already in `{{memory_path}}`)
> Type "remove" to confirm.

## Closing

Present report:
- Files migrated: [count] from [origin(s)]
- MEMORY.md: [lines] (limit: 200)
- Claude Code connection: [autoMemoryDirectory / redirect / not configured]
- Project instructions: [created/updated/not needed]
- References updated: [which files]
- Directories removed: [which]
- Problems found: [if any]

## Red Flags

- "I'll remove the original directory before validating"
- "The content was probably copied, I don't need to test"
- "The project instructions should already have the reference, I don't need to check"
- "I'll edit a historical doc to update the path"
- "That unexpected memory directory is probably not important"
- "I don't need to check autoMemoryDirectory, Claude will find it"
- "I'll add memory instructions to CLAUDE.md even with autoMemoryDirectory configured"
- "The settings.local.json should already exist, I don't need to check"

If you thought any of the above: STOP. Run the verification you were skipping.

## Rationalization

| Temptation | Reality |
|-----------|---------|
| "Claude reads .ai/memory/ by default" | It does NOT. Needs autoMemoryDirectory or redirect |
| "Relative path works in autoMemoryDirectory" | Absolute path only. Run `realpath` to obtain it |
| "I'll create settings.local.json without checking if it exists" | If it exists, add the key. If not, create. Always check |
| "The redirect is good enough" | Redirect breaks when new files are created. autoMemoryDirectory is definitive |
| "200 lines is plenty, I won't reach that" | Active projects reach it fast. Check and prevent now |
