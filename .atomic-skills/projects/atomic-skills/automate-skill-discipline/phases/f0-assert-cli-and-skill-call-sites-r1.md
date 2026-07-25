---
schemaVersion: "0.1"
slug: automate-skill-discipline-f0-assert-cli-and-skill-call-sites-r1
title: Assert CLI and skill call sites (R1)
goal: Land `scripts/assert-automate-gate.js` reusing Layer-1 helpers, unit/integration tests, and skill prose that hard-requires assert before spawn, done-batch, phase-done, and finalize under automate.
status: done
branch: plan/automate-skill-discipline
started: 2026-07-21T19:25:48.389Z
nextAction: "Operator: project materialize F1 then continue implement (stamp automate already on)"
parentPlan: automate-skill-discipline
phaseId: F0
businessIntent:
  value: "Automate pure-maestro deixa de depender so de disciplina do modelo no miolo A-E e na autenticidade de F: assert CLI, evaluation autentica, claim-bound done, cursor fino e pause entre fases falham fechado."
  workflow: "TDD: assert CLI e helpers primeiro (F0), schema authenticity evaluation (F1), claim-bound done (F2), cursor (F3), pause+framing (F4); cada fase com exit gate shell."
  rules: Nao criar skills/core/automate.md; nao Layer 4 daemon; nao auto-materialize; non-automate byte-identical; fail closed over looks-done.
  outOfScope: Spawn supervisor multi-host; runner Layer 3 wait-loop; mudanca de Mode 2 codex lane; auto-finalize.
  doneWhen: assert-automate-gate testes verdes e prosa exige assert antes de spawn/done/phase-done/finalize; F0-G1 e F0-G2 met.
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
weightDone: 0
weightTotal: 2
exitGates:
  - id: F0-G1
    description: assert-automate-gate tests pass and script is executable via node.
    status: met
    verifier:
      kind: shell
      command: node --test tests/assert-automate-gate.test.js && node scripts/assert-automate-gate.js --help >/dev/null 2>&1 || node scripts/assert-automate-gate.js 2>&1 | head -5
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/assert-automate-gate.test.js && node scri…"
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-21T19:41:19.000Z
      verifiedCommit: 42ed863f4cccf2e0e92d0362bcc3bbfbc9d03817
      passed: true
      exitCode: 0
      outputSummary: |2-
            ✔ exit 0 when non-automate (64.030208ms)
          ✔ finalize (192.175875ms)
          ✔ resolves nested project/slug and --project filter (127.086958ms)
        ✔ assert-automate-gate CLI (1335.547875ms)
        ℹ tests 16
        ℹ suites 5
        ℹ pass 16
        ℹ fail 0
        ℹ cancelled 0
        ℹ skipped 0
        ℹ todo 0
        ℹ duration_ms 1369.239
    metAt: 2026-07-21T19:41:19.000Z
  - id: F0-G2
    description: Skill assets require assert-automate-gate under automate; no top-level automate skill.
    status: met
    verifier:
      kind: shell
      command: test ! -e skills/core/automate.md && rg -n 'assert-automate-gate' skills/core/implement.md skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    verifierLabel: "shell: test ! -e skills/core/automate.md && rg -n 'assert-automate…"
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-21T19:41:19.000Z
      verifiedCommit: 42ed863f4cccf2e0e92d0362bcc3bbfbc9d03817
      passed: true
      exitCode: 0
      outputSummary: assert-automate-gate greps ok; no automate.md
    metAt: 2026-07-21T19:41:19.000Z
stack:
  - id: 1
    title: Assert CLI and skill call sites (R1)
    type: task
    openedAt: 2026-07-21T19:25:48.389Z
