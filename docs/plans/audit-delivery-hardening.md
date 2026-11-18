# Plan: `audit-delivery` hardening (P0–P2)

**Status:** draft / ready to implement  
**Created:** 2026-08-04  
**Slug:** `audit-delivery-hardening`  
**Tracking:** `.atomic-skills/projects/atomic-skills/audit-delivery-hardening/plan.md`  
**Research basis:** multi-agent synthesis (product residual, skill-engineering, adversarial method, ecosystem UX, RTM/V&V, minimal-vs-maximal) on the WIP skill introduced as sibling of `review-code`.

## Goal

Ship a **production-ready** `atomic-skills:audit-delivery` that proves product intent was delivered end-to-end (including residual monorepo surfaces), without:

- becoming a mode of `review-code` (opposite iron law on intent),
- false-`CLOSED` on green suites / half-migration,
- fat body + orphan assets,
- colliding with plan-end lifecycle `intentVsDelivered`.

## Current state (baseline 2026-08-04)

| Surface | State |
|---------|--------|
| `skills/core/audit-delivery.md` | ~333 lines, fat process inline |
| `skills/shared/audit-delivery-assets/` | 2 templates, **never `{{READ_TOOL}}`-wired** |
| `meta/catalog.yaml` + `docs/skills/audit-delivery.md` | Entry present; PT enums in copy; `version_added: 2.4.0` |
| `review-code` cross-link | `when_not` + related OK |
| Tests | none specific (F3 adds `tests/audit-delivery-assets.test.js`) |
| AS project plan | **active** — `.atomic-skills/projects/atomic-skills/audit-delivery-hardening/` (F0 materialized; F1–F4 descriptor sidecars) |

## Design decisions (ratified from multi-agent synthesis)

| ID | Decision |
|----|----------|
| D1 | **Separate skill** — not a `review-code` mode |
| D2 | Keep name **`audit-delivery`** |
| D3 | **v1 default is read-only audit**; fix loop composes with `fix` / `parallel-dispatch` then **re-run** this skill |
| D4 | **`audit-and-fix` demoted** to documented recipe / optional v2 surface — not the primary body path |
| D5 | Default axes: **`product` + `residual`** (backend/frontend opt-in via `--axes`) |
| D6 | Status/verdict SSOT in skill source: **EN** (`RESOLVED\|PARTIAL\|NO\|N/A`, `CLOSED\|PARTIAL\|OPEN`) — runtime language translates chat |
| D7 | Residual opt-out **caps verdict at PARTIAL** (never CLOSED) |
| D8 | CRITICAL residual **never** accepted to CLOSED; HIGH only with durable **Accept Record** |
| D9 | Agents receive **Spec Package** (structured criteria), not success narrative from handoff |
| D10 | Plan-end `intentVsDelivered` = lifecycle inventory receipt; this skill = **system residual delivery audit** — disambiguate in catalog/docs |
| D11 | **Hard-gate on every phase-done** — `implement` (Mode-1 + pure-maestro) **must** run `audit-delivery` and stamp a durable `deliveryAuditGate` before closing a phase. **Never skippable:** no `operatorSkip`, no soft-suggest-only, no “small phase / no product intent / green suite” waiver. OPEN blocks; CLOSED allows; PARTIAL only when skill verdict rules allow (zero CRITICAL, every HIGH Accept-Recorded). Distinct from plan-end lifecycle `intentVsDelivered` (still required at finalize; not a substitute). |
| D12 | Body medium-thin (~120–180 lines) + lazy assets (brainstorm/hunt pattern) |

## Non-goals

- Merge `audit-delivery` into `review-code` / `review-plan`
- Soft-suggest / optional / skippable audit on phase close (explicitly rejected — see D11)
- Classic RTM databases, 5×5 risk matrices, coverage quotas
- Full cross-model sealed anti-intent substitute
- Domain-specific Lekto note-pipeline as universal residual checklist (examples only)
- Inflating package version without release intent (align `version_added` with publish plan)
- Replacing plan-end `intentVsDelivered` with this skill (both remain; different jobs)

## Success criteria

