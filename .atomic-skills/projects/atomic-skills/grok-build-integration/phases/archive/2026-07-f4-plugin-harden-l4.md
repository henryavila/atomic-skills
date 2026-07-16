---
schemaVersion: "0.1"
slug: grok-build-integration-f4-plugin-harden-l4
title: Plugin harden (L4)
goal: "Grok plugin surface is complete for daily use: inspect smoke, trust docs,
  optional thin agents only if needed, journal edge cases closed."
status: done
branch: plan/grok-build-integration
started: 2026-07-16T15:07:33.000Z
lastUpdated: 2026-07-16T15:10:00.000Z
nextAction: null
parentPlan: grok-build-integration
phaseId: F4
businessIntent:
  value: Grok plugin surface complete for daily use.
  workflow: inspect smoke + trust docs + journal edge cases.
  rules: plugin-only root; install parity.
  outOfScope: marketplace publish.
  doneWhen: "F4 gate green: plugin.json tested and package keywords include grok."
tasksDone: 2
tasksTotal: 2
gatesMet: 1
gatesTotal: 1
weightDone: 2
weightTotal: 2
exitGates:
  - id: G-1
    description: Plugin.json contract is tested and package keywords include grok.
    status: met
    metAt: 2026-07-16T15:10:00.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T15:10:00.000Z
      passed: true
      exitCode: 0
      outputSummary: "install.test 39 pass; package.json keywords include grok"
    verifier:
      kind: shell
      command: node --test tests/install.test.js && node -e "const
        p=require('./package.json'); if(!p.keywords.includes('grok'))
        process.exit(1)"
      expectExitCode: 0
    verifierLabel: 'shell: node --test tests/install.test.js && node -e "const p=requi…'
    evidenceSummary: passed · 2026-07-16
stack:
  - id: 1
    title: Plugin harden (L4)
    type: task
    openedAt: 2026-07-16T15:07:33.000Z
tasks:
  - id: T-001
    title: Plugin inspect and list smoke
    description: Add documented smoke commands and automated checks that a temp
      install shows atomic-skills under grok plugin list or filesystem
      plugin.json contract; fix journal gaps found.
    scopeBoundary:
      - do not publish marketplace catalog entries
    acceptance:
      - plugin.json has name atomic-skills and version from package; install
        test asserts required plugin.json keys
    verifier:
      kind: shell
      command: node --test tests/install.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T15:10:00.000Z
      passed: true
      exitCode: 0
      outputSummary: install.test 39 pass; plugin.json keys name/version/description/skills/hooks;
        version pinned to package.json; KB §6 inspect smoke documented
    outputs:
      - kind: file
        path: docs/kb/grok-build-compatibility.md
      - kind: file
        path: tests/install.test.js
      - kind: file
        path: src/ as needed for plugin.json fields
    status: done
    lastUpdated: 2026-07-16T15:10:00.000Z
    closedAt: 2026-07-16T15:10:00.000Z
  - id: T-002
    title: Trust and setup documentation
    description: Document folder trust, hooks-trust, and Soft fail-open when project
      plugin untrusted; update CLAUDE.md or AGENTS only if required for
      multi-agent note; README generator catalog keyword grok.
    scopeBoundary:
      - do not add MCP server
    acceptance:
      - package.json keywords include grok; KB documents trust; catalog or
        README mentions Grok Build
    verifier:
      kind: shell
      command: node --test tests/install.test.js && node -e "const
        p=require('./package.json'); if(!p.keywords.includes('grok'))
        process.exit(1)"
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T15:10:00.000Z
      passed: true
      exitCode: 0
      outputSummary: keywords include grok; KB §7 trust/fail-open; README Grok Build + plugin
        path fix; hooks README Soft fail-open note
    outputs:
      - kind: file
        path: docs/kb/grok-build-compatibility.md
      - kind: file
        path: package.json
      - kind: file
        path: meta/catalog.yaml
      - kind: file
        path: scripts/generate-readme.js related fixtures if any
      - kind: file
        path: README.md if generated
    status: done
    lastUpdated: 2026-07-16T15:10:00.000Z
    closedAt: 2026-07-16T15:10:00.000Z
parked: []
emerged: []
planTitle: Grok Build native integration + cross-model review
planActive: true
current: false
---

# F4 — done

Plugin.json contract tested; package keywords include `grok`; trust/inspect docs shipped.
Local review: `.atomic-skills/reviews/2026-07-16-1510-grok-build-integration-f4-local.md`.
