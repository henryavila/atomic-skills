# Stage 9 — Announce

## Contract

Announce plan path; assert-creation-stage --ready. Terminal stage `ready`.

**creation-gates stage target:** `ready`

After this stage closes, advance with:

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
GATE=".atomic-skills/status/creation-gates/<project-id>-<slug>.json"
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$GATE" --advance <next-stage> --write
```

Do **not** load other `new-plan/stage-*.md` files while executing this stage.

---

- Plan path
- N initiatives created
- Active phase: `<F0> — <title>`
- **Process map (mandatory):** `process/process.yaml` + `process/map.html` — was shown (browser and/or TUI per non-skippable display question) before ratify; content-sha from L1
- Reviews: internal (zero findings) + codex (verdict, counts, link to `.atomic-skills/reviews/<…>.md`) OR (skipped per user)
- HARD confirm: `node scripts/find-missing-process-map.js <plan.md> --strict-html` exits 0
- Suggested next: `atomic-skills:project process` (reopen map) or `status`
