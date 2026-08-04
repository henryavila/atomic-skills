# Intent Package (admission template)

**Purpose:** Capture the minimum product intent needed before any audit leg runs.
Without a valid Intent Package, `audit-delivery` **ABORTS** — no matrices, no agents, no verdict.

{{READ_TOOL}} this asset in Phase 0. Fill every required field below (or mark N/A with reason only where allowed).

---

## Micro skeleton (paste / fill)

```markdown
# Intent Package — <slug>

## Decisions (D1…Dn) — need ≥2 **or** Problems ≥1
| ID | Decision (verbatim short) | Why it matters |
|----|---------------------------|----------------|
| D1 | … | … |

## Original problems (P1…Pn) — need ≥1 **or** Decisions ≥2
| ID | Problem | Expected fix shape |
|----|---------|-------------------|
| P1 | … | … |

## Acceptance / doneWhen (required ≥1)
| ID | Criterion | Source |
|----|-----------|--------|
| A1 | … | handoff / plan doneWhen / acceptance section |

## Non-goals / do-not-reopen (optional)
- …

## Vocabulary delta (required when migration / rename shaped)
| OLD | NEW | Scope |
|-----|-----|-------|
| … | … | storage / API / UI label / docs |

## Surface inventory (≥3 surfaces **or** single-surface flag)
| Surface | Path / system | Role in delivery |
|---------|---------------|------------------|
| … | … | …

**Single-surface flag (only if true):** `single-surface: true` — reason: …
(Log in report when set; residual still runs on that surface.)

## Key SSOT paths
- …
```

---

## Admission rules (HARD-GATE)

**Pass only when all of the following hold:**

1. **Spine** — ≥2 numbered decisions **OR** ≥1 original problem (same OR as legacy abort; both preferred).
2. **Acceptance** — ≥1 acceptance criterion **or** explicit `doneWhen` / happy-path criterion from plan/handoff.
   - Freeform "it should work" without a checkable criterion does **not** count.
3. **Vocabulary delta** — if the package is migration/rename/state-machine shaped (new statuses, renamed enums, dual lifecycle), a **non-empty** OLD→NEW vocabulary table is required.
   - Pure additive features with no rename may mark `vocabulary: none (additive)` with one-line reason.
4. **Surface inventory** — list **≥3** delivery surfaces (code/API/UI/jobs/docs/MCP/skills/scripts/config/env as applicable) **OR** set `single-surface: true` with a logged reason in the report.
   - Inventory feeds residual hunt; inventing zero surfaces is an abort.

### Abort points (operator-facing)

| Failure | Abort copy |
|---------|------------|
| Missing spine (decisions/problems) | `ABORT: Intent Package incomplete — need ≥2 decisions or ≥1 original problem. Fill {{ASSETS_PATH}}/intent-package.md (micro skeleton) or point at plan/handoff, then re-run.` |
| Missing acceptance / doneWhen | `ABORT: Intent Package missing acceptance — add ≥1 acceptance criterion or doneWhen. See Intent Package template.` |
| Migration without vocabulary | `ABORT: migration/rename-shaped intent needs a non-empty vocabulary delta (OLD→NEW). See Intent Package template.` |
| No surface inventory and no single-surface flag | `ABORT: surface inventory required (≥3 surfaces) or explicit single-surface flag. See Intent Package template.` |

After one ask, if still incomplete: **do not** soft-proceed with partial package.

---

## Field notes

### Decisions / problems
- Prefer operator or plan wording; do **not** invent product choices.
- Map later to Matrix A / Matrix B (`RESOLVED | PARTIAL | NO | N/A`).

### Acceptance / doneWhen
- Prefer checkable outcomes ("poll returns only NEW terminal set", "approve heals residual drafts").
- Sources: handoff acceptance, plan `doneWhen`, design acceptance section, PRD.

### Vocabulary delta
- OLD_TERMS / NEW_TERMS seed residual hunt (see residual-hunt-protocol).
- Include aliases operators still type if they must remain input-only.

### Surface inventory
- Examples of surface classes (not exhaustive): API handlers, workers/jobs, DB/status SSOT, client UI, e2e fixtures, MCP tools, agent skills, ops runbooks, scripts, config defaults / `.env.example`.
- Domain-specific names OK; keep residual-capable surfaces listed.

### Non-goals / SSOT
- Non-goals prevent reopening settled rejects.
- SSOT paths (enums, hub phases, config keys) anchor evidence chains.

---

## Operator present-form (compact)

Before Phase 1, present:

```text
Intent Package — <slug>
Decisions: Dn | Problems: Pn | Acceptance: An
Vocabulary: <rows | none (additive)>
Surfaces: N | single-surface: …
Sources: <paths>
```

Proceed unless the operator objects. Do not re-litigate decisions in chat.

---

## Out of scope for this asset (later phases)

- Full `businessIntent` importer from project YAML (F4).
- Spec Package (strip success narrative) — F2.
- Matrix C / must-not rows — F2.
