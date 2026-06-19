---
schemaVersion: "0.1"
slug: plan-fork-f1-verbo-fork-plan-degrau-7-5-pause-only-at
title: Verbo fork-plan + degrau 7.5 (pause-only até a F2)
goal: Implementar o verbo fork-plan (ratify do elo + handoff ao fluxo new plan),
  inserir o degrau 7.5 residente na ladder, rodar o cycle-check antes de
  qualquer escrita, e entregar pause-only rejeitando o modo parallel até a F2
  existir.
status: done
branch: plan/plan-fork
started: 2026-06-19T15:32:29.603Z
lastUpdated: 2026-06-19T19:56:59Z
nextAction: null
parentPlan: plan-fork
phaseId: F1
tasksDone: 4
tasksTotal: 4
gatesMet: 1
gatesTotal: 1
exitGates:
  - id: F1-G1
    description: fork-plan grava o elo no sidecar só após ratify; roda o cycle-check
      antes de qualquer escrita e aborta atômico em ciclo; o modo pause funciona
      e o parallel é rejeitado até a F2; o degrau 7.5 é roteado.
    status: met
    metAt: 2026-06-19T19:56:59Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T19:56:59Z
      exitCode: 0
      passed: true
      outputSummary: 4 greps (fork-plan + ciclo + parallel) → exit 0; gate escopado
        (sem && npm test, RED ambiental, precedente F0); review local
        achou+corrigiu 5 findings (4e23baf) antes do met.
    verifier:
      kind: shell
      command: grep -q fork-plan skills/shared/project-assets/project-emergence.md &&
        grep -q fork-plan skills/core/project.md && grep -q ciclo
        skills/shared/project-assets/project-emergence.md && grep -q parallel
        skills/shared/project-assets/project-emergence.md
    verifierLabel: "shell: grep -q fork-plan skills/shared/project-assets/project-emer…"
    evidenceSummary: passed · 2026-06-19
stack:
  - id: 1
    title: Verbo fork-plan + degrau 7.5 (pause-only até a F2)
    type: task
    openedAt: 2026-06-19T15:32:29.603Z
