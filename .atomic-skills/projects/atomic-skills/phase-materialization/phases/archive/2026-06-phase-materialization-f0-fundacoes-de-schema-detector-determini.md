---
schemaVersion: "0.1"
slug: phase-materialization-f0-fundacoes-de-schema-detector-determini
title: Fundações de schema + detector determinístico
goal: Adicionar o campo de schema aditivo/opcional `businessIntent` no
  `phaseDescriptor` do plano E no schema da initiative (espelha `summary`), mais
  o detector determinístico `find-missing-business-intent.js` — todos com zero
  mudança de comportamento e totalmente backward-compat. Esta fase habilita
  F1–F4 sem alterar nenhum fluxo existente.
status: done
branch: plan/phase-materialization
started: 2026-06-29T13:19:41.314Z
lastUpdated: 2026-06-30T18:05:12.000Z
nextAction: null
parentPlan: phase-materialization
phaseId: F0
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
weightDone: 5
weightTotal: 5
exitGates:
  - id: F0-G1
    description: Schemas (plan phaseDescriptor + initiative) aceitam legados (sem
      businessIntent) e novos (com), e o detector exit-0/1 sobre fixtures
      canonicos
    status: met
    metAt: 2026-06-30T16:10:18.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-30T16:10:18.000Z
      exitCode: 0
      testsCollected: 21
      passed: true
      outputSummary: node --test 'tests/phase-materialization/*.test.js' → exit 0; ℹ
        tests 21 / pass 21 / fail 0; 3 suites (business-intent-schema 11 +
        find-missing-business-intent 10)
    verifier:
      kind: shell
      command: node --test 'tests/phase-materialization/*.test.js'
      expectExitCode: 0
    verifierLabel: "shell: node --test 'tests/phase-materialization/*.test.js'"
    evidenceSummary: passed · 21 tests · 2026-06-30
  - id: F0-G2
    description: Nenhum arquivo de fluxo/skill alterado nesta fase (zero behavior
      change confirmado pelo diff)
    status: met
    metAt: 2026-06-30T16:10:18.000Z
    evidence:
      verifierKind: manual
      verifiedAt: 2026-06-30T16:10:18.000Z
      passed: true
      outputSummary: git diff --name-only 67f1257..HEAD -- skills/ src/ = vazio e git
        status --porcelain -- skills/ src/ = vazio (0 skill/flow file)
    verifier:
      kind: manual
      description: Confirmar via git diff que só meta/schemas/plan.schema.json +
        meta/schemas/initiative.schema.json +
        scripts/find-missing-business-intent.js + tests/ +
        assets/aideck-consumer/schema.json (bundle regerado para incluir
        businessIntent — artefato gerado, zero behavior nova) foram tocados
    verifierLabel: manual
    evidenceSummary: passed · 2026-06-30
stack:
  - id: 1
    title: Fundações de schema + detector determinístico
    type: task
    openedAt: 2026-06-29T13:19:41.314Z
