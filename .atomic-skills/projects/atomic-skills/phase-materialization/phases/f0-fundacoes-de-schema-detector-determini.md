---
schemaVersion: "0.1"
slug: phase-materialization-f0-fundacoes-de-schema-detector-determini
title: Fundações de schema + detector determinístico
goal: Adicionar o campo de schema aditivo/opcional `businessIntent` no
  `phaseDescriptor` do plano E no schema da initiative (espelha `summary`), mais
  o detector determinístico `find-missing-business-intent.js` — todos com zero
  mudança de comportamento e totalmente backward-compat. Esta fase habilita
  F1–F4 sem alterar nenhum fluxo existente.
status: active
branch: plan/phase-materialization
started: 2026-06-29T13:19:41.314Z
lastUpdated: 2026-06-29T14:50:13.796Z
nextAction: "Start T-001: Adicionar sub-schema `businessIntent` ao
  `phaseDescriptor` E à initiative"
parentPlan: phase-materialization
phaseId: F0
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: F0-G1
    description: Schemas (plan phaseDescriptor + initiative) aceitam legados (sem
      businessIntent) e novos (com), e o detector exit-0/1 sobre fixtures
      canonicos
    status: pending
    verifier:
      kind: shell
      command: npm test -- tests/phase-materialization/
      expectExitCode: 0
  - id: F0-G2
    description: Nenhum arquivo de fluxo/skill alterado nesta fase (zero behavior
      change confirmado pelo diff)
    status: pending
    verifier:
      kind: manual
      description: Confirmar via git diff que só meta/schemas/plan.schema.json +
        meta/schemas/initiative.schema.json +
        scripts/find-missing-business-intent.js + tests/ foram tocados
stack:
  - id: 1
    title: Fundações de schema + detector determinístico
    type: task
    openedAt: 2026-06-29T13:19:41.314Z
tasks:
  - id: T-001
    title: Adicionar sub-schema `businessIntent` ao `phaseDescriptor` E à initiative
    description: 'Adiciona o MESMO sub-schema `businessIntent` em DOIS schemas,
      ambos aditivos/opcionais: (a) em `meta/schemas/plan.schema.json` dentro do
      `phaseDescriptor` (`:211`, `additionalProperties:false` `:213`) como
      **properties-only, FORA do `required`** (`:214`) — espelha exatamente como
      `summary` (`:220`) já vive; (b) em `meta/schemas/initiative.schema.json`
      (que é `additionalProperties:false` e hoje NÃO tem o campo) como
      **properties-only, FORA do `required`** — espelha exatamente como o
      `summary` (`:29`) já vive lá (F-001: o detector D4 lê `businessIntent` nas
      2 superfícies descriptor+initiative, e o verbo `materialize` (F3) grava
      businessIntent no arquivo de iniciativa; se o schema da initiative não
      admitir o campo, o `additionalProperties:false` rejeita a initiative
      materializada). O sub-schema é um objeto com 5 campos
      obrigatórios-quando-presente
      (`value`/`workflow`/`rules`/`outOfScope`/`doneWhen`, todos `type:string`
      `minLength:1`) + cauda opcional `derived[]` (array de objetos
      `{question:string, answer?:string}`). O objeto inteiro usa
      `additionalProperties:false`. Resolve a Open question "sub-schema
      businessIntent + onde mora derived".'
    status: pending
    lastUpdated: 2026-06-29T13:19:41.314Z
    scopeBoundary:
      - o bloco `phaseDescriptor.properties` em plan.schema.json (ou um
        `$defs/businessIntent` extraído e referenciado) + a adição simétrica em
        initiative.schema.json + o novo teste; NÃO remover campos existentes,
        NÃO mexer nos `required` (plan `:214`, initiative), NÃO alterar outros
        schemas
    acceptance:
      - um plano com `businessIntent` completo nos 5 campos valida limpo; uma
        initiative com `businessIntent` completo valida limpo; plano e
        initiative legados SEM o campo validam limpos (opcional confirmado em
        AMBOS os schemas); um `businessIntent` presente mas faltando `value` é
        rejeitado pelo Ajv em ambos os schemas; `derived[]` ausente é aceito
        (opcional)
    verifier:
      kind: test
      runner: node --test
      pattern: tests/phase-materialization/business-intent-schema.test.js
    outputs:
      - kind: file
        path: meta/schemas/plan.schema.json
      - kind: file
        path: meta/schemas/initiative.schema.json
      - kind: file
        path: tests/phase-materialization/business-intent-schema.test.js
    summary: Adiciona o sub-schema businessIntent (5 campos + derived[]) ao
      phaseDescriptor do plano E à initiative, opcional como summary em ambos
      (F-001).
    weight: 2
  - id: T-003
    title: Autorar o detector `find-missing-business-intent.js` (D4)
    description: "Cria `scripts/find-missing-business-intent.js` no **mesmo molde de
      SAÍDA** de `find-missing-summaries.js` (`configuredLanguage`, CLI exit
      0/1, importa `parseFrontmatter` de `validate-state.js`, percorre nested +
      flat), mas com lógica de objeto aninhado (mais próxima de
      `validate-state.js`): para cada fase **materializada** (que tem arquivo de
      iniciativa — distingue de descriptor-only pela existência do arquivo, não
      por `subPhaseCount`), checa os 5 campos da espinha `businessIntent`
      (`value`/`workflow`/`rules`/`outOfScope`/`doneWhen`) nas **2 superfícies**
      (descriptor `plan.phases[].businessIntent` + initiative `businessIntent`);
      reporta o primeiro campo ausente/vazio/marcado `[NEEDS CLARIFICATION]`
      (string reservada tratada como ausente). HARD-BLOCK via exit 1. Fases
      descriptor-only (sem arquivo) são ignoradas (ainda não ativadas — D5
      backfill-on-activation)."
    status: pending
    lastUpdated: 2026-06-29T13:19:41.314Z
    scopeBoundary:
      - novo arquivo `scripts/find-missing-business-intent.js` + teste; NÃO
        alterar `find-missing-summaries.js`, `validate-state.js`, nem reuso de
        `configuredLanguage` quebrando o export existente
    acceptance:
      - fixture com fase materializada + espinha completa → exit 0; mesma fase
        faltando `outOfScope` no descriptor → exit 1 reportando
        `outOfScope(descriptor)`; fase descriptor-only (sem arquivo de
        iniciativa) → ignorada (não reportada); `[NEEDS CLARIFICATION]` em
        qualquer campo → reportado como ausente; `derived[]` nunca é gateado
    verifier:
      kind: shell
      command: node --test
        tests/phase-materialization/find-missing-business-intent.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/find-missing-business-intent.js
      - kind: file
        path: tests/phase-materialization/find-missing-business-intent.test.js
    summary: "Cria find-missing-business-intent.js: checa os 5 campos da espinha × 2
      superfícies em fases materializadas, exit 0/1."
    weight: 3
parked: []
emerged: []
summary: Adiciona o campo de schema opcional businessIntent no phaseDescriptor
  do plano E na initiative (espelha summary) + o detector determinístico que o
  checa — zero mudança de comportamento.
---

# Narrative / notes

Initiative for phase **F0 — Fundações de schema + detector determinístico**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

