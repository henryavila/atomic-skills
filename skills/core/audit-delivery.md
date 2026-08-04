Audit whether **product intent was actually delivered end-to-end** — not whether a git diff looks correct.

## Step 0 — Parse {{ARG_VAR}} first (HARD)

**Parse {{ARG_VAR}} into mode / axes / out / depth / flags BEFORE any Intent Package file read or report write.**

Accepted shape (must match catalog args):
`[intent-source] [--mode=audit|audit-and-fix|reaudit] [--axes=…] [--depth=light|full] [--max-fix-rounds=N] [--no-fix] [--cross=off|residual|critic|reaudit] [--out=path]`

| Token | Default | Meaning |
|-------|---------|---------|
| **intent-source** | (empty → ask once) | Path to handoff / plan / design / acceptance doc, OR freeform decision list |
| **`--mode`** | `audit` | `audit` (**default, read-only**), `reaudit`, `audit-and-fix` (optional advanced fix loop) |
| **`--axes`** | `product,residual` | Comma list; `backend`/`frontend`/`prosecution` (NO-only) remain opt-ins |
| **`--depth`** | `full` | `full`: product+residual agents. `light`: matrix + residual protocol (parent greps OK) — still forbids CLOSED on CRITICAL / residual opt-out / load-bearing NO |
| **`--max-fix-rounds`** | `2` | Max fix→reaudit loops in `audit-and-fix` |
| **`--no-fix`** | off | Force read-only even if mode says fix |
| **`--cross`** | `off` | Optional cross-model: `off` \| `residual` \| `critic` \| `reaudit` (default **off**) |
| **`--out`** | `.atomic-skills/reviews/audit-delivery-<slug>-<YYYYMMDD>.md` | Report path |

Record parsed values in-session. Do **not** open intent sources, spawn auditors, or {{WRITE_TOOL}} the report until parse completes.

This skill is the **intent-vs-delivered** counterpart to `review-code` (blind diff) and the **system-level** counterpart to `verify-claim` (single binary verifier).

## Assets (lazy — read on demand from `{{ASSETS_PATH}}/`)

- {{READ_TOOL}} `{{ASSETS_PATH}}/intent-package.md` — Intent Package template + HARD-GATE admission (Phase 0)
- {{READ_TOOL}} `{{ASSETS_PATH}}/spec-package.md` — Spec Package strip (anti-success-framing; axis brief criteria only)
- {{READ_TOOL}} `{{ASSETS_PATH}}/matrices.md` — staged evidence S/C/U/O/T/X, Matrix C must-not, multi-hop RESOLVED bar
- {{READ_TOOL}} `{{ASSETS_PATH}}/residual-hunt-protocol.md` — domain-agnostic residual protocol (OLD_TERMS × surfaces)
- {{READ_TOOL}} `{{ASSETS_PATH}}/verdict-gate.md` — CLOSED/PARTIAL/OPEN rules + Accept Record schema (Phase 3)
- {{READ_TOOL}} `{{ASSETS_PATH}}/axis-brief-template.md` — per-leg adversarial audit brief (Phase 2; Spec Package only)
- {{READ_TOOL}} `{{ASSETS_PATH}}/reaudit-brief-template.md` — fresh-context reaudit brief (Phase 5 / reaudit re-run)
- {{READ_TOOL}} `{{ASSETS_PATH}}/reaudit-entry.md` — entry path when `--mode=reaudit`
- {{READ_TOOL}} `{{ASSETS_PATH}}/report-template.md` — report SSOT including Accept Register + vocabulary + surfaces
- {{READ_TOOL}} `{{ASSETS_PATH}}/findings-ledger.md` — merge/dedup ledger rules
- {{READ_TOOL}} `{{ASSETS_PATH}}/severity.md` — CRITICAL/HIGH/MEDIUM/LOW labels
- {{READ_TOOL}} `{{ASSETS_PATH}}/closing-summary.md` — operator closing block
- {{READ_TOOL}} `{{ASSETS_PATH}}/checklists/product.md` — product axis checklist (into `{{AXIS_CHECKLIST}}`)
- {{READ_TOOL}} `{{ASSETS_PATH}}/checklists/residual.md` — residual axis checklist
- {{READ_TOOL}} `{{ASSETS_PATH}}/checklists/prosecution.md` — optional prosecution axis (NO-only; cannot emit RESOLVED)
- {{READ_TOOL}} `{{ASSETS_PATH}}/critic-merge.md` — full-depth Gap List → product downgrade-only → fresh critic
- {{READ_TOOL}} `{{ASSETS_PATH}}/fix-composition-recipe.md` — partition → fix/parallel-dispatch → re-run + plateau

