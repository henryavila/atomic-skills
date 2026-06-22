---
schemaVersion: "0.1"
slug: skills-restructuring-f1-economia-de-tokens-project-e-implement
title: "Economia de tokens: project e implement"
goal: restaurar o router fino e o driver enxuto movendo conteúdo não-ambiente
  para detail/asset lazy, sem perder comportamento.
status: pending
branch: null
started: 2026-06-15T13:37:12.477Z
lastUpdated: 2026-06-15T14:21:04.364Z
nextAction: "Start T1.1: Router fino — mover blocos de referência para detail lazy"
parentPlan: skills-restructuring
phaseId: F1
tasksDone: 0
tasksTotal: 5
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 5
exitGates:
  - id: F1-G1
    description: project.md e implement.md encolhem e a suite de validação continua verde.
    status: pending
    verifier:
      kind: shell
      command: test $(wc -c < skills/core/project.md) -lt 22000 && test $(wc -c <
        skills/core/implement.md) -lt 22000 && grep -q 'mode2-codex-lane'
        skills/core/implement.md && grep -q 'verifier-exec'
        skills/shared/project-assets/project-transitions.md && npm run
        validate-skills
      expectExitCode: 0
    verifierLabel: "shell: test $(wc -c < skills/core/project.md) -lt 22000 && test $(…"
stack:
  - id: 1
    title: "Economia de tokens: project e implement"
    type: task
    openedAt: 2026-06-15T13:37:12.477Z
