---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f3-project-finalize-dedicado-de
title: project finalize dedicado (Decisão 3)
goal: "introduzir o comando operator-prompted `project finalize` que PUBLICA a
  feature: `git push -u origin plan/<slug>` (sem renomear), `gh pr create --base
  <integrationRef> --head plan/<slug> --fill`, e grava a `pr-url`/identidade no
  estado do plano; prompt-quando-ausente do `integrationRef` (usar existente OU
  criar `develop` de `main`); mostra o diff e o PR proposto antes de agir; o
  `archive` continua zero-git e roda depois do merge."
status: done
branch: plan/worktree-lifecycle-finalization
started: 2026-06-17T16:51:02Z
lastUpdated: 2026-06-17T18:52:47Z
nextAction: null
parentPlan: worktree-lifecycle-finalization
phaseId: F3
tasksDone: 1
tasksTotal: 1
gatesMet: 2
gatesTotal: 2
weightDone: 1
weightTotal: 1
exitGates:
  - id: G-1
    description: project finalize documentado (push+PR→integrationRef+grava pr-url,
      prompt-quando-ausente), router lista o subcomando, archive intocado;
      skills válidos.
    status: met
    metAt: 2026-06-17T18:26:30Z
    verifier:
      kind: shell
      command: grep -q 'project-finalize' skills/core/project.md && grep -qi 'gh pr
        create' skills/shared/project-assets/project-finalize.md && npm run
        validate-skills
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T18:26:30Z
      exitCode: 0
      passed: true
      outputSummary: grep project-finalize + gh pr create matched; npm run
        validate-skills → ✓ All 15 skills valid (schema_version 0.2), exit 0.
    verifierLabel: "shell: grep -q 'project-finalize' skills/core/project.md && grep -…"
    evidenceSummary: passed · 2026-06-17
  - id: G-2
    description: O finalize consome o resolvedor de integrationRef (F1) e o
      invariante de teardown (F2) permanece a guarda de remoção.
    status: met
    metAt: 2026-06-17T18:26:30Z
    verifier:
      kind: shell
      command: grep -qi 'integration-ref'
        skills/shared/project-assets/project-finalize.md && npm run
        validate-skills
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T18:26:30Z
      exitCode: 0
      passed: true
      outputSummary: grep integration-ref matched in project-finalize.md
        (scripts/integration-ref.js); npm run validate-skills → ✓ All 15 skills
        valid, exit 0.
    verifierLabel: "shell: grep -qi 'integration-ref' skills/shared/project-assets/pro…"
    evidenceSummary: passed · 2026-06-17