## Mode table

| Mode | Product tree | Report | Entry |
|------|--------------|--------|-------|
| **`audit`** (default) | **Read-only** | Write/overwrite at `--out` | Step 0 → Phase 0…3 → **stop** |
| **`reaudit`** | **Read-only** | **Append-only** on existing report | **Requires `--out`**. {{READ_TOOL}} `{{ASSETS_PATH}}/reaudit-entry.md` |
| **`audit-and-fix`** (optional) | Writable in Phase 4 only | Write + reaudit | Prefer **composition** below |

## Primary composition (preferred over audit-and-fix)

`audit-and-fix` is a **recipe/composition option**, not the primary identity. Default path is **read-only audit**. Full recipe: {{READ_TOOL}} `{{ASSETS_PATH}}/fix-composition-recipe.md`.

```text
1. atomic-skills:audit-delivery <intent>          # read-only report + ledger
2. fix / parallel-dispatch (or manual WPs)        # close CRITICAL/HIGH outside auditor
3. re-run: audit-delivery --mode=reaudit --out=…  # dual ledger + residual-blind
4. optional: review-code on the fix range         # blind patch correctness
```

After PARTIAL/OPEN, **do not** treat the auditor as a fix PM by default. Keep `--mode=audit-and-fix` only when the operator explicitly wants the in-skill fix→reaudit loop (loads the recipe + max rounds + plateau).

## Iron Law

NO DELIVERY CLAIM WITHOUT INTENT MATRIX + RESIDUAL HUNT + REAUDIT.
- Every decision / original problem must land in a matrix row with status `RESOLVED | PARTIAL | NO | N/A` and `file:line` evidence.
- A green diff, green suite, or "looks shipped" narrative is **not** a closed audit.
- Closing requires **CLOSED** (zero CRITICAL residual) or an explicit residual list the operator accepts — never silent partial.

## Mindset

Prove **what was promised is present in the running system** (code + ops surfaces that teach the truth). Intent is load-bearing (opposite of `review-code`). Prefer counter-evidence: half-migrated paths, legacy vocabulary taught as current, band-aids, recovery that never heals, lying docs/MCP/skills. Orchestrate; be adversarial.

## Don't use when

| Situation | Use instead |
|-----------|-------------|
| Review a **diff** without product criteria | `atomic-skills:review-code` |
| One claim + one deterministic command | `atomic-skills:verify-claim` |
| Plan premises vs code before implement | `atomic-skills:review-plan --mode=ground-truth` |
| Plan-end lifecycle inventory only (`intentVsDelivered`) | Plan-end under automate finalize — **not** a substitute on phase close |
| Parallel-dispatch WP / fan-out hygiene | `atomic-skills:parallel-dispatch-audit` |
| No decisions / handoff yet | `atomic-skills:brainstorm` or write the handoff first |

**Phase close is hard:** every `phase-done` (Mode-1 + pure-maestro) **requires** a real `audit-delivery` run and durable `deliveryAuditGate` — never tip-only, never skippable. Plan-end `intentVsDelivered` is **not** a substitute.

```text
review-code → PATCH correct? (intent FORBIDDEN)
audit-delivery → INTENT delivered? (intent REQUIRED) — hard on phase-done
verify-claim → THIS verifier pass? (binary)
```

Never collapse audit-delivery into a sealed anti-intent briefing.

---

## Phase 0 — Resolve intent source (HARD-GATE)

**If `--mode=reaudit`:** {{READ_TOOL}} `{{ASSETS_PATH}}/reaudit-entry.md` (load `--out`, recover package + ledger, append). HARD-GATE below only if package recovery fails.

{{READ_TOOL}} `{{ASSETS_PATH}}/intent-package.md` and fill the micro skeleton. When the source carries **businessIntent** (value/workflow/rules/outOfScope/doneWhen), draft from that block then operator-ratify (see asset).

<HARD-GATE>
Do not open audit agents until a written **Intent Package** passes admission:

