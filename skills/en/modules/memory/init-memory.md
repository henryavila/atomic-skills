Standardize this project's memory to `{{memory_path}}` (canonical, versioned in git).

Announce when starting: "I will standardize this project's memory to `{{memory_path}}`."

## Fundamental Rule

NO DELETION WITHOUT CONFIRMED BACKUP.
Original memory directories can only be removed AFTER confirming that
ALL files were successfully copied to `{{memory_path}}`.
Confirm = run `ls` on both directories and compare.

## Process

### 1. Detect existing memory

Scan the project by running `ls` and `find` on known locations:
- `{{memory_path}}`
- `.memory/`
- `docs/memory/`
- Any other directory referenced in the project's instructions as memory

Run `grep -r "memory\|memória" CLAUDE.md AGENTS.md 2>/dev/null` to
find non-obvious references.

If you find unexpected directories, list them and ask the user.

### 2. Present findings and request confirmation

List what you found with origin, file count, and total size.

Present as Structured Options:

> Found memory in:
> 1. `.memory/` (8 files, 12KB)
> 2. `docs/memory/` (3 files, 4KB)
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
Removal only happens in step 7, after ALL validation.
If the user asks to remove now: explain that validation
ensures safety and removal comes at the end.
</HARD-GATE>

### 4. Organize content

- **Already has structure** (multiple thematic files): preserve as-is
- **No memory at all**: create `{{memory_path}}MEMORY.md` with an empty index
- **Single blob** (one giant file with everything mixed): separate into thematic
  files grouped by affinity. Descriptive names matching the domain.
  Only mandatory file: `MEMORY.md` as the index.

### 5. Update project instructions

- If the project's instruction file does NOT exist: create it with a memory section
- If it ALREADY exists: add or update the memory section

Minimum content for the section:
```
## Memory
Consult `{{memory_path}}MEMORY.md` before implementing.
Update memory when learning something relevant for future sessions.
```

### 6. Update broken references

Run `grep -r` on the old memory paths throughout the entire project.

- **Operational files** (project instructions, agent configs):
  update references to `{{memory_path}}`
- **Historical docs** (plans, designs, specs): list the references
  but DO NOT change without asking — they are historical records

### 7. Validation and cleanup

Verify by running each command (not just "verify"):

- Run `ls {{memory_path}}` — should show the migrated files
- Run `ls {{memory_path}}MEMORY.md` — should exist
- Verify that the project instructions reference `{{memory_path}}`

If EVERYTHING passed: now remove the original directories (the ones that were migrated).
For each directory to remove, list the full path and ask for confirmation:

> Remove original directory `.memory/`? (files are already in `{{memory_path}}`)
> Type "remove" to confirm.

## Closing

Present report:
- Files migrated: [count] from [origin(s)]
- Project instructions: [created/updated]
- References updated: [which files]
- Directories removed: [which]
- Problems found: [if any]

## Red Flags

- "I'll remove the original directory before validating"
- "The content was probably copied, I don't need to test"
- "The project instructions should already have the reference, I don't need to check"
- "I'll edit a historical doc to update the path"
- "That unexpected memory directory is probably not important"

If you thought any of the above: STOP. Run the verification you were skipping.
