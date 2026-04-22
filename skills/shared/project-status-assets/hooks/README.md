# project-status hooks

## Files

- `session-start.sh` — L2b. Reads `.atomic-skills/PROJECT-STATUS.md` and matching initiative; emits via `additionalContext` at SessionStart.
- `stop.sh` — L3. On Stop event, if code was edited but initiative file unchanged, logs (dry-run) or blocks (strict).
- `config.json` — thresholds and mode flag.
- `stop.log` — dry-run decision log (gitignored).

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
