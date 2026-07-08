---
schemaVersion: "0.1"
slug: plan-dependencies-f3-dashboard-caminho-de-execucao
title: Dashboard caminho de execucao
goal: representar no dashboard a timeline de execucao entre planos e a relacao
  separada de planos surgidos dentro de fases ou tasks.
status: done
branch: plan/plan-dependencies
started: 2026-06-25T13:43:40.847Z
lastUpdated: 2026-06-26T01:17:15Z
nextAction: null
parentPlan: plan-dependencies
phaseId: F3
tasksDone: 3
tasksTotal: 3
gatesMet: 1
gatesTotal: 1
weightDone: 5
weightTotal: 5
exitGates:
  - id: F3-G1
    description: Dashboard manifest and consumer checks expose execution path and
      origin relation as separate UI concepts.
    status: met
    metAt: 2026-06-26T01:17:15Z
    verifier:
      kind: shell
      command: rtk node --test tests/aideck-consumer-manifest.test.js
        tests/aideck-consumer-manifest-compat.test.js
        tests/aideck-contract.test.js tests/verify-aideck-routes-smoke.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-26T01:17:15Z
      passed: true
      exitCode: 0
      outputSummary: "rtk node --test tests/aideck-consumer-manifest.test.js
        tests/aideck-consumer-manifest-compat.test.js
        tests/aideck-contract.test.js tests/verify-aideck-routes-smoke.test.js:
        tests 45, pass 39, fail 0, skipped 6, duration_ms 336.262792"
    verifierLabel: "shell: rtk node --test tests/aideck-consumer-manifest.test.js test…"
    evidenceSummary: passed · 2026-06-26
stack:
  - id: 1
    title: Dashboard caminho de execucao
    type: task
    openedAt: 2026-06-25T13:43:40.847Z