| # | Criterion | How verified |
|---|-----------|--------------|
| 1 | Every asset under `audit-delivery-assets/` is referenced via `{{READ_TOOL}}` / `{{ASSETS_PATH}}` from the body | static grep / test |
| 2 | No hardcoded “Present in Portuguese” / PT enums as SSOT in skill source | grep |
| 3 | Intent Package admission blocks CLOSED-class close without acceptance + vocabulary/surface rules where required | prose + checklist assets + validate-skills |
| 4 | Residual protocol is domain-agnostic (OLD_TERMS × surfaces); empty residual without derived terms cannot CLOSED | asset + body |
| 5 | Default axes product+residual; residual exclude → max PARTIAL | body + catalog |
| 6 | Reaudit / re-run path is first-class (`--out` load or re-invoke) | body mode table |
| 7 | Sibling when_not disambiguates plan-end vs this skill | catalog + skill greps |
| 8 | `npm run validate-skills` green; optional static asset-wire test | CI commands |
| 9 | P2 features either ship behind flags/recipes or are explicitly deferred with paths | plan residual ledger |
| 10 | Every phase-done (automate + Mode-1) hard-requires durable `deliveryAuditGate` from a real `audit-delivery` run — **skip path does not exist** | implement prose + `canRunPhaseDone` / `assert-automate-gate --gate phase-done` + unit tests |

## Phase map

```text
F0  P0 craft foundation     EN-only, parse-first, wire assets, reaudit entry, catalog args
F1  P0 delivery teeth       Intent Package hard, residual protocol, axes, verdict + Accept Record
F2  P1 evidence + ecosystem Stages, Matrix C, Spec Package, multi-hop, depth, sibling copy, implement hard-gate (no skip)
F3  P1 body thin + assets   Thin body, checklists, report template, static guards / tests
F4  P2 advanced             Prosecution, critic, dual reaudit, optional cross, BI import, fix recipe, dogfood
```

---

## F0 — P0 craft foundation

**Goal:** Skill is installable craft-correct: EN SSOT, parse-first, assets load, reaudit entry documented, catalog args complete.

### T-001 EN-only enums + drop hard PT language

- **Files:** `skills/core/audit-delivery.md`, `skills/shared/audit-delivery-assets/*`, `docs/skills/audit-delivery.md`, `meta/catalog.yaml` (iron_law / value_pitch if PT)
- **scopeBoundary:** Do not change product positioning vs review-code. Do not invent PT skill forks.
- **acceptance:**
  - it - Skill body and assets use `RESOLVED|PARTIAL|NO|N/A` and `CLOSED|PARTIAL|OPEN` (and `REGRESSION` on reaudit).
  - it - No line hardcodes presenting output in Portuguese/Brazilian as skill rule.
  - it - Section headers in templates are English.
- **verifier:** `{ kind: shell, command: "! rg -q 'Present in Portuguese|FECHADO|RESOLVIDO|Reauditoria|Resumo executivo' skills/core/audit-delivery.md skills/shared/audit-delivery-assets", expectExitCode: 0 }`

### T-002 Parse-args-first HARD step

- **Files:** `skills/core/audit-delivery.md`
- **scopeBoundary:** Do not add a Node CLI unless needed later; prose parse is enough for v1.
- **acceptance:**
  - it - Step 0 (or equivalent) parses `{{ARG_VAR}}` into mode/axes/out/depth/flags **before** any Intent Package file read or report write.
  - it - Documented accepted flags match catalog `args`.
- **verifier:** `{ kind: shell, command: "rg -n 'Parse.*ARG_VAR|BEFORE any|parse.*before' skills/core/audit-delivery.md", expectExitCode: 0 }`

### T-003 Wire existing assets + ASSETS index

- **Files:** `skills/core/audit-delivery.md`, `skills/shared/audit-delivery-assets/axis-brief-template.md`, `reaudit-brief-template.md`
- **scopeBoundary:** Do not invent full checklist tree yet (F3); must load the two existing templates at the correct phases.
- **acceptance:**
  - it - Body contains `{{READ_TOOL}}` paths to both templates (or `{{ASSETS_PATH}}/` equivalents).
  - it - Phase 2 spawn and reaudit/re-run instruct filling those templates.
