# Reaudit entry (`--mode=reaudit`)

Entry path when the operator re-checks a **prior** audit-delivery report after
manual fixes or an interrupted fix loop. Covers **load → recover → dual reaudit
(ledger + residual-blind) → append**.

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
findings marked FIXED that the operator wants re-checked. Keep stable finding
ids/titles for the ledger retest.

### 4. Dual reaudit (ledger + residual-blind)

After fixes (or whenever the product tree may have changed), run **both** passes.
Union residuals. **Claimed fix narratives are not evidence.**

#### Pass A — Per-finding ledger retest

{{READ_TOOL}} `{{ASSETS_PATH}}/reaudit-brief-template.md`. Fill:

- `{{INTENT_PACKAGE}}` — recovered package (criteria only)
- `{{FINDINGS_LEDGER}}` — recovered open / claimed set
- `{{CLAIMED_FIXES}}` — agent/operator claims (for **disprove** targets only — not proof)

Spawn a **fresh** adversarial reaudit agent. For **each** ledger finding:
`RESOLVED | PARTIAL | NO | REGRESSION` + `file:line`. Product tree stays read-only.

#### Pass B — Residual-blind

Second **fresh** context (or sequential leg with isolation):

- **Do not** include claimed-fix narratives, FIXED stories, or "we closed X" prose
- Spec Package / vocabulary OLD×NEW + surface inventory only
- Re-run residual protocol greps (`residual-hunt-protocol.md`) blind to fix claims
- Emit residual hits as findings; invalid residual still blocks CLOSED

#### Union + plateau

1. **Union** residual: merge Pass A open items with Pass B residual hits (dedup by
   mechanism; keep higher severity).
2. **Plateau** on open CRITICAL+HIGH: if open C+H count does not decrease vs the
   prior reaudit/audit round, **STOP** further auto fix churn — escalate to
   operator with residual list. Do not invent more rounds past
   `--max-fix-rounds` when in `audit-and-fix`.

### 5. Append results

{{WRITE_TOOL}} / edit: **append** to `--out`:

```markdown
## Reaudit — <ISO-date>

**Previous verdict:** …
**Verdict:** CLOSED | PARTIAL | OPEN
**Open CRITICAL+HIGH (this round):** N (plateau: yes|no)

### Pass A — Ledger retest
| # | Finding | Status | Evidence | Notes |
|---|---------|--------|----------|-------|

### Pass B — Residual-blind
| # | Hit | Sev | Class | Evidence |
|---|-----|-----|-------|----------|

### Union residual (ordered)
1. …

### Confidence %
…
```

Statuses: `RESOLVED | PARTIAL | NO | REGRESSION` with `file:line`.

### 6. Stop

Present the new verdict + residual + report path + plateau flag. Do **not**
auto-enter fix mode. Operator may compose fix WPs then re-run reaudit, or use
`--mode=audit-and-fix` if they want the in-skill loop (still bound by plateau).