tasks:
  - id: T3.1
    title: Add execution path and plan relation widgets
    description: Adicionar ao manifest as secoes **Caminho de execucao** e
      **Relacoes do plano**, com fontes e campos que separam dependencia
      operacional de origem.
    status: done
    closedAt: 2026-06-26T01:01:21Z
    lastUpdated: 2026-06-26T01:01:21Z
    scopeBoundary:
      - nao remover widgets publicados e nao misturar labels de origem com
        labels de bloqueio
    acceptance:
      - o manifest registra uma leitura de Liberado agora, Em andamento,
        Bloqueado e Concluido por `executionLane`, e uma leitura separada para
        Origem, Dependencias e Impacto do plano
    verifier:
      kind: shell
      command: rtk node --test tests/aideck-consumer-manifest.test.js
        tests/aideck-consumer-manifest-compat.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-26T01:01:21Z
      passed: true
      exitCode: 0
      outputSummary: "rtk node --test tests/aideck-consumer-manifest.test.js
        tests/aideck-consumer-manifest-compat.test.js: tests 33, pass 33, fail
        0, duration_ms 77.990084"
    outputs:
      - kind: file
        path: assets/aideck-consumer/manifest.yaml
      - kind: file
        path: tests/aideck-consumer-manifest.test.js
      - kind: file
        path: tests/aideck-consumer-manifest-compat.test.js
    summary: Registra widgets de Caminho de execucao e Relacoes do plano no manifest.
    weight: 2
  - id: T3.2
    title: Verify dashboard consumer renders the new plan relations
    description: Atualizar a verificacao do consumer para cobrir o novo data source
      e impedir regressao visual ou contratual no dashboard.
    status: done
    closedAt: 2026-06-26T01:05:16Z
    lastUpdated: 2026-06-26T01:05:16Z
    scopeBoundary:
      - nao iniciar servidor de desenvolvimento dentro dos testes e nao acoplar
        verificacao a uma viewport especifica
    acceptance:
      - a verificacao encontra `planEdges`, os widgets novos ficam presentes no
        contrato do consumer, e o smoke de rotas segue passando
    verifier:
      kind: shell
      command: rtk node --test tests/aideck-contract.test.js
        tests/verify-aideck-routes-smoke.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-26T01:05:16Z
      passed: true
      exitCode: 0
      outputSummary: "rtk node --test tests/aideck-contract.test.js
        tests/verify-aideck-routes-smoke.test.js: tests 12, pass 6, fail 0,
        skipped 6, duration_ms 58.733875"
    outputs:
      - kind: file
        path: scripts/verify-aideck-consumer.mjs
      - kind: file
        path: tests/aideck-contract.test.js
      - kind: file
        path: tests/verify-aideck-routes-smoke.test.js
    summary: Cobre o novo data source nos checks do consumer/dashboard.
    weight: 2
  - id: T3.3
    title: Document the operator path in project skill
    description: Atualizar a skill `project` para que status/dashboard e proximas
      acoes expliquem o caminho de execucao quando ha planos dependentes ou
      planos surgidos de uma fase/task.
    status: done
    closedAt: 2026-06-26T01:08:44Z
    lastUpdated: 2026-06-26T01:08:44Z
    scopeBoundary:
      - nao alterar o contrato de `project finalize`, `project archive` ou
        `project verify`
    acceptance:
      - a documentacao orienta o operador a ler Caminho de execucao para
        bloqueio e Surgiu de para linhagem, com exemplo P1/F2/T-004 gerando P2
    verifier:
      kind: shell
      command: rtk node --test tests/validate-skills.test.js && rtk rg -n "Caminho de
        execucao|Surgiu de|T-004" skills/core/project.md
        skills/shared/project-assets/project-transitions.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-26T01:08:44Z
      passed: true
      exitCode: 0
      outputSummary: 'rtk node --test tests/validate-skills.test.js && rtk rg -n
        "Caminho de execucao|Surgiu de|T-004" skills/core/project.md
        skills/shared/project-assets/project-transitions.md: tests 53, pass 53,
        fail 0, duration_ms 119.806708; rg matched both files'
    outputs:
      - kind: file
        path: skills/core/project.md
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: tests/validate-skills.test.js
    summary: Documenta o caminho operacional na skill project.
    weight: 1
parked: []
emerged: []
summary: Mostra no dashboard o caminho de execucao e a linhagem Surgiu de separadamente.
planTitle: plan-dependencies - dependencias executaveis entre planos
planActive: false
current: false
---

# Narrative / notes

Initiative for phase **F3 — Dashboard caminho de execucao**.

## Decisions

- 2026-06-26T00:49:43Z: F3 foi ativada depois do opt-in `avancar`;
  `src/transition.js:proposeAdvance(plan, 'F2')` retornou
  `{"kind":"single","next":"F3","alternatives":[]}` e
  `unknownDeps(plan)` retornou `[]`.
- 2026-06-26T00:51:40Z: F2 foi arquivada em
  `.atomic-skills/projects/atomic-skills/plan-dependencies/phases/archive/2026-06-f2-projecao-aideck-e-api-de-dependencias.md`,
  com evento `phase-done` gravado em `.atomic-skills/analytics/completions.jsonl`.
- 2026-06-26T01:01:21Z: T3.1 adicionou `planEdges`, `Caminho de execucao` e
  `Relacoes do plano` em `assets/aideck-consumer/manifest.yaml`; a task fechou
  com `evidence.passed: true` apos
  `rtk node --test tests/aideck-consumer-manifest.test.js tests/aideck-consumer-manifest-compat.test.js`.
- 2026-06-26T01:05:16Z: T3.2 adicionou a rota smoke
  `/api/consumers/:consumerId/projects/:projectId/data/planEdges` em
  `scripts/verify-aideck-consumer.mjs` e cobriu o contrato em
  `tests/aideck-contract.test.js`; a task fechou com `evidence.passed: true`.
