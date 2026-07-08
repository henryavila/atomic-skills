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
lastUpdated: 2026-07-08T13:02:07.597Z
nextAction: Implemente T-005 em `scripts/detect-orphan-worktrees.js` e
  `skills/shared/project-assets/project-verify.md`.
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
tasksDone: 4
tasksTotal: 5
gatesMet: 0
gatesTotal: 4
weightDone: 12
weightTotal: 14
exitGates:
  - id: G-1
    description: O mapa de ordem documenta cada comando posterior, pre-etapa
      obrigatoria, excecao permitida e comando recomendado.
    status: pending
    verifier:
      kind: shell
      command: test -f docs/design/project-lifecycle-order-guards.md && grep -q
        'archive <slug>' docs/design/project-lifecycle-order-guards.md && grep
        -q 'depend resolve --archived'
        docs/design/project-lifecycle-order-guards.md
    verifierLabel: "shell: test -f docs/design/project-lifecycle-order-guards.md && gr…"
  - id: G-2
    description: Testes cobrem pulos de etapa em archive, finalize, consolidate,
      depend, help e as excecoes legitimas.
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: tests/lifecycle-order-guard.test.js
    verifierLabel: "test: node --test tests/lifecycle-order-guard.test.js"
  - id: G-3
    description: project help emite comandos predecessores invocaveis para estados
      bloqueados do lifecycle.
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: tests/help/compute-help.test.js
    verifierLabel: "test: node --test tests/help/compute-help.test.js"
  - id: G-4
    description: project verify reporta estados archived prematuros como findings
      bloqueantes de lifecycle.
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: tests/detect-orphan-worktrees.test.js
    verifierLabel: "test: node --test tests/detect-orphan-worktrees.test.js"
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
      outputSummary: node --test tests/lifecycle-order-guard.test.js -> tests
        13, pass 13, fail 0
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
      outputSummary: node --test tests/project.test.js
        tests/worktree-teardown.test.js tests/finalize-plan-scope.test.js ->
        tests 97, pass 97, fail 0
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
    status: pending
    lastUpdated: 2026-07-08T10:08:05Z
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

- **Narrative:** F0 esta ativa em
  `plan/project-lifecycle-order-guards`; T-001, T-002, T-003 e T-004 estao
  fechadas com `evidence.passed: true` na iniciativa
  `.atomic-skills/projects/atomic-skills/project-lifecycle-order-guards/phases/project-lifecycle-order-guards.md`.
  O mapa de ordem foi commitado em
  `docs/design/project-lifecycle-order-guards.md` pelo commit `c4711f0`, e o
  helper puro foi commitado em `scripts/lifecycle-order-guard.js` pelo commit
  `ebc4c6d`. Os assets mutaveis de project foram conectados ao guarda pelo
  commit `51f5c12`. Help/catalogo/docs foram corrigidos em `f253916` e
  `a4592f0` para emitir `finalize <slug>` e predecessor de lifecycle.
- **Decision log:** O bootstrap do plano foi checkpointado separadamente no
  commit `cf4777e` para limpar a retomada antes do fechamento da task. O
  classificador da T-002 ficou puro e sem conexao aos assets mutaveis; a
  T-003 conectou esse contrato nos assets e adicionou `tests/project.test.js`
  para impedir remocao silenciosa das instrucoes de guarda. A T-004 mudou o
  catalogo para `finalize <slug>` e fez `compute-help` substituir
  `archive`/teardown stale pelo predecessor indicado pelo guarda.
- **Single nextAction:** Implemente T-005 em `scripts/detect-orphan-worktrees.js`
  e `skills/shared/project-assets/project-verify.md`.