tasks:
  - id: T-001
    title: Procedure fork-plan no project-emergence.md
    status: done
    lastUpdated: 2026-06-19T19:36:03Z
    closedAt: 2026-06-19T19:36:03Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T19:36:03Z
      exitCode: 0
      passed: true
      outputSummary: "grep -q fork-plan
        skills/shared/project-assets/project-emergence.md → exit 0 (section
        `fork-plan … (rung 7.5)` added: arg parse --from/--mode/--task,
        Proposed-mutation ratify gate, sidecar write via
        setSpawnedFrom/addSpawnedPlan only after ratify)"
    scopeBoundary:
      - não duplicar o fluxo new plan (o verbo delega a ele); não implementar
        render de dashboard.
    acceptance:
      - o procedure parseia child-slug com from, mode e task, imprime o bloco
        Proposed mutation com o context drafted, e só grava o elo no sidecar
        após o ratify.
    verifier:
      kind: shell
      command: grep -q fork-plan skills/shared/project-assets/project-emergence.md
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-emergence.md
    summary: "Procedure do fork-plan: ratify do elo no sidecar + handoff ao new plan."
  - id: T-002
    title: Degrau 7.5 residente e dispatch no router
    status: done
    lastUpdated: 2026-06-19T19:36:03Z
    closedAt: 2026-06-19T19:36:03Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T19:36:03Z
      exitCode: 0
      passed: true
      outputSummary: grep -q fork-plan skills/core/project.md → exit 0 (ladder ganhou
        a linha 7.5 entre split-phase e adopt/supersedes; dispatch table roteia
        fork-plan → project-emergence.md)
    scopeBoundary:
      - apenas a linha 7.5 da ladder e a entrada na dispatch table; não
        reescrever a ladder existente.
    acceptance:
      - a ladder ganha a linha 7.5 (a fase vira plano-filho, o pai sobrevive,
        roteando para fork-plan) e a dispatch table roteia fork-plan para
        project-emergence.md.
    verifier:
      kind: shell
      command: grep -q fork-plan skills/core/project.md
    outputs:
      - kind: file
        path: skills/core/project.md
    summary: Insere o degrau 7.5 na ladder e roteia no router.
  - id: T-003
    title: Cycle-check antes do ratify no fork-plan
    status: done
    lastUpdated: 2026-06-19T19:36:03Z
    closedAt: 2026-06-19T19:36:03Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T19:36:03Z
      exitCode: 0
      passed: true
      outputSummary: "grep -q ciclo skills/shared/project-assets/project-emergence.md
        → exit 0 (step 3 do procedure: cycle-check via
        buildAdjacency+wouldCreateCycle de src/spawn-graph.js ANTES do ratify;
        em ciclo aborta atômico sem write em nenhum sidecar; cita o guard
        `detecção de ciclo` D5 do design)"
    scopeBoundary:
      - apenas a chamada do cycle-check (helper da F0) antes de qualquer
        escrita; não reimplementar a detecção.
    acceptance:
      - o procedure exige rodar o cycle-check antes do ratify; ao detectar
        ciclo, aborta atômico sem gravar nada no sidecar.
    verifier:
      kind: shell
      command: grep -q ciclo skills/shared/project-assets/project-emergence.md
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-emergence.md
      - kind: file
        path: src/spawn-graph.js
    summary: fork-plan roda o cycle-check antes do ratify e aborta em ciclo.
  - id: T-004
    title: Pause completo e parallel rejeitado até a F2
    status: done
    lastUpdated: 2026-06-19T19:36:03Z
    closedAt: 2026-06-19T19:36:03Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T19:36:03Z
      exitCode: 0
      passed: true
      outputSummary: "grep -q parallel
        skills/shared/project-assets/project-emergence.md → exit 0 (subseção
        `Mode semantics`: pause documenta P→paused, fase→paused via
        cascade-pause, filho→active; parallel REJEITADO com mensagem clara
        apontando F2 e sem nenhum write em sidecar). Também restaurado o heading
        `## Why provenance` que o commit de T-001 droppara."
    scopeBoundary:
      - reuso de switch/cascade-pause; o protocolo cross-worktree do parallel é
        a F2 e não é implementado aqui.
    acceptance:
      - o modo pause documenta P para paused, fase para paused e filho active; o
        modo parallel é REJEITADO com mensagem clara apontando que depende da
        F2, evitando qualquer escrita cross-worktree antes do protocolo.
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-emergence.md
    summary: Pause completo; parallel rejeitado com mensagem até a F2.
    verifier:
      kind: shell
      command: grep -q parallel skills/shared/project-assets/project-emergence.md
parked: []
emerged: []
summary: Verbo fork-plan, degrau 7.5, cycle-check pré-ratify; pause-only até a F2.
planTitle: plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada
planActive: true
---

# Narrative / notes

Initiative for phase **F1 — Verbo fork-plan + degrau 7.5 (pause-only até a F2)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Self-review against gates (implement — F1 implementation)

- G1 read-before-claim: applied — cada task fechada carrega o run real do seu verifier (`grep … → exit 0`) no `evidence.outputSummary`, e o procedure cita os helpers da F0 por nome lido do source (`buildAdjacency`/`wouldCreateCycle` em `src/spawn-graph.js`, `setSpawnedFrom`/`addSpawnedPlan` em `src/links-sidecar.js`).
- G2 soft-language: applied — nenhuma das claims de conclusão usa should/probably/works; cada task é `done` com `evidence.passed: true`; handoff varrido pela ban list.
- G6 reference-or-strike: applied — literais do handoff são paths/commands/erros verbatim (verifier de fase colado, regressão do heading nomeada com o commit que a causou).
- Nota (regressão own-goal): o commit T-001 droppou o heading `## Why provenance + context live on the item itself`; corrigido na árvore antes do commit de T-004. Virou a lesson L-004 da F1.

## Self-review against code-quality gates (phase-done F1)

