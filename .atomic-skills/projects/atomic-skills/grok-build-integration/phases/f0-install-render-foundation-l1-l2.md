---
schemaVersion: "0.1"
slug: grok-build-integration-f0-install-render-foundation-l1-l2
title: Install + render foundation (L1+L2)
goal: Grok is a first-class install IDE that materializes only the plugin
  package with correct tool names for Grok and Codex renders.
status: active
branch: plan/grok-build-integration
started: 2026-07-16T13:00:21.670Z
lastUpdated: 2026-07-16T13:49:36.000Z
nextAction: "Start T-002: Render tool profiles for grok and codex (src/render.js + tests/render.test.js + docs/kb/grok-build-compatibility.md)"
parentPlan: grok-build-integration
phaseId: F0
businessIntent:
  value: Atomic Skills installs and runs as a first-class Grok Build plugin
    (skills + hooks), and adversarial review always uses a different model
    family than the host session so self-preference bias is reduced.
  workflow: Install selects grok → plugin package materializes under
    .grok/plugins/atomic-skills → agents invoke skills with correct tool names →
    review-code/plan pick host-aware external provider (Codex or Grok) with
    sealed two-pass envelope → CROSS-MODEL REVIEW tracks cadence with provider
    field.
  rules: Plugin is the only Grok skill root; host is never the external reviewer
    without same-family confirm→local (or non-interactive
    --accept-same-family-as-local); codex-bridge aliases to cross-model-bridge;
    install/uninstall journal parity; skill bodies use defined tool variables
    not hardcoded Claude names.
  outOfScope: Marketplace publish, MCP project-state server, Mode-2 execution via
    Grok, redesign of sealed-envelope science, auto-apply of external findings
    without human triage.
  doneWhen: F0 install+render plugin tree green with tool maps; F1 hooks
    Soft/Strict on Grok; F2 providers smoke; F3 CROSS-MODEL REVIEW UX; F4 plugin
    harden; F5 external-both + final suites green.
tasksDone: 1
tasksTotal: 3
gatesMet: 0
gatesTotal: 3
weightDone: 1
weightTotal: 3
exitGates:
  - id: G-1
    description: IDE_CONFIG and detect include grok with plugin delivery shape and
      assets path under the plugin package.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/config.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/config.test.js"
  - id: G-2
    description: Render snapshots lock grok and codex tool profiles without Claude
      default names for those ides.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/render.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/render.test.js"
  - id: G-3
    description: Install/uninstall round-trip for grok plugin tree is clean and
      forbids dual .grok/skills/atomic-skills tree.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/install-uninstall-roundtrip.test.js"
stack:
  - id: 1
    title: Install + render foundation (L1+L2)
    type: task
    openedAt: 2026-07-16T13:00:21.670Z
