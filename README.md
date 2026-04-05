<p align="center">
  <img src="assets/header.png" alt="Atomic Skills — Small. Specific. Capable." width="100%" />
</p>

Optimized prompts you install once and invoke in any AI IDE. Each skill is an atom — small enough to stay focused, specific enough to leave no ambiguity, capable enough to make the agent actually follow through.

*Stop rewriting prompts.*

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

### Fix & Hunt

| Skill | What it does |
|-------|-------------|
| `as-fix` | Diagnoses root cause with evidence, enumerates the test surface (equivalence partitions, boundaries, error inputs), writes a test cluster with TDD, fixes with minimal change. Integrates mental mutation spot-checks to verify no case was missed |
| `as-hunt` | Writes adversarial tests for existing code that lacks coverage. Accepts a file, function, or directory. Single-file: 6-phase deep hunt. Directory: triages by risk, spawns isolated subagents per file (prevents cross-file tautology). Bugs found are handed off to `as-fix` with the reproducing test already written |

### Plan & Review

| Skill | What it does |
|-------|-------------|
| `as-prompt` | Generates an optimized, self-contained prompt from a task description — explores codebase, resolves file paths, applies Iron Law, Red Flags, and task-specific Rationalization table |
| `as-review-plan-internal` | Adversarial review of a plan — finds contradictions, broken dependencies, ambiguity. Verifies file/command existence with Glob, not trust |
| `as-review-plan-vs-artifacts` | Cross-references plan against PRD, specs, and artifacts. Requires line numbers from BOTH documents as proof |

### Session

| Skill | What it does |
|-------|-------------|
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
- Adds the `as-init-memory` skill
- Supports Claude Code's `autoMemoryDirectory` for direct integration (no redirect needed)
- Available in both project and user scope installations

## Install, Update, Uninstall

```bash
npx @henryavila/atomic-skills install       # First install or update
npx @henryavila/atomic-skills uninstall     # Remove everything
```

## Languages

- Português (BR)
- English

## License

MIT
