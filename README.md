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

<!-- IDES_TABLE_START -->
| IDE | Profile | Directory | Format |
|-----|---------|-----------|--------|
| Claude Code | `claude-code` | `.claude/commands/atomic-skills/` | Command (slash) |
| Cursor | `cursor` | `.cursor/skills/atomic-skills/` | Markdown |
| Gemini CLI (Skills) | `gemini` | `.gemini/skills/atomic-skills/` | Markdown |
| Gemini CLI (Commands) | `gemini-commands` | `.gemini/commands/` | TOML (Slash commands) |
| Codex | `codex` | `.agents/skills/atomic-skills/` | Markdown |
| OpenCode | `opencode` | `.opencode/skills/atomic-skills/` | Markdown |
| GitHub Copilot | `github-copilot` | `.github/skills/atomic-skills/` | Markdown |
<!-- IDES_TABLE_END -->

For details on the cross-agent rendering layer, see [docs/kb/gemini-cli-compatibility.md](docs/kb/gemini-cli-compatibility.md).

## Skills

<!-- VERSION_NOTE_START -->
> **Note (v2.0.0):** First major bump since 1.8.x. Review skills consolidated from 4 → 2 (`review-plan` + `review-code`) with a Step 0 mode picker (`local` | `codex` | `both`). Catalog moved to schema v0.2 and was renamed to `meta/catalog.yaml`. README + dashboard are now generated from five marker-bounded regions; husky pre-commit auto-regenerates on staged catalog changes.
> See [CHANGELOG.md](CHANGELOG.md) for the full migration matrix.
<!-- VERSION_NOTE_END -->

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

<!-- MODULES_START -->
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
<!-- MODULES_END -->

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
