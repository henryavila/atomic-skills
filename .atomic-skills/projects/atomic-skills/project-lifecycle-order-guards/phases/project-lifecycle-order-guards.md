---
schemaVersion: "0.1"
slug: project-lifecycle-order-guards
title: Guardas de ordem do lifecycle project
goal: Mapear e aplicar guardas para impedir que comandos posteriores pulem
  etapas obrigatorias anteriores.
summary: Trava comandos posteriores quando uma etapa obrigatoria anterior foi pulada.
status: active
branch: plan/project-lifecycle-order-guards
started: 2026-07-08T10:08:05Z
startedCommit: 2f9c8bdee197f4204637301b0a83226760046535
lastUpdated: 2026-07-08T10:08:05Z
nextAction: Crie `docs/design/project-lifecycle-order-guards.md` com o mapa de
  transicoes obrigatorias.
parentPlan: project-lifecycle-order-guards
phaseId: F0
businessIntent:
  value: Impede que fluxos essenciais sejam ignorados ao executar uma etapa
    posterior do lifecycle.
  workflow: Quando o operador roda um comando fora de ordem, o sistema bloqueia
    ou orienta com a etapa faltante e o comando anterior correto.
  rules: Cada transicao posterior declara suas pre-etapas obrigatorias; excecoes
    como phase archive, split-phase e discover historico sao explicitas;
    mensagens sempre indicam o proximo comando valido.
  outOfScope: Nao automatizar merge, nao remover worktree sem confirmacao e nao
    redesenhar todo o modelo de project.
  doneWhen: archive/finalize/phase-done/help/verify/depend/fork/consolidate
    impedem ou sinalizam pulos de etapa, com testes cobrindo os fluxos e excecoes.
tasksDone: 0
tasksTotal: 5
gatesMet: 0
gatesTotal: 4
weightDone: 0
weightTotal: 14
exitGates:
  - id: G-1
    description: O mapa de ordem documenta cada comando posterior, pre-etapa
      obrigatoria, excecao permitida e comando recomendado.
    status: pending
    verifier:
      kind: shell
      command: test -f docs/design/project-lifecycle-order-guards.md &&
        grep -q 'archive <slug>' docs/design/project-lifecycle-order-guards.md &&
        grep -q 'depend resolve --archived' docs/design/project-lifecycle-order-guards.md
  - id: G-2
    description: Testes cobrem pulos de etapa em archive, finalize, consolidate,
      depend, help e as excecoes legitimas.
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: tests/lifecycle-order-guard.test.js
  - id: G-3
    description: project help emite comandos predecessores invocaveis para
      estados bloqueados do lifecycle.
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: tests/help/compute-help.test.js
  - id: G-4
    description: project verify reporta estados archived prematuros como findings
      bloqueantes de lifecycle.
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: tests/detect-orphan-worktrees.test.js
scope:
  paths:
    - skills/shared/project-assets/project-transitions.md
    - skills/shared/project-assets/project-finalize.md
    - skills/shared/project-assets/project-consolidate.md
    - skills/shared/project-assets/project-dependencies.md
    - skills/shared/project-assets/project-verify.md
    - scripts/compute-help.js
    - scripts/detect-orphan-worktrees.js
    - scripts/worktree-teardown.js
    - tests
stack:
  - id: 1
    title: Mapear transicoes obrigatorias e excecoes
    type: task
    openedAt: 2026-07-08T10:08:05Z
