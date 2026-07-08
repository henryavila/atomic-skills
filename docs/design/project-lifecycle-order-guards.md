# Guardas de ordem do lifecycle project

## Objetivo

Este mapa define quais transicoes do `atomic-skills:project` nao podem avancar
quando uma etapa anterior obrigatoria foi pulada. Ele e o contrato da T-001:
formaliza a ordem, as excecoes legitimas e a mensagem que o operador deve ver
antes de qualquer implementacao de guarda.

O incidente motivador foi `archive` executado antes de `finalize`: o plano foi
marcado como encerrado antes de existir PR publicada e antes de haver prova de
merge/integracao. A regra geral e mais ampla: um comando posterior nunca deve
mutar estado quando a pre-etapa que da evidencia, contexto ou integracao ainda
nao aconteceu.

## Espinha canonica

Fluxo feliz para um plano com branch propria:

```text
materialize <phase>
  -> implement / done <task-id>
  -> phase-done
  -> finalize <slug>        # uma worktree pronta -> uma PR
     ou consolidate         # >=2 worktrees prontas -> uma PR integrada
  -> merge da PR no provedor Git
  -> archive <slug>         # flip logico pos-integracao
  -> teardown da worktree   # oferta opcional, fail-closed
```

Dependencias entre planos ficam fora da linhagem historica:

```text
depend add <dependent> <prerequisite>
  -> terminar/integrar/arquivar <prerequisite>
  -> depend resolve <dependent> <prerequisite> --archived
  -> switch <dependent>
```

`spawnedFrom` e `phases[].spawnedPlans` explicam origem. So
`dependsOnPlans[]` bloqueia execucao.

## Regras globais

1. **Bloquear antes de escrever.** O guarda roda antes de status, arquivos,
   archive moves, PR records ou sidecars serem alterados.
2. **Mensagem sempre invocavel.** Toda resposta bloqueada aponta para um comando
   concreto: `phase-done`, `finalize <slug>`, `archive <slug>`,
   `depend resolve --archived`, `switch <slug>` ou `reconcile`.
3. **Excecao precisa ter nome.** Archive interno de fase, `split-phase` e
   `discover` historico so passam por casos explicitos.
4. **Verify/help nao consertam fluxo.** Eles reportam e orientam; fechamento,
   publicacao e archive continuam nos comandos donos.

## Mapa de transicoes obrigatorias

