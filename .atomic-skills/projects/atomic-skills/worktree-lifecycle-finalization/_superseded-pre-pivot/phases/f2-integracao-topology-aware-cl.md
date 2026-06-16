---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f2-integracao-topology-aware-cl
title: "Integração topology-aware: classificador de disjunção por footprint
  (Decisão 6)"
goal: substituir a regra "sempre serial" por integração topology-aware — um
  classificador de disjunção por footprint constrói o grafo de overlap das
  worktrees vivas e serializa (R-XAGENT-03 intacto) só DENTRO de componentes
  conexos, integrando componentes disjuntos em qualquer ordem; disjunção textual
  é sound mas não build-safe, então cada merge ainda re-verifica na primária.
  Octopus e projeção de trunk ficam fora da v1.
status: pending
branch: plan/worktree-lifecycle-finalization
started: 2026-06-16T15:05:46.324Z
lastUpdated: 2026-06-16T15:38:51.971Z
nextAction: "Start T-001: Classificador de disjunção por footprint"
parentPlan: worktree-lifecycle-finalization
phaseId: F2
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: "Classificador: footprints disjuntos caem em componentes separados,
      coupling file compartilhado une, componentes conexos detectados, rename
      expande footprint; suite verde."
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/worktree-footprint.test.js
    verifierLabel: "test: node tests/worktree-footprint.test.js"
  - id: G-2
    description: worktree-isolation.md documenta série-no-componente + ordem-livre +
      a sequência per-component merge sequence; implement.md reconciliado;
      skills válidos.
    status: pending
    verifier:
      kind: shell
      command: grep -qi 'topology-aware integration'
        skills/shared/worktree-isolation.md && grep -qi 'per-component merge
        sequence' skills/shared/worktree-isolation.md && grep -qi
        'topology-aware merge ordering' skills/core/implement.md && npm run
        validate-skills
    verifierLabel: "shell: grep -qi 'topology-aware integration' skills/shared/worktre…"
stack:
  - id: 1
    title: "Integração topology-aware: classificador de disjunção por footprint
      (Decisão 6)"
    type: task
    openedAt: 2026-06-16T15:05:46.324Z
tasks:
  - id: T-001
    title: Classificador de disjunção por footprint
    status: pending
    lastUpdated: 2026-06-16T15:38:51.971Z
    summary: Constrói o grafo de overlap das worktrees e acha os componentes conexos.
    outputs:
      - kind: file
        path: scripts/worktree-footprint.js
      - kind: test
        path: tests/worktree-footprint.test.js
    scopeBoundary:
      - função pura sobre diffs já capturados — NÃO executa merge nem git
        destrutivo no teste
      - NÃO octopus (v2)
      - NÃO tocar a série R-XAGENT-03 em `worktree-isolation.md` (T-002 faz a
        fiação)
      - "`COUPLING_FILES` é constante no módulo, não config nova em
        `focus.json`."
    acceptance:
      - "`footprintOf` converte a saída de `git diff --name-only
        <base>...<branch>` (três-pontos = mudanças da branch desde o merge-base,
        não diferença simétrica) num conjunto de paths, e um rename `a→b` entra
        como união `{a,b}`"
      - a constante `COUPLING_FILES` lista padrões v1 concretos deste repo —
        `package-lock.json`, `package.json` e qualquer `*.lock` — com ponto de
        extensão documentado
      - "`buildFootprintGraph(worktrees)` cria aresta entre duas worktrees sse
        os footprints se intersectam OU ambas tocam um `COUPLING_FILES`"
      - "`connectedComponents` devolve os componentes — footprints disjuntos sem
        coupling file caem em componentes separados, e um coupling file
        compartilhado os une mesmo com footprint disjunto"
      - há teste por padrão de coupling file declarado (`package-lock.json`,
        `package.json`, `*.lock`).
    verifier:
      kind: test
      runner: node
      pattern: tests/worktree-footprint.test.js
  - id: T-002
    title: "Fiação topology-aware: série dentro do componente, ordem-livre entre
      componentes"
    status: pending
    lastUpdated: 2026-06-16T15:38:51.971Z
    summary: Documenta série dentro do componente, ordem-livre entre componentes
      disjuntos.
    outputs:
      - kind: file
        path: skills/shared/worktree-isolation.md
      - kind: file
        path: skills/core/implement.md
    scopeBoundary:
      - NÃO automatizar merge→main
      - NÃO octopus (v2)
      - NÃO alterar a série R-XAGENT-03 DENTRO de um componente (preservada
        intacta) — só adicionar a camada de componentes por cima
      - sem integration-branch dedicada.
    acceptance:
      - "`worktree-isolation.md` documenta série-dentro-do-componente-conexo e
        ordem-livre-entre-componentes-disjuntos (R-XAGENT-03 intacto por
        componente), incluindo a sequência por-componente `merge um item →
        re-verify na primária → só então done/remove`, com as âncoras
        `topology-aware integration` e `per-component merge sequence`"
      - "`worktree-isolation.md` registra que disjunção textual é sound mas não
        build-safe (cada merge re-verifica na primária), que rename expande o
        footprint, e alinha a guarda de `--force` ao invariante de não-perda
        (nunca por default)"
      - '`implement.md` é reconciliado — o Red Flag que rejeita "disjoint →
        batch-merge" ganha um carve-out cross-referenciando o modelo
        topology-aware e deixa explícito que ordem-livre entre componentes não é
        merge paralelo nem batch-verify (a série + re-verify por merge
        continua), com a âncora `topology-aware merge ordering`'
      - "`npm run validate-skills` passa."
    verifier:
      kind: shell
      command: grep -qi 'topology-aware integration'
        skills/shared/worktree-isolation.md && grep -qi 'per-component merge
        sequence' skills/shared/worktree-isolation.md && grep -qi
        'topology-aware merge ordering' skills/core/implement.md && npm run
        validate-skills
parked: []
emerged: []
summary: Classificador de footprint decide o que serializa junto e o que integra
  em qualquer ordem.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
---

# Narrative / notes

Initiative for phase **F2 — Integração topology-aware: classificador de disjunção por footprint (Decisão 6)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
