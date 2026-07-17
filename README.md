<p align="center">
  <img src="assets/header.png" alt="Atomic Skills — Small. Specific. Capable." width="100%" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@henryavila/atomic-skills"><img src="https://img.shields.io/npm/v/@henryavila/atomic-skills.svg?label=npm&color=cb3837&logo=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@henryavila/atomic-skills"><img src="https://img.shields.io/npm/dm/@henryavila/atomic-skills.svg?color=blue" alt="npm downloads" /></a>
  <a href="https://github.com/henryavila/atomic-skills/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@henryavila/atomic-skills.svg?color=success" alt="license" /></a>
</p>

[PRODUCT_START]: #
## What it is

Battle-tested skill prompts that make AI coding agents follow through — each skill encodes one hard-won workflow behind Iron Laws and HARD-GATEs so "the agent should do X" becomes "the agent will not proceed without X."

## What it is not

- A copy-paste prompt pack or chat snippet library
- A replacement for your IDE, model, or git workflow
- An engineering archive of plans, audits, or design notes
- A claim that every host adapter is day-to-day tested (only Claude Code, Cursor, Codex, and Grok Build are)

## Install

```bash
npx @henryavila/atomic-skills install
```

**Docs:** [https://atomic-skills.henryavila.com/](https://atomic-skills.henryavila.com/)
[PRODUCT_END]: #

## Offline / local docs

Build the static product site from a checkout (no network after install):

```bash
npm run generate-site
```

Then open `site/dist/index.html` in a browser. Details: [`site/DEPLOY.md`](site/DEPLOY.md).

## Hosts

**Tested** (real sessions): Claude Code, Cursor, Codex, Grok Build.

**Theoretical** (install + adapters ship; not day-to-day QA): Gemini CLI, OpenCode, GitHub Copilot, and other profiles.

Support column in the table:

- **Tested** — install, discovery, invoke, and skill workflows exercised in real agent sessions.
- **Theoretical** — installer + adapter present; not verified in day-to-day use.

[IDES_TABLE_START]: #
| IDE | Profile | Directory | Format | Support |
|-----|---------|-----------|--------|---------|
| Claude Code | `claude-code` | `.claude/commands/atomic-skills/` | Command (slash) | Tested |
| Cursor | `cursor` | `.cursor/skills/atomic-skills/` | Markdown | Tested |
| Gemini CLI (Skills) | `gemini` | `.gemini/skills/atomic-skills-<skill>/` | Markdown | Theoretical |
| Gemini CLI (Commands) | `gemini-commands` | `.gemini/commands/` | TOML (Slash commands) | Theoretical |
| Codex | `codex` | `.agents/skills/atomic-skills/` | Markdown | Tested |
| OpenCode | `opencode` | `.opencode/skills/atomic-skills/` | Markdown | Theoretical |
| GitHub Copilot | `github-copilot` | `.github/skills/atomic-skills/` | Markdown | Theoretical |
| Grok Build | `grok` | `.grok/plugins/atomic-skills/skills/` | Markdown | Tested |
[IDES_TABLE_END]: #

## Skills

Compact index (name · one-liner · Iron Law).

**Dual docs view (intentional):** the product docs site ([online](https://atomic-skills.henryavila.com/) or offline `site/dist/` via `npm run generate-site`) is the **canonical human product surface** (modules, long skill write-ups, project guide). Generated Markdown under [`docs/skills/`](docs/skills/) is a **secondary** offline / agent / GitHub-browsing reference, kept drift-checked by `npm run generate-skill-docs` (still part of `npm run check-docs`). Engineering archive paths (`docs/kb/`, `docs/design/`, plans, audits) are not product docs and are not published on the site.

[VERSION_NOTE_START]: #

[VERSION_NOTE_END]: #

[SKILLS_TABLE_START]: #
| | Skill | One-liner | Iron Law |
|-|-------|-----------|----------|
| 🔧 | [`fix`](docs/skills/fix.md) | Diagnose root cause → write test → fix → verify | `NO FIX WITHOUT ROOT CAUSE.` |
| 💾 | [`save-and-push`](docs/skills/save-and-push.md) | Scan for secrets, group commits, save learnings, push safely | `NO PUSH WITHOUT FRESH VERIFICATION.` |
| 🔍 | [`review-plan`](docs/skills/review-plan.md) | Adversarial plan review with local/codex/both mode picker | `NO APPROVAL WITHOUT EVIDENCE.` |
| 🔬 | [`review-code`](docs/skills/review-code.md) | Adversarial code review with local/codex/both mode picker | `NO APPROVAL WITHOUT EVIDENCE.` |
| 📊 | [`project`](docs/skills/project.md) | Plan / Initiative / Task state your agent reloads every session | `NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE.` |
| 📝 | [`prompt`](docs/skills/prompt.md) | Generate a self-contained prompt with exact paths and guardrails | `NO PROMPT WITHOUT CODEBASE ANALYSIS.` |
| 🎯 | [`hunt`](docs/skills/hunt.md) | Adversarial tests from the spec, not the code — depth over breadth | `NO HUNT WITHOUT BOUNDED SCOPE.` |
| 🚀 | [`parallel-dispatch`](docs/skills/parallel-dispatch.md) | Dispatch a task list to N parallel sessions with verified isolation | `NO LAUNCH WITHOUT MECHANICAL SCOPE ISOLATION.` |
| 👁️ | [`parallel-dispatch-audit`](docs/skills/parallel-dispatch-audit.md) | Verify each batch deliverable on disk; fix or escalate with evidence | `NO CONCLUSION WITHOUT EVIDENCE FROM DISK.` |
| 💡 | [`brainstorm`](docs/skills/brainstorm.md) | Diverge, decide, then write a critic-gated design.md before any plan | `NO PLAN WITHOUT AN APPROVED DESIGN.` |
| 🎨 | [`design-brief`](docs/skills/design-brief.md) | Generate DS + screens prompts for a design agent, contamination-free | `NEVER SILENCE BEHAVIOUR OR PHILOSOPHY — SILENCE IS FOR VISUAL FORM ONLY.` |
| 🎭 | [`debate`](docs/skills/debate.md) | Roundtable of independent subagent personas for divergent thinking | `NO SYNTHESIS WITHOUT INDEPENDENT VOICES.` |
| ⚙️ | [`implement`](docs/skills/implement.md) | Drive decomposed tasks to done, one at a time, verifier-gated | `CODING STAYS SINGLE-THREADED (ONE WRITER PER WORKTREE).` |
| ✅ | [`verify-claim`](docs/skills/verify-claim.md) | No success claim without fresh verification — run it, cite it | `NO SUCCESS CLAIM WITHOUT FRESH VERIFICATION.` |
| 🧠 | [`init-memory`](docs/skills/init-memory.md) | Consolidate scattered memory into .ai/memory/ and wire it to the IDE | `NO DELETION WITHOUT CONFIRMED BACKUP.` |
[SKILLS_TABLE_END]: #

[SKILL_DETAILS_START]: #

[SKILL_DETAILS_END]: #

[MODULES_START]: #

[MODULES_END]: #

## License

MIT · [npm](https://www.npmjs.com/package/@henryavila/atomic-skills) · [GitHub](https://github.com/henryavila/atomic-skills)
