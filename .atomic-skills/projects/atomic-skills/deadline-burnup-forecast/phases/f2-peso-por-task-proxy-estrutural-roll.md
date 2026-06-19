---
schemaVersion: "0.1"
slug: deadline-burnup-forecast-f2-peso-por-task-proxy-estrutural-roll
title: "Peso por task: proxy estrutural + rollups"
goal: introduzir tasks[].weight (number, opcional, default=1) AUTORADO pelo
  modelo no Stage 6 da decomposição (prosa, como os summaries; NUNCA por
  src/decompose.js congelado) de sinais estruturais e auditor-enforced, com
  rollups weightDone/weightTotal espelhando tasksDone/tasksTotal.
status: active
branch: plan/deadline-burnup-forecast
started: 2026-06-19T11:20:50Z
lastUpdated: 2026-06-19T11:20:50Z
nextAction: "Start T-001: — Campo weight no schema da task + rebuild do bundle"
parentPlan: deadline-burnup-forecast
phaseId: F2
tasksDone: 3
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-1
    description: weight existe no schema (task) e weightDone/weightTotal são
      admitidos (source + projeção), somados em rollups e emitidos sem drift,
      com auditor de backfill.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/schema-drift.test.js && node --test
        tests/compute-rollups.test.js && node --test
        tests/emit-consumer-state.test.js
    verifierLabel: "shell: node --test tests/schema-drift.test.js && node --test tests…"
stack:
  - id: 1
    title: "Peso por task: proxy estrutural + rollups"
    type: task
    openedAt: 2026-06-17T12:06:57.781Z
tasks:
  - id: T-001
    title: — Campo weight no schema da task + rebuild do bundle
    status: done
    closedAt: 2026-06-19T12:11:52Z
    lastUpdated: 2026-06-19T12:11:52Z
    verifier:
      kind: shell
      command: node --test tests/schema-drift.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T12:11:52Z
      passed: true
      exitCode: 0
      testsCollected: 1
      outputSummary: node --test tests/schema-drift.test.js — 1 pass, 0 fail (re-run
        on MERGED primary f844dde; bundle in sync, no drift)
  - id: T-002
    title: — Rollups weightDone/weightTotal
    status: done
    closedAt: 2026-06-19T12:18:39Z
    lastUpdated: 2026-06-19T12:18:39Z
    verifier:
      kind: shell
      command: node --test tests/compute-rollups.test.js && node --test
        tests/emit-consumer-state.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T12:18:39Z
      passed: true
      exitCode: 0
      testsCollected: 18
      outputSummary: compute-rollups 3 pass + emit-consumer-state 15 pass (incl.
        validateAideckState round-trip carrying weightDone/weightTotal — no
        drift), 0 fail (re-run on MERGED primary 8569c76)
  - id: T-003
    title: — Auditor de tasks sem weight (backfill replicável)
    status: done
    closedAt: 2026-06-19T12:12:55Z
    lastUpdated: 2026-06-19T12:12:55Z
    verifier:
      kind: shell
      command: node --test tests/find-unweighted-tasks.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T12:12:55Z
      passed: true
      exitCode: 0
      testsCollected: 3
      outputSummary: node --test tests/find-unweighted-tasks.test.js — 3 pass, 0 fail
        (re-run on MERGED primary df3ca7f; flags absent/non-number weight,
        weight:0 valid)
parked: []
emerged: []
summary: Dá peso de complexidade a cada task (proxy automático) e soma em
  rollups weightDone/Total.
planTitle: Deadline Burn-up Forecast (Earned Value / SPI)
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F2 — Peso por task: proxy estrutural + rollups**.

## Decisions