| Comando posterior | Pre-etapa obrigatoria | Bloqueia quando | Excecao legitima | Comando recomendado |
|---|---|---|---|---|
| `done <task-id>` | Verifier da task passou, ou ack manual quando nao ha verifier deterministico. | Task tem `verifier` shell/test/query falhando, sem runner real, sem evidencia `passed:true`, ou teste coletou zero casos. | Task sem verifier usa ack manual do fluxo `done`; `reconcile` pode chamar o mesmo fechamento apos sinal de drift. | Rodar/corrigir o verifier, depois `done <task-id>`. |
| `reconcile` fechando task/criterion | Detector encontrou sinal e o fechamento foi autorizado por verifier ou ack humano. | Candidato tem verifier e ele nao passou; snapshot de escrita ficou stale; candidato mudou desde a deteccao. | Candidato sem verifier pode usar `Mark done` manual; `Still open` so atualiza `lastUpdated`. | Corrigir o verifier ou escolher `Still open`; depois rerodar `reconcile`. |
| `phase-done` | Todas as tasks da fase estao `done`; exit gates verificados; review gate registrado; lessons destiladas/explicitamente zeradas. | Existem tasks `pending`, `active` ou `blocked`; algum exit gate segue `pending`; review/lessons obrigatorios nao foram tratados. | Nenhuma para fase de plano materializada. Gates podem ser `deferred`, mas nunca `done`. | Fechar tasks com `done <task-id>` ou `reconcile`; desbloquear com `unblock <task-id>`; depois `phase-done`. |
| `switch <plan>` | Plano alvo esta `active`/`paused` e nao esta bloqueado por `dependsOnPlans[]`. | `blockedByPlans[target]` nao vazio; prerequisito esta `active`, `paused`, `pending` ou `archived` sem release resolvido. | `switch` pode materializar internamente a fase descriptor-only do alvo depois de aceitar o plano. | `switch <prerequisite>`; terminar o prerequisito; se ele ja foi arquivado e integrado, `depend resolve --archived`. |
| `switch <phase-or-initiative>` | A troca nao deixa duas iniciativas ativas e, se a fase e descriptor-only, materializacao passa pelo gate de `materialize`. | A fase alvo depende de fase nao done; ha fase ativa alheia que nao foi demovida; a iniciativa existente nao esta `active`/`paused`. | `switch` pode chamar `materialize <phase>` como transicao interna para descriptor-only. | `phase-done` na fase atual, ou `materialize <phase>` pelo fluxo interno de switch. |
| `materialize <phase>` | A fase e `currentPhase` ou foi selecionada por transicao interna; dependsOn da fase esta done; businessIntent e lessons gate resolvidos. | Fase nao e atual/selecionada; depende de fase nao done; ja existe initiative file; sidecar ausente/malformado; businessIntent incompleto. | Chamadas internas por `phase-done`, `switch` e `phase-reopen` podem selecionar a fase alvo. | `switch <plan-or-phase>`, `phase-done`, ou reparar sidecar/businessIntent e rerodar `materialize <phase>`. |
| `phase-reopen` | Fase alvo existe como descriptor, live initiative ou archived initiative. | Alvo nao resolve; tentativa implicita de reabrir varias fases; estado nao identifica qual fase reverter. | Descriptor-only pode ser materializada em vez de restaurada; archived initiative pode voltar ao caminho live. | `phase-reopen <phase-id>` com id/slug resolvido. |
| `finalize <slug>` | Target explicito e terminal: plano `done`/`archived`, ou `active` com todas as fases `done`; tree limpo; base de integracao resolvida. | Slug ausente; target nao encontrado; target nao terminal; `branch != focus` sem confirmacao; dirty tree; base remota ausente; `gh`/`origin` indisponivel. | Plano `archived` pode ser publicado como recuperacao quando houve archive prematuro e a branch ainda existe. | Se ha fase aberta: `phase-done`; se target ambiguo: `finalize <slug>` com slug correto/confirmacao; se dirty: commit/stash. |
| `consolidate` | Ha >=2 planos terminais e integraveis em worktrees vivas, no mesmo fluxo de integracao. | Menos de 2 candidatos prontos; algum candidato nao terminal; merge-train bloqueou por conflito/eject; gate deterministico falhou. | Com <2 worktrees, o comando e no-op e roteia para finalize. | Para um plano: `finalize <slug>`; para candidato nao terminal: fechar com `phase-done`; para conflito: resolver e retomar `consolidate --resume`. |
| `archive <slug>` de plano | Plano ja foi publicado e integrado: PR registrada por `finalize <slug>` ou PR de `consolidate`, merge confirmado no provedor/integracao, e branch chegou ao baseRef. | Plano tem branch publicavel sem PR; PR existe mas nao esta MERGED; baseRef indeterminado; `prIdentity` ausente; branch tem residue alem do head mergeado. | Plano sem branch/worktree propria pode arquivar se houver criterio explicito de integracao local; importacao historica via `discover` e caso separado. | `finalize <slug>`; merge da PR; depois `archive <slug>`. Se archive ja foi feito cedo, usar `verify` para achar `archived-never-pr`/`archived-pr-open-unmerged` e recuperar a publicacao. |
| `archive <slug>` de initiative standalone | Tasks fechadas; exit gates resolvidos no proprio archive; nao ha parent plan esperando `phase-done`. | Existem gates pendentes sem verifier/ack/defer; tasks abertas; target e na verdade fase de plano ainda ativa. | Standalone nao tem `phase-done`; o archive e o unico ponto de resolver seus gates. | `done <task-id>` ou `reconcile`; resolver/defer gates; depois `archive <slug>`. |
| Archive interno de fase | A fase ja passou por `phase-done`; plano pai foi atualizado; mover initiative para `phases/archive/` e efeito interno. | Fase ainda esta `active`/`pending` e nao houve `phase-done`; tentativa de tratar como archive publicavel de plano. | Permitido dentro de `phase-done` ou propagacao de archive de plano ja integrado. | `phase-done` antes do move de fase. |
| `archive <child-plan>` de fork | Filho integrado e parent retomavel; `fork-resume` escreve/agenda a retomada antes do archive do filho. | Filho nao integrado; parent canonical nao resolve; CAS/writeback falha; operador recusa/no-TTY; `pendingWriteback` persiste. | Nenhuma queda silenciosa: `pendingWriteback` deixa o filho aberto ate recuperacao. | `finalize <child>` e merge; depois `archive <child>`. Se houver marker, recuperar `pendingWriteback` antes de arquivar. |
| `depend resolve <dependent> <prerequisite> --archived` | Prerequisite esta `archived` **e** a branch chegou a integracao obrigatoria. | Edge nao existe; prerequisito nao esta `archived`; prerequisito esta `archived-never-pr` ou `archived-pr-open-unmerged`; release ja nao casa com a dependencia. | Planos sem branch propria exigem justificativa explicita de integracao local antes do resolve. | `finalize <prerequisite>`, merge, `archive <prerequisite>`, depois `depend resolve --archived`. |
| Teardown de worktree | Archive logico ja ocorreu e `isTeardownSafe` prova MERGED/base/head ou ancestry. | `indeterminate-base`, `pr-identity-missing`, `gh-unauthenticated`, `not-merged`, `base-ref-mismatch`, `head-ref-missing`, `residue-beyond-head`. | `outcome: nothing-to-remove` quando nao ha branch/worktree. | Manter worktree; corrigir publicacao/merge; rerodar `archive <slug>` para nova oferta. |
| `verify --fix` | Finding e normalizacao segura de schema, sem fechar fluxo lifecycle. | Reparos necessarios sao migracao, fechamento de task/gate, scope, orphan, archive prematuro ou teardown. | So normalizacoes deterministicas: gate status synonym, `references[]` backfill, arrays obrigatorios ausentes. | `migrate <slug>`, `reconcile`, `phase-done`, `finalize <slug>`, `archive <slug>` conforme finding. |
| `help` / `nextAction` / `guide` | Leitura do estado real e do `nextAction` persistido; bloqueios tem precedencia sobre fluxo feliz. | Sugere `archive`, teardown ou dependent desbloqueado quando falta `finalize`, merge, `depend resolve --archived` ou `switch <prereq>`. | Read-only/fail-open: se detector falha, nao muta e mostra o que sabe. | Emitir o predecessor invocavel: `finalize <slug>`, `phase-done`, `reconcile`, `switch <prereq>`, `depend resolve --archived`. |

