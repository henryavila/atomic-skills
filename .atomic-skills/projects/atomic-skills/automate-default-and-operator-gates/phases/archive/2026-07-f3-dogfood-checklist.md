---
schemaVersion: "0.1"
slug: automate-default-and-operator-gates-f3-dogfood-checklist
title: Dogfood checklist
goal: Checklist so the next automate run proves the three gates without chat memory.
summary: Checklist dogfood dos três gates.
status: archived
branch: plan/automate-default-and-operator-gates
started: 2026-07-27T08:10:58.811Z
lastUpdated: 2026-07-27T08:17:58.184Z
nextAction: present phase-start package for F4 validate-only
parentPlan: automate-default-and-operator-gates
phaseId: F3
businessIntent:
  value: Operador tem checklist durable que prova F0 default + F1
    present-before-PASS + F2 intentVsDelivered sem memória de chat.
  workflow: Escrever/atualizar docs/kb checklist rows + greps; zero product code.
  rules: Só KB/checklist; sem app code; alinhar a F0–F2 já shipped.
  outOfScope: F4 authenticity; product Lekto; reimplementar gates F0–F2.
  doneWhen: F3-G1 rg green; file(s) com as rows listadas.
tasksDone: 1
tasksTotal: 1
gatesMet: 1
gatesTotal: 1
weightDone: 1
weightTotal: 1
exitGates:
  - id: F3-G1
    description: Dogfood checklist covers default decision package and intent-vs-delivered.
    status: met
    verifier:
      kind: shell
      command: rg -n 'read-before-PASS|intentVsDelivered|default' docs/kb/
      expectExitCode: 0
    metAt: 2026-07-27T08:13:56.380Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-27T08:13:56.380Z
      verifiedCommit: 9838128763f6a76a2103756272b0525f9d610674
      passed: true
      exitCode: 0
      outputSummary: F3-G1 green
    verifierLabel: "shell: rg -n 'read-before-PASS|intentVsDelivered|default' docs/kb/"
    evidenceSummary: passed · 2026-07-27
stack:
  - id: 1
    title: Dogfood checklist
    type: task
    openedAt: 2026-07-27T08:10:58.811Z
tasks:
  - id: T-001
    title: Dogfood checklist update
    summary: Dogfood checklist update
    status: done
    lastUpdated: 2026-07-27T08:13:56.380Z
    scopeBoundary:
      - Checklist and KB only. No product app code.
    acceptance:
      - it - Rows cover bare implement activates automate.; it - Rows cover Mode
        1 explicit escape.; it - Rows cover decision package shown before PASS.;
        it - Rows cover plan-end receipt intentVsDelivered and finalize blocked
        without it.; it - File docs/kb/automate-default-dogfood.md or dogfood
        section exists with those rows.
    verifier:
      kind: shell
      command: rg -n 'read-before-PASS|intentVsDelivered|default' docs/kb/
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/kb/implement-phase-agents-dogfood.md
      - kind: file
        path: docs/kb/automate-default-dogfood.md
    weight: 1
    closedAt: 2026-07-27T08:13:56.380Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-27T08:13:56.380Z
      verifiedCommit: 9838128763f6a76a2103756272b0525f9d610674
      passed: true
      exitCode: 0
      outputSummary: rg -n 'read-before-PASS|intentVsDelivered|default' docs/kb/ exit 0
parked: []
emerged: []
---

# F3 Dogfood checklist

## Session handoff

- **Narrative:** F3 materialized after package ratify.
- **Single nextAction:** Start T-001: Dogfood checklist update
- **Uncommitted changes:** post-materialize.

