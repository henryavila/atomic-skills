# Prosecution axis checklist (NO-only)

**Purpose:** Optional **disprove-delivery** leg. Paste into `{{AXIS_CHECKLIST}}` when
`--axes` includes `prosecution`. Mission: try to **falsify** RESOLVED claims — never
to bless them.

{{READ_TOOL}} this asset only when prosecution is selected or auto-recommended.

---

## Mission

Hunt evidence that load-bearing Dn/Pn are **not** fully delivered (dual path, missing
hop, teaching residual, acceptance unproven). Output only **PARTIAL / NO / unverified**
candidates for matrix/ledger consideration. **Prosecution is NO-only.**

---

## Status rules (HARD — NO-only)

| Status | Allowed? | Meaning |
|--------|----------|---------|
| **NO** | Yes | Counter-evidence that decision/problem is not delivered |
| **PARTIAL** | Yes | Partial delivery / weak chain / residual dual path |
| **N/A** | Rare | Only when Spec Package explicitly marks Dn/Pn non-applicable — never to dodge |
| **RESOLVED** | **FORBIDDEN** | Prosecution **cannot emit RESOLVED**. Parent/product axes own RESOLVED |

If the agent would "pass" an item: emit **not verified** (or omit) — **do not** upgrade
matrix rows to RESOLVED from this axis.

---

## Checklist items

| # | Item | How to disprove | Status | Evidence |
|---|------|-----------------|--------|----------|
| 1 | Any Matrix A RESOLVED lacks a required stage or multi-hop | Cite missing hop / `?` stage | PARTIAL\|NO | |
| 2 | Acceptance / doneWhen unexercised on a real path | No path proves A-criterion | PARTIAL\|NO | |
| 3 | Dual path or OLD teaching on inventory surface | Residual-class hit | PARTIAL\|NO | |
| 4 | Client/ops remaps or band-aids around NEW truth | Code/UI evidence | PARTIAL\|NO | |
| 5 | Recovery/admin only knows OLD | Force/reclaim path | PARTIAL\|NO | |
| 6 | Tests green on obsolete fixtures only | Fixture vs SSOT | PARTIAL\|NO | |
| 7 | Docs/MCP/skills teach pre-change as current | Teaching surface hit | PARTIAL\|NO | |
| 8 | Spec Package non-goals / must-not violated | Matrix C | PARTIAL\|NO | |

Statuses: **PARTIAL | NO | N/A** only — never RESOLVED.

---

## Gaps output (required)

For every PARTIAL/NO:

1. Title + severity (CRITICAL / HIGH / MEDIUM / LOW)
2. What delivery claim it **disproves** (Dn/Pn / acceptance ID)
3. Evidence `path:line` or command output
4. Suggested fix one-liner (no implementation)

## Forbidden

- Emitting **RESOLVED** for any checklist/matrix row
- Softening product RESOLVED into "looks fine" without counter-evidence search
- Applying fixes
- Inventing decisions not in the Spec Package
- Treating empty gaps as proof of delivery (empty prosecution = "no disproof found", not CLOSED)

---

## Auto-recommend (orchestrator)

Parent **should auto-recommend** adding `prosecution` when **all** hold after first merge:

1. First product+residual merge has **zero CRITICAL and zero HIGH**, **and**
2. Package is a **large rewrite**: ≥5 decisions **or** migration/rename-shaped vocabulary **or** package marks `large-rewrite: true`

Recommendation is advisory (operator can decline). Log whether prosecution ran or was declined.
When declined on a large rewrite with empty first merge, note that in the report (confidence down — not a verdict upgrade).
