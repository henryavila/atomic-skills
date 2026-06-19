---
schemaVersion: "0.1"
slug: deadline-burnup-forecast-f3-serie-earned-vs-planned-deadline-wi
title: Série earned-vs-planned + deadline + wiring de recompute
goal: adicionar plan.deadline, computar a série burn-up (earned acumulado vs
  linha planejada linear) e o SPI no emit, e ligar o recompute ao refresh-state
  (fechando o gap em que ele só chama emitFocus).
status: active
branch: plan/deadline-burnup-forecast
started: 2026-06-19T12:50:33Z
lastUpdated: 2026-06-19T12:50:33Z
nextAction: "Start T-001: — Campo deadline no plano + rebuild do bundle"
parentPlan: deadline-burnup-forecast
phaseId: F3
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 3
exitGates:
  - id: G-1
    description: a série earned-vs-planned + SPI é emitida e recomputada
      automaticamente pelo refresh-state, com deadline no schema.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/emit-series.test.js && node --test
        tests/refresh-state.test.js
    verifierLabel: "shell: node --test tests/emit-series.test.js && node --test tests/…"
stack:
  - id: 1
    title: Série earned-vs-planned + deadline + wiring de recompute
    type: task
    openedAt: 2026-06-17T12:06:57.781Z
tasks:
  - id: T-001
    title: — Campo deadline no plano + rebuild do bundle
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-002
    title: "— buildSeries: burnup.json + spi.json"
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-003
    title: — Ligar emit ao refresh-state sem regredir emitFocus
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
parked: []
emerged: []
summary: Computa a série earned-vs-planejada e o SPI contra o deadline,
  recomputada no refresh-state.
planTitle: Deadline Burn-up Forecast (Earned Value / SPI)
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F3 — Série earned-vs-planned + deadline + wiring de recompute**.

## Decisions

_(record decisions here as they are made)_

## Session handoff
- **Narrative:** F3 recém-ativada no phase-done de F2 (commit `a54aa8c`). Nenhuma task de F3 iniciada ainda. F2 (peso por task: weight + rollups weightDone/weightTotal + projeção emit + auditor) está done+arquivada; gate F2/G-1 met (20 pass), review APPROVED, lição L-001 ratificada. Tree limpo.
- **Decision log:** (nenhuma decisão de F3 ainda). Herda do feature: weightDone/weightTotal já existem no schema (source + projeção) e em rollups; `compute-rollups.weightOf` usa `Number.isFinite(x) && x >= 0` (degrada task sem weight → 1). F3 vai computar a série earned (acumulado de weightDone) vs linha planejada CRESCENTE 0→weightTotal + SPI, e ligar emit-consumer-state ao refresh-state (gap atual: refresh-state roda rollups+reconcile+emitFocus mas NÃO invoca emit-consumer-state).
- **Single nextAction:** Antes de iniciar F3: (1) ler a SPEC das tasks de F3 em `source.md` (seção F3, linha ~136); (2) dispositionar as 6 lições de `node scripts/list-lessons.js --phase F3` (Apply/Keep/Stale/Reject) — inclui F2/L-001 (guardar números novos do emit com `Number.isFinite`, aplicável aos escalares SPI/série). Depois: Start F3/T-001 (Campo deadline no plano + rebuild do bundle).
- **Verbatim state:** HEAD primary `a54aa8c`. currentPhase=F3 (plan.md), F3 status active, tasksDone 0/3. Verifier do gate F3/G-1: `node --test tests/emit-series.test.js && node --test tests/refresh-state.test.js`. routing.json: Mode 2/Codex lane ON (executor padrão). Suite: 8 falhas PRÉ-EXISTENTES (install/countSkills — drift de contagem do plano skills-restructuring, fora de escopo); F2 = 0 regressões.
- **Uncommitted changes:** clean tree (este handoff é a única edição pendente no snapshot).

## Links

- plan: `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/plan.md`
- source (SPEC F3): `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md` (seção F3, ~linha 136)
- lições aplicáveis: `node scripts/list-lessons.js --phase F3`
