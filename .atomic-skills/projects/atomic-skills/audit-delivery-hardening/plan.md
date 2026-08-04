---
schemaVersion: "0.1"
slug: audit-delivery-hardening
title: audit-delivery hardening — P0 craft + teeth, P1 evidence, P2 advanced
version: "1.0"
status: active
started: 2026-08-04T11:51:14Z
lastUpdated: 2026-08-04T15:32:56.688Z
branch: develop
currentPhase: F4
executionMode: automate
parallelismAllowed: false
principles:
  - id: P1
    title: Separate skill, opposite iron law
    body: audit-delivery requires Intent Package; review-code forbids intent in the briefing. Never collapse into a review-code mode.
  - id: P2
    title: Read-only default, compose for fix
    body: Default path writes the report only. Fix via fix/parallel-dispatch then re-run audit-delivery. audit-and-fix is recipe/advanced, not the identity.
  - id: P3
    title: Residual is the differentiator
    body: Half-migration monorepo hunt is mandatory; opt-out caps verdict at PARTIAL. CRITICAL residual never yields CLOSED.
  - id: P4
    title: Spec Package not success story
    body: Agents get structured criteria (Dn/Pn, chains, terms); shipping narrative and suite-green praise stay out of auditor briefs.
  - id: P5
    title: EN skill source
    body: Status/verdict enums and templates are English SSOT; runtime COMMUNICATION_LANGUAGE handles operator language.
  - id: P6
    title: Medium-thin body + lazy assets
    body: Body holds iron law, mode dispatch, HARD-GATEs, phase spine; checklists and protocols live under audit-delivery-assets and are READ on demand.
  - id: P7
    title: Hard-gate phase-done — never skippable
    body: implement (Mode-1 + pure-maestro) must run audit-delivery and stamp durable deliveryAuditGate before every phase-done. No operatorSkip, no soft-suggest-only, no waiver. OPEN blocks; CLOSED allows; PARTIAL only under skill Accept Record rules. Plan-end intentVsDelivered remains separate and is not a substitute.
glossary:
  - term: Intent Package
    definition: Operator-facing decisions, problems, acceptance, vocabulary delta, surface inventory used to admit the audit.
  - term: Spec Package
    definition: Stripped structured criteria given to audit agents (no success narrative).
  - term: residual hunt
    definition: Domain-agnostic monorepo search for dual paths and teaching surfaces still on pre-change truth (OLD_TERMS × surfaces).
  - term: Accept Record
    definition: Durable per-HIGH residual acceptance in the report (risk, mitigation, operator, timestamp); never used for CRITICAL→CLOSED.
  - term: lifecycle intentVsDelivered
    definition: Plan-end automate receipt rows (matched|partial|missing|extra) — not this skill's system residual audit.
  - term: CLOSED
    definition: Audit verdict — all load-bearing rows RESOLVED|N/A, zero CRITICAL residual, HIGH empty or Accept-Recorded.
