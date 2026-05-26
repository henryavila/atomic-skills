<p align="center">
  <img src="assets/header.png" alt="Atomic Skills — Small. Specific. Capable." width="100%" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@henryavila/atomic-skills"><img src="https://img.shields.io/npm/v/@henryavila/atomic-skills.svg?label=npm&color=cb3837&logo=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@henryavila/atomic-skills"><img src="https://img.shields.io/npm/dm/@henryavila/atomic-skills.svg?color=blue" alt="npm downloads" /></a>
  <a href="https://github.com/henryavila/atomic-skills/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@henryavila/atomic-skills.svg?color=success" alt="license" /></a>
</p>

AI agents skip steps, cut corners, and ignore what they promised two messages ago. Atomic Skills are battle-tested prompts that make them follow through — install once, invoke in any AI IDE.

*Stop babysitting your agent.*

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

Vague instructions produce vague results. Each Atomic Skill encodes hard-won patterns that prevent agent drift:

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
| 🔧 | [`fix`](docs/skills/fix.md) | Diagnose root cause → write test → fix → verify | `NO FIX WITHOUT ROOT CAUSE.` |
| 💾 | [`save-and-push`](docs/skills/save-and-push.md) | Save learnings to memory, group commits, push safely | `NO PUSH WITHOUT FRESH VERIFICATION.` |
| 🔍 | [`review-plan`](docs/skills/review-plan.md) | Adversarial plan review with local/codex/both mode picker | `NO APPROVAL WITHOUT EVIDENCE.` |
| 🔬 | [`review-code`](docs/skills/review-code.md) | Adversarial code review with local/codex/both mode picker | `NO APPROVAL WITHOUT EVIDENCE.` |
| 📊 | [`project-status`](docs/skills/project-status.md) | View + daily mutations on the .atomic-skills/ tree | `NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE.` |
| 🗺️ | [`project-plan`](docs/skills/project-plan.md) | Create + restructure + discover Plans and Initiatives | `NO PLAN WITHOUT NARRATIVE.` |
| 📝 | [`prompt`](docs/skills/prompt.md) | Generate a self-contained prompt with exact paths and guardrails | `NO PROMPT WITHOUT CODEBASE ANALYSIS.` |
| 🎯 | [`hunt`](docs/skills/hunt.md) | Write adversarial tests to break code, not confirm it | `NO HUNT WITHOUT BOUNDED SCOPE.` |
| 🚀 | [`parallel-dispatch`](docs/skills/parallel-dispatch.md) | Dispatch a task list to N parallel sessions with verified isolation | `NO LAUNCH WITHOUT MECHANICAL SCOPE ISOLATION.` |
| 👁️ | [`parallel-dispatch-audit`](docs/skills/parallel-dispatch-audit.md) | Audit output of a parallel-dispatch batch, apply fixes, report | `NO CONCLUSION WITHOUT EVIDENCE FROM DISK.` |
| 🧠 | [`init-memory`](docs/skills/init-memory.md) | Centralize project memory to .ai/memory/ | `NO DELETION WITHOUT CONFIRMED BACKUP.` |
<!-- SKILLS_TABLE_END -->

---

<!-- SKILL_DETAILS_START -->
### 🔧 `fix` — Root Cause + TDD

**Iron Law:** `NO FIX WITHOUT ROOT CAUSE.`

AI agents love to jump to fixes. `fix` forces the detective path: reproduce first, understand the root cause, write a failing test, *then* fix. The test stays — so the bug never comes back.

```
/atomic-skills:fix "duplicates in /musicas listing"
```

[Full reference →](docs/skills/fix.md)

---

### 💾 `save-and-push` — Commit + Memory + Push

**Iron Law:** `NO PUSH WITHOUT FRESH VERIFICATION.`

Context dies when the session ends. `save-and-push` captures what you learned into persistent memory, groups changes into clean commits, and pushes safely. The next session picks up where you left off.

```
/atomic-skills:save-and-push
```

[Full reference →](docs/skills/save-and-push.md)

---

