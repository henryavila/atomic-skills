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
nextAction: "Start T-007: Leitores distinguem descriptor-only de materializada
  (project-view.md + project-verify.md + descriptor-only-readers.test.js)"
parentPlan: phase-materialization
phaseId: F2
tasksDone: 2
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 6
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
    status: done
    lastUpdated: 2026-07-01T09:30:32.000Z
    closedAt: 2026-07-01T09:30:32.000Z
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
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-01T09:30:32.000Z
      passed: true
      exitCode: 0
      testsCollected: 10
      outputSummary: node --test tests/decompose-lazy.test.js → exit 0; ℹ tests 10 /
        pass 10 / fail 0 (1 suite). materializeDecomposition (always-lazy) emite
        1 plano + 1 iniciativa (F0) + sidecar phases/<slug>.source.json por fase
        F1..N; phases[] F0 subPhaseCount=tasks, F1/F2=0 com exitGate retido;
        validate-state.js + find-missing-summaries.js ignoram o .json (F-002);
        decompose.test.js atualizado (byte-identity F0 preservada + shape lazy);
        suíte cheia npm test 1489 tests / 0 fail.
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
    status: done
    lastUpdated: 2026-07-01T09:48:37.000Z
    closedAt: 2026-07-01T09:48:37.000Z
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
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-01T09:48:37.000Z
      passed: true
      exitCode: 0
      testsCollected: 5
      outputSummary: node --test
        tests/phase-materialization/descriptor-only-readers.test.js → exit 0; ℹ
        tests 5 / pass 5 / fail 0. Pinning test sobre árvore descritor-only
        (materializeDecomposition lazy — plano + iniciativa F0 + sidecar F1/F2,
        sem iniciativa F1/F2) — validate-state
        validateFile/collectTargets/crossValidate não FAILam em F1/F2 (só
        done-phases checadas); find-missing-business-intent ignora F1/F2 (D5,
        sem arquivo de iniciativa); distinção pela ausência do arquivo, não
        subPhaseCount. Prose em project-view.md (--phase/--plan renderizam
        pendente-de-materialização) + project-verify.md (descritor-only é
        válido). validate-skills 15/15; npm test 1494/0 fail.
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

- **always-lazy (não opt-in flag) — T-006.** `materializeDecomposition` materializa só F0 incondicionalmente (D1), não via `opts.lazy`. Razão: (a) a aceitação de T-006 ponto 1 diz "emite exatamente 1 initiative file" sem condição; (b) o ponto 6 de backward-compat é sobre plano legado já em disco (intocado), não sobre o default da função; (c) um flag opt-in exigiria wirear `new plan` (fora do scopeBoundary de T-006) para a aceitação valer. Custo: 5 asserções do `decompose.test.js` que codificavam o contrato não-lazy foram atualizadas (byte-identity agora em F0; shape/colisão/validate refletem lazy); F0 segue byte-idêntico (R-ORCH-10 preservado).
- **Conteúdo do sidecar = iniciativa parseada por-fase.** O sidecar `phases/<slug>.source.json` captura `{captureVersion, phaseId, slug, title, goal, tasks, exitGates}` — exatamente o dado que `materializeDecomposition` tem in-scope (`decompose.initiatives[idx]`). A fonte markdown bruta por-fase NÃO é retida por `decomposePlan` (consumida por `decomposeOnePhase`), e tocar `decomposePlan`/`decomposeOnePhase` está fora do escopo (F1/P1). É o que o verbo `materialize` (F3) consome sem re-parsear o doc.
- **`writePhaseSourceSidecar` guarda o namespace de slug compartilhado.** Dois descritores com o mesmo slug teriam colisão diferida (o `materialize` de F1 depois sobrescreveria F0); o guard de slug up-front preserva a garantia do `writeInitiativeFile` através da fronteira lazy (testes de colisão F-001 seguem verde).

## Session handoff

- **Narrative:** F2 (Materialização lazy). T-006 FECHADO e verificado — `materializeDecomposition` agora é always-lazy (materializa só F0; F1..N viram descritores `subPhaseCount:0` + sidecar `phases/<slug>.source.json`). Próxima task pendente: T-007 (leitores distinguem descritor-only de materializada). Nenhuma task em mid-flight.
- **Decision log:** sempre-lazy (não flag opt-in); sidecar = iniciativa parseada por-fase; guard de slug no sidecar — ver `## Decisions` acima.
- **Single nextAction:** Iniciar **T-007**: editar `skills/shared/project-assets/project-view.md` (status mostra fase descritor-only como "pendente de materialização") + `skills/shared/project-assets/project-verify.md` (não FAILa em descritor-only) + criar `tests/phase-materialization/descriptor-only-readers.test.js` (verifier `node --test`).
- **Verbatim state:** Verifier de T-006 executado: `node --test tests/decompose-lazy.test.js` → EXIT=0, ℹ tests 10 / pass 10 / fail 0; `evidence.passed:true`, `testsCollected:10`. Suíte cheia `npm test` → 1489 tests / 0 fail / 8 skipped. `node scripts/validate-state.js .atomic-skills/projects/atomic-skills/phase-materialization/phases/f2-materializacao-lazy-leitores-distingue.md` → "All 1 file(s) valid". Rollups: tasksDone 1/2, weightDone 4/6. Commits: `d7671f3` (feat code+test), `e7e489a` (checkpoint state). Próximo verifier (T-007): `node --test tests/phase-materialization/descriptor-only-readers.test.js`.
- **Uncommitted changes:** clean tree (T-006 committed; este handoff é o próximo commit `docs(project)`).

## Links

_(plan doc, external refs)_

