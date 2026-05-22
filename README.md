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

> **[Versão em Português (BR)](README.pt-BR.md)** · **[View on npm](https://www.npmjs.com/package/@henryavila/atomic-skills)**

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

> **Note (v2.0.0):** `review-plan-internal` and `review-plan-vs-artifacts`
> were merged into a single `review-plan` skill with an optional
> cross-reference mode. A new `review-code` skill ships alongside as the
> same-model mirror of `review-code-with-codex`. See
> [CHANGELOG.md](CHANGELOG.md) for migration.

### Overview

| | Skill | One-liner | Iron Law |
|-|-------|-----------|----------|
| 🔧 | [`fix`](#atomic-skillsfix--root-cause-diagnosis--tdd-fix) | Diagnose root cause → write test → fix → verify | `NO FIX WITHOUT ROOT CAUSE` |
| 🎯 | [`hunt`](#atomic-skillshunt--adversarial-tests-for-existing-code) | Write adversarial tests to break code, not confirm it | `NO HUNT WITHOUT BOUNDED SCOPE` |
| 📝 | [`prompt`](#atomic-skillsprompt--optimized-prompt-generation) | Generate a self-contained prompt with exact paths and guardrails | `NO PROMPT WITHOUT CODEBASE ANALYSIS` |
| 🚀 | [`parallel-dispatch`](#atomic-skillsparallel-dispatch--dispatch-a-task-list-to-n-parallel-sessions) | Dispatch a user-provided task list to N parallel sessions with verified isolation | `NO LAUNCH WITHOUT MECHANICAL SCOPE ISOLATION` |
| 👁️ | [`parallel-dispatch-audit`](#atomic-skillsparallel-dispatch-audit--audit-a-parallel-dispatch-batch) | Audit output of a parallel-dispatch batch, apply fixes, report | `NO CONCLUSION WITHOUT EVIDENCE FROM DISK` |
| 🔍 | [`review-plan`](#atomic-skillsreview-plan--same-model-adversarial-plan-review) | Adversarial self-loop review of a plan; optional cross-ref against PRD/specs | `NO APPROVAL WITHOUT EVIDENCE` |
| 🔬 | [`review-code`](#atomic-skillsreview-code--same-model-adversarial-code-review-new-in-200) | Adversarial self-loop review of a git ref/diff; same-model checklist for bugs and coverage | `NO APPROVAL WITHOUT EVIDENCE` |
| 🤖 | [`review-plan-with-codex`](#atomic-skillsreview-plan-with-codex--cross-model-plan-review-new-in-180) | Cross-family review of a plan via OpenAI Codex CLI (two-pass sealed envelope) | `NO INTENT IN THE BRIEFING` |
| 🧪 | [`review-code-with-codex`](#atomic-skillsreview-code-with-codex--cross-model-code-review-new-in-180) | Cross-family review of code changes (diff/branch) via OpenAI Codex CLI | `NO INTENT IN THE BRIEFING` |
| 💾 | [`save-and-push`](#atomic-skillssave-and-push--save-work--publish) | Save learnings to memory, group commits, push safely | `NO PUSH WITHOUT FRESH VERIFICATION` |
| 📊 | [`project-status`](#atomic-skillsproject-status--canonical-per-initiative-status-tracking) | Canonical per-initiative status tree with stack + tasks + parked + emerged; enforces via hooks | `NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE` |
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

### `atomic-skills:review-plan` — Same-Model Adversarial Plan Review

**Problem it solves:** Plans contain internal contradictions, broken dependencies, ambiguous tasks, and missing steps. When a plan was derived from a PRD/spec, those source artifacts also drift silently — requirements get oversimplified, acceptance criteria lose details, or phantom features creep in.

**What it does:** Adversarial self-loop review with a Step 0 confirmation that picks the scope:
- **Internal only** — applies the 7-item checklist (contradictions, broken dependencies, ordering, ambiguity, schema, file existence, test coverage).
- **Cross-reference with detected/custom artifacts** — adds 6 more checks (requirement coverage, acceptance criteria, phase gates, dependency graphs, schema/API match, UX) and activates the HARD-GATE that forbids editing the source artifacts.

Every finding cites line numbers from the plan (and the artifact when cross-ref is active). Iterates up to 3 times to verify fixes don't introduce new problems. Non-interactive callers (like `project-plan` Stage 8a) pass `--mode=internal` to short-circuit the prompt.

**When to use:** Before executing any plan — structural validation. When a plan was derived from a PRD/spec, the cross-ref mode catches missing requirements and oversimplified acceptance criteria.

**Advantages:**
- Step 0 prompt makes the scope decision auditable instead of inferring from a fragile heading
- LOCAL-only artifact rule (URLs are not auto-fetched) keeps the evidence requirement enforceable
- Verifies file/command existence with Glob/Grep (doesn't trust the plan)
- Severity classification: Critical (blocks), Significant (causes rework), Minor
- Verification loop prevents fixes from introducing new errors
- Code-quality self-review (G1 + G2 + G6) catches bare assertions and soft-language

**Iron Law:** `NO APPROVAL WITHOUT EVIDENCE`

---

### `atomic-skills:review-code` — Same-Model Adversarial Code Review (new in 2.0.0)

**Problem it solves:** Reviewing code without a structured adversarial pass misses logic bugs, race conditions, swallowed errors, and missing test coverage. `review-code-with-codex` does this cross-model but costs money and depends on the Codex CLI. There was no same-model equivalent for cheap pre-merge sanity checks.

**What it does:** Adversarial self-loop review of a git ref — branch, single commit, or commit range (`main..HEAD`, `main...HEAD`). Step 0 classifies the ref shape deterministically:
- **Triple-dot range** (`a...b`) — splits on `...` first to avoid eating the leftover dot.
- **Double-dot range** (`a..b`) — endpoint-by-endpoint validation (raw `git rev-parse --verify` rejects range syntax).
- **Single ref** — distinguishes branch vs commit via `git show-ref` then `git cat-file -t`; asks the user which base to diff a branch against.

Picks the shape-specific diff command (commit: `git show --patch`; branch: `git diff $(git merge-base <base> <branch>)..<branch>`; range: `git diff <range>`). Applies a 7-item checklist (logic bugs, race conditions, error handling, schema/migrations, API contracts, file/function references, test coverage). Iterates up to 3 passes.

**When to use:** Pre-merge sanity check on a coherent change. Codex CLI not installed or you don't want to spend on it.

**Advantages:**
- Free alternative to `review-code-with-codex` for everyday review
- Range-aware ref validation (triple-dot first) — avoids the classic `'main...HEAD'.split('..')` bug
- Shape-specific diff command — never falls into `git diff <single-ref>` leaking worktree edits
- All user prompts routed through `{{ASK_USER_QUESTION_TOOL}}` — Claude Code uses the native tool; other IDEs receive a plain-text fallback
- Code-quality self-review (G1 + G2 + G3 + G4 + G7) for the fixes you apply

**Iron Law:** `NO APPROVAL WITHOUT EVIDENCE`

---

### `atomic-skills:review-plan-with-codex` — Cross-Model Plan Review (new in 1.8.0)

**Problem it solves:** Same-model review (Claude reviewing Claude) suffers from documented self-preference bias (arXiv [2410.21819](https://arxiv.org/abs/2410.21819), [2508.06709](https://arxiv.org/abs/2508.06709), [2509.26464](https://arxiv.org/abs/2509.26464)). High-stakes plans/specs need a second opinion from a different model family.

**What it does:** Dispatches the OpenAI Codex CLI as an adversarial reviewer in a **two-pass sealed envelope** pattern.
- **Pass 1 (blind):** Codex reviews with *factual constraints only* — no intent narrative (intent framing can drop bug detection by up to **-93pp**, per arXiv [2603.18740](https://arxiv.org/abs/2603.18740)).
- **Pass 2 (informed):** constraints are revealed, Codex reconciles findings with `Dropped / Maintained / Emerged` blocks. The delta blind→informed is the empirical signal of framing bias.

**When to use:** Finishing a plan/spec/design doc and wanting a second opinion before implementation. High-stakes architectural decisions. Complements `review-plan` (same-model).

**Pre-requisites:**
- OpenAI Codex CLI installed (`npm install -g @openai/codex` or `brew install --cask codex`)
- `codex login` completed
- Clean working tree (or `--allow-dirty` flag)

**Output:** Consolidated review file in `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md` with both pass outputs, reconciliation block, framing delta, and applied fixes. `INDEX.md` tracks history.

**Advantages:**
- Cross-family review attacks self-preference bias from a different vector than same-model review
- Two-pass sealed envelope produces an empirical metric (framing delta) for run quality
- Factual-only briefing prevents the most documented form of reviewer poisoning
- All findings cite `file:line` + 4 mandatory fields (Claim, Impact, Recommendation, Confidence)

**Iron Law:** `NO INTENT IN THE BRIEFING`

See [`docs/kb/cross-model-review-design.md`](docs/kb/cross-model-review-design.md) for design principles.

---

### `atomic-skills:review-code-with-codex` — Cross-Model Code Review (new in 1.8.0)

**Problem it solves:** Reviewing code with the same model that wrote it misses bugs by self-preference bias. Especially risky in critical paths (auth, data integrity, infra, async/concurrent logic).

**What it does:** Same **two-pass sealed envelope** pattern as `review-plan-with-codex`, but for code (diff/branch). Attack-surface checklist focused on bugs: race conditions, auth bypass, data integrity, error handling, rollback safety, perf regressions, test gaps, observability.

**When to use:** Before merging significant changes. Security-sensitive code. Complex async/concurrent logic. Whenever you want a cross-family second opinion on code Claude wrote.

**Pre-requisites:** Same as `review-plan-with-codex`.

**Output:** Consolidated review file in `.atomic-skills/reviews/`. Includes briefings (audit trail), both passes, reconciliation, and fixes applied during triage.

**Advantages:**
- Empirically validated: real-run on `dotfiles` repo caught a regex token-parsing bug and a test-coverage gap that same-model review missed
- Code-focused attack surfaces (not generic checklist) — race conditions, auth, etc.
- Cost-aware: warns if diff exceeds 50KB before invoking; respects user's `~/.codex/config.toml` model choice
- Fixes are proposed individually with file:line context — you approve/edit/skip each one

**Iron Law:** `NO INTENT IN THE BRIEFING`

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

Shared infrastructure for the cross-model review skills. Asset-only module (no invocable skills of its own) — bundles the 11 templates and checklists used by `review-plan-with-codex` and `review-code-with-codex`:

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

## Languages

- [Português (BR)](README.pt-BR.md)
- English ← you are here

## License

MIT