- **G1 read-before-claim**: 4 tasks fechadas, cada uma com o run real do verifier no `evidence.outputSummary`; o procedure cita helpers F0 lidos do source.
- **G2 soft-language**: scaneado `nextAction` + task/criterion descriptions; 0 violações.
- **G6 reference-or-strike**: 1 critério (F1-G1) met com `evidence` populado; reviewGate com `at` sha verbatim.
- **Codex review**: NÃO rodado; review local `--mode=local` sobre `d11705c..HEAD` (DESTRUCTIVE=false: diff aditivo, nenhum arquivo deletado), HEAD=`4e23baf`, achou 5 findings (2C/2M/1m), todos corrigidos, convergiu. File `.atomic-skills/reviews/2026-06-19-1956-plan-fork-f1.md`.
- **Review gate (G2)**: `reviewGate: { status: passed, at: 4e23baf, mode: local, reviewFile: …2026-06-19-1956-plan-fork-f1.md }` no descritor da fase F1. A prosa e o campo concordam.
- **Lessons (G1)**: 5 lessons (todas reusable) destiladas em `lessons/plan-fork-f1-*.md`, ratificadas pelo usuário. Dispostas no phase-start da F2.

## Session handoff

- **Narrative:** F1 FECHADA via phase-done. 4/4 tasks done (verifiers reais, `evidence.passed: true`); gate F1-G1 `met` (escopado sem `&& npm test` — decisão do usuário, precedente F0; 4 greps exit 0); review local `--mode=local` achou+corrigiu 5 findings procedurais (`4e23baf`); reviewGate `passed`; 5 lessons ratificadas; plano avançado `currentPhase=F2`. Implementação: degrau 7.5 (`fork-plan`) em `skills/shared/project-assets/project-emergence.md` (steps 1-8: validate/reject-parallel/gates/cycle-check/ratify/pause/handoff/write) + ladder 7.5 + dispatch em `skills/core/project.md`.
- **Decision log (herdado da F0 + desta sessão):** (1) o elo vive no sidecar `links.json`, NÃO inline no plan.md/frontmatter, enquanto o aiDeck for 0.1.0 (spawnedFrom derruba o card; spawnedPlans é stripado em silêncio). Migração inline deferida à F5 (aiDeck ≥ 0.1.2). Testes ficam em `tests/`. (2) Roteamento Mode-1 (Opus self-implement) escolhido apesar de `routing.json` ter Mode 2 (Codex) habilitado: as 4 tasks editam prose de skill com verifiers `grep` fracos (presença de token ≠ qualidade editorial) e 3 delas tocam o MESMO arquivo — a premissa Mode-2 "qualidade carregada pelo verifier" não se sustenta. (3) Verifier T-003 admitido como `grep -q ciclo` (PT) num arquivo em inglês: satisfeito citando o termo do design `detecção de ciclo` (D5) — referência cruzada fiel, não filler. (4) REGRESSÃO corrigida: o commit de T-001 droppou o heading `## Why provenance + context live on the item itself` (meu Edit substituiu o anchor sem re-anexá-lo); restaurado na árvore antes do commit de T-004. Candidato a lesson no phase-done.
- **Single nextAction:** Rodar `phase-done` para F1 — iterar o exit-gate F1-G1, rodar o review gate (review-code sobre o diff da fase) e avançar o plano para F2. NÃO auto-avançar; o usuário opta.
- **Decision log:** F1-G1 escopado removendo o `&& npm test` (RED ambiental: dashboard não-buildado + install — comprovado por stash na F0), seguindo o precedente da F0 — decisão do usuário neste phase-done. O gate met carrega só os 4 greps. A F2 (gate `npm test`) precisará da mesma decisão se o baseline seguir RED.
- **Single nextAction:** Semear a iniciativa da F2 — rodar `atomic-skills:project new initiative plan-fork-f2-protocolo-de-estado-parallel-cross-workt` (anexada à fase F2). O phase-start dispõe as 13+ lessons (inclui L-001..L-005 desta F1) via `node scripts/list-lessons.js --phase F2`. A F2 implementa o protocolo de estado cross-worktree do modo parallel (o que a F1 rejeitou).
- **Verbatim state:** worktree `/home/henry/atomic-skills/.worktrees/plan-fork`; branch `plan/plan-fork`. F1 arquivada em `phases/archive/2026-06-plan-fork-f1-verbo-fork-plan-degrau-7-5-pause-only-at.md`. Review file `.atomic-skills/reviews/2026-06-19-1956-plan-fork-f1.md`. Fixes do review em `4e23baf`.
- **Uncommitted changes:** será commitado no commit de phase-done F1 (gate scoping + gate met + reviewGate no plan.md, currentPhase=F2, F2 active, propagação da iniciativa F1, lessons file, review file, archive move, focus.json).