tasks:
  - id: T1.1
    title: Router fino — mover blocos de referência para detail lazy
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: "Router fino: schema-ref/rollups/cq-gates saem do resident para detail"
    description: "Mover schema quick-reference, mecânica de rollups/summaries e
      code-quality-gates do bloco resident de project.md para os detail files
      que os usam, deixando ponteiro de uma linha. Incorpora as correções
      T0.2/T0.3/T0.4 no novo local. Arquivos: skills/core/project.md,
      skills/shared/project-assets/project-transitions.md,
      skills/shared/project-assets/project-create-plan.md"
    scopeBoundary:
      - não mover Iron Law, pre-mutation gates, gate-status invariant, ratify
        gate nem emergence ladder (ficam resident).
    acceptance:
      - project.md não contém mais o heading Schema quick-reference
      - um detail file contém o conteúdo
      - project.md encolhe abaixo de 22000 bytes.
    verifier:
      kind: shell
      command: "! grep -q 'Schema quick-reference' skills/core/project.md && test $(wc
        -c < skills/core/project.md) -lt 22000 && npm run validate-skills"
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/project.md
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
  - id: T1.2
    title: Colapsar Red Flags e Rationalization do implement
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: "Red Flags/Rationalization do implement: gatilhos resident, refutação lazy"
    description: "Manter os gatilhos one-liner de Red Flags resident e mover a
      tabela de refutação Temptation→Reality para um asset lazy lido sob
      demanda. Arquivos: skills/core/implement.md,
      skills/shared/implement-antipatterns.md"
    scopeBoundary:
      - não remover os gatilhos one-liner; não tocar o Process nem a Iron Law.
    acceptance:
      - implement.md encolhe abaixo de 22000 bytes
      - o asset de anti-padrões existe
      - o corpo aponta para ele.
    verifier:
      kind: shell
      command: test -f skills/shared/implement-antipatterns.md && test $(wc -c <
        skills/core/implement.md) -lt 22000 && grep -q 'implement-antipatterns'
        skills/core/implement.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-antipatterns.md
  - id: T1.3
    title: Contrato Mode-2 em fonte única
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Contrato Mode-2 vira stub no implement, fonte única no lane
    description: "Reduzir o contrato Mode-2 em implement.md a um stub de quatro
      itens com ponteiro; manter a fonte única em mode2-codex-lane.md. Arquivos:
      skills/core/implement.md, skills/shared/mode2-codex-lane.md"
    scopeBoundary:
      - não duplicar F1/F2 nem o racional SDD no implement; o contrato completo
        vive só no lane.
    acceptance:
      - implement.md referencia mode2-codex-lane.md
      - a re-derivação de F1/F2 sai do implement.
    verifier:
      kind: shell
      command: grep -q 'mode2-codex-lane' skills/core/implement.md && test $(grep -c
        'spec-readiness' skills/core/implement.md) -le 1
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/mode2-codex-lane.md
  - id: T1.4
    title: Partir transitions e extrair verifier-exec compartilhado
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Transitions partido em core/rare + verifier-exec.md compartilhado
    description: "Separar o hot-path (done/push/pop) do cold-path em
      project-transitions, e extrair os padrões de execução de verifier para
      verifier-exec.md como fonte única. Arquivos:
      skills/shared/project-assets/project-transitions.md,
      skills/shared/project-assets/verifier-exec.md"
    scopeBoundary:
      - não inlinar o executor de verifier nos callers; preservar a semântica de
        GATE-R2.
    acceptance:
      - verifier-exec.md existe
      - project-transitions.md referencia verifier-exec
      - a suite de validação passa.
    verifier:
      kind: shell
      command: test -f skills/shared/project-assets/verifier-exec.md && grep -q
        'verifier-exec' skills/shared/project-assets/project-transitions.md &&
        npm run validate-skills
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/project-assets/verifier-exec.md
  - id: T1.5
    title: Corrigir decompose H3-mode para materializar o interior SPEC das tasks
    status: pending
    lastUpdated: 2026-06-15T14:05:45.977Z
    summary: decompose H3-mode passa a materializar o interior SPEC das tasks
    description: "O decompose (src/decompose.js), no modo H3 (### Tn), extrai só
      id+título e descarta o corpo da task (description +
      Files/scopeBoundary/acceptance/verifier), embora o SPEC gate
      (lint-source.js --spec) exija a forma verbosa ### Tn. Resultado: todo `new
      plan` materializa tasks sem interior — sem sinal de conclusão e
      não-dispatcháveis pro codex. Corrigir o H3-mode para parsear os 4 campos
      SPEC + a lead-description e mapeá-los aos campos de schema. Arquivos:
      src/decompose.js, tests/decompose.test.js"
    scopeBoundary:
      - não alterar a grammar de fases (## F<N>) nem o exit_gate YAML
      - não tocar o modo Sub-fases bullet; preservar R-ORCH-10 (heurísticas de
        fase intactas, exceto a extração de interior por task H3)
    acceptance:
      - "um source com ### Tn + os 4 campos materializa
        task.scopeBoundary/acceptance/verifier/description"
      - find-signalless-tasks reporta 0 num plano recém-materializado cujos
        tasks têm verifier
      - tests/decompose.test.js cobre o novo parsing de interior H3 (RED→GREEN)
      - validate-state passa nas tasks materializadas
    verifier:
      kind: shell
      command: node --test tests/decompose.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/decompose.js
      - kind: file
        path: tests/decompose.test.js
    tags:
      - correctness
      - toolchain
    provenance:
      surfacedAt: 2026-06-15T14:05:45.977Z
      surfacedDuring: skills-restructuring-f0-pente-fino-de-consistencia (review-plan)
      surfacedBy: ai
    context:
      solves: Todo `new plan` materializa tasks sem o interior SPEC, tornando-as
        não-implementáveis (implement recusa por R-ORCH-23) e não-roteáveis pro
        lane codex — sem corrigir, todo plano futuro precisa de remendo manual.
      trigger: "O review-plan interno deste plano achou 31/31 tasks sem interior; a
        causa-raiz é o decompose H3-mode descartar o corpo da task enquanto o
        SPEC gate exige a forma ### Tn verbosa."
      assumesStillValid:
        - "o SPEC gate continua exigindo a forma ### Tn verbosa (lint-source.js
          --spec)"
        - src/decompose.js continua sendo o transform canônico do decompose
        - tasks precisam do interior estruturado no schema pra serem
          dispatcháveis
      ratifiedAt: 2026-06-15T14:05:45.977Z
      ratifiedBy: human
      lastReviewedAt: 2026-06-15T14:05:45.977Z
parked: []
emerged: []
summary: Enxuga o router project e o driver implement movendo conteúdo
  não-ambiente para lazy.
planTitle: Reestruturação das skills atomic-skills
planActive: true
---

# Narrative / notes

Initiative for phase **F1 — Economia de tokens: project e implement**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
