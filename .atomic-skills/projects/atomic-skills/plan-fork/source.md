# plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada

Um degrau novo na emergence ladder (7.5): quando uma fase de um plano em execução
vira grande demais para `new-phase`/`split-phase`, mas o plano-pai continua válido,
ela é forkada num plano-filho ligado por um elo bidirecional. O pai pausa (modo
pause) ou roda em paralelo numa worktree própria (modo parallel) e retoma na
fase-âncora quando o filho conclui. Distinto de `supersedes` (substituição); aditivo
e reversível. O elo vive num sidecar enquanto o aiDeck publicado não tolera os
campos; depois migra pra inline (decisão fechada com o agente do dashboard).

## Princípios

- **P1 Aditivo, nunca substitutivo.** fork-plan adiciona um elo pai/filho; o campo supersedes e a ladder existente ficam intactos.
- **P2 O filho é um plano de verdade.** Passa pelo DESIGN gate (R-ORCH-09) como qualquer plano; o fork-plan só ratifica o elo e delega ao fluxo new plan.
- **P3 Sidecar como ponte, inline como destino.** Os campos vivem num sidecar (links.json) não-aiDeck-facing enquanto o aiDeck publicado não declara os dois (spawnedFrom é .strict e derruba o card; spawnedPlans é stripado em silêncio); migram pra inline no plan.md em aiDeck maior ou igual a 0.1.2.
- **P4 Elo bidirecional ratificado.** O pai referencia o filho na fase-âncora (spawnedPlans), o filho referencia o pai (spawnedFrom); o porquê do fork passa pelo ratify gate. Fork é intra-project; mode mora só no filho.
- **P5 Reuso da maquinaria existente.** Pausa/retomada via switch/cascade-pause + archive-propagation; paralelo via parallelismAllowed + worktree-por-plano.

## F0 — Sidecar do elo, schema e validação

Goal: Gravar o elo num sidecar não-aiDeck-facing compatível com aiDeck 0.1.0, validar o sidecar, e cobrir detecção de ciclo com testes; a adição dos campos inline ao plan.schema.json fica deferida para a migração na F5.

### T-001 Sidecar links.json: reader e writer do elo

- **Files:** src/links-sidecar.js, src/links-sidecar.test.js
- **scopeBoundary:** não gravar spawnedFrom/spawnedPlans inline no plan.md nem nos frontmatters de fase enquanto o pin do aiDeck for 0.1.0; não editar código do aiDeck.
- **acceptance:** o elo (spawnedFrom no filho, spawnedPlans por fase no pai) é gravado e lido de links.json no dir do plano; plan.md e os frontmatters de fase ficam sem os dois campos sob aiDeck 0.1.0; um teste prova que o estado aiDeck-facing (frontmatter) não muda ao forkar.
- **verifier:** kind shell npm test

### T-002 Schema de validação do sidecar links.json

- **Files:** meta/schemas/links.schema.json, src/links-sidecar.test.js
- **scopeBoundary:** apenas o schema do sidecar; a adição de spawnedFrom/spawnedPlans ao plan.schema.json fica para a F5 (migração), não aqui.
- **acceptance:** o schema valida spawnedFrom com plan, phaseId, taskId opcional e mode em pause ou parallel, e spawnedPlans como array de slugs por fase; rejeita mode fora do enum.
- **verifier:** kind shell npm test

### T-003 Helper puro de detecção de ciclo no grafo pai/filho

- **Files:** src/spawn-graph.js, src/spawn-graph.test.js
- **scopeBoundary:** apenas a função pura de detecção sobre o grafo de elos (do sidecar); sem I/O, sem mutação; não conectar ao verbo aqui.
- **acceptance:** dada uma cadeia de elos, a função rejeita um fork que aponte para um ancestral (ciclo) e aceita uma cadeia acíclica.
- **verifier:** kind shell npm test

### T-004 Fixtures de par pai/filho e validação RED para GREEN

- **Files:** tests/fixtures/plan-fork/parent.plan.md, tests/fixtures/plan-fork/child.plan.md, tests/links-sidecar.test.js
- **scopeBoundary:** fixtures de teste apenas; não criar planos reais em .atomic-skills/.
- **acceptance:** validate-state aprova o par pai/filho com os frontmatters limpos (elo no sidecar); o teste fica vermelho antes da T-001 e verde depois.
- **verifier:** kind shell npm test

```yaml
exit_gate:
  criteria:
    - id: F0-G1
      description: "O elo vive no sidecar; plan.md e frontmatters de fase ficam sem spawnedFrom/spawnedPlans sob aiDeck 0.1.0; ciclo é rejeitado; os testes passam."
      verifier:
        kind: shell
        command: "npm run validate-state tests/fixtures/plan-fork/parent.plan.md tests/fixtures/plan-fork/child.plan.md && npm test"
```

## F1 — Verbo fork-plan + degrau 7.5 (pause-only até a F2)

Goal: Implementar o verbo fork-plan (ratify do elo + handoff ao fluxo new plan), inserir o degrau 7.5 residente na ladder, rodar o cycle-check antes de qualquer escrita, e entregar pause-only rejeitando o modo parallel até a F2 existir.