tasks:
  - id: T-001
    title: Mapear transicoes obrigatorias e excecoes
    summary: Define o contrato de predecessor obrigatorio para cada comando posterior.
    description: Criar `docs/design/project-lifecycle-order-guards.md` com uma
      tabela de comando posterior, pre-etapa obrigatoria, condicao de bloqueio,
      excecao legitima e comando recomendado.
    status: pending
    lastUpdated: 2026-07-08T10:08:05Z
    scopeBoundary:
      - Nao alterar comportamento ainda; esta tarefa so formaliza o mapa de ordem.
      - Nao tratar `archive` como caso unico; mapear tambem finalize,
        consolidate, depend, fork, help, verify, materialize e phase-done.
    acceptance:
      - O documento lista cada comando posterior relevante e seu predecessor obrigatorio.
      - O documento distingue archive de plano, archive de fase, split-phase e discover historico.
      - Cada bloqueio tem uma mensagem recomendada com comando invocavel.
      - O caso `archive <slug>` antes de `finalize <slug>`/merge esta documentado.
      - O caso `depend resolve --archived` antes de integracao esta documentado.
    verifier:
      kind: shell
      command: test -f docs/design/project-lifecycle-order-guards.md &&
        grep -q 'archive <slug>' docs/design/project-lifecycle-order-guards.md &&
        grep -q 'split-phase' docs/design/project-lifecycle-order-guards.md &&
        grep -q 'depend resolve --archived' docs/design/project-lifecycle-order-guards.md
    outputs:
      - kind: file
        path: docs/design/project-lifecycle-order-guards.md
    weight: 3
  - id: T-002
    title: Implementar classificador puro de ordem
    summary: Centraliza as regras de predecessor em helper testavel.
    description: Criar um helper deterministico para classificar transicoes fora
      de ordem e retornar allowed/blocked, motivo, excecao aplicada e comando
      recomendado.
    status: pending
    lastUpdated: 2026-07-08T10:08:05Z
    scopeBoundary:
      - Nao conectar ainda nos assets mutaveis; manter API pura e coberta por testes.
      - Nao inferir excecoes por prosa solta; cada excecao precisa de caso nomeado.
    acceptance:
      - Bloqueia `archive <slug>` quando falta finalize/consolidate ou merge exigido.
      - Bloqueia `depend resolve --archived` quando o prerequisito nao esta integrado.
      - Bloqueia phase-done quando tarefas/gates/review obrigatorios estao abertos.
      - Permite archive de fase, split-phase e discover historico quando a condicao explicita casa.
      - Retorna comando recomendado em todos os casos bloqueados.
    verifier:
      kind: test
      runner: node --test
      pattern: tests/lifecycle-order-guard.test.js
    outputs:
      - kind: file
        path: scripts/lifecycle-order-guard.js
      - kind: test
        path: tests/lifecycle-order-guard.test.js
    weight: 3
  - id: T-003
    title: Conectar guardas aos comandos mutaveis
    summary: Aplica o classificador antes de mutacoes posteriores do lifecycle.
    description: Conectar o helper nos assets de transicao para impedir que uma
      etapa posterior mude estado antes da pre-etapa obrigatoria.
    status: pending
    lastUpdated: 2026-07-08T10:08:05Z
    scopeBoundary:
      - Nao automatizar merge nem criar PR automaticamente.
      - Nao remover worktrees; apenas bloquear ou orientar quando a ordem estiver errada.
      - Nao quebrar archive interno de fase, split-phase ou discover historico.
    acceptance:
      - "`archive <slug>` roda o guarda antes de marcar plano/fork como archived."
      - "`finalize <slug>` e `consolidate <slug>` orientam a etapa anterior quando o plano nao esta terminal."
      - "`depend resolve --archived` exige dependencia arquivada e integrada ou explica o comando anterior."
      - Retomada de fork nao ocorre quando o filho ainda nao cumpriu integracao obrigatoria.
      - Mensagens de bloqueio incluem o comando anterior recomendado.
    verifier:
      kind: test
      runner: node --test
      pattern: tests/project.test.js tests/worktree-teardown.test.js tests/finalize-plan-scope.test.js
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/project-assets/project-dependencies.md
      - kind: file
        path: skills/shared/project-assets/project-finalize.md
      - kind: file
        path: skills/shared/project-assets/project-consolidate.md
    weight: 4
  - id: T-004
    title: Corrigir help e orientacao de proximo passo
    summary: Garante que help e nextAction recomendem predecessores invocaveis.
    description: Atualizar `compute-help` e artefatos de orientacao para que
      estados bloqueados apontem para a etapa anterior correta, incluindo
      `finalize <slug>` com slug explicito.
    status: pending
    lastUpdated: 2026-07-08T10:08:05Z
    scopeBoundary:
      - Nao redesenhar o render do help.
      - Nao mudar o conceito de read-only/zero-mutacao do help.
    acceptance:
      - Help nao emite `finalize` sem slug quando o catalogo exige slug.
      - Help prioriza predecessor faltante antes de sugerir archive ou teardown.
      - Docs/catalogo citam as guardas de ordem onde o operador aprende o fluxo.
      - Fixtures cobrem estados bloqueados por ordem de lifecycle.
    verifier:
      kind: test
      runner: node --test
      pattern: tests/help/compute-help.test.js tests/help/help-vocab.test.js
    outputs:
      - kind: file
        path: scripts/compute-help.js
      - kind: test
        path: tests/help/compute-help.test.js
      - kind: file
        path: meta/catalog.yaml
    weight: 2
  - id: T-005
    title: Fortalecer verify e recuperacao
    summary: Transforma archived prematuro em finding bloqueante e sugere reparo.
    description: Atualizar os backstops de verify/orphan-worktrees para detectar
      planos arquivados sem PR, com PR aberta nao mergeada ou sem integracao
      declarada, e orientar o caminho de recuperacao.
    status: pending
    lastUpdated: 2026-07-08T10:08:05Z
    scopeBoundary:
      - Nao tornar warn generico em erro sem diferenciar caso recuperavel.
      - Nao bloquear worktree merged/limpa que ja cumpriu integracao.
    acceptance:
      - "`archived-never-pr` vira finding bloqueante de lifecycle quando deveria ter publicacao."
      - "`archived-pr-open-unmerged` vira finding bloqueante com recuperacao sugerida."
      - Casos merged/sem branch propria continuam permitidos ou warning justificado.
      - "`project verify` aponta para finalize/merge/archive na ordem correta."
    verifier:
      kind: test
      runner: node --test
      pattern: tests/detect-orphan-worktrees.test.js tests/validate-state.test.js
    outputs:
      - kind: file
        path: scripts/detect-orphan-worktrees.js
      - kind: file
        path: skills/shared/project-assets/project-verify.md
      - kind: test
        path: tests/detect-orphan-worktrees.test.js
    weight: 2