phases:
  - id: F0
    slug: audit-delivery-hardening-f0-p0-craft-foundation
    title: P0 craft foundation
    summary: EN enums, parse-first, wire assets, reaudit entry, catalog args
    goal: Make audit-delivery craft-correct under Atomic Skills conventions so later product teeth sit on a body that loads assets, speaks EN SSOT, parses flags first, and has a real reaudit entry path.
    dependsOn: []
    subPhaseCount: 5
    status: done
    businessIntent:
      value: Operators and agents get a skill source that installs and reads like other core skills — no orphan templates, no hardcoded PT output rule, reaudit mode that actually loads a prior report.
      workflow: T-001 EN rewrite of body+existing assets; T-002 parse-first step; T-003 wire axis/reaudit templates; T-004 reaudit-entry asset + mode table; T-005 catalog argument_hint and RO-default clarity; validate-skills.
      rules: No merge into review-code; no product residual protocol invent here (F1); version_added may stay aspirational until publish; mutates_repo true stays with RO default documented.
      outOfScope: Staged evidence, Matrix C, Spec Package strip, thin-body target line count, prosecution axis, fix orchestration rewrite, dogfood checklist.
      doneWhen: validate-skills green; body references axis-brief + reaudit-entry; no Present-in-Portuguese rule; EN status/verdict enums in body and assets.
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-F0-1
          description: EN SSOT + assets wired + reaudit-entry file + validate-skills
          status: met
          verifier:
            kind: shell
            command: npm run validate-skills && test -f skills/shared/audit-delivery-assets/reaudit-entry.md && rg -q 'axis-brief-template' skills/core/audit-delivery.md && rg -q 'reaudit-brief-template' skills/core/audit-delivery.md && rg -q 'reaudit-entry' skills/core/audit-delivery.md && ! rg -q 'Present in Portuguese|FECHADO|RESOLVIDO|Reauditoria|Resumo executivo' skills/core/audit-delivery.md skills/shared/audit-delivery-assets
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-08-04T14:46:09.315Z
            passed: true
            exitCode: 0
            verifiedCommit: dac81210d2448fed038b1ca9ad9fd233602b99e5
            outputSummary: G-F0-1 all clauses green post-merge + codex fixes
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-audit-delivery-hardening-F0.md
      verifiedAt: 2026-08-04T14:35:54.447Z
      at: 4c638539a7dca302b7223d742b17b4be59c2baff
    lessonsState: none
    noneReason: "F0 clean phase: all task verifiers + exit gate G-F0-1 green; evaluation findings note-only; no failure signals requiring lessons file"
    reviewGate:
      status: passed
      mode: both
      at: dac81210d2448fed038b1ca9ad9fd233602b99e5
      verifiedAt: 2026-08-04T14:46:09.315Z
      reviewFile: .atomic-skills/reviews/2026-08-04-both-audit-delivery-hardening-F0.md
      localReceiptPath: .atomic-skills/reviews/2026-08-04-local-audit-delivery-hardening-F0.md
      codexReceiptPath: .atomic-skills/reviews/2026-08-04-codex-audit-delivery-hardening-F0.md
      legs:
        - provider: local
          receiptPath: .atomic-skills/reviews/2026-08-04-local-audit-delivery-hardening-F0.md
        - provider: codex
          receiptPath: .atomic-skills/reviews/2026-08-04-codex-audit-delivery-hardening-F0.md
    decisionReview:
      status: passed
      verifiedAt: 2026-08-04T14:46:09.315Z
      packagePresentedAt: 2026-08-04T14:46:09.315Z
      packagePath: .atomic-skills/reviews/decision-package-audit-delivery-hardening-F0.md
      evidencePath: .atomic-skills/status/projects/atomic-skills/audit-delivery-hardening/decisions/F0.jsonl
  - id: F1
    slug: audit-delivery-hardening-f1-p0-delivery-teeth
    title: P0 delivery teeth
    summary: Intent Package hard, residual protocol, axes, verdict Accept Record
    goal: Close false-CLOSED paths — hard Intent Package admission, domain-agnostic residual protocol, product+residual defaults, severity closing rules with Accept Records; demote audit-and-fix from primary identity.
    dependsOn:
      - F0
    subPhaseCount: 0
    status: done
    businessIntent:
      value: A green suite cannot close delivery; half-migration residual and missing acceptance/vocabulary cannot reach CLOSED.
      workflow: Intent package asset+gate; residual-hunt-protocol; default axes; verdict-gate+Accept Record; composition note over in-skill fix PM loop.
      rules: CRITICAL never accepted to CLOSED; residual opt-out caps PARTIAL; Lekto greps are examples only.
      outOfScope: Multi-hop stage columns, Matrix C, Spec Package, --depth, critic topology, static asset graph test.
      doneWhen: intent-package, residual-hunt-protocol, verdict-gate assets exist and body encodes product+residual default and Accept Record rules.
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-F1-1
          description: Intent + residual + verdict assets; axes; admission/Accept/CRITICAL rules greppable
          status: met
          verifier:
            kind: shell
            command: test -f skills/shared/audit-delivery-assets/intent-package.md && test -f skills/shared/audit-delivery-assets/residual-hunt-protocol.md && test -f skills/shared/audit-delivery-assets/verdict-gate.md && rg -q 'product,residual|product \+ residual' skills/core/audit-delivery.md && rg -q 'Accept Record|CRITICAL' skills/shared/audit-delivery-assets/verdict-gate.md && rg -q 'PARTIAL|cap' skills/core/audit-delivery.md skills/shared/audit-delivery-assets/verdict-gate.md && rg -q 'acceptance|vocabulary|surface inventory|HARD-GATE' skills/shared/audit-delivery-assets/intent-package.md skills/core/audit-delivery.md
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-08-04T14:55:35.303Z
            passed: true
            exitCode: 0
            verifiedCommit: 5f3191de3dcafb8d502bb6d75fd8ad4bdef23405
            outputSummary: G-F1-1 green
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-audit-delivery-hardening-F1.md
      verifiedAt: 2026-08-04T14:55:35.303Z
      at: 5f3191de3dcafb8d502bb6d75fd8ad4bdef23405
    lessonsState: none
    noneReason: "F1 clean: all task+exit gate green; evaluation note-only"
    reviewGate:
      status: passed
      mode: both
      at: 5f3191de3dcafb8d502bb6d75fd8ad4bdef23405
      verifiedAt: 2026-08-04T14:55:35.303Z
      reviewFile: .atomic-skills/reviews/2026-08-04-both-audit-delivery-hardening-F1.md
      localReceiptPath: .atomic-skills/reviews/2026-08-04-local-audit-delivery-hardening-F1.md
      codexReceiptPath: .atomic-skills/reviews/2026-08-04-codex-audit-delivery-hardening-F1.md
      legs:
        - provider: local
          receiptPath: .atomic-skills/reviews/2026-08-04-local-audit-delivery-hardening-F1.md
        - provider: codex
          receiptPath: .atomic-skills/reviews/2026-08-04-codex-audit-delivery-hardening-F1.md
    decisionReview:
      status: passed
      verifiedAt: 2026-08-04T14:55:35.303Z
      packagePresentedAt: 2026-08-04T14:55:35.303Z
      packagePath: .atomic-skills/reviews/decision-package-audit-delivery-hardening-F1.md
  - id: F2
    slug: audit-delivery-hardening-f2-p1-evidence-ecosystem
    title: P1 evidence + ecosystem
    summary: Stages, Spec Package, depth, catalog disambiguation, implement hard-gate
    goal: Raise evidence bar (staged S/C/U/O/T/X, must-not, multi-hop, Spec Package strip), disambiguate vs plan-end intentVsDelivered, and hard-wire deliveryAuditGate so every phase-done requires a real audit-delivery run with no skip path.
    dependsOn:
      - F1
    subPhaseCount: 0
    status: done
    businessIntent:
      value: Auditors prove multi-hop delivery and negative space; phase close cannot ship without a durable delivery audit — never optional, never skippable.
      workflow: matrices+must-not; spec-package; multi-hop bar; --depth; catalog when_not; implement deliveryAuditGate + canRunPhaseDone/assert phase-done.
      rules: No operatorSkip on deliveryAuditGate; no soft-suggest-only; no anti-intent sealing of Spec IDs; plan-end intentVsDelivered is not a substitute for the phase gate.
      outOfScope: Full body thin rewrite, asset reachability test, prosecution, dual reaudit, cross-model.
      doneWhen: matrices and spec-package assets exist; --depth in body+catalog; deliveryAuditGate helpers + implement HARD-GATE prose; skip shapes rejected.
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-F2-1
          description: Stages + Spec Package + depth + deliveryAuditGate hard-wired (no skip)
          status: met
          verifier:
            kind: shell
            command: test -f skills/shared/audit-delivery-assets/matrices.md && test -f skills/shared/audit-delivery-assets/spec-package.md && test -f src/phase-delivery-audit-gate.js && rg -q -- '--depth' skills/core/audit-delivery.md && rg -q -- '--depth' meta/catalog.yaml && rg -q 'deliveryAuditGate|deliveryAuditAllowsClose' skills/core/implement.md src/automate-orchestrator-gates.js && rg -q 'audit-delivery' meta/catalog.yaml && rg -q 'intentVsDelivered|plan-end|parallel-dispatch-audit' meta/catalog.yaml && ! rg -q 'soft-suggest|soft suggest only|optional audit-delivery' skills/core/implement.md skills/shared/implement-automate-maestro.md
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-08-04T15:13:01.204Z
            passed: true
            exitCode: 0
            verifiedCommit: a130e8980a0fc65738d1bb2013fd8139d0bd85e4
            outputSummary: G-F2-1
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-audit-delivery-hardening-F2.md
      verifiedAt: 2026-08-04T15:13:01.204Z
      at: a130e8980a0fc65738d1bb2013fd8139d0bd85e4
    lessonsState: none
    noneReason: F2 clean phase
    reviewGate:
      status: passed
      mode: both
      at: a130e8980a0fc65738d1bb2013fd8139d0bd85e4
      verifiedAt: 2026-08-04T15:13:01.204Z
      reviewFile: .atomic-skills/reviews/2026-08-04-both-audit-delivery-hardening-F2.md
      localReceiptPath: .atomic-skills/reviews/2026-08-04-local-audit-delivery-hardening-F2.md
      codexReceiptPath: .atomic-skills/reviews/2026-08-04-codex-audit-delivery-hardening-F2.md
      legs:
        - provider: local
          receiptPath: .atomic-skills/reviews/2026-08-04-local-audit-delivery-hardening-F2.md
        - provider: codex
          receiptPath: .atomic-skills/reviews/2026-08-04-codex-audit-delivery-hardening-F2.md
    decisionReview:
      status: passed
      verifiedAt: 2026-08-04T15:13:01.204Z
      packagePresentedAt: 2026-08-04T15:13:01.204Z
      packagePath: .atomic-skills/reviews/decision-package-audit-delivery-hardening-F2.md
    deliveryAuditGate:
      status: passed
      reportPath: .atomic-skills/reviews/audit-delivery-audit-delivery-hardening-F2.md
      verdict: CLOSED
      verifiedAt: 2026-08-04T15:13:01.204Z
      at: a130e8980a0fc65738d1bb2013fd8139d0bd85e4
  - id: F3
    slug: audit-delivery-hardening-f3-p1-thin-body-guards
    title: P1 thin body + assets + guards
    summary: Medium-thin body, checklists, report template, static wire test
    goal: Prevent skill rot — thin resident spine, complete lazy assets (checklists/report/ledger), INVESTIGATOR fallback, static test that every asset is reachable from the body.
    dependsOn:
      - F2
    subPhaseCount: 0
    status: done
    businessIntent:
      value: Maintainers cannot ship dead assets; operators get a readable skill body with full report/checklist SSOT in assets.
      workflow: Thin rewrite; checklist+report assets; audit-delivery-assets.test.js; INVESTIGATOR fallback prose.
      rules: Body keeps iron law and HARD-GATEs resident; detail is lazy.
      outOfScope: P2 prosecution/critic/cross; dogfood narrative file.
      doneWhen: validate-skills + asset wire test green; report and product/residual checklists exist.
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-F3-1
          description: validate-skills + asset wire test + report/checklists
          status: met
          verifier:
            kind: shell
            command: npm run validate-skills && node --test tests/audit-delivery-assets.test.js && test -f skills/shared/audit-delivery-assets/report-template.md && test -f skills/shared/audit-delivery-assets/checklists/product.md && test -f skills/shared/audit-delivery-assets/checklists/residual.md && test -f skills/shared/audit-delivery-assets/findings-ledger.md && rg -q 'INVESTIGATOR|unavailable|degraded' skills/core/audit-delivery.md
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-08-04T15:21:30.447Z
            passed: true
            exitCode: 0
            verifiedCommit: 69ee6e72a34bf6d64f18f5497d3997aa6a49f9ce
            outputSummary: G-F3-1
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-audit-delivery-hardening-F3.md
      verifiedAt: 2026-08-04T15:21:30.447Z
      at: 69ee6e72a34bf6d64f18f5497d3997aa6a49f9ce
    lessonsState: none
    noneReason: F3 clean
    reviewGate:
      status: passed
      mode: both
      at: 69ee6e72a34bf6d64f18f5497d3997aa6a49f9ce
      verifiedAt: 2026-08-04T15:21:30.447Z
      reviewFile: .atomic-skills/reviews/2026-08-04-both-audit-delivery-hardening-F3.md
      localReceiptPath: .atomic-skills/reviews/2026-08-04-local-audit-delivery-hardening-F3.md
      codexReceiptPath: .atomic-skills/reviews/2026-08-04-codex-audit-delivery-hardening-F3.md
      legs:
        - provider: local
          receiptPath: .atomic-skills/reviews/2026-08-04-local-audit-delivery-hardening-F3.md
        - provider: codex
          receiptPath: .atomic-skills/reviews/2026-08-04-codex-audit-delivery-hardening-F3.md
    decisionReview:
      status: passed
      verifiedAt: 2026-08-04T15:21:30.447Z
      packagePresentedAt: 2026-08-04T15:21:30.447Z
      packagePath: .atomic-skills/reviews/decision-package-audit-delivery-hardening-F3.md
    deliveryAuditGate:
      status: passed
      reportPath: .atomic-skills/reviews/audit-delivery-audit-delivery-hardening-F3.md
      verdict: CLOSED
      verifiedAt: 2026-08-04T15:21:30.447Z
      at: 69ee6e72a34bf6d64f18f5497d3997aa6a49f9ce
  - id: F4
    slug: audit-delivery-hardening-f4-p2-advanced-dogfood
    title: P2 advanced + dogfood close
    summary: Prosecution, critic, dual reaudit, fix recipe, optional cross, BI import
    goal: Optional power-user topology and fix composition without making every run heavy; dogfood checklist locks false-CLOSED modes and the non-skippable phase-done hard-gate (already shipped in F2).
    dependsOn:
      - F3
    subPhaseCount: 0
    status: done
    businessIntent:
      value: Large rewrites get prosecution + dual reaudit + optional cross residual; fix path is a documented recipe; dogfood proves false-CLOSED and skip-audit stay closed.
      workflow: prosecution axis; full-depth critic; dual reaudit; fix-composition recipe; optional --cross; BI import + dogfood-checklist.md (includes deliveryAuditGate never-skip).
      rules: Advanced features default off or full-depth only; never replace residual protocol; never reintroduce skip on phase delivery audit.
      outOfScope: Dashboard UI for reports; machine Accept Record schema validator beyond markdown; auto leg in project review composer.
      doneWhen: Recipe + dogfood checklist (with hard-gate row) exist; advanced flags documented; validate-skills + asset test still green.
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-F4-1
          description: P2 docs/assets + dogfood hard-gate + tests green
          status: met
          verifier:
            kind: shell
            command: npm run validate-skills && node --test tests/audit-delivery-assets.test.js && test -f .atomic-skills/projects/atomic-skills/audit-delivery-hardening/dogfood-checklist.md && rg -q 'deliveryAuditGate|never skip|hard-gate' .atomic-skills/projects/atomic-skills/audit-delivery-hardening/dogfood-checklist.md && test -f skills/shared/audit-delivery-assets/fix-composition-recipe.md
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-08-04T15:32:55.253Z
            passed: true
            exitCode: 0
            verifiedCommit: 85e0f2786d1f9f24be1904ffae64623f0ee89df3
            outputSummary: G-F4-1
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-audit-delivery-hardening-F4.md
      verifiedAt: 2026-08-04T15:32:55.253Z
      at: 85e0f2786d1f9f24be1904ffae64623f0ee89df3
    lessonsState: none
    noneReason: F4 clean last phase
    reviewGate:
      status: passed
      mode: both
      at: 85e0f2786d1f9f24be1904ffae64623f0ee89df3
      verifiedAt: 2026-08-04T15:32:55.253Z
      reviewFile: .atomic-skills/reviews/2026-08-04-both-audit-delivery-hardening-F4.md
      localReceiptPath: .atomic-skills/reviews/2026-08-04-local-audit-delivery-hardening-F4.md
      codexReceiptPath: .atomic-skills/reviews/2026-08-04-codex-audit-delivery-hardening-F4.md
      legs:
        - provider: local
          receiptPath: .atomic-skills/reviews/2026-08-04-local-audit-delivery-hardening-F4.md
        - provider: codex
          receiptPath: .atomic-skills/reviews/2026-08-04-codex-audit-delivery-hardening-F4.md
    decisionReview:
      status: passed
      verifiedAt: 2026-08-04T15:32:55.253Z
      packagePresentedAt: 2026-08-04T15:32:55.253Z
      packagePath: .atomic-skills/reviews/decision-package-audit-delivery-hardening-F4.md
    deliveryAuditGate:
      status: passed
      reportPath: .atomic-skills/reviews/audit-delivery-audit-delivery-hardening-F4.md
      verdict: CLOSED
      verifiedAt: 2026-08-04T15:32:55.253Z
      at: 85e0f2786d1f9f24be1904ffae64623f0ee89df3
