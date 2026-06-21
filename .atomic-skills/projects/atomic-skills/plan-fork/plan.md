---
schemaVersion: "0.1"
slug: plan-fork
title: plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada
version: "1.0"
status: active
started: 2026-06-19T15:32:29.603Z
lastUpdated: 2026-06-20T01:33:14Z
branch: plan/plan-fork
currentPhase: F5
parallelismAllowed: false
principles:
  - id: P1
    title: Aditivo, nunca substitutivo. fork-plan adiciona um elo pai/filho; o campo
      supersedes e a ladder existente ficam intactos.
    body: Aditivo, nunca substitutivo. fork-plan adiciona um elo pai/filho; o campo
      supersedes e a ladder existente ficam intactos.
  - id: P2
    title: O filho é um plano de verdade. Passa pelo DESIGN gate (R-ORCH-09) como
      qualquer plano; o fork-plan só ratifica o elo e delega ao fluxo new plan.
    body: O filho é um plano de verdade. Passa pelo DESIGN gate (R-ORCH-09) como
      qualquer plano; o fork-plan só ratifica o elo e delega ao fluxo new plan.
  - id: P3
    title: Sidecar como ponte, inline como destino. Os campos vivem num sidecar
      (links.json) não-aiDeck-facing enquanto o aiDeck publicado não declara os
      dois (spawnedFrom é .strict e derruba o card; spawnedPlans é stripado em
      silêncio); migram pra inline no plan.md em aiDeck maior ou igual a 0.1.2.
    body: Sidecar como ponte, inline como destino. Os campos vivem num sidecar
      (links.json) não-aiDeck-facing enquanto o aiDeck publicado não declara os
      dois (spawnedFrom é .strict e derruba o card; spawnedPlans é stripado em
      silêncio); migram pra inline no plan.md em aiDeck maior ou igual a 0.1.2.
  - id: P4
    title: Elo bidirecional ratificado. O pai referencia o filho na fase-âncora
      (spawnedPlans), o filho referencia o pai (spawnedFrom); o porquê do fork
      passa pelo ratify gate. Fork é intra-project; mode mora só no filho.
    body: Elo bidirecional ratificado. O pai referencia o filho na fase-âncora
      (spawnedPlans), o filho referencia o pai (spawnedFrom); o porquê do fork
      passa pelo ratify gate. Fork é intra-project; mode mora só no filho.
  - id: P5
    title: Reuso da maquinaria existente. Pausa/retomada via switch/cascade-pause +
      archive-propagation; paralelo via parallelismAllowed + worktree-por-plano.
    body: Reuso da maquinaria existente. Pausa/retomada via switch/cascade-pause +
      archive-propagation; paralelo via parallelismAllowed + worktree-por-plano.
