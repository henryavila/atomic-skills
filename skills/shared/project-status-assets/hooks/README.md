# project-status hooks

## Files

- `session-start.sh` — L2b. v2 hook: walks the 3-level state (PROJECT-STATUS index → active Plan → phase Initiative), surfaces branch mismatches, signals phase-transition when the active initiative has 0 pending/active tasks, and injects the aiDeck dashboard URL when `~/.aideck/env` is present. Falls back to a standalone branch-matched initiative when no plan is active. Emits via `additionalContext` at SessionStart.
- `stop.sh` — L3. v2 hook: compares files written during the turn (via the JSONL transcript's `Write` / `Edit` / `MultiEdit` / `NotebookEdit` tool calls) against the active initiative's `scope.paths`. When out-of-scope writes exceed `drift_threshold` (default 0.5), logs a dry-run decision or blocks via exit 2 in strict mode. Scope-less initiatives skip the check.
- `config.json` — `strict_mode`, `drift_threshold` (default 0.5), `dry_run_started` date, legacy `source_globs`, and stack/archive heuristics.
- `drift.log` — dry-run decision log emitted by `stop.sh` v2 (gitignored). One JSON object per Stop event.
- `stop.log` — legacy v1 dry-run decision log (kept for backward compatibility on existing installs; no longer written by v2).

## SessionStart v2 — context layout

The hook composes its `additionalContext` payload in this order, skipping any section whose source isn't present:

1. **Active Project Status** — first 30 lines of `.atomic-skills/PROJECT-STATUS.md`.
2. **Active Plan: `<slug>`** — picks the active plan whose `branch:` matches `git symbolic-ref --short HEAD` first; otherwise the most recently modified active plan. Surfaces current phase, plan branch, and a `⚠️` warning when the plan branch differs from the current branch or multiple active plans exist without a tiebreaker.
3. **Current Initiative: `<slug>` (`<plan>/<phase>` or `(standalone)`)** — the initiative whose `parentPlan` + `phaseId` match the plan's `currentPhase` and whose `status` is `active`. Falls back to a standalone branch-matched active initiative when no plan path resolves. Surfaces a `⚠️` warning on branch mismatch and a `🔔` phase-transition prompt when the initiative's frontmatter `tasks:` block has zero entries with `status: pending` or `status: active`.
4. **aiDeck running** — when `$HOME/.aideck/env` exists, parses the `AIDECK_URL=` line and renders a dashboard link. aiDeck writes this file on `aideck serve` and removes it on shutdown (see `aideck/src/server/env-file.ts`), so a stale file only persists across crashes — the hook treats presence as a best-effort hint, not a guarantee.

## Debugging

### Check if hooks are registered (Claude Code)

```bash
cat .claude/settings.local.json | jq '.hooks'
```

Expected: entries for `SessionStart` and optionally `Stop` pointing to `.atomic-skills/status/hooks/*.sh`.

### Simulate a Stop hook call

```bash
echo '{"stop_hook_active":false,"transcript_path":"/path/to/transcript.jsonl"}' | \
  bash .atomic-skills/status/hooks/stop.sh
echo "exit=$?"
```

### Read the dry-run log

```bash
tail -50 .atomic-skills/status/drift.log | jq .
```

Each line is a JSON object: `{ts, mode, initiative, breadcrumb, total_files, out_of_scope, threshold, would_block, out_files[]}`. Tune `drift_threshold` in `config.json` if the would-block decisions don't match your judgment.

## Disabling

### Temporary (24h)

```bash
touch .atomic-skills/status/SKIP
```

Auto-expires after 24h. Delete the file to re-enable sooner.

### Permanent

Remove the hook entry from `.claude/settings.local.json`, or run:

```bash
npx atomic-skills uninstall --project  # removes this skill's artifacts
```

## Promoting to strict mode

After reviewing `drift.log` and confirming the would-block decisions were correct:

```bash
jq '.strict_mode = true' .atomic-skills/status/config.json > /tmp/c.json && mv /tmp/c.json .atomic-skills/status/config.json
```

Or invoke `atomic-skills:project-status` — it offers strict-mode promotion if dry-run has been active 7+ days.
