---
schemaVersion: "0.1"
slug: deadline-burnup-forecast-f3-serie-earned-vs-planned-deadline-wi
title: Série earned-vs-planned + deadline + wiring de recompute
goal: adicionar plan.deadline, computar a série burn-up (earned acumulado vs
  linha planejada linear) e o SPI no emit, e ligar o recompute ao refresh-state
  (fechando o gap em que ele só chama emitFocus).
status: done
branch: plan/deadline-burnup-forecast
started: 2026-06-19T12:50:33Z
lastUpdated: 2026-06-19T17:29:17Z
nextAction: null
parentPlan: deadline-burnup-forecast
phaseId: F3
tasksDone: 3
tasksTotal: 3
gatesMet: 1
gatesTotal: 1
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-1
    description: a série earned-vs-planned + SPI é emitida e recomputada
      automaticamente pelo refresh-state, com deadline no schema.
    status: met
    metAt: 2026-06-19T17:29:17Z
    verifier:
      kind: shell
      command: node --test tests/emit-series.test.js && node --test
        tests/refresh-state.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:29:17Z
      passed: true
      exitCode: 0
      outputSummary: G-1 2-test chain on reviewed+remediated HEAD 12edc01 —
        emit-series 2 + refresh-state 2 = 4 pass, 0 fail, exit 0; suíte 913 pass
        / 8 fail PRÉ-EXISTENTES.
    verifierLabel: "shell: node --test tests/emit-series.test.js && node --test tests/…"
    evidenceSummary: passed · 2026-06-19
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
    status: done
    closedAt: 2026-06-19T16:31:18Z
    lastUpdated: 2026-06-19T16:31:18Z
    verifier:
      kind: shell
      command: node --test tests/emit-series.test.js && node --test
        tests/schema-drift.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T16:31:18Z
      passed: true
      exitCode: 0
      testsCollected: 3
      outputSummary: "node --test emit-series (2 pass: buildSeries unit + round-trip)
        && schema-drift (1 pass), 0 fail, exit 0, MERGED primary 90b4366. Suíte
        completa 911 pass / 8 fail PRÉ-EXISTENTES (install/countSkills), 0
        regressão nova (emit-consumer-state round-trip ajustado 11→13 @90b4366).
        Executor Codex Mode2 worktree codex/f3-t002; revisão Opus: impl fiel ao
        spec, teste assere valores concretos re-derivados (não circular), guards
        Number.isFinite presentes (L-001)."
  - id: T-003
    title: — Ligar emit ao refresh-state sem regredir emitFocus
    status: done
    closedAt: 2026-06-19T16:37:53Z
    lastUpdated: 2026-06-19T16:37:53Z
    verifier:
      kind: shell
      command: node --test tests/refresh-state.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T16:37:53Z
      passed: true
      exitCode: 0
      testsCollected: 2
      outputSummary: "node --test tests/refresh-state.test.js — 2 pass (regenera
        burnup/spi preservando os 3 passos; path sem eventos), 0 fail, exit 0,
        MERGED primary 6844e95. Suíte completa 927 tests / 913 pass / 8 fail
        PRÉ-EXISTENTES (install/countSkills), 0 regressão nova. Executor Codex
        Mode2 worktree codex/f3-t003; revisão Opus: aditivo+fail-open, 3 passos
        intactos, teste prova gap fechado (burnup ausente→presente), não
        circular."
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
- **Narrative:** F3 **3/3 tasks done** (T-001 @228acbe, T-002 @90b4366, T-003 @6844e95) — todos via Codex (Mode2), revisados, merge-back FF serial, verifier PASS no primary merged. Fase NÃO avançada: aguardando **phase-done** (gate G-1 + review-code + lições) com opt-in do usuário. Nenhum worktree Codex ativo.
- **Decision log:** ver `## Decisions` acima. Padrões confirmados nos 3 tasks: (a) verifier in-worktree do Codex dá falso-fail `spawnSync EPERM` quando o teste spawna `node` (T-001/T-002 schema-drift) → adjudicação real no primary merged; T-003 (refresh-state, sem spawn) passou in-worktree também. (b) `emit-consumer-state.js` é "binário" pro git (box-drawing) → merge-back via commit-no-worktree + `git merge --ff-only`, NÃO patch. (c) T-002 exigiu 1 follow-up Mode1 (regressão de contagem 11→13). Telemetria T-001/T-002/T-003 em `dispatch-log.json` (20 registros).
- **Single nextAction:** Rodar **phase-done** para F3 (opt-in): (1) gate G-1 verifier `node --test tests/emit-series.test.js && node --test tests/refresh-state.test.js` → met+evidence; (2) **review-code** no diff da fase — por **L-001 design-brief** considerar `--mode=both` (F3 adicionou `$defs.burnup`/`$defs.spi` + campo `deadline` = contrato de schema, porta de mão única); (3) distilar lições; (4) gravar `reviewGate` no plan.md; (5) advance F3→F4 (proposeAdvance). NÃO auto-avançar.
- **Verbatim state:** HEAD primary `6844e95` + commit de estado pendente deste snapshot. branch `plan/deadline-burnup-forecast`. currentPhase=F3, **tasksDone 3/3, weightDone 3/3, gatesMet 0/1**. Gate F3/G-1 verifier: `node --test tests/emit-series.test.js && node --test tests/refresh-state.test.js` (ambos verdes no primary: emit-series 2 + refresh-state 2). Entregue em F3: campo `deadline` (plan.schema), `buildSeries()` em emit-consumer-state.js (burnup.json/spi.json earned-value/SPI), `$defs.burnup`/`$defs.spi`, wiring no refresh-state. design.md D5 corrigido (@e1fdd8a). Suíte: 927 tests, 913 pass, 8 fail PRÉ-EXISTENTES (install/countSkills/installSkills — drift do plano skills-restructuring, fora de escopo). routing.json mode2 ON; codex-cli 0.141.0.
- **Uncommitted changes:** este snapshot (f3-*.md + focus.json regen + dispatch-log.json) está prestes a ser committado; resto do tree limpo. Sem worktree Codex ativo.

