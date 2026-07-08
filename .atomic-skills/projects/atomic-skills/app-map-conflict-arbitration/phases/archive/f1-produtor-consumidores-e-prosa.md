---
schemaVersion: "0.1"
slug: app-map-conflict-arbitration-f1-produtor-consumidores-e-prosa
title: Produtor, consumidores e prosa
goal: O produtor emite witnesses[] com kind derivado-na-origem e resolution por
  valor+source; o mirror .md lista as N testemunhas; a prosa do §2 do
  design-brief deixa de prometer um --persist que persiste arbitragem; cobertura
  inclui o caso N≥3.
status: done
branch: plan/design-brief
started: 2026-06-16T18:38:32.145Z
lastUpdated: 2026-06-16T20:14:47Z
nextAction: null
parentPlan: app-map-conflict-arbitration
phaseId: F1
tasksDone: 2
tasksTotal: 2
gatesMet: 1
gatesTotal: 1
weightDone: 2
weightTotal: 2
exitGates:
  - id: F1-G1
    description: A reconstrução end-to-end emite witnesses 0.3 com N≥3 preservado e
      validável; o mirror lista as testemunhas; a prosa do §2 reflete a
      arbitragem programático-only.
    status: met
    metAt: 2026-06-16T20:14:47Z
    verifier:
      kind: shell
      command: node --test test/app-map/reconstruct.test.js test/app-map/persist.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T20:14:47Z
      passed: true
      exitCode: 0
      outputSummary: node --test test/app-map/reconstruct.test.js
        test/app-map/persist.test.js → tests 18, pass 18, fail 0
    verifierLabel: "shell: node --test test/app-map/reconstruct.test.js test/app-map/p…"
    evidenceSummary: passed · 2026-06-16
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
    status: done
    closedAt: 2026-06-16T19:56:38Z
    lastUpdated: 2026-06-16T19:56:38Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T19:56:38Z
      passed: true
      exitCode: 0
      outputSummary: node --test test/app-map/persist.test.js → tests 6, pass 6, fail
        0 (gate F1-G1 16/16, suite app-map 62/62; prosa §2 D6 corrigida +
        validate-skills 15/15)
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

## Self-review against code-quality gates (phase-done F1)

- **G1 read-before-claim:** cada task fechada cita a saída real do verifier (T-001 15/15, T-002 6/6, gate F1-G1 18/18); o review-code (local + codex) leu o diff/arquivos.
- **G2 soft-language:** claims de conclusão são evidência `passed:true`; handoff escaneado.
- **G6 reference-or-strike:** literais do handoff são comandos/paths/saídas verbatim.
- **Review gate (both):** local clean (0 findings) + codex cross-model 2 major (F-001 mirror `[object Object]`, F-002 conflito resolvido contado como unresolved) **corrigidos + verificados** (suite 64/64). reviewGate `passed` @ `5750d7d` mode `both`. Review file `.atomic-skills/reviews/2026-06-16-2014-app-map-conflict-arbitration-f1.md`.
- **Lessons:** candidatas distiladas dos findings cross-model — pendente de ratificação do operador.

## Session handoff

- **Narrative:** Fase F1 **DONE** e plano **plan-done** (status done). Produtor (witnesses[]+0.3), mirror (lista N testemunhas, render sem perda + conflito resolvido) e prosa §2 (D6) entregues. T-001/T-002 fechados por verifier; phase-done rodou (gate F1-G1 18/18 + review-code both com 2 major cross-model corrigidos + reviewGate). Resta: ratificar lessons + opção de arquivar o plano.
- **Decision log:** ver bloco Decisions — re-scope T-001/T-002 + witnesses com kind derivado-na-origem. T-002: mirrorMarkdown enumera `field: value (kind, source); …` por conflito; prosa §2 esclarece arbitragem programático-only (persistReconstruction grava as decisões; `--persist` é re-emissão não-interativa que NÃO grava arbitragem).
- **Single nextAction:** Ratificar as lessons da F1 (findings cross-model) e decidir arquivar o plano (`archive`) — o plano está `done`. Não há mais tarefas de implementação.
- **Verbatim state:** F1-G1 gate (met): `node --test test/app-map/reconstruct.test.js test/app-map/persist.test.js` → `tests 18, pass 18, fail 0`. Suite: `node --test test/app-map/*.test.js` → `tests 64, pass 64, fail 0`. State: `node scripts/validate-state.js .atomic-skills` → `✓ All 53 file(s) valid`. reviewGate F1: `passed` @ `5750d7d` mode `both`.
- **Uncommitted changes:** a confirmar — estado da transição phase-done/plan-done (plan.md + F1 initiative) a commitar neste passo.
