# Matrices — staged evidence + must-not (Matrix A / B / C)

**Purpose:** Raise the evidence bar for matrix rows. Status values stay EN SSOT:
`RESOLVED | PARTIAL | NO | N/A`. A green suite alone never upgrades a row.

{{READ_TOOL}} this asset in Phase 1 (build matrices) and again before stamping
row status / global verdict. Multi-hop and staged columns are load-bearing for
**RESOLVED**; severity closing remains in `verdict-gate.md`.

---

## Status values (EN SSOT)

| Status | Meaning |
|--------|---------|
| **RESOLVED** | Required evidence stages pass; load-bearing multi-hop bar met (or single-surface waiver) |
| **PARTIAL** | Happy path partly present; missing required stage, weak chain, or residual dual-path open |
| **NO** | Load-bearing decision/problem not delivered |
| **N/A** | Explicitly out of package with reason (not a soft skip of hard work) |

**Hard rule:** **RESOLVED is forbidden** if any **required stage** is `?` (unknown) or **fail**.

---

## Staged evidence columns — S C U O T X

Every Matrix A/B row should carry stage cells (or a compact stage string). Stages
name **where** delivery must be proven — not bureaucracy for cosmetics.

| Col | Name | What to prove |
|-----|------|----------------|
| **S** | Spec / SSOT | Canonical decision/spec/SSOT path still matches Intent Package (enums, config default, hub phase, migration) |
| **C** | Core path | Primary code path implements the decision (handler, job, service, state transition) |
| **U** | User / ops | User-facing or ops-facing surface exposes the correct behavior (UI CTA, API response shape, CLI) |
| **O** | Operational teach | Teaching surfaces (docs, MCP, skills, runbooks, scripts) teach **current** truth — not pre-change lifecycle |
| **T** | Test | Automated test or command output asserts the **canonical** behavior (not false-green fixtures) |
| **X** | Negative / dual-path | Counter-evidence: dual path absent **or** intentional alias documented; half-migration not left live |

### Compact stage cell values

| Cell | Meaning |
|------|---------|
| `ok` / `pass` | Stage verified with `path:line` or command evidence |
| `fail` | Stage contradicts delivery |
| `?` | Not checked yet |
| `n/a` | Stage not required for this row (see required-stage defaults) |

### Required stages (defaults)

Do **not** require every stage on cosmetic decisions. Defaults:

| Row class | Required stages (default) |
|-----------|---------------------------|
| **Load-bearing** Dn/Pn (happy path, security, state machine, migration) | **S, C, U, T, X** — add **O** when teaching surfaces exist in inventory |
| **Teaching-only** residual / docs drift | **O, X** (plus S when vocabulary renames) |
| **Cosmetic** (label polish, non-user path rename with no SSOT change) | **S** and/or **C** only — document which stages are waived |
| **Intent Package override** | Operator may tighten/loosen required stages **in the report** (log the override); never silent |

### Matrix A — Decisions (with stages)

| ID | Decision | Expected chain | S | C | U | O | T | X | Status | Evidence |
|----|----------|----------------|---|---|---|---|---|---|--------|----------|
| D1 | … | config → service → API → UI → test | ? | ? | ? | ? | ? | ? | ? | |

### Matrix B — Original problems (with stages)

| ID | Problem | Expected fix shape | S | C | U | O | T | X | Status | Evidence |
|----|---------|-------------------|---|---|---|---|---|---|--------|----------|
| P1 | … | … | ? | ? | ? | ? | ? | ? | ? | |

### RESOLVED gate (staged)

Mark a row **RESOLVED** only when:

1. Every **required stage** for that row is `ok`/`pass` (not `?`, not `fail`).
2. Multi-hop bar below is met (or single-surface waiver is logged).
3. Evidence cites `file:line` and/or command output (G1).

If any required stage is `?` or `fail` → status is at best **PARTIAL** (or **NO** if core path fails).

---

