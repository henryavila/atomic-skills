Take a task description and generate an optimized, self-contained prompt ready for execution.

If $ARGUMENTS was provided, use it as the task description.
If not, ask the user: "What do you want the AI to do?"

## Iron Law

NO PROMPT WITHOUT CODEBASE ANALYSIS.
Do not generate the prompt without first exploring the codebase and identifying
relevant files. A prompt without exact file paths is a generic prompt — and generic prompts fail.

## Process

### 1. Understand the task

Read the provided description. Identify:
- **Goal:** what needs to be done (1 sentence)
- **Type:** fix, feature, refactor, migration, review, docs, other
- **Estimated scope:** how many files will likely be touched

Present to the user for confirmation:
> **Goal:** [description]
> **Type:** [type]
> Correct?

### 2. Explore the codebase

Using Glob and Grep tools, find files relevant to the task:
- Run Glob to find files by pattern (e.g., `src/auth/**/*.ts`)
- Run Grep to find references by content (e.g., `function login`)
- Read the most relevant files with the Read tool (max 5 files)
- Identify dependencies and related files

Record:
> **Main files:** [list with exact paths]
> **Related files:** [list with exact paths]
> **Relevant structure:** [2-3 line summary of how the code is organized]

### 3. Generate the optimized prompt

Create a prompt following this structure:

```
[Direct task description in 1-2 sentences]

## Iron Law

NO [FORBIDDEN ACTION] WITHOUT [PRECONDITION].
[1-line explanation]

## Context

[Summary of relevant codebase — structure, patterns, main files]

Relevant files:
- `[exact path]` — [what it contains, why it matters]
- `[exact path]` — [same]

## Process

### 1. [First step]
[Concrete action with named tool]
[Evidence required: "cite line numbers" / "list the output"]

### 2. [Second step]
...

### N. Verify result
[Exact command to verify it worked]
[Clear success criteria]

## Red Flags

- "[dangerous thought specific to this task]"
- "[another dangerous thought]"

If you thought any of the above: STOP. Go back to the step you were skipping.

## Rationalization

| Temptation | Reality |
|------------|---------|
| "[task-specific rationalization]" | "[why it's a trap]" |
```

**Rules for the generated prompt:**
- Named tools (Read, Grep, Glob, Bash) — never vague verbs
- Evidence required at each step (line numbers, output)
- Exact, complete file paths
- Iron Law at the top — specific to the task
- Red Flags — anticipate the most likely rationalizations for this task
- Rationalization Table — anticipate the most dangerous mental shortcuts for this specific task
- Self-contained — someone reading the prompt with no context should be able to execute it
- Nothing beyond what's needed — YAGNI applied to the prompt itself

### 4. Present and decide

Present the generated prompt in a code block for easy copying.

Offer options:

> Prompt generated. How would you like to execute?
> A) Copy to clean session (recommended for complex tasks)
> B) Execute now via subagent (clean context, without leaving this session)
> C) Adjust before executing

### 5. Execute (if option B)

Dispatch a subagent with the generated prompt as the complete instruction.
The subagent receives ONLY the prompt — no context from this session.

## Red Flags

- "The task is simple, I don't need to explore the codebase"
- "I already know which files are relevant, no need for Glob/Grep"
- "I'll generate a generic prompt and the agent will figure it out"
- "This task doesn't need an Iron Law"
- "I'll include context from this session in the subagent"

If you thought any of the above: STOP. Go back to the step you were skipping.

## Rationalization Table

| Temptation | Reality |
|------------|---------|
| "Simple task doesn't need an optimized prompt" | Simple tasks with vague prompts produce vague results |
| "The agent already knows where the files are" | Does it? Prove it — run Glob and confirm |
| "Exploring the codebase is a waste of time" | 2 minutes of exploration prevents 20 minutes of rework |
| "Generic Red Flags will do" | Red Flags must be task-specific — generic ones get ignored |

## Closing Report

Report:
- Task: [description]
- Files found: [count]
- Prompt generated: [yes/no, size in lines]
- Execution: [copied / subagent dispatched / adjusted]
