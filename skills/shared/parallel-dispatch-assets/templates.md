# parallel-dispatch family — emit-time templates (lazy)

Read at the **emit step**. These are the verbatim scaffolds consumed when
generating task prompts, writing the dispatch plan file, and reporting. The
Process logic (whether/when to emit, the HARD-GATEs, the isolation proof) stays
resident in the skill bodies; only the templates live here. This file is the
single canonical spec for the report fields — both skills reference it.

## Task prompt skeleton (parallel-dispatch · Phase 3)

For each task, emit a self-contained prompt with these sections in order. No
paraphrase — user wording goes in verbatim.

```
[Role + Context]
You are one of N parallel agents working on project `<repo name>` (cwd `<absolute path>`, branch `<branch>`). The other agents run in separate sessions — you cannot communicate with them.

[User's exact request for this task]
<verbatim copy of the user's original task statement — do not paraphrase or summarize>

[Acceptance criteria]
<verbatim from user if provided; omit section if not>

[Paths you may touch — strict]
- <exact path 1>
- <exact path 2>
- ...

[Branch]
Verify you are on branch `<branch>` before any operation (`git rev-parse --abbrev-ref HEAD`). If not: checkout first. All commits go to this branch.

[Commit protocol]
All commits from this session use prefix: `[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>] <type>: <description>`
Stage files ONLY by explicit path (e.g., `git add docs/onboard-mac.md`). NEVER `git add .` or `git add -A` — your session shares the working tree with sibling agents, and a broad stage will include their uncommitted changes.

[Restrictions — DO NOT]
- Do NOT touch paths outside the list above. If you need a path outside your scope, STOP and report.
- Do NOT run destructive git (push --force, reset --hard, branch -D, history rewrite).
- Do NOT use `git add .` or `git add -A` — always explicit paths (see above).
- Do NOT broadcast externally (no gh pr create, no external messaging, no notifications).
- Do NOT push — the user pushes when all agents complete.
- Do NOT exceed scope even if an adjacent fix looks "obvious".

[Ambiguity handling]
If architectural ambiguity OR a path outside your scope is required OR your diff grows beyond what the task requires: STOP and report to the user in chat. Do not commit a partial or contaminated state.
```

## Dispatch plan file (parallel-dispatch · Phase 4)

Write to `.atomic-skills/dispatches/<slug>.md` using {{WRITE_TOOL}}. Structure:

`````markdown
# Parallel Dispatch — <slug>

**Batch id (commit prefix):** `[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`
**Audit prefix:** `[audit-dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`
**Branch:** `<branch>`
**Confidence:** HIGH / MEDIUM / LOW
**Agents:** N task + 1 audit pass

## Verified decomposition

| # | Task | Scope (paths) | Deliverables |
|---|------|---------------|--------------|
| 1 | [title] | `<paths>` | [list] |
| 2 | [title] | `<paths>` | [list] |
| ... |

## Isolation evidence

- Pairwise grep outputs: `<citations of actual output>`
- `git status --porcelain` at dispatch time: `<output>`

## Shared-state warnings

Agents with disjoint source scopes can still collide indirectly via shared state:
- Lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `Cargo.lock`, `uv.lock`)
- Build artifacts (`dist/`, `.next/`, `target/`)
- Root config (`.gitignore`, `.env.example`, `tsconfig.json`)
- Caches (`__pycache__`, `.pytest_cache`)

If any task installs dependencies, regenerates a build, or edits root config: serialize those tasks or accept the collision risk.

---

## Agent 1 — [title]

**Open a new session and paste the prompt below.** The code block has a copy button.

```
[full prompt — self-contained, user request verbatim]
```

## Agent 2 — [title]
```
[full prompt]
```

...

---

## Run the audit

After all N task agents complete, open a fresh session and run:

```
atomic-skills:parallel-dispatch-audit <slug>
```

The audit reads this plan file automatically from `.atomic-skills/dispatches/<slug>.md`.

---

## Rollback

Revert all task commits in this batch:

```bash
git revert $(git log --format=%H --grep='\[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>\]' --reverse)
```

Audit commits carry `[audit-dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`; revert them separately if needed.

---

*Old dispatch plans in `.atomic-skills/dispatches/` can be removed once audit is complete — the prefix in git log is the authoritative record.*
`````

## Closing report — dispatch (parallel-dispatch)

Report:
- Body of work: [1-line summary]
- Precondition check: 4/4 passed (Q1-Q4)
- Tasks produced: N
- Confidence: HIGH / MEDIUM / LOW
- Isolation evidence: `<paired grep citations>`
- Branch: `<branch>`
- Batch id: `[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`
- Plan file: `.atomic-skills/dispatches/<slug>.md`
- Next action: user opens N new sessions and pastes task prompts
- Post-hoc: invoke `atomic-skills:parallel-dispatch-audit <slug>` after all agents complete

## Closing report — audit (parallel-dispatch-audit)

Report inline:
- Mode: full / degraded
- Batch id: `[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`
- Count check: expected N, found M (match / mismatch)
- Agents status: [X ✅ / Y 🟡 / Z ❌]
- Audit commits: M (prefix `[audit-dispatch-<slug>]`)
- Pending push: N in repo-A, M in repo-B (command: `git -C <repo> push`)
- Report: `.atomic-skills/dispatches/<slug>-audit.md`
- Next action: [1 sentence]
