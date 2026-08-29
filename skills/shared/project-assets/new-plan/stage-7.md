# Stage 7 — Activate first phase

## Contract

Activate first phase (currentPhase = F0). Advance toward `summaries` as needed.

**creation-gates stage target:** `summaries`  
**Next:** `new-plan/stage-8.md` (reviews).

After this stage closes, advance with:

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
GATE=".atomic-skills/status/creation-gates/<project-id>-<slug>.json"
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$GATE" --advance summaries --write
```

Do **not** load other `new-plan/stage-*.md` files while executing this stage. After summaries, load Stage 8 reviews. There is no flow creation stage.

---

- Set the first phase's initiative to `status: active`; the rest stay `status: pending`.
- Set the Plan's `currentPhase` to the first phase id.