tasks:
  - id: T-001
    title: assert-automate-gate CLI pure gates
    status: done
    lastUpdated: 2026-07-21T19:38:41.000Z
    scopeBoundary:
      - Do not spawn writers or run git merge. Do not change Mode 1 done path. Do not add a top-level automate skill. If the published package lists scripts via package.json files, include the new script path.
    acceptance:
      - it - CLI accepts --plan and --gate with values spawn claims done phase-done finalize (aliases allowed if documented).; it - spawn gate returns exit 1 when lease status is blocking via canSpawnPhaseWriter semantics.; it - claims/done gate returns exit 1 when claim report missing or validateClaimReport fails when report path provided or required.; it - phase-done gate returns exit 1 under durable automate without evaluationGate that phaseEvaluationAllowsClose accepts.; it - finalize gate returns exit 1 when automatePlanEndGatesOk is false.; it - prints ok or blocked with reason on stdout/stderr and exit 0 only when ok.; it - unit tests cover matrix without network.
    verifier:
      kind: shell
      command: node --test tests/assert-automate-gate.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/assert-automate-gate.js
      - kind: file
        path: tests/assert-automate-gate.test.js
      - kind: file
        path: package.json
    closedAt: 2026-07-21T19:38:41.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-21T19:38:41.000Z
      verifiedCommit: 3958c642f17fc7318e79291fd813ac7309a2eb0c
      passed: true
      exitCode: 0
      outputSummary: |2-
          ▶ finalize
            ✔ exit 1 when automatePlanEndGatesOk is false (65.6535ms)
            ✔ exit 0 when plan-end receipt + userValidatedAt ok (63.908291ms)
            ✔ exit 0 when non-automate (63.831667ms)
          ✔ finalize (193.496292ms)
          ✔ resolves nested project/slug and --project filter (127.232167ms)
        ✔ assert-automate-gate CLI (1361.122208ms)
        ℹ tests 16
        ℹ suites 5
        ℹ pass 16
        ℹ fail 0
        ℹ cancelled 0
        ℹ skipped 0
        ℹ todo 0
        ℹ duration_ms 1394.303917
  - id: T-002
    title: Skill prose requires assert before transitions
    status: done
    lastUpdated: 2026-07-21T19:38:41.000Z
    scopeBoundary:
      - Do not implement evaluation authenticity schema yet (F1). Do not implement step cursor file yet (F3). Do not change non-automate review ladder defaults.
    acceptance:
      - it - pure-maestro Steps C E G I (or table) require running assert-automate-gate (or documented equivalent node invocation) before spawn done-batch phase-done finalize.; it - HARD-GATE text forbids advancing when assert exits non-zero.; it - antipatterns include skipping assert and silent Mode-1 under stamp.; it - realism KB Layer 2 marked landed or in-progress with script path.; it - no skills/core/automate.md created.
    verifier:
      kind: shell
      command: test ! -e skills/core/automate.md && rg -n 'assert-automate-gate' skills/core/implement.md skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/shared/implement-antipatterns.md
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/project-assets/project-finalize.md
      - kind: file
        path: docs/kb/automate-orchestrator-realism.md
    closedAt: 2026-07-21T19:38:41.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-21T19:38:41.000Z
      verifiedCommit: 3958c642f17fc7318e79291fd813ac7309a2eb0c
      passed: true
      exitCode: 0
      outputSummary: |-
        skills/shared/implement-automate-maestro.md:7:Layer-2 assert CLI: `scripts/assert-automate-gate.js` (must run before C/E/G/I advances).
        skills/shared/implement-automate-maestro.md:10:### HARD-GATE — assert-automate-gate before C / E / G / I
        skills/shared/implement-automate-maestro.md:15:node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/assert-automate-gate.js" \
        skills/shared/implement-automate-maestro.md:36:| **C** | Spawn phase writer | **HARD-GATE first:** `assert
parked: []
emerged: []
planTitle: Automate skill discipline remediation
planActive: true
current: true
lastUpdated: 2026-07-21T19:42:17.011Z
---

# Narrative / notes

Initiative for phase **F0 — Assert CLI and skill call sites (R1)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F0 pure-maestro dogfood complete through evaluation + exit gates + review receipt. Ready for phase-done advance after commit of state.
- **Decision log:** Used phase writer for product code; orchestrator only merge/done/eval/state. assert-automate-gate validated done+phase-done. evaluationGate passed. reviewGate stamped.
- **Single nextAction:** Complete phase-done terminal write: mark F0 done, activate materialize prompt for F1 (do not auto-materialize).
- **Verbatim state:** HEAD=42ed863f4cccf2e0e92d0362bcc3bbfbc9d03817; evaluationGate.passed; F0-G1/G2 met; reviewFile=.atomic-skills/reviews/2026-07-21-automate-skill-discipline-f0-local.md
- **Uncommitted changes:** plan+initiative+reviews dirty until advance checkpoint.