### T-001 Procedure fork-plan no project-emergence.md

- **Files:** skills/shared/project-assets/project-emergence.md
- **scopeBoundary:** não duplicar o fluxo new plan (o verbo delega a ele); não implementar render de dashboard.
- **acceptance:** o procedure parseia child-slug com from, mode e task, imprime o bloco Proposed mutation com o context drafted, e só grava o elo no sidecar após o ratify.
- **verifier:** kind shell grep -q fork-plan skills/shared/project-assets/project-emergence.md

### T-002 Degrau 7.5 residente e dispatch no router

- **Files:** skills/core/project.md
- **scopeBoundary:** apenas a linha 7.5 da ladder e a entrada na dispatch table; não reescrever a ladder existente.
- **acceptance:** a ladder ganha a linha 7.5 (a fase vira plano-filho, o pai sobrevive, roteando para fork-plan) e a dispatch table roteia fork-plan para project-emergence.md.
- **verifier:** kind shell grep -q fork-plan skills/core/project.md

### T-003 Cycle-check antes do ratify no fork-plan

- **Files:** skills/shared/project-assets/project-emergence.md, src/spawn-graph.js
- **scopeBoundary:** apenas a chamada do cycle-check (helper da F0) antes de qualquer escrita; não reimplementar a detecção.
- **acceptance:** o procedure exige rodar o cycle-check antes do ratify; ao detectar ciclo, aborta atômico sem gravar nada no sidecar.
- **verifier:** kind shell grep -q ciclo skills/shared/project-assets/project-emergence.md

### T-004 Pause completo e parallel rejeitado até a F2

- **Files:** skills/shared/project-assets/project-emergence.md
- **scopeBoundary:** reuso de switch/cascade-pause; o protocolo cross-worktree do parallel é a F2 e não é implementado aqui.
- **acceptance:** o modo pause documenta P para paused, fase para paused e filho active; o modo parallel é REJEITADO com mensagem clara apontando que depende da F2, evitando qualquer escrita cross-worktree antes do protocolo.
- **verifier:** kind shell grep -q parallel skills/shared/project-assets/project-emergence.md

```yaml
exit_gate:
  criteria:
    - id: F1-G1
      description: "fork-plan grava o elo no sidecar só após ratify; roda o cycle-check antes de qualquer escrita e aborta atômico em ciclo; o modo pause funciona e o parallel é rejeitado até a F2; o degrau 7.5 é roteado."
      verifier:
        kind: manual
        description: "Demonstrar um fork pause (ratify + cycle-check) e confirmar que parallel é rejeitado com mensagem apontando a F2."
```

## F2 — Protocolo de estado parallel cross-worktree

Goal: Definir e implementar o protocolo de estado do modo parallel com semântica de concorrência explícita: caminho canônico do estado do pai, escrita atômica com token de revisão, predicado de conflito, abort e recuperação, e verificação a partir do pai e do filho.

### T-001 Especificar o protocolo de estado parallel (concorrência otimista)

- **Files:** docs/design/plan-fork-parallel-state.md, skills/shared/project-assets/project-emergence.md
- **scopeBoundary:** apenas o modo parallel; o pause-mode não muda.
- **acceptance:** o doc define qual worktree detém o estado canônico do pai, a leitura por revisão ou hash, a escrita atômica, o predicado de conflito exato, a condição de abort, o caminho de recuperação para o usuário, e a verificação a partir das duas worktrees.
- **verifier:** kind shell test -f docs/design/plan-fork-parallel-state.md

### T-002 Implementar resolução canônica e writeback com concorrência otimista

- **Files:** src/parallel-state.js, src/parallel-state.test.js
- **scopeBoundary:** apenas a resolução e o writeback do estado parallel; não tocar o pause-mode.
- **acceptance:** dada uma worktree-filho, a função resolve o pai canônico mesmo em outra worktree e a escrita atinge o estado canônico via escrita atômica com token de revisão; edições simultâneas de pai e filho disparam o conflito (sem lost update) e abortam com caminho de recuperação; um teste simula a concorrência.
- **verifier:** kind shell npm test

```yaml
exit_gate:
  criteria:
    - id: F2-G1
      description: "O protocolo de concorrência otimista está definido e testado: a escrita atinge o estado canônico do pai e edições concorrentes pai/filho são detectadas e abortadas sem lost update."
      verifier:
        kind: shell
        command: "npm test"
```

## F3 — Loop de retomada (pause e parallel)

Goal: Na conclusão/archive do filho, oferecer retomar o pai na fase-âncora em ambos os modos, com semântica determinística para aceitar, recusar, sem TTY e writeback falho.

### T-001 Detecção de spawnedFrom no archive-propagation

- **Files:** skills/shared/project-assets/project-transitions.md
- **scopeBoundary:** estender o passo de archive; não mexer no fluxo de pausa (o switch já cobre).
- **acceptance:** o passo de archive lê o elo do sidecar do filho e imprime a oferta de retomada do pai na âncora; opt-in, nunca automática.
- **verifier:** kind shell grep -q spawnedFrom skills/shared/project-assets/project-transitions.md

