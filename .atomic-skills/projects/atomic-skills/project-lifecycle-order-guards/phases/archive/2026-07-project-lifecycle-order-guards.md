---
schemaVersion: "0.1"
slug: project-lifecycle-order-guards
title: Guardas de ordem do lifecycle project
goal: Mapear e aplicar guardas para impedir que comandos posteriores pulem
  etapas obrigatorias anteriores.
summary: Trava comandos posteriores quando uma etapa obrigatoria anterior foi pulada.
status: done
branch: plan/project-lifecycle-order-guards
started: 2026-07-08T10:08:05Z
startedCommit: 2f9c8bdee197f4204637301b0a83226760046535
lastUpdated: 2026-07-08T13:15:00.466Z
nextAction: null
parentPlan: project-lifecycle-order-guards
phaseId: F0
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
tasksDone: 5
tasksTotal: 5
gatesMet: 4
gatesTotal: 4
weightDone: 14
weightTotal: 14
exitGates:
  - id: G-1
    description: O mapa de ordem documenta cada comando posterior, pre-etapa
      obrigatoria, excecao permitida e comando recomendado.
    status: met
    verifier:
      kind: shell
      command: test -f docs/design/project-lifecycle-order-guards.md && grep -q
        'archive <slug>' docs/design/project-lifecycle-order-guards.md && grep
        -q 'depend resolve --archived'
        docs/design/project-lifecycle-order-guards.md
    metAt: 2026-07-08T13:15:00.466Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-08T13:15:00.466Z
      exitCode: 0
      passed: true
      outputSummary: test -f docs/design/project-lifecycle-order-guards.md && grep -q
        'archive <slug>' docs/design/project-lifecycle-order-guards.md && grep
        -q 'depend resolve --archived'
        docs/design/project-lifecycle-order-guards.md -> exit 0
    verifierLabel: "shell: test -f docs/design/project-lifecycle-order-guards.md && gr…"
    evidenceSummary: passed · 2026-07-08
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
    verifierLabel: "test: node --test tests/lifecycle-order-guard.test.js"
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
      outputSummary: node --test tests/help/compute-help.test.js -> tests 30, pass 30, fail 0
    verifierLabel: "test: node --test tests/help/compute-help.test.js"
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
    verifierLabel: "test: node --test tests/detect-orphan-worktrees.test.js"
    evidenceSummary: passed · 12 tests · 2026-07-08
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
    status: done
    lastUpdated: 2026-07-08T12:47:26.521Z
    scopeBoundary:
      - Nao alterar comportamento ainda; esta tarefa so formaliza o mapa de
        ordem.
      - Nao tratar `archive` como caso unico; mapear tambem finalize,
        consolidate, depend, fork, help, verify, materialize e phase-done.
    acceptance:
      - O documento lista cada comando posterior relevante e seu predecessor
        obrigatorio.
      - O documento distingue archive de plano, archive de fase, split-phase e
        discover historico.
      - Cada bloqueio tem uma mensagem recomendada com comando invocavel.
      - O caso `archive <slug>` antes de `finalize <slug>`/merge esta
        documentado.
      - O caso `depend resolve --archived` antes de integracao esta documentado.
    verifier:
      kind: shell
      command: test -f docs/design/project-lifecycle-order-guards.md && grep -q
        'archive <slug>' docs/design/project-lifecycle-order-guards.md && grep
        -q 'split-phase' docs/design/project-lifecycle-order-guards.md && grep
        -q 'depend resolve --archived'
        docs/design/project-lifecycle-order-guards.md
    outputs:
      - kind: file
        path: docs/design/project-lifecycle-order-guards.md
    weight: 3
    closedAt: 2026-07-08T12:47:26.521Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-08T12:47:26.521Z
      exitCode: 0
      passed: true
      outputSummary: test -f docs/design/project-lifecycle-order-guards.md && grep -q
        'archive <slug>' docs/design/project-lifecycle-order-guards.md && grep
        -q 'split-phase' docs/design/project-lifecycle-order-guards.md && grep
        -q 'depend resolve --archived'
        docs/design/project-lifecycle-order-guards.md -> exit 0
  - id: T-002
    title: Implementar classificador puro de ordem
    summary: Centraliza as regras de predecessor em helper testavel.
    description: Criar um helper deterministico para classificar transicoes fora de
      ordem e retornar allowed/blocked, motivo, excecao aplicada e comando
      recomendado.
    status: done
    lastUpdated: 2026-07-08T12:52:12.741Z
    scopeBoundary:
      - Nao conectar ainda nos assets mutaveis; manter API pura e coberta por
        testes.
      - Nao inferir excecoes por prosa solta; cada excecao precisa de caso
        nomeado.
    acceptance:
      - Bloqueia `archive <slug>` quando falta finalize/consolidate ou merge
        exigido.
      - Bloqueia `depend resolve --archived` quando o prerequisito nao esta
        integrado.
      - Bloqueia phase-done quando tarefas/gates/review obrigatorios estao
        abertos.
      - Permite archive de fase, split-phase e discover historico quando a
        condicao explicita casa.
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
    closedAt: 2026-07-08T12:52:12.741Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-08T12:52:12.741Z
      exitCode: 0
      testsCollected: 13
      passed: true
      outputSummary: node --test tests/lifecycle-order-guard.test.js -> tests 13, pass
        13, fail 0
  - id: T-003
    title: Conectar guardas aos comandos mutaveis
    summary: Aplica o classificador antes de mutacoes posteriores do lifecycle.
    description: Conectar o helper nos assets de transicao para impedir que uma
      etapa posterior mude estado antes da pre-etapa obrigatoria.
    status: done
    lastUpdated: 2026-07-08T12:56:11.800Z
    scopeBoundary:
      - Nao automatizar merge nem criar PR automaticamente.
      - Nao remover worktrees; apenas bloquear ou orientar quando a ordem
        estiver errada.
      - Nao quebrar archive interno de fase, split-phase ou discover historico.
    acceptance:
      - "`archive <slug>` roda o guarda antes de marcar plano/fork como
        archived."
      - "`finalize <slug>` e `consolidate <slug>` orientam a etapa anterior
        quando o plano nao esta terminal."
      - "`depend resolve --archived` exige dependencia arquivada e integrada ou
        explica o comando anterior."
      - Retomada de fork nao ocorre quando o filho ainda nao cumpriu integracao
        obrigatoria.
      - Mensagens de bloqueio incluem o comando anterior recomendado.
    verifier:
      kind: test
      runner: node --test
      pattern: tests/project.test.js tests/worktree-teardown.test.js
        tests/finalize-plan-scope.test.js
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/project-assets/project-dependencies.md
      - kind: file
        path: skills/shared/project-assets/project-finalize.md
      - kind: file
        path: skills/shared/project-assets/project-consolidate.md
      - kind: test
        path: tests/project.test.js
    weight: 4
    closedAt: 2026-07-08T12:56:11.800Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-08T12:56:11.800Z
      exitCode: 0
      testsCollected: 97
      passed: true
      outputSummary: node --test tests/project.test.js tests/worktree-teardown.test.js
        tests/finalize-plan-scope.test.js -> tests 97, pass 97, fail 0
  - id: T-004
    title: Corrigir help e orientacao de proximo passo
    summary: Garante que help e nextAction recomendem predecessores invocaveis.
    description: Atualizar `compute-help` e artefatos de orientacao para que estados
      bloqueados apontem para a etapa anterior correta, incluindo `finalize
      <slug>` com slug explicito.
    status: done
    lastUpdated: 2026-07-08T13:02:07.597Z
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
      - kind: test
        path: tests/help/fixtures/states.js
      - kind: test
        path: tests/help/help-vocab.test.js
      - kind: file
        path: meta/catalog.yaml
      - kind: file
        path: docs/skills/project.md
    weight: 2
    closedAt: 2026-07-08T13:02:07.597Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-08T13:02:07.597Z
      exitCode: 0
      testsCollected: 34
      passed: true
      outputSummary: node --test tests/help/compute-help.test.js
        tests/help/help-vocab.test.js -> tests 34, pass 34, fail 0
  - id: T-005
    title: Fortalecer verify e recuperacao
    summary: Transforma archived prematuro em finding bloqueante e sugere reparo.
    description: Atualizar os backstops de verify/orphan-worktrees para detectar
      planos arquivados sem PR, com PR aberta nao mergeada ou sem integracao
      declarada, e orientar o caminho de recuperacao.
    status: done
    lastUpdated: 2026-07-08T13:07:02.743Z
    scopeBoundary:
      - Nao tornar warn generico em erro sem diferenciar caso recuperavel.
      - Nao bloquear worktree merged/limpa que ja cumpriu integracao.
    acceptance:
      - "`archived-never-pr` vira finding bloqueante de lifecycle quando deveria
        ter publicacao."
      - "`archived-pr-open-unmerged` vira finding bloqueante com recuperacao
        sugerida."
      - Casos merged/sem branch propria continuam permitidos ou warning
        justificado.
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
    closedAt: 2026-07-08T13:07:02.743Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-08T13:07:02.743Z
      exitCode: 0
      testsCollected: 99
      passed: true
      outputSummary: node --test tests/detect-orphan-worktrees.test.js
        tests/validate-state.test.js -> tests 99, pass 99, fail 0
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

