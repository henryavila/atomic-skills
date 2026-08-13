---
schemaVersion: "0.1"
slug: project-flow-f2-comando-e-dentes
title: Comando e dentes
goal: "`project flow` gera/atualiza/exibe/ratifica; detector `--strict` exige M4
  + stamp + flow.html sha; `implement` recusa sem artefato; process-map sai do
  write path; Iron Law vira NO IMPLEMENT WITHOUT VALIDATED FLOW. Reusar do
  worktree só `flowPathsForPlan` e `buildFlowRatification`."
status: active
branch: plan/project-flow
started: 2026-08-13T22:02:11.796Z
lastUpdated: 2026-08-13T22:02:11.796Z
nextAction: "Start T-007: Detector find-missing-flow --strict"
parentPlan: project-flow
phaseId: F2
businessIntent:
  value: Todo plano que implement aceita tem flow ratificado. O PO gera, vê e
    carimba o fluxo no comando project flow. Sem process-map no write path.
  workflow: detector --strict (M4 + stamp + flow.html sha) → comando project flow
    (generate/update/show/ratify/--check/--open) → implement Step 1 + spawn
    recusam sem flow → CREATION_STAGES sem process-map.
  rules: Só buildFlowRatification escreve ratifiedAt/ratifiedGraphSha. Sem
    operatorSkip. Sem stage flow inescapável. Ready sem flow é legal. Reusar do
    worktree 86c1c2d4 só flowPathsForPlan e buildFlowRatification. Sem mergear
    HTML Mermaid.
  outOfScope: Pacote npm, editor visual, copiar Arch, feature PDTI, reabrir
    Mermaid como produto.
  doneWhen: "G-F2-1: `node --test tests/find-missing-flow.test.js tests/flow-ratification.test.js` exit 0 e `--check` no dogfood; process.yaml sozinho não passa `--strict`. G-F2-2: `rg find-missing-flow skills/core/implement.md` e CREATION_STAGES sem process-map."
tasksDone: 0
tasksTotal: 4
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-F2-1
    description: FAILS when project flow --check on migrated dogfood is non-zero or
      when process.yaml alone satisfies the detector
    status: pending
    verifier:
      kind: shell
      command: node --test tests/find-missing-flow.test.js
        tests/flow-ratification.test.js
  - id: G-F2-2
    description: FAILS when implement can spawn without flow or when CREATION_STAGES
      still lists process-map
    status: pending
    verifier:
      kind: shell
      command: rg -q 'find-missing-flow' skills/core/implement.md && node -e "import {
        CREATION_STAGES } from './scripts/creation-gates.js';
        if(CREATION_STAGES.includes('process-map')) process.exit(1);"
stack:
  - id: 1
    title: Comando e dentes
    type: task
    openedAt: 2026-08-13T22:02:11.796Z
