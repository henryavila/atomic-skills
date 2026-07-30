# Stage 5 — Decompose

## Contract

Preview decompose; SPEC gate; user confirm. Advance to `decompose-confirm`.

**creation-gates stage target:** `decompose-confirm`

After this stage closes, advance with:

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
GATE=".atomic-skills/status/creation-gates/<project-id>-<slug>.json"
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$GATE" --advance <next-stage> --write
```

Do **not** load other `new-plan/stage-*.md` files while executing this stage.

---

Apply heuristics to extract `Plan` + `Initiatives[]` + `Tasks[]` from the source markdown. **Always** present the resulting structure (count of phases, initiatives, tasks; first 3 phase titles) for user confirmation before any file is written.

Decomposition rules live in the **Markdown decompose** section.

**SPEC per-task admission gate (R-ORCH-19/23).** After the user confirms the structure and before Stage 6 writes anything, run the per-task gate over the same source. The SPEC gate is **No-Placeholders lint + per-task ambiguity checks, no panel** (R-ORCH-19) — no debate, no critic:

```bash
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/lint-source.js" <source.md> --spec
```

A non-zero exit means at least one `### Tn` task lacks one of its four HOW fields — **exact paths (`Files:`), a `scopeBoundary:`, `acceptance:` criteria, or a DETERMINISTIC `verifier:`** (`kind shell`/`test`/`query`; `manual` does not satisfy the gate). No task is admitted to implement without all four (R-ORCH-23). Fix the source and re-run; the per-task interior carries into the materialized task's existing schema fields (`description`/`acceptance[≤5]`/`scopeBoundary[]`/`verifier`) — **no new schema keys**. Bullet-mode task lists (a `### Tasks` marker + `- **Tn — …**` bullets) cannot express the interior, so the gate requires the verbose `### Tn` form.

**Data-impact acceptance for DESTRUCTIVE tasks (G4 — SPEC does not admit without it).** A task whose work is *destructive* — it deletes a class/model/table, drops or renames a column, mass-deletes rows, or decommissions a feature (signalled by a `decommission`/`destructive`/`drop`/`delete` tag, or by a title/acceptance that says delete/drop/decommission/remove-model) — has a failure mode that a code-only acceptance cannot see: **data that references the thing by value, not by symbol**. Grep-zero of code references is *necessary but not sufficient* — a deleted `App\Models\AutomaticMail` can still be the live `sender_type` string in 15k polymorphic rows, fatal at read time. So for any destructive task, the SPEC gate requires **at least one `acceptance:` criterion of DATA-impact kind**, not only code-impact: e.g. *"scan polymorphic columns / FKs / enum+string columns for rows referencing the dropped class or value; the affected-row count is measured and its disposition (backfill / purge / block) is decided"*, ideally backed by a `kind: query`/`kind: shell` verifier that counts orphans. A destructive task carrying only code-impact acceptance (grep-zero, no-refs) is **not admitted** — surface it: *"T-00x is destructive but its acceptance only checks code references; add a data-impact criterion (orphan-row scan + disposition) or justify why no stored data can reference it."* The user may attest no data path exists (recorded), but the gate must be *answered*, never skipped silently. This catches the orphaned-data class in the PLAN, not in post-implementation review.

**SPEC-gate exemptions (record verbatim, never silent):** the triage-routed ad-hoc / single-task lanes (R-ORCH-03) and `adopt` (pre-lifecycle capture) skip the per-task SPEC gate — they still run the bare No-Placeholders lint from Stage 4. This default multi-phase bootstrap is never exempt.