tasks:
  - id: T-001
    title: Add IDE_CONFIG and detect for grok plugin delivery
    description: "Add `grok` to IDE_CONFIG with plugin delivery shape (`dir` under
      `.grok/plugins/atomic-skills/skills`, `delivery: 'plugin'`, filePattern
      without nested namespace), IDE_DETECT_DIRS, PUBLIC_IDE_IDS, and
      getAssetsDir special-case for plugin `_assets`."
    status: done
    lastUpdated: 2026-07-16T13:49:36.000Z
    closedAt: 2026-07-16T13:49:36.000Z
    scopeBoundary:
      - do not implement full plugin journal effects or hooks Soft/Strict in
        this task
    acceptance:
      - detectIDEs and IDE_CONFIG expose grok; getAssetsDir('grok') resolves to
        the plugin _assets path; no skill path under .grok/skills/atomic-skills
        is registered
    verifier:
      kind: shell
      command: node --test tests/config.test.js tests/install.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T13:49:36.000Z
      passed: true
      exitCode: 0
      outputSummary: "node --test tests/config.test.js tests/install.test.js — 54 pass, 0 fail, duration_ms 1193"
    outputs:
      - kind: file
        path: src/config.js
      - kind: file
        path: src/detect.js
      - kind: file
        path: tests/install.test.js
      - kind: file
        path: tests/config.test.js
  - id: T-002
    title: Render tool profiles for grok and codex
    description: Extend renderTemplate so ide.grok and ide.codex get non-Claude tool
      maps (Grok provisional map from design D2; Codex map appropriate to Codex
      CLI tools). Add snapshot or unit tests locking the map.
    status: pending
    lastUpdated: 2026-07-16T13:00:21.670Z
    scopeBoundary:
      - do not change skill source bodies except if a test fixture skill is
        required
    acceptance:
      - render for grok substitutes ask_user_question and run_terminal_command
        (or locked ids); render for codex does not emit Read tool or Bash as
        tool names; KB documents the map
    verifier:
      kind: shell
      command: node --test tests/render.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/render.js
      - kind: file
        path: tests/render.test.js
      - kind: file
        path: docs/kb/grok-build-compatibility.md
  - id: T-003
    title: Install materializes Grok plugin package
    description: Wire skills file-set and installer so selecting grok writes
      plugin.json, skills/* /SKILL.md, and _assets under the plugin root only;
      journal records effects; uninstall removes them; assert zero residual
      under .grok/skills/atomic-skills.
    status: pending
    lastUpdated: 2026-07-16T13:00:21.670Z
    scopeBoundary:
      - do not implement Soft/Strict project hooks content beyond empty
        hooks/hooks.json stub; do not touch cross-model review skills
    acceptance:
      - install with ides including grok creates plugin.json and at least one
        SKILL.md under the plugin skills tree; round-trip uninstall restores
        baseline; test asserts no package-owned files under
        .grok/skills/atomic-skills
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/providers/skills-file-set.js
      - kind: file
        path: src/providers/skills-provider.js
      - kind: file
        path: src/install.js
      - kind: file
        path: src/installer.js
      - kind: file
        path: tests/install-uninstall-roundtrip.test.js
      - kind: file
        path: tests/install.test.js
parked: []
emerged: []
planTitle: Grok Build native integration + cross-model review
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Install + render foundation (L1+L2)**.

## Decisions

- T-001: plugin delivery places skills at `.grok/plugins/atomic-skills/skills/<name>/SKILL.md` with no nested `atomic-skills/` namespace segment; `getAssetsDir('grok')` → `.grok/plugins/atomic-skills/_assets`; `getNamespaceRootPath('grok')` is null (plugin.json is the package root).

## Links

- Design: `../design.md` (D2 L1+L2)
- Plan: `../plan.md`

## Session handoff

- **Narrative:** F0 active on `plan/grok-build-integration`. T-001 closed: `grok` is a first-class IDE with plugin delivery in `src/config.js` + detect via `.grok`. Next is render tool maps (T-002).
- **Decision log:** Plugin package is the only Grok skill root; no dual tree under `.grok/skills/atomic-skills`. Namespace root SKILL.md omitted for plugin delivery.
- **Single nextAction:** Start T-002 — extend `src/render.js` with `ide.grok` and `ide.codex` tool maps; add `tests/render.test.js` locks; write `docs/kb/grok-build-compatibility.md`.
- **Verbatim state:**
  - Initiative: `.atomic-skills/projects/atomic-skills/grok-build-integration/phases/f0-install-render-foundation-l1-l2.md`
  - T-001 evidence: `node --test tests/config.test.js tests/install.test.js` → exit 0, 54 pass
  - Impl commit: `2a06efd feat(T-001): add grok IDE_CONFIG and detect plugin delivery`
- **Uncommitted changes:** plan state files + PROJECT-STATUS + review receipt (checkpoint next)

## Self-review against code-quality gates

- G1 read-before-claim: applied — T-001 closed with verifier run evidence (54 pass)
- G2 soft-language: applied — completion claims are passed:true evidence
- G6 reference-or-strike: applied — handoff uses verbatim paths/commands