## Auto-revisao contra gates de qualidade

- G1 read-before-claim: aplicado - cada task fechada registra o verifier que a
  fechou em `tasks[].evidence`.
- G2 soft-language: aplicado - claims de fechamento usam `passed: true` e o
  handoff foi revisado contra linguagem incerta.
- G6 reference-or-strike: aplicado - o handoff carrega paths, comandos e saidas
  verbatim.

## Session handoff

- **Narrative:** F0 esta `done` e arquivada em
  `.atomic-skills/projects/atomic-skills/project-lifecycle-order-guards/phases/archive/2026-07-project-lifecycle-order-guards.md`.
  T-001, T-002, T-003, T-004 e T-005 estao fechadas com
  `evidence.passed: true`, e os quatro exit gates estao `met` com evidencia
  deterministica. O plano
  `.atomic-skills/projects/atomic-skills/project-lifecycle-order-guards/plan.md`
  esta `status: done`; o proximo predecessor obrigatorio do lifecycle e
  `finalize project-lifecycle-order-guards`.
- **Decision log:** O bootstrap do plano foi checkpointado separadamente no
  commit `cf4777e` para limpar a retomada antes do fechamento da task. O
  classificador da T-002 ficou puro e sem conexao aos assets mutaveis; a
  T-003 conectou esse contrato nos assets e adicionou `tests/project.test.js`
  para impedir remocao silenciosa das instrucoes de guarda. A T-004 mudou o
  catalogo para `finalize <slug>` e fez `compute-help` substituir
  `archive`/teardown stale pelo predecessor indicado pelo guarda. A T-005
  manteve `merged-feature-worktree` como `warn`, elevou archives prematuros a
  `fail`, e preservou planos arquivados sem branch propria como ausencia de
  finding nesse detector. O review local encontrou `pr.state: NONE` sendo
  tratado como tentativa de publicacao; o fix `5c5167b` trata `NONE` como
  publicacao ausente e adiciona o teste de regressao.
