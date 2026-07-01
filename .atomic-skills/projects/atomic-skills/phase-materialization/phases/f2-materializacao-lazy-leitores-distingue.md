---
schemaVersion: "0.1"
slug: phase-materialization-f2-materializacao-lazy-leitores-distingue
title: Materialização lazy + leitores distinguem descriptor-only
goal: 'Implementar D1 (lazy FORTE) + a retenção da fonte por-fase (D2):
  `materializeDecomposition` passa a escrever apenas o initiative file de F0
  (com tasks) + os descritores `phases[]` COMPLETOS para F1..N (sem arquivo de
  iniciativa, `subPhaseCount:0` placeholder honesto, `exitGate.criteria` retido
  da fonte up-front); a fonte parseada por-fase é persistida em estado para o
  `materialize` consumir. Os leitores (`status`/`verify`/dashboard) passam a
  distinguir "descritor-only, pendente de materialização" (sem arquivo) de
  "materializada" (com arquivo). Depende de F1.'
status: active
branch: plan/phase-materialization
started: 2026-06-29T13:19:41.314Z
lastUpdated: 2026-07-01T08:42:22.000Z
nextAction: "Start T-006: Mudar `materializeDecomposition` para materializar só
  F0 + reter fonte por-fase (D1)"
parentPlan: phase-materialization
phaseId: F2
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 6
exitGates:
  - id: F2-G1
    description: new plan com >=2 fases materializa só F0 (1 initiative file) +
      descritores F1..N com subPhaseCount:0 e exitGate retido, e fonte por-fase
      persistida
    status: pending
    verifier:
      kind: shell
      command: npm test -- tests/decompose-lazy.test.js
      expectExitCode: 0
    verifierLabel: "shell: npm test -- tests/decompose-lazy.test.js"
  - id: F2-G2
    description: "status/verify E o dashboard tratam fase descriptor-only como
      pendente-de-materialização (estado valido), nao como erro (F-004: o goal
      de F2 nomeia o dashboard)"
    status: pending
    verifier:
      kind: manual
      description: Rodar atomic-skills:project status e verify + abrir o dashboard
        sobre um plano dogfood com F1 descriptor-only; confirmar que F1 aparece
        como pendente-de-materialização (não vazio/quebrado) em todos, sem
        erro/falso-positivo
    verifierLabel: manual
stack:
  - id: 1
    title: Materialização lazy + leitores distinguem descriptor-only
    type: task
    openedAt: 2026-06-29T13:19:41.314Z
