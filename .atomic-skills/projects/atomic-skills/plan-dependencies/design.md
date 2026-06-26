# plan-dependencies - dependencias executaveis entre planos

Design ratificado pelo usuario em 2026-06-25. O plano entrega dependencia
executavel entre planos, integracao com `fork-plan` e uma leitura operacional no
dashboard chamada **Caminho de execucao**.

## Context

Trabalhos grandes no atomic-skills se fragmentam em varios planos: cada modulo
ou frente ganha seu proprio `plan/<slug>` e worktree. Hoje o sistema mostra
varios planos ativos, mas a ordem causal entre eles nao e um contrato de estado.
O operador precisa saber qual plano esta liberado agora, qual plano esta
bloqueado, quem desbloqueia quem, e de onde um plano nasceu quando ele surgiu
durante uma fase ou task de outro plano.

Evidencia de estado atual:

```text
meta/schemas/plan.schema.json:7
"additionalProperties": false

meta/schemas/plan.schema.json:170
"dependsOn": {
```

O schema do plano e estrito, e a dependencia existente e apenas fase -> fase
dentro de `phases[]`. verified_by: meta/schemas/plan.schema.json:7,
meta/schemas/plan.schema.json:170.

```text
skills/shared/project-assets/project-emergence.md:180
The link lives INLINE in `plan.md` frontmatter

src/links-sidecar.js:139
Record the child->parent edge (`spawnedFrom`) INLINE

src/links-sidecar.js:184
Record the parent->child edge INLINE on the parent's anchor phase descriptor
```

O `fork-plan` ja grava origem pai/filho: filho -> pai via `spawnedFrom`, e pai
-> filho via `phases[].spawnedPlans`. verified_by:
skills/shared/project-assets/project-emergence.md:180,
src/links-sidecar.js:139, src/links-sidecar.js:184.

```text
scripts/emit-consumer-state.js:24
plans.json . phases.json . initiatives.json . tasks.json . gates.json

assets/aideck-consumer/manifest.yaml:213
dependsOnField: dependsOn

assets/aideck-consumer/handlers/get-dependencies.js:8
if (scope === 'phase') {
```

O aiDeck consome uma projecao denormalizada e ja renderiza dependencias de fase,
mas nao existe fonte de edges plano -> plano nem `get-dependencies` para
`scope: plan`. verified_by: scripts/emit-consumer-state.js:24,
assets/aideck-consumer/manifest.yaml:213,
assets/aideck-consumer/handlers/get-dependencies.js:8.

## Decisions

- **D1 - Origem e dependencia sao relacoes separadas.** `spawnedFrom` e
  `spawnedPlans` continuam descrevendo origem: um plano surgiu de outro plano,
  fase e task. Elas nunca bloqueiam execucao por si so. A dependencia
  operacional vive em `dependsOnPlans[]` no plano dependente.

- **D2 - O grafo canonico de execucao e `dependsOnPlans[]`.** Cada entrada
  referencia um plano prerequisito no mesmo `projectId`, registra como nasceu
  (`createdBy`), carrega `origin` quando a dependencia foi criada por
  `fork-plan`, e registra a politica de liberacao para `archived`. O inverso
  "este plano libera X" e derivado na projecao para dashboard, nao persistido
  como segunda fonte.

- **D3 - `fork-plan --mode pause` cria dependencia pai -> filho por default.**
  Quando `Plano 2` nasce de `Plano 1 / F2 / T-004` porque o trabalho foi
  extraido do caminho que o pai precisa concluir, o filho recebe `spawnedFrom`
  e o pai recebe `dependsOnPlans[{ plan: Plano 2, createdBy: fork-plan,
  origin: { phaseId: F2, taskId: T-004 } }]`. Assim o pai fica bloqueado ate o
  filho terminar. Um filho que e continuacao posterior usa direcao explicita em
  vez desse default.

- **D4 - Bloqueio e derivado do estado atual do prerequisito.** Um plano esta
  bloqueado quando algum `dependsOnPlans[].plan` referencia plano existente cujo
  status ainda nao liberou a dependencia. `done` libera automaticamente.
  `archived` continua bloqueando por default e libera somente quando o edge
  registra resolucao explicita. `active`, `paused` e `pending` bloqueiam. O
  estado bloqueado nao e persistido no `plan.md`.

- **D5 - Validacao rejeita grafo invalido antes de dashboard ou transicao.**
  O validador rejeita self-edge, referencia orfa, ciclo direto, ciclo
  transitivo e dependencia cross-project sem suporte explicito. Plano antigo sem
  `dependsOnPlans` segue valido.

- **D6 - Dashboard mostra duas camadas visuais.** **Caminho de execucao** usa o
  grafo `dependsOnPlans[]` para listar Liberado agora, Em andamento, Bloqueado e
  Concluido. **Surgiu de** usa `spawnedFrom` e `spawnedPlans` para mostrar a
  linhagem pai -> fase -> task -> filho. As duas camadas podem apontar para o
  mesmo evento de `fork-plan`, mas aparecem com labels diferentes.

- **D7 - aiDeck recebe edges denormalizados.** `scripts/emit-consumer-state.js`
  emite `planEdges.json` com edges de `dependency` e `origin`; o schema
  `aideck-state.schema.json`, o bundle `assets/aideck-consumer/schema.json`, o
  manifest e `get-dependencies` acompanham a nova fonte.

