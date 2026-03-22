Investigate this project's context and generate a handoff prompt for a clean session.

## Fundamental Rule

NO HANDOFF WITHOUT COMPLETE CONTEXT.
Do not generate the handoff prompt without first having investigated ALL context
sources listed in step 1. Each ignored source is lost context.

## Process

### 1. Investigate context

Execute EACH item below and record findings. Do not skip any.

{{#if modules.memory}}
**Project memory:**
- Run `ls {{memory_path}}` — list all files
- Read `{{memory_path}}MEMORY.md` with the Read tool
- If there are relevant memory files, read them with Read
{{/if}}

**Git state:**
- Run `git branch --show-current` — current branch
- Run `git log --oneline -15` — recent activity
- Run `git status` — uncommitted work
- Run `git stash list` — pending stashes
- Run `git diff --stat` — unstaged changes (summary)

**Work in progress:**
- Run `ls docs/plans/ 2>/dev/null` — existing plans
- Run `ls docs/ 2>/dev/null` — specs, brainstorms, artifacts
- Run `grep -rn "TODO\|FIXME\|HACK" . --include="*.*" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | head -20` — TODOs in the code

**Frameworks and tools:**
- Read the project's instruction file (e.g., `CLAUDE.md`) with Read to understand context
- Run `ls docs/ 2>/dev/null` — available documentation

### 2. Present summary

Organize findings in a structured format:

> **Project:** [directory name]
> **Branch:** [current branch] | **Last commit:** [message]
>
> **State:**
> - [Uncommitted work: yes/no — which files]
> - [Stashes: count]
> - [Existing plans: list]
>
{{#if modules.memory}}
> **Relevant memory:**
> - [Summary of key memory points]
>
{{/if}}
> What do you want to do next?
> A) Continue work in progress [describe]
> B) Start something new
> C) Other: [describe]

Wait for the user's response.

### 3. Generate handoff prompt

Based on the user's choice, generate a self-contained prompt that includes:

**Structure of the generated prompt:**
```
Project context:
- [1-3 sentences about what the project is, extracted from instructions/memory]
- Current branch: [branch]
- [work state: clean / in progress]

{{#if modules.memory}}
Relevant memory:
- [Only memory points relevant to the chosen task]
{{/if}}

Task:
- [What the user wants to do, as answered in step 2]
- [If continuing work: where it left off, which files, what the next step is]
- [If new: what needs to be done]

References:
- [File paths the agent should read for context]
```

**Rules for the generated prompt:**
- Include ONLY information necessary for the chosen task
{{#if modules.memory}}
- Do not include all memory — filter by relevance
{{/if}}
- Include concrete paths so the next session's agent can read them
- The prompt must be copy-pasteable — no formatting that depends on context

Present the prompt in a code block for easy copying:

> Handoff prompt generated. Paste into a new session:
> ```
> [prompt here]
> ```

### 4. Verify the generated prompt

Reread the generated prompt and verify that:
- It does not reference "this session" or context that only exists here
- It includes concrete file paths (not vague references)
- The task is clear for an agent with no prior context
{{#if modules.memory}}
- It does not include memory irrelevant to the chosen task
{{/if}}

If something is missing: adjust (max 1 correction iteration).

## Red Flags

- "I don't need to read memory, the git log is enough"
- "I'll skip the framework check, it's just code"
- "I'll include everything in the prompt — more context is better"
- "The prompt can be vague, the agent will figure out the rest"
- "I don't need to wait for the user to choose, I already know what they want"

If you thought any of the above: STOP. Execute the step you were skipping.

## Rationalization

| Temptation | Reality |
|------------|---------|
| "More context is always better" | Too much context pollutes — filter by relevance to the task |
| "I already know what the user wants" | You don't know — ask and wait |
| "The git log is enough for context" | Git shows what changed, not why or what's missing |
| "I don't need to verify the prompt, I just generated it" | Self-referential prompts are invisible to the writer |

## Closing

Report:
- Sources investigated: [count and which]
- Tool calls executed: [N] (Read: X, Bash: Y)
- Prompt generated: [yes/no, approximate size in lines]
- Task selected: [summary of user's choice]