tasks:
  - id: T-006
    title: Mudar `materializeDecomposition` para materializar só F0 + reter fonte
      por-fase (D1)
    description: "Em `materializeDecomposition` (`src/decompose.js:771`): (a) o loop
      que escreve initiative files (`:866`) passa a chamar `writeInitiativeFile`
      **apenas para F0** (índice 0); (b) para F1..N, nenhum arquivo de
      iniciativa é escrito; (c) o `phases[].subPhaseCount` (`:813`) para F1..N
      materializa como `0` (placeholder honesto — distinto de \"vazia
      materializada\", ver nota descritor-vs-materializada no design D1);
      `exitGate.criteria` de F1..N continua retido da fonte (o `decomposePlan`
      já percorre o doc inteiro). (d) Persiste a **fonte por-fase** parseada em
      estado sob o diretório do plano em `phases/<phase-slug>.source.json`
      (candidato decidido para a Open question \"retenção do decompose-result\")
      entre o `new plan` e o `materialize` — sem isso o `materialize` teria que
      re-`decomposePlan` o plano inteiro, contradizendo o lazy. (e) F-002: o
      sidecar `<slug>.source.json` é um **artefato de captura**, NÃO estado
      validável — `validate-state.js` e os `find-*.js` iteram `phases/`
      filtrando apenas `*.md` (verificado: `find-missing-summaries.js:86` `if
      (!entry.endsWith('.md') ...) continue`; `validate-state.js` coleta via
      `addMd(...)`), então o `.json` é ignorado e **não** precisa de slot no
      `initiative.schema.json` nem quebra a validação; só o verbo `materialize`
      (F3) o lê. `new plan` (F0) segue ganhando tasks + passando pelo gate de
      businessIntent na criação (non-goal \"não mudar a F0\")."
    status: pending
    lastUpdated: 2026-06-29T13:19:41.314Z
    scopeBoundary:
      - "`materializeDecomposition` (`:771-949`) e a emissão de `phases[]`
        (`:796-822`); NÃO alterar `decomposeOnePhase`/`writeInitiativeFile`
        (F1), NÃO alterar formato-fonte markdown, NÃO migrar planos existentes,
        NÃO tocar schemas (o sidecar é captura não-validada)"
    acceptance:
      - "sobre um source com F0+F1+F2, `materializeDecomposition` emite
        exatamente 1 initiative file (F0) + o plan.md com 3 descritores em
        `phases[]` (F0 com subPhaseCount=tasks, F1/F2 com subPhaseCount:0 e
        exitGate retido); `phases/<slug>.source.json` é emitido para F1/F2 com a
        fonte parseada; `validate-state.js` e `find-missing-summaries.js`
        ignoram o sidecar `.json` em `phases/` (confirmar via teste: presença do
        sidecar não vira falso-positivo nem quebra a validação); o schema do
        plano valida; um plano legado materializado pela versão antiga segue
        lendo/validando (backward-compat)"
    verifier:
      kind: test
      runner: node --test
      pattern: tests/decompose-lazy.test.js
    outputs:
      - kind: file
        path: src/decompose.js
      - kind: file
        path: tests/decompose-lazy.test.js
    summary: materializeDecomposition escreve só F0; F1..N viram descritores
      subPhaseCount:0 com exitGate retido + sidecar phases/<slug>.source.json
      (captura não-validada, F-002).
    weight: 4
  - id: T-007
    title: Leitores distinguem descriptor-only de materializada (D1 blast radius)
    description: 'Atualiza os leitores para resolver fase→initiative de forma
      **lazy**: um phase descriptor sem arquivo de iniciativa correspondente em
      `phases/` é "descritor-only, pendente de materialização" — um estado
      válido e distinto de `tasks: []`. Tocar:
      `skills/shared/project-assets/project-view.md` (view `status` — fase
      descritor-only aparece como "pendente de materialização", não como
      iniciativa vazia), `skills/shared/project-assets/project-verify.md` (check
      que não FAILa em fase descritor-only), e o consumer dashboard (manifest a
      confirmar — aiDeck só lê, mantém agnóstico). A distinção é pela **ausência
      do arquivo de iniciativa**, nunca por `subPhaseCount`.'
    status: pending
    lastUpdated: 2026-06-29T13:19:41.314Z
    scopeBoundary:
      - as seções de leitura de fase→initiative em project-view.md e
        project-verify.md + novo teste; NÃO alterar aiDeck (agnóstico), NÃO
        mudar schemas, NÃO tocar lógica de mutação (transições)
    acceptance:
      - '`status` sobre um plano com F0 materializada + F1 descriptor-only
        mostra F1 como "pendente de materialização" (sem nextAction vazio
        mal-reportado); `verify` não FAILa nem WARNa como erro a fase
        descriptor-only; o detector `find-missing-business-intent.js` (F0/T-003)
        ignora fase descriptor-only; a projeção do consumer dashboard
        (dataSource do manifest, em estado versionado do consumer — aiDeck
        permanece agnóstico, só lê) não quebra em fase descriptor-only (gate
        manual F2-G2: abre como "pendente de materialização", não
        vazio/quebrado) — F-004 fecha o coverage-gap de dashboard nomeado no
        goal'
    verifier:
      kind: test
      runner: node --test
      pattern: tests/phase-materialization/descriptor-only-readers.test.js
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-view.md
      - kind: file
        path: skills/shared/project-assets/project-verify.md
      - kind: file
        path: tests/phase-materialization/descriptor-only-readers.test.js
    summary: status/verify (e a projeção do dashboard, gate manual F2-G2) resolvem
      fase sem arquivo como descritor-only, não como erro (F-004).
    weight: 2
parked: []
emerged: []
summary: new plan passa a materializar só F0; F1..N viram descritores
  (subPhaseCount:0) e os leitores distinguem descritor-only de materializada.
planTitle: Materialização lazy de fases + gate de validação de negócio
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F2 — Materialização lazy + leitores distinguem descriptor-only**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