- **verifier:** `{ kind: shell, command: "rg -n 'axis-brief-template|reaudit-brief-template|ASSETS_PATH' skills/core/audit-delivery.md", expectExitCode: 0 }`

### T-004 Reaudit entry path (`--mode=reaudit` or re-run contract)

- **Files:** `skills/core/audit-delivery.md`, new `skills/shared/audit-delivery-assets/reaudit-entry.md`
- **scopeBoundary:** Full dual residual-blind reaudit is F4; F0 only documents load-report → recover package/ledger → reaudit → append.
- **acceptance:**
  - it - Mode table includes reaudit entry: requires `--out` (or report path), read-only product tree, report append.
  - it - Asset `reaudit-entry.md` exists and is READ at reaudit entry.
- **verifier:** `{ kind: shell, command: "test -f skills/shared/audit-delivery-assets/reaudit-entry.md && rg -n 'reaudit-entry|mode=reaudit|--out' skills/core/audit-delivery.md", expectExitCode: 0 }`

### T-005 Catalog argument_hint + mode docs

- **Files:** `meta/catalog.yaml`, `docs/skills/audit-delivery.md`
- **scopeBoundary:** Do not change skill count schema; keep `mutates_repo: true` but clarify RO default in description.
- **acceptance:**
  - it - `argument_hint` includes `--out` and mode flags within length budget.
  - it - Description/examples state default is read-only; product mutation only if fix recipe / future fix mode.
  - it - `npm run validate-skills` exits 0.
- **verifier:** `{ kind: shell, command: "npm run validate-skills && rg -n 'argument_hint|read-only|audit-and-fix' meta/catalog.yaml", expectExitCode: 0 }`

```yaml
exit_gate:
  - id: F0-G1
    description: EN enums + no hard PT present-rule; assets wired; reaudit-entry file; validate-skills green
    verifier: { kind: shell, command: "npm run validate-skills && test -f skills/shared/audit-delivery-assets/reaudit-entry.md && rg -q 'axis-brief-template' skills/core/audit-delivery.md && rg -q 'reaudit-brief-template' skills/core/audit-delivery.md && rg -q 'reaudit-entry' skills/core/audit-delivery.md && ! rg -q 'Present in Portuguese|FECHADO|RESOLVIDO|Reauditoria|Resumo executivo' skills/core/audit-delivery.md skills/shared/audit-delivery-assets" }
```

---

## F1 — P0 delivery teeth

**Goal:** False-CLOSED holes from dogfood/research are closed: hard Intent Package, residual protocol, default axes, verdict+Accept Record.

### T-006 Intent Package template + admission gate

- **Files:** `skills/shared/audit-delivery-assets/intent-package.md`, `skills/core/audit-delivery.md`
- **scopeBoundary:** Full businessIntent importer is F4; F1 hardens admission fields.
- **acceptance:**
  - it - HARD-GATE requires ≥2 decisions **or** ≥1 problem, **and** ≥1 acceptance (or explicit doneWhen), and for migration/rename-shaped packages a non-empty vocabulary delta.
  - it - Surface inventory required (≥3 surfaces) **or** explicit single-surface flag logged in report.
  - it - Abort copy points at template / micro skeleton.
- **verifier:** `{ kind: shell, command: "test -f skills/shared/audit-delivery-assets/intent-package.md && rg -n 'Intent Package|vocabulary|surface inventory|acceptance' skills/core/audit-delivery.md skills/shared/audit-delivery-assets/intent-package.md", expectExitCode: 0 }`

### T-007 Residual hunt protocol (domain-agnostic)

- **Files:** `skills/shared/audit-delivery-assets/residual-hunt-protocol.md`, body Phase residual
- **scopeBoundary:** Lekto examples may appear as “e.g.” only, not as universal steps.
- **acceptance:**
  - it - Protocol: derive OLD_TERMS/NEW_TERMS → × surface inventory → classify storage|alias|teaching|dead → findings.
  - it - Residual with no derived terms cannot report “nothing found” as success; invalid residual blocks CLOSED.
  - it - Residual classes cover dual SSOT, client rewrite, recovery gap, force/admin legacy, teaching surfaces, false-green fixtures, config/env drift.
