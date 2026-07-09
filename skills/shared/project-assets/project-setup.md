# project — first-time setup (lazy detail)

Loaded by the router when `.atomic-skills/` does not exist (any subcommand), or on explicit `setup`.

Announce: "I will configure the `project` skill in this repo."

## 1. Detect environment

Detect two independent axes: skill installation compatibility and project-hook setup eligibility. A host may support skills without supporting project hooks.

### Skill installation host
- `test -d .claude/` → Claude Code; skills path: `.claude/commands/atomic-skills/<skill>.md`
- `test -d .cursor/` → Cursor; skills path: `.cursor/skills/atomic-skills/<skill>/SKILL.md`
- `test -d .gemini/` → Gemini CLI; skills path: `.gemini/skills/atomic-skills/<skill>/SKILL.md`
- `test -d .codex/ || test -d .agents/` → Codex; skills path: `.agents/skills/atomic-skills/<skill>/SKILL.md`
- `test -d .opencode/` → OpenCode; skills path: `.opencode/skills/atomic-skills/<skill>/SKILL.md`
- `test -d .github/` → GitHub Copilot; skills path: `.github/skills/atomic-skills/<skill>/SKILL.md`
- When Gemini CLI and Codex are both selected, Gemini command shims use `.gemini/commands/atomic-skills-<skill>.toml`
- Otherwise → generic IDE; no host-specific skills path and no project-hook setup

### Project-hook setup eligibility
- Claude Code has a project-hook contract: merge-only registration in `.claude/settings.local.json`
- Codex has a project-hook contract: merge-only registration in `.codex/hooks.json`
- Cursor, Gemini CLI, OpenCode, GitHub Copilot, and generic IDE have no known project-hook contract; hook setup is an explicit no-op for those hosts and must not create or register hook config files

## 2. Verify/create CLAUDE.md
- If CLAUDE.md is absent: ask "Create minimal CLAUDE.md with hard-gate? (y/n)" — if yes, create with a title + hard-gate template
- If CLAUDE.md exists: prepare to inject block between markers

## 3. Inject hard-gate into CLAUDE.md (idempotent)
Read `{{ASSETS_PATH}}/CLAUDE.md-gate.template.md` (assets packaged with the skill).
Check if markers `<!-- atomic-skills:status-gate:start -->` already exist:
- If yes and content is identical: skip
- If yes and content differs: show diff, ask if updating
- If not: append to end of CLAUDE.md

## 4. AGENTS.md redirect
- If AGENTS.md absent: create from `{{ASSETS_PATH}}/AGENTS.md.template.md`
- If AGENTS.md exists and references CLAUDE.md: skip
- If AGENTS.md exists without reference: show suggested diff, ask confirmation (do not force)

## 5. Install hooks (Claude Code / Codex only)

Run this step only when the detected/selected host has a known project-hook contract:

- Claude Code: `.claude/settings.local.json`
- Codex: `.codex/hooks.json`

For Cursor, Gemini CLI, OpenCode, GitHub Copilot, and generic IDE: no-op for hooks. Do not copy project hook scripts for those hosts, do not create hook config files, and do not register hook events.

Present Structured Options:
> What enforcement level?
> (a) Passive — hard-gate in CLAUDE.md only, no hooks
> (b) Soft (recommended) — hard-gate + SessionStart hook + PreToolUse provenance gate (dry-run)
> (c) Strict — hard-gate + SessionStart + Stop hook + PreToolUse provenance gate (all dry-run 7d before real strict)

For eligible hosts only, options (b) and (c): copy `session-start.sh`, `stop.sh`, and `pre-write.sh` (from `{{ASSETS_PATH}}/hooks/`) to `.atomic-skills/status/hooks/`, then register them in the host hook config with merge-only changes:

- Claude Code: `.claude/settings.local.json`
- Codex: `.codex/hooks.json`

Use these exact command wrappers so the hook still runs when the host does not export `CLAUDE_PROJECT_DIR`:

```json
{
  "SessionStart": [{ "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.atomic-skills/status/hooks/session-start.sh\"" }] }],
  "Stop": [{ "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.atomic-skills/status/hooks/stop.sh\"" }] }],
  "PreToolUse": [{ "matcher": "Edit|Write|MultiEdit", "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.atomic-skills/status/hooks/pre-write.sh\"" }] }]
}
```

Never register hooks as `bash "$CLAUDE_PROJECT_DIR/.atomic-skills/status/hooks/<script>.sh"`: when `CLAUDE_PROJECT_DIR` is unset, the shell expands that to `/.atomic-skills/...` before the script's own fallback can run.

For (b): copy `config.json` with `strict_mode: false`, `emergent_strict_mode: false`, and `dry_run_started: $(date -I)`.
For (c): same `config.json` shape — both strict knobs default false during the 7-day dry-run window.

The `pre-write.sh` gate intercepts direct Edits to the nested `.atomic-skills/projects/<id>/<slug>/{plan.md,phases/*.md}` (and legacy flat `.atomic-skills/initiatives/*.md` + `plans/*.md`) that add entries to `tasks[]` or `phases[]` without a `provenance:` field. Use the documented `new-task` / `new-phase` / `split-phase` / `emerge --target` commands (they set provenance automatically) instead. Bypass for 24h with `touch .atomic-skills/status/SKIP-EMERGENT`.

When the optional `pre-write.sh` PreToolUse hook is installed (enforcement level (b) or (c)), it enforces both rules mechanically: any `Edit` / `Write` / `MultiEdit` that adds a `tasks[]` or `phases[]` entry without `provenance:` — OR with `provenance:` but missing any of `context.solves` / `context.trigger` / `context.ratifiedAt` — is logged in dry-run mode or denied in strict mode (`emergent_strict_mode: true`). The hook exempts file creation (original materialization), updates to existing entries, deletions, archive subdirs, and `*.rendered.md` artifacts. See `.atomic-skills/status/hooks/README.md` for promotion + bypass instructions.

## 6. Create structure

Use {{BASH_TOOL}}:
```bash
mkdir -p .atomic-skills/projects        # nested top level — per-project folders land here
mkdir -p .atomic-skills/status/hooks
```

The per-project index `projects/<project-id>/PROJECT-STATUS.md` (and the `<slug>/phases/archive/` dirs) are created with the first plan (`new plan` / `discover --commit`). For coexistence with un-migrated tooling, also seed a top-level fallback index now: copy `{{ASSETS_PATH}}/PROJECT-STATUS.md.template.md` to `.atomic-skills/PROJECT-STATUS.md`, replacing `REPLACE_ISO_TIMESTAMP` with the current timestamp.

## 7. Update .gitignore
Append (if not present):
```
.atomic-skills/status/stop.log
.atomic-skills/status/drift.log
.atomic-skills/status/emergent-drift.log
.atomic-skills/status/SKIP
.atomic-skills/status/SKIP-EMERGENT
.atomic-skills/status/reconciliation.log
.atomic-skills/status/last-session.json
.atomic-skills/projects/**/*.rendered.md
.atomic-skills/plans/*.rendered.md
.atomic-skills/initiatives/*.rendered.md
.atomic-skills/bootstrap-drafts/
.atomic-skills/status/bootstrap.json
```

## 8. Report
List everything created and give rollback instructions (`git status` + `git restore`).

Also ask: "Scan repo to discover in-flight initiatives? (y/N)". If yes, run the `discover` flow (`{{ASSETS_PATH}}/project-discover.md` — multi-source scan that detects standalone initiatives AND multi-phase plans).
