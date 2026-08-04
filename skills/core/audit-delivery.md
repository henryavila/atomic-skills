Audit whether **product intent was actually delivered end-to-end** — not whether a git diff looks correct.

## Step 0 — Parse {{ARG_VAR}} first (HARD)

**Parse {{ARG_VAR}} into mode / axes / out / depth / flags BEFORE any Intent Package file read or report write.**

Accepted shape (must match catalog args):
`[intent-source] [--mode=audit|audit-and-fix|reaudit] [--axes=…] [--max-fix-rounds=N] [--no-fix] [--out=path]`

| Token | Default | Meaning |
|-------|---------|---------|
| **intent-source** | (empty → ask once) | Path to handoff / plan / design / acceptance doc, OR freeform decision list |
| **`--mode`** | `audit` | `audit` (read-only findings), `audit-and-fix` (orchestrate fixes + reaudit), `reaudit` (re-check existing findings file) |
| **`--axes`** | `backend,frontend,product,residual` | Comma list of audit legs; drop unused legs |
| **`--max-fix-rounds`** | `2` | Max fix→reaudit loops in `audit-and-fix` |
| **`--no-fix`** | off | Force read-only even if mode says fix |
| **`--out`** | `.atomic-skills/reviews/audit-delivery-<slug>-<YYYYMMDD>.md` | Report path |

Record parsed values in-session. Do **not** open intent sources, spawn auditors, or {{WRITE_TOOL}} the report until this parse completes. Unknown flags → warn and ignore (or abort if ambiguous with intent-source).

This skill is the **intent-vs-delivered** counterpart to `review-code` (blind diff) and the **system-level** counterpart to `verify-claim` (single binary verifier).

## Assets (lazy — read on demand from `{{ASSETS_PATH}}/`)

- {{READ_TOOL}} `{{ASSETS_PATH}}/axis-brief-template.md` — per-leg adversarial audit brief (Phase 2 spawn)
- {{READ_TOOL}} `{{ASSETS_PATH}}/reaudit-brief-template.md` — fresh-context reaudit brief (Phase 5 / reaudit re-run)

## Iron Law

NO DELIVERY CLAIM WITHOUT INTENT MATRIX + RESIDUAL HUNT + REAUDIT.
- Every decision / original problem must land in a matrix row with status `RESOLVED | PARTIAL | NO | N/A` and `file:line` evidence.
- A green diff, green suite, or "looks shipped" narrative is **not** a closed audit.
- Closing requires either **CLOSED** (zero CRITICAL residual) or an explicit residual list the operator accepts — never silent partial.

## Mindset

You are proving **what was promised is present in the running system** (code + ops surfaces that teach the truth), not blessing the author's story.

- **Intent is load-bearing here** (opposite of `review-code`). Without decisions, problems, and acceptance criteria, abort.
- Prefer **counter-evidence**: half-migrated paths, legacy vocabulary still taught as current, band-aids that mask backend bugs, recovery that never heals, docs/MCP/skills that lie.
- Orchestrate; do not solo-read a monorepo when fan-out is possible.
- Be adversarial: if Pass 1 found nothing on a large rewrite, Pass residual is mandatory.

## Don't use when

| Situation | Use instead |
|-----------|-------------|
| Review a **diff** for logic bugs without product criteria | `atomic-skills:review-code` |
| One claim + one deterministic command ("tests pass") | `atomic-skills:verify-claim` |
| Plan premises vs code before implement | `atomic-skills:review-plan --mode=ground-truth` |
| Write adversarial tests for one class | `atomic-skills:hunt` |
| No decisions / handoff / problems list exists yet | `atomic-skills:brainstorm` or write the handoff first |

## Relationship to sibling skills

```text
review-code          →  is the PATCH correct?     (intent FORBIDDEN)
audit-delivery       →  is INTENT delivered?      (intent REQUIRED)
verify-claim         →  does THIS verifier pass?  (binary)
review-plan ground-truth → does the PLAN match the tree?
```

Never collapse audit-delivery into a sealed anti-intent briefing. That is the failure mode that made `review-code` look "inferior" for delivery audits.

---

## Phase 0 — Resolve intent source (HARD-GATE)