### T-002 Retomada determinística nos dois modos e nos casos de borda

- **Files:** skills/shared/project-assets/project-transitions.md, src/parallel-state.test.js
- **scopeBoundary:** a aplicação da retomada; em parallel reusa o writeback da F2; em pause reusa refresh-state.
- **acceptance:** aceitar retoma o pai (status active, fase-âncora active, currentPhase igual ao id da âncora); recusar deixa um pending-resume durável; sem TTY registra o pending-resume sem prompt; writeback falho em parallel aborta com sinal de recuperação e não arquiva o filho silenciosamente; testes cobrem os quatro casos em pause e parallel.
- **verifier:** kind shell npm test

```yaml
exit_gate:
  criteria:
    - id: F3-G1
      description: "Aceitar, recusar, sem-TTY e writeback-falho têm semântica determinística em pause E parallel; nenhum caso deixa o filho arquivado com o pai num estado inconsistente."
      verifier:
        kind: manual
        description: "Exercitar os quatro casos em cada modo e confirmar o estado resultante do pai."
```

## F4 — Focus-resolver pai/filho (pause e parallel)

Goal: Fazer o resolver de foco tratar pai(paused)+filho(active) e pai(active)+filho(active) parallel como hierarquia, com precedência por worktree e aresta pai/filho.

### T-001 Consciência pai/filho no emit-focus e reconcile-focus

- **Files:** scripts/emit-focus.js, scripts/reconcile-focus.js
- **scopeBoundary:** apenas a regra de hierarquia pai/filho lida do sidecar; não alterar branch-match nem recência existentes.
- **acceptance:** no caso pause (pai paused + filho active) e no caso parallel (pai active + filho active) o resolver escolhe o filho sem marcar ambiguidade multi-active; sem par forkado o comportamento fica inalterado.
- **verifier:** kind shell npm test

### T-002 Testes do resolver nos dois casos

- **Files:** tests/emit-focus.test.js
- **scopeBoundary:** apenas casos de teste; a lógica de produção é a T-001.
- **acceptance:** teste vermelho antes da T-001 e verde depois, cobrindo pause(paused+active) e parallel(active+active).
- **verifier:** kind shell npm test

```yaml
exit_gate:
  criteria:
    - id: F4-G1
      description: "Os casos pause(paused+active) e parallel(active+active) resolvem para o filho sem ambiguidade; os casos de foco existentes não regridem."
      verifier:
        kind: test
        runner: node
        pattern: "emit-focus"
```

## F5 — Handoff aiDeck, docs e migração inline

Goal: Documentar a estrutura de estado para o aiDeck, atualizar a KB, e migrar o elo do sidecar para inline quando o aiDeck publicado tolerar os campos (maior ou igual a 0.1.2).

### T-001 Handoff ao aiDeck

- **Files:** ~/aideck/docs/handoffs/atomic-skills-plan-fork.md
- **scopeBoundary:** apenas o documento de handoff; não editar código do aiDeck.
- **acceptance:** o handoff documenta os campos exatos (spawnedFrom, spawnedPlans), a semântica pai/filho intra-project, a expectativa de render aninhado, e os dois modos de falha do .strict (spawnedFrom derruba o card, spawnedPlans é stripado).
- **verifier:** kind shell test -f /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md && grep -q spawnedFrom /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md && grep -q spawnedPlans /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md && grep -q strict /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md

### T-002 Atualizar a KB do atomic-skills

- **Files:** docs/kb/skill-authoring.md
- **scopeBoundary:** apenas a seção sobre a ladder/plan-fork; não reescrever a KB inteira.
- **acceptance:** a KB documenta o degrau 7.5 e o verbo fork-plan com link para project-emergence.md.
- **verifier:** kind shell grep -q fork-plan docs/kb/skill-authoring.md

### T-003 Migração sidecar para inline (gated em aiDeck maior ou igual a 0.1.2)

- **Files:** meta/schemas/plan.schema.json, src/links-sidecar.js
- **scopeBoundary:** só roda quando o pin do aiDeck for maior ou igual a 0.1.2; não emitir os campos inline enquanto o pin for 0.1.0.
- **acceptance:** com o pin maior ou igual a 0.1.2, spawnedFrom e spawnedPlans são adicionados ao plan.schema.json, o conteúdo do sidecar é migrado para o frontmatter, e o sidecar é removido; com pin 0.1.0 a task fica bloqueada e não emite inline.
- **verifier:** kind shell grep -q fork-plan docs/kb/skill-authoring.md

```yaml
exit_gate:
  criteria:
    - id: F5-G1
      description: "O handoff documenta os campos, a semântica intra-project e os dois modos de falha; a KB cobre o degrau 7.5; o caminho de migração sidecar-para-inline (gated em aiDeck maior ou igual a 0.1.2) está documentado."
      verifier:
        kind: shell
        command: "test -f /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md && grep -q spawnedPlans /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md && grep -q strict /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md"
```
