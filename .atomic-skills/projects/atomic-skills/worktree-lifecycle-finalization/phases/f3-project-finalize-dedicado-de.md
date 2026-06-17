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
lastUpdated: 2026-06-17T16:51:02Z
nextAction: "Phase-start lessons gate F3 (node scripts/list-lessons.js --phase F3;
  esp. wlf-f1 L-002 + wlf-f2 L-001 git check-ref-format/ref-authority no consumidor).
  Depois Start T-001: Comando project finalize + wiring no router."
parentPlan: worktree-lifecycle-finalization
phaseId: F3
tasksDone: 0
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
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
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
- **Narrative:** **F2 DONE + arquivada** (phase-done 2026-06-17): T-001 (teardown squash-safe) fechado via Mode 2/Codex → ff-merge → re-verify na primária MERGED (`a6c98d9`, 17/17) + G9 mutation-kill; exit-gates G-1 (21/21 pós-review) e G-2 met; review-code `--mode=both` verdict `approve` (Codex blind levantou 1 major C-F001 squash-path → informed DROPOU sob a constraint "GitHub MERGED autoritativo + `git branch -d` 2ª guarda", confirmando Decisão 4; 3 lessons F2 ratificadas); plano avançado `currentPhase`→F3; iniciativa F2 arquivada. **F3 agora ATIVA** (project finalize dedicado, Decisão 3) — nada codado em F3 ainda.
- **Decision log:** Executor default = Codex Mode 2 (lane on, `minBatchTasks=1`); o adjudicador é sempre o re-run do verifier na primária MERGED (mode2 L-001), nunca o `-o` do Codex. Padrão F2 que funcionou: worktree isolada off HEAD sob `.worktrees/` → briefing com intent (contrato settled por Opus ANTES do dispatch) → diff readback → ff-merge serial → re-verify merged. F3 **CONSOME** `resolveIntegrationRef` de `scripts/integration-ref.js` (F1) e o invariante `isTeardownSafe`/`resolveBaseRef` de `scripts/worktree-teardown.js` (F2, agora a guarda de remoção).
- **Single nextAction:** Rodar o **phase-start lessons gate F3**: `node scripts/list-lessons.js --phase F3` e disposicionar. As mais relevantes p/ F3: `wlf-f1 L-002` + `wlf-f2 L-001` (validade de FORMATO do ref / `git check-ref-format` mora no consumidor que CRIA o ref — F3 É esse consumidor: ao criar/usar `develop`, validar o formato; ancorar a decisão no estado autoritativo do PR). Depois iniciar **F3/T-001** (Comando `project finalize`: `git push -u origin plan/<slug>` + `gh pr create --base <integrationRef> --head plan/<slug> --fill` + grava `pr-url`/identidade no estado; prompt-quando-ausente do integrationRef; mostra diff + PR proposto antes de agir; `archive` segue zero-git pós-merge).
- **Verbatim state:** Primária `plan/worktree-lifecycle-finalization` HEAD pós phase-done (a commitar). F3/G-1 verifier (grep): `grep -q 'project-finalize' skills/core/project.md && grep -qi 'gh pr create' skills/shared/project-assets/project-finalize.md && npm run validate-skills`; F3/G-2: `grep -qi 'integration-ref' skills/shared/project-assets/project-finalize.md && npm run validate-skills`. F2 entregou: `scripts/worktree-teardown.js` (`resolveBaseRef`→`{integrationRef,baseRef}|null`; `isTeardownSafe` liveness `gh.prView`+veto `headRefOid` squash-safe+`gh-lookup-failed` fail-closed), `tests/worktree-teardown.test.js` (21 testes). routing.json: `mode2Enabled+codexLane.enabled=true`. **Follow-ups abertos:** **install/detect suite RED pré-existente** (10 falhas em countSkills/installSkills, provado pré-existente na base 4fbfb12) — investigar fora deste plano; (F0) finding #2 `shouldForkPlanBranch` sem caller runtime. **PROJECT-STATUS.md stale** (09/06) — `focus.json` é a fonte viva (aponta F3).
- **Uncommitted changes:** a transição phase-done F2 (a commitar agora): `plan.md` (F2 gates met + reviewGate + status done + currentPhase F3), iniciativa F2 (done + current:false + nextAction null, `git mv` → `phases/archive/`), iniciativa F3 (active + current:true + started + este handoff), `lessons/wlf-f2....md` (3 lessons), `last-review.json` (approve @ 2a69940), `focus.json` (regen → F3). Após o commit, árvore LIMPA.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