<HARD-GATE>
Do not open audit agents until you have a written **Intent Package**:

1. **Decisions** (closed product/engineering choices) — numbered D1…Dn
2. **Original problems** the change claimed to solve — P1…Pn
3. **Acceptance / happy paths** (when present)
4. **Non-goals / "do not reopen"** (when present)
5. **Key SSOT paths** (status enums, hub phases, config defaults, migrations)

Sources (try in order; cite paths you used):
- Explicit path in {{ARG_VAR}}
- `docs/plans/HANDOFF-*.md`, plan markdown, design.md, PRD acceptance section
- User-pasted decision table in the current message

If after asking once you still lack ≥2 decisions **or** ≥1 original problem: **ABORT**.
Redirect: "audit-delivery needs an Intent Package. Write a short handoff (decisions + problems) or point at the plan section, then re-run."
</HARD-GATE>

Present the Intent Package to the operator in compact form and proceed (no long re-approval unless they object).

## Phase 1 — Build matrices (operator, same session)

From the Intent Package, write two matrices (draft into the report file early via {{WRITE_TOOL}}):

### Matrix A — Decisions

| ID | Decision (verbatim short) | Expected evidence chain | Status | Evidence |
|----|---------------------------|-------------------------|--------|----------|
| D1 | … | config → job/service → API → UI → test | ? | |

### Matrix B — Original problems

| ID | Problem | Expected fix shape | Status | Evidence |
|----|---------|-------------------|--------|----------|
| P1 | … | … | ? | |

Status values only: `RESOLVED` | `PARTIAL` | `NO` | `N/A`.

**Evidence bar (G1):** status ≠ empty speculation. Prefer `path:line` from current tree. Agent reports without cites are claims, not evidence — re-read yourself or reject the row as unverified.

## Phase 2 — Fan-out audit agents (parallel)

Spawn **read-only** agents via {{INVESTIGATOR_TOOL}} (explore / read-only capability). One agent per selected axis. Do **not** share findings between parallel legs (prevents anchoring).

**Before each leg spawn:** {{READ_TOOL}} `{{ASSETS_PATH}}/axis-brief-template.md`. Fill `{{AXIS}}`, `{{INTENT_PACKAGE}}`, `{{AXIS_MISSION}}`, and `{{AXIS_CHECKLIST}}` for that leg only. Paste the filled brief as the agent prompt body.

Default axes and focus:

| Axis | Mission |
|------|---------|
| **backend** | SSOT, transitions, jobs, recovery, API force/CAS paths, tests assert **canonical** statuses |
| **frontend** | Work surface / CTAs, phase priority, client band-aids that rewrite server truth, e2e mocks |
| **product** | Trace each Dn/Pn config→code→UI→test; counter-evidence hunt |
| **residual** | Monorepo half-migration: MCP, skills, ops docs, scripts, legacy string greps, dead dual paths |

Customize axes when the domain is not a note pipeline — e.g. `api,worker,admin,docs` — but keep **≥1 residual monorepo leg** unless the operator explicitly opts out with `--axes` excluding residual (log that choice).

### Agent prompt rules (each leg)

1. Paste the **Intent Package** (decisions + problems) — intent is required.
2. Paste **only that axis checklist** + key file hints if known.
3. Demand output: checklist table + gaps prioritized CRITICAL/HIGH/MEDIUM/LOW + confidence % + "not verified".
4. Forbid: applying fixes, rewriting docs as the product, inventing decisions not in the package.
5. Adversarial stance: search for incomplete fixes and dual paths, not happy-path confirmation.

### Operator merge (after all legs return)

Merge into one **Findings Ledger**:

| # | Title | Sev | Axis | Evidence | Impact | Suggested fix (one-liner) |
|---|-------|-----|------|----------|--------|---------------------------|

Dedup by mechanism (same root cause → one finding). Prefer higher severity.

**Pass residual is mandatory** if any decision is PARTIAL/NO or any CRITICAL/HIGH exists — even if product leg said "mostly done".

## Phase 3 — Verdict gate

Compute global verdict:

