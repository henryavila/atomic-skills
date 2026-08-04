# Reaudit entry (`--mode=reaudit`)

Entry path when the operator re-checks a **prior** audit-delivery report after
manual fixes or an interrupted fix loop. Full dual residual-blind reaudit is a
later product tooth; this asset covers **load → recover → re-run → append**.

## Preconditions (HARD)

1. **`--out` required** — path to the existing report (or pass the report path as
   the sole path argument if documented by the operator). Without a report path:
   **ABORT** and ask for `--out=…` (or the report file).
2. **Read-only on the product tree** — reaudit mode does **not** apply product
   fixes. Findings may only be re-scored; do not enter Phase 4 fix orchestration
   unless the operator re-invokes with `--mode=audit-and-fix`.
3. **Append-only report writes** — do not rewrite or delete prior Matrix /
   Findings / Residual sections. Append a dated **Reaudit** section (and update
   a top-level **Verdict** / summary only if the report format already has a
   single current-verdict field — then record previous verdict under the new
   section for history).

## Steps

### 1. Load report

{{READ_TOOL}} the path from `--out` (or recovered report path). Confirm it is an
audit-delivery report (Intent Package, Matrix A/B, Findings Ledger, or equivalent).

If the file is missing or empty: **ABORT** — cannot reaudit without a prior
ledger.

### 2. Recover Intent Package

Extract from the report (preferred) or re-resolve from the original intent-source
if the report only stores a path:

- Decisions D1…Dn
- Problems P1…Pn
- Non-goals / SSOT paths when present

If recovery yields fewer than 2 decisions **or** fewer than 1 problem: **ABORT**
(same Intent Package gate as a fresh audit).

### 3. Recover Findings Ledger (pre-fix / last open set)

Build the list of findings still open (or all original findings if status is
unclear). Prefer the last **Residual** / open CRITICAL+HIGH rows; include any
findings marked FIXED that the operator wants re-checked.

### 4. Spawn reaudit

{{READ_TOOL}} `{{ASSETS_PATH}}/reaudit-brief-template.md`. Fill:

- `{{INTENT_PACKAGE}}` — recovered package
- `{{FINDINGS_LEDGER}}` — recovered open / claimed set
- `{{CLAIMED_FIXES}}` — operator notes or empty ("manual / unknown since last audit")

Spawn a **fresh** adversarial reaudit agent with the filled brief. Product tree
stays read-only.

### 5. Append results

{{WRITE_TOOL}} / edit: **append** to `--out`:

```markdown
## Reaudit — <ISO-date>

**Previous verdict:** …
**Verdict:** CLOSED | PARTIAL | OPEN

### Finding → status
| # | Finding | Status | Evidence | Notes |
|---|---------|--------|----------|-------|

### Residual (ordered)
1. …

### Confidence %
…
```

Statuses: `RESOLVED | PARTIAL | NO | REGRESSION` with `file:line`.

### 6. Stop

Present the new verdict + residual + report path. Do **not** auto-enter fix
mode. Operator may re-run with `--mode=audit-and-fix` if they want fix WPs.