- **verifier:** `{ kind: shell, command: "test -f skills/shared/audit-delivery-assets/residual-hunt-protocol.md && rg -n 'OLD_TERMS|surface inventory|invalid residual' skills/shared/audit-delivery-assets/residual-hunt-protocol.md skills/core/audit-delivery.md", expectExitCode: 0 }`

### T-008 Default axes product+residual; opt-out caps PARTIAL

- **Files:** body, catalog defaults
- **scopeBoundary:** backend/frontend remain valid `--axes` values; not default.
- **acceptance:**
  - it - Default axes are `product,residual`.
  - it - Excluding residual requires explicit log and **verdict cap PARTIAL**.
- **verifier:** `{ kind: shell, command: "rg -n 'product,residual|product \\+ residual|cap.*PARTIAL|exclude.residual' skills/core/audit-delivery.md meta/catalog.yaml", expectExitCode: 0 }`

### T-009 Verdict gate + Accept Record schema

- **Files:** `skills/shared/audit-delivery-assets/verdict-gate.md`, body Phase verdict, report template section (stub OK)
- **scopeBoundary:** Staged evidence multi-hop is F2; F1 locks severity closing.
- **acceptance:**
  - it - CLOSED requires zero CRITICAL residual; CRITICAL never accepted to CLOSED.
  - it - HIGH open requires per-finding Accept Record (finding id, risk, mitigation, operator, at; optional expires) or verdict PARTIAL.
  - it - Green suite alone never upgrades verdict.
- **verifier:** `{ kind: shell, command: "test -f skills/shared/audit-delivery-assets/verdict-gate.md && rg -n 'Accept Record|CRITICAL|CLOSED|green suite' skills/shared/audit-delivery-assets/verdict-gate.md skills/core/audit-delivery.md", expectExitCode: 0 }`

### T-010 Demote audit-and-fix from primary path

- **Files:** body, catalog examples
- **scopeBoundary:** Do not delete all mention; document composition recipe. Full fix-WP orchestration moves to F4 recipe asset if kept.
- **acceptance:**
  - it - Default mode is audit (read-only report write).
  - it - Primary composition: audit → fix/parallel-dispatch → re-run audit-delivery / reaudit.
  - it - Catalog examples include re-run path; audit-and-fix marked optional/advanced or removed from default examples.
- **verifier:** `{ kind: shell, command: "rg -n 'read-only|re-run|composition|parallel-dispatch' skills/core/audit-delivery.md", expectExitCode: 0 }`

```yaml
exit_gate:
  - id: F1-G1
    description: Intent package + residual protocol + verdict Accept Record + default axes product,residual
    verifier: { kind: shell, command: "test -f skills/shared/audit-delivery-assets/intent-package.md && test -f skills/shared/audit-delivery-assets/residual-hunt-protocol.md && test -f skills/shared/audit-delivery-assets/verdict-gate.md && rg -q 'product,residual|product \\+ residual' skills/core/audit-delivery.md && rg -q 'Accept Record|CRITICAL' skills/shared/audit-delivery-assets/verdict-gate.md && rg -q 'PARTIAL|cap' skills/core/audit-delivery.md skills/shared/audit-delivery-assets/verdict-gate.md && rg -q 'acceptance|vocabulary|surface inventory|HARD-GATE' skills/shared/audit-delivery-assets/intent-package.md skills/core/audit-delivery.md" }
```

---

## F2 — P1 evidence + ecosystem

**Goal:** Evidence quality + sibling positioning so the skill is discoverable and hard to misuse.

### T-011 Staged evidence columns (S C U O T X)

- **Files:** `skills/shared/audit-delivery-assets/matrices.md`, body
- **scopeBoundary:** Do not require all stages on cosmetic decisions; required stages default by surface / Intent Package override.
- **acceptance:**
  - it - Matrix documents stages Spec/SSOT, Core path, User/ops, Operational teach, Test, Negative dual-path.
  - it - RESOLVED forbidden if any required stage is `?` or fail.
- **verifier:** `{ kind: shell, command: "test -f skills/shared/audit-delivery-assets/matrices.md && rg -n 'S.*C.*U|required stage|RESOLVED' skills/shared/audit-delivery-assets/matrices.md", expectExitCode: 0 }`

