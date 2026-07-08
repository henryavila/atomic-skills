---
schemaVersion: "0.1"
slug: project-lifecycle-order-guards
title: Guardas de ordem do lifecycle project
version: "1.0"
status: done
started: 2026-07-08T10:08:05Z
lastUpdated: 2026-07-08T13:15:00.466Z
branch: plan/project-lifecycle-order-guards
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Etapa posterior nunca avanca em silencio
    body: Um comando posterior que depende de uma pre-etapa obrigatoria deve
      bloquear ou orientar com o comando anterior correto antes de mutar estado.
  - id: P2
    title: Excecoes sao explicitas
    body: Archive de fase, split-phase, discover historico e arquivos ja arquivados
      so podem furar a regra quando o contrato declarar por que nao ha
      publicacao ou integracao pendente.
  - id: P3
    title: Guardas vivem em codigo testavel
    body: Regras de ordem devem ficar em helpers ou detectores deterministicos
      quando possivel, com mensagens acionaveis e testes que falham no pulo de
      etapa.
glossary:
  - term: etapa posterior
    definition: Comando que muda estado assumindo que uma etapa anterior ja foi cumprida.
  - term: pre-etapa obrigatoria
    definition: Passo sem o qual a transicao posterior perde evidencia, contexto ou
      garantia de integracao.
  - term: excecao interna
    definition: Transicao que reutiliza um verbo posterior sem representar conclusao
      publicavel, como archive de fase ou historico descoberto.
phases:
  - id: F0
    slug: project-lifecycle-order-guards
    title: Guardas de ordem do lifecycle project
    goal: Mapear e aplicar guardas para impedir que comandos posteriores pulem
      etapas obrigatorias anteriores.
    summary: Trava comandos posteriores quando uma etapa obrigatoria anterior foi
      pulada.
    dependsOn: []
    subPhaseCount: 1
    status: done
    businessIntent:
      value: Impede que fluxos essenciais sejam ignorados ao executar uma etapa
        posterior do lifecycle.
      workflow: Quando o operador roda um comando fora de ordem, o sistema bloqueia ou
        orienta com a etapa faltante e o comando anterior correto.
      rules: Cada transicao posterior declara suas pre-etapas obrigatorias; excecoes
        como phase archive, split-phase e discover historico sao explicitas;
        mensagens sempre indicam o proximo comando valido.
      outOfScope: Nao automatizar merge, nao remover worktree sem confirmacao e nao
        redesenhar todo o modelo de project.
      doneWhen: archive/finalize/phase-done/help/verify/depend/fork/consolidate
        impedem ou sinalizam pulos de etapa, com testes cobrindo os fluxos e
        excecoes.
    exitGate:
      summary: 4 criterios para encerrar a fase
      criteria:
        - id: G-1
          description: O mapa de ordem documenta cada comando posterior, pre-etapa
            obrigatoria, excecao permitida e comando recomendado.
          status: met
          verifier:
            kind: shell
            command: test -f docs/design/project-lifecycle-order-guards.md && grep -q
              'archive <slug>' docs/design/project-lifecycle-order-guards.md &&
              grep -q 'depend resolve --archived'
              docs/design/project-lifecycle-order-guards.md
          metAt: 2026-07-08T13:15:00.466Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-08T13:15:00.466Z
            exitCode: 0
            passed: true
            outputSummary: test -f docs/design/project-lifecycle-order-guards.md && grep -q
              'archive <slug>' docs/design/project-lifecycle-order-guards.md &&
              grep -q 'depend resolve --archived'
              docs/design/project-lifecycle-order-guards.md -> exit 0
          evidenceSummary: passed · shell exit 0 · 2026-07-08
        - id: G-2
          description: Testes cobrem pulos de etapa em archive, finalize, consolidate,
            depend, help e as excecoes legitimas.
          status: met
          verifier:
            kind: test
            runner: node --test
            pattern: tests/lifecycle-order-guard.test.js
          metAt: 2026-07-08T13:15:00.466Z
          evidence:
            verifierKind: test
            verifiedAt: 2026-07-08T13:15:00.466Z
            exitCode: 0
            testsCollected: 14
            passed: true
            outputSummary: node --test tests/lifecycle-order-guard.test.js -> tests 14, pass
              14, fail 0
          evidenceSummary: passed · 14 tests · 2026-07-08
        - id: G-3
          description: project help emite comandos predecessores invocaveis para estados
            bloqueados do lifecycle.
          status: met
          verifier:
            kind: test
            runner: node --test
            pattern: tests/help/compute-help.test.js
          metAt: 2026-07-08T13:15:00.466Z
          evidence:
            verifierKind: test
            verifiedAt: 2026-07-08T13:15:00.466Z
            exitCode: 0
            testsCollected: 30
            passed: true
            outputSummary: node --test tests/help/compute-help.test.js -> tests 30, pass 30,
              fail 0
          evidenceSummary: passed · 30 tests · 2026-07-08
        - id: G-4
          description: project verify reporta estados archived prematuros como findings
            bloqueantes de lifecycle.
          status: met
          verifier:
            kind: test
            runner: node --test
            pattern: tests/detect-orphan-worktrees.test.js
          metAt: 2026-07-08T13:15:00.466Z
          evidence:
            verifierKind: test
            verifiedAt: 2026-07-08T13:15:00.466Z
            exitCode: 0
            testsCollected: 12
            passed: true
            outputSummary: node --test tests/detect-orphan-worktrees.test.js -> tests 12,
              pass 12, fail 0
          evidenceSummary: passed · 12 tests · 2026-07-08
    reviewGate:
      status: passed
      at: 5c5167b17a2b5b012b3b50726b727a54b48fb55a
      mode: local
      reviewFile: .atomic-skills/reviews/project-lifecycle-order-guards-F0-local-review.md
      verifiedAt: 2026-07-08T13:15:00.466Z
