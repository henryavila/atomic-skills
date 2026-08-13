---
schemaVersion: "0.1"
slug: project-flow-f0-modelo-no-disco
title: Modelo no disco
summary: Schema 1.0 no disco passa a ser o MODEL; o shape sequence/states deixa
  de validar.
goal: 'Schema `"1.0"` expressa o MODEL
  (activity/xor/and/join/subprocess/event/end, messages, machines[], effects
  kind+label+target). validate-flow (AJV 2020 + regras de grafo) aceita o
  dogfood reescrito e rejeita o shape velho (`type: sequence`, `states` único,
  `effect.statusTo`). Sem regras PDTI no core.'
status: active
branch: plan/project-flow
started: 2026-08-13T16:51:58.727Z
lastUpdated: 2026-08-13T16:53:55Z
nextAction: "Start T-001: Substituir flow.schema.json pelo MODEL"
parentPlan: project-flow
phaseId: F0
businessIntent:
  value: O PO navega e valida um fluxo operacional (negócio + conversa + estados).
    O shape 1.0 no disco passa a ser o MODEL. Implement recusa plano sem flow
    ratificado.
  workflow: Schema "1.0" novo → validate-flow + dogfood reescrito → (F1/F2
    depois). Draft do grafo a partir de design/source/BI, nunca de phases[].
  rules: Sem dual-read process.yaml. Sem regras PDTI no core. Sem bump "2.0". Sem
    mergear 86c1c2d4. effects[] vazio é válido; key ausente não.
  outOfScope: Renderer, comando project flow, detector, implement HARD, copiar
    Arch, editor visual, pacote npm, feature PDTI.
  doneWhen: 'node --test tests/validate-flow.test.js verde no MODEL. Dogfood
    valida. type: sequence e states único falham. schemaVersion continua "1.0".'
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 7
exitGates:
  - id: G-F0-1
    description: FAILS when old shape still validates — type sequence or single
      states object must be invalid; MODEL dogfood must pass
    status: pending
    verifier:
      kind: shell
      command: node --test tests/validate-flow.test.js
    verifierLabel: "shell: node --test tests/validate-flow.test.js"
  - id: G-F0-2
    description: FAILS when schemaVersion is not 1.0 or when PDTI status rules live
      in validate-flow.js
    status: pending
    verifier:
      kind: shell
      command: node -e "const s=require('./meta/schemas/flow.schema.json');
        if(s.properties.schemaVersion.const!=='1.0') process.exit(1);" && ! rg
        -q 'statusTo === 10|status 10|three decisions'
        scripts/lib/validate-flow.js
    verifierLabel: "shell: node -e \"const s=require('./meta/schemas/flow.schema.json')…"
stack:
  - id: 1
    title: Modelo no disco
    type: task
    openedAt: 2026-08-13T16:51:58.727Z
tasks:
  - id: T-001
    title: Substituir flow.schema.json pelo MODEL
    status: pending
    lastUpdated: 2026-08-13T16:51:58.727Z
    summary: Troca o JSON Schema para os tipos MODEL sem mudar a string 1.0.
    weight: 2
    scopeBoundary:
      - do not rewrite scripts/lib/validate-flow.js graph walk in this task; do
        not edit dogfood JSON here; do not change process-map.schema.json; do
        not bump schemaVersion off 1.0
    acceptance:
      - schemaVersion const remains 1.0; node type enum is activity xor and join
        subprocess event end; machines array exists; transition effect requires
        kind (email notify write other) plus label plus target; sequence
        decision and single states object are not valid node/root shapes
    verifier:
      kind: shell
      command: node --test tests/validate-flow.test.js
    outputs:
      - kind: file
        path: meta/schemas/flow.schema.json
  - id: T-002
    title: Reescrever validate-flow para os tipos MODEL
    status: pending
    lastUpdated: 2026-08-13T16:51:58.727Z
    summary: Validador AJV+grafo cobre activity/xor/and/join/machines/effects.
    weight: 3
    scopeBoundary:
      - do not copy validateProcessMap; do not add PDTI domain rules (status 10,
        three decisions, ids D1); do not implement render-flow or
        find-missing-flow; subgraphs max depth is a named constant (8)
    acceptance:
      - neighbors walk activity xor and join subprocess event end; actorRef on
        messages; xor and and require >=2 branches; join.of must name an and;
        machines require >=1 node; effects key required (empty array valid);
        schemaVersion 1.0 with type sequence fails; tests cover broken next,
        one-branch xor, ghost actor, missing effects key, empty machine nodes
    verifier:
      kind: shell
      command: node --test tests/validate-flow.test.js
    outputs:
      - kind: file
        path: scripts/lib/validate-flow.js
      - kind: file
        path: tests/validate-flow.test.js
  - id: T-003
    title: Reescrever fixtures dogfood para o MODEL
    status: pending
    lastUpdated: 2026-08-13T16:51:58.727Z
    summary: Dogfood PDTI reescrito; clique só em messages; ≥1 machine.
    weight: 2
    scopeBoundary:
      - do not put PDTI status 10/1/11 or statusTo in core validator; do not
        copy Arch HTML; do not change fluxo-completo.html in this task
    acceptance:
      - fluxo-sugestao.json validates; processLabels have no click/modal/screen
        words; clicks live only in messages; at least one machine with >=1 state
        and transitions with effects arrays; minimal-xor.json is 2 actors + 1
        xor + 1 machine; type sequence and root states object fail validateFlow
    verifier:
      kind: shell
      command: node --test tests/validate-flow.test.js
    outputs:
      - kind: file
        path: docs/design/project-flow/dogfood/fluxo-sugestao.json
      - kind: file
        path: docs/design/project-flow/dogfood/minimal-xor.json
      - kind: file
        path: tests/validate-flow.test.js
parked: []
emerged: []
planTitle: Project Flow — schema, painel e dentes no implement
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Modelo no disco**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
