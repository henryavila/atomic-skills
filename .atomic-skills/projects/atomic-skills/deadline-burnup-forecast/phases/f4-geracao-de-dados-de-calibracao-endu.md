---
schemaVersion: "0.1"
slug: deadline-burnup-forecast-f4-geracao-de-dados-de-calibracao-endu
title: Geração de dados de calibração + endurecer closedAt
goal: "gravar os actuals crus por conclusão (calibração: só geração, tratamento
  depois) e promover closedAt de soft para hard no GATE-R2 quando a lacuna de
  instrumentação chegar perto de zero."
status: active
branch: plan/deadline-burnup-forecast
started: 2026-06-19T17:29:17Z
lastUpdated: 2026-06-19T17:29:17Z
nextAction: "Start T-001: — Actuals de fase no evento phase-done"
parentPlan: deadline-burnup-forecast
phaseId: F4
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 3
exitGates:
  - id: G-1
    description: actuals crus (fase E task/dispatch-log) são gravados por conclusão
      no sub-objeto admitido e closedAt é hard-gated forward-only via corte
      persistido (grandfatheredTaskIds) gravado pelo script de flip, sem
      rejeitar legado.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion-actuals.test.js && node --test
        tests/append-completion-dispatchlog.test.js && node --test
        tests/validate-state.test.js && node --test
        tests/harden-closedat.test.js && node --test tests/schema-drift.test.js
    verifierLabel: "shell: node --test tests/append-completion-actuals.test.js && node…"
stack:
  - id: 1
    title: Geração de dados de calibração + endurecer closedAt
    type: task
    openedAt: 2026-06-17T12:06:57.781Z
tasks:
  - id: T-001
    title: — Actuals de fase no evento phase-done
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-002
    title: — Actuals de task via dispatch-log quando presente
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-003
    title: — Promover closedAt para hard-gate no GATE-R2
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
parked: []
emerged: []
summary: Grava os actuals crus por conclusão (calibração futura) e endurece
  closedAt forward-only.
planTitle: Deadline Burn-up Forecast (Earned Value / SPI)
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F4 — Geração de dados de calibração + endurecer closedAt**.

## Decisions

_(record decisions here as they are made)_

## Session handoff
- **Narrative:** F4 recém-ativada no phase-done de F3 (commit `a3a8d8c`). Nenhuma task de F4 iniciada. F3 (deadline + buildSeries burnup/spi + wiring refresh-state) done+arquivada; gate F3/G-1 met (4 pass @12edc01), review `--mode=both` APROVADO (local 1C+2M + codex 1M, todos remediados), 2 lições ratificadas. Tree limpo.
- **Decision log:** (nenhuma decisão de F4 ainda). Herdado do feature já implementado: `appendCompletion` já admite o sub-objeto `actuals` (F0/T-002, pré-declarado p/ F4); `completions.jsonl` em `.atomic-skills/analytics/`; closedAt é soft-auditável (F1); `validateAideckState` valida cada linha de completions (parse + schema) e cobre burnup/spi.
- **Single nextAction:** Antes de iniciar F4: (1) ler a SPEC das tasks de F4 em `source.md` (seção F4, ~linha 172); (2) dispositionar as 9 lições de `node scripts/list-lessons.js --phase F4` — inclui **F3/L-001** (filtrar log multi-tipo por `event==='task-done'`; actuals de F4 leem o mesmo log) e **F2/L-001** (Number.isFinite em todo escalar emitido). Depois: Start F4/T-001 (Actuals de fase no evento phase-done). Routing: Codex (Mode 2) lane ON — mesmo fluxo serial de F3.
- **Verbatim state:** HEAD primary `a3a8d8c`. currentPhase=F4 (plan.md), F4 status active/current, tasksDone 0/3. Gate F4/G-1 verifier: `node --test tests/append-completion-actuals.test.js && node --test tests/append-completion-dispatchlog.test.js && node --test tests/validate-state.test.js && node --test tests/harden-closedat.test.js && node --test tests/schema-drift.test.js`. routing.json mode2 ON; codex-cli 0.141.0. Suíte: 927 tests, 913 pass, 8 fail PRÉ-EXISTENTES (install/countSkills — drift do plano skills-restructuring, fora de escopo). Padrões de execução Mode 2 (de F3): verifier in-worktree dá falso-fail `spawnSync EPERM` quando o teste spawna node → adjudicar no primary merged; `emit-consumer-state.js` é "binário" pro git (box-drawing) → merge-back via commit-no-worktree + `git merge --ff-only`, não patch.
- **Uncommitted changes:** clean tree (este snapshot é a única edição pendente).

## Links

_(plan doc, external refs)_