references:
  - kind: url
    path: https://github.com/henryavila/atomic-skills/pull/29
    label: "PR #29"
planTitle: Guardas de ordem do lifecycle project
---


# Guardas de ordem do lifecycle project

## Contexto

Este plano nasceu do incidente em que `project archive` foi executado antes de
`project finalize`, encerrando o fluxo antes da PR ser criada e antes do conteudo
ser integrado. O problema geral nao e apenas preservar planos ativos: e impedir
que uma etapa posterior ignore uma etapa obrigatoria anterior sem avisar.

## Mapa inicial de riscos

- `done <task>` antes do verifier da task.
- `phase-done` antes de tasks, exit gates, review ou lessons obrigatorias.
- `switch`/proxima fase antes de `phase-done`.
- `materialize`/implementacao antes da fase estar materializada e validada.
- `finalize <slug>` antes de todas as fases estarem done ou sem slug invocavel.
- `archive <slug>` antes de `finalize <slug>`, `consolidate <slug>` ou merge/integracao.
- `archive` de fork antes do filho estar integrado e do parent poder retomar.
- `depend resolve --archived` antes da dependencia estar arquivada e integrada.
- teardown de worktree antes de archive/integracao segura.
- `verify --fix` tentando reconciliar estado sem fechar o fluxo anterior.
- `help`/`nextAction` sugerindo comandos que pulam predecessores obrigatorios.

## Excecoes conhecidas

- Archive de fase dentro de `phases/archive/` nao equivale a encerramento de
  plano publicavel.
- `split-phase` pode arquivar a fase original como movimento interno quando a
  nova estrutura preserva o caminho de execucao.
- `discover` historico pode importar estado ja arquivado sem exigir finalize.
- Planos sem branch/worktree propria podem nao exigir PR, mas ainda precisam de
  criterio explicito de integracao ou consolidacao.

## Decisoes

- A primeira tarefa produz o mapa formal de transicoes antes de qualquer guarda
  comportamental.
- A implementacao deve preferir helper puro para as regras de ordem, consumido
  pelos assets mutaveis e pelos backstops de verify/help.