- **D-F2-1 — Campos `weight` opcionais, fora de `required` (T-001).** `weight` (number, minimum 0) em `$defs.task.properties`; `weightDone`/`weightTotal` (number) no top-level de `initiative.schema.json` E em `$defs.initiatives.properties` de `aideck-state.schema.json`. NENHUM entra em array `required` (scopeBoundary T-001: backward-compat 0.1; emit produz sempre, mas schema admite ausência → estado emitido legado continua válido).
- **D-F2-2 — Degradação count-burnup (T-002).** `rollupsFor()` soma `weight ?? 1` por task (weightTotal = todos; weightDone = só `status:done`). Sem nenhum weight ⇒ weightTotal===tasksTotal, weightDone===tasksDone. `ROLLUP_KEYS` estende com `weightDone`,`weightTotal` (strip+reinsert canônico → idempotente).
- **D-F2-3 — Projeção emit degrada via `??` (T-002).** Em `emit-consumer-state.js` buildState: `weightDone: Number(fm.weightDone ?? tDone)`, `weightTotal: Number(fm.weightTotal ?? tTotal)` (reusa os locais `tDone`/`tTotal` já computados; cai para count quando o rollup ponderado estiver ausente).
- **D-F2-4 — T-002 depende de T-001.** `validateAideckState` carrega `assets/aideck-consumer/schema.json` (o bundle, validate-aideck-state.js:29). A projeção com `weightDone`/`weightTotal` só valida após T-001 admitir os campos em `$defs.initiatives` E regenerar o bundle (`npm run build:aideck-schema`). Por isso T-002 é seeded do HEAD pós-merge de T-001.
- **D-F2-5 — T-003 espelha find-missing-task-summaries (read-only).** `find-unweighted-tasks.js` = cópia de `find-missing-task-summaries.js` com predicado `typeof t.weight === 'number'` (ausente/não-número ⇒ unweighted, exit 1). NÃO importa `configuredLanguage` (weight é número, não prosa). NÃO toca `src/decompose.js` (congelado, R-ORCH-10). Ponto de atribuição ancorado em Stage 6 de `project-create-plan.md` (irmão do parágrafo "Task summaries", linha ~124).

## Session handoff
- **Narrative:** F2 (índice 3/6), via Mode 2 / Codex lane — **as 3 tasks fechadas** (T-001 schema+bundle, T-003 auditor+doc, T-002 rollups+emit). Cada uma: Codex em worktree isolado → Opus revisou diff → merge serial (cherry-pick) → re-verify no MERGED primary → `done` com evidência. **tasksDone 3/3, gate G-1 ainda pending.** Falta: telemetria dispatch-log + `phase-done` (gate G-1 + review-code).
- **Decision log:** D-F2-1..5 acima. Merge-back = commit-no-worktree + `git cherry-pick` (linear, estilo F1). Codex in-worktree bate `spawnSync EPERM` (sandbox bloqueia child_process) — ambiental; só conta o re-run no MERGED primary. Verifiers no primary: T-001 1 pass @f844dde, T-003 3 pass @df3ca7f, T-002 (3+15) pass @8569c76. **Backfill one-time:** o `done` de T-002 + refresh-state adicionou `weightDone`/`weightTotal` a TODAS as initiatives do tree (38) — verificado LOSSLESS (frontmatter parseado idêntico módulo as chaves weight) e idempotente; commitado junto.
- **Single nextAction:** Escrever os 3 registros de telemetria em `.atomic-skills/status/dispatch-log.json` (T-001/T-003/T-002, executor codex, verifierPassed true), depois rodar `phase-done` para F2 (executa gate G-1 + review-code do diff da fase + advance para F3).
- **Verbatim state:** HEAD primary `8569c76` (T-001 feat f844dde + close c1442db + T-003 feat df3ca7f + close 545de0e + T-002 feat 8569c76). Gate G-1 verifier: `node --test tests/schema-drift.test.js && node --test tests/compute-rollups.test.js && node --test tests/emit-consumer-state.test.js`. Worktree `dbf-f2-t-002` ainda registrado — remover no cleanup (T-001/T-003 já removidos). dispatch-log.json AINDA não escrita.
- **Uncommitted changes:** pendente = este handoff + `done` de T-002 (phase file) + focus.json + backfill weight em 38 initiatives, prestes a commitar como `chore(forecast): close F2/T-002`.

## Links

- plan: `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/plan.md`
- source (interior SPEC das tasks): `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md` (seção F2, linhas 101-134)
