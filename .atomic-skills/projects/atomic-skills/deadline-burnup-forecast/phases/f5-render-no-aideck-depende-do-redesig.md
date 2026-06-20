---
schemaVersion: "0.1"
slug: deadline-burnup-forecast-f5-render-no-aideck-depende-do-redesig
title: Render no aiDeck (depende do redesign do dashboard)
goal: "registrar os dataSources burnup/spi no manifest e uma página com
  line-chart (2 séries) + stat SPI, usando só widgets publicados. DEPENDÊNCIA
  EXTERNA: bloqueada até o redesign do dashboard (plano fix-aideck-dashboard,
  F2) aterrissar — o forecast só renderiza sobre o dashboard refeito; por isso é
  a última fase. As fases F0–F4 (instrumentação de tracking) são independentes e
  implementáveis já."
status: done
branch: plan/deadline-burnup-forecast
started: 2026-06-17T12:06:57.781Z
lastUpdated: 2026-06-20T10:14:59Z
nextAction: "F5 DONE via phase-done: G-1 met (verifier 30/30), review-code both
  APROVADO (C4 fix + C3/L1 follow-ups F3 corrigidos a pedido). PLANO CONCLUÍDO
  (6/6 fases done). Opcional: `archive` do plano (passo separado)."
parentPlan: deadline-burnup-forecast
phaseId: F5
tasksDone: 1
tasksTotal: 1
gatesMet: 1
gatesTotal: 1
weightDone: 1
weightTotal: 1
exitGates:
  - id: G-1
    description: a página de ritmo renderiza com widgets reais ligados a
      burnup.json/spi.json, sobre o dashboard refeito.
    status: met
    metAt: 2026-06-20T01:38:33Z
    verifier:
      kind: shell
      command: node --test tests/aideck-consumer-manifest.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-20T01:38:33Z
      passed: true
      exitCode: 0
      testsCollected: 30
      outputSummary: "F5 verifier on HEAD 54560eb — 30 pass / 0 fail (4 novos asserts
        F5: dataSources burnup/spi, seção Ritmo, line-chart 3 séries scoped por
        plano, SPI via gauge, todo widget no registry publicado). Guardrail de
        widgets 4/0. Manifest refeito presente via merge 8ab9c8a."
    verifierLabel: "shell: node --test tests/aideck-consumer-manifest.test.js"
    evidenceSummary: passed · 30 tests · 2026-06-20
externalImports:
  - kind: repo-path
    path: .atomic-skills/projects/atomic-skills/fix-aideck-dashboard/plan.md
    label: "BLOQUEANTE: o redesign do dashboard (fix-aideck-dashboard, F2) deve
      aterrissar antes do render — F5 não inicia sem o manifest refeito
      presente."
    inside_repo: true
stack:
  - id: 1
    title: Render no aiDeck (depende do redesign do dashboard)
    type: task
    openedAt: 2026-06-17T12:06:57.781Z
tasks:
  - id: T-001
    title: — dataSources + página burn-up no manifest
    status: done
    lastUpdated: 2026-06-20T01:38:33Z
parked: []
emerged: []
summary: Renderiza o burn-up/SPI no dashboard — bloqueada até o redesign do
  dashboard aterrissar.
planTitle: Deadline Burn-up Forecast (Earned Value / SPI)
---

# Narrative / notes

Initiative for phase **F5 — Render no aiDeck (depende do redesign do dashboard)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** **PLANO CONCLUIDO** — F5 `done` via phase-done; todas as 6 fases (F0-F5) done. O redesign do dashboard foi integrado (merge `8ab9c8a`); o T-001 (`54560eb`) adicionou dataSources `burnup`/`spi` + a secao "Ritmo" (line-chart 3 series + gauge spiProxy + key-value). O review-code both (`a3666aa`) aprovou com ressalvas; os 2 follow-ups de DADO F3 que ele achou foram corrigidos a pedido do usuario (`b3ade2d`): serie diaria densa (C3) + SPI reporta apos deadline (L1).
- **Decision log:** (a) Merge cirurgico: emitter de-binary (NUL->escape) p/ 3-way; combinou `buildSeries`+actuals (meus) com refactor read-time-agg+`fronts` (deles); `totals` aposentado; completei o gap deles (4 campos do projeto -> schema + `required`). (b) SPI via `gauge`/`key-value`, NAO `stat` (v2.1 bane `stat value:count()/field()`). (c) Review both: C4 fix (required), C1 rejeitado (oos+fp), C3+L1 corrigidos (path B do usuario). (d) `assets/aideck-consumer/schema.json` e GERADO -> regenerado.
- **Single nextAction:** Opcional — `archive` do plano (passo separado, move p/ Concluidos). Nada mais pendente. Validacao VISUAL do render Ritmo no dashboard local e alcada do usuario.
- **Verbatim state:** HEAD `b3ade2d`. Commits F5: `0c5cf06` prep, `8ab9c8a` merge, `54560eb` T-001, `f382e6c` state, `5fe175b` deadline, `a3666aa` review+C4, `b3ade2d` C3/L1. Verifier F5 `node --test tests/aideck-consumer-manifest.test.js` -> 30/0. Suite completa 963 pass / 8 PRE-EXISTENTES (skills-restructuring drift). Dados (emit pos-fixes): burnup do plano = 4 linhas densas (2026-06-17..20), plannedValue sobe 0->9.44, earnedCount 6, earnedProxy 0; spi {weightTotal:17, tasksTotal:17, deadline:2026-06-21, spiProxy:0, spiCount:0.54}. `spiProxy=0` e dado upstream (eventos count-basis => earnedProxy=0), nao bug. State files gitignored.
- **Uncommitted changes:** `plan.md` + `phases/f5-...md` (esta transicao phase-done: F5/plano done + reviewGate + gate met + handoff); resto commitado.
