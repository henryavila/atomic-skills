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
tasksDone: 2
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
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
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
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
- **Narrative:** F2 (índice 3/6), via Mode 2 / Codex lane. T-001 (schema+bundle) e T-003 (auditor+doc) despachadas em worktrees Codex concorrentes (scope-disjuntas), AMBAS já fechadas: merge serial (cherry-pick), re-verify no MERGED primary, `done`. **tasksDone 2/3.** Falta só T-002 (rollups weightDone/weightTotal + emit + 2 tests, standard) — seeded do HEAD pós-T-001 (dependência D-F2-4: validateAideckState carrega o bundle).
- **Decision log:** ver D-F2-1..5 acima (settladas por Opus pré-dispatch; Codex recebe-as como intent). Merge-back via commit-no-worktree + `git cherry-pick <branch>` (histórico linear, estilo F1). Verifier in-worktree do Codex bate `spawnSync EPERM` (sandbox bloqueia child_process) — ambiental; o único check suficiente é o re-run no MERGED primary (T-001 1 pass @f844dde, T-003 3 pass @df3ca7f).
- **Single nextAction:** Despachar Codex para T-002 em worktree `~/atomic-skills/.worktrees/dbf-f2-t-002` (branch `dbf/f2-t-002`) seeded do HEAD ATUAL (`df3ca7f`, já tem schema+bundle de T-001); briefing pré-autorado em `/tmp/dbf-f2-t-002-briefing.md`; depois merge serial + re-verify + `done` + telemetria + `phase-done`.
- **Verbatim state:** HEAD primary `df3ca7f` (= T-001 feat `f844dde` + close `c1442db` + T-003 feat `df3ca7f`). T-002 verifier: `node --test tests/compute-rollups.test.js && node --test tests/emit-consumer-state.test.js` (`tests/compute-rollups.test.js` NÃO existe — T-002 cria). Gate G-1 (phase-done): `node --test tests/schema-drift.test.js && node --test tests/compute-rollups.test.js && node --test tests/emit-consumer-state.test.js`. Worktrees Codex de T-001/T-003 ainda registrados — remover (`git worktree remove` + `prune`) no cleanup. Telemetria dispatch-log.json AINDA não escrita (batch ao final, estilo F1).
- **Uncommitted changes:** ao fazer este snapshot, pendente = este edit + o `done` de T-003 (focus.json + phase file), prestes a commitar como `chore(forecast): close F2/T-003`.

## Links

- plan: `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/plan.md`
- source (interior SPEC das tasks): `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md` (seção F2, linhas 101-134)