## Links

- plan: `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/plan.md`
- source (SPEC F3): `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md` (seção F3, ~linha 136)
- lições aplicáveis: `node scripts/list-lessons.js --phase F3`

## Self-review against code-quality gates

- **G1 read-before-claim**: 3 tasks closed, each with `evidence` linking the verifier run on the MERGED primary (T-001 @228acbe, T-002 @90b4366, T-003 @6844e95); review fixes verified against pasted source lines + test runs.
- **G2 soft-language**: completion claims are `passed: true` evidence (verifier exit 0 + testsCollected), not should/probably/works; handoff narrative scanned.
- **G6 reference-or-strike**: gate G-1 `met` with `evidence` (HEAD 12edc01); reviewGate recorded `{status: passed, at: 12edc01, mode: both}`.
- **Codex review**: ran via review-code `--mode=both` at HEAD 12edc01, verdict needs_changes→all blocker/critical resolved; local 0B/1C/2M/2m + codex final 0B/0C/1M/2m; file `.atomic-skills/reviews/2026-06-19-1721-code-deadline-burnup-forecast-f3.md`. The cross-model pass caught a disjoint major (F-003) the local missed.
- **Review gate (G2)**: `reviewGate: {status: passed, at: 12edc01, mode: both, reviewFile}` on the F3 descriptor (GATE-R3); prose ↔ field agree.
- **Lessons (G1)**: distilled 2 reusable lessons into `lessons/deadline-burnup-forecast-f3-…md` (L-001 filter-by-event-kind → F4; L-002 self-sufficient data source → F5), ratified by the operator.

## Execution mode note (Mode 2 — Codex lane)

All 3 tasks executed by OpenAI Codex (Mode 2, workspace-write worktrees `codex/f3-t00{1,2,3}`), Opus planned + reviewed + adjudicated on the merged primary (R-EXEC-28). One CRITICAL (a spec bug in the work-order: phase-done double-count) + 2 majors found by the local review and 1 major by the codex cross-model pass — all remediated by Opus (Mode 1) before the gate closed. Telemetry: `dispatch-log.json` (3 F3 records).
