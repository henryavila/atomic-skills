# project-status hooks

## Files

- `session-start.sh` — L2b. v2 hook: walks the 3-level state (PROJECT-STATUS index → active Plan → phase Initiative), surfaces branch mismatches, signals phase-transition when the active initiative has 0 pending/active tasks, and injects the aiDeck dashboard URL when `~/.aideck/env` is present. Falls back to a standalone branch-matched initiative when no plan is active. Emits via `additionalContext` at SessionStart.
- `stop.sh` — L3. v2 hook: compares files written during the turn (via the JSONL transcript's `Write` / `Edit` / `MultiEdit` / `NotebookEdit` tool calls) against the active initiative's `scope.paths`. When out-of-scope writes exceed `drift_threshold` (default 0.5), logs a dry-run decision or blocks via exit 2 in strict mode. Scope-less initiatives skip the check.
- `pre-write.sh` — L4. PreToolUse hook: intercepts `Edit` / `Write` / `MultiEdit` on the nested `.atomic-skills/projects/<id>/<slug>/{plan.md,phases/*.md}` (and legacy flat `.atomic-skills/initiatives/*.md` + `.atomic-skills/plans/*.md`). Compares the OLD and NEW frontmatter for tasks/phases additions; any new entry lacking a `provenance:` field counts as a silent on-the-fly mutation and is logged (dry-run) or blocked via exit 2 (when `emergent_strict_mode: true`). File creation, deletions, updates to existing entries, archive subdirs, and `*.rendered.md` derived artifacts are all exempt.
- `config.json` — `strict_mode`, `emergent_strict_mode`, `drift_threshold` (default 0.5), `staleContextDays` (default 14 — `lastReviewedAt` aging threshold consumed by `why`/`scope-creep`), `parkedZombieDays` (default 30 — parked-zombie threshold), `dry_run_started` date, legacy `source_globs`, and stack/archive heuristics.
- `drift.log` — dry-run decision log emitted by `stop.sh` v2 (gitignored). One JSON object per Stop event.
- `emergent-drift.log` — dry-run decision log emitted by `pre-write.sh` (gitignored). One JSON object per blocked-in-dry-run mutation.
- `stop.log` — legacy v1 dry-run decision log (kept for backward compatibility on existing installs; no longer written by v2).

## SessionStart v2 — context layout

The hook composes its `additionalContext` payload in this order, skipping any section whose source isn't present:

1. **Active Project Status** — first 30 lines of `.atomic-skills/PROJECT-STATUS.md`.
2. **Active Plan: `<slug>`** — picks the active plan whose `branch:` matches `git symbolic-ref --short HEAD` first; otherwise the most recently modified active plan. Surfaces current phase, plan branch, and a `⚠️` warning when the plan branch differs from the current branch or multiple active plans exist without a tiebreaker.
3. **Current Initiative: `<slug>` (`<plan>/<phase>` or `(standalone)`)** — the initiative whose `parentPlan` + `phaseId` match the plan's `currentPhase` and whose `status` is `active`. Falls back to a standalone branch-matched active initiative when no plan path resolves. Surfaces a `⚠️` warning on branch mismatch and a `🔔` phase-transition prompt when the initiative's frontmatter `tasks:` block has zero entries with `status: pending` or `status: active`.
4. **aiDeck running** — when `$HOME/.aideck/env` exists, parses the `AIDECK_URL=` line and renders a dashboard link. aiDeck writes this file on `aideck serve` and removes it on shutdown (see `aideck/src/server/env-file.ts`), so a stale file only persists across crashes — the hook treats presence as a best-effort hint, not a guarantee.

## Debugging

### Check if hooks are registered

```bash
cat .claude/settings.local.json | jq '.hooks'
cat .codex/hooks.json | jq '.hooks'
```

Expected: entries for `SessionStart`, optionally `Stop`, and optionally `PreToolUse` (with `matcher: "Edit|Write|MultiEdit"`) using these wrappers:

```json
{
  "SessionStart": [{ "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.atomic-skills/status/hooks/session-start.sh\"" }] }],
  "Stop": [{ "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.atomic-skills/status/hooks/stop.sh\"" }] }],
  "PreToolUse": [{ "matcher": "Edit|Write|MultiEdit", "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.atomic-skills/status/hooks/pre-write.sh\"" }] }]
}
```

Do not use `bash "$CLAUDE_PROJECT_DIR/.atomic-skills/status/hooks/<script>.sh"` in hook config. That form fails before the script starts when `CLAUDE_PROJECT_DIR` is unset.

### Simulate a Stop hook call

```bash
echo '{"stop_hook_active":false,"transcript_path":"/path/to/transcript.jsonl"}' | \
  bash .atomic-skills/status/hooks/stop.sh
echo "exit=$?"
```

### Read the dry-run logs

```bash
tail -50 .atomic-skills/status/drift.log | jq .            # stop.sh decisions
tail -50 .atomic-skills/status/emergent-drift.log | jq .   # pre-write.sh decisions
```

`drift.log` lines: `{ts, mode, initiative, breadcrumb, total_files, out_of_scope, threshold, would_block, out_files[]}`. Tune `drift_threshold` in `config.json` if the would-block decisions don't match your judgment.

`emergent-drift.log` lines: `{ts, mode, initiative_or_plan, file, tool, would_block, violations[]}`. Each `violations[]` entry is `<kind>:<id>` (e.g. `task:T-002`, `phase:F1`) for an addition that lacks `provenance`. Promote to strict via `emergent_strict_mode: true` once the log is clean.

## Disabling

### Temporary (24h)

```bash
touch .atomic-skills/status/SKIP            # disables BOTH stop.sh and pre-write.sh
touch .atomic-skills/status/SKIP-EMERGENT   # disables ONLY pre-write.sh (lets stop.sh keep checking scope)
```

Auto-expires after 24h. Delete the file to re-enable sooner.

### Permanent

Remove the hook entry from `.claude/settings.local.json`, or run:

```bash
npx atomic-skills uninstall --project  # removes this skill's artifacts
```

## Promoting to strict mode

After reviewing the relevant log and confirming the would-block decisions were correct:

```bash
# Promote stop.sh (scope-drift gate) to strict:
jq '.strict_mode = true' .atomic-skills/status/config.json > /tmp/c.json && mv /tmp/c.json .atomic-skills/status/config.json

# Promote pre-write.sh (emergent-work provenance gate) to strict:
jq '.emergent_strict_mode = true' .atomic-skills/status/config.json > /tmp/c.json && mv /tmp/c.json .atomic-skills/status/config.json
```

The two knobs are independent — promote each gate when its log shows clean decisions for 7+ days. `atomic-skills:project` offers the same promotion interactively.
