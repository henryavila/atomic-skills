---
schemaVersion: "0.1"
slug: deadline-burnup-forecast-f1-closedat-forward-only-auditor-soft
title: "closedAt forward-only: auditor soft + emissão"
goal: tornar closedAt auditável (soft, mede a lacuna de instrumentação) e
  emiti-lo na projeção de task do dashboard, sem backfill cosmético e sem
  hard-gate ainda.
status: active
branch: plan/deadline-burnup-forecast
started: 2026-06-17T19:14:53Z
lastUpdated: 2026-06-19T09:03:39Z
nextAction: "Start F1/T-002: emit closedAt+lastUpdated na projeção de task (scripts/emit-consumer-state.js) — T-003 já mergeada"
parentPlan: deadline-burnup-forecast
phaseId: F1
tasksDone: 2
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: closedAt é auditável (soft) e closedAt+lastUpdated são emitidos na
      projeção e admitidos no schema (sem drift, schema-drift no gate); nenhum
      closedAt retroativo é inventado.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/find-unclosed-done.test.js && node --test
        tests/emit-consumer-state.test.js && node --test
        tests/schema-drift.test.js
    verifierLabel: "shell: node --test tests/find-unclosed-done.test.js && node --test…"
stack:
  - id: 1
    title: "closedAt forward-only: auditor soft + emissão"
    type: task
    openedAt: 2026-06-17T12:06:57.781Z
tasks:
  - id: T-001
    title: — Auditor da lacuna de instrumentação
    status: done
    closedAt: 2026-06-19T09:02:11Z
    lastUpdated: 2026-06-19T09:02:11Z
    verifier:
      kind: shell
      command: node --test tests/find-unclosed-done.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T09:02:11Z
      passed: true
      exitCode: 0
      testsCollected: 4
      outputSummary: node --test tests/find-unclosed-done.test.js — 4 pass, 0 fail (re-run on MERGED primary beec974)
  - id: T-002
    title: — Emitir closedAt e lastUpdated na projeção de task
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-003
    title: — Admitir closedAt na projeção do schema emitido + rebuild do bundle
    status: done
    closedAt: 2026-06-19T09:03:39Z
    lastUpdated: 2026-06-19T09:03:39Z
    verifier:
      kind: shell
      command: node --test tests/schema-drift.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T09:03:39Z
      passed: true
      exitCode: 0
      testsCollected: 1
      outputSummary: node --test tests/schema-drift.test.js — 1 pass, 0 fail (re-run on MERGED primary d55f540)
parked: []
emerged: []
summary: Torna closedAt auditável (soft) e o emite na projeção, sem backfill cosmético.
planTitle: Deadline Burn-up Forecast (Earned Value / SPI)
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — closedAt forward-only: auditor soft + emissão**.

## Decisions

- **D1 — Routing:** as 3 tasks F1 limpam o gate F1 (spec-ready: paths exatos, scopeBoundary, acceptance) + F2 (verifier `kind: shell` determinístico) e nenhuma toca `.atomic-skills/` (Files em `scripts/`, `tests/`, `meta/schemas/`, `assets/`). `routing.json` mantém Mode 2 default permanente ⇒ todas via **Codex (Mode 2)**, worktrees isolados, merge-back serial.
- **D2 — Resolução de spec T-001:** o `scopeBoundary` diz "ignora `_archive-legacy`", mas a convenção real do repo é `phases/archive/`. Resolvido seguindo o padrão de `scripts/find-signalless-tasks.js`: varrer `phases/*.md` **não-recursivamente** ⇒ o subdir `archive/` (fases arquivadas/legadas) fica naturalmente fora, sem hardcode de nome de pasta. Auditor mede só a lacuna de instrumentação das fases VIVAS.
- **D3 — Ordem:** T-001 e T-003 são scope-disjuntos (T-001: `scripts/find-unclosed-done.js`+test; T-003: `meta/schemas/aideck-state.schema.json`+bundle) ⇒ worktrees concorrentes permitidos (§2 da lane). T-002 depende de T-003 (`validateAideckState` precisa do bundle já admitindo os campos) ⇒ despachada só após T-003 mergeada. Merge-back sempre serial.

## Session handoff
- **Narrative:** F1 em andamento, **2/3 tasks done**. T-001 (`find-unclosed-done.js` auditor, via Codex) fechada — verificada no primary `beec974` (4 pass). T-003 (schema `$defs.tasks` admite `closedAt`+`lastUpdated` + bundle rebuild, via Codex) fechada — schema-drift verificado no primary `d55f540` (1 pass). HEAD `8454d16`, tree limpa. Falta só **T-002** (emitir os dois campos na projeção), que dependia de T-003 (agora mergeada). Primeiros 2 eventos `task-done` reais gravados em `completions.jsonl`.
- **Decision log:** D1 (Mode 2 para as 3), D2 (T-001 ignora `archive/` via scan não-recursivo de `phases/*.md`), D3 (T-001‖T-003 concorrentes → merge serial → T-002). Ver acima.
- **Single nextAction:** Despachar Codex para F1/T-002 em worktree `/home/henry/atomic-skills/.worktrees/dbf-f1-t-002` (branch `dbf/f1-t-002`) off `8454d16`; adicionar `closedAt: t.closedAt ?? null` e `lastUpdated: t.lastUpdated ?? null` ao push de task em `scripts/emit-consumer-state.js`; verify `node --test tests/emit-consumer-state.test.js`; merge → re-verify no primary → `done T-002`.
- **Verbatim state:** verifier T-002 — `node --test tests/emit-consumer-state.test.js`. Push de task em `scripts/emit-consumer-state.js` (~L253-268), hoje emite id/title/summary/status/blocked/blockedBy/blockedByText. Schema `$defs.tasks` já admite `closedAt`/`lastUpdated` como `["string","null"]` (T-003, commit `d55f540`). Bundle `assets/aideck-consumer/schema.json` regenerado.
- **Uncommitted changes:** clean tree (este edit no handoff é a única mudança pendente).

## Links

- Plano: `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/plan.md`
- SPEC: `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md` (F1 = L66-99)
