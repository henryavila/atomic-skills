# Stage 8 — Adversarial review (always runs)

## Contract

Internal + ground-truth + cross-model review + receipt gates. Advance to `reviews`. Do not rewrite review-plan skill.

**creation-gates stage target:** `reviews`  
**Precondition:** creation-gate already at `process-map` (L1+L2 done). If still on `summaries`, **STOP** and run `new-plan/stage-process-map.md` first — Iron Law P1.

After this stage closes, advance with:

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
GATE=".atomic-skills/status/creation-gates/<project-id>-<slug>.json"
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$GATE" --advance <next-stage> --write
```

Do **not** load other `new-plan/stage-*.md` files while executing this stage.

---

The plan is materialized but NOT yet ready. Run review before declaring done.

**Stage 8a — Internal review (always, no user prompt).**

Invoke `atomic-skills:review-plan --mode=internal` with arg = the plan file path. The `--mode=internal` flag short-circuits the Step 0 prompt so this non-interactive stage doesn't block on user input each iteration. This is cheap (no external dependency, no token cost beyond the skill itself) and catches:

- Soft-language violations (G2 — see `docs/kb/code-quality-gates.md`)
- Bare assertions without `verified_by:` or `unverified:` (G6)
- Internal contradictions, broken dependencies, ambiguous tasks

Apply the findings inline before proceeding. Re-run `review-plan --mode=internal` until it returns zero findings of severity major or higher. When it returns clean, `review-plan` writes the **internal receipt** — a `- internal:` line in `## Reviews`. That is **not** the ground-truth receipt (different mode / different line).

**Stage 8a2 — Ground-truth review (always, specialized mode, no user prompt).**

Invoke **separately** (attributable specialized type — do **not** fold into internal):

```text
atomic-skills:review-plan --mode=ground-truth <plan_path>
```

Alias: `--mode=gt`. This is **Flow E** in `review-plan` (items 21–22 only): plan premises vs code (phantoms) **and** code present that the plan is silent about. Procedure: `skills/shared/project-assets/ground-truth-review.md`. **Empty / no-product-code repos still run** and persist `Status: complete-empty-repo` with A/B "none" + scan evidence — silence is not a pass.

When clean, it writes:

1. `## Ground-truth review` (Status + ### A + ### B)
2. `- ground-truth: … | mode=ground-truth | fp=<hex> | …` under `## Reviews`  
   `mode=ground-truth` attributes Flow E; `fp=` is the plan-substance fingerprint (stale after plan/task edits).

Stage 8c's deterministic gates check both receipts; either missing is treated as **not run**. `implement` HARD-BLOCKS without the ground-truth receipt.

**Stage 8b — CROSS-MODEL REVIEW via host external default (intrusive-actions rule).**

Resolve `<externalMode> = hostDefaultExternalMode(hostFamily)` from
`src/review-provider-field.js` (Claude/Cursor/unknown → `codex`; Grok host →
`codex`; Codex host → `grok`). Do **not** hardcode `--mode=codex` when the host
default is Grok.

**Ask shape (HARD — anti agent-biased skip):**

1. **Never** mark skip as Recommended. **Never** put N/skip first in options.
2. Present options in this order only:
   - **A (first):** `y — rodar CROSS-MODEL agora via <externalMode>` (Recommended)
   - **B:** `n — pular` — description: only if the operator types in Other:
     `skip cross-model: <motivo em ≥1 frase>`
3. On **y**: invoke `atomic-skills:review-plan` with args = `<plan path> --mode=<externalMode>` (skips Step 0a; runs the external sealed-envelope). Apply blocker/critical findings. Persist receipt with `provider` + `provider_version` via `buildProviderFields` (same-family remap → `provider: local`, never counts as CROSS-MODEL REVIEW).
4. On **n without** a typed `skip cross-model: <motivo>` (≥15 chars after the prefix, not ban-list filler): **STOP and re-ask**. Do **not** write SKIPPED.
5. On **n with** valid typed reason: write **exactly**:
   `- cross-model: SKIPPED — operator: <verbatim reason after the prefix>`
   Never write `not provided`, never invent a reason, never narrate "você escolheu pular" without quoting that operator line.

Announce (cost note ok):

> O plano passou no review interno. Rodar CROSS-MODEL via `<externalMode>` (`atomic-skills:review-plan --mode=<externalMode>`)? Custo ~$0.50–$1.50, 5–10 min. Skip só com texto: `skip cross-model: <motivo>`.

Persistence: review file → `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<plan-slug>.md`; link from `## Reviews` as `- cross-model (<provider>):` (legacy `- codex:` still accepted).

**Stage 8c — Receipt gate (deterministic, HARD-BLOCK).**

8a/8b are LLM steps; the close of Stage 8 is zero-token and must prove (1) internal receipt, (2) ground-truth receipt (even on empty repos), and (3) no invalid cross-model SKIPPED:

```bash
PLAN_PATH=".atomic-skills/projects/<projectId>/<planSlug>/plan.md"
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
node "$PKG_ROOT/scripts/find-unreviewed-plans.js" "$PLAN_PATH"
node "$PKG_ROOT/scripts/find-plans-missing-ground-truth.js" "$PLAN_PATH"
node "$PKG_ROOT/scripts/find-invalid-cross-model-skips.js" "$PLAN_PATH"
```

- `find-unreviewed-plans` non-zero → missing `- internal:` — re-run 8a.
- `find-plans-missing-ground-truth` non-zero → missing/incomplete ground-truth section, or `- ground-truth:` line without `mode=ground-truth` — re-run **8a2** (`--mode=ground-truth`; empty-repo → `complete-empty-repo`). **HARD-BLOCKS** declaring ready and later **HARD-BLOCKS** `implement`.
- `find-invalid-cross-model-skips` non-zero → SKIPPED without `operator:` / short / banned reason — fix receipt or run 8b for real. **HARD-BLOCKS** declaring ready.

Scoped to this plan path (only the newly materialized plan); tree-wide backstop remains `project verify`.