### T-012 Matrix C / must-not negative space

- **Files:** matrices asset, intent-package (`mustNot` / nonGoals seed)
- **acceptance:**
  - it - Must-not rows exist; RESOLVED means searched-and-absent with grep/path evidence.
  - it - Seeded from non-goals / outOfScope / vocabulary old terms.
- **verifier:** `{ kind: shell, command: "rg -n 'must-not|Must NOT|Matrix C|mustNot' skills/shared/audit-delivery-assets/ skills/core/audit-delivery.md", expectExitCode: 0 }`

### T-013 Spec Package strip (anti-success-framing)

- **Files:** `skills/shared/audit-delivery-assets/spec-package.md`, axis brief template
- **acceptance:**
  - it - Agents receive Spec Package (Dn/Pn IDs, chains, non-goals, SSOT paths, domain terms) without shipping narrative / suite-green praise.
  - it - Axis brief forbids inventing decisions and forbids treating green tests as RESOLVED alone.
- **verifier:** `{ kind: shell, command: "test -f skills/shared/audit-delivery-assets/spec-package.md && rg -n 'Spec Package|success narrative|shipping narrative' skills/shared/audit-delivery-assets/ skills/core/audit-delivery.md", expectExitCode: 0 }`

### T-014 Multi-hop evidence bar for RESOLVED

- **Files:** matrices / axis brief / verdict-gate
- **acceptance:**
  - it - Load-bearing RESOLVED requires ≥2 chain hops **or** explicit single-surface waiver.
  - it - Prefers negative residual note (dual-path empty or intentional alias) for migration decisions.
- **verifier:** `{ kind: shell, command: "rg -n 'multi-hop|chain|≥2|2 hops' skills/shared/audit-delivery-assets/ skills/core/audit-delivery.md", expectExitCode: 0 }`

### T-015 `--depth=light|full`

- **Files:** body, catalog args
- **acceptance:**
  - it - `full` default: product+residual agents (or equivalent).
  - it - `light`: matrix + residual protocol (parent greps OK) still forbids CLOSED on CRITICAL / residual opt-out / open load-bearing NO.
- **verifier:** `{ kind: shell, command: "rg -n 'depth=light|depth=full|--depth' skills/core/audit-delivery.md meta/catalog.yaml", expectExitCode: 0 }`

### T-016 Sibling catalog disambiguation (plan-end ≠ delivery audit)

- **Files:** `meta/catalog.yaml` (audit-delivery, review-code, review-plan, verify-claim, parallel-dispatch-audit), docs skill pages as needed
- **scopeBoundary:** Disambiguation copy only — hard phase-done gate is **T-017**. Do not describe audit-delivery as optional/soft after phase close.
- **acceptance:**
  - it - audit-delivery when_not mentions plan-end lifecycle intentVsDelivered and parallel-dispatch-audit.
  - it - review-plan / verify-claim when_not point at audit-delivery for post-ship residual.
  - it - Catalog/docs state that phase close requires this skill (hard), not a soft tip.
- **verifier:** `{ kind: shell, command: "rg -n 'audit-delivery' meta/catalog.yaml docs/skills/ && rg -n 'intentVsDelivered|plan-end|parallel-dispatch-audit|when_not|phase-done|hard' meta/catalog.yaml docs/skills/audit-delivery.md", expectExitCode: 0 }`

### T-017 implement hard-gate: `deliveryAuditGate` on every phase-done (NEVER skippable)

- **Files:**  
  `skills/core/implement.md`,  
  `skills/shared/implement-automate-maestro.md`,  
  `skills/shared/implement-antipatterns.md`,  
  `skills/shared/implement-phase-evaluator.md` and/or `implement-phase-writer.md` (post-order only),  
  `src/phase-delivery-audit-gate.js` (new pure helpers),  
  `src/automate-orchestrator-gates.js` (`canRunPhaseDone`),  
  `scripts/assert-automate-gate.js` (phase-done path),  
  tests covering honesty + skip-forbidden + canRunPhaseDone integration
