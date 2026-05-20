# project-status hooks

## Files

- `session-start.sh` — L2b. v2 hook: walks the 3-level state (PROJECT-STATUS index → active Plan → phase Initiative), surfaces branch mismatches, signals phase-transition when the active initiative has 0 pending/active tasks, and injects the aiDeck dashboard URL when `~/.aideck/env` is present. Falls back to a standalone branch-matched initiative when no plan is active. Emits via `additionalContext` at SessionStart.
- `stop.sh` — L3. On Stop event, if code was edited but initiative file unchanged, logs (dry-run) or blocks (strict).
- `config.json` — thresholds and mode flag.
- `stop.log` — dry-run decision log (gitignored).

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
tail -50 .atomic-skills/status/stop.log
```

Each line is a timestamped decision the hook would have taken in strict mode.

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

After reviewing `stop.log` and confirming dry-run decisions were correct:

```bash
jq '.strict_mode = true' .atomic-skills/status/config.json > /tmp/c.json && mv /tmp/c.json .atomic-skills/status/config.json
```

Or invoke `atomic-skills:project-status` — it offers strict-mode promotion if dry-run has been active 7+ days.