## Excecoes nomeadas

### Archive de fase

Archive de fase dentro de `projects/<id>/<plan>/phases/archive/` nao e
publicacao de plano. Ele e permitido quando produzido por `phase-done` ou por
propagacao de um `archive <slug>` de plano que ja passou pelo guarda de
integracao. Fora desses callers, fase ativa deve ser fechada com `phase-done`.

### `split-phase`

`split-phase` pode arquivar a fase original como movimento interno somente se a
nova estrutura preserva o caminho de execucao: as novas fases ficam no plano, o
anchor antigo continua rastreavel, e nenhuma publicacao/merge e declarada
concluida. Se o split gerar um plano filho, passa a valer a regra de fork:
filho publica/integra antes de `archive <child-plan>`, e parent resume antes do
archive finalizar.

### `discover` historico

`discover` pode importar planos ou initiatives ja arquivados quando esta
registrando historia preexistente. Isso nao autoriza um plano ativo com branch
publicavel a pular `finalize <slug>`/merge. O arquivo descoberto deve carregar
evidencia/justificativa historica suficiente para nao parecer
`archived-never-pr`.

### Plano sem branch propria

Um plano sem branch/worktree propria nao necessariamente cria PR dedicada. Mesmo
assim, o archive precisa de criterio explicito de integracao: por exemplo,
trabalho ja integrado no branch compartilhado ou incorporado por outro plano. Na
duvida, `archive <slug>` bloqueia e `verify` reporta a falta.

## Mensagens recomendadas

As mensagens devem ser curtas, com causa e comando anterior:

```text
Blocked: plan <slug> is not ready to archive; no merged PR/integration proof was found.
Run `finalize <slug>`, merge the PR, then rerun `archive <slug>`.
```

```text
Blocked: dependency <prerequisite> is archived but not proven integrated.
Run `project verify` to inspect the lifecycle finding, then publish/merge before
`depend resolve <dependent> <prerequisite> --archived`.
```

```text
Blocked: target plan <slug> still has open phase(s): <ids>.
Run `phase-done` for the current phase before `finalize <slug>`.
```

```text
Blocked: plan <dependent> is waiting on prerequisite <prerequisite>.
Run `switch <prerequisite>` and finish it, then `depend resolve --archived` if
the prerequisite was archived after integration.
```

```text
Blocked: worktree teardown is not proven safe (<reason>).
Keep the worktree; merge or repair the PR identity, then rerun `archive <slug>`.
```

## Backstop findings

`project verify` deve tratar estes estados como findings de lifecycle, nao como
detalhes cosmeticos:

| Finding | Significado | Recuperacao |
|---|---|---|
| `archived-never-pr` | Plano arquivado sem PR registrada/merge/ancestry. | Recuperar com `finalize <slug>` se a branch existe; merge; depois confirmar `archive <slug>`. |
| `archived-pr-open-unmerged` | Plano arquivado com PR aberta ou nao mergeada. | Merge/corrigir PR; rerodar `verify`; so entao considerar archive saudavel. |
| `merged-feature-worktree` | Branch ja integrada, mas worktree ainda viva. | Rerodar `archive <slug>` para oferta de teardown ou remover manualmente com guarda nativa. |
| `blockedByPlans[]` nao vazio | Plano depende de prerequisito operacional. | `switch <prerequisite>`; depois `depend resolve --archived` quando aplicavel. |
| `pendingWriteback` | Fork child ainda nao convergiu retomada do parent. | Recuperar a writeback; nao arquivar o child ate limpar o marker. |

## Ordem para implementacao dos guardas

1. Criar helper puro que recebe comando, alvo e slices de estado e retorna
   `allowed | blocked`, `reason`, `exception`, `recommendedCommand`.
2. Cobrir primeiro os pulos que perdem integracao: `archive <slug>` antes de
   `finalize <slug>`/merge, `depend resolve --archived` antes da integracao, e
   teardown sem prova MERGED.
3. Conectar nos comandos mutaveis antes da primeira escrita.
4. Fazer `help`/`nextAction` consumir o mesmo resultado para apontar o
   predecessor correto.
5. Fazer `verify` reportar archive prematuro como finding bloqueante/acao
   corretiva, sem aplicar a transicao por conta propria.