tasks:
  - id: T-001
    title: Adicionar sub-schema `businessIntent` ao `phaseDescriptor` E à initiative
    description: 'Adiciona o MESMO sub-schema `businessIntent` em DOIS schemas,
      ambos aditivos/opcionais: (a) em `meta/schemas/plan.schema.json` dentro do
      `phaseDescriptor` (`:211`, `additionalProperties:false` `:213`) como
      **properties-only, FORA do `required`** (`:214`) — espelha exatamente como
      `summary` (`:220`) já vive; (b) em `meta/schemas/initiative.schema.json`
      (que é `additionalProperties:false` e hoje NÃO tem o campo) como
      **properties-only, FORA do `required`** — espelha exatamente como o
      `summary` (`:29`) já vive lá (F-001: o detector D4 lê `businessIntent` nas
      2 superfícies descriptor+initiative, e o verbo `materialize` (F3) grava
      businessIntent no arquivo de iniciativa; se o schema da initiative não
      admitir o campo, o `additionalProperties:false` rejeita a initiative
      materializada). O sub-schema é um objeto com 5 campos
      obrigatórios-quando-presente
      (`value`/`workflow`/`rules`/`outOfScope`/`doneWhen`, todos `type:string`
      `minLength:1`) + cauda opcional `derived[]` (array de objetos
      `{question:string, answer?:string}`). O objeto inteiro usa
      `additionalProperties:false`. Resolve a Open question "sub-schema
      businessIntent + onde mora derived".'
    status: done
    lastUpdated: 2026-06-29T19:19:59.605Z
    closedAt: 2026-06-29T19:19:59.605Z
    scopeBoundary:
      - o bloco `phaseDescriptor.properties` em plan.schema.json (ou um
        `$defs/businessIntent` extraído e referenciado) + a adição simétrica em
        initiative.schema.json + o novo teste; NÃO remover campos existentes,
        NÃO mexer nos `required` (plan `:214`, initiative), NÃO alterar outros
        schemas
    acceptance:
      - um plano com `businessIntent` completo nos 5 campos valida limpo; uma
        initiative com `businessIntent` completo valida limpo; plano e
        initiative legados SEM o campo validam limpos (opcional confirmado em
        AMBOS os schemas); um `businessIntent` presente mas faltando `value` é
        rejeitado pelo Ajv em ambos os schemas; `derived[]` ausente é aceito
        (opcional)
    verifier:
      kind: test
      runner: node --test
      pattern: tests/phase-materialization/business-intent-schema.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-29T19:19:59.605Z
      passed: true
      exitCode: 0
      testsCollected: 11
      outputSummary: node --test
        tests/phase-materialization/business-intent-schema.test.js → exit 0; ℹ
        tests 11 / ℹ pass 11 / ℹ fail 0 (3 suites). Plan surface
        (phases[].businessIntent) + initiative surface (top-level) accept a
        complete 5-field spine; legacy (no businessIntent) stays valid; missing
        value / unknown prop / empty value rejected; derived[] optional.
    outputs:
      - kind: file
        path: meta/schemas/plan.schema.json
      - kind: file
        path: meta/schemas/initiative.schema.json
      - kind: file
        path: tests/phase-materialization/business-intent-schema.test.js
    summary: Adiciona o sub-schema businessIntent (5 campos + derived[]) ao
      phaseDescriptor do plano E à initiative, opcional como summary em ambos
      (F-001).
    weight: 2
  - id: T-003
    title: Autorar o detector `find-missing-business-intent.js` (D4)
    description: "Cria `scripts/find-missing-business-intent.js` no **mesmo molde de
      SAÍDA** de `find-missing-summaries.js` (`configuredLanguage`, CLI exit
      0/1, importa `parseFrontmatter` de `validate-state.js`, percorre nested +
      flat), mas com lógica de objeto aninhado (mais próxima de
      `validate-state.js`): para cada fase **materializada** (que tem arquivo de
      iniciativa — distingue de descriptor-only pela existência do arquivo, não
      por `subPhaseCount`), checa os 5 campos da espinha `businessIntent`
      (`value`/`workflow`/`rules`/`outOfScope`/`doneWhen`) nas **2 superfícies**
      (descriptor `plan.phases[].businessIntent` + initiative `businessIntent`);
      reporta o primeiro campo ausente/vazio/marcado `[NEEDS CLARIFICATION]`
      (string reservada tratada como ausente). HARD-BLOCK via exit 1. Fases
      descriptor-only (sem arquivo) são ignoradas (ainda não ativadas — D5
      backfill-on-activation)."
    status: done
    lastUpdated: 2026-06-29T19:41:42.000Z
    closedAt: 2026-06-29T19:41:42.000Z
    scopeBoundary:
      - novo arquivo `scripts/find-missing-business-intent.js` + teste; NÃO
        alterar `find-missing-summaries.js`, `validate-state.js`, nem reuso de
        `configuredLanguage` quebrando o export existente
    acceptance:
      - fixture com fase materializada + espinha completa → exit 0; mesma fase
        faltando `outOfScope` no descriptor → exit 1 reportando
        `outOfScope(descriptor)`; fase descriptor-only (sem arquivo de
        iniciativa) → ignorada (não reportada); `[NEEDS CLARIFICATION]` em
        qualquer campo → reportado como ausente; `derived[]` nunca é gateado
    verifier:
      kind: shell
      command: node --test
        tests/phase-materialization/find-missing-business-intent.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-29T19:41:42.000Z
      passed: true
      exitCode: 0
      testsCollected: 10
      outputSummary: node --test
        tests/phase-materialization/find-missing-business-intent.test.js → exit
        0; ℹ tests 10 / ℹ pass 10 / ℹ fail 0. Detector gates the 5-field spine ×
        2 surfaces on MATERIALZIED phases (descriptor
        plan.phases[].businessIntent + initiative businessIntent); reports first
        missing/empty/[NEEDS CLARIFICATION] field per surface; descriptor-only
        phases (no initiative file) skipped (D5 backfill-on-activation);
        derived[] never gated; nested + flat layouts scanned; CLI exit 0/1
        (all-clear vs gap token). TDD red→green (ERR_MODULE_NOT_FOUND → 10/10).
    outputs:
      - kind: file
        path: scripts/find-missing-business-intent.js
      - kind: file
        path: tests/phase-materialization/find-missing-business-intent.test.js
    summary: "Cria find-missing-business-intent.js: checa os 5 campos da espinha × 2
      superfícies em fases materializadas, exit 0/1."
    weight: 3
