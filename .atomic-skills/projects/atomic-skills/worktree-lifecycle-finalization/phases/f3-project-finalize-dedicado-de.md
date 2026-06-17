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
status: active
branch: plan/worktree-lifecycle-finalization
started: 2026-06-17T16:51:02Z
lastUpdated: 2026-06-17T18:12:18Z
nextAction: T-001 done (verifier shell exit 0; validate-skills ✓ 15 skills).
  Last task of F3 closed → run phase-done to verify exit gates G-1/G-2 + the
  review-code phase-diff gate, then advance the plan (user opts in).
parentPlan: worktree-lifecycle-finalization
phaseId: F3
tasksDone: 1
tasksTotal: 1
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: project finalize documentado (push+PR→integrationRef+grava pr-url,
      prompt-quando-ausente), router lista o subcomando, archive intocado;
      skills válidos.
    status: pending
    verifier:
      kind: shell
      command: grep -q 'project-finalize' skills/core/project.md && grep -qi 'gh pr
        create' skills/shared/project-assets/project-finalize.md && npm run
        validate-skills
    verifierLabel: "shell: grep -q 'project-finalize' skills/core/project.md && grep -…"
  - id: G-2
    description: O finalize consome o resolvedor de integrationRef (F1) e o
      invariante de teardown (F2) permanece a guarda de remoção.
    status: pending
    verifier:
      kind: shell
      command: grep -qi 'integration-ref'
        skills/shared/project-assets/project-finalize.md && npm run
        validate-skills
    verifierLabel: "shell: grep -qi 'integration-ref' skills/shared/project-assets/pro…"
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
current: true
---

# Narrative / notes

Initiative for phase **F3 — project finalize dedicado (Decisão 3)**.

## Session handoff
- **Narrative:** **F3/T-001 DONE** (2026-06-17): criado `skills/shared/project-assets/project-finalize.md` (fluxo `project finalize`: resolve `integrationRef` via F1 → prompt-quando-ausente com `git check-ref-format --branch <ref>` NO consumidor → mostra `git diff <integrationRef>...plan/<slug> --stat` + PR proposto + HALT → `git push -u origin plan/<slug>` + `gh pr create --base <integrationRef> --head plan/<slug> --fill` → grava `pr-url`/identidade no `references[]` do plano; `archive` intocado, zero-git, pós-merge) + wiring no router `skills/core/project.md` (grammar dedicated line + dispatch row → `project-finalize.md` + `finalize` na lista de pre-mutation gates). Verifier shell `VERIFIER_EXIT=0`; `validate-skills` ✓ All 15 skills valid; `validate-state` F3 ✓ All 1 file(s) valid (GATE-R2). **Última task da F3 fechada → phase-done PENDENTE (não rodado; usuário opta).**
- **Decision log:** (1) T-001 roteado a **Mode 1 (Opus self-implementa)** — opt-out registrado (R-EXEC-30): a lane Mode 2 está on (`mode2Enabled+codexLane.enabled=true`), mas o verifier é grep-based e não fixa o acceptance nuançado (operator-prompted, formato-do-ref-no-consumidor, anchoring de autoridade externa, ripple do router); é skill-authoring auto-referencial do próprio router. (2) `meta/catalog.yaml` NÃO tocado — assets não são catalogados per-asset; `discoverBodySkills` (`scripts/lib/validate-skills-core.js:357`) escaneia só `skills/core` + `skills/modules`, então o novo asset é invisível ao orphan-check e `validate-skills` passa sem entrada de catálogo (editá-lo seria scope exit, fora dos `Files`). (3) **wlf-f1 L-002 APLICADA:** validação de FORMATO do ref (`git check-ref-format`) documentada NO finalize — F3 é o consumidor que a F1 deferiu. (4) **wlf-f2 L-001 APLICADA:** o `pr-url`/identidade gravado É o `prIdentity` que `isTeardownSafe` (F2, `scripts/worktree-teardown.js:84`) consome (`pr-identity-missing` bloqueia sem ele); autoridade = `gh pr view` MERGED ao vivo, não o registro local. (5) `focus.json` untrackeado (ponteiro de view machine-local) — commit `3dcdfbb`.
- **Single nextAction:** Commitar o trabalho F3/T-001 (3 arquivos abaixo), depois rodar **phase-done F3** (`atomic-skills:project phase-done`): verifica exit-gates G-1 + G-2 (ambos grep + `validate-skills`) + a review-code phase-diff gate (`--mode=both` recomendado — design-brief L-001: contrato porta-única), distila lessons F3, avança `currentPhase` F3→F4. Usuário opta (intrusive-actions).
- **Verbatim state:** Files tocados: `skills/shared/project-assets/project-finalize.md` (novo), `skills/core/project.md` (3 edições: grammar dedicated line, dispatch row, pre-mutation-gates list). T-001 verifier = G-1 verifier: `grep -q 'project-finalize' skills/core/project.md && grep -qi 'gh pr create' skills/shared/project-assets/project-finalize.md && npm run validate-skills` → `VERIFIER_EXIT=0`. G-2 verifier: `grep -qi 'integration-ref' skills/shared/project-assets/project-finalize.md && npm run validate-skills`. `validate-state` F3 → `✓ All 1 file(s) valid`. **Follow-ups abertos (herdados, fora deste plano):** install/detect suite RED pré-existente (10 falhas, base 4fbfb12); (F0) `shouldForkPlanBranch` sem caller runtime; PROJECT-STATUS.md stale (09/06; `focus.json` é a fonte viva, agora untracked). **Drift cosmético latente:** archived F1/F2 carecem do escalar `evidenceSummary` nas gates — `node scripts/compute-rollups.js` re-suja ambos (revertido aqui para escopar o commit à T-001).
- **Uncommitted changes (snapshot pré-commit):** ` M .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/phases/f3-project-finalize-dedicado-de.md` (T-001 done + evidence + rollups 1/1 + nextAction + handoff + lessons-disposition + self-review), ` M skills/core/project.md`, `?? skills/shared/project-assets/project-finalize.md`. Serão commitados juntos no próximo passo; após o commit, árvore LIMPA.