planActive: true
planTitle: audit-delivery hardening — P0 craft + teeth, P1 evidence, P2 advanced
---

# audit-delivery hardening

Design summary: **[design.md](./design.md)**.  
Human narrative / expanded acceptance: **[docs/plans/audit-delivery-hardening.md](../../../../docs/plans/audit-delivery-hardening.md)**.

## SSOT (alignment — review-plan 2026-08-04)

| Surface | Authority |
|---------|-----------|
| **F0 tasks + verifiers** | Materialized initiative `phases/audit-delivery-hardening-f0-p0-craft-foundation.md` |
| **F1–F4 tasks + verifiers (pre-materialize)** | `phases/*.source.json` (what `project materialize` consumes) |
| **docs/plans/audit-delivery-hardening.md`** | Human-readable mirror only — must stay lockstep with initiative/sidecars; **not** the materialize input |
| **This plan.md frontmatter** | Phase goals, BI, exit gates, ordering |

**Do not** implement F1–F4 from the docs plan alone if a sidecar exists — materialize first, then implement the initiative.

## Phase ↔ priority map

| Phase | Bundle | Tasks (plan ids) |
|-------|--------|------------------|
| **F0** | P0 craft | T-001 … T-005 |
| **F1** | P0 teeth | T-006 … T-010 |
| **F2** | P1 evidence + ecosystem + hard-gate | T-011 … T-017 |
| **F3** | P1 thin body + guards | T-018 … T-021 |
| **F4** | P2 advanced + dogfood | T-022 … T-027 |

## F0 tasks (summary — initiative is SSOT)

| ID | Title | Gate contribution |
|----|-------|-------------------|
| T-001 | EN-only enums + drop hard PT | EN SSOT / no PT present-rule |
| T-002 | Parse-args-first HARD step | craft |
| T-003 | Wire existing assets | axis + reaudit brief templates in body |
| T-004 | Reaudit entry path | `reaudit-entry.md` + mode table |
| T-005 | Catalog argument_hint + RO clarity | `validate-skills` + catalog |

**Verifier polarity (T-001 / G-F0-1):** absence checks MUST use fail-on-match (`! rg -q '…'`). The pattern `rg … \|\| test $? -eq 1` is **wrong** when matches exist (false green). **Fixed 2026-08-04** on initiative T-001 + G-F0-1 (aligned with plan frontmatter).

## Review-plan findings applied (local 2026-08-04)

1. **Critical:** T-001-style verifiers inverted — G-F0-1 + initiative T-001 now use `! rg -q` + required asset wires.
2. **Significant:** Dual narrative SSOT (docs plan vs sidecars) resolved by SSOT table above.
3. **Significant:** F2 exit gate omitted must-not / Matrix C — gate greps must-not.
4. **Minor:** docs plan baseline “AS project plan: none” stale — mirror updated.
5. **Minor:** F1–F4 intentionally descriptor-only (`subPhaseCount: 0` + sidecars).

## Next action

1. Drive **F0** with `atomic-skills:implement` (or manual T-001…T-005).
2. After F0 exit gate: `phase-done` → materialize F1 from sidecar.
3. Prefer `review-code` on skill diffs after F1 and F3.

## Ground-truth review

**Status:** complete-with-findings
**Codebase class:** populated
**Scanned:** skills/core/, skills/shared/audit-delivery-assets/, meta/catalog.yaml, docs/skills/, scripts/validate-skills.js, src/render.js, tests/skill-byte-budget.test.js, skills/shared/implement-automate-maestro.md → premises re-verified 2026-08-04 implement entry; create-targets still absent for F1+ (intent-package, residual-hunt-protocol, verdict-gate)
**Commit:** b899f49b | uncommitted plan/initiative/skill WIP
**At:** 2026-08-04T14:48:32Z

### A — Plan premises vs code

| # | Premise | Result | Evidence |
|---|---------|--------|----------|
| 1 | WIP skill body exists | ok | `skills/core/audit-delivery.md` (15k; PT enums still present — F0 work) |
| 2 | axis-brief-template exists | ok | `skills/shared/audit-delivery-assets/axis-brief-template.md` |
| 3 | reaudit-brief-template exists | ok | `skills/shared/audit-delivery-assets/reaudit-brief-template.md` |
| 4 | catalog entry `audit-delivery` exists | ok | `meta/catalog.yaml:1060` |
| 5 | review-code cross-link when_not/related | ok | `docs/skills/review-code.md`; catalog `:229,:239` |
| 6 | `npm run validate-skills` script exists | ok | `package.json` → `scripts/validate-skills.js` |
| 7 | sibling skills exist (implement, verify-claim, parallel-dispatch, fix, review-plan) | ok | `skills/core/{implement,verify-claim,parallel-dispatch,fix,review-plan}.md` |
| 8 | EN-only policy memory exists | ok | `.ai/memory/decisao-skills-en-only.md` |
| 9 | code-quality-gates KB exists | ok | `docs/kb/code-quality-gates.md` |
| 10 | ASSETS_PATH rewrite for `skills/shared/*-assets/` | ok | `src/render.js:32-33` |
| 11 | Create targets not yet present (reaudit-entry, intent-package, residual protocols) | ok | shell: `reaudit-entry.md` ABSENT; `intent-package.md` ABSENT |
| 12 | plan-end lifecycle `intentVsDelivered` exists (collision surface) | ok | `skills/shared/implement-automate-maestro.md:136` + `skills/core/implement.md:31` |

### B — Code present, plan silent (impact candidates)

| # | Finding | Location | Impact | Disposition |
|---|---------|----------|--------|-------------|
| 1 | WIP skill still PT enums + `Present in Portuguese` + full Phase 4 `audit-and-fix` | `skills/core/audit-delivery.md` | direct | **F0 T-001** (EN) + **F1 T-010** (demote fix path) |
| 2 | Catalog examples still showcase `--mode=audit-and-fix` as primary | `meta/catalog.yaml` audit-delivery block | direct | **F1 T-010** / **F0 T-005** RO default + examples |
| 3 | plan-end `intentVsDelivered` shares product language with this skill | `implement-automate-maestro.md` Step I | direct | **F2 T-016** catalog disambiguation + **T-017** hard deliveryAuditGate (never skip) |
| 4 | `version_added: 2.4.0` while package is `2.0.0` | catalog + package.json | indirect | **accepted** — plan non-goal; align at publish |
| 5 | `tests/skill-byte-budget.test.js` has no ceiling for `audit-delivery.md` | `tests/skill-byte-budget.test.js` | indirect | **F3** thin body; optional add ceiling if re-growth risk |
| 6 | dogfood-checklist.md already stubbed under plan tree | `…/dogfood-checklist.md` | none | **accepted** — F4 T-026 refreshes content; early stub OK |
| 7 | Install auto-stages shared `*-assets/` via render path rewrite | `src/render.js` | indirect | **accepted** — no separate install task required |

**Counts:** premises=12 (missing=0, false=0); impacts=7 (direct=3, indirect=3, none=1)

## Reviews

- internal: 6 finding(s) applied (plan) + initiative T-001/G-F0-1 fixed @ b899f49b (2026-08-04T12:05:08Z)
- cross-model (codex): needs_changes (resolved on plan gates F-002..F-005; F-001 initiative polarity fixed 2026-08-04) — .atomic-skills/reviews/2026-08-04-codex-audit-delivery-hardening-plan.md
- ground-truth: complete-with-findings | mode=ground-truth | fp=cefc65d5f80a | premises=12 | impacts=7 @ uncommitted (2026-08-04T15:21:55.387Z)
