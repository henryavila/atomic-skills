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
nextAction: "Start T-002: — Actuals de task via dispatch-log quando presente"
parentPlan: deadline-burnup-forecast
phaseId: F4
tasksDone: 1
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
weightDone: 1
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
    status: done
    closedAt: 2026-06-19T18:47:13Z
    lastUpdated: 2026-06-19T18:47:13Z
    verifier:
      kind: shell
      command: node --test tests/append-completion-actuals.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T18:47:13Z
      passed: true
      exitCode: 0
      testsCollected: 4
      outputSummary: "node --test tests/append-completion-actuals.test.js — 4 pass, 0
        fail, exit 0, re-run on MERGED primary 003b526. computePhaseActuals (git
        range + graceful undefined) + appendCompletion phase-done actuals
        validam no completion-event.schema; task-done sem actuals (sem
        duplicação). Executor Codex Mode2 worktree codex/f4-t001; verifier verde
        já in-worktree, adjudicado no primary. Revisão Opus: impl fiel ao design
        settled, teste assere valores concretos re-derivados (não circular),
        graceful-degradation coberta."
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

### 2026-06-19 — Disposição das 9 lições aplicáveis a F4 (phase-start)

- **F0/L-001** (validar registro COMPLETO incl. sub-objeto `actuals` antes de gravar) → **JÁ-APLICADA**. `normalizeActuals` (scripts/append-completion.js:58-72) valida o sub-objeto inteiro (chaves fechadas `ACTUALS_KEYS` + `Number.isFinite`) antes do append. T-001/T-002 DEVEM rotear os actuals computados POR este writer (nunca bypass).
- **F0/L-002** (acoplar taskId ao discriminador `event`) → **KEEP** (já enforced append-completion.js:98-100). Para actuals: actuals de fase só no evento `phase-done`, actuals de task só no `task-done` — mesma disciplina de discriminador (T-001 scopeBoundary já exige fase-only).
- **F1/L-001** (adicionar `closedAt`+`lastUpdated` ao `tasks.required` de `meta/schemas/aideck-state.schema.json` ao endurecer closedAt, regen bundle) → **APLICAR com FLAG DE ESCOPO**. A lição mira F4/T-003, mas `meta/schemas/aideck-state.schema.json` NÃO está nos Files de T-003 (T-003 lista plan.schema.json + assets/aideck-consumer/schema.json + validate-state). T-003 endurece o GATE-R2 sobre o tracker `.md`; a lição endurece a PROJEÇÃO emitida — hardenings relacionados mas distintos. **Decisão: surfaçar ao usuário em T-003** antes de tocar aideck-state.schema.json; não alargar escopo em silêncio.
- **F2/L-001** (`Number.isFinite(x) && x>=0` em todo escalar numérico que chega à projeção) → **JÁ-APLICADA no writer** (append-completion.js:67 rejeita não-finito em actuals). T-001/T-002 passam números finitos; o writer rejeita o resto.
- **F3/L-001** (filtrar log multi-tipo por `event==='task-done'` em métrica cumulativa; não double-count) → **APLICADA por design**. T-001 scopeBoundary grava actuals de fase SÓ no único evento `phase-done`, nunca nas N linhas `task-done` → sem overcount. É a lição realizada.
- **design-brief-SoT/L-001** (rodar review-code `--mode=both` em fase de contrato porta-de-mão-única) → **APLICAR**. F4 muda schemas (plan.schema.json closedAtHardening) → review do boundary F4 com `--mode=both` (como F3).
- **design-brief-SoT/L-002** (constranger schemaVersion com enum + teste negativo) → **N/A**. F4 não adiciona novo campo schemaVersion versionado (closedAtHardening usa `enforcedFrom` timestamp, não versão).
- **design-brief-SoT/L-003** (garantir que `npm test` descobre novos testes — `tests/` plural, flat) → **APLICAR**. Todos os testes novos de F4 vão em `tests/` (plural); paths dos verifiers já usam `tests/`. Confirmar glob do `npm test` após criar.
- **design-brief-SoT/L-004** (unicidade de sub-campo de array via checagem pós-schema) → **N/A**. `grandfatheredTaskIds` é computado pelo script como conjunto (Set) → unicidade garantida na origem; sem sub-campo de array no schema.