## Chosen approach

A abordagem escolhida e aditiva e preserva o `fork-plan` existente.

1. Adicionar campo opcional `dependsOnPlans[]` ao `plan.schema.json`, sem mudar
   `spawnedFrom` nem `phases[].spawnedPlans`.
2. Extrair um helper puro para grafo de planos: construir edges de dependencia,
   calcular bloqueios, validar ciclos e calcular ordem topologica do Caminho de
   execucao.
3. Integrar `fork-plan` no ponto em que ele ja chama `setSpawnedFrom` e
   `addSpawnedPlan`: apos materializar o filho, tambem escreve a dependencia
   operacional no pai quando `--mode pause` representa trabalho extraido.
4. Estender `validate-state.js` e testes para refs orfas, ciclos, self-edge,
   contrato de edge, semantica de `archived` e compatibilidade de planos
   legados.
5. Estender `emit-consumer-state.js` para gerar `planEdges.json` e campos
   derivados em `plans.json`: `blockedByPlansText`, `unblocksPlansText`,
   `originText`, `executionLane`.
6. Estender o dashboard: nova secao **Caminho de execucao** no Panorama ou Foco
   agora; secao **Relacoes do plano** no detalhe com Origem, Dependencias e
   Impacto.
7. Estender `get-dependencies` com `scope: plan`, mantendo os ramos atuais de
   `phase` e `task`.
8. Expor um caminho validado para dependencias manuais entre planos existentes,
   com add, remove, list e resolve.

Alternativas rejeitadas:

- **Usar `spawnedFrom` como bloqueio implicito.** Rejeitada porque origem e
  bloqueio divergem em casos reais: filho historico, filho paralelo opcional,
  continuacao posterior e ciclo operacional que nao e ciclo de origem.
- **Persistir `blockedByPlans[]` e `unblocksPlans[]`.** Rejeitada porque cria
  duas direcoes persistidas para o mesmo edge. O inverso e derivado.
- **Comecar por DAG interativo completo.** Rejeitada porque a pergunta diaria e
  "o que executa agora"; a timeline topologica entrega valor antes do grafo
  interativo.

## Blast radius

- `meta/schemas/plan.schema.json`: novo campo opcional `dependsOnPlans[]`.
- `scripts/validate-state.js`: validacao de refs e ciclos de dependencia entre
  planos.
- `src/spawn-graph.js` ou novo helper `src/plan-dependencies.js`: grafo
  topologico de planos, separado do grafo de origem.
- `skills/shared/project-assets/project-emergence.md`: `fork-plan` escreve a
  dependencia operacional default no pai quando o filho bloqueia a retomada.
- `skills/shared/project-assets/project-transitions.md`: `switch`, `phase-done`,
  `archive` ou `get-next-action` passam a mostrar bloqueio por plano antes de
  orientar execucao.
- `scripts/emit-consumer-state.js`: nova fonte `planEdges.json` e campos
  derivados nos records de planos.
- `meta/schemas/aideck-state.schema.json` e `assets/aideck-consumer/schema.json`:
  schema estrito da nova projecao.
- `assets/aideck-consumer/manifest.yaml`: widgets de Caminho de execucao e
  Relacoes do plano.
- `assets/aideck-consumer/handlers/get-dependencies.js`: novo `scope: plan`.
- Testes: `spawn-graph`, `validate-state`, `emit-consumer-state`,
  `aideck-state-schema`, `aideck-consumer-handlers` e um fixture de
  `fork-plan` com dependencia pai -> filho.

Containment: todos os novos campos sao opcionais; planos antigos sem
`dependsOnPlans` continuam validos. O design nao remove `spawnedFrom`, nao
remove `spawnedPlans`, nao altera o contrato fase -> fase e nao exige grafo
interativo para o MVP.

## Non-goals

- Nao substituir `spawnedFrom` ou `spawnedPlans`.
- Nao mover dependencias de fase para o grafo de planos.
- Nao criar dependencia cross-project nesta entrega.
- Nao implementar editor visual de grafo no primeiro corte.
- Nao fazer o dashboard escrever estado; a fonte continua sendo os arquivos em
  `.atomic-skills/`.

## Open questions

- Nome final do campo: `dependsOnPlans` ou `planDependencies`. A preferencia do
  design e `dependsOnPlans` por simetria com `phases[].dependsOn`.
- Comando explicito para dependencias manuais entre planos: `project depend` ou
  um subcomando dentro de `project emerge`. A primeira implementacao pode
  limitar a criacao automatica via `fork-plan`.
- Tratamento de `archived`: resolvido apos review cross-model. `archived`
  bloqueia por default; libera somente com resolucao explicita no edge.

## Self-review against code-quality gates

- G1 read-before-claim: aplicado. Claims sobre schema, `fork-plan`, emissor
  aiDeck, manifest e handler carregam trechos colados e referencias de arquivo.
- G2 soft-language: aplicado. A varredura pelos termos fracos definidos no gate
  retornou zero ocorrencias apos a limpeza.
- G6 reference-or-strike: aplicado. As afirmacoes sobre codigo existente usam
  `verified_by:` com arquivo e linha; as decisoes novas sao decisoes de design
  ratificadas pelo usuario em 2026-06-25.
