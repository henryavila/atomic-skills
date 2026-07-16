Take a well-defined list of independent tasks and dispatch them to N parallel sessions with mechanically isolated file scopes plus one audit pass. The decomposition must come from the user — this skill validates and dispatches, it does not invent tasks.

If {{ARG_VAR}} was provided, use it as the task list. If not, ask the user: "What is the list of tasks, with paths for each?"

## Iron Law

NO LAUNCH WITHOUT MECHANICAL SCOPE ISOLATION.
Every parallel agent must operate on a file path set that does not intersect with any other agent's set. "These features are independent" is a guess — only paths are verifiable via grep + status.

## Mindset

Decomposition is your input, not your output. If you are inventing tasks from a vague user request, you are the wrong tool — redirect to brainstorming or prompt-generation. Your job is to verify, dispatch, and hand off.

Parallel work is discipline, not a shortcut. Give each agent a self-contained brief with the user's exact request; never paraphrase intent. Audit afterward — bug budget compounds: 3 agents with 10% bug rate each → ~27% chance of ≥1 bug (1 − 0.9³). Skipping the audit pass defeats the pattern.

## Don't use when

- **Work fits the current session** — for in-session parallel investigations while the user is active, dispatch read-only sub-agents directly via `{{INVESTIGATOR_TOOL}}` (synchronous, coordination stays in the parent context). This skill is for cross-session hand-off, not in-session fan-out.
{{#if ide.grok}}
  On Grok Build, that in-session path is `spawn_subagent` (explore). Do not invent custom plugin agent types for v1 — built-in explore/plan + this skill's cross-session isolation are enough.
{{/if}}
- **User will stay at the keyboard the whole run** — cross-session handoff costs copy-paste friction; only pays off when the user is away (sleeping, in a meeting, switched tasks) or the parent context is tight.
- **Investigations are short** (under ~15 min each) — setup overhead of this skill (~10 min for plan + audit) outweighs the parallelism gain.
- **User's request is vague** — HARD-GATE #1 will abort; redirect to `atomic-skills:brainstorm` or `atomic-skills:prompt` first.

## Process

### Phase 0 — Validate parallelism benefit (HARD-GATE #1)

<HARD-GATE>
Before spending any exploration or generation budget, validate 4 preconditions. Extract from {{ARG_VAR}} when stated; otherwise ask.

**Q1. Scope consolidation**
Does the user have a finalized list of tasks, or are they still figuring out what to do?
→ If exploratory ("clean up X", "improve Y", "figure out Z"): ABORT.
  Redirect: "This is discovery work, not dispatch work. Use `atomic-skills:brainstorm` or `atomic-skills:prompt` to consolidate scope first, then return."

**Q2. Concrete end states**
For each task, is there a verifiable end state (file exists with content X, test T passes, doc section S exists)?
→ If any task lacks a concrete end state: ABORT.
  Redirect: "Task #N lacks a verifiable end state. Refine into a concrete deliverable before dispatching."

**Q3. Wallclock benefit**
Does the work benefit from parallelism beyond the skill's setup overhead (~10 min for plan + audit)?
→ If all tasks combined are trivial in sequence: ABORT.
  Redirect: "Too small for parallelism overhead. Run sequentially via `atomic-skills:prompt`."

**Q4. Task independence**
Classify dependencies between tasks:
- **None**: tasks are fully decoupled ✓
- **Soft**: Task B references Task A's artifact in a doc or import, but does not block on A's timing ✓
- **Hard**: Task B's code requires Task A's output to exist before B can be written ✗

→ If any pair has hard deps: ABORT.
  Redirect: "Hard sequential dependency between Task A and Task B. Use `atomic-skills:prompt` in sequence, or split parallel-ready tasks from sequential ones."

If all 4 pass: proceed to Phase 1.
</HARD-GATE>

### Phase 1 — Verify decomposition

The user brought the decomposition. Your job is to prove the scopes are disjoint, not to invent new ones.

**1.1 Extract scopes per task**
From {{ARG_VAR}} or the user's answer, collect for each task:
- Task title (user's wording, verbatim)
- File paths the task will touch (user declares; never infer)
- Acceptance criteria (user's wording, verbatim, if provided)

If paths were not declared for a task: ASK. Never guess.

**1.2 Probe repo state**
Run with {{BASH_TOOL}}:
- `git rev-parse --abbrev-ref HEAD` — record the current branch (needed in Phase 3)
- `git status --porcelain` — includes tracked-modified AND untracked (more coverage than `git diff`)

Intersect user-declared scopes with currently-modified/untracked paths. Flag overlaps — WIP on a path a dispatched agent will touch = collision risk.

**1.3 Grep pairwise for cross-references**
For each pair of scopes (A, B), verify disjoint references with {{GREP_TOOL}}: scope A never appears referenced in scope B's paths and vice versa. Record the actual grep output as evidence for the plan file.

**1.4 Read-targeted (only if structure is ambiguous)**
Read module headers, index/init files, module READMEs — never full implementations. You are verifying boundaries, not debugging.

**1.5 Convergence check (HARD-GATE #2)**

<HARD-GATE>
Stop exploring when you can answer YES to all three:
1. Every scope has an exact path set I can enumerate (no fuzzy phrasing like "most of src/")
2. I have grep output proving no cross-references between any pair of scopes
3. The next Read/Grep I might run would not change the decomposition hypothesis

If exploration cannot converge (each new op keeps revealing new unknowns): the task is not cleanly decomposable. Classify confidence as LOW and ABORT. Suggest sequential execution or finer decomposition. A third remedy, when the tasks must run in parallel despite touching a shared tree: isolate each in its own git worktree per `skills/shared/worktree-isolation.md` — concurrent writers then never share a working tree (the merge-back is still serial).

No operational limits (no "max N greps") — convergence is the criterion. If you are still learning, continue. If you are not, stop.

Evidence required on exit:
- Paired grep outputs (cite them in the plan file)
- `git status --porcelain` output
- Current branch recorded
</HARD-GATE>

**1.6 Classify confidence**
- **HIGH** — all scopes are net-new directories OR grep cross-refs are zero with zero coupling
- **MEDIUM** — scopes in separate modules with indirect coupling that does not touch the declared paths
- **LOW** — coupling detected OR exploration did not converge

Present to user:

> **Verified decomposition:**
> 1. [Task 1] — scope: `<paths>`, deliverables: `<list>`
> 2. [Task 2] — scope: `<paths>`, deliverables: `<list>`
> ...
>
> **Evidence:**
> - Paired grep (Task 1 ↔ Task 2): `<output>`
> - `git status --porcelain`: `<output>`
> - Branch: `<branch>`
>
> **Confidence:** HIGH / MEDIUM / LOW
>
> Proceed? (y/n)

Wait for approval. LOW refuses by default; continuing requires an explicit "proceed LOW" from the user and is considered exceptional.

### Phase 2 — Generate the batch id (commit prefix)

Auto-generate a unique batch id in this format:

```
[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]
```

- `<slug>` is a short semantic kebab derived from the first task title (or user-supplied)
- Seconds in timestamp prevent collision if the skill runs twice in the same minute
- Example: `[dispatch-20260422-153045-onboard-ci]`

Record also the audit commit prefix for later: `[audit-dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]` — derived from the same base so audit commits are traceable to their dispatch.

Escape brackets in grep: `\[dispatch-...\]`.

### Phase 3 — Generate N task prompts

For each task, emit a self-contained prompt per the **Task prompt skeleton** in `skills/shared/parallel-dispatch-assets/templates.md` ({{READ_TOOL}} it and fill the slots). No paraphrase — user wording goes in verbatim.

Rules for each prompt:
- Self-contained — sibling agents never referenced by name (they run in different sessions; the reference would be meaningless)
- User's exact request preserved — paraphrase loses intent
- Explicit file scope listed by path
- DO NOT list repeated verbatim in every prompt — each prompt is pasted into an isolated session with no shared location to consult; duplication is required, not laziness
- Branch recorded so agents verify before acting

### Phase 4 — Write the plan file

Write to `.atomic-skills/dispatches/<slug>.md` using {{WRITE_TOOL}}. The `.atomic-skills/` directory holds the project-tracking state, so the plan persists across reboots; commit it (or ignore it locally) per the repo's convention.

Use the **Dispatch plan file** template in `skills/shared/parallel-dispatch-assets/templates.md` ({{READ_TOOL}} it and fill the slots — header, verified decomposition table, isolation evidence, shared-state warnings, one block per agent, the audit/rollback footers).

### Phase 5 — Hand off (with browser confirmation)

Present the plan path in chat and ASK before opening the browser:

> Plan ready at `.atomic-skills/dispatches/<slug>.md`.
>
> Batch id: `[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`
> Branch: `<branch>`
> Confidence: HIGH / MEDIUM / LOW
>
> Open in browser via mdprobe for easy copy-paste? (y/n)
>
> **Rollback if needed:** `git revert $(git log --format=%H --grep='\[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>\]' --reverse)`

Opening a browser is an intrusive side effect — never auto-launch. Only run mdprobe after the user answers "y".

If confirmed, run with {{BASH_TOOL}}:

```bash
mdprobe .atomic-skills/dispatches/<slug>.md 2>/dev/null || npx -y @henryavila/mdprobe .atomic-skills/dispatches/<slug>.md
```

The fallback `npx -y @henryavila/mdprobe` handles environments where mdprobe is not pre-installed. mdprobe's singleton server reuses an existing instance if one is already running.

If declined: "Open the file manually at `.atomic-skills/dispatches/<slug>.md` when ready."

## Red Flags

- "User said 'clean up X', I'll figure out tasks myself" — that's not dispatch, that's brainstorming
- "Tasks aren't well-defined but user wants parallel, I'll just go"
- "I'll paraphrase the user's request; they meant [my interpretation]"
- "Disjoint source paths, so the agents are isolated" — lockfiles, builds, configs share state indirectly
- "I'll let agents use `git add -A` since each scope is small"
- "The tasks are obviously independent, I'll skip the grep verification"
- "Convergence not reached but I'll send it anyway"
- "Confidence LOW but probably fine"
- "One file is shared but it's small, I'll just merge later"
- "The audit agent can refactor what the implementers wrote"
- "I'll dispatch 10 agents because I'm in a hurry"

If you thought any of the above: STOP. Parallel work is discipline; shortcuts defeat it.

The refutation detail behind each Red Flag — the load-bearing numbers (bug-budget math, the cap at 5) — lives in `skills/shared/parallel-dispatch-assets/rationalization.md` (§ parallel-dispatch); {{READ_TOOL}} it when a flag above tempts a shortcut.

## Closing Report

Report per the **Closing report — dispatch** spec in `skills/shared/parallel-dispatch-assets/templates.md` ({{READ_TOOL}} it for the canonical field list).
