---
schemaVersion: "0.1"
slug: app-map-conflict-arbitration-f1-produtor-consumidores-e-prosa
title: Produtor, consumidores e prosa
goal: O produtor emite witnesses[] com kind derivado-na-origem e resolution por
  valor+source; o mirror .md lista as N testemunhas; a prosa do §2 do
  design-brief deixa de prometer um --persist que persiste arbitragem; cobertura
  inclui o caso N≥3.
status: active
branch: plan/design-brief
started: 2026-06-16T18:38:32.145Z
lastUpdated: 2026-06-16T19:39:09Z
nextAction: "Start T-002: Consumidores — mirror .md das N testemunhas + prosa §2"
parentPlan: app-map-conflict-arbitration
phaseId: F1
tasksDone: 1
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F1-G1
    description: A reconstrução end-to-end emite witnesses 0.3 com N≥3 preservado e
      validável; o mirror lista as testemunhas; a prosa do §2 reflete a
      arbitragem programático-only.
    status: pending
    verifier:
      kind: shell
      command: node --test test/app-map/reconstruct.test.js test/app-map/persist.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test test/app-map/reconstruct.test.js test/app-map/p…"
stack:
  - id: 1
    title: Produtor, consumidores e prosa
    type: task
    openedAt: 2026-06-16T18:38:32.145Z
tasks:
  - id: T-001
    title: Produtor — conflictForField emite witnesses[] e catálogo 0.3
    status: done
    closedAt: 2026-06-16T19:54:19Z
    lastUpdated: 2026-06-16T19:54:19Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T19:54:19Z
      passed: true
      exitCode: 0
      outputSummary: node --test test/app-map/reconstruct.test.js
        test/app-map/persist.test.js → tests 15, pass 15, fail 0 (suite app-map
        completa 61/61)
    summary: conflictForField emite N witnesses com kind derivado-na-origem e
      catálogo 0.3.
    description: "Reescreve conflictForField/conflictsForPage para emitir
      witnesses[{value,source,kind}] (kind derivado: source casa
      codeEvidence.path → code, senão artefact), sem slots
      artefactValue/codeValue; buildCatalog emite schemaVersion 0.3. Files:
      src/app-map/reconstruct.js, src/app-map/persist.js,
      test/app-map/reconstruct.test.js, test/app-map/persist.test.js"
    scopeBoundary:
      - não alterar o schema (F0 fechou o contrato); não tocar
        src/app-map/validate.js.
      - não mudar o motor de divergência (fieldSources/agregação já entrega
        todas as sources — o bug era só na gravação em conflictForField).
      - buildCatalog passa a emitir schemaVersion 0.3 mas não muda os outros
        campos de página.
      - em persist.test.js só atualiza os fixtures/asserts de SAÍDA do produtor
        (buildPages→witnesses, schemaVersion 0.3) — o teste novo do
        mirrorMarkdown é T-002, não tocar mirrorMarkdown aqui.
    acceptance:
      - conflictForField retorna {field, witnesses, evidence, resolution} com
        witnesses cobrindo TODAS as sources do agregado (N=3
        admin/registered/guardian preservado, nenhuma descartada).
      - kind de cada testemunha é derivado-na-origem (source.path casa
        page.codeEvidence.path → code; senão artefact), nunca afirmado
        independentemente.
      - os slots artefactValue/codeValue deixam de ser emitidos.
      - resolution permanece 'pending' na emissão; resolution.choice (quando
        resolvido) referencia uma testemunha por value+source, não por índice.
      - buildCatalog emite schemaVersion "0.3" e o catálogo resultante passa
        assertValidAppMap.
    verifier:
      kind: shell
      command: node --test test/app-map/reconstruct.test.js test/app-map/persist.test.js
      expectExitCode: 0
  - id: T-002
    title: Consumidores — mirror .md das N testemunhas + prosa §2
    status: pending
    lastUpdated: 2026-06-16T19:19:00Z
    summary: Mirror .md lista as N testemunhas e a prosa §2 corrige a promessa do
      --persist.
    description: "mirrorMarkdown lista as N testemunhas (value+source+kind) por
      conflito; a prosa do §2 de design-brief.md deixa de prometer que --persist
      persiste arbitragem (D6 — arbitragem é programático-only). Files:
      src/app-map/persist.js, test/app-map/persist.test.js,
      skills/core/design-brief.md"
    scopeBoundary:
      - não alterar o produtor conflictForField/buildCatalog (T-001 fechou a
        saída 0.3) nem o schema/validador; só mirrorMarkdown em persist.js.
      - em persist.test.js só adiciona o teste do mirror — não tocar os fixtures
        de saída do produtor que T-001 migrou.
      - a edição da prosa limita-se ao §2 de design-brief.md (linhas 44–46) —
        não reabre §4/R2 nem a anti-contaminação.
      - não adicionar canal CLI --resolved (fora de escopo, D6).
    acceptance:
      - mirrorMarkdown lista, por conflito, as N testemunhas (value + source +
        kind) em vez de só a contagem "unresolved conflicts N".
      - um catálogo 0.3 com um conflito de 3 testemunhas produz um mirror que
        cita as 3.
      - a prosa do §2 esclarece que a arbitragem é aplicada programaticamente (o
        agente passa páginas resolvidas a persistReconstruction) e que --persist
        é re-emissão não-interativa (D6).
      - a string --persist não aparece mais como o passo que grava a decisão do
        operador no §2.
      - os testes de produtor que T-001 migrou seguem verdes.
    verifier:
      kind: shell
      command: node --test test/app-map/persist.test.js
      expectExitCode: 0
