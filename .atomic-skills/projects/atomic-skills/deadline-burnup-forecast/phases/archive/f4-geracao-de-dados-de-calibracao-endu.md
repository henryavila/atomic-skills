---
schemaVersion: "0.1"
slug: deadline-burnup-forecast-f4-geracao-de-dados-de-calibracao-endu
title: Geração de dados de calibração + endurecer closedAt
goal: "gravar os actuals crus por conclusão (calibração: só geração, tratamento
  depois) e promover closedAt de soft para hard no GATE-R2 quando a lacuna de
  instrumentação chegar perto de zero."
status: done
branch: plan/deadline-burnup-forecast
started: 2026-06-19T17:29:17Z
lastUpdated: 2026-06-19T20:00:51Z
nextAction: null
parentPlan: deadline-burnup-forecast
phaseId: F4
tasksDone: 3
tasksTotal: 3
gatesMet: 1
gatesTotal: 1
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-1
    description: actuals crus (fase E task/dispatch-log) são gravados por conclusão
      no sub-objeto admitido e closedAt é hard-gated forward-only via corte
      persistido (grandfatheredTaskIds) gravado pelo script de flip, sem
      rejeitar legado.
    status: met
    metAt: 2026-06-19T19:53:26Z
    verifier:
      kind: shell
      command: node --test tests/append-completion-actuals.test.js && node --test
        tests/append-completion-dispatchlog.test.js && node --test
        tests/validate-state.test.js && node --test
        tests/harden-closedat.test.js && node --test tests/schema-drift.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T19:53:26Z
      passed: true
      exitCode: 0
      testsCollected: 94
      outputSummary: G-1 5-test chain on reviewed+remediated HEAD 8a088d4 — 94 pass
        (actuals 4 + dispatchlog 8 + validate-state 75 + harden 6 + schema-drift
        1), 0 fail, exit 0. Review --mode=both APROVADO (local 2 minor + codex 1
        critical/2 major, todos remediados). Suíte 953/939/8 PRÉ-EXISTENTES.
    verifierLabel: "shell: node --test tests/append-completion-actuals.test.js && node…"
    evidenceSummary: passed · 94 tests · 2026-06-19
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
    status: done
    closedAt: 2026-06-19T19:22:02Z
    lastUpdated: 2026-06-19T19:22:02Z
    verifier:
      kind: shell
      command: node --test tests/validate-state.test.js && node --test
        tests/harden-closedat.test.js && node --test tests/schema-drift.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T19:22:02Z
      passed: true
      exitCode: 0
      testsCollected: 79
      outputSummary: "chained exit 0 no primary commitado a43ad78 — validate-state 74
        + harden-closedat 4 + schema-drift 1 = 79 pass, 0 fail. Design (Opus,
        Mode 1 self-exec): novo predicado puro checkClosedAtHardening chamado de
        crossValidate (a SPEC nomeava checkMetInvariant, mas é pura
        single-frontmatter — não vê o closedAtHardening do plano ao checar tasks
        da iniciativa); harden-closedat.js idempotente computa
        grandfatheredTaskIds = done-sem-closedAt vivas (phases+archive), grava
        enforcedFrom, NUNCA inventa closedAt (P3). F1/L-001 incluída (decisão do
        usuário): closedAt+ lastUpdated no required de /$defs/tasks do
        aideck-state.schema + bundle regen. Suíte completa de volta ao baseline:
        948 tests / 934 pass / 8 fail PRÉ-EXISTENTES (install/detect drift
        skills-restructuring), 0 regressão nova de forecast/validate. NB:
        regressão de T-001 (cláusula anti-dup do phase-done) achada nesta
        varredura full-suite e corrigida em d2d3cf0."
parked: []
emerged: []
summary: Grava os actuals crus por conclusão (calibração futura) e endurece
  closedAt forward-only.
planTitle: Deadline Burn-up Forecast (Earned Value / SPI)
planActive: true
current: false
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

## Self-review against gates (phase-done F4)