| Verdict | Rule |
|---------|------|
| **CLOSED** | All Dn/Pn are RESOLVED or N/A; zero CRITICAL residual; HIGH residual empty **or** operator-accepted in writing |
| **PARTIAL** | Core happy path RESOLVED but residual CRITICAL/HIGH remain OR any Dn/Pn PARTIAL |
| **OPEN** | Any Dn/Pn NO on a load-bearing decision, or audit could not verify key chains |

Never upgrade PARTIAL → CLOSED because tests are green. Tests are one evidence source, not the gate.

Persist the report with {{WRITE_TOOL}} to `--out` (or default path). Structure:

```markdown
# Audit Delivery — <slug>
**Date:** …
**Mode:** audit | audit-and-fix | reaudit
**Intent sources:** …
**Verdict:** CLOSED | PARTIAL | OPEN

## Intent Package
…

## Matrix A — Decisions
…

## Matrix B — Problems
…

## Findings Ledger
…

## Residual (ordered)
…

## Tests / commands observed (if any)
…

## Confidence %
```

If `--mode=audit` or `--no-fix`: **STOP here**. Present summary + report path. Do not fix.

## Phase 4 — Fix orchestration (`audit-and-fix` only)

<HARD-GATE>
Only enter Phase 4 when:
- mode is `audit-and-fix`, and
- `--no-fix` is absent, and
- Findings Ledger has ≥1 CRITICAL or HIGH (or operator explicitly asks to fix MEDIUM too).

If verdict is already CLOSED: do not invent fix work.
</HARD-GATE>

### 4.1 Partition work packages

Group findings into **disjoint file scopes** (same discipline as `parallel-dispatch`):

- Prove path sets do not intersect ({{GREP_TOOL}} / path lists).
- Hard dependency → serial WP, not parallel.
- Cap parallel fix agents (default ≤4). Prefer backend / frontend / docs-mcp splits.

### 4.2 Spawn fix agents

Each fix agent gets:

- Only its findings + exclusive path allowlist
- Canonical vocabulary / SSOT paths from Intent Package
- "Implement fully; run scoped tests; return summary + residual in scope"
- Forbidden: touch paths outside allowlist

Operator remains orchestrator: no product edits in the parent session while fix agents run (reduces merge thrash). Exception: tiny comment-only if agents cannot.

### 4.3 Verify claims of fix agents

For each agent "done" report:

1. Read the **diff** (not the narrative) for its paths.
2. Run **scoped tests** they claim ({{BASH_TOOL}}) when cheap.
3. Mark each finding: FIXED / STILL OPEN / REGRESSED.

Treat agent confidence as zero without diff + command output (`verify-claim` spirit).

## Phase 5 — Reaudit (mandatory after any fix round)

Spawn a **fresh** adversarial reaudit agent (clean context preferred):

1. {{READ_TOOL}} `{{ASSETS_PATH}}/reaudit-brief-template.md`.
2. Fill `{{INTENT_PACKAGE}}`, `{{FINDINGS_LEDGER}}` (pre-fix), and `{{CLAIMED_FIXES}}`.
3. Use the filled brief as the reaudit agent prompt.

- Task: for **each** original finding, RESOLVED / PARTIAL / NO / REGRESSION with `file:line`
- Grep red-flag patterns from residual leg again
- Output: final verdict + remaining residual only (structure from the template)

Operator re-reads any CRITICAL still claimed fixed (G1).

If residual CRITICAL/HIGH remain and fix rounds &lt; `--max-fix-rounds`: return to Phase 4.
If plateau (count did not decrease): **STOP**, escalate to operator with residual list — do not churn.

## Phase 6 — Closing

Present the closing summary:

```markdown
### Audit Delivery — Summary

**Intent source:** …
**Mode:** …
**Verdict:** CLOSED | PARTIAL | OPEN
**Decisions:** R/P/N/A counts
**Problems:** R/P/N/A counts
**Findings:** C/H/M/L counts (open after last reaudit)
**Fix rounds:** N
**Report:** `.atomic-skills/reviews/…`

| # | Residual | Sev | Next action |
|---|----------|-----|-------------|
| 1 | … | … | … |

**Suggestion:** run `atomic-skills:review-code` on the fix diff for blind correctness;
run full suite / smoke before release.
```

