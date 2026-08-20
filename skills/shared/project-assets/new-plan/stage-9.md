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
- Flow is **not** required for ready. Suggested next: `atomic-skills:project flow` (optional day-2) or `status`
- Reviews: internal (zero findings) + codex (verdict, counts, link to `.atomic-skills/reviews/<…>.md`) OR (skipped per user)