parked: []
emerged: []
summary: Adiciona o campo de schema opcional businessIntent no phaseDescriptor
  do plano E na initiative (espelha summary) + o detector determinístico que o
  checa — zero mudança de comportamento.
planTitle: Materialização lazy de fases + gate de validação de negócio
planActive: true
---

# Narrative / notes

Initiative for phase **F0 — Fundações de schema + detector determinístico**.

## Decisions

- **businessIntent inline nos 2 schemas (não em `$defs` de common.schema.json).** Os `outputs[]` de T-001 listam só `plan.schema.json` + `initiative.schema.json` + o teste, e o `scopeBoundary` probe "NÃO alterar outros schemas". Logo o sub-schema foi inlined em `phaseDescriptor.properties` (plan) e `properties` (initiative), espelhando `summary` (que também é inline em ambos). Extrair a `$defs` exigiria tocar `common.schema.json` (fora de escopo) ou duplicar `$defs` em cada schema (sem ganho DRY).
- **`derived[]` items: `question` `minLength:1`, `answer` opcional `type:string`, item `additionalProperties:false`.** Espelha a convenção universal do codebase (strings significativas com `minLength:1`) e a regra do detector (vazio/`[NEEDS CLARIFICATION]` = ausente).
- **Teste valida documento CHEIO (`validatePlan` + `validateInitiative`), não sub-schema standalone.** Honra o acceptance literal ("um plano / uma initiative") e dá confiança de que o `additionalProperties:false` admite `businessIntent` no caminho completo do documento (model copiado de `tests/decompose.test.js:14-24`).
- **TDD red→green:** teste falhou primeiro (4 fails = os "aceita businessIntent completo", rejeitados por `additionalProperties`) → edits nos schemas → 11/11 green. Confirma que o gate é real, não tautológico.

## Session handoff