1. **Spine** — Decisions D1…Dn (≥2) **or** Original problems P1…Pn (≥1) (both preferred)
2. **Acceptance / doneWhen** — ≥1 checkable criterion
3. **Vocabulary delta** — non-empty OLD→NEW when migration/rename-shaped; else `vocabulary: none (additive)` with reason
4. **Surface inventory** — ≥3 surfaces **or** `single-surface: true` logged in the report
5. **Non-goals** (when present) and **Key SSOT paths**

Sources: {{ARG_VAR}} path → `docs/plans/HANDOFF-*.md` / plan / design / PRD → **businessIntent** import → user-pasted table.

**Abort** (after asking once) when admission fails. Do not soft-proceed with a partial package.
</HARD-GATE>

Present the Intent Package compactly and proceed unless the operator objects.

## Phase 1 — Build matrices

{{READ_TOOL}} `{{ASSETS_PATH}}/matrices.md` for stages **S C U O T X**, **Matrix C must-not**, and the **multi-hop** RESOLVED bar. Draft matrices into the report via {{WRITE_TOOL}} (skeleton in `report-template.md`).

Status values only: `RESOLVED | PARTIAL | NO | N/A`. **RESOLVED is forbidden** if any **required stage** is `?` or fail. Load-bearing RESOLVED needs **≥2 chain hops** or single-surface waiver. Agent reports without cites are claims — re-read or reject (G1).

## Depth (`--depth=full` default | `--depth=light`)

| Depth | Behavior | CLOSED still blocked when |
|-------|----------|---------------------------|
| **`full`** (default) | Fan-out product + residual agents | CRITICAL residual; residual opt-out/invalid; load-bearing **NO**; staged/multi-hop bar fails |
| **`light`** | Matrix A/B/C + residual protocol via **parent greps** OK | Same hard blocks — light **never** softens the verdict gate |

## Phase 2 — Fan-out audit agents

**When `--depth=full`:** spawn **read-only** agents via {{INVESTIGATOR_TOOL}}. One agent per selected axis. Do **not** share findings between parallel legs.

**Fallback:** if {{INVESTIGATOR_TOOL}} is unavailable (IDE cannot spawn agents), run axes **sequential inline** in the current context. Log an explicit degradation warning: "Audit-delivery axes running inline in shared context — isolation degraded." Still load Spec Package + that axis checklist; still forbid cross-axis anchoring by finishing one axis ledger section before starting the next. Residual parent greps from `residual-hunt-protocol.md` remain valid under this fallback and under `--depth=light`.

**When `--depth=light`:** residual protocol greps may run in-parent — still fill matrices + ledger.

**Before each leg:** {{READ_TOOL}} `{{ASSETS_PATH}}/spec-package.md` and `{{ASSETS_PATH}}/axis-brief-template.md`. Fill `{{AXIS}}`, Spec Package only (no success / shipping narrative), `{{AXIS_MISSION}}`, and `{{AXIS_CHECKLIST}}` from `checklists/product.md`, `checklists/residual.md`, or `checklists/prosecution.md`.

**Default axes: `product` + `residual`.** Opt-in: `backend` / `frontend` / **`prosecution`** (NO-only — cannot emit RESOLVED; disprove-delivery) / domain axes via `--axes`. Keep **≥1 residual** leg unless operator excludes residual. **Auto-recommend prosecution** when first merge has zero CRITICAL/HIGH on a large rewrite (≥5 Dn or migration-shaped) — see `checklists/prosecution.md`.

**Exclude residual (HARD cap):** log exclusion; **cap** verdict at **PARTIAL** — never CLOSED without a valid residual leg.

**Residual leg:** {{READ_TOOL}} `{{ASSETS_PATH}}/residual-hunt-protocol.md`. **Invalid residual** (starved terms / fake empty success) blocks CLOSED.

Agent rules: Spec Package only; that axis checklist only; output checklist + CRITICAL→LOW gaps + confidence + "not verified"; forbid fixes and inventing decisions; adversarial stance.

**Operator merge:** {{READ_TOOL}} `{{ASSETS_PATH}}/critic-merge.md` (full depth: Gap List → product **downgrade-only** vs residual CRITICAL → **fresh critic** preferred; light may keep parent merge), then `findings-ledger.md` and `severity.md`. Dedup by mechanism. Pass residual is mandatory if any Dn/Pn is PARTIAL/NO or any CRITICAL/HIGH exists.

## Phase 3 — Verdict gate

{{READ_TOOL}} `{{ASSETS_PATH}}/verdict-gate.md`.