### 🔍 `review-plan` — Adversarial (Local + Codex)

**Iron Law:** `NO APPROVAL WITHOUT EVIDENCE.`

Plans fail when the author reviews their own work. `review-plan` runs adversarial passes — locally, via a cross-model codex envelope, or both — to catch gaps, missing edge cases, and optimistic assumptions before execution begins.

```
/atomic-skills:review-plan docs/plans/migration.md
```

[Full reference →](docs/skills/review-plan.md)

---

### 🔬 `review-code` — Adversarial (Local + Codex)

**Iron Law:** `NO APPROVAL WITHOUT EVIDENCE.`

Same-model reviews have blind spots. `review-code` captures your diff and runs adversarial passes — locally, cross-model via codex, or both — to catch bugs, security issues, and logic errors before merge.

```
/atomic-skills:review-code main..HEAD
```

[Full reference →](docs/skills/review-code.md)

---

### 📊 `project-status` — Initiative Tracking

**Iron Law:** `NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE.`

Multi-session projects lose context between conversations. `project-status` tracks Plans, Initiatives, and Tasks in `.atomic-skills/` — with stack frames for lateral work, scope-creep detection, and phase gates that keep the agent anchored.

```
/atomic-skills:project-status
```

[Full reference →](docs/skills/project-status.md)

---

### 🗺️ `project-plan` — Create, Discover, Migrate

**Iron Law:** `NO PLAN WITHOUT NARRATIVE.`

Every repo has in-flight work scattered across docs, branches, and memory. `project-plan` discovers it, clusters it into structured Plans, or adopts existing markdown plans — turning scattered intent into trackable state.

```
/atomic-skills:project-plan discover
```

[Full reference →](docs/skills/project-plan.md)

---

### 📝 `prompt` — Generate Optimized Prompt

**Iron Law:** `NO PROMPT WITHOUT CODEBASE ANALYSIS.`

Vague tasks produce vague results. `prompt` analyzes your codebase and generates a precise, self-contained prompt with exact file paths, guardrails, and acceptance criteria — ready to hand off to a parallel agent or a fresh session.

```
/atomic-skills:prompt "refactor auth middleware to use new session API"
```

[Full reference →](docs/skills/prompt.md)

---

### 🎯 `hunt` — Adversarial Tests

**Iron Law:** `NO HUNT WITHOUT BOUNDED SCOPE.`

Your tests confirm the happy path. `hunt` writes adversarial tests to *break* your code — edge cases, boundary conditions, error paths you didn't think of. Bounded to one class or function per run.

```
/atomic-skills:hunt src/matcher.php
```

[Full reference →](docs/skills/hunt.md)

---

### 🚀 `parallel-dispatch` — Independent Tasks

**Iron Law:** `NO LAUNCH WITHOUT MECHANICAL SCOPE ISOLATION.`

Parallel agents that touch the same files produce merge conflicts and wasted runs. `parallel-dispatch` proves scope disjointness via pairwise grep *before* launching — verified isolation, not hopeful isolation.

```
/atomic-skills:parallel-dispatch task-list.md
```

[Full reference →](docs/skills/parallel-dispatch.md)

---

### 👁️ `parallel-dispatch-audit` — Audit

**Iron Law:** `NO CONCLUSION WITHOUT EVIDENCE FROM DISK.`

Parallel agents finish — but did they actually deliver? `parallel-dispatch-audit` verifies each output against the original plan, applies cosmetic fixes automatically, and escalates real issues with evidence — not opinions.

```
/atomic-skills:parallel-dispatch-audit onboard-ci
```

[Full reference →](docs/skills/parallel-dispatch-audit.md)

---

### 🧠 `init-memory` — Persistent Context

**Iron Law:** `NO DELETION WITHOUT CONFIRMED BACKUP.`

New sessions start from zero. `init-memory` bootstraps a persistent memory directory so every future session inherits context from past ones. Run once, benefit forever.

```
/atomic-skills:init-memory
```

[Full reference →](docs/skills/init-memory.md)

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
