# Product axis checklist

**Purpose:** Trace each load-bearing Dn/Pn end-to-end. Paste into `{{AXIS_CHECKLIST}}` when spawning the **product** leg (or run inline when degraded).

{{READ_TOOL}} this asset before filling the product axis brief. Residual protocol lives in `residual-hunt-protocol.md` + `checklists/residual.md` — do not collapse residual into product happy-path.

---

## Mission

Trace each decision / original problem **config → code → UI/ops → test**. Hunt counter-evidence (half-migration, dual path, false green). Status only: `RESOLVED | PARTIAL | NO | N/A`.

---

## Checklist items

| # | Item | How to verify | Status | Evidence |
|---|------|---------------|--------|----------|
| 1 | Every Matrix A Dn has expected evidence chain filled | Report Matrix A rows | ? | |
| 2 | Every Matrix B Pn has expected fix shape filled | Report Matrix B rows | ? | |
| 3 | Spec / SSOT (stage S) matches Intent Package | Enums, config defaults, hub phases, migrations | ? | |
| 4 | Core path (stage C) implements the decision | Handler / job / service / transition | ? | |
| 5 | User/ops surface (stage U) exposes correct behavior | UI CTA, API shape, CLI | ? | |
| 6 | Tests (stage T) assert **canonical** behavior | Not obsolete fixtures with new names only | ? | |
| 7 | Negative / dual-path (stage X) checked for load-bearing rows | Dual path absent or intentional alias evidenced | ? | |
| 8 | Load-bearing RESOLVED has multi-hop (≥2 hops) or single-surface waiver | See `matrices.md` | ? | |
| 9 | Matrix C must-not seeded and searched | non-goals / OLD / mustNot | ? | |
| 10 | Acceptance / doneWhen criteria exercised | At least one path proves each A-criterion | ? | |

---

## Gaps output (required)

For every PARTIAL/NO:

1. Title + severity (CRITICAL / HIGH / MEDIUM / LOW)
2. Impact on operator / user / agent
3. Suggested fix one-liner
4. Evidence `path:line` or command output

## Forbidden

- Treating green suite alone as RESOLVED for a Dn/Pn
- Inventing decisions not in the Spec Package
- Applying fixes
- Skipping stage cells with silent `?` while claiming RESOLVED
