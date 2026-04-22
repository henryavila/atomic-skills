Audit the output of a parallel-dispatch batch. Read the plan file, verify each agent's deliverables on disk, apply minor fixes, consolidate memory if scoped, and produce a report.

If {{ARG_VAR}} was provided, use it as the batch slug (e.g., `onboard-ci`). The plan file is at `.atomic-skills/dispatches/<slug>.md`.

If no slug was provided: ask the user. If the user does not have a plan file (manual dispatch without this skill), enter **degraded mode** — audit by commit prefix only, skip per-agent validation, surface the limitation in the report.

## Iron Law

NO CONCLUSION WITHOUT EVIDENCE FROM DISK.
Commit messages are not proof. For every expected deliverable, open the actual file with {{READ_TOOL}} and verify content. A passing commit over an empty file is still a failure.

<HARD-GATE: Active-batch detection>
If the latest commit matching the dispatch prefix is less than 2 minutes old: STOP. Confirm with the user that all N agents have reported completion before auditing. A slow agent still running would be misclassified as failed.
</HARD-GATE>

<HARD-GATE: Read-only mode>
Triggers when ANY of the following is true:
  - ≥5 issues found across all agents
  - Scope drift detected (an agent wrote outside its declared paths)
  - Wrong abstraction introduced (dependency or pattern the plan did not allow)
  - Destructive operation committed in the batch (force push, history rewrite)
  - Entire deliverable missing (absent, not partial)
  - Breaking change to a public API not declared as changing

When read-only mode is triggered:
  - CANNOT: {{REPLACE_TOOL}} or {{WRITE_TOOL}} on any file created/touched by the dispatched agents
  - CANNOT: `git commit`, `git revert`, `git reset`, `git rebase` of any kind
  - CAN: {{WRITE_TOOL}} on the audit report file only
  - CAN: {{READ_TOOL}}, {{GREP_TOOL}}, {{GLOB_TOOL}}, {{BASH_TOOL}} for read-only operations

Read-only means the report is written, nothing else changes. Five or more issues signal that the dispatch plan itself was wrong; piecemeal fixes hide the root cause.
</HARD-GATE>

## Mindset

You are a reviewer, not an implementer. Audit authority is narrow by design: verify, apply cosmetic fixes only, report. Refactoring what the agents wrote destroys the traceability the commit-prefix convention buys.

Trust nothing until you read it. Commit messages lie by omission; line counts lie by weight; file existence lies by content. Open and read.

## Process

### Phase 1 — Inventory and count check

Do not trust any description of what the agents should have done. Read the actual git output and the plan.

**1.1 Read the plan (full mode) or enter degraded mode**
With {{READ_TOOL}}, open `.atomic-skills/dispatches/<slug>.md`. Extract:
- Batch id (commit prefix)
- Expected branch
- N (number of task agents)
- Per-agent scopes and deliverables

If the plan is absent: enter degraded mode. Ask user for the commit prefix and N, and note in the report:
> **Mode: degraded** — no plan file found. Per-agent deliverable validation skipped; audit limited to commit inventory.

