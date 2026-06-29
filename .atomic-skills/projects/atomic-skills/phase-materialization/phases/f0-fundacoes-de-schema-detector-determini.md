---
schemaVersion: "0.1"
slug: phase-materialization-f0-fundacoes-de-schema-detector-determini
title: Fundações de schema + detector determinístico
goal: Adicionar o campo de schema aditivo/opcional `businessIntent` no
  `phaseDescriptor` do plano E no schema da initiative (espelha `summary`), mais
  o detector determinístico `find-missing-business-intent.js` — todos com zero
  mudança de comportamento e totalmente backward-compat. Esta fase habilita
  F1–F4 sem alterar nenhum fluxo existente.
status: active
branch: plan/phase-materialization
started: 2026-06-29T13:19:41.314Z
lastUpdated: 2026-06-29T14:50:13.796Z
nextAction: "Start T-001: Adicionar sub-schema `businessIntent` ao
  `phaseDescriptor` E à initiative"
parentPlan: phase-materialization
phaseId: F0
tasksDone: 1
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 2
weightTotal: 5
exitGates:
  - id: F0-G1
    description: Schemas (plan phaseDescriptor + initiative) aceitam legados (sem
      businessIntent) e novos (com), e o detector exit-0/1 sobre fixtures
      canonicos
    status: pending
    verifier:
      kind: shell
      command: npm test -- tests/phase-materialization/
      expectExitCode: 0
    verifierLabel: "shell: npm test -- tests/phase-materialization/"
  - id: F0-G2
    description: Nenhum arquivo de fluxo/skill alterado nesta fase (zero behavior
      change confirmado pelo diff)
    status: pending
    verifier:
      kind: manual
      description: Confirmar via git diff que só meta/schemas/plan.schema.json +
        meta/schemas/initiative.schema.json +
        scripts/find-missing-business-intent.js + tests/ foram tocados
    verifierLabel: manual
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
    status: pending
    lastUpdated: 2026-06-29T13:19:41.314Z
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
current: true
---

# Narrative / notes

Initiative for phase **F0 — Fundações de schema + detector determinístico**.

## Decisions

- **businessIntent inline nos 2 schemas (não em `$defs` de common.schema.json).** Os `outputs[]` de T-001 listam só `plan.schema.json` + `initiative.schema.json` + o teste, e o `scopeBoundary` probe "NÃO alterar outros schemas". Logo o sub-schema foi inlined em `phaseDescriptor.properties` (plan) e `properties` (initiative), espelhando `summary` (que também é inline em ambos). Extrair a `$defs` exigiria tocar `common.schema.json` (fora de escopo) ou duplicar `$defs` em cada schema (sem ganho DRY).
- **`derived[]` items: `question` `minLength:1`, `answer` opcional `type:string`, item `additionalProperties:false`.** Espelha a convenção universal do codebase (strings significativas com `minLength:1`) e a regra do detector (vazio/`[NEEDS CLARIFICATION]` = ausente).
- **Teste valida documento CHEIO (`validatePlan` + `validateInitiative`), não sub-schema standalone.** Honra o acceptance literal ("um plano / uma initiative") e dá confiança de que o `additionalProperties:false` admite `businessIntent` no caminho completo do documento (model copiado de `tests/decompose.test.js:14-24`).
- **TDD red→green:** teste falhou primeiro (4 fails = os "aceita businessIntent completo", rejeitados por `additionalProperties`) → edits nos schemas → 11/11 green. Confirma que o gate é real, não tautológico.

## Session handoff

- **Narrative:** F0 em andamento no worktree-home. **T-001 fechado** — sub-schema `businessIntent` (5 campos obrigatórios-quando-presente `value`/`workflow`/`rules`/`outOfScope`/`doneWhen` + `derived[]` opcional) adicionado inline em `plan.schema.json` (`phaseDescriptor.properties`, após `summary`) e `initiative.schema.json` (`properties`, após `summary`), ambos properties-only fora do `required`; teste `tests/phase-materialization/business-intent-schema.test.js` 11/11 green; `done T-001` executado com `evidence.passed:true`/`testsCollected:11`, GATE-R2 validado. `tasksDone: 1/2`, `weightDone: 2/5`. **Falta T-003** (detector `find-missing-business-intent.js`, weight 3) para fechar F0.
- **Decision log:** carregam para a próxima sessão (não re-litigar) — vide `## Decisions` acima: inline vs `$defs`; convenções do sub-schema (`minLength:1`, `additionalProperties:false`); teste por documento cheio; TDD.
- **Single nextAction:** Começar **T-003** — criar `scripts/find-missing-business-intent.js` no mesmo molde de SAÍDA de `find-missing-summaries.js` (`configuredLanguage`, CLI exit 0/1, importa `parseFrontmatter` de `validate-state.js`, percorre nested+flat) + `tests/phase-materialization/find-missing-business-intent.test.js`; checa os 5 campos da espinha `businessIntent` × 2 superfícies (descriptor `plan.phases[].businessIntent` + initiative `businessIntent`) em fases **materializadas**, reporta o 1º ausente/vazio/`[NEEDS CLARIFICATION]`, exit 0/1; fases descriptor-only (sem arquivo de iniciativa) ignoradas; `derived[]` nunca gateado.
- **Verbatim state:**
  - Worktree-home (onde se codifica): `/Volumes/External/code/atomic-skills/.worktrees/phase-materialization` — branch `plan/phase-materialization` (a árvore primária `develop` está 1 commit atrás; o `plan.md`/fases só existem no worktree).
  - Verificador T-001 (PASS, evidence gravada no frontmatter): `node --test tests/phase-materialization/business-intent-schema.test.js` → exit 0, `ℹ tests 11 / ℹ pass 11 / ℹ fail 0`.
  - Gate GATE-R2 (PASS): `node scripts/validate-state.js .atomic-skills/projects/atomic-skills/phase-materialization/phases/f0-fundacoes-de-schema-detector-determini.md` → `✓ All 1 file(s) valid`, exit 0.
  - Scripts pelo **repo-root direto** (NÃO via `$(cat $HOME/.atomic-skills/package-root …)` — pode estar stale): `scripts/append-completion.js`, `scripts/refresh-state.js`, `scripts/validate-state.js`.
  - Exit gate F0-G1 (pendente; roda só em `phase-done`): `npm test -- tests/phase-materialization/`, `expectExitCode: 0`.
  - Deps do worktree instalados via `npm ci` (ajv etc.; gitignored, não suja a árvore).
- **Uncommitted changes** (`git status --porcelain`, branch `plan/phase-materialization`):
  - ` M meta/schemas/initiative.schema.json` ← T-001 deliverable
  - ` M meta/schemas/plan.schema.json` ← T-001 deliverable
  - `?? tests/phase-materialization/` ← T-001 deliverable (novo teste)
  - ` M .atomic-skills/projects/atomic-skills/phase-materialization/phases/f0-*.md` ← `done T-001` (status/closedAt/evidence + rollups)
  - ` M .atomic-skills/projects/atomic-skills/phase-materialization/phases/f1-*.md` … `f5-*.md` ← `refresh-state.js`: rollups/focus markers derivados (project-wide)
  - ` M .atomic-skills/projects/atomic-skills/phase-materialization/plan.md` ← `refresh-state.js`: focus markers
  - ` M .atomic-skills/analytics/completions.jsonl` ← evento `task-done T-001`
  - Nota: os `M` em f1–f5 + plan.md + analytics são efeito colateral **canônico** de `refresh-state.js` (mandatório no step 4 do `done`), **não** escopo de T-001.

## Links

_(plan doc, external refs)_

