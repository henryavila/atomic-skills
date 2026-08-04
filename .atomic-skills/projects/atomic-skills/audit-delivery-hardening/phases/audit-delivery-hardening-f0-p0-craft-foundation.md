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
lastUpdated: 2026-08-04T14:33:10.587Z
nextAction: Run evaluation agent then phase-done for F0
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
tasksDone: 5
tasksTotal: 5
gatesMet: 0
gatesTotal: 1
weightDone: 5
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
    status: done
    lastUpdated: 2026-08-04T14:33:10.587Z
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
    closedAt: 2026-08-04T14:33:10.587Z
    evidence:
      passed: true
      exitCode: 0
      command: "! rg -q 'Present in Portuguese|FECHADO|RESOLVIDO|Reauditoria|Resumo
        executivo' skills/core/audit-delivery.md
        skills/shared/audit-delivery-assets"
      verifiedAt: 2026-08-04T14:33:10.587Z
      verifiedCommit: b6c33f2d84922137afc34bfdf1501d257f6c1147
      closeFingerprint: b6c33f2d84922137afc34bfdf1501d257f6c1147
      outputSummary: "EN SSOT: RESOLVED|PARTIAL|NO|N/A and CLOSED|PARTIAL|OPEN
        (+REGRESSION on reaudit). Removed Present-in-Portuguese rule; English
        template headers. rg banned strings: no matches; exit 0."
  - id: T-002
    title: Parse-args-first HARD step
    status: done
    lastUpdated: 2026-08-04T14:33:10.587Z
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
    closedAt: 2026-08-04T14:33:10.587Z
    evidence:
      passed: true
      exitCode: 0
      command: rg -n 'Parse.*ARG_VAR|BEFORE any|parse.*before'
        skills/core/audit-delivery.md
      verifiedAt: 2026-08-04T14:33:10.587Z
      verifiedCommit: b6c33f2d84922137afc34bfdf1501d257f6c1147
      closeFingerprint: b6c33f2d84922137afc34bfdf1501d257f6c1147
      outputSummary: "Step 0 HARD added: Parse {{ARG_VAR}} into
        mode/axes/out/depth/flags BEFORE any Intent Package file read or report
        write. Flags match catalog. rg matched L3/L5; exit 0."
  - id: T-003
    title: Wire existing assets + ASSETS index
    status: done
    lastUpdated: 2026-08-04T14:33:10.587Z
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
    closedAt: 2026-08-04T14:33:10.587Z
    evidence:
      passed: true
      exitCode: 0
      command: rg -n 'axis-brief-template|reaudit-brief-template|ASSETS_PATH'
        skills/core/audit-delivery.md
      verifiedAt: 2026-08-04T14:33:10.587Z
      verifiedCommit: b6c33f2d84922137afc34bfdf1501d257f6c1147
      closeFingerprint: b6c33f2d84922137afc34bfdf1501d257f6c1147
      outputSummary: Assets index + Phase 2 fills axis-brief-template; Phase 5 fills
        reaudit-brief-template via {{READ_TOOL}} {{ASSETS_PATH}}. rg matched
        multiple lines; exit 0.
  - id: T-004
    title: Reaudit entry path
    status: done
    lastUpdated: 2026-08-04T14:33:10.587Z
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
    closedAt: 2026-08-04T14:33:10.587Z
    evidence:
      passed: true
      exitCode: 0
      command: test -f skills/shared/audit-delivery-assets/reaudit-entry.md && rg -n
        'reaudit-entry|mode=reaudit|--out' skills/core/audit-delivery.md
      verifiedAt: 2026-08-04T14:33:10.587Z
      verifiedCommit: b6c33f2d84922137afc34bfdf1501d257f6c1147
      closeFingerprint: b6c33f2d84922137afc34bfdf1501d257f6c1147
      outputSummary: Created reaudit-entry.md (load report, recover package,
        append-only, --out required, RO product tree). Mode table + Phase 0
        branch for mode=reaudit. File exists; rg matches; exit 0.
  - id: T-005
    title: Catalog argument_hint + mode docs
    status: done
    lastUpdated: 2026-08-04T14:33:10.587Z
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
    closedAt: 2026-08-04T14:33:10.587Z
    evidence:
      passed: true
      exitCode: 0
      command: npm run validate-skills && rg -n
        'argument_hint|read-only|audit-and-fix' meta/catalog.yaml
      verifiedAt: 2026-08-04T14:33:10.587Z
      verifiedCommit: b6c33f2d84922137afc34bfdf1501d257f6c1147
      closeFingerprint: b6c33f2d84922137afc34bfdf1501d257f6c1147
      outputSummary: "argument_hint (108 chars) includes --mode flags, --no-fix,
        --out=path. Description/examples state default read-only; mutates_repo
        true retained. npm run validate-skills: All 16 skills valid. Follow-up
        commit synced docs/skills from husky generate-docs. exit 0."
planTitle: audit-delivery hardening — P0 craft + teeth, P1 evidence, P2 advanced
planActive: true
current: true
---

# F0 — P0 craft foundation

Canonical detail: `docs/plans/audit-delivery-hardening.md` § F0.

Drive with `atomic-skills:implement`.

## Session handoff
- **Narrative:** F0 T-001..T-005 closed on merged develop after post-merge re-verify. Phase writer merged; claim-bound assert done passed. Awaiting evaluation + lessons + review-code both + phase-done.
- **Decision log:** Automate stamp; F0 package ratify; claim report exclusivity fixed (drop shared base/head); catalog.json added to T-005 claim paths for product fence.
- **Single nextAction:** Spawn F0 evaluation agent; stamp evaluationGate; distill lessons; review-code --mode=both; assert phase-done; terminal phase-done.
- **Verbatim state:** HEAD=b6c33f2d84922137afc34bfdf1501d257f6c1147; claim=`.atomic-skills/status/automate/audit-delivery-hardening-claims.json`; baseRef=8a2b43f1; exit gate G-F0-1 exit 0 on merged tree.
- **Uncommitted changes:** initiative close dirty until checkpoint commit.