## Session handoff
- **Narrative:** F4 ativa, **1/3 tasks** (T-001 DONE via Codex Mode 2). T-001 (actuals de fase no evento phase-done) implementada por Codex no worktree `codex/f4-t001`, merge `--ff-only` ao primary (`8c396bf→003b526`), verifier re-rodado e VERDE no MERGED primary (4 pass, exit 0), worktree desmontado. Restam T-002 + T-003. 9 lições já dispositionadas (bloco `## Decisions`).
- **Decision log:** (1) T-001 entregue conforme design settled (helper `computePhaseActuals` + flag `--actuals-since` + prosa concreta + teste GIT_*_DATE); revisão Opus do diff: fiel, escopo limpo (3 files), teste não-circular, graceful-degradation coberta. (2) **F1/L-001 PENDENTE de decisão em T-003**: adicionar `closedAt`+`lastUpdated` ao `tasks.required` de `meta/schemas/aideck-state.schema.json` está FORA dos Files declarados de T-003 → surfaçar ao usuário antes de tocar (não alargar escopo). (3) Routing: Codex DEFAULT (lane ON); seguir mesmo fluxo serial para T-002 (mas T-002 toca o MESMO append-completion.js que T-001 já tocou — base ref do worktree de T-002 = HEAD atual `003b526`).
- **T-002 design SETTLED (Opus, p/ work-order):** helper puro `readDispatchActuals(root, {planSlug,phaseId,taskId})` lê `.atomic-skills/status/dispatch-log.json` (array flat; keys do record: `plan`/`phase`/`taskId`/`attempt`/`escalationCount`/`startedAt`/`finishedAt`), casa por plan+phase+taskId (taskId sozinho é errado — repete entre fases), usa o ÚLTIMO record casando: `attempts=rec.attempt`, `escalations=rec.escalationCount`, `durationMs=Date.parse(finishedAt)-Date.parse(startedAt)` (só se finito e >=0). Constrói actuals só com campos finitos; undefined se arquivo ausente/unparseable/sem match (graceful, nunca throw). CLI: `task-done` SEM `--actuals-since` auto-chama readDispatchActuals → **prosa NÃO muda** (por isso project-transitions.md fora dos Files). Teste NÃO spawna node/git (assere via funções exportadas → sem EPERM).
- **Single nextAction:** Cortar worktree `codex/f4-t002` off HEAD (`5202143`, contém append-completion.js de T-001) → despachar Codex `/tmp/f4-t002-briefing.txt` → ler diff → merge `--ff-only` → re-rodar `node --test tests/append-completion-dispatchlog.test.js` no MERGED primary → em PASS `done T-002`.
- **Verbatim state:** HEAD primary `003b526` (T-001) — será atualizado pelo commit deste snapshot. currentPhase=F4, tasksDone 1/3. Verifier T-002: `node --test tests/append-completion-dispatchlog.test.js`. Gate F4/G-1: `node --test tests/append-completion-actuals.test.js && node --test tests/append-completion-dispatchlog.test.js && node --test tests/validate-state.test.js && node --test tests/harden-closedat.test.js && node --test tests/schema-drift.test.js`. routing.json mode2 ON; codex-cli 0.141.0. Suíte: 913 pass / 8 fail PRÉ-EXISTENTES (install/countSkills — drift skills-restructuring, fora de escopo). Padrões Mode 2 (de F3): verifier in-worktree pode dar falso-fail `spawnSync EPERM` se o teste spawna node/git → adjudicar no MERGED primary; merge-back via commit-no-worktree + `git merge --ff-only`.
- **Uncommitted changes:** F4 initiative (T-001 done + rollups + nextAction + handoff) + `.atomic-skills/analytics/completions.jsonl` (evento task-done T-001) + `.atomic-skills/status/dispatch-log.json` (telemetria T-001) — serão commitados neste snapshot. T-001 source (3 files) já em `003b526`.

## Links

_(plan doc, external refs)_
