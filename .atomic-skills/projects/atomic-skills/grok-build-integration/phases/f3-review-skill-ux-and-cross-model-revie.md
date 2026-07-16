---
schemaVersion: "0.1"
slug: grok-build-integration-f3-review-skill-ux-and-cross-model-revie
title: Review skill UX and CROSS-MODEL REVIEW surfaces
goal: review-code and review-plan expose provider modes; product cadence uses
  CROSS-MODEL REVIEW with provider field; review-due and gates stop hardcoding
  Codex-only.
status: active
branch: plan/grok-build-integration
started: 2026-07-16T14:46:44.000Z
lastUpdated: 2026-07-16T15:50:00.000Z
nextAction: "Orchestrator: phase-done (G-1..G-3 + CROSS-MODEL REVIEW + advance F4)"
parentPlan: grok-build-integration
phaseId: F3
businessIntent:
  value: Atomic Skills installs and runs as a first-class Grok Build plugin
    (skills + hooks), and adversarial review always uses a different model
    family than the host session so self-preference bias is reduced.
  workflow: review-code/plan pick host-aware external provider with CROSS-MODEL
    REVIEW cadence and provider field.
  rules: Host is never the external reviewer without same-family confirm→local;
    CROSS-MODEL REVIEW replaces CODEX REVIEW product label; provider enum
    codex|grok|local.
  outOfScope: external-both merge (F5), marketplace, Mode-2 Grok execution.
  doneWhen: "F3 gates green: validate-skills, no CODEX REVIEW product strings,
    provider field round-trip."
tasksDone: 3
tasksTotal: 3
gatesMet: 0
gatesTotal: 3
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-1
    description: validate-skills passes with updated review-code and review-plan modes.
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills
      expectExitCode: 0
    verifierLabel: "shell: npm run validate-skills"
  - id: G-2
    description: Active skill assets contain zero user-facing CODEX REVIEW product
      label strings.
    status: pending
    verifier:
      kind: shell
      command: "! rg -n 'CODEX REVIEW' skills/shared/project-assets skills/core"
      expectExitCode: 0
    verifierLabel: "shell: ! rg -n 'CODEX REVIEW' skills/shared/project-assets skills/…"
  - id: G-3
    description: Provider field enum and round-trip tests cover review receipts and
      review-due readers.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/review-provider-field.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/review-provider-field.test.js"
stack:
  - id: 1
    title: Review skill UX and CROSS-MODEL REVIEW surfaces
    type: task
    openedAt: 2026-07-16T14:46:44.000Z
tasks:
  - id: T-001
    title: review-code and review-plan modes
    description: Add modes grok, both-codex, both-grok, external-both wiring; Step 0
      picker host-aware; both uses host external default; same-family
      interactive confirm and non-interactive abort/accept-as-local.
    scopeBoundary:
      - do not implement external-both findings merge algorithm beyond calling
        two providers sequentially if already specified; full merge UI can
        complete in F5
    acceptance:
      - skill bodies document modes, host defaults, and same-family
        non-interactive rules; validate-skills passes; byte budget within limits
        or updated deliberately
    verifier:
      kind: shell
      command: npm run validate-skills && node --test tests/skill-byte-budget.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T15:20:00.000Z
      passed: true
      exitCode: 0
      outputSummary: validate-skills ✓ All 15 skills valid; skill-byte-budget 8 pass
        (review-code 18502/20000, review-plan 23589/24000); install.test.js
        footprints +1 for review-mode-ux.md
    outputs:
      - kind: file
        path: skills/core/review-code.md
      - kind: file
        path: skills/core/review-plan.md
      - kind: file
        path: docs/kb/cross-model-review-design.md
      - kind: file
        path: skills/shared/codex-bridge-assets/review-mode-ux.md
      - kind: file
        path: tests/install.test.js
      - kind: file
        path: tests/skill-byte-budget.test.js
    status: done
    lastUpdated: 2026-07-16T15:20:00.000Z
    closedAt: 2026-07-16T15:20:00.000Z
  - id: T-002
    title: Rename CODEX REVIEW to CROSS-MODEL REVIEW
    description: Update project-drift, project-view, project-verify, last-review
      schema or writers, index templates to CROSS-MODEL REVIEW with provider
      field; migration note for old INDEX rows.
    scopeBoundary:
      - do not change aiDeck widget layout beyond string labels if any
    acceptance:
      - zero user-facing CODEX REVIEW strings in active skill assets; provider
        field appears in review file template
    verifier:
      kind: shell
      command: "! rg -n 'CODEX REVIEW' skills/shared/project-assets skills/core"
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T15:35:00.000Z
      passed: true
      exitCode: 0
      outputSummary: zero CODEX REVIEW in skills/shared/project-assets skills/core;
        review-file-template provider + provider_version; INDEX Provider column
        + migration note; last-review example includes provider enum
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-drift.md
      - kind: file
        path: skills/shared/project-assets/project-view.md
      - kind: file
        path: skills/shared/project-assets/project-verify.md
      - kind: file
        path: skills/shared/codex-bridge-assets/review-file-template.txt
      - kind: file
        path: skills/shared/codex-bridge-assets/index-row-template.txt
      - kind: file
        path: skills/core/project.md
    status: done
    lastUpdated: 2026-07-16T15:35:00.000Z
    closedAt: 2026-07-16T15:35:00.000Z
  - id: T-003
    title: review-due and provider field persistence
    description: Replace hardcoded --mode=codex in project-create-plan and
      project-drift review-due with host external default; specify provider enum
      codex|grok|local plus version; round-trip test for writers/readers.
    scopeBoundary:
      - do not change decompose or materialize code
    acceptance:
      - assets use host-default language; provider field round-trip test passes;
        same-family remap never writes provider codex/grok for a same-family run
    verifier:
      kind: shell
      command: node --test tests/review-provider-field.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T15:50:00.000Z
      passed: true
      exitCode: 0
      outputSummary: review-provider-field.test.js 11 pass; review-due/create-plan
        use hostDefaultExternalMode; buildProviderFields forces local on
        sameFamilyRemap; no CODEX REVIEW product strings remain
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
      - kind: file
        path: skills/shared/project-assets/project-drift.md
      - kind: file
        path: skills/shared/project-assets/project-review.md
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/codex-bridge-assets/review-file-template.txt
      - kind: file
        path: src/review-provider-field.js
      - kind: file
        path: tests/review-provider-field.test.js
    status: done
    lastUpdated: 2026-07-16T15:50:00.000Z
    closedAt: 2026-07-16T15:50:00.000Z
parked: []
emerged: []
planTitle: Grok Build native integration + cross-model review
planActive: true
current: true
---

# F3 initiative

## Session handoff
- **Narrative:** F3 tasks T-001..T-003 complete. Multi-provider modes,
  CROSS-MODEL REVIEW product label, host-default review-due, provider field
  round-trip. Exit gates G-1..G-3 are for phase-done (orchestrator). Do **not**
  run phase-done here.
- **Decision log:** external-both sequential only (merge in F5); review-due uses
  hostDefaultExternalMode not hardcoded codex; sameFamilyRemap → provider:local.
- **Single nextAction:** Orchestrator runs phase-done (G-1..G-3 + CROSS-MODEL
  REVIEW + advance F4).
- **Uncommitted changes:** none after T-003 checkpoint.