**1.2 Inventory commits**
For each repo in scope (derive from the plan's scopes; usually 1 repo), run with {{BASH_TOOL}}:

```bash
git log --grep='\[dispatch-<...>\]' --oneline
git log --grep='\[dispatch-<...>\]' --stat
git log --grep='\[dispatch-<...>\]' --name-only
```

Check branch:
```bash
git rev-parse --abbrev-ref HEAD
```

Compare to plan's expected branch. If divergent, record as a warning in the report.

**1.3 Count check**
- Expected: N task agents per plan
- Found: distinct commit clusters matching the prefix (one cluster per agent's scope)
- If mismatch: flag immediately. This is a first-order signal that the dispatch is incomplete or polluted.

**1.4 Active-batch check**
Check timestamp of latest matching commit. If < 2 min old: trigger the HARD-GATE above and confirm completion with user before proceeding.

### Phase 2 — Audit each agent

For every agent listed in the plan, answer 4 questions. Use {{READ_TOOL}} for content, {{BASH_TOOL}} for structural checks:

1. **Completeness** — Do the expected files exist? (`ls`, `test -f`)
2. **Quality** — Does the content match the user's original task description from the plan? OPEN AND READ. Do not trust linecounts or commit messages.
3. **Integration** — Are cross-references correct? (Does `MEMORY.md` point to new files? Do README badges link to workflows that exist? Do imports resolve?)
4. **Executability** — For executable outputs (scripts, workflows, Dockerfiles):
   - `bash -n <script>` for syntax
   - `yamllint` or `actionlint` for workflows (if available locally)
   - Do NOT force `docker build` or destructive runs if tools aren't present — record as "not verified locally"

Classify each agent:
- ✅ **Passed** — delivered complete and correct
- 🟡 **Partial** — delivered with minor fixable issues (typos, broken links, missing frontmatter)
- ❌ **Failed** — not delivered or broken (may need revert or user decision)

### Phase 2.5 — Operational cross-checks

Even when an agent "passes" its own scope, it may have missed updates to sibling docs that reference its artifacts. Run a second pass focused on **documentation integrity**:

- Do onboarding/setup docs (`docs/onboard-*.md`, `README.md`, migration guides) still reference the right files?
- Are links between newly-created artifacts and existing docs intact?
- Do any existing docs mention files that were renamed or moved?
- Do CI/workflow references (badges, status checks) point to paths that actually exist?

Also check for **shared-state collisions** (lockfiles, build artifacts, root config) modified by more than one agent — warn even if content merged cleanly.

Record broken references and collision warnings as 🟡 fixable issues.

### Phase 3 — Apply fixes with audit prefix

For each 🟡 issue that is **cosmetic or reference-level fixable**:
- Fix with {{REPLACE_TOOL}} or {{WRITE_TOOL}}
- Commit with prefix `[audit-dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]` — derived from the batch slug so audit commits are traceable

Fixable examples:
- Typos, broken internal links, missing frontmatter
- Wrong path references in YAML/docs
- Missing `MEMORY.md` pointer to a newly-created file

NOT fixable (escalate to user as pending decision):
- Architectural decisions
- Scope drift (agent wrote outside declared paths)
- Missing entire deliverable
- Anything requiring `git revert` — do NOT revert without explicit user confirmation. If you believe a revert is warranted, record it as a pending decision in the report, not a fix

If read-only mode was triggered in the HARD-GATE: SKIP this phase entirely.

### Phase 4 — Consolidate memory (if in scope)

Only if the dispatch plan included a memory-consolidation task.

{{#if modules.memory}}
1. Verify the canonical snapshot file exists at `{{memory_path}}` (e.g., `project_current_state.md`) and is coherent.
2. **Zero churn by churn:** if the memory-consolidation agent delivered ✅, skip rewrite. Only update `MEMORY.md` pointer if it is missing or stale.
3. **Contradiction criteria:** if handoffs or memory files contradict, prefer the entry with the **most recent timestamp** AND record the resolution explicitly in the audit report:
   > Ambiguity resolved: `<X>` preferred over `<Y>` by criterion `<timestamp | explicit user decision | internal consistency>`
4. Respect the soft cap of 200 lines / 25 KB on `MEMORY.md`.
5. Commit with `[audit-dispatch-<slug>] consolidate memory after batch`.
{{/if}}

### Phase 5 — Report

Write `.atomic-skills/dispatches/<slug>-audit.md` using {{WRITE_TOOL}} with this structure:

```markdown
# Audit Report — <slug> <date>

**Mode:** full / degraded
**Batch id:** `[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`
**Branch:** `<branch>` (divergent from plan: yes/no)
**Count check:** expected N, found M → match / mismatch

## Status Matrix

| Agent | Scope | Status | Commits | Issues |
|-------|-------|--------|---------|--------|
| 1     | ...   | ✅/🟡/❌ | N       | ...    |
| 2     | ...   | ✅/🟡/❌ | N       | ...    |
| ...   |       |        |         |        |

## Evidence per Agent

### Agent 1
- Files created: [list]
- Quality assessment: [1-2 lines]
- Issues found: [list]
- Fixes applied: [commit SHAs with `[audit-dispatch-<slug>]`]

### Agent 2
(same structure)

## `[audit-dispatch-<slug>]` fixes applied

- `<sha>` — description
- ...

## Ambiguities resolved

- `<X>` preferred over `<Y>` by criterion `<...>`

## Shared-state notes

- Lockfile / build / config collisions observed: yes / no [describe]

## Pending decisions for user

- [issues not fixed]
- [architectural decisions]
- [suggested reverts with rationale]

## Single-step recommendation

[One sentence — what the user should do first upon returning.]
```

After writing the report, present its path and ASK BEFORE opening the browser:

> Audit report written to `.atomic-skills/dispatches/<slug>-audit.md`.
>
> Open in browser via mdprobe for review and annotation? (y/n)

Opening a browser is an intrusive side effect — never auto-launch. Only run mdprobe after the user answers "y".

If confirmed, run with {{BASH_TOOL}}:

```bash
mdprobe .atomic-skills/dispatches/<slug>-audit.md 2>/dev/null || npx -y @henryavila/mdprobe .atomic-skills/dispatches/<slug>-audit.md
```

If declined: "Open the file manually at `.atomic-skills/dispatches/<slug>-audit.md` when ready."

### Phase 6 — Chat summary

In the chat, produce:

1. Mode: full / degraded
2. Count check: expected vs found
3. Status per agent: ✅/🟡/❌ one line each
4. Actions taken: list of `[audit-dispatch-<slug>]` commits (SHA + one-line description)
5. Single-step recommendation: one clear action
6. Report location: `.atomic-skills/dispatches/<slug>-audit.md`
7. **Push status (REQUIRED):**
   > Local audit commits pending push: N in `<repo-A>`, M in `<repo-B>`.
   > To propagate: `git -C <repo> push`

Do NOT push automatically. Let the user decide when returning.

## Red Flags

- "The commit message says it worked — I trust it"
- "Line count matches the expectation — I won't open the file"
- "Small refactor while I'm here would be cleaner"
- "I'll revert the broken agent to save the user trouble"
- "Push the fixes so the user finds it ready"
- "≥5 issues but I can still handle them, won't abort"
- "Contradictions — I'll just pick one silently"
- "Scope drift is fine if the code is better"
- "Latest commit is 30 seconds old but probably done"
- "Plan file is missing — I'll invent expected scopes"

If you thought any of the above: STOP. Audit authority is narrow by design.

## Rationalization Table

| Temptation | Reality |
|------------|---------|
| "The commit exists, the work is done" | Empty commits and wrong content also commit fine. Open the file |
| "I can fix this architectural issue quickly" | You are the auditor, not the implementer. Escalate |
| "Pushing saves the user time" | The user decides when to propagate — don't preempt |
| "I'll revert the failed agent" | Reverts without user confirmation destroy recoverable work |
| "Minor issues — I can keep going past 5" | 5+ issues means the dispatch plan was wrong; piecemeal fixes hide the root cause |
| "Contradiction between docs? Pick one quietly" | Record the resolution — silent picks erase evidence |
| "Scope drift is fine if the code is better" | The user did not approve that change. Escalate |
| "Latest commit is recent but probably done" | <2 min is the HARD-GATE line. Confirm with user |
| "Plan file missing, I'll invent expected scopes" | That's degraded mode — announce it, don't pretend |

## Closing Report

Report inline:
- Mode: full / degraded
- Batch id: `[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`
- Count check: expected N, found M (match / mismatch)
- Agents status: [X ✅ / Y 🟡 / Z ❌]
- Audit commits: M (prefix `[audit-dispatch-<slug>]`)
- Pending push: N in repo-A, M in repo-B (command: `git -C <repo> push`)
- Report: `.atomic-skills/dispatches/<slug>-audit.md`
- Next action: [1 sentence]