- **Narrative:** F0 2/2 tasks done; verify-on-done completo para task T-003. **T-003 fechado** (detector `find-missing-business-intent.js` + teste, 10/10 green, evidence no frontmatter, GATE-R2 pass, rollups 2/2). **Schema-drift do T-001 CORRIGIDO**: `npm run build:aideck-schema` regerou `assets/aideck-consumer/schema.json` c/ `businessIntent` (definitions 28; `--check` up-to-date ✓). **F0-G1 emendado** de `npm test -- tests/phase-materialization/` (rodava a suíte cheia c/ 8 falhas pré-existentes) p/ `node --test 'tests/phase-materialization/*.test.js'` (escopado, fiel ao intento do gate) → 21/21 green; **F0-G2 file-list reconciliada** p/ incluir o bundle. Ambos os arquivos re-validados. Gates pré-verificados PASS (F0-G1 21/21, F0-G2 scope OK). Próximo = review-code gate + advance de `phase-done` (NÃO rodados — checkpoint no boundary de fase).
- **Decision log (carregam, não re-litigar):** (1) detector: materializada = existência do init file (`initByPhaseId.has(id)`), NÃO `subPhaseCount`; reporta 1º campo faltante por superfície (ordem value→doneWhen); `[NEEDS CLARIFICATION]` (trim-exato) = ausente (proof-of-work); flat casa por `phaseId` (simétrico ao nested); `derived[]` nunca gateado; orphan initiatives não gateadas. (2) **schema-drift era do T-001** (commit `5cc60a7` mudou os 2 schemas-fonte sem regerar o bundle consumer; T-001 fechou c/ verificador escopo-estreito que não pegou); fix = regen canônico (`schema-drift.test.js` documenta o passo). (3) **8 falhas pré-existentes** (6 install `Unknown option '--scope'`/`use either --ide or --all-detected` + 2 refreshState `actual:13/expected:12`) herdadas da base do branch, presentes em HEAD=`5cc60a7` ANTES desta sessão, ALHEIAS ao phase-materialization → fora do escopo de F0; por isso F0-G1 foi escopado (o "não quebrar nada" é papel do F0-G2 diff-scope, que PASSA: 0 skill/flow file tocado). (4) **YAML gotcha**: plain-scalar c/ colon-space (ex. `scoped: node`) quebra o parse (`Nested mappings are not allowed`) → evitar em descriptions. (5) `npm test -- <dir>` NÃO escopa (o script globs a suíte cheia) + `node --test <dir>` (bare dir) falha c/ `Cannot find module` → usar `node --test '<glob>'`.
- **Single nextAction:** Rodar `phase-done F0`: (a) formalizar gates met — F0-G1 `node --test 'tests/phase-materialization/*.test.js'` (21/21), F0-G2 scope-confirm (já verificado); (b) **review-code gate** — diff `67f1257..HEAD`+uncommitted, **não-destrutivo** (puro aditivo: 203+106 insert, 0 delete) → `--mode=local`; (c) distillar lessons (fase limpa → provável zero, mas responder explicitamente); (d) gravar `reviewGate` no plan.md fase F0 (GATE-R3); (e) advance F0→F1 + `archive F0` + `new initiative` p/ F1.
- **Verbatim state:**
  - Worktree-home: `/Volumes/External/code/atomic-skills/.worktrees/phase-materialization` — branch `plan/phase-materialization`.
  - T-003 verifier (PASS, evidence no frontmatter): `node --test tests/phase-materialization/find-missing-business-intent.test.js` → exit 0, `ℹ tests 10 / pass 10 / fail 0`.
  - F0-G1 scoped verifier (PASS, pré-verificado): `node --test 'tests/phase-materialization/*.test.js'` → exit 0, `ℹ tests 21 / pass 21 / fail 0`.
  - schema-drift guard (PASS após regen): `node scripts/build-aideck-consumer-schema.mjs --check` → "schema.json up to date ✓".
  - F0-G2 scope (PASS): `git diff --name-only 67f1257..HEAD -- skills/ src/` + `git status --porcelain -- skills/ src/` → vazio (0 skill/flow file); deliverables = `meta/schemas/{plan,initiative}.schema.json` + `tests/phase-materialization/{business-intent-schema,find-missing-business-intent}.test.js` + `scripts/find-missing-business-intent.js` + `assets/aideck-consumer/schema.json`.
  - validate-state (PASS): `node scripts/validate-state.js .atomic-skills/projects/atomic-skills/phase-materialization/plan.md .atomic-skills/projects/atomic-skills/phase-materialization/phases/f0-fundacoes-de-schema-detector-determini.md` → "All 2 file(s) valid".
  - **Pré-existentes (fora do escopo F0):** `npm test` tem 8 falhas em HEAD=`5cc60a7` (6 install + 2 refreshState, ver decision log) — independentes do phase-materialization.
  - Scripts pelo **repo-root direto** (NÃO via `$(cat $HOME/.atomic-skills/package-root …)` — stale).
