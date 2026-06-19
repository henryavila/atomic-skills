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
lastUpdated: 2026-06-19T15:32:42Z
nextAction: "Dispatch Codex (Mode 2) para T-002 (buildSeries: burnup.json + spi.json)
  em novo worktree; work-order DEVE carregar L-001 (Number.isFinite nos escalares
  emit: plannedValue/earnedCount/earnedProxy/spiProxy/spiCount) + L-003 (teste em
  tests/ plural); merge-back serial; re-verificar no primary: node --test
  tests/emit-series.test.js && node --test tests/schema-drift.test.js"
parentPlan: deadline-burnup-forecast
phaseId: F3
tasksDone: 1
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
weightDone: 1
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
    status: done
    closedAt: 2026-06-19T15:31:04Z
    lastUpdated: 2026-06-19T15:31:04Z
    verifier:
      kind: shell
      command: node --test tests/schema-drift.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T15:31:04Z
      passed: true
      exitCode: 0
      testsCollected: 1
      outputSummary: node --test tests/schema-drift.test.js — 1 test, 1 pass, 0 fail
        (re-run on MERGED primary 228acbe; bundle in sync, no drift). Executor
        Codex Mode2 worktree codex/f3-t001; sandbox EPERM no in-worktree run
        (spawnSync), adjudicado no primary.
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

- **Disposição das 6 lições F3 (phase-start):** L-001 (F2, non-finite→null) **APPLY** — guardar todo escalar numérico novo que chega à projeção emitida (`plannedValue`, `earnedCount`, `earnedProxy`, `spiProxy`, `spiCount`) com `Number.isFinite(x) && x >= 0`, não só `typeof === number` (aplica em T-002). L-003 (design-brief, test/ vs tests/) **APPLY** — testes novos em `tests/` plural (SPEC já especifica `tests/emit-series.test.js`); confirmar que `npm test` descobre. L-001 (design-brief, review local perde majors de contrato) **KEEP** — no phase-done de F3 considerar `review-code --mode=both` (F3 adiciona $defs de schema = porta de mão única). L-002 (F0, discriminator) **KEEP** — modelar SPI null-vs-number limpo no schema (borda → null). L-002 (design-brief, schemaVersion enum) **KEEP background** — F3 não introduz novo campo schemaVersion. L-004 (design-brief, unicidade sub-campo array) **STALE p/ F3** — sem unicidade de sub-campo nesta fase.
- **Routing F3 = Codex (Mode 2):** confirmado pelo usuário (lane ON em routing.json, sem opt-out). Os 3 tasks são **acoplados** (T-001 e T-002 escrevem o mesmo bundle `assets/aideck-consumer/schema.json`; T-002 lê `deadline`/`weightTotal`; T-003 liga o emit que T-002 cria) → execução **serial**, worktrees um de cada vez, merge-back serial (R-XAGENT-03). Sem paralelismo.
- **T-001 design (settled):** `deadline` = campo opcional `{ "$ref": "common.schema.json#/$defs/isoTimestamp" }` em `meta/schemas/plan.schema.json` (NÃO em required[]); regen do bundle via `npm run build:aideck-schema`. O gerador (`scripts/build-aideck-consumer-schema.mjs`) incorpora plan.schema → bundle muda → regen obrigatório senão `schema-drift --check` falha.
- **CONTRADIÇÃO RESOLVIDA (burn-up direction):** `design.md` D5 dizia burn-DOWN (`weightTotal`→0); SPEC F3 diz burn-UP (0→`weightTotal`, EVM). Surfaçado ao usuário → escolha "SPEC + corrigir design.md". `design.md` D5 corrigido (commit `e1fdd8a`). Implementação segue burn-up.
- **T-002 design (settled, ratificado pelo usuário):** O emitter é whole-tree (sem filtro de plano hoje) → `buildSeries()` **agrupa por (projectId, planSlug)**, registros taggeados por plano (como `plans.json`). Por plano: `weightTotal` **plan-wide** = Σ `weightOf(task)` sobre todas as tasks de todas as fases (live+archive), `weightOf = Number.isFinite(w)&&w>=0 ? w : 1` (**L-001**); `tasksTotal` plan-wide = contagem de tasks. buckets = dias UTC distintos com ≥1 evento (esparso). `earnedCount`/`earnedProxy` = soma ACUMULADA de `weight` por `weightBasis` 'count'/'proxy' (séries SEPARADAS). `plannedValue(dia) = deadline ? weightTotal*clamp((dia−started)/(deadline−started),0,1) : null` (CRESCENTE). **burnup.json** = `{projectId,planSlug,date,plannedValue|null,earnedCount,earnedProxy}`. **spi.json** (1/plano) = `{projectId,planSlug,asOf,spiProxy|null,spiCount|null}`; `spiProxy = earnedProxyNow/plannedNow`; **`spiCount = earnedCountNow/plannedCountNow`** com `plannedCountNow = tasksTotal_planwide × fração-de-tempo` (count-scale, ratificado); bordas null = sem deadline / planned zero / now fora de [started,deadline]. Todo escalar emitido guardado com `Number.isFinite` (**L-001**). `$defs.burnup`/`$defs.spi` (additionalProperties:false) + regen bundle. Teste `tests/emit-series.test.js` (**L-003**, plural). Output em `.aideck/state/`.

