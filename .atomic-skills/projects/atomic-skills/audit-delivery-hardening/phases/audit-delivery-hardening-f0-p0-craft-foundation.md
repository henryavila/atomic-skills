---
schemaVersion: "0.1"
slug: audit-delivery-hardening-f0-p0-craft-foundation
title: P0 craft foundation
goal: Make audit-delivery craft-correct under Atomic Skills conventions so later
  product teeth sit on a body that loads assets, speaks EN SSOT, parses flags
  first, and has a real reaudit entry path.
summary: EN enums, parse-first, wire assets, reaudit entry, catalog args
status: active
branch: develop
started: 2026-08-04T11:51:14Z
lastUpdated: 2026-08-04T12:15:00Z
nextAction: implement F0 tasks T-001 through T-005
parentPlan: audit-delivery-hardening
phaseId: F0
businessIntent:
  value: Operators and agents get a skill source that installs and reads like
    other core skills — no orphan templates, no hardcoded PT output rule,
    reaudit mode that actually loads a prior report.
  workflow: T-001 EN rewrite of body+existing assets; T-002 parse-first step;
    T-003 wire axis/reaudit templates; T-004 reaudit-entry asset + mode table;
    T-005 catalog argument_hint and RO-default clarity; validate-skills.
  rules: No merge into review-code; no product residual protocol invent here (F1);
    version_added may stay aspirational until publish; mutates_repo true stays
    with RO default documented.
  outOfScope: Staged evidence, Matrix C, Spec Package strip, thin-body target line
    count, prosecution axis, fix orchestration rewrite.
  doneWhen: validate-skills green; body references axis-brief + reaudit-entry; no
    Present-in-Portuguese rule; EN status/verdict enums in body and assets.
stack: []
parked: []
emerged: []
tasksDone: 0
tasksTotal: 5
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 5
exitGates:
  - id: G-F0-1
    description: EN SSOT + assets wired + reaudit-entry file + validate-skills
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills && test -f
        skills/shared/audit-delivery-assets/reaudit-entry.md && rg -q
        'axis-brief-template' skills/core/audit-delivery.md && rg -q
        'reaudit-brief-template' skills/core/audit-delivery.md && rg -q
        'reaudit-entry' skills/core/audit-delivery.md && ! rg -q 'Present in
        Portuguese|FECHADO|RESOLVIDO|Reauditoria|Resumo executivo'
        skills/core/audit-delivery.md skills/shared/audit-delivery-assets
      expectExitCode: 0
    verifierLabel: "shell: npm run validate-skills && test -f skills/shared/audit-deli…"
tasks:
  - id: T-001
    title: EN-only enums + drop hard PT language
    status: pending
    lastUpdated: 2026-08-04T12:15:00Z
    scopeBoundary:
      - Do not change product positioning vs review-code.
      - Do not invent PT skill forks.
      - Do not implement residual protocol (F1).
    acceptance:
      - Skill body and assets use RESOLVED|PARTIAL|NO|N/A and
        CLOSED|PARTIAL|OPEN (and REGRESSION on reaudit).
      - No line hardcodes presenting output in Portuguese/Brazilian as skill
        rule.
      - Section headers in templates are English.
    verifier:
      kind: shell
      command: "! rg -q 'Present in Portuguese|FECHADO|RESOLVIDO|Reauditoria|Resumo
        executivo' skills/core/audit-delivery.md
        skills/shared/audit-delivery-assets"
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/audit-delivery.md
      - kind: file
        path: skills/shared/audit-delivery-assets/axis-brief-template.md
      - kind: file
        path: skills/shared/audit-delivery-assets/reaudit-brief-template.md
      - kind: file
        path: docs/skills/audit-delivery.md
      - kind: file
        path: meta/catalog.yaml
  - id: T-002
    title: Parse-args-first HARD step
    status: pending
    lastUpdated: 2026-08-04T11:55:00Z
    scopeBoundary:
      - Do not add a Node CLI unless needed later; prose parse is enough for v1.
    acceptance:
      - Step 0 parses ARG_VAR into mode/axes/out/depth/flags before any Intent
        Package file read or report write.
      - Documented accepted flags match catalog args.
    verifier:
      kind: shell
      command: rg -n 'Parse.*ARG_VAR|BEFORE any|parse.*before'
        skills/core/audit-delivery.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/audit-delivery.md
  - id: T-003
    title: Wire existing assets + ASSETS index
    status: pending
    lastUpdated: 2026-08-04T11:55:00Z
    scopeBoundary:
      - Do not invent full checklist tree yet (F3); must load the two existing
        templates at the correct phases.
    acceptance:
      - Body contains READ_TOOL or ASSETS_PATH references to both templates.
      - Phase 2 spawn and reaudit/re-run instruct filling those templates.
    verifier:
      kind: shell
      command: rg -n 'axis-brief-template|reaudit-brief-template|ASSETS_PATH'
        skills/core/audit-delivery.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/audit-delivery.md
  - id: T-004
    title: Reaudit entry path
    status: pending
    lastUpdated: 2026-08-04T11:55:00Z
    scopeBoundary:
      - Full dual residual-blind reaudit is F4; F0 only documents load-report
        recover package reaudit append.
    acceptance:
      - Mode table includes reaudit entry requiring --out or report path,
        read-only product tree, report append.
      - Asset reaudit-entry.md exists and is READ at reaudit entry.
    verifier:
      kind: shell
      command: test -f skills/shared/audit-delivery-assets/reaudit-entry.md && rg -n
        'reaudit-entry|mode=reaudit|--out' skills/core/audit-delivery.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/audit-delivery-assets/reaudit-entry.md
      - kind: file
        path: skills/core/audit-delivery.md
  - id: T-005
    title: Catalog argument_hint + mode docs
    status: pending
    lastUpdated: 2026-08-04T11:55:00Z
    scopeBoundary:
      - Do not change skill count schema; keep mutates_repo true but clarify RO
        default in description.
    acceptance:
      - argument_hint includes --out and mode flags within length budget.
      - Description/examples state default is read-only.
      - npm run validate-skills exits 0.
    verifier:
      kind: shell
      command: npm run validate-skills && rg -n
        'argument_hint|read-only|audit-and-fix' meta/catalog.yaml
      expectExitCode: 0
    outputs:
      - kind: file
        path: meta/catalog.yaml
      - kind: file
        path: docs/skills/audit-delivery.md
planTitle: audit-delivery hardening — P0 craft + teeth, P1 evidence, P2 advanced
planActive: true
current: true
---

# F0 — P0 craft foundation

Canonical detail: `docs/plans/audit-delivery-hardening.md` § F0.

Drive with `atomic-skills:implement`.

## Session handoff
- **Narrative:** Pure-maestro implement of audit-delivery-hardening on develop. Ground-truth fresh (fp=2ccd6be13dae). executionMode: automate stamped. F0 phase-start package ratified under operator-delegated operational authority. Next: spawn F0 phase writer for T-001…T-005.
- **Decision log:** Use AS inventory (not foreign lane). Durable automate stamp. F0 BI package ratified as-is (no BI edits).
- **Single nextAction:** Run assert-automate-gate --gate spawn, automate-phase-run prepare, spawn F0 phase writer.
- **Verbatim state:** plan=.atomic-skills/projects/atomic-skills/audit-delivery-hardening/plan.md; phase=F0; branch=develop; cursor step=B; PKG_ROOT via $HOME/.atomic-skills/package-root
- **Uncommitted changes:** plan.md executionMode stamp + handoff; unrelated automate-writer-runtime refresh-state noise may remain dirty.