- **scopeBoundary:**  
  - Gate is on **each phase-done**, not only plan-end finalize.  
  - Plan-end `intentVsDelivered` stays separate and is **not** a substitute.  
  - **No skip path:** do not add `operatorSkip` / `status: skipped` acceptance for this gate (unlike evaluation/review).  
  - Do not merge audit-delivery into review-code.  
  - Mode-1 and pure-maestro both hard-require the gate (not automate-only prose).
- **acceptance:**
  - it - Phase close order under implement includes: … evaluation/decision-review/review-code as today → **run `audit-delivery` for the phase Intent Package / BI spine → durable report under `.atomic-skills/reviews/` → stamp `phases[].deliveryAuditGate`** → only then `phase-done` / `canRunPhaseDone` ok.
  - it - Stamp shape (EN SSOT): `{ status: 'passed', reportPath, verdict: 'CLOSED'|'PARTIAL', verifiedAt }` with authenticity: non-empty `reportPath` to real report file; verdict rules match skill (CLOSED ⇒ zero CRITICAL residual + load-bearing rows closed; PARTIAL only with Accept Records for open HIGH and zero CRITICAL; **OPEN never stamps passed**).
  - it - **Skip is illegal:** honesty / `deliveryAuditAllowsClose` rejects missing gate, `status: skipped`, operatorSkip, reason-only, empty reportPath, and chat-only “we audited”.
  - it - `canRunPhaseDone` and `assert-automate-gate --gate phase-done` fail closed without a valid `deliveryAuditGate` (automate stamp path **and** Mode-1 implement prose HARD-GATE).
  - it - implement red-flag / antipattern table forbids: soft-suggest instead of run, skip audit, forge stamp, treat review-code or green suite as substitute, treat plan-end intentVsDelivered as phase gate.
  - it - Unit tests: skip shapes fail; missing gate fails; valid CLOSED + reportPath passes; OPEN/forged fails.
- **verifier:** `{ kind: shell, command: "test -f src/phase-delivery-audit-gate.js && rg -n 'deliveryAuditGate|deliveryAuditAllowsClose|audit-delivery' skills/core/implement.md skills/shared/implement-automate-maestro.md skills/shared/implement-antipatterns.md src/automate-orchestrator-gates.js && rg -n 'operatorSkip|skipped' src/phase-delivery-audit-gate.js; node --test tests/phase-delivery-audit-gate.test.js 2>/dev/null || node --test tests/*delivery*audit* 2>/dev/null || rg -n 'deliveryAudit' tests/", expectExitCode: 0 }`

```yaml
exit_gate:
  - id: F2-G1
    description: Stages + Spec Package + depth + catalog disambiguation + deliveryAuditGate hard-wired (no skip)
    verifier: { kind: shell, command: "test -f skills/shared/audit-delivery-assets/matrices.md && test -f skills/shared/audit-delivery-assets/spec-package.md && test -f src/phase-delivery-audit-gate.js && rg -q -- '--depth' skills/core/audit-delivery.md && rg -q -- '--depth' meta/catalog.yaml && rg -q 'deliveryAuditGate|deliveryAuditAllowsClose' skills/core/implement.md src/automate-orchestrator-gates.js && rg -q 'audit-delivery' meta/catalog.yaml && rg -q 'intentVsDelivered|plan-end|parallel-dispatch-audit' meta/catalog.yaml && ! rg -q 'soft-suggest|soft suggest only|optional audit-delivery' skills/core/implement.md skills/shared/implement-automate-maestro.md" }
```

---

## F3 — P1 body thin + assets complete + guards

**Goal:** Medium-thin body + complete lazy asset tree; static guard so assets cannot go orphan again.

### T-018 Thin body rewrite (~120–180 lines)

- **Files:** `skills/core/audit-delivery.md`
- **scopeBoundary:** Keep Iron Law, mode dispatch, HARD-GATEs, red flags (compressed), composition note. Move long tables to assets.
- **acceptance:**
  - it - Body ≤ ~200 lines (soft) with phase spine + `{{READ_TOOL}}` per phase.
  - it - `## Assets (lazy)` index lists all assets.
- **verifier:** `{ kind: shell, command: "wc -l skills/core/audit-delivery.md | awk '{exit !($1<=220)}' && rg -n 'Assets \\(lazy\\)|ASSETS_PATH' skills/core/audit-delivery.md", expectExitCode: 0 }`