## Session handoff
- **Narrative:** F3 ativa, **1/3 tasks done** (T-001 fechada @228acbe). Design de T-002 (buildSeries) **totalmente settled + ratificado** (ver Decisions: contradição burn-up resolvida @e1fdd8a; shapes de burnup.json/spi.json; spiCount count-scale). Prestes a **dispatchar Codex (Mode 2)** para T-002 no worktree `codex/f3-t002` — este snapshot é o checkpoint pré-dispatch (HARD-GATE R-EXEC-15).
- **Decision log:** ver `## Decisions` acima. Nota de execução T-001: verifier in-worktree do Codex deu falso-fail por `spawnSync node EPERM` (sandbox bloqueia spawn do test-runner) → adjudicado no primary merged. Telemetria em `dispatch-log.json`.
- **Single nextAction:** Criar worktree `.worktrees/codex-f3-t002` (branch `codex/f3-t002` de HEAD `e1fdd8a`+snapshot), dispatchar `codex exec --sandbox workspace-write` com o work-order de T-002 (contrato settled nas Decisions); ler `git -C <wt> diff`; REVISAR impl + adequação do teste (risco de teste circular auto-escrito); merge-back serial; re-verificar no primary: `node --test tests/emit-series.test.js && node --test tests/schema-drift.test.js`; `done T-002`.
- **Verbatim state:** HEAD primary `e1fdd8a` (design.md fix) + commit de estado pendente deste snapshot. branch `plan/deadline-burnup-forecast`. currentPhase=F3, **tasksDone 1/3, weightDone 1/3**. T-002 files: `scripts/emit-consumer-state.js`, `meta/schemas/aideck-state.schema.json`, `assets/aideck-consumer/schema.json`, `tests/emit-series.test.js`. T-002 verifier: `node --test tests/emit-series.test.js && node --test tests/schema-drift.test.js`. Fontes-chave (orientação): completions em `.atomic-skills/analytics/completions.jsonl` (campos ts/event/projectId/planSlug/phaseId/taskId/weight/weightBasis; event enum task-done|phase-done|reconcile; weightBasis count|proxy); append via `scripts/append-completion.js`; weightOf canônico em `scripts/compute-rollups.js:37`; emitter escreve bare-arrays em `<root>/.aideck/state/<key>.json` (writeState itera Object.entries → nova key auto-emite); validação via `scripts/validate-aideck-state.js` (#/definitions/<id>); $defs em `meta/schemas/aideck-state.schema.json` (plural keys). Gate F3/G-1 verifier: `node --test tests/emit-series.test.js && node --test tests/refresh-state.test.js`. routing.json mode2 ON; codex-cli 0.141.0. Suite: 8 falhas PRÉ-EXISTENTES (install/countSkills, fora de escopo).
- **Uncommitted changes:** este snapshot (f3-*.md) está prestes a ser committado; resto do tree limpo. Worktree do Codex para T-002 ainda não criado.

## Links

- plan: `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/plan.md`
- source (SPEC F3): `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md` (seção F3, ~linha 136)
- lições aplicáveis: `node scripts/list-lessons.js --phase F3`