glossary: []
phases:
  - id: F0
    slug: plan-fork-f0-sidecar-do-elo-schema-e-validacao
    title: Sidecar do elo, schema e validação
    goal: Gravar o elo num sidecar não-aiDeck-facing compatível com aiDeck 0.1.0,
      validar o sidecar, e cobrir detecção de ciclo com testes; a adição dos
      campos inline ao plan.schema.json fica deferida para a migração na F5.
    dependsOn: []
    subPhaseCount: 4
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F0-G1
          description: O elo vive no sidecar; plan.md e frontmatters de fase ficam sem
            spawnedFrom/spawnedPlans sob aiDeck 0.1.0; ciclo é rejeitado; os
            testes passam. O caminho canônico do sidecar (links.json no diretório
            do plano), o schema e o reader/writer (src/links-sidecar.js) ficam
            definidos aqui na F0, antes de qualquer escrita da F1; a concorrência
            cross-worktree é deferida à F2 (pause-only não escreve concorrente).
          status: met
          metAt: 2026-06-19T18:53:49Z
          verifier:
            kind: shell
            command: npm run validate-state
              tests/fixtures/plan-fork/plans/fixture-parent.md
              tests/fixtures/plan-fork/plans/fixture-child.md && node --test
              tests/links-sidecar.test.js tests/spawn-graph.test.js
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-19T18:53:49Z
            exitCode: 0
            passed: true
            outputSummary: validate-state 2 plans cross-validated; node --test
              links-sidecar + spawn-graph → tests 40, pass 40, fail 0, exit 0 (after
              review fix 52ea43f)
    status: done
    reviewGate:
      status: passed
      at: 52ea43f536ee842d3c4b41926dd3842c07b6a15d
      mode: local
      reviewFile: .atomic-skills/reviews/2026-06-19-1553-plan-fork-f0.md
      verifiedAt: 2026-06-19T18:53:49Z
    summary: Sidecar (links.json) do elo + schema do sidecar + detecção de ciclo;
      inline deferido.
  - id: F1
    slug: plan-fork-f1-verbo-fork-plan-degrau-7-5-pause-only-at
    title: Verbo fork-plan + degrau 7.5 (pause-only até a F2)
    goal: Implementar o verbo fork-plan (ratify do elo + handoff ao fluxo new plan),
      inserir o degrau 7.5 residente na ladder, rodar o cycle-check antes de
      qualquer escrita, e entregar pause-only rejeitando o modo parallel até a
      F2 existir.
    dependsOn:
      - F0
    subPhaseCount: 4
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F1-G1
          description: fork-plan grava o elo no sidecar só após ratify; roda o cycle-check
            antes de qualquer escrita e aborta atômico em ciclo; o modo pause
            funciona e o parallel é rejeitado até a F2; o degrau 7.5 é roteado.
          status: met
          metAt: 2026-06-19T19:56:59Z
          verifier:
            kind: shell
            command: grep -q fork-plan skills/shared/project-assets/project-emergence.md
              && grep -q fork-plan skills/core/project.md && grep -q ciclo
              skills/shared/project-assets/project-emergence.md && grep -q parallel
              skills/shared/project-assets/project-emergence.md
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-19T19:56:59Z
            exitCode: 0
            passed: true
            outputSummary: "4 greps (fork-plan em project-emergence.md + project.md;
              ciclo + parallel em project-emergence.md) → exit 0. Gate escopado removendo
              o && npm test (RED ambiental, decisão do usuário, precedente F0). Review
              gate local achou+corrigiu 5 findings (4e23baf) antes do met."
    status: done
    reviewGate:
      status: passed
      at: 4e23baf0f398697ea51264b742af8e582057927e
      mode: local
      reviewFile: .atomic-skills/reviews/2026-06-19-1956-plan-fork-f1.md
      verifiedAt: 2026-06-19T19:56:59Z
    summary: Verbo fork-plan, degrau 7.5, cycle-check pré-ratify; pause-only até a F2.
  - id: F2
    slug: plan-fork-f2-protocolo-de-estado-parallel-cross-workt
    title: Protocolo de estado parallel cross-worktree
    goal: "Definir e implementar o protocolo de estado do modo parallel com
      semântica de concorrência explícita: caminho canônico, escrita atômica com
      token de revisão, predicado de conflito, abort e recuperação, e
      verificação a partir do pai e do filho."
    dependsOn:
      - F1
    subPhaseCount: 2
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F2-G1
          description: "O protocolo de concorrência otimista está definido e testado: a
            escrita atinge o estado canônico do pai e edições concorrentes
            pai/filho são detectadas e abortadas sem lost update."
          status: met
          metAt: 2026-06-20T01:33:14Z
          verifier:
            kind: shell
            command: node --test tests/parallel-state.test.js
              tests/links-sidecar.test.js tests/spawn-graph.test.js
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-20T01:33:14Z
            exitCode: 0
            passed: true
            outputSummary: "node --test (parallel-state + links-sidecar + spawn-graph)
              → tests 64, pass 64, fail 0, exit 0. Gate escopado (npm test → node --test;
              RED ambiental, decisão do usuário, precedente F0/F1). Review --mode=both
              achou+corrigiu 11 findings (6 local + 5 codex, 2 disjuntos só do codex)
              em 1f24eb3 antes do met."
    status: done
    reviewGate:
      status: passed
      at: 1f24eb3
      mode: both
      reviewFile: .atomic-skills/reviews/2026-06-20-0120-plan-fork-f2.md
      verifiedAt: 2026-06-20T01:33:14Z
    summary: Protocolo de estado parallel com concorrência otimista (revisão,
      conflito, abort).
  - id: F3
    slug: plan-fork-f3-loop-de-retomada-pause-e-parallel
    title: Loop de retomada (pause e parallel)
    goal: Na conclusão/archive do filho, oferecer retomar o pai na fase-âncora em
      ambos os modos, com semântica determinística para aceitar, recusar, sem
      TTY e writeback falho.
    dependsOn:
      - F2
    subPhaseCount: 2
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F3-G1
          description: Aceitar, recusar, sem-TTY e writeback-falho têm semântica
            determinística em pause E parallel; nenhum caso deixa o filho
            arquivado com o pai num estado inconsistente. Ordem de transação — o
            writeback do pai precede a finalização do archive; em writeback falho
            o archive persiste um pending-resume durável e o filho não finaliza
            até a recuperação.
          status: met
          metAt: 2026-06-20T09:51:26Z
          verifier:
            kind: shell
            command: npm test
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-20T09:51:26Z
            exitCode: 0
            passed: true
            outputSummary: "Verifier `npm test` escopado p/ `node --test
              tests/parallel-state.test.js tests/links-sidecar.test.js
              tests/spawn-graph.test.js` (baseline npm test RED ambiental —
              install/dashboard, sem relação; precedente F0/F1/F2): tests 75, pass
              75, fail 0, exit 0, em tree limpa (HEAD b6969e5). fork-resume cobre
              accept/refuse/no-TTY/writeback-falho × pause/parallel com hard gate
              no archive + marker-before-mutation."
    status: done
    reviewGate:
      status: passed
      at: b6969e5703ee8a2f3458ba269fa36b5353507987
      mode: both
      reviewFile: .atomic-skills/reviews/2026-06-20-0942-plan-fork-f3.md
      verifiedAt: 2026-06-20T09:51:26Z
    summary: Retomada determinística do pai (aceitar/recusar/sem-TTY/writeback falho).
  - id: F4
    slug: plan-fork-f4-focus-resolver-pai-filho-pause-e-paralle
    title: Focus-resolver pai/filho (pause e parallel)
    goal: Fazer o resolver de foco tratar pai(paused)+filho(active) e
      pai(active)+filho(active) parallel como hierarquia, com precedência por
      worktree e aresta pai/filho.
    dependsOn:
      - F3
    subPhaseCount: 2
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F4-G1
          description: Os casos pause(paused+active) e parallel(active+active) resolvem
            para o filho sem ambiguidade; os casos de foco existentes não
            regridem.
          status: met
          metAt: 2026-06-21T00:40:11Z
          verifier:
            kind: shell
            command: npm test
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-21T00:40:11Z
            exitCode: 0
            passed: true
            outputSummary: "Verifier npm test escopado p/ `node --test
              tests/focus-digest.test.js tests/reconcile-focus.test.js` (baseline
              RED ambiental — install/dashboard): tests 26, pass 26, fail 0, exit
              0, tree limpa HEAD 9b96ab2. Full npm test: 10 fails, todos
              ambientais, 0 novos (964 pass). emit-focus colapsa fork pai→filho
              (foco no filho, ⧉ limpa) e reconcile defere o current do pai; ambos
              intra-project, robustos a ciclo/torn-sidecar. Review --mode=both:
              local 6 + codex blind 5→final 6, todos corrigidos."
    status: done
    reviewGate:
      status: passed
      at: 9b96ab2dbda5a8f32c422e164859a84f59cf38a4
      mode: both
      reviewFile: .atomic-skills/reviews/2026-06-21-0024-plan-fork-f4.md
      verifiedAt: 2026-06-21T00:40:11Z
    summary: Resolver de foco trata pai/filho como hierarquia em pause e parallel.
  - id: F5
    slug: plan-fork-f5-handoff-aideck-docs-e-migracao-inline
    title: Handoff aiDeck, docs e migração inline
    goal: Documentar a estrutura de estado para o aiDeck, atualizar a KB, e migrar o
      elo do sidecar para inline quando o aiDeck publicado tolerar os campos
      (maior ou igual a 0.1.2).
    dependsOn:
      - F4
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F5-G1
          description: O handoff documenta os campos, a semântica intra-project e os dois
            modos de falha; a KB cobre o degrau 7.5; o caminho de migração
            sidecar-para-inline (gated em aiDeck maior ou igual a 0.1.2) está
            documentado e a migração é coberta por teste.
          status: pending
          verifier:
            kind: shell
            command: test -f /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md &&
              grep -q spawnedPlans
              /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md &&
              grep -q strict
              /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md &&
              grep -q fork-plan docs/kb/skill-authoring.md && npm test
    status: active
    summary: Handoff aiDeck + KB + migração sidecar→inline (gated em aiDeck ≥0.1.2).
references: []
planActive: true
planTitle: plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada
---

# plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada

## 1. Context

Um degrau novo na emergence ladder (7.5): quando uma fase de um plano em execução
vira grande demais para `new-phase`/`split-phase`, mas o plano-pai continua válido,
ela é forkada num plano-filho ligado por um elo bidirecional. O pai pausa (modo
pause) ou roda em paralelo numa worktree própria (modo parallel) e retoma na
fase-âncora quando o filho conclui. Distinto de `supersedes` (substituição); aditivo
e reversível. O elo vive num sidecar enquanto o aiDeck publicado não tolera os
campos; depois migra pra inline (decisão fechada com o agente do dashboard).

## 2. Inviolable principles

- **P1 Aditivo, nunca substitutivo. fork-plan adiciona um elo pai/filho; o campo supersedes e a ladder existente ficam intactos.** — Aditivo, nunca substitutivo. fork-plan adiciona um elo pai/filho; o campo supersedes e a ladder existente ficam intactos.
- **P2 O filho é um plano de verdade. Passa pelo DESIGN gate (R-ORCH-09) como qualquer plano; o fork-plan só ratifica o elo e delega ao fluxo new plan.** — O filho é um plano de verdade. Passa pelo DESIGN gate (R-ORCH-09) como qualquer plano; o fork-plan só ratifica o elo e delega ao fluxo new plan.
- **P3 Sidecar como ponte, inline como destino. Os campos vivem num sidecar (links.json) não-aiDeck-facing enquanto o aiDeck publicado não declara os dois (spawnedFrom é .strict e derruba o card; spawnedPlans é stripado em silêncio); migram pra inline no plan.md em aiDeck maior ou igual a 0.1.2.** — Sidecar como ponte, inline como destino. Os campos vivem num sidecar (links.json) não-aiDeck-facing enquanto o aiDeck publicado não declara os dois (spawnedFrom é .strict e derruba o card; spawnedPlans é stripado em silêncio); migram pra inline no plan.md em aiDeck maior ou igual a 0.1.2.
- **P4 Elo bidirecional ratificado. O pai referencia o filho na fase-âncora (spawnedPlans), o filho referencia o pai (spawnedFrom); o porquê do fork passa pelo ratify gate. Fork é intra-project; mode mora só no filho.** — Elo bidirecional ratificado. O pai referencia o filho na fase-âncora (spawnedPlans), o filho referencia o pai (spawnedFrom); o porquê do fork passa pelo ratify gate. Fork é intra-project; mode mora só no filho.
- **P5 Reuso da maquinaria existente. Pausa/retomada via switch/cascade-pause + archive-propagation; paralelo via parallelismAllowed + worktree-por-plano.** — Reuso da maquinaria existente. Pausa/retomada via switch/cascade-pause + archive-propagation; paralelo via parallelismAllowed + worktree-por-plano.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_