Optional: offer commit of report + fixes (do not push unless asked).

---

## Residual hunt — default red-flag greps

Always run a residual leg (or parent greps) for patterns adapted to the Intent Package. Examples (replace with domain terms):

- Legacy status/enum strings still used as **storage or poll defaults** (not mere input aliases)
- Client helpers that **rewrite** server status from side channels
- Recovery/reclaim that **skips** the new terminal/residual states
- Force/reprocess paths that only accept **old** failure labels
- Ops docs / MCP / agent skills teaching **pre-change** lifecycle as current truth
- Tests that seed obsolete fixtures while asserting new names (false green)
- Config defaults vs `.env.example` / checklists that contradict product decisions

Record matches as findings even if "out of the feature PR".

## Severity

- **CRITICAL** — user/ops hits wrong path in normal use; approve/reprocess stuck; data limbo; security
- **HIGH** — half-migrated surface that will mislead agents/ops or break a secondary path
- **MEDIUM** — docs/comments drift, weak tests, asymmetric counts without data loss
- **LOW** — naming hygiene, dead exports, optional refactors

## Code-quality gates

Bound by `docs/kb/code-quality-gates.md`: **G1** (read-before-claim), **G2** (no soft language in verdict), **G6** (reference-or-strike). Fix agents additionally honor G3/G4/G7 when writing tests.

## Self-review against gates

Before declaring the audit complete, append:

```
- G1 read-before-claim: every RESOLVED/PARTIAL/NO cites file:line or command output
- G2 soft-language: verdict is CLOSED|PARTIAL|OPEN only — no "looks good"/"should be fine"
- G6 reference-or-strike: agent summaries without cites were re-read or struck
```

## Red Flags

- "The suite is green, so delivery is closed"
- "I'll skip residual because the product axis said mostly yes"
- "review-code already ran, this is redundant"
- "I'll seal intent out of the auditor briefing so it is unbiased" (wrong skill — use review-code for that)
- "I'll fix in the parent while agents run on the same files"
- "PARTIAL is good enough for CLOSED if the handoff said shipped"
- "Docs/MCP don't count — only backend"
- "The fix agent said done, no need to reaudit"
- "One more fix round after plateau — it'll converge"
- "I can invent decisions the handoff never made"

If you thought any of the above: STOP. Return to the phase you were skipping.

## Rationalization

| Temptation | Reality |
|------------|---------|
| "Diff review is enough" | Diff review forbids intent; half-migrated systems live outside the patch |
| "Tests prove delivery" | Tests prove exercised paths; residual surfaces and false-green fixtures remain |
| "Intent biases the auditor" | Here intent **is** the spec; without it you audit a different product |
| "Residual docs are noise" | Ops/MCP/skills **are** runtime for agents and humans — lying docs are HIGH |
| "Reaudit is wasteful after fixes" | First reaudit of the SM work re-opened CRITICAL heal-on-approve — skip reaudit ships limbo |
| "CLOSED with known CRITICAL if we track it" | Tracked CRITICAL = PARTIAL; CLOSED means zero CRITICAL residual |
| "I'll merge all axes into one agent" | Parallel specialized legs catch disjoint gaps; one soup agent dilutes residual hunt |

## Pressure-test record (authoring)

Dogfood scenario that motivated this skill (2026-08-01, Lekto note pipeline SM):

1. **Time + authority + plausibility:** "SM shipped, suite green, just review-code it" → would miss MCP legacy poll, `rejected` force gap, client `applyDraftsReady`, reclaim skip-with-drafts.
2. **Sunk cost + fatigue + green suite:** after large SM commit, skip residual monorepo hunt → delivery claim false.
3. **Reaudit skip after fixes:** first fix round left on-demand heal missing → CRITICAL residual; second reaudit required for CLOSED.

Counters encoded above: Iron Law, mandatory residual axis, Phase 5 reaudit, verdict table, Red Flags / Rationalization rows.

---

## Closing note

`audit-delivery` does **not** replace `review-code`. After `audit-and-fix`, recommend a **blind** `review-code` on the fix range so intent-driven fixes still get anti-intent correctness review.
