# Severity labels (EN SSOT)

Use these four levels on Findings Ledger rows and residual hits.

| Sev | Meaning |
|-----|---------|
| **CRITICAL** | User/ops hits wrong path in normal use; approve/reprocess stuck; data limbo; security |
| **HIGH** | Half-migrated surface that will mislead agents/ops or break a secondary path |
| **MEDIUM** | Docs/comments drift, weak tests, asymmetric counts without data loss |
| **LOW** | Naming hygiene, dead exports, optional refactors |

## Closing interaction

- **CRITICAL** never Accept-Recorded to **CLOSED** (`verdict-gate.md`).
- **HIGH** needs Accept Record for CLOSED eligibility when still open.
- Green suite alone never upgrades severity or verdict.
