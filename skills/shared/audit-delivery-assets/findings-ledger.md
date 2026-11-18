# Findings Ledger

**Purpose:** Merge product + residual (+ opt-in axes) into one deduped ledger before the verdict gate.

---

## Table (report SSOT)

| # | Title | Sev | Axis | Evidence | Impact | Suggested fix (one-liner) |
|---|-------|-----|------|----------|--------|---------------------------|
| 1 | … | CRITICAL\|HIGH\|MEDIUM\|LOW | product\|residual\|… | `path:line` | … | … |

---

## Merge rules

1. **Dedup by mechanism** — same root cause → one finding (prefer higher severity).
2. **Axis tag** — keep primary discovering axis; note secondary axes in Impact if useful.
3. **Evidence required** — agent claims without `path:line` or command output are unverified (G1 / G6): re-read or strike.
4. **Severity** — apply `severity.md` labels consistently.
5. **Pass residual is mandatory** if any Dn/Pn is PARTIAL/NO or any CRITICAL/HIGH exists — even if product said "mostly done".

---

## After fix rounds

Mark each ledger row: `OPEN | FIXED | STILL OPEN | REGRESSED` (reaudit). Keep historical titles stable; append reaudit notes rather than renumbering casually.

---

## Linkage

- Matrix PARTIAL/NO rows → at least one ledger finding when load-bearing.
- Residual hits (non-benign) → ledger rows with class in Impact or title.
- Accept Register references ledger `#` / stable id (`verdict-gate.md`).
