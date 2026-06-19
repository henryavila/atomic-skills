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
nextAction: "Dispatch Codex (Mode 2) para T-001 no worktree .worktrees/codex-f3-t001; ler diff, verificar no primary merged (node --test tests/schema-drift.test.js), done T-001"
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

- **Disposição das 6 lições F3 (phase-start):** L-001 (F2, non-finite→null) **APPLY** — guardar todo escalar numérico novo que chega à projeção emitida (`plannedValue`, `earnedCount`, `earnedProxy`, `spiProxy`, `spiCount`) com `Number.isFinite(x) && x >= 0`, não só `typeof === number` (aplica em T-002). L-003 (design-brief, test/ vs tests/) **APPLY** — testes novos em `tests/` plural (SPEC já especifica `tests/emit-series.test.js`); confirmar que `npm test` descobre. L-001 (design-brief, review local perde majors de contrato) **KEEP** — no phase-done de F3 considerar `review-code --mode=both` (F3 adiciona $defs de schema = porta de mão única). L-002 (F0, discriminator) **KEEP** — modelar SPI null-vs-number limpo no schema (borda → null). L-002 (design-brief, schemaVersion enum) **KEEP background** — F3 não introduz novo campo schemaVersion. L-004 (design-brief, unicidade sub-campo array) **STALE p/ F3** — sem unicidade de sub-campo nesta fase.
- **Routing F3 = Codex (Mode 2):** confirmado pelo usuário (lane ON em routing.json, sem opt-out). Os 3 tasks são **acoplados** (T-001 e T-002 escrevem o mesmo bundle `assets/aideck-consumer/schema.json`; T-002 lê `deadline`/`weightTotal`; T-003 liga o emit que T-002 cria) → execução **serial**, worktrees um de cada vez, merge-back serial (R-XAGENT-03). Sem paralelismo.
- **T-001 design (settled):** `deadline` = campo opcional `{ "$ref": "common.schema.json#/$defs/isoTimestamp" }` em `meta/schemas/plan.schema.json` (NÃO em required[]); regen do bundle via `npm run build:aideck-schema`. O gerador (`scripts/build-aideck-consumer-schema.mjs`) incorpora plan.schema → bundle muda → regen obrigatório senão `schema-drift --check` falha.

## Session handoff
- **Narrative:** F3 ativa, 0/3 tasks done. Lições dispositionadas (ver Decisions). Resume gate passou: tree limpo (restaurei `focus.json` que tinha só churn de `generatedAt`). Prestes a **dispatchar Codex (Mode 2)** para T-001 (campo `deadline` no schema do plano + regen do bundle) num worktree dedicado — este snapshot é o checkpoint pré-dispatch (HARD-GATE R-EXEC-15).
- **Decision log:** ver seção `## Decisions` acima — disposição das 6 lições + routing Codex (serial, acoplado pelo bundle) + design settled de T-001.
- **Single nextAction:** Criar worktree `.worktrees/codex-f3-t001` (branch `codex/f3-t001` de HEAD), dispatchar `codex exec --sandbox workspace-write` com o work-order de T-001; ler `git -C <wt> diff`; merge-back serial no primary; re-rodar `node --test tests/schema-drift.test.js` no primary merged; `done T-001`.
- **Verbatim state:** HEAD primary `fef1c2b`, branch `plan/deadline-burnup-forecast`. currentPhase=F3, F3 active, tasksDone 0/3. T-001 verifier: `node --test tests/schema-drift.test.js`. Edit T-001: `"deadline": { "$ref": "common.schema.json#/$defs/isoTimestamp" }` em `meta/schemas/plan.schema.json` (opcional, fora de required[]) + regen `npm run build:aideck-schema` → `assets/aideck-consumer/schema.json`. Gate F3/G-1 verifier: `node --test tests/emit-series.test.js && node --test tests/refresh-state.test.js`. routing.json: mode2Enabled true, codexLane.enabled true, minBatchTasks 1. codex-cli 0.141.0. Suite: 8 falhas PRÉ-EXISTENTES (install/countSkills — drift do plano skills-restructuring, fora de escopo).
- **Uncommitted changes:** este handoff (edits no f3-*.md) é a única edição pendente no snapshot; resto do tree limpo. Worktree do Codex ainda não criado.

## Links

- plan: `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/plan.md`
- source (SPEC F3): `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md` (seção F3, ~linha 136)
- lições aplicáveis: `node scripts/list-lessons.js --phase F3`