- **Single nextAction:** Execute `finalize project-lifecycle-order-guards`.
- **Verbatim state:** `rtk node scripts/validate-state.js .atomic-skills/projects/atomic-skills/project-lifecycle-order-guards/plan.md .atomic-skills/projects/atomic-skills/project-lifecycle-order-guards/phases/archive/2026-07-project-lifecycle-order-guards.md .atomic-skills/projects/atomic-skills/project-lifecycle-order-guards/lessons/project-lifecycle-order-guards.md`
  -> `All 3 file(s) valid, 1 plan(s) cross-validated`; `rtk node scripts/refresh-state.js`
  -> `refresh-state: rollups 1 changed, focus 1 changed, digest -> help-command · F3`;
  `rtk node scripts/append-completion.js --event phase-done --project atomic-skills --plan project-lifecycle-order-guards --phase F0 --actuals-since-commit 2f9c8bdee197f4204637301b0a83226760046535 --actuals-since 2026-07-08T10:08:05Z`
  -> `append-completion: phase-done atomic-skills/project-lifecycle-order-guards/F0 weight=1(count) ✓`;
  `rtk node --test tests/lifecycle-order-guard.test.js tests/help/compute-help.test.js tests/detect-orphan-worktrees.test.js tests/help/help-vocab.test.js tests/project.test.js tests/worktree-teardown.test.js tests/finalize-plan-scope.test.js tests/validate-state.test.js`
  -> `tests 244`, `pass 244`, `fail 0`.
- **Uncommitted changes:** clean tree.

## Self-review against code-quality gates

- **G1 read-before-claim**: 5 tasks closed with verifier evidence in `tasks[].evidence`; 4 exit criteria met with evidence blocks populated in `exitGates[]` and `phases[0].exitGate.criteria[]`.
- **G2 soft-language**: `nextAction` is `null` on the closed initiative; task and criterion completion claims use `passed: true` evidence.
- **G6 reference-or-strike**: exit-gate evidence records exact commands and pass counts; review evidence is `.atomic-skills/reviews/project-lifecycle-order-guards-F0-local-review.md`.
- **G10 gate-must-be-able-to-fail**: G-1 fails when the map lacks required lifecycle terms; G-2/G-3/G-4 fail on non-zero test exit or zero collected tests.
- **Codex review**: local review fallback ran at HEAD `5c5167b17a2b5b012b3b50726b727a54b48fb55a`; verdict `clean_after_fix`, counts `0 blocker / 0 critical / 1 major / 0 minor`, file `.atomic-skills/reviews/project-lifecycle-order-guards-F0-local-review.md`.
- **Review gate (G2)**: recorded on the phase descriptor as `reviewGate: { status: passed, at: 5c5167b17a2b5b012b3b50726b727a54b48fb55a, mode: local, reviewFile: .atomic-skills/reviews/project-lifecycle-order-guards-F0-local-review.md, verifiedAt: 2026-07-08T13:15:00.466Z }`.
- **Lessons (G1)**: distilled 1 reusable lesson into `.atomic-skills/projects/atomic-skills/project-lifecycle-order-guards/lessons/project-lifecycle-order-guards.md`, ratified by the user.