- 2026-06-26T01:08:44Z: T3.3 documentou o modelo operacional na skill `project`
  em `skills/core/project.md` e
  `skills/shared/project-assets/project-transitions.md`; a task fechou com
  `evidence.passed: true` apos
  `rtk node --test tests/validate-skills.test.js && rtk rg -n "Caminho de execucao|Surgiu de|T-004" skills/core/project.md skills/shared/project-assets/project-transitions.md`.
- 2026-06-26T01:17:15Z: F3-G1 fechou com `evidence.passed: true` apos
  `rtk node --test tests/aideck-consumer-manifest.test.js tests/aideck-consumer-manifest-compat.test.js tests/aideck-contract.test.js tests/verify-aideck-routes-smoke.test.js`.
- 2026-06-26T01:17:15Z: review-code de F3 foi registrado como local em
  `.atomic-skills/reviews/2026-06-26-0116-plan-dependencies-f3.md`, com
  `status: passed` e `counts 0B/0C/0M/0m/0n`.

## Links

_(plan doc, external refs)_

## Self-review

- G1 read-before-claim: aplicado — cada task fechada referencia linhas de fonte ou a execucao de verifier que a fechou.
- G2 soft-language: aplicado — completion claims usam `evidence.passed: true`; o handoff foi verificado contra a lista de placeholders e termos banidos do implement.
- G6 reference-or-strike: aplicado — caminhos, comandos e saidas no handoff sao literais verbatim.

## Self-review against code-quality gates

- G1 read-before-claim: aplicado - 3 tasks fechadas carregam `evidence.passed: true`; o review cita linhas de fonte em `.atomic-skills/reviews/2026-06-26-0116-plan-dependencies-f3.md`.
- G2 soft-language: aplicado - claims de conclusao usam `passed: true` e `status: passed`; o handoff foi revisado contra a lista G2.
- G6 reference-or-strike: aplicado - o handoff lista paths, comandos, outputs e `git status --porcelain` literais.
- Codex review: nao invocado como revisao cross-model nesta transicao; o review gate de F3 foi registrado como `reviewGate: { status: passed, at: "working-tree@106d8b5", mode: local, reviewFile: .atomic-skills/reviews/2026-06-26-0116-plan-dependencies-f3.md, verifiedAt: 2026-06-26T01:17:15Z }`.
- Review gate (G2): registrado no phase descriptor de `.atomic-skills/projects/atomic-skills/plan-dependencies/plan.md` antes de F3 mudar para `status: done`.
- Lessons (G1): no lessons distilled (clean phase); `.atomic-skills/reviews/2026-06-26-0116-plan-dependencies-f3.md` lista `No blocker, critical, major, or minor findings.`

