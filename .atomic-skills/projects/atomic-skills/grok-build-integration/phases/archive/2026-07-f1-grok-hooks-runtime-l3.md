---
schemaVersion: "0.1"
slug: grok-build-integration-f1-grok-hooks-runtime-l3
title: Grok hooks runtime (L3)
goal: Soft and Strict project hooks plus auto-update register on Grok via plugin
  hooks and user auto-update hook file, with dual-vocabulary matchers.
status: done
branch: plan/grok-build-integration
started: 2026-07-16T14:07:05.000Z
lastUpdated: 2026-07-16T14:29:05.000Z
nextAction: null
parentPlan: grok-build-integration
phaseId: F1
businessIntent:
  value: Atomic Skills installs and runs as a first-class Grok Build plugin
    (skills + hooks), and adversarial review always uses a different model
    family than the host session so self-preference bias is reduced.
  workflow: Install selects grok → plugin package materializes under
    .grok/plugins/atomic-skills → agents invoke skills with correct tool names →
    project Soft/Strict hooks fire on Grok with dual-vocab matchers →
    auto-update SessionStart registers on Grok hook surface.
  rules: Plugin is the only Grok skill root; Soft = SessionStart+PreToolUse and
    Strict adds Stop; dual-vocab matchers accept Grok write tools;
    install/uninstall journal parity; auto-update must not drop Claude when both
    ides selected.
  outOfScope: Cross-model bridge, review-code mode flags, marketplace publish,
    Mode-2 Grok execution.
  doneWhen: "F1 gates green: round-trip hooks reverse; project tests list Grok
    Soft/Strict; session-start/pre-write/stop fixtures pass dual-vocab."
tasksDone: 2
tasksTotal: 2
gatesMet: 3
gatesTotal: 3
weightDone: 2
weightTotal: 2
exitGates:
  - id: G-1
    description: Auto-update and project hook registration for Grok reverse cleanly
      in round-trip tests.
    status: met
    metAt: 2026-07-16T14:29:05.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T14:29:05.000Z
      passed: true
      exitCode: 0
      outputSummary: "phase-done gate re-verified: node --test
        tests/install-uninstall-roundtrip.test.js"
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/install-uninstall-roundtrip.test.js"
    evidenceSummary: passed · 2026-07-16
  - id: G-2
    description: Docs and tests list Grok as a hook-capable host with Soft versus
      Strict semantics.
    status: met
    metAt: 2026-07-16T14:29:05.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T14:29:05.000Z
      passed: true
      exitCode: 0
      outputSummary: "phase-done gate re-verified: node --test tests/project.test.js"
    verifier:
      kind: shell
      command: node --test tests/project.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/project.test.js"
    evidenceSummary: passed · 2026-07-16
  - id: G-3
    description: Fixture-driven Soft and Strict hook dispatch tests pass with
      dual-vocab matchers.
    status: met
    metAt: 2026-07-16T14:29:05.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T14:29:05.000Z
      passed: true
      exitCode: 0
      outputSummary: "phase-done gate re-verified: bash
        tests/hooks/session-start.test.sh && bash"
    verifier:
      kind: shell
      command: bash tests/hooks/session-start.test.sh && bash
        tests/hooks/pre-write.test.sh && bash tests/hooks/stop.test.sh
      expectExitCode: 0
    verifierLabel: "shell: bash tests/hooks/session-start.test.sh && bash tests/hooks/…"
    evidenceSummary: passed · 2026-07-16
stack:
  - id: 1
    title: Grok hooks runtime (L3)
    type: task
    openedAt: 2026-07-16T14:07:05.000Z
tasks:
  - id: T-001
    title: Auto-update runtime layer for Grok
    description: Extend createAutoUpdateRuntimeProvider (or sibling) to stage
      SessionStart version-check into Grok hook surface when grok is installed,
      without removing Claude behavior when both ides are selected.
    status: done
    lastUpdated: 2026-07-16T14:16:33.000Z
    closedAt: 2026-07-16T14:16:33.000Z
    scopeBoundary:
      - do not rewrite project Soft/Strict scripts logic beyond env/tool name
        dual support if required for this task
    acceptance:
      - install with grok adds a Grok auto-update hook registration; uninstall
        removes only Atomic Skills entries; Claude path still works when
        claude-code is selected
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T14:16:33.000Z
      passed: true
      exitCode: 0
      outputSummary: node --test tests/install-uninstall-roundtrip.test.js — 12 pass,
        0 fail, duration_ms 1237
    outputs:
      - kind: file
        path: src/runtime-layers/auto-update.js
      - kind: file
        path: tests/install-uninstall-roundtrip.test.js
      - kind: file
        path: tests/install.test.js
  - id: T-002
    title: Plugin hooks Soft and Strict for project
    description: Fill plugin hooks/hooks.json (and setup docs) for SessionStart,
      PreToolUse (Grok write tools), and optional Stop; update project-setup and
      hooks README to list Grok as a hook host; dual-vocab in pre-write/stop if
      they parse tool names.
    status: done
    lastUpdated: 2026-07-16T14:19:25.000Z
    closedAt: 2026-07-16T14:19:25.000Z
    scopeBoundary:
      - do not implement cross-model bridge or review-code mode flags
    acceptance:
      - README matrices include Grok; Soft setup does not require Stop; matchers
        include search_replace or write; session-start pre-write and stop
        fixtures pass for dual-vocab
    verifier:
      kind: shell
      command: bash tests/hooks/session-start.test.sh && bash
        tests/hooks/pre-write.test.sh && bash tests/hooks/stop.test.sh
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T14:19:25.000Z
      passed: true
      exitCode: 0
      outputSummary: session-start 38 pass; pre-write 76 pass; stop 47 pass;
        project.test.js 59 pass — all exit 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/hooks/README.md
      - kind: file
        path: skills/shared/project-assets/project-setup.md
      - kind: file
        path: skills/shared/project-assets/hooks/pre-write.sh
      - kind: file
        path: skills/shared/project-assets/hooks/stop.sh
      - kind: file
        path: src/providers/skills-file-set.js
      - kind: file
        path: tests/project.test.js
      - kind: file
        path: tests/hooks/session-start.test.sh
      - kind: file
        path: tests/hooks/pre-write.test.sh
      - kind: file
        path: tests/hooks/stop.test.sh
parked: []
emerged: []
planTitle: Grok Build native integration + cross-model review
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Grok hooks runtime (L3)**.

## Session handoff

- **Narrative:** F1 tasks complete. T-001 auto-update Grok SessionStart;
  T-002 Soft plugin hooks + dual-vocab pre-write/stop + setup/README host
  matrix. Ready for phase-done (orchestrator owns G-1..G-3 + archive).
- **Decision log:** F0 F-001 deferred to F2; Grok WRITE stays write;
  auto-update omits SessionStart matcher; plugin ships Soft only (Strict Stop
  merge-only at setup); dual-vocab matcher Edit|Write|MultiEdit|search_replace|write.
- **Single nextAction:** Run `phase-done` for F1 — exit gates G-1..G-3, review-code, archive.
- **Verbatim state:** plan currentPhase=F1; initiative f1-grok-hooks-runtime-l3.md;
  tasksDone=2/2; gatesMet=0/3 (gates owned by phase-done).
- **Uncommitted changes:** none after T-002 checkpoint.

## Phase-done

- Gates met; Codex review `.atomic-skills/reviews/2026-07-16-1428-grok-build-integration-f1-codex.md` at `3f73ee5a155cda8d089cc1531c307376ea35385b`.
