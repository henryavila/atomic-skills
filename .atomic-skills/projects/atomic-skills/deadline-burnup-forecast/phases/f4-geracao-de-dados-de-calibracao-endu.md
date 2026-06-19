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
nextAction: "Implementar T-003 em Mode 1 (TDD): checkClosedAtHardening + crossValidate + harden-closedat.js + schemas"
parentPlan: deadline-burnup-forecast
phaseId: F4
tasksDone: 2
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
weightDone: 2
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
    status: done
    closedAt: 2026-06-19T18:58:42Z
    lastUpdated: 2026-06-19T18:58:42Z
    verifier:
      kind: shell
      command: node --test tests/append-completion-dispatchlog.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T18:58:42Z
      passed: true
      exitCode: 0
      testsCollected: 6
      outputSummary: "node --test tests/append-completion-dispatchlog.test.js — 6
        pass, 0 fail, exit 0, re-run on MERGED primary 5f0ce6f.
        readDispatchActuals casa plan+phase+taskId (não taskId só), deriva
        attempts/durationMs/ escalations do último record, graceful undefined
        sem arquivo/match. 0 regressão: 34/34 no conjunto append-completion
        (actuals+dispatchlog+ schema+F0). Executor Codex Mode2 worktree
        codex/f4-t002 (sem EPERM, teste não spawna). Dogfood E2E: o evento
        task-done de T-002 auto-carregou actuals
        {attempts:1,escalations:0,durationMs:270000} do dispatch-log. Revisão
        Opus: impl fiel ao design, prosa intocada (auto na CLI)."
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

### 2026-06-19 — Decisão de escopo F1/L-001 (usuário) + routing T-003

- **F1/L-001: INCLUIR em T-003** (decisão do usuário via AskUserQuestion). T-003 também endurece a projeção emitida: adicionar `closedAt`+`lastUpdated` ao `required` de `/$defs/tasks` em `meta/schemas/aideck-state.schema.json` + regen bundle. Premissa confirmada: hoje estão em `properties` mas fora de `required` (additionalProperties:false). +1 arquivo além dos Files declarados de T-003; coberto pelo `schema-drift.test.js` do verifier. Seguro (campo já é sempre emitido via `?? null`).
- **Routing T-003 = MODE 1 (self-exec), NÃO Codex** (R-EXEC-30/44, F1 hard disqualifier): a SPEC nomeia `checkMetInvariant` (validate-state.js:364-403) como ponto de integração, mas essa função é PURA e recebe UMA frontmatter — não vê o `closedAtHardening` do plano ao checar tasks da iniciativa. A correlação plano↔iniciativas só existe em `crossValidate` (validate-state.js:507). Design real (settled por mim): novo predicado puro `checkClosedAtHardening(initFm, closedAtHardening)` chamado de `crossValidate` p/ iniciativas com `parentPlan===plan.slug`. Esse design EMERGIU da leitura do código (SPEC arquiteturalmente imprecisa) + alto blast-radius (validador-core, todo plano depende) + risco de teste circular no harden-closedat.js (I/O de path) ⇒ F1 não limpo ⇒ Opus implementa direto (TDD). Distinto de T-001/T-002 (SPEC correta, só latitude mecânica → Codex).

## Session handoff
- **Narrative:** F4 ativa, **2/3 tasks** (T-001 + T-002 DONE via Codex Mode 2). T-002 (actuals de task via dispatch-log) implementada por Codex no worktree `codex/f4-t002`, merge `--ff-only` (`e7dc3ab→5f0ce6f`), verifier VERDE no MERGED primary (6 pass, exit 0), 0 regressão (34/34 conjunto append-completion), worktree desmontado. Dogfood E2E: o task-done de T-002 auto-carregou actuals do dispatch-log. Resta SÓ T-003. 9 lições dispositionadas (bloco `## Decisions`).
- **Decision log:** T-001 + T-002 entregues conforme design settled, revisados (diff fiel, escopo limpo, testes não-circulares, graceful coberta). **DECISÃO ABERTA antes de T-003 — F1/L-001 (escopo):** adicionar `closedAt`+`lastUpdated` ao `tasks.required` de `meta/schemas/aideck-state.schema.json` está FORA dos Files declarados de T-003 (que lista plan.schema.json + assets/aideck-consumer/schema.json + validate-state). É um hardening da PROJEÇÃO emitida, distinto do hard-gate do GATE-R2 sobre o tracker `.md` que T-003 faz. Surfaçar ao usuário (incluir em T-003 / task emergente separada / pular) ANTES de despachar — não alargar em silêncio.
- **T-003 SPEC (source.md:190-195):** campo persistido `closedAtHardening { enforcedFrom: isoTimestamp, grandfatheredTaskIds: [string] }` opcional no plan.schema.json; checkMetInvariant (validate-state.js:364-399) exige closedAt p/ toda task done cujo id NÃO esteja em grandfatheredTaskIds; flip via script `scripts/harden-closedat.js` (idempotente, computa grandfatheredTaskIds = done vivas sem closedAt no instante do flip, grava enforcedFrom=now, NUNCA inventa closedAt — P3). Files: scripts/validate-state.js, scripts/harden-closedat.js, meta/schemas/plan.schema.json, assets/aideck-consumer/schema.json, tests/validate-state.test.js, tests/harden-closedat.test.js. Verifier: `node --test tests/validate-state.test.js && node --test tests/harden-closedat.test.js && node --test tests/schema-drift.test.js`.
- **Single nextAction:** Surfaçar a decisão F1/L-001 ao usuário (AskUserQuestion). Depois settlar o design de T-003 e despachar (Codex DEFAULT se spec-ready; é multi-file mas design settled pela SPEC). Após T-003 → phase-done F4 com review `--mode=both` (design-brief-SoT/L-001) + distill lessons.
- **Verbatim state:** HEAD primary `5f0ce6f` (T-002) — será atualizado pelo commit deste snapshot. currentPhase=F4, tasksDone 2/3. T-003 verifier acima. Gate F4/G-1: `node --test tests/append-completion-actuals.test.js && node --test tests/append-completion-dispatchlog.test.js && node --test tests/validate-state.test.js && node --test tests/harden-closedat.test.js && node --test tests/schema-drift.test.js`. routing.json mode2 ON; codex-cli 0.141.0. Suíte: 913 pass / 8 fail PRÉ-EXISTENTES (install/countSkills — drift skills-restructuring, fora de escopo). Padrões Mode 2: merge-back via commit-no-worktree + `git merge --ff-only`; re-verificar no MERGED primary; tests que spawnam node/git podem dar EPERM no sandbox → adjudicar no primary.
- **Uncommitted changes:** F4 initiative (T-002 done + rollups 2/3 + nextAction + handoff) + `.atomic-skills/analytics/completions.jsonl` (evento task-done T-002 c/ actuals) + `.atomic-skills/status/dispatch-log.json` (telemetria T-002) — serão commitados neste snapshot. T-002 source (2 files) já em `5f0ce6f`.

## Links

_(plan doc, external refs)_
