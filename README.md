<p align="center">
  <img src="assets/header.png" alt="Atomic Skills — Small. Specific. Capable." width="100%" />
</p>

Optimized prompts you install once and invoke in any AI IDE. Each skill is an atom — small enough to stay focused, specific enough to leave no ambiguity, capable enough to make the agent actually follow through.

*Stop rewriting prompts.*

> **[Versão em Português (BR)](README.pt-BR.md)**

```bash
npx @henryavila/atomic-skills install
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
| **Claude Code** | `claude-code` | `.claude/skills/` | Markdown |
| **Gemini CLI** | `gemini` | `.gemini/skills/` | Markdown (Recommended) |
| **Gemini CLI** | `gemini-commands`| `.gemini/commands/` | TOML (Slash commands) |
| Cursor | `cursor` | `.cursor/skills/` | Markdown |
| Codex | `codex` | `.agents/skills/` | Markdown |
| OpenCode | `opencode` | `.opencode/skills/` | Markdown |
| GitHub Copilot | `github-copilot`| `.github/skills/` | Markdown |

## Skills

### Overview

| | Skill | One-liner | Iron Law |
|-|-------|-----------|----------|
| 🔧 | [`fix`](#atomic-skillsfix--root-cause-diagnosis--tdd-fix) | Diagnose root cause → write test → fix → verify | `NO FIX WITHOUT ROOT CAUSE` |
| 🎯 | [`hunt`](#atomic-skillshunt--adversarial-tests-for-existing-code) | Write adversarial tests to break code, not confirm it | `NO HUNT WITHOUT BOUNDED SCOPE` |
| 📝 | [`prompt`](#atomic-skillsprompt--optimized-prompt-generation) | Generate a self-contained prompt with exact paths and guardrails | `NO PROMPT WITHOUT CODEBASE ANALYSIS` |
| 🚀 | [`parallel-dispatch`](#atomic-skillsparallel-dispatch--dispatch-a-task-list-to-n-parallel-sessions) | Dispatch a user-provided task list to N parallel sessions with verified isolation | `NO LAUNCH WITHOUT MECHANICAL SCOPE ISOLATION` |
| 👁️ | [`parallel-dispatch-audit`](#atomic-skillsparallel-dispatch-audit--audit-a-parallel-dispatch-batch) | Audit output of a parallel-dispatch batch, apply fixes, report | `NO CONCLUSION WITHOUT EVIDENCE FROM DISK` |
| 🔍 | [`review-plan-internal`](#atomic-skillsreview-plan-internal--adversarial-plan-review) | Find contradictions, broken deps, and gaps in a plan | `NO APPROVAL WITHOUT EVIDENCE` |
| 📋 | [`review-plan-vs-artifacts`](#atomic-skillsreview-plan-vs-artifacts--plan-vs-artifacts) | Cross-reference plan against PRD/specs for missing requirements | `NO APPROVAL WITHOUT CROSS-REFERENCE` |
| 💾 | [`save-and-push`](#atomic-skillssave-and-push--save-work--publish) | Save learnings to memory, group commits, push safely | `NO PUSH WITHOUT FRESH VERIFICATION` |
| 🧠 | [`init-memory`](#atomic-skillsinit-memory--persistent-memory-initialization) | Centralize project memory to `.ai/memory/` | `NO DELETION WITHOUT CONFIRMED BACKUP` |

---

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

### `atomic-skills:review-plan-internal` — Adversarial Plan Review

**Problem it solves:** Plans contain internal contradictions, broken dependencies, ambiguous tasks, and missing steps — problems that only surface during implementation, when the cost of correction is high.

**What it does:** Applies a 7-item checklist (contradictions, broken dependencies, ordering, ambiguity, schema, file existence, test coverage), cites line numbers as proof, and iterates up to 3 times to verify that fixes didn't introduce new problems.

**When to use:** Before executing any implementation plan — internal consistency validation.

**Advantages:**
- Verifies file/command existence with Glob/Grep (doesn't trust the plan)
- Severity classification: Critical (blocks), Significant (causes rework), Minor
- Verification loop prevents fixes from introducing new errors
- Every finding cites the exact plan line number

**Iron Law:** `NO APPROVAL WITHOUT EVIDENCE`

---

### `atomic-skills:review-plan-vs-artifacts` — Plan vs. Artifacts

**Problem it solves:** Plans oversimplify requirements, lose acceptance criteria details, or add features nobody asked for. The gap between PRD/spec and plan grows silently.

**What it does:** Cross-references the plan against source artifacts (PRD, specs, designs) with a 6-item checklist (requirement coverage, acceptance criteria, phase gates, dependencies, schema/API, UX). Requires line numbers from BOTH documents as proof.

**When to use:** After generating a plan from specs/PRD — cross-coverage validation.

**Advantages:**
- HARD-GATE: corrects the PLAN, never the source artifact (if the artifact has an error, asks the user)
- Coverage proof with plan line + artifact line
- Detects missing requirements, oversimplified acceptance criteria, and phantom features
- Verification loop (up to 3x) ensures fixes don't break other references

**Iron Law:** `NO APPROVAL WITHOUT CROSS-REFERENCE`

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

### Memory

Persistent context across sessions. The agent saves learnings, decisions, and feedback that survive between conversations.

- Configurable path (default: `.ai/memory/`)
- Adds the `atomic-skills:init-memory` skill
- Supports Claude Code's `autoMemoryDirectory` for direct integration (no redirect needed)
- Available in both project and user scope installations

## Install, Update, Uninstall

```bash
npx @henryavila/atomic-skills install       # First install or update
npx @henryavila/atomic-skills uninstall     # Remove everything
```

## Languages

- [Português (BR)](README.pt-BR.md)
- English ← you are here

## License

MIT
