# Verdict gate + Accept Record

**Purpose:** Compute `CLOSED | PARTIAL | OPEN` without false closure. Severity rules are load-bearing; a **green suite** alone never upgrades a verdict.

{{READ_TOOL}} this asset in Phase 3 (and after reaudit) before writing the final verdict.

Multi-hop staged evidence columns are **F2** — this asset locks severity closing only.

---

## Verdict rules

| Verdict | Rule |
|---------|------|
| **CLOSED** | All load-bearing Dn/Pn are `RESOLVED` or `N/A`; **zero CRITICAL** residual/open findings; every open **HIGH** has a durable **Accept Record** (or no open HIGH); residual leg was run and **not** `invalid residual`; residual was **not** excluded (exclude residual caps PARTIAL) |
| **PARTIAL** | Core happy path largely RESOLVED but residual CRITICAL/HIGH remain without Accept Records, any Dn/Pn is PARTIAL, residual excluded/invalid, or HIGH accepted only in chat (not recorded) |
| **OPEN** | Any load-bearing Dn/Pn is `NO`, audit could not verify key chains, or CRITICAL residual remains (CRITICAL cannot be Accept-Recorded away) |

### Hard constraints

1. **CRITICAL never Accept-Recorded to CLOSED** — there is no Accept Record path that yields CLOSED while any CRITICAL residual/finding is open. Tracked CRITICAL ⇒ at best PARTIAL (usually OPEN if load-bearing).
2. **HIGH** open ⇒ either:
   - per-finding **Accept Record** (see schema), then CLOSED is possible only if all other CLOSED rules hold, **or**
   - verdict stays **PARTIAL** (or OPEN if other rules demand).
3. **Green suite / green diff alone never upgrades** PARTIAL→CLOSED or OPEN→PARTIAL. Tests are one evidence source for matrix rows, not a substitute for residual or Accept Records.
4. **Invalid residual** or **exclude residual** ⇒ cap **PARTIAL** (never CLOSED).

---

## Accept Record schema

Required for each open HIGH that must not force PARTIAL when aiming for CLOSED:

```yaml
# Accept Record (one per finding)
findingId: "<ledger # or stable id>"   # required
risk: "<what can still go wrong>"      # required
mitigation: "<why acceptable now / follow-up>"  # required
operator: "<who accepted>"             # required
at: "<ISO-8601 timestamp>"             # required
expires: "<ISO-8601 or null>"          # optional
```

### Markdown form (report section)

```markdown
## Accept Records

| Finding | Risk | Mitigation | Operator | At | Expires |
|---------|------|------------|----------|-----|---------|
| H-12 | … | … | @op | 2026-08-04T12:00:00Z | — |
```

### Chat is not enough

Verbal "we accept that HIGH" without a durable Accept Record in the report **does not** clear HIGH for CLOSED. Re-enter the record into `--out` via {{WRITE_TOOL}}.

### CRITICAL

Do **not** write Accept Records for CRITICAL to justify CLOSED. If the operator insists on shipping with CRITICAL residual, verdict remains **PARTIAL** or **OPEN** and the report lists CRITICAL under Residual — never CLOSED.

---

## Computation checklist

Before stamping verdict:

- [ ] Matrix A/B statuses only `RESOLVED | PARTIAL | NO | N/A` with evidence
- [ ] Residual protocol valid (or exclude residual logged → PARTIAL cap)
- [ ] Zero open CRITICAL for CLOSED candidate
- [ ] Every open HIGH has Accept Record **or** verdict ≤ PARTIAL
- [ ] No upgrade solely because suite is green
- [ ] Verdict string is exactly `CLOSED` | `PARTIAL` | `OPEN` (G2 — no soft language)

---

## Report stub (verdict block)

```markdown
**Verdict:** CLOSED | PARTIAL | OPEN

### Verdict rationale
- CRITICAL open: N
- HIGH open: N (Accept Records: N)
- Residual: ran | excluded (PARTIAL cap) | invalid residual (PARTIAL cap)
- Suite/tests: evidence only — not a gate upgrade
```
