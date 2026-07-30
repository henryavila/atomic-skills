# Stage 2 — DESIGN (brainstorm)

## Contract

Run multi-phase DESIGN via `atomic-skills:brainstorm` (Interview → research-digest → debate --gate → critic → user approval). Advance creation-gates to `design`.

**creation-gates stage target:** `design`

After this stage closes:

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
GATE=".atomic-skills/status/creation-gates/<project-id>-<slug>.json"
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$GATE" --advance design --write
```

Do **not** load other `new-plan/stage-*.md` files while executing this stage.

---

Before any plan is decomposed, the WHAT/WHY + chosen approach must exist as a committed, critic-approved `design.md`.

Invoke `atomic-skills:brainstorm` with the user's goal as the seed and the `<project-id>`/`<slug>` this plan belongs to. brainstorm runs B0–B5 for multi-phase DESIGN:

1. **B0 Interview** (HALT spine + ratify)
2. **B0b research-digest** → `projects/<project-id>/<slug>/research-digest.md`
3. **B1 always `atomic-skills:debate --gate`** (no skip ladder)
4. B2 user ratifies → B3 write `design.md` → B4 critic gate → B5 handoff (design-gates `status: ready`)

Lands `projects/<project-id>/<slug>/design.md` that has passed the section lint, the critic's binary `Approved`, the design-gates receipt, and the user's explicit approval.

If brainstorm was interrupted, or the user already has an approved design, accept an existing `design.md` path instead — Stage 4 still **HARD-BLOCKs** without lint + process detectors.

**Optional RENT probe (detect-and-degrade, R-SP-27/28).** superpowers discipline phrasing can enrich the design conversation but is never required:

```bash
test -d "$HOME/.claude/plugins/superpowers" \
  || command -v superpowers >/dev/null 2>&1 \
  && echo "superpowers: available (phrasing probe only)" \
  || echo "superpowers: absent — brainstorm owns DESIGN fully"
```

Whatever the result, DESIGN is produced by `atomic-skills:brainstorm` + the critic — never delegated to superpowers.

**Magnitude exemption (R-ORCH-03):** ad-hoc / single-task lanes and `adopt` skip DESIGN. This multi-phase bootstrap does not force debate on those lanes.

### Failure modes

- **brainstorm not run / no approved design**: Stage 4 PLAN precondition HARD-BLOCKS (R-ORCH-09). Run `atomic-skills:brainstorm` first.
- **superpowers probe fails / absent**: no effect — brainstorm owns DESIGN.
- **User aborts mid-flow**: keep design/source files if any; do NOT write to `.atomic-skills/`.
