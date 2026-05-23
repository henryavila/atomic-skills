<p align="center">
  <img src="assets/header.png" alt="Atomic Skills — Small. Specific. Capable." width="100%" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@henryavila/atomic-skills"><img src="https://img.shields.io/npm/v/@henryavila/atomic-skills.svg?label=npm&color=cb3837&logo=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@henryavila/atomic-skills"><img src="https://img.shields.io/npm/dm/@henryavila/atomic-skills.svg?color=blue" alt="npm downloads" /></a>
  <a href="https://github.com/henryavila/atomic-skills/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@henryavila/atomic-skills.svg?color=success" alt="license" /></a>
</p>

Optimized prompts you install once and invoke in any AI IDE. Each skill is an atom — small enough to stay focused, specific enough to leave no ambiguity, capable enough to make the agent actually follow through.

*Stop rewriting prompts.*

> **[View on npm](https://www.npmjs.com/package/@henryavila/atomic-skills)**

```bash
npx @henryavila/atomic-skills install
```

Install non-interactively for every IDE detected on this machine:

```bash
npx @henryavila/atomic-skills install --yes --all-detected
# equivalent:
npx @henryavila/atomic-skills install --yes --ide detected
```

Inspect supported and detected IDEs:

```bash
npx @henryavila/atomic-skills detect --json
```

## Why Atomic?

AI agents skip steps, rationalize shortcuts, and ignore vague instructions. Atomic Skills solve this with battle-tested techniques baked into every prompt:

- **Small** — one skill, one job. No bloat, no dependencies between skills
- **Specific** — every step names the tool, demands evidence, defines what "done" looks like
- **Capable** — Iron Laws, HARD-GATEs, Red Flags, Rationalization tables. Techniques that turn "the agent should do X" into "the agent will do X"

## Multi-Agent Optimization

Atomic Skills uses a **Polyglot Rendering Engine** that detects your agent and optimizes tool naming and instructions automatically.

- **Claude Code**: Native support for `Bash`, `Read tool`, `Edit tool`, and `Agent`.
- **Gemini CLI**: Native support for `run_shell_command`, `read_file`, `replace`, and `codebase_investigator`.
- **Generic/Others**: Standardized naming for maximum compatibility.

### Supported IDEs

| IDE | Profile | Directory | Format |
|-----|---------|-----------|--------|
| **Claude Code** | `claude-code` | `.claude/commands/atomic-skills/` | Command (slash) |
| **Gemini CLI** | `gemini` | `.gemini/skills/atomic-skills/` | Markdown (Recommended) |
| **Gemini CLI** | `gemini-commands`| `.gemini/commands/` | TOML (Slash commands) |
| Cursor | `cursor` | `.cursor/skills/atomic-skills/` | Markdown |
| Codex | `codex` | `.agents/skills/atomic-skills/` | Markdown |
| OpenCode | `opencode` | `.opencode/skills/atomic-skills/` | Markdown |
| GitHub Copilot | `github-copilot`| `.github/skills/atomic-skills/` | Markdown |

For details on the cross-agent rendering layer, see [docs/kb/gemini-cli-compatibility.md](docs/kb/gemini-cli-compatibility.md).

## Skills

> **Note (v3.0.0):** `review-plan-with-codex` and `review-code-with-codex`
> were merged into their same-model counterparts. The codex envelope flow
> is now opt-in via a Step 0 mode picker ("both", "local", or "codex").
> See [CHANGELOG.md](CHANGELOG.md) for migration.

### Overview

<!-- SKILLS_TABLE_START -->
| | Skill | One-liner | Iron Law |
|-|-------|-----------|----------|
| 🔧 | [`fix`](#atomic-skillsfix--root-cause--tdd) | Diagnose root cause → write test → fix → verify | `NO FIX WITHOUT ROOT CAUSE.` |
| 💾 | [`save-and-push`](#atomic-skillssave-and-push--commit--memory--push) | Save learnings to memory, group commits, push safely | `NO PUSH WITHOUT FRESH VERIFICATION.` |
| 🔍 | [`review-plan`](#atomic-skillsreview-plan--adversarial-local--codex) | Adversarial plan review with local/codex/both mode picker | `NO APPROVAL WITHOUT EVIDENCE.` |
| 🔬 | [`review-code`](#atomic-skillsreview-code--adversarial-local--codex) | Adversarial code review with local/codex/both mode picker | `NO APPROVAL WITHOUT EVIDENCE.` |
| 📊 | [`project-status`](#atomic-skillsproject-status--initiative-tracking) | Canonical per-initiative status tree with stack + parked + emerged | `NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE.` |
| 🗺️ | [`project-plan`](#atomic-skillsproject-plan--multi-phase-plan-bootstrap) | Bootstrap a multi-phase Plan with child Initiatives + Tasks | `NO PLAN WITHOUT NARRATIVE.` |
| 📝 | [`prompt`](#atomic-skillsprompt--generate-optimized-prompt) | Generate a self-contained prompt with exact paths and guardrails | `NO PROMPT WITHOUT CODEBASE ANALYSIS.` |
| 🎯 | [`hunt`](#atomic-skillshunt--adversarial-tests) | Write adversarial tests to break code, not confirm it | `NO HUNT WITHOUT BOUNDED SCOPE.` |
| 🚀 | [`parallel-dispatch`](#atomic-skillsparallel-dispatch--independent-tasks) | Dispatch a task list to N parallel sessions with verified isolation | `NO LAUNCH WITHOUT MECHANICAL SCOPE ISOLATION.` |
| 👁️ | [`parallel-dispatch-audit`](#atomic-skillsparallel-dispatch-audit--audit) | Audit output of a parallel-dispatch batch, apply fixes, report | `NO CONCLUSION WITHOUT EVIDENCE FROM DISK.` |
| 🧠 | [`init-memory`](#atomic-skillsinit-memory--persistent-context) | Centralize project memory to .ai/memory/ | `NO DELETION WITHOUT CONFIRMED BACKUP.` |
<!-- SKILLS_TABLE_END -->

---

<!-- SKILL_DETAILS_START -->
### `atomic-skills:fix` — Root Cause + TDD

**Iron Law:** `NO FIX WITHOUT ROOT CAUSE.`

**One-liner:** Diagnose root cause → write test → fix → verify

**Summary:** Root cause diagnosis + TDD fix. Use when you find a bug or unexpected behavior.

**Purpose:** Identify the root cause of a bug, write a reproducing test, and only then apply the fix. Detective mindset, not firefighter.

**When to use:**
- You observed a bug or unexpected behavior
- A test is failing for unclear reasons
- A regression appeared after a recent change

**When NOT to use:**
- You want to add a new feature (use prompt)
- The issue is in design, not implementation
- You have no symptom to reproduce

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `symptom` | positional | optional | Observed bug or unexpected behavior. If omitted, skill prompts interactively. |

**Examples:**
- `/atomic-skills:fix "duplicates in /musicas listing"` — Diagnose and fix with provided symptom
- `/atomic-skills:fix` — Skill prompts you for the symptom interactively

**Dependencies:** `git`

**Related:** `hunt`, `review-code`

**Tags:** `quality`, `debugging`, `tdd`, `core`

**Version added:** `1.0.0`

---

### `atomic-skills:save-and-push` — Commit + Memory + Push

**Iron Law:** `NO PUSH WITHOUT FRESH VERIFICATION.`

**One-liner:** Save learnings to memory, group commits, push safely

**Summary:** Review conversation, save learnings to memory, commit and push work.

**Purpose:** End-of-session ritual: extract learnings to persistent memory, stage relevant files, commit with conventional message, push to remote.

**When to use:**
- You finished a coherent piece of work
- About to switch context or end the session
- You want learnings persisted before forgetting

**When NOT to use:**
- Work in progress, not yet a coherent commit
- Tests still failing
- You only want to commit (use git directly)

**Examples:**
- `/atomic-skills:save-and-push` — Full flow: memory + commits + push

**Dependencies:** `git`

**Related:** `project-status`, `init-memory`

**Tags:** `workflow`, `git`, `memory`, `core`

**Version added:** `1.0.0`

---

### `atomic-skills:review-plan` — Adversarial (Local + Codex)

**Iron Law:** `NO APPROVAL WITHOUT EVIDENCE.`

**One-liner:** Adversarial plan review with local/codex/both mode picker

**Summary:** Adversarial review of an implementation plan. Step 0 picks mode: local self-loop, codex cross-model envelope, or both (local first → codex on cleaned plan). Optional cross-reference against external artifacts.

**Purpose:** Adversarial review with mode picker: local (cheap, fast), codex (cross-model via OpenAI Codex CLI, ~$1-2), or both (default — local first, codex second on cleaned plan with sealed envelope). Optionally cross-references against source artifacts. Iterates up to 3 passes in local; two-pass envelope in codex.

**When to use:**
- You finished writing a plan and want a structural review
- Significant plan about to enter execution (both mode recommended)
- Cross-model bug hunt against self-preference bias (codex or both)
- Plan was derived from a PRD/spec and you want coverage verification

**When NOT to use:**
- Plan is still brainstorming (not structured yet)
- Trivial plan (skip review entirely)
- Codex CLI not installed and you need codex mode (use --mode=local)

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `plan-path` | positional | required | Path to the plan markdown file under review. |
| `--mode` | option | optional | Force a review mode (local, codex, both, or the v2.x alias internal). Skips the Step 0a picker. |
| `--no-cross-ref` | flag | optional | Skip the Step 0b cross-ref picker; force internal-only. |
| `--cross-ref` | option | optional | Comma-separated list of artifact paths to cross-reference against. Skips the picker. |
| `--artifacts` | option | optional | Alias of --cross-ref (compat with v2.x). |
| `--allow-dirty` | flag | optional | Pass through to the codex pre-flight; suppresses the dirty-tree abort. |

**Examples:**
- `/atomic-skills:review-plan docs/plans/migration.md` — Interactive picker — chooses mode + cross-ref
- `/atomic-skills:review-plan docs/plans/migration.md --mode=local` — Force local-only self-loop
- `/atomic-skills:review-plan docs/plans/migration.md --mode=both` — Local then codex (sealed envelope)

**Output artifacts:** `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md (codex/both modes)`, `.atomic-skills/reviews/INDEX.md`

**Dependencies:** `codex`, `git`

**Related:** `review-code`

**Tags:** `review`, `planning`, `adversarial`, `cross-model`

**Version added:** `2.0.0`

---

### `atomic-skills:review-code` — Adversarial (Local + Codex)

**Iron Law:** `NO APPROVAL WITHOUT EVIDENCE.`

**One-liner:** Adversarial code review with local/codex/both mode picker

**Summary:** Adversarial review of code changes given a git ref (branch, commit, or range). Step 0 picks mode: local self-loop, codex cross-model envelope, or both (local first → codex on the same captured diff).

**Purpose:** Review a git ref (branch, commit, or range) adversarially. Mode picker: local (cheap, fast), codex (cross-model via OpenAI Codex CLI, ~$1-2), or both (default — local first, codex second on the byte-identical captured diff with sealed envelope). Range-aware ref validation + shape-specific diff command.

**When to use:**
- You finished a coherent code change
- Significant change about to merge (both mode recommended)
- Critical path (auth, payments, data integrity) — both mode
- Cheap pre-merge sanity check (local mode)

**When NOT to use:**
- No git ref to review (and you don't want to commit/stash first)
- Trivial change already heavily reviewed
- Codex CLI not installed and you need codex mode (use --mode=local)

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `git-ref` | positional | required | Branch, single commit, or commit range (a..b / a...b). |
| `--mode` | option | optional | Force a review mode (local, codex, both). Skips the Step 0 picker. |
| `--allow-dirty` | flag | optional | Include working-tree changes in the captured diff; suppresses the dirty-tree abort. |

**Examples:**
- `/atomic-skills:review-code main..HEAD` — Interactive picker — chooses mode
- `/atomic-skills:review-code feat/new-feature --mode=local` — Force local-only self-loop
- `/atomic-skills:review-code main..HEAD --mode=both` — Local then codex (sealed envelope)

**Output artifacts:** `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md (codex/both modes)`, `.atomic-skills/reviews/INDEX.md`

**Dependencies:** `codex`, `git`

**Related:** `review-plan`, `fix`, `hunt`

**Tags:** `review`, `code`, `adversarial`, `cross-model`

**Version added:** `2.0.0`

---

### `atomic-skills:project-status` — Initiative Tracking

**Iron Law:** `NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE.`

**One-liner:** Canonical per-initiative status tree with stack + parked + emerged

**Summary:** Canonical per-initiative status tracking. Maintains .atomic-skills/ tree with stack + tasks + parked + emerged per initiative. Terminal compact view + browser via mdprobe. Auto-installs CLAUDE.md HARD-GATE + AGENTS.md redirect + Claude Code hooks (SessionStart injection, Stop predicate in dry-run). Use whenever starting, resuming, pushing/popping stack frames, parking lateral findings, or viewing status across sessions and worktrees.

**Purpose:** Track work via Plan/Initiative/Task hierarchy with stack, parked, emerged, and verifiable exit gates. Bird's-eye + zoom mental model.

**When to use:**
- Starting a new piece of work
- Resuming after a break
- Pushing or popping a stack frame
- Parking lateral findings or emerging new initiatives
- Viewing status across sessions or worktrees

**When NOT to use:**
- One-shot questions
- Work that fits entirely in the current session
- Creating a multi-phase plan (use project-plan instead)

**Subcommands:**

| Example | Description |
|---------|-------------|
| `/atomic-skills:project-status new-plan v3-redesign` | Bootstrap a new Plan via the project-plan skill |
| `/atomic-skills:project-status new my-feature` | Create a new Initiative (standalone or under active plan) |
| `/atomic-skills:project-status push "investigating slow query"` | Push a new stack frame (lateral expansion) |
| `/atomic-skills:project-status pop --park` | Pop top frame with destination |
| `/atomic-skills:project-status park "consider caching layer"` | Add a parked item (note for later, no decision yet) |
| `/atomic-skills:project-status emerge "auth refactor needed"` | Add an emerged finding (real follow-up worth promoting) |
| `/atomic-skills:project-status promote 2` | Promote a parked item to a real task |
| `/atomic-skills:project-status done T-005` | Mark task done; triggers phase-completion check if last |
| `/atomic-skills:project-status phase-done` | Verify exit gates, advance to next phase (prompts codex review) |
| `/atomic-skills:project-status phase-reopen F2` | Reverse of phase-done — clears metAt on exit criteria |
| `/atomic-skills:project-status archive v3-redesign` | Move plan/initiative to archive/ (cascades from plan to children) |
| `/atomic-skills:project-status switch my-feature` | Pause current active plan/initiative, set target as active |
| `/atomic-skills:project-status migrate sample-legacy` | Migrate a legacy file to schema 0.1 |
| `/atomic-skills:project-status re-ratify P-3` | Re-articulate context of an existing item (stale lastReviewedAt) |
| `/atomic-skills:project-status re-bootstrap sample-legacy` | Batch re-articulate placeholder context after migrate |
| `/atomic-skills:project-status scope-creep` | On-demand drift report (read-only, surfaces stale items) |
| `/atomic-skills:project-status detect-scope` | Suggest scope.paths value based on recent git activity |

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `--list` | flag | optional | List all initiatives across all plans |
| `--plan` | option | optional | Filter view to a specific plan slug |
| `--phase` | option | optional | Filter view to a specific phase id |
| `--stack` | flag | optional | Show only the active stack (compact view) |
| `--archived` | flag | optional | Show archived items |

**Examples:**
- `/atomic-skills:project-status` — View current state
- `/atomic-skills:project-status new my-feature` — Start a new standalone initiative
- `/atomic-skills:project-status push "investigating slow query"` — Push a side-investigation frame
- `/atomic-skills:project-status done T-005` — Close a task (triggers phase-completion check if last)

**Output artifacts:** `.atomic-skills/PROJECT-STATUS.md`, `.atomic-skills/plans/<slug>.md`, `.atomic-skills/initiatives/<slug>.md`, `.atomic-skills/status/config.json`, `.atomic-skills/dispatches/<slug>.md (when promote-to-dispatch)`

**Dependencies:** `git`

**Related:** `fix`, `save-and-push`, `project-plan`

**Tags:** `tracking`, `anchoring`, `planning`, `core`

**Version added:** `1.5.0`

---

### `atomic-skills:project-plan` — Multi-Phase Plan Bootstrap

**Iron Law:** `NO PLAN WITHOUT NARRATIVE.`

**One-liner:** Bootstrap a multi-phase Plan with child Initiatives + Tasks

**Summary:** Bootstrap a multi-phase Plan in .atomic-skills/plans/<slug>.md with N child Initiatives + Tasks. Entry point for starting planning work — the creator counterpart to project-status (the manager). Decomposes a markdown plan into structured Plan + Initiatives + Tasks; optionally delegates discovery and plan-writing to superpowers. Use the `adopt` mode to retroactively capture an existing markdown plan.

**Purpose:** Bootstrap a multi-phase Plan + N child Initiatives in one flow. Walks 7 stages (validate slug → detect superpowers → optional delegation → receive markdown → decompose → create files → activate first phase). `adopt` mode captures an existing markdown plan retroactively.

**When to use:**
- User describes a multi-phase project ("redo our admin UI", "rebuild matching")
- A free-form plan markdown exists somewhere and should be captured (use `adopt`)
- A `project-status:new` invocation was pushed back as "bigger than one initiative"

**When NOT to use:**
- Single-phase work that fits in one initiative (use `project-status:new`)
- .atomic-skills/ does not exist yet (run `atomic-skills:project-status` setup first)
- You only need to view existing plans (use `project-status --plan <slug>`)

**Subcommands:**

| Example | Description |
|---------|-------------|
| `/atomic-skills:project-plan adopt docs/plans/v3-redesign/00-master.md` | Capture an existing markdown plan into structured Plan + Initiatives + Tasks |

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `slug` | positional | optional | Plan slug for the default (bootstrap) flow. Omit and the skill prompts interactively. |

**Examples:**
- `/atomic-skills:project-plan v3-redesign` — Bootstrap a new Plan interactively (7-stage flow)
- `/atomic-skills:project-plan adopt docs/superpowers/plans/v3-redesign/00-master.md` — Capture an existing markdown plan into structured state

**Output artifacts:** `.atomic-skills/plans/<slug>.md`, `.atomic-skills/initiatives/<slug>.md`

**Dependencies:** `git`

**Related:** `project-status`, `review-plan`

**Tags:** `planning`, `bootstrap`, `core`

**Version added:** `3.0.0`

---

### `atomic-skills:prompt` — Generate Optimized Prompt

**Iron Law:** `NO PROMPT WITHOUT CODEBASE ANALYSIS.`

**One-liner:** Generate a self-contained prompt with exact paths and guardrails

**Summary:** Generate an optimized, self-contained prompt from a task description. Use when you need a precise prompt with exact file paths and guardrails.

**Purpose:** Turn a vague task description into an optimized, self-contained prompt with file paths, guardrails, and acceptance criteria. Use as input to another AI session.

**When to use:**
- You have a vague task and want to make it actionable
- You need to brief a parallel agent precisely
- You will hand off the work to a different session

**When NOT to use:**
- You will execute the task in this same session
- You need a multi-phase plan (use project-plan)
- You want to dispatch many tasks (use parallel-dispatch)

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `task` | positional | optional | Task description in natural language. If omitted, skill asks interactively. |

**Examples:**
- `/atomic-skills:prompt "refactor auth middleware to use new session API"` — Generate a precise prompt with file paths and guards
- `/atomic-skills:prompt` — Skill asks for task interactively

**Related:** `parallel-dispatch`, `fix`, `project-plan`

**Tags:** `meta`, `generation`, `planning`

**Version added:** `1.0.0`

---

### `atomic-skills:hunt` — Adversarial Tests

**Iron Law:** `NO HUNT WITHOUT BOUNDED SCOPE.`

**One-liner:** Write adversarial tests to break code, not confirm it

**Summary:** Write adversarial tests for existing code to find hidden bugs. Use when code lacks tests or you suspect untested edge cases. Requires a bounded scope — one class or function per run.

**Purpose:** Write adversarial tests to break code and find hidden bugs. Bounded to one class or function per run.

**When to use:**
- Code lacks tests
- You suspect untested edge cases
- Pre-merge quality check

**When NOT to use:**
- Scope larger than 1 class or function
- Existing test suite is already comprehensive
- You want to add features (use prompt instead)

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `target` | positional | required | File, directory, or function/class to hunt. Directory mode caps at 30 files. |

**Examples:**
- `/atomic-skills:hunt src/matcher.php` — Hunt bugs in a single file
- `/atomic-skills:hunt src/auth/` — Triage mode for directory (max 30 files)

**Dependencies:** `git`

**Related:** `fix`, `review-code`

**Tags:** `testing`, `quality`, `pre-implementation`

**Version added:** `1.0.0`

---

### `atomic-skills:parallel-dispatch` — Independent Tasks

**Iron Law:** `NO LAUNCH WITHOUT MECHANICAL SCOPE ISOLATION.`

**One-liner:** Dispatch a task list to N parallel sessions with verified isolation

**Summary:** Dispatch a user-provided list of independent tasks to N parallel sessions with verified scope isolation and a batch id for tracking. Validates parallelism benefit (Q1-Q4 HARD-GATE) before exploring; proves scope disjointness via pairwise grep before generating prompts. Use when the user brings a consolidated task list — this skill does NOT invent tasks.

**Purpose:** Verify, isolate, and dispatch a user-provided task list to N parallel sessions. Mechanical scope isolation, batch id, and audit pass.

**When to use:**
- You have a finalized list of independent tasks
- Tasks have concrete file-path scopes
- You will be away while agents run

**When NOT to use:**
- Work fits in the current session
- The list is still exploratory
- Tasks have hard sequential dependencies

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `task-list` | positional | required | Path to the markdown file containing the finalized task list. |

**Examples:**
- `/atomic-skills:parallel-dispatch task-list.md` — Dispatch validated task list

**Output artifacts:** `.atomic-skills/dispatches/<batch-id>.md`

**Dependencies:** `git`

**Related:** `parallel-dispatch-audit`, `prompt`

**Tags:** `parallelism`, `dispatch`, `workflow`

**Version added:** `1.6.0`

---

### `atomic-skills:parallel-dispatch-audit` — Audit

**Iron Law:** `NO CONCLUSION WITHOUT EVIDENCE FROM DISK.`

**One-liner:** Audit output of a parallel-dispatch batch, apply fixes, report

**Summary:** Audit the output of a parallel-dispatch batch. Reads the plan file, verifies each agent's deliverables on disk against the user's original request, applies cosmetic fixes, and produces a report with pending decisions. HARD-GATEs on active batch (<2min commits) and read-only mode (≥5 issues). Use after parallel-dispatch agents complete.

**Purpose:** Verify each dispatched agent's deliverables on disk against the original plan. Cosmetic fixes only; ≥5 issues triggers read-only mode.

**When to use:**
- A parallel-dispatch batch has completed
- You need objective verification of agent outputs

**When NOT to use:**
- Agents are still running (commits less than 2 min old)
- You want to refactor what agents wrote (out of scope)

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `slug` | positional | optional | Batch slug to audit. Defaults to the most recent dispatch. |

**Examples:**
- `/atomic-skills:parallel-dispatch-audit onboard-ci` — Audit batch by slug

**Output artifacts:** `.atomic-skills/dispatches/<slug>.md (annotated with audit results)`

**Dependencies:** `git`

**Related:** `parallel-dispatch`

**Tags:** `parallelism`, `audit`, `review`, `quality`

**Version added:** `1.6.0`

---

### `atomic-skills:init-memory` — Persistent Context

**Iron Law:** `NO DELETION WITHOUT CONFIRMED BACKUP.`

**One-liner:** Centralize project memory to .ai/memory/

**Summary:** Initialize persistent memory structure for cross-session context.

**Purpose:** Bootstrap the persistent memory directory and index so that future sessions can pick up where this one left off.

**When to use:**
- First time using atomic-skills in a project
- Memory directory missing or corrupted
- You want to standardize the memory layout

**When NOT to use:**
- Memory already initialized and healthy

**Examples:**
- `/atomic-skills:init-memory` — Bootstrap memory in the current project

**Output artifacts:** `.ai/memory/MEMORY.md`

**Related:** `save-and-push`

**Tags:** `memory`, `setup`

**Version added:** `1.0.0`

---
<!-- SKILL_DETAILS_END -->

<details>
<summary>Legacy hand-written per-skill prose (preserved here while the generated section above is canonical)</summary>

### `atomic-skills:fix` — Root Cause Diagnosis + TDD Fix

**Problem it solves:** Agents jump straight to a fix without investigating the root cause, producing fragile patches that break in other scenarios and introduce regressions.

**What it does:** Enforces a 4-phase detective process — observe evidence, diagnose with testable hypotheses, fix with TDD (test first, fix second), and verify with the full suite.

**When to use:** Whenever you find a bug or unexpected behavior in code.

**Advantages:**
- Eliminates guesswork fixes — every correction has a documented root cause with line numbers
- Test cluster covers regression, equivalence partitions, boundaries, and error inputs
- Mental mutation spot-checks verify each condition has coverage ("if I changed `>=` to `>`, would a test catch it?")
- 5-hypothesis escalation limit prevents infinite loops

**Iron Law:** `NO FIX WITHOUT ROOT CAUSE`

---

### `atomic-skills:hunt` — Adversarial Tests for Existing Code

**Problem it solves:** Code without tests or with shallow coverage hides silent bugs. Tests written "to confirm" the code (instead of breaking it) are tautological and catch nothing.

**What it does:** Writes aggressive, adversarial tests designed to *break* code, not confirm it. Single-file: 6-phase deep hunt (read, understand intent, map gaps, plan attack, write, report). Directory: triages by risk and spawns isolated subagents per file.

**When to use:** When code lacks tests, coverage is low, or you suspect untested edge cases.

**Advantages:**
- HARD-GATE against tautology: "Does the expected value come from SPEC or CODE?" — if from code, the test is useless
- Risk-based ranking for directories (0 test refs OR >8 commits = high risk)
- Isolated subagents per file prevent cross-file context contamination
- Bugs found generate a structured report with a reproducing test ready for `as-fix`

**Iron Law:** `NO HUNT WITHOUT BOUNDED SCOPE`

---

### `atomic-skills:prompt` — Optimized Prompt Generation

**Problem it solves:** Generic prompts fail because they lack exact file paths, real codebase context, and guardrails against agent shortcuts.

**What it does:** Explores the codebase first (Glob, Grep, Read), identifies relevant files and dependencies, then generates a self-contained prompt with Iron Law, tool-naming steps, Red Flags, and a task-specific Rationalization table.

**When to use:** When you need a precise prompt with exact paths and guardrails — whether to execute yourself or delegate to a subagent.

**Advantages:**
- Generated prompt has verified absolute paths (not guesses)
- Each step names the tool and requires evidence (line numbers)
- Offers 3 options: copy, execute via subagent, or adjust
- Compatible with any IDE via template variables

**Iron Law:** `NO PROMPT WITHOUT CODEBASE ANALYSIS`

---

### `atomic-skills:parallel-dispatch` — Dispatch a Task List to N Parallel Sessions

**Problem it solves:** You have a consolidated list of independent tasks you want to run in parallel sessions while you sleep / attend a meeting / work on something else. Running agent swarms without structure causes file collisions, paraphrased intent, broad-stage git contamination, and merge wars. Sequential work leaves the machine idle.

**What it does:** Takes a user-provided task list and dispatches it through a four-gate pipeline. **HARD-GATE #1 (Q1-Q4)** validates parallelism benefit — aborts on exploratory requests, non-concrete end states, trivial scope, or hard dependencies. **HARD-GATE #2** proves scope disjointness via pairwise grep (convergence criterion, no operational limits). Generates N self-contained prompts with the user's original request **verbatim** (no paraphrase), a unique batch id (`[dispatch-<timestamp>-<slug>]`), branch record, and explicit `git add <path>` protocol (blocks `git add -A` contamination from sibling sessions). Writes the combined plan to `.atomic-skills/dispatches/<slug>.md` and asks before opening it in mdprobe.

**When to use:** User has a well-defined task list with paths per task. Skill is NOT for brainstorming or inventing tasks from a vague prompt — it validates what the user brought and dispatches mechanically.

**Advantages:**
- HARD-GATE #1 aborts bad-fit invocations early (exploratory work, hard deps, trivial scope)
- Convergence criterion over arbitrary operation limits — stops exploring when decomposition hypothesis stabilizes
- User's task text preserved verbatim in each prompt — no lossy paraphrase
- Batch id is unique per invocation (timestamp + slug) — `git log --grep` audits are deterministic
- Explicit `git add <path>` protocol prevents sibling-session staging contamination
- Confidence scoring (HIGH/MEDIUM/LOW) — LOW refuses by default

**Iron Law:** `NO LAUNCH WITHOUT MECHANICAL SCOPE ISOLATION`

> **Related: `superpowers:dispatching-parallel-agents`**
> Different dispatch model, different problem:
> - Use **superpowers** when work fits the current session — `Task()` primitive runs sub-agents synchronously inside the parent context. Good for "3 failing test files to debug right now".
> - Use **parallel-dispatch** when you're stepping away — copy-paste handoff to N fresh sessions, parent context freed, persistent plan + audit trail. Good for overnight work, long meetings, or when the parent context is tight.
>
> The two are complementary, not substitutes.

---

### `atomic-skills:parallel-dispatch-audit` — Audit a parallel-dispatch Batch

**Problem it solves:** After N parallel agents run, trusting commit messages leads to silent failures — empty files commit fine, wrong content commits fine, broken cross-references commit fine. Without a narrow-authority auditor, either nothing gets verified or the auditor refactors what it shouldn't.

**What it does:** Reads the plan file at `.atomic-skills/dispatches/<slug>.md`, inventories commits by batch id (`git log --grep`), runs a count check (expected N vs found M), opens **every** expected deliverable on disk, audits each agent on 4 dimensions (completeness, quality, integration, executability), runs a 2.5th pass for documentation integrity and shared-state collisions, applies cosmetic fixes with a derived `[audit-dispatch-<slug>]` prefix, consolidates memory if in scope, and produces a report with push-status and pending decisions. **Active-batch HARD-GATE** pauses if the latest matching commit is <2 min old (slow agent misclassified as failed). **Read-only mode** triggers on ≥5 issues or architectural problems — no fixes, report only.

**When to use:** After all `parallel-dispatch` agents complete — run in a fresh session with the batch slug as argument. Supports a **degraded mode** when no plan file is present (manual dispatch).

**Advantages:**
- HARD-GATE #1: ≥5 issues or any architectural problem → read-only mode (prevents piecemeal fixes hiding a bad dispatch)
- HARD-GATE #2: latest commit <2 min old → pause and confirm completion (prevents misclassifying slow agents)
- Narrow authority: verify + cosmetic fix only. No refactor, no revert without confirmation, no auto-push
- Count check (expected N vs found M) catches incomplete batches early
- Phase 2.5 catches broken cross-references AND shared-state collisions (lockfiles, build artifacts, root config) the N agents missed
- Contradiction protocol: newest timestamp wins, with explicit resolution logged
- Degraded mode for manual dispatches: audit by prefix only when plan is absent, announce limitation

**Iron Law:** `NO CONCLUSION WITHOUT EVIDENCE FROM DISK`

---

### `atomic-skills:review-plan` — Adversarial Plan Review (Local + Codex)

**Problem it solves:** Plans contain internal contradictions, broken dependencies, ambiguous tasks, and missing steps. When derived from a PRD/spec, the plan also drifts silently — requirements get oversimplified, ACs lose details, phantom features creep in. Same-model review (Claude reviewing Claude) misses bugs by self-preference bias (arXiv [2410.21819](https://arxiv.org/abs/2410.21819)); cross-model review alone still misses bugs that self-review catches cheaply. Empirically the two modes catch DISJOINT sets of findings (verified across two real sessions; see CHANGELOG 3.0.0 rationale).

**What it does:** Step 0a picks the review mode; Step 0b picks cross-ref scope.

- **Mode picker (Step 0a):**
  - **Both (default)** — local self-loop runs first (catches contradictions, broken deps, ordering); plan is fixed inline; then codex cross-model review runs on the CLEANED plan with sealed envelope.
  - **Local only** — same-model self-loop. Cheap, fast.
  - **Codex only** — straight to cross-model envelope. Use when another agent already self-reviewed.
- **Cross-ref picker (Step 0b)** — orthogonal to mode picker. `Internal only` runs the 7-item self-loop checklist; `Cross-reference with detected/custom artifacts` adds 6 more checks (requirement coverage, AC, phase gates, dep graph, schema/API, UX) and activates the HARD-GATE forbidding artifact edits.

Codex sub-flow follows the **two-pass sealed envelope** pattern (Pass 1 blind / Pass 2 informed, delta = framing-bias signal). When mode=both, the codex briefing receives only the CLEANED plan + external constraints — NEVER the local findings or fix log.

**When to use:**
- Significant plan about to enter execution — use `both`.
- Cheap structural sanity check — use `local`.
- Cross-model bug hunt only — use `codex`.

**Pre-requisites for codex/both modes:**
- OpenAI Codex CLI installed (`npm install -g @openai/codex` or `brew install --cask codex`)
- `codex login` completed
- Clean working tree (or `--allow-dirty` flag)

**Non-interactive callers** (loops in `project-plan` Stage 8b, `project-status` phase-completion review) MUST pass `--mode=local` (alias `--mode=internal`) to skip the picker.

**Output (codex/both modes):** Consolidated review file in `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md` with both pass outputs, reconciliation, framing delta, and (in `both` mode) the local fix log. `INDEX.md` tracks history.

**Advantages:**
- Mode picker formalizes the empirical workflow ("both" covers disjoint findings)
- Sealed envelope contract — codex never sees local findings or fix descriptions; preserves the cross-model invariant
- Cross-ref HARD-GATE forbids editing source artifacts
- All findings cite line numbers (local) or `file:line` + 4 fields (codex)
- Code-quality self-review (G1 + G2 + G6) catches bare assertions and soft-language

**Iron Law:** `NO APPROVAL WITHOUT EVIDENCE` + `NO INTENT IN THE BRIEFING` (codex sub-flow)

See [`docs/kb/cross-model-review-design.md`](docs/kb/cross-model-review-design.md) for envelope design.

---

### `atomic-skills:review-code` — Adversarial Code Review (Local + Codex)

**Problem it solves:** Reviewing code with the same model that wrote it misses bugs by self-preference bias. Especially risky in critical paths (auth, payments, data integrity, async/concurrent logic). Empirically same-model and cross-model catch DISJOINT sets of bugs.

**What it does:** Same mode picker (local / codex / both, default both) for code changes given a git ref — branch, single commit, or commit range (`main..HEAD`, `main...HEAD`).

- **Range-aware ref validation** — triple-dot detected FIRST (avoids the classic `'main...HEAD'.split('..')` bug), then double-dot, then SINGLE.
- **Shape-specific diff command** — commit: `git show --patch`; branch: `git diff $(git merge-base <base> <branch>)..<branch>`; range: `git diff <range>`. Never `git diff <single-ref>` raw (leaks worktree edits).
- **Captured diff invariant** — both phases (local checklist + codex briefing) consume the SAME `CAPTURED_DIFF` materialized once; never re-run `git diff`. Guarantees byte-identical material across reviewers.

**Local mode** runs a 7-item checklist (logic bugs, race conditions, error handling, schema/migrations, API contracts, file/function references, test coverage), iterating up to 3 passes.

**Codex sub-flow** runs the **two-pass sealed envelope** pattern (Pass 1 blind / Pass 2 informed). When mode=both, the codex briefing receives only the CLEANED diff + external constraints — NEVER the local findings or fix log.

**When to use:**
- Critical change (auth, payments, data integrity) — use `both`.
- Routine pre-merge sanity check — use `local`.
- Cross-model bug hunt only — use `codex`.

**Pre-requisites for codex/both modes:** Same as `review-plan` (codex CLI + login + clean tree or `--allow-dirty`).

**Output (codex/both modes):** Consolidated review file in `.atomic-skills/reviews/` with both pass outputs, reconciliation, framing delta, and (in `both` mode) the local fix log.

**Advantages:**
- Mode picker covers the empirically disjoint find-sets
- Sealed envelope contract preserved across local→codex hand-off
- Range-aware validation avoids ref-parsing bugs; shape-specific diff avoids worktree leaks
- Cost-aware: warns if diff exceeds 50KB before invoking codex
- Code-quality self-review (G1 + G2 + G3 + G4 + G7) for the fixes you apply

**Iron Law:** `NO APPROVAL WITHOUT EVIDENCE` + `NO INTENT IN THE BRIEFING` (codex sub-flow)

---

### `atomic-skills:save-and-push` — Save Work & Publish

**Problem it solves:** Work stays scattered in conversation, memory isn't preserved for future sessions, commits are chaotic, and secrets get accidentally committed.

**What it does:** Reviews conversation to extract learnings (saves to memory), saves work-in-progress as files, groups commits by logical unit (feature, layer, nature), formats code if configured, and pushes — with HARD-GATE on main/master.

**When to use:** At the end of a work session, or whenever you want to save progress and publish.

**Advantages:**
- Persistent memory: patterns and decisions survive between sessions
- Logically grouped commits (not a dump of everything)
- Secret filtering (.env, credentials) with mandatory STOP
- HARD-GATE prevents direct push to main/master — requires branch + PR

**Iron Law:** `NO PUSH WITHOUT FRESH VERIFICATION`

---

### `atomic-skills:project-status` — Canonical Per-Initiative Status Tracking

**Problem it solves:** Users and AI agents lose track of where they are mid-implementation when tasks spawn sub-tasks, bugs, scope expansions, and lateral explorations across sessions and worktrees.

**What it does:** Maintains `.atomic-skills/PROJECT-STATUS.md` (index) and `.atomic-skills/initiatives/<slug>.md` (per-initiative: stack + tasks + parked + emerged + next action) as canonical source of truth. Three enforcement layers: (a) skill invocation, (b) CLAUDE.md HARD-GATE + AGENTS.md redirect auto-installed, (c) Claude Code hooks (SessionStart injection + Stop predicate in dry-run). Terminal rendering is compact and works out of the box; browser rendering is optional via `npx -y @henryavila/mdprobe` with Mermaid Gantt/Flowchart/Stack diagrams.

**When to use:** Starting a new initiative, resuming after context switch, pushing a new stack frame (research/discussion), parking lateral findings, promoting parked items, marking tasks done, archiving, or viewing current state.

**Advantages:**
- Single canonical source; survives sessions and worktrees
- Enforcement via hooks (not just prompts) — hard to "forget"
- Cross-repo scope auto-tracked from tool activity
- Terminal + browser rendering built-in
- AGENTS.md compatibility for multi-IDE projects

**Iron Law:** `NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE`

---

### `atomic-skills:init-memory` — Persistent Memory Initialization

**Problem it solves:** Projects have memory scattered across different locations (`.memory/`, `.claude/memory/`, `docs/memory/`, etc.), causing duplication, context loss, and inconsistency.

**What it does:** Detects existing memory in all known locations, migrates to the canonical path (`.ai/memory/`), organizes by theme, configures Claude Code integration (`autoMemoryDirectory`), and cleans up original directories (with confirmation).

**When to use:** When starting a new project or standardizing memory structure for an existing one.

**Advantages:**
- Single canonical location, versioned in git and shared with the team
- Respects the 200-line MEMORY.md limit (content beyond is silently truncated by Claude)
- Safe migration: copies first, validates, only removes originals with confirmation
- `autoMemoryDirectory` support for direct integration (no redirect needed)

**Iron Law:** `NO DELETION WITHOUT CONFIRMED BACKUP`

</details>

---

## Techniques

Each skill uses a combination of these techniques to prevent agent shortcuts:

| Technique | What it does | Example |
|-----------|-------------|---------|
| **Iron Law** | One non-negotiable rule at the top | `NO FIX WITHOUT ROOT CAUSE` |
| **HARD-GATE** | Mandatory stop before a dangerous action | "If modifying code without a test: STOP" |
| **Precondition Check** | Validate skill fit before paying exploration cost | Q1-Q4: scope consolidated? end states concrete? wallclock gain? independent? |
| **Convergence Criterion** | Stop exploring when hypothesis stabilizes; no arbitrary op limits | "Would the next grep change my decomposition? If no, stop" |
| **Red Flags** | Thoughts that mean you're skipping steps | "I already know what the bug is" |
| **Rationalization Table** | Maps tempting shortcuts to why they fail | "The fix is obvious" → "Obvious to whom? Prove it" |
| **Evidence Requirement** | Every claim must cite line numbers or tool output | "Cite file:line, not 'I checked'" |
| **Escalation Limit** | Max attempts before asking the human | "5 hypotheses failed → escalate" |
| **Test List** | Enumerate test surface before writing any test | Regression + partitions + boundaries + errors |
| **Mental Mutation** | For each condition in the fix: "would a test catch the inverse?" | "If I changed >= to >, would a test catch it?" |
| **Autonomous Mode** | Rules for subagents that can't interact with user | "Auto-split >300 lines, always continue on bugs" |

## Development & Quality Assurance

To ensure cross-agent compatibility, Atomic Skills includes a specialized test suite that acts as a linter for prompt templates.

```bash
npm test
```

The test suite verifies:
1. **Tool Name Abstraction**: Ensures no hardcoded tool names (like `Bash` or `Read tool`) exist in the source `.md` files.
2. **Conditional Rendering**: Validates that agent-specific instructions are correctly included/excluded for Claude and Gemini.
3. **Multi-Format Export**: Verifies Markdown and TOML generation for all supported profiles.

When creating new skills, always use the variables defined in `AGENTS.md`.

## Modules

Modules bundle optional skills, shared assets, or hooks on top of the core skills. Today, activation happens through the interactive dashboard (`customize modules` action) — there is no `--modules` CLI flag. The `memory`, `codex-bridge`, and `auto-update` modules are enabled on every install.

### Memory

Persistent context across sessions. The agent saves learnings, decisions, and feedback that survive between conversations.

- Configurable path (default: `.ai/memory/`)
- Adds the `atomic-skills:init-memory` skill
- Supports Claude Code's `autoMemoryDirectory` for direct integration (no redirect needed)
- Available in both project and user scope installations

### Codex Bridge (new in 1.8.0)

Shared infrastructure for the codex sub-flow inside `review-plan` and `review-code`. Asset-only module (no invocable skills of its own) — bundles the 11 templates and checklists consumed by the codex envelope:

- Anti-framing directive (literal text injected into every briefing)
- Pre-flight checks, canonical Codex invocation, output validation checklist
- Pass 1 / Pass 2 output templates + Pass 2 prompt suffix (reconciliation block)
- Briefing templates (plan + code) and consolidated review file template
- Reviews INDEX.md row template

Assets are installed per-IDE at `<ide-namespace>/_assets/` (e.g. `.claude/commands/atomic-skills/_assets/`) and referenced from the skills via the `{{ASSETS_PATH}}` template variable.

### Auto-Update (new in 1.8.0)

SessionStart hook that notifies you when a new version is available on npm — without polling or interrupting your flow.

- Hook script installed at `~/.atomic-skills/hooks/version-check.sh`
- Merged into `~/.claude/settings.json` non-destructively (coexists with existing hooks)
- 24h TTL on npm checks; async background fetch (0ms perceived latency)
- Opt-out via `ATOMIC_SKILLS_NO_UPDATE_CHECK=1` env var
- Configurable TTL via `ATOMIC_SKILLS_UPDATE_CHECK_TTL=<seconds>`
- Currently covers **Claude Code** only (Cursor, Gemini CLI, Codex, OpenCode, GitHub Copilot have different lifecycles)

## Install, Update, Uninstall

```bash
# Default: user scope (~/.claude/, ~/.gemini/, …) — shared across every project
npx @henryavila/atomic-skills install

# Project scope: installs into ./ so the team can version-control the skills
npx @henryavila/atomic-skills install --project

# Same command updates an existing install (preserves local edits via 3-hash diff)
npx @henryavila/atomic-skills install

# Inspect which IDEs are supported and which were detected on disk
npx @henryavila/atomic-skills detect [--project] [--json]

# Show installed skills, language, and per-IDE file status
npx @henryavila/atomic-skills status

# Remove everything (add --project to target ./ instead of ~/)
npx @henryavila/atomic-skills uninstall [--project]
```

**Scope trade-off:**
- *user scope* (default): one install serves every project; not versioned in git.
- *project scope* (`--project`): skills live in the repo, are versioned, and overlay the user scope. Pick this for teams.

## License

MIT