stack:
  - id: 1
    title: project finalize dedicado (Decisão 3)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: Comando project finalize + wiring no router
    status: done
    closedAt: 2026-06-17T18:12:18Z
    lastUpdated: 2026-06-17T18:12:18Z
    summary: Comando project finalize (push + gh pr create + grava pr-url) e wiring
      no router.
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-finalize.md
      - kind: file
        path: skills/core/project.md
    scopeBoundary:
      - NÃO automatizar (sempre operator-prompted, mostra diff+PR antes)
      - NÃO alterar o `archive` (segue zero-git e posterior ao merge)
      - NÃO renomear `plan/<slug>` para `feat/<slug>`
      - NÃO colocar o `integrationRef` no frontmatter do plano.
    acceptance:
      - "`project-finalize.md` documenta o fluxo push `plan/<slug>` + `gh pr
        create --base <integrationRef>` + gravação da `pr-url` no estado,
        operator-prompted, mostrando o diff `plan/<slug>` contra o
        `integrationRef` antes"
      - documenta o prompt-quando-ausente do ref (usar existente OU criar
        `develop` de `main`, persistido uma vez em `routing.json`) consumindo
        `scripts/integration-ref.js`
      - o router `skills/core/project.md` lista o subcomando `finalize` na
        grammar e no dispatch table apontando para `project-finalize.md`, com a
        âncora `project-finalize`
      - "`npm run validate-skills` passa."
    verifier:
      kind: shell
      command: grep -q 'project-finalize' skills/core/project.md && grep -qi 'gh pr
        create' skills/shared/project-assets/project-finalize.md && npm run
        validate-skills
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T18:12:18Z
      exitCode: 0
      passed: true
      outputSummary: "grep -q 'project-finalize' skills/core/project.md && grep -qi
        'gh pr create' skills/shared/project-assets/project-finalize.md && npm
        run validate-skills → VERIFIER_EXIT=0; validate-skills: ✓ All 15 skills
        valid (schema_version 0.2)"
parked: []
emerged: []
summary: "Comando project finalize: publica a feature via push + PR para o develop."
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: false
---

# Narrative / notes

Initiative for phase **F3 — project finalize dedicado (Decisão 3)**.

## Session handoff (F3 — phase-done complete; archived record)
- **Narrative:** **F3 DONE + arquivada** (phase-done 2026-06-17, `--mode=both`): T-001 (project finalize doc + router wiring) fechado por verify-on-done (`VERIFIER_EXIT=0`). Exit-gates G-1 + G-2 met (grep + `validate-skills` ✓ 15 skills). Review-gate `--mode=both` sobre `076af09..HEAD`: local 1C/1M/1m + Codex blind 1C/3M/1m → informed 4M (2 dropped, 3 maintained, 1 emerged); **todos os in-scope aplicados** (`finalize.md` + `meta/catalog.yaml`), fix commit `e7913a7`, reviewGate `passed @ e7913a7`. 3 lessons F3 ratificadas. Plano avançado `currentPhase` F3→F4.
- **Decision log:** T-001 → Mode 1 (verifier grep-based não fixa o acceptance nuançado; skill-authoring auto-referencial). Aplicadas wlf-f1 L-002 (`git check-ref-format` no consumidor) + wlf-f2 L-001 (`pr-url` = `prIdentity` da teardown F2). Review cross-model trouxe disjuntos reais: validar `routing.json` no schema antes do resolver (F-001) + distinção `integrationRef` vs `baseRef` para git local (emerged F-003) + `meta/catalog.yaml subcommands` era ripple site perdido (F-004, recorre wlf-f0 L-001). `focus.json` untrackeado (`3dcdfbb`).
- **Single nextAction:** F3 encerrada — nada mais aqui. Próxima ação está no handoff de **F4** (iniciativa ativa): criar a new-task ratificada do follow-up (archive→`isTeardownSafe` passar `integrationRef`+`prIdentity`) e rodar o phase-start lessons gate de F4.
- **Verbatim state:** reviewGate F3 = `{status: passed, at: e7913a7, mode: both, reviewFile: .atomic-skills/reviews/2026-06-17-1850-wlf-f3-project-finalize.md}`. Review fixes commit `e7913a7`; T-001 impl commit `d74a1f0`; focus untrack `3dcdfbb`. Lessons em `lessons/worktree-lifecycle-finalization-f3-project-finalize-dedicado-de.md` (L-001 schema-validate+baseRef, L-002 recurrenceOf wlf-f0 L-001 catalog-ripple, L-003 produtor/consumidor).
- **Open follow-up (ratified → new-task):** `project-transitions.md` archive deve chamar `isTeardownSafe({ branch, baseRef, integrationRef, prIdentity })` lendo o `pr-url` gravado — senão a teardown bloqueia em `indeterminate-base`. Sinalizado na `finalize.md` Step 4; a new-task será criada em F4 (ratify-gated).
- **Uncommitted changes:** este phase-done (a commitar como commit 2): `plan.md` (F3 done + reviewGate + currentPhase F4 + F4 active), esta iniciativa F3 (done + gates met + current:false → `git mv` archive), iniciativa F4 (active + current + started + handoff), `lessons/wlf-f3....md` (3 lessons), `last-review.json`, `PROJECT-STATUS.md`.

## Decisions

### Lessons disposition (phase-start F3 — `node scripts/list-lessons.js --phase F3`, 14 applicable)
- **Apply (load-bearing no conteúdo do finalize):** `wlf-f1 L-002` (validade de FORMATO do ref mora no consumidor → `git check-ref-format` documentado no finalize); `wlf-f2 L-001` (decisão de segurança ancorada no sinal externo autoritativo → `pr-url`/identidade gravada = `prIdentity` que `isTeardownSafe`/F2 consome; autoridade = `gh pr view` MERGED ao vivo); `wlf-f0 L-001` (ripple → wirar `finalize` atinge grammar + dispatch table + pre-mutation gates, todos atualizados); `wlf-f0 L-002` (doc-assert discriminante → confirmado `project-finalize`/`finalize` ausentes de `project.md` antes da edição, grep não-vacuoso); `multiplan L-002` (G1 read-before-claim — âncoras/loci conferidos nos arquivos reais).
- **Keep (relevante no phase-done, sem ação direta na T-001):** `design-brief L-001` (`--mode=both` p/ contrato porta-única — recomendado no phase-done F3); `wlf-f2 L-003` (falha de `gh` = bloqueio seguro → informou a seção *Failure handling* do finalize); `wlf-f1 L-001`/`f0 L-001b` (adjudicador = re-run na primária, nunca Codex `-o` — N/A pois T-001 foi Mode 1).
- **Reject/Stale p/ T-001 (task de doc, sem schema/teste/guard novo):** `design-brief L-002`/`L-003`/`L-004`; `multiplan L-001`; `wlf-f2 L-002`.

## Self-review against gates (implement, F3)
- **G1 read-before-claim:** applied — T-001 fechado pela execução REAL do verifier (`grep … && grep … && npm run validate-skills` → `VERIFIER_EXIT=0`; `validate-skills`: ✓ All 15 skills valid); a forma da API consumida foi LIDA nos arquivos-fonte (`scripts/integration-ref.js` `resolveIntegrationRef`→`{ref,configured,source}`; `scripts/worktree-teardown.js:72-120` `isTeardownSafe` exige `prIdentity`, `pr-identity-missing` bloqueia), não inferida.
- **G2 soft-language:** applied — o close é evidence `passed:true` / `exitCode:0`, sem `should`/`works`/`looks-done`; `nextAction` + handoff escaneados pela ban-list.
- **G6 reference-or-strike:** applied — literais do handoff são paths/commands/exits verbatim (`VERIFIER_EXIT=0`, `validate-state` → `✓ All 1 file(s) valid`, `scripts/lib/validate-skills-core.js:357`, commit `3dcdfbb`).

## Self-review against code-quality gates (phase-done, F3)
- **G1 read-before-claim**: 1 task closed (T-001), linked to its `outputs[]` (`skills/shared/project-assets/project-finalize.md`, `skills/core/project.md`) and the verifier run that closed it (`VERIFIER_EXIT=0`).
- **G2 soft-language**: scanned `nextAction` + task/criterion descriptions for the ban list — 0 violations.
- **G6 reference-or-strike**: 2 exit criteria, both `met` with `evidence:` populated (G-1 + G-2, shell exit 0, `validate-skills` ✓ 15 skills); 0 deferred, 0 unverified.
- **Codex review**: ran via `atomic-skills:review-code 076af09..HEAD --mode=both` at HEAD = `e7913a7`, final verdict `needs_changes` (4 major, all applied in-scope), counts blind `0B/1C/3M/1m` → informed `0B/0C/4M/0m` (Δ 2 dropped / 3 maintained / 1 emerged), file `.atomic-skills/reviews/2026-06-17-1850-wlf-f3-project-finalize.md`.
- **Review gate (G2)**: recorded on the F3 phase descriptor as `reviewGate: { status: passed, at: e7913a7, mode: both, reviewFile: .atomic-skills/reviews/2026-06-17-1850-wlf-f3-project-finalize.md }` — GATE-R3 satisfied.
- **Lessons (G1)**: distilled 3 lessons into `lessons/worktree-lifecycle-finalization-f3-project-finalize-dedicado-de.md` (3 reusable, 0 local), user-ratified; L-002 `recurrenceOf` wlf-f0 L-001 (ripple-site recurrence). The F4 phase-start gate dispositions the reusable+open ones.

## Links

_(plan doc, external refs)_
