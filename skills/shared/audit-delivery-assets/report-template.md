# Audit Delivery report template (SSOT)

**Purpose:** Single source of truth for report shape. {{WRITE_TOOL}} to `--out` using this structure. Accept Register (Accept Records) is part of this SSOT — chat acceptance is not enough (see `verdict-gate.md`).

---

## Full report skeleton

```markdown
# Audit Delivery — <slug>
**Date:** <ISO date>
**Mode:** audit | audit-and-fix | reaudit
**Depth:** full | light
**Axes:** product,residual[,…]
**Intent sources:** <paths>
**Verdict:** CLOSED | PARTIAL | OPEN

## Intent Package
### Decisions
| ID | Decision | Why |
|----|----------|-----|

### Original problems
| ID | Problem | Expected fix shape |
|----|---------|-------------------|

### Acceptance / doneWhen
| ID | Criterion | Source |
|----|-----------|--------|

### Vocabulary delta
| OLD | NEW | Scope |
|-----|-----|-------|
<!-- or: vocabulary: none (additive) — reason -->

### Surface inventory
| Surface | Path / system | Role |
|---------|---------------|------|
<!-- or single-surface: true — reason -->

### Non-goals / do-not-reopen
- …

### Key SSOT paths
- …

## Spec Package (criteria strip — no success narrative)
<!-- Dn/Pn IDs, chains, non-goals, terms, SSOT only — see spec-package.md -->

## Matrix A — Decisions (stages S C U O T X)
| ID | Decision | Expected chain | S | C | U | O | T | X | Status | Evidence |
|----|----------|----------------|---|---|---|---|---|---|--------|----------|

## Matrix B — Problems
| ID | Problem | Expected fix shape | S | C | U | O | T | X | Status | Evidence |
|----|---------|-------------------|---|---|---|---|---|---|--------|----------|

## Matrix C — must-not
| ID | Must NOT | Seed | Status | Evidence |
|----|----------|------|--------|----------|

## Findings Ledger
| # | Title | Sev | Axis | Evidence | Impact | Suggested fix (one-liner) |
|---|-------|-----|------|----------|--------|---------------------------|
<!-- detail: findings-ledger.md -->

## Residual (ordered)
| # | Title | Sev | Class | Evidence | Status |
|---|-------|-----|-------|----------|--------|

### Residual protocol
- Terms: OLD=… NEW=…
- Validity: valid | invalid residual | excluded (PARTIAL cap)
- Surfaces hunted: N

## Accept Register (Accept Records)
| Finding | Risk | Mitigation | Operator | At | Expires |
|---------|------|------------|----------|-----|---------|
<!-- Required for each open HIGH when aiming for CLOSED. Never for CRITICAL→CLOSED. -->

## Tests / commands observed
| Command | Result | Notes |
|---------|--------|-------|

## Self-review against gates
- G1 read-before-claim: …
- G2 soft-language: verdict is CLOSED|PARTIAL|OPEN only
- G6 reference-or-strike: …

## Confidence %
…
```

---

## Accept Register rules (summary)

1. **HIGH** open → durable Accept Record row **or** verdict ≤ PARTIAL.
2. **CRITICAL** never Accept-Recorded to **CLOSED**.
3. Chat-only acceptance does **not** clear HIGH.
4. Full schema: `verdict-gate.md`.

---

## Mode notes

| Mode | Report behavior |
|------|-----------------|
| **audit** | Write/overwrite draft at `--out`; stop after Phase 3 unless composition/reaudit later |
| **reaudit** | **Append-only** reaudit section; do not rewrite Intent Package unless recovery requires it (`reaudit-entry.md`) |
| **audit-and-fix** | Update ledger + reaudit sections through fix rounds |

Default path: `.atomic-skills/reviews/audit-delivery-<slug>-<YYYYMMDD>.md`
