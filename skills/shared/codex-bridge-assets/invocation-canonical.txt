# Canonical Codex Invocation

Use this exact command shape for every Codex invocation in cross-model review.
Departure from this shape causes known failures (stdin hang, dirty banner
contamination, orphan processes).

## Variables to substitute

- `<BRIEFING_PATH>`: path to briefing markdown file (input)
- `<OUTPUT_PATH>`: path to output markdown file (Codex writes final message here)
- `<TIMEOUT_SECONDS>`: integer seconds (default 600 = 10 min)
- `<MODEL_FLAG>`: empty by default. If user passed `--model X`, set to `--model X`.

## Command

```bash
timeout <TIMEOUT_SECONDS> codex -a never exec \
  <MODEL_FLAG> \
  -c model_reasoning_effort=high \
  --sandbox read-only \
  --skip-git-repo-check \
  --ephemeral \
  -o <OUTPUT_PATH> \
  - <<BRIEFING_PATH> \
  2>/dev/null
```

Note: `- <<BRIEFING_PATH>` means stdin is read from `<BRIEFING_PATH>` and the
literal `-` tells `codex exec` to take its prompt from stdin. In shell syntax
this is `- < /path/to/briefing.md`.

## Flag-by-flag rationale

| Flag | Why |
|------|-----|
| `timeout <N>` | External kill. Codex has known hangs (issues #7852, #4337). |
| `-a never` | Approval mode `never` — required for non-interactive. |
| `exec` | Subcommand for headless execution. |
| `-c model_reasoning_effort=high` | Forces deep reasoning. Worth the tokens for adversarial review. |
| `--sandbox read-only` | Defense-in-depth. Reviewer must never write. |
| `--skip-git-repo-check` | Avoids abort if cwd isn't a git repo. |
| `--ephemeral` | Don't persist session in history. Each review is fresh. |
| `-o <OUTPUT_PATH>` | Write final message (markdown) to file. Survives pipe failures. |
| `- < <BRIEFING_PATH>` | Prompt comes from stdin (file redirected). |
| `2>/dev/null` | Suppress banner (stderr). |

## Exit codes

- `0`: ok, parse output file
- `124`: timeout (set by `timeout(1)`). Abort with message + suggest retry.
- other: Codex error. Abort with message + capture stderr if user wants debug.

## DO NOT

- Pass prompt as argument (`codex exec "prompt"`) — stdin may still hang.
- Omit stdin redirection (`- < /path`) — `codex exec` may hang.
- Use `--full-auto` — deprecated.
- Use `--yolo` / `--dangerously-bypass-approvals-and-sandbox` — bypasses sandbox.
