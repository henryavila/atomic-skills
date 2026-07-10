# Auditoria — `project` + `implement` (2026-07-10)

> Auditoria adversarial somente leitura da fonte, assets lazy, schemas, scripts,
> testes, file-set renderizado e instalação Codex real. Três auditores
> independentes investigaram contrato, wiring e cobertura; os achados abaixo
> foram revalidados no HEAD e, quando possível, reproduzidos em diretórios
> temporários.

## Sumário executivo

O núcleo possui schemas rigorosos, bons validadores e várias proteções úteis,
mas as skills não entregam de forma confiável o contrato principal fora do
próprio checkout de `atomic-skills`.

Os três bloqueadores mais graves são:

1. comandos centrais importam `./src/*` relativamente ao repositório consumidor;
2. `implement` lê um campo `Files` que não existe no estado materializado e
   interpreta `scopeBoundary[]` ao contrário do schema;
3. `phase-done` não chama o guard de tarefas abertas e depois fecha tarefas em
   lote sem passar pelo verifier de `done`.

Além disso, a criação always-fork escreve o estado no CWD antigo, evidência de
exit gates pode ficar obsoleta após fixes de review, analytics/handoff não formam
uma transação, contratos lazy obrigatórios não são instalados e a telemetria
Mode 2 possui dois formatos incompatíveis.

O resultado da suíte — 1639 testes, 1637 pass, 2 skip, 0 fail — é um falso sinal
de cobertura operacional: grande parte dos testes das skills verifica presença e
ordem de frases, não executa o ciclo prometido.

## Achados críticos

### C1 — comandos centrais resolvem `./src` e dependências a partir do consumidor

**Promessa:** as skills instaladas rodam a partir de qualquer repositório
consumidor, usando o package root instalado para seus scripts e dependências.

**Comportamento real:** vários procedimentos usam imports relativos ao CWD:

- `skills/shared/project-assets/project-create-plan.md:131-137,278-285,380-401`
  usa `import('./src/decompose.js')`;
- `skills/shared/project-assets/project-discover.md:154-166` usa
  `./src/bootstrap.js`;
- `skills/shared/project-assets/project-dependencies.md:64-69` usa
  `./src/links-sidecar.js`;
- `project-create-plan.md:478` depende de `yaml` resolvido pelo ambiente atual.

Reprodução em um consumidor sem checkout de `atomic-skills`:

```text
cwd: /tmp
node --input-type=module -e "import { addPlanDependency } from './src/links-sidecar.js'"
ERR_MODULE_NOT_FOUND: /private/tmp/src/links-sidecar.js
exit: 1
```

O teste `tests/skill-script-resolution.test.js` documenta corretamente que as
skills rodam no CWD consumidor, mas seu detector cobre apenas `node scripts/` e
`npm run ...`; imports `./src/*` ficam fora do regex.

**Impacto:** `new plan`, `adopt`, `discover` e `depend add` falham fora deste
repo — ou podem executar por engano um `src/*` homônimo do consumidor.

**Correção sugerida:** expor CLIs estáveis sob `scripts/` ou resolver imports
absolutos a partir de `~/.atomic-skills/package-root`, mantendo o CWD no projeto
consumidor. Ampliar o guard para imports relativos, `require()` e imports de
dependências privadas do pacote.

### C2 — seam SPEC → estado → implement está quebrada

**Promessa:** tasks aprovadas pelo SPEC gate chegam a `implement` com paths,
exclusões, critérios e verifier determinístico.

**Comportamento real:** `skills/core/implement.md:59,65` exige e lê `Files`, mas:

- `Files:` é apenas sintaxe da fonte;
- `src/decompose.js:380-410` o converte para `tasks[].outputs[].path`;
- `meta/schemas/initiative.schema.json:202-255` define Task com
  `additionalProperties:false` e não possui `Files`.

A task materializada real contém:

```json
{
  "keys": ["id", "title", "scopeBoundary", "acceptance", "verifier", "outputs"],
  "Files": null
}
```