parked: []
emerged: []
planTitle: "app-map: descritor de conflito rico + canal de arbitragem"
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Produtor, consumidores e prosa**.

## Decisions

- **Re-scope T-001/T-002 (2026-06-16, aprovado pelo operador):** `buildCatalog`→0.3 (T-001) quebra `persist.test.js` (asseria 0.2 + slots legacy), que o SPEC pusera em T-002. Sem split disjunto (witnesses[] exige 0.3; 0.3 rejeita slots). T-001 passou a dono dos testes de SAÍDA do produtor (reconstruct.test.js + persist.test.js, verifier roda os dois); T-002 estreitou para mirrorMarkdown + prosa §2. source.md + phase file atualizados, SPEC gate re-rodado limpo.
- **T-001 impl:** `conflictForField` mapeia TODAS as `aggregate.sources` para `witnesses[{value, source: sourceLabel, kind}]`, ordenadas por source (determinismo); `kind` derivado (source.path casa codeEvidence.path → code, senão artefact). `buildCatalog` emite `schemaVersion: '0.3'`. Sem slots artefactValue/codeValue. Teste doc/doc reescrito p/ witnesses preservando o intent de proveniência (L-001/f2: todas artefact, nenhuma code fabricada).

## Links

- Source SPEC: `.atomic-skills/projects/atomic-skills/app-map-conflict-arbitration/source.md`
- DESIGN: `.atomic-skills/projects/atomic-skills/app-map-conflict-arbitration/design.md`
- Lessons aplicadas (F1 phase-start): L-002/f2 (conjunto de testemunhas, não 2 slots), L-001/f2 (testar proveniência honesta), L-001/f1 (teste de I/O real — reconstruct.test.js usa tmp dir).

## Session handoff

- **Narrative:** Fase F1 ativa, **1/2 tasks done**. T-001 (produtor) implementado RED→GREEN: `conflictForField`→witnesses[] + `buildCatalog`→0.3; verifier reconstruct+persist 15/15, suite app-map 61/61. Próximo: T-002 (mirror + prosa). Houve re-scope aprovado movendo a fronteira persist.test.js para T-001.
- **Decision log:** ver bloco Decisions acima — re-scope T-001/T-002 + a impl de witnesses com kind derivado-na-origem ordenado por source.
- **Single nextAction:** Implementar F1/T-002 — RED em `test/app-map/persist.test.js` (mirror de conflito 0.3 com 3 testemunhas cita as 3 com kind), depois ajustar `mirrorMarkdown` em `src/app-map/persist.js` p/ iterar witnesses; corrigir a prosa do §2 de `skills/core/design-brief.md` (linhas 44–46, D6 — `--persist` não persiste arbitragem); fechar via `node --test test/app-map/persist.test.js` → EXIT 0.
- **Verbatim state:** T-001 verifier: `node --test test/app-map/reconstruct.test.js test/app-map/persist.test.js` → `tests 15, pass 15, fail 0`. Suite: `node --test test/app-map/*.test.js` → `tests 61, pass 61, fail 0`. State: `node scripts/validate-state.js .atomic-skills` → `✓ All 53 file(s) valid`. T-002 verifier: `node --test test/app-map/persist.test.js` (expectExitCode 0).
- **Uncommitted changes:** a confirmar — código de T-001 (reconstruct.js, persist.js, reconstruct.test.js, persist.test.js) + estado F1 a commitar neste passo.