- **G1 read-before-claim:** applied — T-001/T-002/T-003 each closed with `passed:true` evidence linking the verifier run on the merged/committed primary; every review finding verified at its `file:line` before its fix.
- **G2 soft-language:** applied — closure claims are `passed:true` evidence; no should/probably/works in the completion claims.
- **G6 reference-or-strike:** applied — handoff + evidence carry verbatim commits/paths/commands.
- **Codex review:** ran `review-code --mode=both` at HEAD `8a088d4` — verdict approved-with-remediations (local 2 minor + codex 1 critical / 2 major, all fixed + regression-tested), file `.atomic-skills/reviews/2026-06-19-1952-code-deadline-burnup-forecast-f4.md`. Informed Pass-2 skipped (zero false positives — all blind findings confirmed real + remediated; cross-checked by targeted tests + green full suite).
- **Lessons:** 3 distilled + ratified (L-001 verifier-scope, L-002 phase-scoped-id, L-003 cover-every-path) → `lessons/deadline-burnup-forecast-f4-geracao-de-dados-de-calibracao-endu.md`.

## Session handoff
- **Narrative:** F4 **3/3 tasks DONE** — pronta para `phase-done`. T-001 (actuals de fase, Codex `003b526`) + T-002 (actuals de task via dispatch-log, Codex `5f0ce6f`, dogfood E2E) + T-003 (closedAt hard-gate forward-only, Mode 1 `a43ad78`). Gate F4/G-1 ainda `pending` (resolvido no phase-done). Suíte completa no baseline: 948 tests / 934 pass / 8 fail PRÉ-EXISTENTES (install/detect drift skills-restructuring). Tree limpo após o commit deste snapshot.
- **Decision log:** (1) T-003 em Mode 1 (SPEC nomeava checkMetInvariant, mas o design real — predicado checkClosedAtHardening em crossValidate — emergiu da leitura; ver bloco Decisions acima). (2) F1/L-001 incluída em T-003 por decisão do usuário (hardening da projeção emitida). (3) **Regressão de T-001 achada e corrigida** (`d2d3cf0`): a reescrita da prosa do phase-done virou "Do NOT duplicate" (maiúsc.), quebrando o guard case-sensitive `tests/transition-emits.test.js` — não pego pelo verifier estreito de T-001. **LIÇÃO p/ phase-done:** quando uma task edita um arquivo guardado por teste estrutural existente, o verifier da task deve INCLUIR esse teste (T-001 só tinha append-completion-actuals).
- **Single nextAction:** phase-done GATE completo (G-1 met @8a088d4, review `--mode=both` APROVADO, 3 lessons ratificadas, self-review gravado). FALTA só o passo de AVANÇO (intrusive-actions, opt-in): setar F4 phase `status: done`, propagar a iniciativa p/ done, arquivar a iniciativa, e decidir o próximo. **F5 está BLOQUEADA** (dep externa: redesign do dashboard `fix-aideck-dashboard` F2 — handoff escrito em `docs/handoffs/forecast-render-requirements.md`). Opções de avanço: (a) marcar F4 done + arquivar + deixar currentPhase em F4/F5-pending até o dashboard; (b) deixar F4 active até o usuário decidir. NÃO auto-avançar.
- **Verbatim state:** HEAD primary `a43ad78` (T-003 source) — será atualizado pelo commit deste snapshot (fechamento T-003). currentPhase=F4, tasksDone 3/3, gatesMet 0/1. Gate F4/G-1 verifier: `node --test tests/append-completion-actuals.test.js && node --test tests/append-completion-dispatchlog.test.js && node --test tests/validate-state.test.js && node --test tests/harden-closedat.test.js && node --test tests/schema-drift.test.js`. routing.json mode2 ON; codex-cli 0.141.0. Commits F4: T-001 `003b526`/`5202143`, T-002 `5f0ce6f`/`ac77616`, regressão `d2d3cf0`, T-003 `a43ad78`. Suíte: 948/934/8 (8 pré-existentes install/detect).
- **Uncommitted changes:** F4 initiative (T-003 done + rollups 3/3 + nextAction + handoff) + `.atomic-skills/analytics/completions.jsonl` (evento task-done T-003, Mode-1 sem actuals) — serão commitados neste snapshot. T-003 source (7 files) já em `a43ad78`; regressão em `d2d3cf0`.

## Links

_(plan doc, external refs)_