Há ainda uma inversão mais perigosa: `implement.md:65-72` trata
`scopeBoundary[]` como allowlist e chama uma mudança fora dela de scope exit.
O schema (`initiative.schema.json:238-241`) e o linter
(`scripts/lint-source.js:337-345`) definem o campo como exclusões — “what this
task must NOT touch”. O teste
`tests/phase-materialization/implement-backstop.test.js:79-89` cristaliza a
frase invertida, produzindo um falso verde.

**Impacto:** toda task SPEC válida pode ser recusada por não conter `Files`; se o
agente continuar, pode tratar caminhos proibidos como os únicos caminhos
permitidos.

**Correção sugerida:** `implement` deve consumir `outputs[].path` como targets e
`scopeBoundary[]` como DO-NOT. Criar um contrato E2E
`lintSpec → decompose → schema → implement-ready`.

### C3 — `phase-done` pode fechar tasks sem verify-on-done

**Promessa:** uma task chega a `done` somente quando seu verifier roda, passa e
grava `evidence`; `phase-done` apenas fecha uma fase cujas tasks já estão
fechadas.

**Comportamento real:** `project-transitions.md:164-172` declara a precondição,
mas steps 1–2 não checam `tasks[]`. Em `:188-194`, o fluxo:

- seta toda task ainda não `done` para `done`;
- grava `closedAt`;
- emite um `task-done` para cada bulk-close;
- não executa o verifier de cada task.

O guard correto já existe em `scripts/lifecycle-order-guard.js:236-258` e retorna
`phase-done-open-task`, mas `project-transitions.md` só chama
`classifyLifecycleOrder` no fluxo de `archive` (`:283`), nunca em `phase-done`.

GATE-R2 pode detectar depois uma task determinística sem evidência, mas o
procedimento não roda uma validação/rollback antes do checkpoint. Tasks sem
verifier validam e ficam falsamente fechadas. O teste
`tests/transition-emits.test.js:47-56` inclusive espera os eventos do bulk-close.

**Impacto:** a fase pode avançar, arquivar e contabilizar trabalho não executado
ou não verificado — violação direta da Iron Law de `implement`.

**Correção sugerida:** chamar `classifyLifecycleOrder({command:'phase-done', ...})`
antes de qualquer verifier de gate ou mutação; remover o bulk-close e assertar que
o conjunto de tasks abertas é vazio. O teste deve provar zero writes, eventos e
commits quando uma task está aberta.

## Achados altos

### H1 — always-fork cria a worktree, mas escreve o novo plano na árvore antiga

`project-create-plan.md:94-100` cria branch/worktree `plan/<slug>` antes da
materialização. Os passos seguintes (`:128-181`) geram e escrevem paths relativos
`.atomic-skills/...` no CWD atual. Não existe `cd`, `git -C`, `EnterWorktree`,
prefixo da nova worktree, HALT/reinvoke ou outro handoff de execução.

`git worktree add` não muda o CWD. Portanto, a worktree nasce sem o plan state e
a árvore chamadora recebe arquivos cujo frontmatter declara outra branch.

No caminho de resume há um segundo defeito: `implement.md:44` sempre usa
`git worktree add ... -b <plan-branch>`. Quando a branch registrada já existe,
Git falha com `fatal: a branch named 'plan/existing' already exists`.

### H2 — exit-gate evidence pode ficar stale após a revisão obrigatória

`phase-done` roda exit-gate verifiers nos steps 3–5
(`project-transitions.md:167-172`) e só depois roda `review-code` (`:173-180`). O
review pode aplicar e commitar fixes blocker/critical (`:177-178`), mas os gates
não são rerodados contra o novo HEAD. `evidence` também não carrega o commit
verificado.

**Impacto:** uma fase pode fechar com evidência verdadeira para código que já
não é o código arquivado.

### H3 — `done` e analytics não são transacionais nem idempotentes

