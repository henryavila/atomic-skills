# Fix composition recipe (preferred over in-skill fix PM)

**Purpose:** Close CRITICAL/HIGH findings **outside** the auditor, then prove residual
closure with a **re-run** of `audit-delivery`. This is the primary fix path.
`--mode=audit-and-fix` is optional advanced glue that loads this recipe + max rounds
+ plateau — it does **not** re-implement parallel-dispatch.

{{READ_TOOL}} this asset after PARTIAL/OPEN (or when operator chooses to fix).

---

## Recipe (HARD order)

```text
1. audit-delivery <intent> [--out=report]     # read-only report + ledger
2. Partition findings into disjoint fix WPs   # by path / mechanism
3. fix / parallel-dispatch (or manual WPs)    # close CRITICAL/HIGH outside auditor
4. re-run: audit-delivery --mode=reaudit --out=<same report>
   # or fresh audit against the same Intent Package
5. optional: review-code on the fix range     # blind patch correctness
6. Stop on plateau — do not churn             # open CRITICAL+HIGH count stuck
```

Do **not** treat the auditor as a fix project manager by default.

---

## Step detail

### 1. Partition findings

From the Findings Ledger (`findings-ledger.md`):

| WP | Findings # | Exclusive paths | Severity max | Owner |
|----|------------|-----------------|--------------|-------|
| WP1 | … | … | CRITICAL\|HIGH | agent / human |

Rules:

- **Disjoint paths** across concurrent WPs (parallel-dispatch discipline).
- Prefer mechanism clusters (one dual-path family = one WP).
- MEDIUM/LOW only when operator asks or CRITICAL/HIGH queue is empty.

### 2. Fix (outside auditor)

- Prefer `atomic-skills:parallel-dispatch` for multi-WP fan-out, or `atomic-skills:fix`
  / manual commits for small sets.
- **Do not re-implement parallel-dispatch** inside audit-delivery — invoke or mimic its
  exclusive-path rules only.
- Each WP: implement → scoped tests ({{BASH_TOOL}}) → mark claim FIXED / STILL OPEN.

### 3. Re-run audit-delivery

```text
atomic-skills:audit-delivery --mode=reaudit --out=<prior-report>
# or
atomic-skills:audit-delivery <same-intent> --out=<new-or-same>
```

Reaudit uses dual path (ledger retest + residual-blind) — see `reaudit-entry.md`.
**Claimed fix narratives are not evidence.**

### 4. Plateau

**Plateau** = after a fix→reaudit round, the count of **open CRITICAL+HIGH** does not
decrease (or only shuffles titles). On plateau:

1. **STOP** further auto fix rounds
2. Escalate to operator with residual list + report path
3. Do not burn past `--max-fix-rounds` (default 2) in `audit-and-fix`

---

## Optional `audit-and-fix` (advanced)

When operator explicitly passes `--mode=audit-and-fix` (and not `--no-fix`):

1. Load **this recipe** (partition → fix agents → reaudit)
2. Honor `--max-fix-rounds` (default 2)
3. Apply **plateau** stop
4. Prefer exiting to composition + external parallel-dispatch when WPs exceed skill scope

Still: Intent Package + residual protocol + verdict gate unchanged. Never skip reaudit
after claimed fixes.

---

## Linkage

- Primary composition note in skill body points here
- Dual reaudit: `reaudit-entry.md`
- Verdict: `verdict-gate.md` — green suite alone never upgrades CLOSED