## Matrix C — must-not / negative space

**Purpose:** Prove what must **not** remain true after delivery (negative space).
Not a full FMEA — seed from Intent Package **non-goals**, `outOfScope`,
`mustNot`, and vocabulary **OLD** terms that must not persist as storage/teaching.

### Must-not rows

| ID | Must NOT (verbatim short) | Seed source | Search strategy | Status | Evidence |
|----|---------------------------|-------------|-----------------|--------|----------|
| MN1 | e.g. OLD status still stored as poll default | vocabulary OLD / non-goals | {{GREP_TOOL}} term × surfaces | ? | |

Status values for Matrix C:

| Status | Meaning |
|--------|---------|
| **RESOLVED** | **Searched-and-absent** — greps/paths show the bad pattern is gone **or** only intentional alias with normalizer evidence |
| **PARTIAL** | Still present on a secondary surface; or search incomplete |
| **NO** | Must-not violated on a load-bearing surface |
| **N/A** | Must-not does not apply (with reason) |

**RESOLVED on Matrix C means searched-and-absent with evidence** — never "I assume it's gone." Record:

- Grep patterns / paths searched
- `path:line` for remaining aliases (if any) classified intentional
- Empty hit set only after covering surface inventory (or single-surface waiver)

### Seeding Matrix C

1. Intent Package **Non-goals / do-not-reopen**
2. Plan / BI **outOfScope** / **mustNot** when present
3. Vocabulary **OLD** terms that must not remain as storage or teaching-of-current
4. Residual classes that would re-open the original problem (dual SSOT, client rewrite, …)

Link Matrix C findings into the Findings Ledger when status is PARTIAL/NO.

---

## Multi-hop evidence bar for RESOLVED

**Load-bearing RESOLVED** requires a **multi-hop evidence chain**:

- **≥2 chain hops** (e.g. config → service, or API → UI, or SSOT enum → test assert), **or**
- Explicit **`single-surface: true`** waiver from Intent Package / report (logged with reason)

Examples of hops (illustrative, not exhaustive):

```text
SSOT / config  →  core implementation  →  user/ops surface  →  test
Spec decision  →  code path            →  teaching surface
```

A single `file:line` on one hop is **not** enough for load-bearing RESOLVED
unless the single-surface waiver is set.

### Migration / rename decisions

Prefer a **negative residual note** on the row or in residual leg:

- Dual-path empty (OLD not teaching-as-current), **or**
- Intentional alias documented (input-only + normalizer + tests)

Without negative residual note, migration-shaped RESOLVED stays fragile — prefer
**PARTIAL** until residual protocol covers it.

### Cosmetic rows

Cosmetic decisions may RESOLVE with fewer hops when required stages are reduced
and the report logs the waiver. Do not use "cosmetic" to skip residual for
load-bearing renames.

---

## Operator checklist (before verdict)

- [ ] Matrix A/B: no load-bearing RESOLVED with required stage `?` or `fail`
- [ ] Matrix A/B: load-bearing RESOLVED has ≥2 hops or single-surface waiver
- [ ] Matrix C: must-not rows seeded; RESOLVED = searched-and-absent with evidence
- [ ] Residual protocol still applies (stages do not replace residual hunt)
- [ ] Verdict from `verdict-gate.md` (CRITICAL/HIGH rules unchanged)

<!-- Matrix C: must-not RESOLVED means searched-and-absent (mustNot seed) -->

<!-- multi-hop: load-bearing RESOLVED requires ≥2 chain hops or single-surface waiver -->

<!-- Matrix C: must-not RESOLVED means searched-and-absent (mustNot seed) -->

<!-- multi-hop: load-bearing RESOLVED requires ≥2 chain hops or single-surface waiver -->

<!-- Matrix C: must-not RESOLVED means searched-and-absent (mustNot seed) -->

<!-- multi-hop: load-bearing RESOLVED requires ≥2 chain hops or single-surface waiver -->