`project-transitions.md:134-145` emite `task-done` antes de refresh, save e
checkpoint. `scripts/append-completion.js:206-230` só usa `appendFileSync`, sem
idempotency key/deduplicação. `scripts/emit-consumer-state.js:565-614` soma cada
linha `task-done` encontrada.

Uma falha entre append e checkpoint, seguida de retry, gera evento órfão ou
earned value duplicado. A reprodução de duas chamadas idênticas produziu duas
linhas idênticas; o consumidor contabilizaria ambas.

### H4 — o handoff é atualizado depois do checkpoint que deveria contê-lo

Em `implement.md:75-79`, `done` grava o checkpoint de estado e o step 2.8 só
depois atualiza `## Session handoff`. O handoff vive no mesmo arquivo da
initiative; não há segundo commit. A skill simultaneamente proíbe um segundo
close commit (`:77-78,107`) e recusa resume em árvore suja (`:15,31-33`).

Resultado inevitável: ou o handoff em HEAD fica stale, ou a atualização deixa o
próximo resume bloqueado.

### H5 — contratos lazy obrigatórios de `implement` não entram na instalação

`implement.md` manda ler:

- `skills/shared/worktree-isolation.md` (`:37`);
- `skills/shared/mode2-codex-lane.md` (`:122`);
- `skills/shared/implement-antipatterns.md` (`:159,184`).

`project-create-plan.md:100` também depende de `worktree-isolation.md`. Contudo,
`src/providers/skills-file-set.js:101-139` instala apenas diretórios
`<owner>-assets/` pertencentes a uma skill ou módulo. Os três arquivos standalone
resultam em `installed=0`.

No checkout deste repo os paths parecem funcionar, mascarando o defeito; em um
consumidor normal eles não existem. Se o agente encontrar a fonte npm, ela ainda
está sem renderização das template variables.

### H6 — telemetria Mode 2 escreve NDJSON, mas o reader espera array JSON

`skills/shared/mode2-codex-lane.md:179-207` exige um objeto compacto por linha.
`scripts/append-completion.js:106-126` faz `JSON.parse` do arquivo inteiro e
exige `Array.isArray(log)`.

O estado real já demonstra a falha:

- `.atomic-skills/status/dispatch-log.json:1-30` contém NDJSON;
- `:31-384` contém um array JSON pretty-printed anexado ao mesmo arquivo;
- `readDispatchActuals` retornou `undefined` para um registro conhecido
  (`plan-dependencies/F1/T1.1`).

Tentativas, duração e escalations são silenciosamente omitidas dos completion
events.

### H7 — `materialize` promete atomicidade, mas faz writes sequenciais

`project-materialize.md:24-45` promete update atômico de plan + initiative. Em
`:119-139`, os conteúdos são construídos em memória, mas os dois arquivos são
escritos sequencialmente; em detector/validation failure, `:141-166` deixa as
edições abertas para reparo. Não há creation-gate, temp+rename, rollback ou
recovery marker.

`tests/phase-materialization/materialize-verb.test.js:29-41` apenas verifica que
a expressão “descriptor atomically” aparece no Markdown.

### H8 — `implement` não carrega explicitamente a closure authority que invoca

`implement.md:75` diz apenas “run `done <task-id>`”. A mecânica real de `done`
está em `project-transitions.md:127-145`, que por sua vez exige
`verifier-exec.md`. A regra do router diz que o detail file deve ser lido antes
de agir, mas uma invocação normal de `implement` não carrega automaticamente a
skill `project` nem aponta para o detail de `done`.

O resultado depende de um dispatch implícito entre skills que não é executado
como subcomando real pelo host.

### H9 — argumento explícito de `implement` não seleciona realmente o plano

`implement.md:3` promete interpretar o argumento como `<plan>` ou
`<project>/<plan>`, mas essa é sua única ocorrência. O restante do fluxo sempre
lê “active plan”/“active initiative” (`:32,39,53`). O resume gate ainda roda na
árvore chamadora antes de resolver a plan worktree.