## Session handoff
- **Narrative:** F3 esta fechada para `atomic-skills/plan-dependencies`, com `status: done` em `.atomic-skills/projects/atomic-skills/plan-dependencies/phases/archive/2026-06-f3-dashboard-caminho-de-execucao.md`. O plano `plan-dependencies` esta `status: done`, `currentPhase: F3`, sem fase sucessora. T3.1, T3.2, T3.3 e F3-G1 carregam `evidence.passed: true`.
- **Decision log:** O usuario respondeu `avancar`, entao a transicao aceitou o unico sucessor calculado por `src/transition.js`: `{"kind":"single","next":"F3","alternatives":[]}`. T3.1 manteve origem e dependencia operacional separadas: `assets/aideck-consumer/manifest.yaml:69` registra `planEdges`; `assets/aideck-consumer/manifest.yaml:430` usa `executionLane`; `assets/aideck-consumer/manifest.yaml:473` usa `Relacoes do plano`; `assets/aideck-consumer/manifest.yaml:489`, `assets/aideck-consumer/manifest.yaml:501` e `assets/aideck-consumer/manifest.yaml:513` filtram `planEdges` por `origin` ou `dependency`. T3.2 levou `planEdges` para o smoke real em `scripts/verify-aideck-consumer.mjs:234` e para o contrato em `tests/aideck-contract.test.js:258`. T3.3 documentou a diferenca operacional entre `Caminho de execucao` e `Surgiu de` em `skills/core/project.md:37`, `skills/core/project.md:41`, `skills/core/project.md:42`, `skills/shared/project-assets/project-transitions.md:61`, `skills/shared/project-assets/project-transitions.md:62` e `skills/shared/project-assets/project-transitions.md:63`.
- **Single nextAction:** Commit the completed `plan-dependencies` branch before running `project finalize plan-dependencies`.
- **Verbatim state:** `rtk node --test tests/aideck-consumer-manifest.test.js tests/aideck-consumer-manifest-compat.test.js tests/aideck-contract.test.js tests/verify-aideck-routes-smoke.test.js` => `tests 45`, `pass 39`, `fail 0`, `skipped 6`, `duration_ms 336.262792`. `rtk node --test tests/aideck-consumer-manifest.test.js tests/aideck-consumer-manifest-compat.test.js` => `tests 33`, `pass 33`, `fail 0`, `duration_ms 222.943375`. `rtk node --test tests/aideck-contract.test.js tests/verify-aideck-routes-smoke.test.js` => `tests 12`, `pass 6`, `fail 0`, `skipped 6`, `duration_ms 179.810625`. `rtk node --test tests/validate-skills.test.js && rtk rg -n "Caminho de execucao|Surgiu de|T-004" skills/core/project.md skills/shared/project-assets/project-transitions.md` => `tests 53`, `pass 53`, `fail 0`, `duration_ms 49.581958`; `skills/core/project.md:37`, `skills/core/project.md:41`, `skills/core/project.md:42`, `skills/shared/project-assets/project-transitions.md:61`, `skills/shared/project-assets/project-transitions.md:62`, `skills/shared/project-assets/project-transitions.md:63`. `.atomic-skills/reviews/2026-06-26-0116-plan-dependencies-f3.md` => `status: passed`, `mode: local`, `range: "106d8b54201fa18e984e6ade87fad3a043811517..working-tree"`. `rtk node scripts/append-completion.js --event phase-done --project atomic-skills --plan plan-dependencies --phase F3 --actuals-since 2026-06-25T13:43:40.847Z` => `append-completion: phase-done atomic-skills/plan-dependencies/F3 weight=1(count) ✓`. `rtk node scripts/refresh-state.js` => `refresh-state: rollups 1 changed, focus 1 changed, digest → no active plan`.
- **Uncommitted changes:** ` M .atomic-skills/analytics/completions.jsonl`; ` M .atomic-skills/projects/atomic-skills/PROJECT-STATUS.md`; ` D .atomic-skills/projects/atomic-skills/plan-dependencies/phases/f2-projecao-aideck-e-api-de-dependencias.md`; ` D .atomic-skills/projects/atomic-skills/plan-dependencies/phases/f3-dashboard-caminho-de-execucao.md`; ` M .atomic-skills/projects/atomic-skills/plan-dependencies/plan.md`; ` M assets/aideck-consumer/manifest.yaml`; ` M scripts/verify-aideck-consumer.mjs`; ` M skills/core/project.md`; ` M skills/shared/project-assets/project-transitions.md`; ` M tests/aideck-consumer-manifest.test.js`; ` M tests/aideck-contract.test.js`; ` M tests/validate-skills.test.js`; ` M tests/verify-aideck-routes-smoke.test.js`; `?? .atomic-skills/projects/atomic-skills/plan-dependencies/phases/archive/2026-06-f2-projecao-aideck-e-api-de-dependencias.md`; `?? .atomic-skills/projects/atomic-skills/plan-dependencies/phases/archive/2026-06-f3-dashboard-caminho-de-execucao.md`; `?? .atomic-skills/reviews/2026-06-26-0116-plan-dependencies-f3.md`.
