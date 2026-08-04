# Residual axis checklist

**Purpose:** Domain-agnostic half-migration hunt. Paste into `{{AXIS_CHECKLIST}}` for the **residual** leg. Full protocol: {{READ_TOOL}} `{{ASSETS_PATH}}/residual-hunt-protocol.md` first.

---

## Mission

Derive OLD_TERMS / NEW_TERMS × surface inventory; classify storage | alias | teaching | dead. **Invalid residual** (starved terms / fake empty success) blocks CLOSED.

---

## Pre-flight (must pass)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 0a | OLD_TERMS derived (or additive package documents none + NEW_TERMS from SSOT) | ? | |
| 0b | NEW_TERMS derived from vocabulary + SSOT | ? | |
| 0c | Surface inventory listed (≥3 or single-surface flag) | ? | |
| 0d | Protocol validity: `valid` \| `invalid residual` | ? | |

If 0a–0c fail → mark **invalid residual**, emit HIGH/CRITICAL finding, do **not** report "nothing found" as clean.

---

## Mechanism classes (cover all)

| # | Class | Hunt | Status | Hits |
|---|-------|------|--------|------|
| 1 | Dual SSOT | Two writers/readers for same concept (old + new) | ? | |
| 2 | Client rewrite | UI remaps server truth from side channels | ? | |
| 3 | Recovery gap | reclaim/heal/retry skips NEW residual states | ? | |
| 4 | Force/admin legacy | admin/force/reprocess only accepts OLD labels | ? | |
| 5 | Teaching surfaces | docs/MCP/skills/scripts teach pre-change as current | ? | |
| 6 | False-green fixtures | tests seed OLD while asserting NEW | ? | |
| 7 | Config/env drift | defaults, `.env.example`, checklists contradict decisions | ? | |

Domain greps (e.g. note-pipeline strings) are **illustrations only** — replace with package terms.

---

## Per-surface scan

For each surface in inventory:

| Surface | OLD hits | NEW teaching OK? | Class of worst hit | Evidence |
|---------|----------|------------------|--------------------|----------|
| … | | | | |

---

## Output extras

- Findings Ledger rows for every non-benign hit (axis=`residual`)
- Reviewed-OK alias/dead with evidence
- Explicit: residual excluded? (if yes → global PARTIAL cap — body rule)