Pode-se, portanto, invocar `implement plan-b` e orientar/recusar a execução com
base no estado de `plan-a` ou na sujeira da árvore errada.

### H10 — `verify --fix` pode executar o normalizer errado ou não encontrar nenhum

`project-verify.md` exige `src/normalize.js`; `project-view.md:192-203` tenta
primeiro `$PWD/src/normalize.js`, depois global npm e
`~/.atomic-skills/src/normalize.js`. O runtime instalado copia para este último
diretório apenas `provision-consumer.js` (`src/install.js:115-132`).

Em instalações local/npx, o normalizer pode não existir; se o consumidor possuir
seu próprio `src/normalize.js`, o fluxo pode executar código com o mesmo nome mas
sem relação com atomic-skills.

## Achados médios

### M1 — query verifiers admitidos não têm closure reproduzível

`implement` aceita `kind:query` como determinístico. O schema
`common.schema.json:109-116` modela apenas `sql` e um `expectRowCount` opcional.
`verifier-exec.md:56-68` só permite `met` quando “o caller” fornece um real
connection command — campo que não existe no verifier. Sem ele, o fluxo defere;
tasks não possuem status `deferred` e permanecem abertas. Se
`expectRowCount` estiver ausente, a igualdade usada para `passed` tampouco tem
valor esperado definido.

### M2 — `reconcile` grava um campo inválido em exit criteria

Em `project-transitions.md:158`, `Still open` manda atualizar
`entry.lastUpdated`. Tasks possuem esse campo; ExitCriterion não possui e é
`additionalProperties:false` (`common.schema.json:163-203`).
`detect-completion.js:388-400` usa o timestamp da initiative para critérios, logo
o write ou invalida o YAML ou não impede o critério de reaparecer.

### M3 — degraded mode contradiz o hard-stop de SPEC

`implement.md:54-62` manda parar diante de tasks sem SPEC/verifier. O degraded
mode (`:129-134`) inclui explicitamente “a plan whose tasks lack admitted
verifiers” e one-offs. Isso conflita também com a exigência de uma declaração
ad-hoc em `project.md:102`.

### M4 — Iron Law single-threaded contradiz o Mode 2 concorrente

O core diz que apenas leituras fazem fan-out e que a skill nunca codifica duas
tasks ao mesmo tempo (`implement.md:7-13,112-116,188`). O contrato Mode 2 permite
worktrees Codex concorrentes quando os escopos são independentes
(`mode2-codex-lane.md:59-71`). Se a intenção real é “um writer por árvore + merge
serial”, a Iron Law precisa declarar isso explicitamente.

### M5 — fuzzy resolution está no asset errado para vários callers

`project-transitions.md:16-28` afirma que a resolução fuzzy vale para todo
slug/phase/task, inclusive `materialize`, `depend`, `split-phase` e `why`.
Entretanto esses verbos lazy-loadam outros assets, e a regra não é resident no
router. `project-materialize.md:52-57`, por exemplo, aceita somente id ou slug
exato.

### M6 — listas de pre-mutation gates divergem

O router inclui `unblock`, `finalize`, `consolidate`, `depend`, `reconcile` e
`verify --fix`; o detail em `project-transitions.md:34-39` mantém uma lista menor.
Um agente que segue o detail pode pular o gate para verbos recentes.

### M7 — `reconcile` não é literalmente o único completion-mutation path

O mesmo arquivo chama `done` de closure authority (`:127`) e `reconcile` de “the
only completion-mutation path” (`:147`). A formulação correta é “único caminho
de mutação disparado por detection drift”.

### M8 — `adopt` tem contratos incompatíveis

O fluxo geral diz que No-Placeholders não tem exceção e menciona `adopt`; a seção
específica o torna advisory (`project-create-plan.md:61,92,390`). A emergence
ladder ainda promete um link `supersedes`, mas o procedimento não o coleta nem o
escreve.

