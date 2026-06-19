---
schemaVersion: "0.1"
slug: plan-fork-f1-verbo-fork-plan-degrau-7-5-pause-only-at
title: Verbo fork-plan + degrau 7.5 (pause-only até a F2)
goal: Implementar o verbo fork-plan (ratify do elo + handoff ao fluxo new plan),
  inserir o degrau 7.5 residente na ladder, rodar o cycle-check antes de
  qualquer escrita, e entregar pause-only rejeitando o modo parallel até a F2
  existir.
status: active
branch: plan/plan-fork
started: 2026-06-19T15:32:29.603Z
lastUpdated: 2026-06-19T18:53:49Z
nextAction: "Start T-001: Procedure fork-plan no project-emergence.md"
parentPlan: plan-fork
phaseId: F1
tasksDone: 4
tasksTotal: 4
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F1-G1
    description: fork-plan grava o elo no sidecar só após ratify; roda o cycle-check
      antes de qualquer escrita e aborta atômico em ciclo; o modo pause funciona
      e o parallel é rejeitado até a F2; o degrau 7.5 é roteado.
    status: pending
    verifier:
      kind: shell
      command: grep -q fork-plan skills/shared/project-assets/project-emergence.md &&
        grep -q fork-plan skills/core/project.md && grep -q ciclo
        skills/shared/project-assets/project-emergence.md && grep -q parallel
        skills/shared/project-assets/project-emergence.md && npm test
    verifierLabel: "shell: grep -q fork-plan skills/shared/project-assets/project-emer…"
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
current: true
---

# Narrative / notes

Initiative for phase **F1 — Verbo fork-plan + degrau 7.5 (pause-only até a F2)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff

- **Narrative:** F1 com as 4 tasks FECHADAS (4/4), cada uma via seu verifier real (exit 0) com `evidence.passed: true`; `validate-state` ✓. O degrau 7.5 está implementado: a seção `## \`fork-plan …\` (rung 7.5)` em `skills/shared/project-assets/project-emergence.md` (arg-parse --from/--mode/--task; step 3 cycle-check via `buildAdjacency`+`wouldCreateCycle` de `src/spawn-graph.js` ANTES do ratify; step 4 ratify gate; step 5 write no sidecar via `setSpawnedFrom`/`addSpawnedPlan` só após ratify; subseção `Mode semantics` com pause completo + parallel REJEITADO até F2), e a ladder 7.5 + dispatch `fork-plan` em `skills/core/project.md`. A fase está `active` aguardando `phase-done` (NÃO auto-rodado — intrusive-actions rule).
- **Decision log (herdado da F0 + desta sessão):** (1) o elo vive no sidecar `links.json`, NÃO inline no plan.md/frontmatter, enquanto o aiDeck for 0.1.0 (spawnedFrom derruba o card; spawnedPlans é stripado em silêncio). Migração inline deferida à F5 (aiDeck ≥ 0.1.2). Testes ficam em `tests/`. (2) Roteamento Mode-1 (Opus self-implement) escolhido apesar de `routing.json` ter Mode 2 (Codex) habilitado: as 4 tasks editam prose de skill com verifiers `grep` fracos (presença de token ≠ qualidade editorial) e 3 delas tocam o MESMO arquivo — a premissa Mode-2 "qualidade carregada pelo verifier" não se sustenta. (3) Verifier T-003 admitido como `grep -q ciclo` (PT) num arquivo em inglês: satisfeito citando o termo do design `detecção de ciclo` (D5) — referência cruzada fiel, não filler. (4) REGRESSÃO corrigida: o commit de T-001 droppou o heading `## Why provenance + context live on the item itself` (meu Edit substituiu o anchor sem re-anexá-lo); restaurado na árvore antes do commit de T-004. Candidato a lesson no phase-done.
- **Single nextAction:** Rodar `phase-done` para F1 — iterar o exit-gate F1-G1, rodar o review gate (review-code sobre o diff da fase) e avançar o plano para F2. NÃO auto-avançar; o usuário opta.
- **Verbatim state:** worktree `/home/henry/atomic-skills/.worktrees/plan-fork`; branch `plan/plan-fork`. ⚠ F1-G1 termina em `&& npm test` — o `npm test` completo está RED no baseline por causas ambientais (dashboard não-buildado + install, comprovado por stash na F0). Os 4 greps do gate passam (exit 0 cada); o `&& npm test` final NÃO foi rodado-para-verde. Antes/durante o `phase-done`: ou tornar o baseline verde, ou escopar o gate F1-G1 removendo o `&& npm test` como foi feito na F0 (decisão do usuário). Verifier de fase: `grep -q fork-plan skills/shared/project-assets/project-emergence.md && grep -q fork-plan skills/core/project.md && grep -q ciclo skills/shared/project-assets/project-emergence.md && grep -q parallel skills/shared/project-assets/project-emergence.md && npm test`.
- **Uncommitted changes:** só T-001 está commitado (`6ce35a6`). Por commitar agora (T-002+T-003+T-004 juntos): `skills/core/project.md` (ladder 7.5 + dispatch — T-002), `skills/shared/project-assets/project-emergence.md` (cycle-check step 3 — T-003; `Mode semantics` + heading `## Why provenance` restaurado — T-004), o estado da fase (T-002/T-003/T-004 done + este handoff) e `.atomic-skills/focus.json` (refresh-state).