## Decisions

### Lessons disposition (phase-start F3 — `node scripts/list-lessons.js --phase F3`, 14 applicable)
- **Apply (load-bearing no conteúdo do finalize):** `wlf-f1 L-002` (validade de FORMATO do ref mora no consumidor → `git check-ref-format` documentado no finalize); `wlf-f2 L-001` (decisão de segurança ancorada no sinal externo autoritativo → `pr-url`/identidade gravada = `prIdentity` que `isTeardownSafe`/F2 consome; autoridade = `gh pr view` MERGED ao vivo); `wlf-f0 L-001` (ripple → wirar `finalize` atinge grammar + dispatch table + pre-mutation gates, todos atualizados); `wlf-f0 L-002` (doc-assert discriminante → confirmado `project-finalize`/`finalize` ausentes de `project.md` antes da edição, grep não-vacuoso); `multiplan L-002` (G1 read-before-claim — âncoras/loci conferidos nos arquivos reais).
- **Keep (relevante no phase-done, sem ação direta na T-001):** `design-brief L-001` (`--mode=both` p/ contrato porta-única — recomendado no phase-done F3); `wlf-f2 L-003` (falha de `gh` = bloqueio seguro → informou a seção *Failure handling* do finalize); `wlf-f1 L-001`/`f0 L-001b` (adjudicador = re-run na primária, nunca Codex `-o` — N/A pois T-001 foi Mode 1).
- **Reject/Stale p/ T-001 (task de doc, sem schema/teste/guard novo):** `design-brief L-002`/`L-003`/`L-004`; `multiplan L-001`; `wlf-f2 L-002`.

## Self-review against gates (implement, F3)
- **G1 read-before-claim:** applied — T-001 fechado pela execução REAL do verifier (`grep … && grep … && npm run validate-skills` → `VERIFIER_EXIT=0`; `validate-skills`: ✓ All 15 skills valid); a forma da API consumida foi LIDA nos arquivos-fonte (`scripts/integration-ref.js` `resolveIntegrationRef`→`{ref,configured,source}`; `scripts/worktree-teardown.js:72-120` `isTeardownSafe` exige `prIdentity`, `pr-identity-missing` bloqueia), não inferida.
- **G2 soft-language:** applied — o close é evidence `passed:true` / `exitCode:0`, sem `should`/`works`/`looks-done`; `nextAction` + handoff escaneados pela ban-list.
- **G6 reference-or-strike:** applied — literais do handoff são paths/commands/exits verbatim (`VERIFIER_EXIT=0`, `validate-state` → `✓ All 1 file(s) valid`, `scripts/lib/validate-skills-core.js:357`, commit `3dcdfbb`).

## Links

_(plan doc, external refs)_