### M9 — documentação e catálogo ainda expõem modelo legacy

`docs/concepts/project-tracking.md` e partes de `docs/skills/project.md` ainda
ensinam skills removidas/layout flat. `meta/catalog.yaml` lista artifacts flat,
omite Codex de compatibilidade em pontos já suportados, declara network false
para operações GitHub e chama `implement` de “Mode 1” apesar do Mode 2 default
quando habilitado.

## Instalação real vs HEAD

A instalação Codex existente diverge do HEAD em sete assets:

```text
hooks/README.md
project-consolidate.md
project-dependencies.md
project-finalize.md
project-setup.md
project-transitions.md
project-verify.md
```

Os hashes batem com o manifest instalado, portanto não são edições do usuário:
a instalação está defasada. Consequências observadas:

- o setup instalado ainda é Claude-only e não contém o wiring atual de Codex;
- o `project-transitions.md` instalado pula guards acrescentados na fonte;
- `project-dependencies` e `project-verify` instalados não têm correções atuais.

Isso é separado dos bugs da fonte: reinstalar pode corrigir o drift dos sete
assets, mas não corrige imports CWD-bound, assets standalone ausentes, o seam
`Files`/`scopeBoundary` ou o bypass de `phase-done`.

## Cobertura e falsos verdes

### Comandos executados

- suíte completa: `1639` testes, `1637` pass, `2` skip, `0` fail;
- recorte contract/lifecycle: `161/161` pass;
- recorte wiring/install: `158/158` pass;
- recorte project/implement: `199/199` pass;
- `npm run validate-skills`: 15 skills válidas;
- `npm run check-docs`: pass;
- `scripts/lint-transition-emits.js`: pass apesar do bypass de tasks;
- worktree limpa ao final.

### Por que o verde não refuta os achados

- `tests/implement.test.js` possui um único teste regex de presença textual;
- `tests/project.test.js` verifica majoritariamente que palavras aparecem nos
  assets;
- `tests/phase-materialization/e2e-lifecycle.test.js` fabrica `passed:true` e
  altera o estado diretamente — não executa `done`, `phase-done`, verifier,
  analytics, review, lessons, archive ou commits;
- `implement-backstop.test.js` afirma a semântica invertida de scope;
- `materialize-verb.test.js` afirma a palavra “atomically”, sem fault injection;
- o guard de resolução procura `node scripts/`, não imports `./src/*`;
- os testes instalam em tmp a fonte atual, não comparam por padrão contra a
  instalação global efetivamente carregada pelo agente.

## Plano de correção recomendado

### P0 — restaurar o caminho principal

1. trocar `Files` por `outputs[].path` em `implement` e corrigir
   `scopeBoundary[]` para DO-NOT;
2. resolver todos os componentes internos a partir de um package root confiável;
3. chamar o lifecycle guard em `phase-done`, remover o bulk-close e bloquear
   qualquer task aberta;
4. criar/entrar na plan worktree antes de qualquer write e resolver corretamente
   branches existentes.

### P1 — tornar conclusão e resume honestos

5. rerodar exit gates depois de qualquer review fix e ancorar evidence ao SHA;
6. tornar state close + completion event idempotentes/recuperáveis;
7. incluir o handoff no mesmo checkpoint de `done`;
8. tornar `materialize` uma transação com recovery marker/rollback;
9. unificar dispatch-log em NDJSON com um único writer/parser validado.

### P2 — fechar a distribuição e a cobertura

10. instalar todos os helpers lazy referenciados e testar closure do file-set;
11. resolver `implement <plan>` antes do resume gate;
12. modelar ou remover query verifier de tasks;
13. adicionar E2E real em repo consumidor temporário e fault injection nos
    pontos entre write/event/commit;
14. comparar fonte renderizada, manifest e instalação efetivamente carregada.

## Estado da auditoria

- Somente leitura durante a investigação.
- Nenhuma correção de código foi aplicada.
- Este arquivo é o artefato persistido da auditoria solicitada.