| Verdict | Rule |
|---------|------|
| **CLOSED** | Load-bearing Dn/Pn RESOLVED or N/A; **zero CRITICAL**; every open HIGH has durable **Accept Record**; residual valid and not excluded |
| **PARTIAL** | Core path OK but residual CRITICAL/HIGH without Accept Records, any PARTIAL Dn/Pn, residual excluded/invalid, or chat-only HIGH accept |
| **OPEN** | Load-bearing **NO**, unverified key chains, or CRITICAL residual remains |

**Hard rules:** CRITICAL never Accept-Recorded to CLOSED; HIGH needs Accept Record or PARTIAL; green suite alone never upgrades verdict.

{{WRITE_TOOL}} report to `--out` using `{{ASSETS_PATH}}/report-template.md` (Accept Register included).

If `--mode=audit` or `--no-fix`: **STOP**. Prefer composition → re-run reaudit. Do not fix unless `audit-and-fix`.

## Phase 4 — Fix orchestration (`audit-and-fix` only)

**Not the default.** Prefer composition — {{READ_TOOL}} `{{ASSETS_PATH}}/fix-composition-recipe.md`.

<HARD-GATE>
Enter only when mode is `audit-and-fix`, `--no-fix` absent, and ledger has ≥1 CRITICAL/HIGH (or operator asks for MEDIUM). If already CLOSED: no invented fix work.
</HARD-GATE>

Partition disjoint WPs (parallel-dispatch discipline — do not re-implement parallel-dispatch). Spawn fix agents with exclusive paths + SSOT vocabulary; parent does not edit product files while agents run. Verify each "done" via **diff** + scoped tests ({{BASH_TOOL}}); mark FIXED / STILL OPEN / REGRESSED.

## Phase 5 — Reaudit

After any fix round: prefer `audit-delivery --mode=reaudit --out=<report>`. {{READ_TOOL}} `{{ASSETS_PATH}}/reaudit-entry.md` — **dual reaudit**: (A) per-finding ledger retest (B) **residual-blind** without claimed-fix narratives; union residual; **plateau** on open CRITICAL+HIGH. Operator re-reads CRITICAL claimed fixed (G1). Plateau → STOP and escalate; do not churn past `--max-fix-rounds`.

## Optional cross-model (`--cross`, default off)

| Value | Behavior |
|-------|----------|
| **`off`** (default) | No external model legs |
| **`residual`** | Extra residual leg via host external model |
| **`critic`** | Fresh critic merge via external model |
| **`reaudit`** | Dual reaudit pass(es) via external model |

External brief = **Spec Package / ledger claims only** + anti-success-framing (same strip as `spec-package.md`). Do **not** seal intent out of Spec Package. Never replaces residual protocol or verdict gate.

## Phase 6 — Closing

{{READ_TOOL}} `{{ASSETS_PATH}}/closing-summary.md` and present counts + residual next actions + report path.

---

## Residual hunt

{{READ_TOOL}} `{{ASSETS_PATH}}/residual-hunt-protocol.md` (and `checklists/residual.md`). Derive OLD/NEW terms × surfaces; classify storage|alias|teaching|dead; invalid residual **blocks CLOSED**. Domain greps are examples only.

## Code-quality gates

Bound by `docs/kb/code-quality-gates.md`: **G1**, **G2**, **G6** (fix agents also G3/G4/G7). Before complete, append self-review: every RESOLVED/PARTIAL/NO cites evidence; verdict is CLOSED|PARTIAL|OPEN only; agent summaries without cites re-read or struck.

## Red Flags

- "Suite green ⇒ delivery closed" / "Skip residual — product mostly yes"
- "review-code already ran, this is redundant" / "Seal intent out of the auditor" (wrong skill)
- "PARTIAL is good enough for CLOSED if handoff said shipped"
- "Docs/MCP don't count" / "Fix agent said done — skip reaudit"
- "One more fix round after plateau" / invent decisions not in the package
- "Plan-end intentVsDelivered ⇒ skip audit-delivery on phase-done"
- "Light depth ⇒ CLOSED with CRITICAL" / "RESOLVED with one hop and stages still ?"

If you thought any of the above: STOP. Return to the phase you were skipping.

## Closing note

`audit-delivery` does **not** replace `review-code`. Primary identity is **read-only** intent-vs-delivered audit. After composition or optional `audit-and-fix`, recommend blind `review-code` on the fix range and a **re-run** of audit-delivery so residual closure is proven.