tasks:
  - id: T-007
    title: Detector find-missing-flow --strict
    description: Detector --strict exige M4 + stamp + HTML casado.
    status: pending
    lastUpdated: 2026-08-13T22:02:11.796Z
    scopeBoundary:
      - do not implement the project flow skill UX here; do not remove
        CREATION_STAGES process-map in this task; do not write ratifiedAt except
        via a test helper that is not the product command
    acceptance:
      - --strict exit 0 only when flow.json validates, >=1 messages, >=1 machine
        with >=1 state, ratifiedAt set, ratifiedGraphSha matches, flow.html
        exists with matching content-sha; missing any piece exits non-zero;
        process.yaml alone does not satisfy
    verifier:
      kind: shell
      command: node --test tests/find-missing-flow.test.js
    outputs:
      - kind: file
        path: scripts/find-missing-flow.js
      - kind: file
        path: tests/find-missing-flow.test.js
  - id: T-008
    title: Comando project flow + buildFlowRatification
    description: Comando project flow; só buildFlowRatification carimba.
    status: pending
    lastUpdated: 2026-08-13T22:02:11.796Z
    scopeBoundary:
      - do not add a creation stage named flow; do not keep process-map as a
        product fallback; do not stamp ratifiedAt from free-text chat
    acceptance:
      - grammar lists flow; alias process loads project-flow.md only;
        buildFlowRatification is the only writer of ratifiedAt and
        ratifiedGraphSha; generate/update/show/--check/--open are documented;
        AskUserQuestion after show is required before stamp
    verifier:
      kind: shell
      command: test -f skills/shared/project-assets/project-flow.md && rg -q 'project
        flow|buildFlowRatification' skills/core/project.md
        skills/shared/project-assets/project-flow.md && rg -q
        'buildFlowRatification' scripts/lib/flow-ratification.js && node --test
        tests/flow-ratification.test.js
    outputs:
      - kind: file
        path: skills/core/project.md
      - kind: file
        path: skills/shared/project-assets/project-flow.md
      - kind: file
        path: scripts/lib/flow-ratification.js
      - kind: file
        path: tests/flow-ratification.test.js
  - id: T-009
    title: implement HARD + assert-automate-gate spawn
    description: implement Step 1 e spawn recusam sem flow.
    status: pending
    lastUpdated: 2026-08-13T22:02:11.796Z
    scopeBoundary:
      - do not run show+ratify inside implement; do not add operatorSkip for
        missing flow; do not rewrite automate maestro A-I beyond the spawn fence
    acceptance:
      - implement Step 1 runs find-missing-flow --strict on the plan path;
        non-zero refuses code and spawn; assert-automate-gate --gate spawn fails
        closed without the artifact; docs/kb/flow.md states the Iron Law and the
        command; no chat waiver
    verifier:
      kind: shell
      command: rg -q 'find-missing-flow' skills/core/implement.md && rg -q
        'find-missing-flow' scripts/assert-automate-gate.js && rg -q 'NO
        IMPLEMENT WITHOUT VALIDATED FLOW|validated flow' docs/kb/flow.md && node
        --test tests/assert-automate-gate.test.js
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: scripts/assert-automate-gate.js
      - kind: file
        path: tests/assert-automate-gate.test.js
      - kind: file
        path: docs/kb/flow.md
  - id: T-010
    title: Remover process-map do write path e da Iron Law
    description: CREATION_STAGES e Iron Law trocam process-map por flow.
    status: pending
    lastUpdated: 2026-08-13T22:02:11.796Z
    scopeBoundary:
      - do not delete find-missing-process-map.js in this task (legacy reader
        only); do not merge 86c1c2d4; do not extract an npm package
    acceptance:
      - CREATION_STAGES goes summaries then reviews with no process-map entry;
        mid-creation process-map remaps to reviews; Iron Law text is NO
        IMPLEMENT WITHOUT VALIDATED FLOW; project process aliases to flow; ready
        without flow remains legal
    verifier:
      kind: shell
      command: node -e \"import { CREATION_STAGES } from
        './scripts/creation-gates.js';
        if(CREATION_STAGES.includes('process-map')) process.exit(1); const
        i=CREATION_STAGES.indexOf('summaries'); const
        j=CREATION_STAGES.indexOf('reviews'); if(!(i>=0 && j===i+1))
        process.exit(1);\" && rg -q 'NO IMPLEMENT WITHOUT VALIDATED FLOW'
        skills/core/project.md CLAUDE.md && node --test
        tests/creation-gates.test.js
    outputs:
      - kind: file
        path: scripts/creation-gates.js
      - kind: file
        path: tests/creation-gates.test.js
      - kind: file
        path: skills/core/project.md
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
      - kind: file
        path: skills/shared/project-assets/new-plan/stage-8.md
      - kind: file
        path: skills/shared/project-assets/new-plan/stage-9.md
      - kind: file
        path: CLAUDE.md
      - kind: file
        path: docs/kb/process-map.md
      - kind: file
        path: skills/shared/project-assets/new-plan/stage-process-map.md
      - kind: file
        path: skills/shared/project-assets/new-plan/stage-7.md
      - kind: file
        path: skills/shared/project-assets/project-process-map.md
      - kind: file
        path: tests/find-missing-process-map.test.js
parked: []
emerged: []
---

# Narrative / notes

Initiative for phase **F2 — Comando e dentes**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
