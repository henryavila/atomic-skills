# Claude headless smoke notes — dogfood plan review 2026-07-17

- briefing-channel: stdin-redirect into `claude -p` (`claude ... < briefing.md`) — works; non-empty stdout; exit 0
- tools-allowlist: `Read,Grep,Glob` with `--permission-mode dontAsk` — accepted, no hang
- auth-path: `--safe-mode` with existing Claude session auth (no ANTHROPIC_API_KEY required for this run; stderr empty)
- exit-0: yes (dogfood plan review, ~84s wall, claude 2.1.212)
- model-aliases-from-help: fable, opus, sonnet (from `claude --help` --model description); full-name example claude-fable-5
- also-proven: `--effort high` (dogfood); canonical leaf now locks `--effort xhigh`; `--no-session-persistence`, `--disable-slash-commands`, `--output-format text`
- review-file: .atomic-skills/reviews/2026-07-17-claude-dogfood-plan-review-clean.md
- verdict: needs_changes (2 blocker, 2 critical, 4 major, 2 minor) — applied to plan below
