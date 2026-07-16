---
schemaVersion: "0.1"
slug: grok-build-integration-f2-cross-model-bridge-core-l7
title: cross-model-bridge core (L7)
goal: Rename or alias codex-bridge to cross-model-bridge with pluggable codex
  and grok providers, host default matrix, same-family confirm-to-local
  (interactive) and HARD ABORT or --accept-same-family-as-local
  (non-interactive).
status: active
branch: plan/grok-build-integration
started: 2026-07-16T14:29:05.000Z
lastUpdated: 2026-07-16T14:29:05.000Z
nextAction: "Start T-001: Module layout and codex-bridge alias"
parentPlan: grok-build-integration
phaseId: F2
businessIntent:
  value: Atomic Skills installs and runs as a first-class Grok Build plugin
    (skills + hooks), and adversarial review always uses a different model
    family than the host session so self-preference bias is reduced.
  workflow: Install selects grok → plugin package → skills with correct tools →
    host-aware external review (Codex/Grok) with sealed envelope → CROSS-MODEL
    REVIEW tracks cadence with provider field.
  rules: Plugin is the only Grok skill root; host is never the external reviewer
    without same-family confirm→local; install/uninstall parity; tool vars not
    hardcoded Claude names.
  outOfScope: Marketplace publish, MCP project-state server, Mode-2 execution via
    Grok, auto-apply external findings without human triage.
  doneWhen: Phase F2 exit gates green with deterministic verifiers.
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 3
weightDone: 0
weightTotal: 3
exitGates:
  - id: G-1
    description: cross-model-bridge module validates and codex alias remains installable.
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills
      expectExitCode: 0
    verifierLabel: "shell: npm run validate-skills"
  - id: G-2
    description: Grok invocation and host-default assets encode matrix and
      same-family interactive plus non-interactive rules.
    status: pending
    verifier:
      kind: shell
      command: test -s
        skills/shared/codex-bridge-assets/providers/grok/invocation-canonical.txt
        && grep -E 'same-family|accept-same-family-as-local|HARD ABORT'
        skills/shared/codex-bridge-assets/host-default-external.md
      expectExitCode: 0
    verifierLabel: "shell: test -s skills/shared/codex-bridge-assets/providers/grok/in…"
  - id: G-3
    description: Pure host-default and same-family routing helper unit tests pass
      for every matrix row.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/cross-model-host-default.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/cross-model-host-default.test.js"
stack:
  - id: 1
    title: cross-model-bridge core (L7)
    type: task
    openedAt: 2026-07-16T14:29:05.000Z
tasks:
  - id: T-001
    title: Module layout and codex-bridge alias
    description: Introduce skills/modules/cross-model-bridge and shared
      cross-model-review-assets (or restructure codex-bridge-assets) with
      providers/codex and providers/grok; keep codex-bridge as compatibility
      alias in catalog and install.
    status: pending
    lastUpdated: 2026-07-16T14:29:05.000Z
    scopeBoundary:
      - do not change review-code or review-plan mode UX in this task beyond
        asset path references if required
    acceptance:
      - validate-skills and catalog resolve cross-model-bridge; codex provider
        assets still load; no broken ASSETS_PATH references in envelope
        orchestration
    verifier:
      kind: shell
      command: node --test tests/validate-skills.test.js && npm run validate-skills
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/modules/cross-model-bridge/module.yaml
      - kind: file
        path: skills/modules/codex-bridge/module.yaml
      - kind: file
        path: skills/shared/codex-bridge-assets/envelope-orchestration.md
      - kind: file
        path: meta/catalog.yaml
      - kind: file
        path: tests/validate-skills.test.js
  - id: T-002
    title: Grok provider preflight and invocation
    description: Add providers/grok preflight-checks and invocation-canonical proven
      against installed grok CLI; portable timeout; read-only sandbox; capture
      output file; document locked flags.
    status: pending
    lastUpdated: 2026-07-16T14:29:05.000Z
    scopeBoundary:
      - do not implement external-both merge or rename CROSS-MODEL REVIEW
        product line in this task
    acceptance:
      - preflight documents which grok and auth failure messages; invocation
        uses timeout wrapper and non-interactive flags; fixture or test asserts
        required flags appear in the canonical file
    verifier:
      kind: shell
      command: test -s
        skills/shared/codex-bridge-assets/providers/grok/invocation-canonical.txt
        && grep -E 'grok|sandbox|timeout'
        skills/shared/codex-bridge-assets/providers/grok/invocation-canonical.txt
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/codex-bridge-assets/providers/grok/preflight-checks.txt
      - kind: file
        path: skills/shared/codex-bridge-assets/providers/grok/invocation-canonical.txt
      - kind: file
        path: tests/fixtures
      - kind: file
        path: scripts or tests that smoke the invocation shape if present
  - id: T-003
    title: Envelope orchestration parameterized by provider and host matrix
    description: Update envelope-orchestration to bind provider preflight and
      invocation; document host default external matrix and same-family
      interactive confirm plus non-interactive abort/accept-as-local; extract
      pure host-default helper with unit tests.
    status: pending
    lastUpdated: 2026-07-16T14:29:05.000Z
    scopeBoundary:
      - do not rewrite full review-plan body modes list until F3
    acceptance:
      - orchestration steps name PROVIDER slots; host-default-external.md
        encodes matrix plus HARD ABORT and --accept-same-family-as-local; unit
        tests cover every host row and non-interactive branches
    verifier:
      kind: shell
      command: node --test tests/cross-model-host-default.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/codex-bridge-assets/envelope-orchestration.md
      - kind: file
        path: skills/shared/codex-bridge-assets/host-default-external.md
      - kind: file
        path: src/cross-model-host-default.js
      - kind: file
        path: tests/cross-model-host-default.test.js
parked: []
emerged: []
planTitle: Grok Build native integration + cross-model review
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F2 — cross-model-bridge core (L7)**.

## Session handoff

- **Narrative:** Previous phase archived. F2 active.
- **Single nextAction:** Start T-001.
- **Uncommitted changes:** phase advance checkpoint next