- **Uncommitted changes** (`git status --porcelain`, branch `plan/phase-materialization`):
  - ` M .atomic-skills/analytics/completions.jsonl` ← evento `task-done T-003`
  - ` M .atomic-skills/projects/atomic-skills/phase-materialization/phases/f0-*.md` ← `done T-003` (status/closedAt/evidence) + emendas F0-G1 (scoped) / F0-G2 (file-list) + `refresh-state.js` rollups
  - ` M .atomic-skills/projects/atomic-skills/phase-materialization/plan.md` ← emendas F0-G1 (scoped) / F0-G2 (file-list)
  - ` M assets/aideck-consumer/schema.json` ← regen (drift-fix do T-001)
  - `?? scripts/find-missing-business-intent.js` ← T-003 deliverable
  - `?? tests/phase-materialization/find-missing-business-intent.test.js` ← T-003 deliverable
  - Nenhum microcommit feito (`done` step 5 + `phase-done` step 8 microcommits pendentes).

## Self-review against code-quality gates

- **G1 read-before-claim**: 2 tasks closed, each linked to source lines in its `outputs[]` + the verifier run that closed it (T-001 `tests/phase-materialization/business-intent-schema.test.js` 11/11; T-003 `scripts/find-missing-business-intent.js` + test 10/10). At phase-done, F0-G1 re-run fresh this session — `node --test 'tests/phase-materialization/*.test.js'` → 21/21 exit 0; F0-G2 scope re-confirmed fresh — `git diff --name-only 67f1257..HEAD -- skills/ src/` = vazio.
- **G2 soft-language**: scanned `nextAction` + task/gate descriptions for the ban list (EN should/probably/works + PT deveria/provavelmente); written in indicative. 0 violations.
- **G6 reference-or-strike**: 2 exit criteria, 2 met with `evidence:` populated (F0-G1 exitCode:0/testsCollected:21; F0-G2 manual passed:true with scope diff); `reviewGate` stamped on the phase descriptor.
- **Codex review**: SKIPPED at phase-done — DESTRUCTIVE signal false over `67f1257..HEAD` (pure additive: 865 insert / 19 delete, 0 non-test/doc files deleted, 0 schema/data drop tokens), so `--mode=local` was the non-destructive default (G5), not a cross-model skip. The false-green risk cross-model mitigates is the destructive-delete regression, which is absent here.
- **Review gate (G2/GATE-R3)**: recorded on the phase descriptor as `reviewGate: { status: passed, at: 079c19d, mode: local, verifiedAt: 2026-06-30T16:10:18Z }`. Local review agent (clean context, sealed envelope) returned verdict clean — 0 findings (blocker/critical/major/minor all 0), 2 passes; the `businessIntent` sub-schema probed live across accept/reject edge cases (legacy-absent, complete, missing-`value`, empty-string, extra-prop, wrong-type, empty `derived[]`, derived-missing-`question`); both CLI exit-0/exit-1 paths tested; the `parseFrontmatter` import from `validate-state.js` resolves. 2 adjacent notes raised (NOT findings, outside F0 surface): pre-existing duplicate `spawnedFrom`/`spawnedPlans` keys in `plan.schema.json` (latent, predates this changeset); `configuredLanguage` copy-pasted into the detector by design (T-003 `scopeBoundary` forbade reusing the export).
- **Lessons (G1)**: 1 lesson distilled into `lessons/phase-materialization-f0-fundacoes-de-schema-detector-determini.md` (L-001, `scope: reusable` — per-task verifier narrowness on the source→artifact schema-drift of T-001; the narrow test verifier missed the un-regenerated consumer bundle, caught only by the broader phase gate), ratified by the operator. Surfaces at F1 start via `node scripts/list-lessons.js --phase F1`.

## Links

_(plan doc, external refs)_