- **Verbatim state:** `rtk bash -lc "test -f docs/design/project-lifecycle-order-guards.md && grep -q 'archive <slug>' docs/design/project-lifecycle-order-guards.md && grep -q 'split-phase' docs/design/project-lifecycle-order-guards.md && grep -q 'depend resolve --archived' docs/design/project-lifecycle-order-guards.md"`
  -> exit 0; `rtk rg -n "archive <slug>|split-phase|depend resolve --archived" docs/design/project-lifecycle-order-guards.md`
  -> `68:| `archive <slug>` de plano | Plano ja foi publicado e integrado: PR registrada por `finalize <slug>` ou PR de `consolidate`, merge confirmado no provedor/integracao, e branch chegou ao baseRef. | Plano tem branch publicavel sem PR; PR existe mas nao esta MERGED; baseRef indeterminado; `prIdentity` ausente; branch tem residue alem do head mergeado. | Plano sem branch/worktree propria pode arquivar se houver criterio explicito de integracao local; importacao historica via `discover` e caso separado. | `finalize <slug>`; merge da PR; depois `archive <slug>`. Se archive ja foi feito cedo, usar `verify` para achar `archived-never-pr`/`archived-pr-open-unmerged` e recuperar a publicacao. |`;
  `86:### `split-phase``; `72:| `depend resolve <dependent> <prerequisite> --archived` | Prerequisite esta `archived` **e** a branch chegou a integracao obrigatoria. | Edge nao existe; prerequisito nao esta `archived`; prerequisito esta `archived-never-pr` ou `archived-pr-open-unmerged`; release ja nao casa com a dependencia. | Planos sem branch propria exigem justificativa explicita de integracao local antes do resolve. | `finalize <prerequisite>`, merge, `archive <prerequisite>`, depois `depend resolve --archived`. |`;
  `rtk node --test tests/lifecycle-order-guard.test.js` -> `tests 13`,
  `pass 13`, `fail 0`; `rtk rg -n "export function classifyLifecycleOrder|function archivePlan|function dependResolveArchived|function phaseDone" scripts/lifecycle-order-guard.js tests/lifecycle-order-guard.test.js`
  -> `scripts/lifecycle-order-guard.js:121:function archivePlan(input) {`;
  `scripts/lifecycle-order-guard.js:197:function dependResolveArchived(input) {`;
  `scripts/lifecycle-order-guard.js:235:function phaseDone(input) {`;
  `scripts/lifecycle-order-guard.js:300:export function classifyLifecycleOrder(input = {}) {`;
  `rtk node --test tests/project.test.js tests/worktree-teardown.test.js tests/finalize-plan-scope.test.js`
  -> `tests 97`, `pass 97`, `fail 0`; `rtk rg -n "classifyLifecycleOrder|before fork-resume|recommendedCommand|predecessor command|non-terminal|depend resolve --archived" skills/shared/project-assets/project-transitions.md skills/shared/project-assets/project-dependencies.md skills/shared/project-assets/project-finalize.md skills/shared/project-assets/project-consolidate.md tests/project.test.js`
  -> `skills/shared/project-assets/project-transitions.md:283:1a. **Lifecycle-order guard (HARD gate — before fork-resume, status flips, moves, or teardown offers):** call `classifyLifecycleOrder` from `scripts/lifecycle-order-guard.js` on the resolved target.`;
  `skills/shared/project-assets/project-dependencies.md:106:- Before writing `release.archived: resolved`, call `classifyLifecycleOrder` from `scripts/lifecycle-order-guard.js` with `{ command: 'depend resolve --archived', dependentSlug, prerequisite: <prerequisite plan slice> }`. If it returns `blocked`, print `reason` and `recommendedCommand`, then STOP without changing the edge.`;
  `skills/shared/project-assets/project-finalize.md:237:non-terminal target, also print the predecessor command: `phase-done` for the`;
  `skills/shared/project-assets/project-consolidate.md:38:   If a plan is excluded because it is non-terminal, print the predecessor command`;
  `rtk node --test tests/help/compute-help.test.js tests/help/help-vocab.test.js`
  -> `tests 34`, `pass 34`, `fail 0`; `rtk rg -n "finalize demo-plan|finalize <slug>|lifecycle-order block|lifecycle-order blockers|archive/teardown|signature: '<slug>'|stale archive nextAction" scripts/compute-help.js tests/help/compute-help.test.js tests/help/fixtures/states.js tests/help/help-vocab.test.js meta/catalog.yaml docs/skills/project.md`
  -> `scripts/compute-help.js:195:  // 7b — stale posterior nextAction: archive/teardown before publication proof.`;
  `tests/help/compute-help.test.js:335:test('computeHelp: stale archive nextAction is replaced by finalize <slug> when publication proof is missing', () => {`;
  `meta/catalog.yaml:390:        signature: '<slug>'`;
  `docs/skills/project.md:80:| `finalize <slug>` | Publish the finished plan branch as a PR: push plan/<slug> + gh pr create --base <integrationRef>, record the PR url in plan state; requires explicit slug and runs before merge/archive |`.
- **Uncommitted changes:** clean tree.