### T-019 Checklists + report + findings ledger assets

- **Files:**  
  `checklists/product.md`, `checklists/residual.md`, optional `backend.md`/`frontend.md`,  
  `report-template.md`, `findings-ledger.md`, `severity.md`, `closing-summary.md`
- **acceptance:**
  - it - Each default axis has a checklist asset loaded into axis brief.
  - it - Report template is the single SSOT for report shape including Accept Register + vocabulary + surfaces.
- **verifier:** `{ kind: shell, command: "test -f skills/shared/audit-delivery-assets/report-template.md && test -f skills/shared/audit-delivery-assets/checklists/product.md && test -f skills/shared/audit-delivery-assets/checklists/residual.md", expectExitCode: 0 }`

### T-020 Static guard: assets referenced

- **Files:** `tests/audit-delivery-assets.test.js` (or extend existing skill contract test)
- **scopeBoundary:** No runtime executor of the skill; static file graph only.
- **acceptance:**
  - it - Test fails if any file in `skills/shared/audit-delivery-assets/**` (except optional README) is not mentioned from body or from another asset reachable from body.
  - it - `node --test` that file exits 0.
- **verifier:** `{ kind: shell, command: "node --test tests/audit-delivery-assets.test.js", expectExitCode: 0 }`

### T-021 INVESTIGATOR fallback

- **Files:** body
- **acceptance:**
  - it - If spawn unavailable, sequential inline axes with explicit degradation warning (mirror review-code).
- **verifier:** `{ kind: shell, command: "rg -n 'INVESTIGATOR|unavailable|degraded|inline' skills/core/audit-delivery.md", expectExitCode: 0 }`

```yaml
exit_gate:
  - id: F3-G1
    description: Thin body + report/checklists + asset wire test green + validate-skills
    verifier: { kind: shell, command: "npm run validate-skills && node --test tests/audit-delivery-assets.test.js && test -f skills/shared/audit-delivery-assets/report-template.md && test -f skills/shared/audit-delivery-assets/checklists/product.md && test -f skills/shared/audit-delivery-assets/checklists/residual.md && test -f skills/shared/audit-delivery-assets/findings-ledger.md && rg -q 'INVESTIGATOR|unavailable|degraded' skills/core/audit-delivery.md" }
```

---

## F4 — P2 advanced + dogfood close

**Goal:** Optional advanced methodology + fix recipe + dogfood checklist. Phase-done hard-gate remains mandatory (D11 / T-017); F4 does not reintroduce skip.

### T-022 Prosecution axis (NO-only)

- **Files:** `checklists/prosecution.md`, axis-missions, body `--axes`
- **acceptance:**
  - it - Optional axis `prosecution` may only emit PARTIAL/NO/unverified candidates — never RESOLVED.
  - it - Auto-recommend when first merge has zero CRITICAL/HIGH on large rewrite (≥5 Dn or package marks migration).
- **verifier:** `{ kind: shell, command: "rg -n 'prosecution|NO-only|disprove' skills/core/audit-delivery.md skills/shared/audit-delivery-assets/", expectExitCode: 0 }`

### T-023 Fresh critic merge (full depth)

- **Files:** body full-depth path, optional `critic-merge.md`
- **acceptance:**
  - it - Full depth: field legs blind → gap list → product matrix (downgrade-only vs residual CRITICAL) → fresh critic for ledger+verdict preferred over parent-only synthesis.
  - it - Light depth may keep parent merge.
- **verifier:** `{ kind: shell, command: "rg -n 'critic|fresh|Gap List|downgrade' skills/core/audit-delivery.md skills/shared/audit-delivery-assets/", expectExitCode: 0 }`

### T-024 Dual reaudit (ledger + residual-blind)

- **Files:** reaudit-entry, reaudit-brief-template
- **acceptance:**
  - it - After fixes (or on reaudit mode when tree changed): (A) per-finding retest (B) residual-blind pass without claimed-fix narratives.
  - it - Union residual; plateau on open CRITICAL+HIGH count.
