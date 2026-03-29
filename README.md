<p align="center">
  <img src="assets/header.png" alt="Atomic Skills — Small. Specific. Capable." width="100%" />
</p>

Optimized prompts you install once and invoke in any AI IDE. Each skill is an atom — small enough to stay focused, specific enough to leave no ambiguity, capable enough to make the agent actually follow through.

*Stop rewriting prompts.*

```bash
npx @henryavila/atomic-skills install
```

> **Built for Claude Code.** Skills work across multiple IDEs, but every prompt is optimized for Claude Code's tool system (Read, Edit, Grep, Glob, Bash, Agent). Techniques like Iron Laws, HARD-GATEs, and Rationalization tables are designed around how Claude reasons and where it cuts corners. Other agents benefit from the structure, but Claude Code gets the most out of it.

## Why Atomic?

AI agents skip steps, rationalize shortcuts, and ignore vague instructions. Atomic Skills solve this with battle-tested techniques baked into every prompt:

- **Small** — one skill, one job. No bloat, no dependencies between skills
- **Specific** — every step names the tool, demands evidence, defines what "done" looks like
- **Capable** — Iron Laws, HARD-GATEs, Red Flags, Rationalization tables. Techniques that turn "the agent should do X" into "the agent will do X"

## Supported IDEs

| IDE | Directory | Invocation |
|-----|-----------|------------|
| **Claude Code** | `.claude/skills/` | `/as-name` |
| Cursor | `.cursor/skills/` | `/as-name` |
| Gemini CLI | `.gemini/commands/` | `/as-name` |
| Codex | `.agents/skills/` | `$as-name` |
| OpenCode | `.opencode/skills/` | `/as-name` |
| GitHub Copilot | `.github/skills/` | `/as-name` |

## Skills

### Fix & Hunt — the bug-killing duo

| Skill | What it does |
|-------|-------------|
| `as-fix` | Diagnoses root cause with evidence, enumerates the test surface (equivalence partitions, boundaries, error inputs), writes a test cluster with TDD, fixes with minimal change. Integrates mental mutation spot-checks to verify no case was missed |
| `as-hunt` | Writes adversarial tests for existing code that lacks coverage. Accepts a file, function, or directory. Single-file: 6-phase deep hunt. Directory: triages by risk, spawns isolated subagents per file (prevents cross-file tautology). Bugs found are handed off to `as-fix` with the reproducing test already written |

**How they work together:** `as-hunt` finds bugs in untested code and creates failing tests. `as-fix` takes those failing tests and fixes the code with full TDD discipline. The `as-fix` Test List extends `as-hunt`'s coverage with boundary and partition tests around the fix area.

### Plan & Review

| Skill | What it does |
|-------|-------------|
| `as-prompt` | Generates an optimized, self-contained prompt from a task description — explores codebase, resolves file paths, applies Iron Law, Red Flags, and task-specific Rationalization table |
| `as-review-plan-internal` | Adversarial review of a plan — finds contradictions, broken dependencies, ambiguity. Verifies file/command existence with Glob, not trust |
| `as-review-plan-vs-artifacts` | Cross-references plan against PRD, specs, and artifacts. Requires line numbers from BOTH documents as proof |
| `as-status` | Tracks the current workstream, completed work, remaining work, and stage-level reviews/verifications |

### Session Management

| Skill | What it does |
|-------|-------------|
| `as-resume` | Investigates project context (git, memory, `.claude/rules/`, skills), generates a handoff prompt for a clean session |
| `as-save-and-push` | Reviews conversation, saves learnings to memory, formats code, groups commits logically, pushes. HARD-GATE on main/master |

## Techniques

Each skill uses a combination of these techniques to prevent agent shortcuts:

| Technique | What it does | Example |
|-----------|-------------|---------|
| **Iron Law** | One non-negotiable rule at the top | `NO FIX WITHOUT ROOT CAUSE` |
| **HARD-GATE** | Mandatory stop before a dangerous action | "If modifying code without a test: STOP" |
| **Red Flags** | Thoughts that mean you're skipping steps | "I already know what the bug is" |
| **Rationalization Table** | Maps tempting shortcuts to why they fail | "The fix is obvious" → "Obvious to whom? Prove it" |
| **Evidence Requirement** | Every claim must cite line numbers or tool output | "Cite file:line, not 'I checked'" |
| **Escalation Limit** | Max attempts before asking the human | "5 hypotheses failed → escalate" |
| **Test List** | Enumerate test surface before writing any test | Regression + partitions + boundaries + errors |
| **Mental Mutation** | For each condition in the fix: "would a test catch the inverse?" | "If I changed >= to >, would a test catch it?" |
| **Autonomous Mode** | Rules for subagents that can't interact with user | "Auto-split >300 lines, always continue on bugs" |

## Modules

Optional modules add specialized workflows. The installer explains each one before you decide.

### Memory

Persistent context across sessions. The agent saves learnings, decisions, and feedback that survive between conversations.

- Configurable path (default: `.ai/memory/`)
- Adds the `as-init-memory` skill
- Supports Claude Code's `autoMemoryDirectory` for direct integration (no redirect needed)
- Available in both project and user scope installations

## Install, Update, Uninstall

```bash
npx @henryavila/atomic-skills install       # First install or update
npx @henryavila/atomic-skills uninstall     # Remove everything
```

The interactive installer asks your language, scope (project or user), which IDEs you use, and which modules to enable.

- **Project scope**: skills installed in the repo (shared with team)
- **User scope**: skills installed in `~/` (available in all your repos)

On update, modified files trigger a conflict prompt — overwrite, keep, or view the diff.

## Languages

- Português (BR)
- English

Skill prompts follow your chosen language. Metadata (`name`, `description`) is always in English for IDE compatibility.

## License

MIT
