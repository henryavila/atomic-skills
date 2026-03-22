Review this conversation, save learnings to memory, and commit + push the work.

## Fundamental Rule

NO PUSH WITHOUT FRESH VERIFICATION.
If you did not run `git status` and `git diff` IN THIS execution of the command, you cannot push.

<HARD-GATE>
If the current branch is main or master:
STOP. Ask the user: push directly to main or create branch + PR?
DO NOT push to main/master without explicit confirmation.
</HARD-GATE>

## Process

### 1. Save learnings to memory

{{#if modules.memory}}
Identify learnings useful for FUTURE sessions:
- Decisions made and their reasons
- Bugs found and their root causes
- Patterns that worked or failed
- User feedback on approach

DO NOT save: context from this conversation that won't be useful later, facts that can
be derived by reading code or `git log`, ephemeral details (temporary branches,
discarded attempts, corrected typos).

If `{{memory_path}}` does not exist, run `as-init-memory` first.
Update existing files instead of creating duplicates.
Keep `MEMORY.md` as an up-to-date index.
{{/if}}

### 2. Save work in progress

If there is work in progress (brainstorm, plan, artifact, spec),
save it to the corresponding file. Do not leave work only in conversation context.

### 3. Prepare commits

**3a. Gather complete state:**
Run `git status` — list the full output.
Run `git diff --stat` — summary of changes per file.
Run `git diff` — analyze the content of changes.
Run `git log --oneline -5` — see recent commit style.

**3b. Filter files that should NOT be committed:**
Run `git diff --name-only` and analyze each changed file:
- **Sensitive** (NEVER commit without asking): `.env`, `.env.*`, `credentials.*`,
  `*secret*`, `*token*`, `*.pem`, `*.key`
- **Suspicious content:** run `grep -rn "password\|api_key\|secret\|token\|Bearer" <changed files>`
- **Generated files** that should not be in the repo: `node_modules/`, `dist/`,
  `__pycache__/`, `.DS_Store`, `*.log`
- **Unrelated files** to this session's work: if a file appears
  in the diff but was not intentionally modified, DO NOT include it in the commit.
  Ask the user if unsure.

If any sensitive or suspicious files are found: STOP and ask the user.

**3c. Classify and group by logical unit:**
Analyze the remaining files and group by functional affinity.
DO NOT make one giant commit with everything. DO NOT make one commit per file.

Grouping criteria (from most specific to most general):
1. **Same feature/fix:** files implementing the same functionality together
2. **Same layer:** if there's no clear feature, group by nature:
{{#if modules.memory}}
   - Memory (`{{memory_path}}`) = separate commit
{{/if}}
   - Documentation (`docs/`) = separate commit
   - Code/commands = separate commit
   - Config/infra = separate commit
   - Tests = together with the code they test
3. **If EVERYTHING is the same nature:** 1 commit is sufficient

Present the commit plan for review:
> Planned commits:
> 1. `feat: [description]` — files: [list]
> 2. `docs: [description]` — files: [list]
> Proceed?

**3d. Execute commits:**
For each group, run `git add <group files>` followed by `git commit`.
Descriptive messages with conventional prefixes (feat, fix, docs, refactor).
NEVER use `git add .` or `git add -A` — always name files explicitly.

### 4. Push

Run `git status` — confirm it's clean after commits.
Check the current branch with `git branch --show-current`.
Apply the HARD-GATE above if it's main/master.
Run `git push` for the current branch.
Run `git status` again — confirm the push was accepted.

## Closing

Report:
- Learnings saved: which memory files were changed
- Commits: count, messages, branch
- Push: final status (success/failure)
- If something failed: describe the error and suggest a fix

## Red Flags

- "I'll push without checking, I already know it's fine"
- "It's just a small file, no need for git status"
- "I'll include the .env because the user didn't mention secrets"
- "I'll push to main, it's just a quick fix"
- "I don't need to separate commits, it's all related"
- "I've already seen the diff mentally, no need to run git diff"
- "I'll use git add . to be faster"
- "That unrelated file should probably be committed too"

If you thought any of the above: STOP. Run the verification you were skipping.