- **verifier:** `{ kind: shell, command: "rg -n 'residual-blind|ledger|claimed fix' skills/shared/audit-delivery-assets/reaudit-entry.md skills/core/audit-delivery.md", expectExitCode: 0 }`

### T-025 Fix composition recipe (not primary skill body)

- **Files:** `skills/shared/audit-delivery-assets/fix-composition-recipe.md` (optional short section in body)
- **scopeBoundary:** Do not re-implement parallel-dispatch; reference it.
- **acceptance:**
  - it - Recipe: partition findings → parallel-dispatch/fix → re-run audit-delivery with `--out` / reaudit.
  - it - Optional `audit-and-fix` flag if retained only loads this recipe + max rounds + plateau.
- **verifier:** `{ kind: shell, command: "test -f skills/shared/audit-delivery-assets/fix-composition-recipe.md && rg -n 'parallel-dispatch|re-run|plateau' skills/shared/audit-delivery-assets/fix-composition-recipe.md", expectExitCode: 0 }`

### T-026 Optional cross-model residual/critic flag

- **Files:** body advanced section, catalog optional arg `--cross=`
- **scopeBoundary:** Reuse same-family gate ideas from review-code; do **not** seal intent out of Spec Package.
- **acceptance:**
  - it - `--cross=off|residual|critic|reaudit` documented; default off.
  - it - External brief = Spec Package / ledger claims only + anti-success-framing line.
- **verifier:** `{ kind: shell, command: "rg -n 'cross=|cross-model|Spec Package' skills/core/audit-delivery.md meta/catalog.yaml", expectExitCode: 0 }`

### T-027 businessIntent import + dogfood checklist

- **Files:** intent-package.md, `docs/kb/` or project asset dogfood checklist under plan folder
- **acceptance:**
  - it - If phase/plan has businessIntent, draft package from value/workflow/rules/outOfScope/doneWhen; operator ratifies.
  - it - Dogfood checklist encodes four SM failure modes (half-migration, skip residual, skip reaudit, green=closed) **and** the implement hard-gate (phase-done blocked without deliveryAuditGate; skip illegal).
- **verifier:** `{ kind: shell, command: "rg -n 'businessIntent|doneWhen|outOfScope' skills/shared/audit-delivery-assets/intent-package.md && test -f .atomic-skills/projects/atomic-skills/audit-delivery-hardening/dogfood-checklist.md && rg -q 'deliveryAuditGate|never skip|hard-gate' .atomic-skills/projects/atomic-skills/audit-delivery-hardening/dogfood-checklist.md", expectExitCode: 0 }`

```yaml
exit_gate:
  - id: F4-G1
    description: P2 axes/recipes documented; dogfood checklist includes hard-gate; validate-skills + asset test green
    verifier: { kind: shell, command: "npm run validate-skills && node --test tests/audit-delivery-assets.test.js && test -f .atomic-skills/projects/atomic-skills/audit-delivery-hardening/dogfood-checklist.md && rg -q 'deliveryAuditGate|never skip|hard-gate' .atomic-skills/projects/atomic-skills/audit-delivery-hardening/dogfood-checklist.md" }
```

---

## Implementation order

1. **F0** craft (unblocks everything)  
2. **F1** teeth (value)  
3. **F2** evidence + **implement hard-gate** (D11 — non-skippable phase-done)  
4. **F3** thin body + guards (prevent rot)  
5. **F4** advanced (optional power; hard-gate already mandatory)

Recommended review: `review-code` on skill/docs diffs after F1 and after F2 (gate wire); full skill dogfood after F4.

## Residual / deferred (out of this plan unless pulled)

- Machine-parsed Accept Record validator script (beyond gate authenticity)
- Dashboard card for audit reports
- Auto-run from project review composer as a leg (phase-done already hard-requires the skill run)
- Language-specific residual libraries per domain pack

## References

- Skill WIP: `skills/core/audit-delivery.md`
- Siblings: `review-code`, `verify-claim`, `review-plan`, plan-end intent in `implement-automate-maestro.md`
- Policy: `.ai/memory/decisao-skills-en-only.md`, `feedback-skill-body-review-rules.md`
- Research session: multi-agent synthesis 2026-08-04 (product, craft, adversarial, UX, RTM, minimal)