parked: []
emerged: []
planActive: true
current: true
planTitle: Guardas de ordem do lifecycle project
---

# Narrative / notes

Standalone initiative for lifecycle order guards in the `project` skill.

## Decisions

- The work is broader than the `archive` incident: every posterior lifecycle
  command must declare the predecessor it cannot skip.
- The first task must produce a transition-order map before implementation, so
  later tasks do not hard-code a one-case patch.
- Exemptions are allowed only when named and tested, not by silent fallthrough.

## Links

- Trigger incident: `project archive` ran before `project finalize`, before PR
  creation and before merge/integration.

## Session handoff

- **Narrative:** Plano `project-lifecycle-order-guards` esta ativo na fase F0
  em `plan/project-lifecycle-order-guards`. A T-001 ainda esta aberta no estado
  do projeto e o artefato `docs/design/project-lifecycle-order-guards.md` ja
  existe na arvore para validacao pelo verifier da propria task.
- **Decision log:** O branch atual foi confirmado por `rtk git symbolic-ref
  --short HEAD` como `plan/project-lifecycle-order-guards`, igual ao campo
  `branch:` do plano. O usuario autorizou "faca commit e siga o fluxo do
  projeto"; por isso o bootstrap de estado sera checkpointado antes do
  fechamento verificado da T-001.
- **Single nextAction:** Rode o verifier da T-001 e commite
  `docs/design/project-lifecycle-order-guards.md`.
- **Verbatim state:** `rtk git symbolic-ref --short HEAD` -> `plan/project-lifecycle-order-guards`;
  `rtk git status --porcelain=v1 -uall` -> ` M .atomic-skills/projects/atomic-skills/PROJECT-STATUS.md`
  / `?? .atomic-skills/projects/atomic-skills/project-lifecycle-order-guards/phases/project-lifecycle-order-guards.md`
  / `?? .atomic-skills/projects/atomic-skills/project-lifecycle-order-guards/plan.md`
  / `?? docs/design/project-lifecycle-order-guards.md`; `rtk git log --oneline -3`
  -> `2f9c8bd chore(project): checkpoint help-command F3 T-002` /
  `8911014 docs(T-002): cross-link project help` /
  `3041a37 chore(project): checkpoint help-command F3 T-001`.
- **Uncommitted changes:** ` M .atomic-skills/projects/atomic-skills/PROJECT-STATUS.md`;
  `?? .atomic-skills/projects/atomic-skills/project-lifecycle-order-guards/phases/project-lifecycle-order-guards.md`;
  `?? .atomic-skills/projects/atomic-skills/project-lifecycle-order-guards/plan.md`;
  `?? docs/design/project-lifecycle-order-guards.md`.
