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
- **Narrative:** F4 ativa, 0/3 tasks. Phase-start hygiene FEITA: 9 lições dispositionadas no bloco `## Decisions` acima (F0/L-001+F2/L-001 já-aplicadas no writer; F1/L-001 com FLAG DE ESCOPO p/ T-003; F3/L-001 aplicada por design; design-brief-SoT/L-001 → review `--mode=both` no boundary). Prestes a despachar **T-001 ao Codex (Mode 2)** num worktree `codex/f4-t001` off HEAD limpo.
- **Decision log:** (1) **Design settled de T-001** (Opus, p/ work-order): adicionar helper puro `computePhaseActuals(since, {cwd})` em scripts/append-completion.js que computa via git `commits`/`filesChanged`/`locAdded`/`locRemoved` do range phase.started→HEAD e retorna `undefined` em QUALQUER falha de git (sem throw, P2); CLI ganha `--actuals-since <iso>`; prosa (project-transitions.md:138) troca o placeholder `<phase aggregate actuals>` por invocação concreta; teste `tests/append-completion-actuals.test.js` controla datas via GIT_*_DATE. (2) Herdado: `normalizeActuals` (append-completion.js:58-72) já valida o sub-objeto actuals inteiro (chaves fechadas + Number.isFinite) → actuals roteiam POR este writer, nunca bypass. (3) Routing: Codex é o DEFAULT (lane ON, T-001 clear F1 spec-ready + F2 verifier determinístico); operador não optou OUT.
- **Single nextAction:** Cortar worktree `codex/f4-t001` off HEAD; escrever briefing work-order de T-001; despachar Codex `--sandbox workspace-write` (cwd=worktree); ler diff de volta (`git -C <wt> diff`); merge `--ff-only` ao primary; re-rodar `node --test tests/append-completion-actuals.test.js` no MERGED primary; em PASS → `done T-001`.
- **Verbatim state:** HEAD primary `<será o commit deste snapshot>` (era `1418058` antes da disposição de lições). currentPhase=F4, tasksDone 0/3. Verifier de T-001: `node --test tests/append-completion-actuals.test.js`. Gate F4/G-1: `node --test tests/append-completion-actuals.test.js && node --test tests/append-completion-dispatchlog.test.js && node --test tests/validate-state.test.js && node --test tests/harden-closedat.test.js && node --test tests/schema-drift.test.js`. routing.json mode2 ON; codex-cli 0.141.0. Suíte: 913 pass / 8 fail PRÉ-EXISTENTES (install/countSkills — drift skills-restructuring, fora de escopo). Padrões Mode 2 (de F3): verifier in-worktree dá falso-fail `spawnSync EPERM` quando o teste spawna node → adjudicar no primary merged; merge-back via commit-no-worktree + `git merge --ff-only`.
- **Uncommitted changes:** clean tree (após o commit deste snapshot + disposição de lições).

## Links

_(plan doc, external refs)_
