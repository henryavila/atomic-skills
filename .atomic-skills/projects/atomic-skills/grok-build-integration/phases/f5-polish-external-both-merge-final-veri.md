---
schemaVersion: "0.1"
slug: grok-build-integration-f5-polish-external-both-merge-final-veri
title: Polish, external-both merge, final verify
goal: external-both merges findings for triage; L5 conditionals where needed;
  full suite green; plan ready to archive criteria met.
status: active
branch: plan/grok-build-integration
started: 2026-07-16T15:10:00.000Z
lastUpdated: 2026-07-16T15:10:00.000Z
nextAction: "Start T-001: external-both findings merge"
parentPlan: grok-build-integration
phaseId: F5
businessIntent:
  value: Operators can triage dual-provider (Codex+Grok) review findings with a
    deterministic merge contract and finish Grok integration with green suites.
  workflow: external-both runs Codex then Grok envelopes on one artifact → merge
    helper ranks findings → hot skills carry ide.grok quirks → final regression.
  rules: merge key file:line + claim; higher severity wins with dual provenance;
    partial provider failure keeps the good half; human triage mandatory; skill
    bodies stay tool-abstract.
  outOfScope: auto-apply of external findings; marketplace publish; MCP state server.
  doneWhen: "F5 gates green: external-both documented + merge unit tests + final
    config/install/round-trip/render/project suites and validate-skills."
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 3
weightDone: 0
weightTotal: 3
exitGates:
  - id: G-1
    description: external-both merge contract documented in review-code and
      review-plan; validate-skills passes.
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills && grep -q 'external-both'
        skills/core/review-code.md && grep -q 'external-both'
        skills/core/review-plan.md
      expectExitCode: 0
    verifierLabel: "shell: npm run validate-skills && grep -q 'external-both' skills/c…"
  - id: G-2
    description: Final regression includes config install round-trip render project
      and validate-skills.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/config.test.js tests/install.test.js
        tests/install-uninstall-roundtrip.test.js tests/render.test.js
        tests/project.test.js && npm run validate-skills
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/config.test.js tests/install.test.js test…"
  - id: G-3
    description: external-both merge helper unit tests pass.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/external-both-merge.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/external-both-merge.test.js"
stack:
  - id: 1
    title: Polish, external-both merge, final verify
    type: task
    openedAt: 2026-07-16T15:10:00.000Z
tasks:
  - id: T-001
    title: external-both findings merge
    description: Implement sequential Codex then Grok envelope on the same cleaned
      artifact; merge key file:line plus normalized claim; severity conflict
      keeps higher severity with dual provenance; partial provider failure keeps
      the other side and surfaces error; unit tests for merge helper; document
      in KB.
    scopeBoundary:
      - do not auto-apply fixes without human triage
    acceptance:
      - external-both documented in review-code and review-plan with merge key
        severity and partial-failure rules; merge unit tests pass;
        validate-skills passes
    verifier:
      kind: shell
      command: npm run validate-skills && grep -q 'external-both'
        skills/core/review-code.md && grep -q 'external-both'
        skills/core/review-plan.md && node --test
        tests/external-both-merge.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/codex-bridge-assets/envelope-orchestration.md
      - kind: file
        path: skills/core/review-code.md
      - kind: file
        path: skills/core/review-plan.md
      - kind: file
        path: docs/kb/cross-model-review-design.md
      - kind: file
        path: src/external-both-merge.js
      - kind: file
        path: tests/external-both-merge.test.js
    status: pending
    lastUpdated: 2026-07-16T15:10:00.000Z
  - id: T-002
    title: ide.grok conditionals on hot skills
    description: Add minimal ide.grok guidance in implement, parallel-dispatch, and
      project-related assets only where spawn_subagent or ask_user_question
      behavior differs.
    scopeBoundary:
      - do not invent new agent types unless a failing task requires them
    acceptance:
      - rendered grok output includes any new conditionals; validate-skills
        passes
    verifier:
      kind: shell
      command: npm run validate-skills && node --test tests/render.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/core/parallel-dispatch.md
      - kind: file
        path: skills/core/project.md
      - kind: file
        path: tests/render.test.js
    status: pending
    lastUpdated: 2026-07-16T15:10:00.000Z
  - id: T-003
    title: Final verification suite
    description: Run config, install, round-trip, render, project suites and
      validate-skills; record results in plan Reviews section.
    scopeBoundary:
      - no new features; fix only regressions found by the suite
    acceptance:
      - the listed test commands exit 0
    verifier:
      kind: shell
      command: node --test tests/external-both-merge.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: tests/config.test.js
      - kind: file
        path: tests/install.test.js
      - kind: file
        path: tests/install-uninstall-roundtrip.test.js
      - kind: file
        path: tests/render.test.js
      - kind: file
        path: tests/project.test.js
      - kind: file
        path: package.json
    status: pending
    lastUpdated: 2026-07-16T15:10:00.000Z
parked: []
emerged: []
planTitle: Grok Build native integration + cross-model review
planActive: true
current: true
---

# F5
