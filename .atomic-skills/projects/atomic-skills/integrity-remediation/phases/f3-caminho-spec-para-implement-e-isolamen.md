---
schemaVersion: "0.1"
slug: integrity-remediation-f3-caminho-spec-para-implement-e-isolamen
title: Caminho SPEC para implement e isolamento de execução
goal: Consumir o lifecycle reconciliado por F4 e fazer tasks admitidas pelo SPEC chegarem a `implement` com targets e exclusões corretos, resolver o plano solicitado antes dos gates e executar cada writer na worktree certa.
summary: Leva o SPEC materializado ao implement na worktree e no escopo corretos.
status: done
branch: plan/integrity-remediation
started: 2026-07-16T17:03:25.265Z
lastUpdated: 2026-07-16T17:10:12.567Z
nextAction: F3 complete — materialize F1 (installer v2)
parentPlan: integrity-remediation
phaseId: F3
businessIntent:
  value: Levar tasks SPEC-admitted ao implement com targets e exclusões corretos na worktree certa.
  workflow: SPEC materializado → implement targets from outputs; scopeBoundary as DO-NOT; worktree routing before gates.
  rules: No Files property; exclusions never allowlist; explicit plan/worktree before write; F4 barrier satisfied.
  outOfScope: Installer safety F1, host tiers F2, Gemini F5, release F6.
  doneWhen: F3-G1 and F3-G2 verifiers green; implement-ready E2E in temp consumer.
tasksDone: 5
tasksTotal: 5
gatesMet: 2
gatesTotal: 2
weightDone: 5
weightTotal: 5
exitGates:
  - id: F3-G1
    description: SPEC materializado chega a implement com outputs como targets e scopeBoundary como exclusões. FAILS when `Files` é exigido ou uma exclusão vira allowlist.
    status: met
    verifier:
      kind: shell
      command: node --test tests/implement-ready-contract.test.js tests/project-implement-e2e.test.js
      expectExitCode: 0
    metAt: 2026-07-16T17:10:12.567Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T17:10:12.567Z
      passed: true
      exitCode: 0
      verifiedCommit: 01e81e0fa00ced582d4a9bb877f4d68bd1aa1123
      outputSummary: implement-ready-contract + project-implement-e2e
  - id: F3-G2
    description: Argumento explícito seleciona plan, branch e worktree antes de qualquer gate ou write. FAILS when a árvore chamadora governa outro plano.
    status: met
    verifier:
      kind: shell
      command: node --test tests/worktree-plan-routing.test.js
      expectExitCode: 0
    metAt: 2026-07-16T17:10:12.567Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T17:10:12.567Z
      passed: true
      exitCode: 0
      verifiedCommit: 01e81e0fa00ced582d4a9bb877f4d68bd1aa1123
      outputSummary: worktree-plan-routing
stack:
  - id: 1
    title: Caminho SPEC para implement e isolamento de execução
    type: task
    openedAt: 2026-07-16T17:03:25.265Z
tasks:
  - id: T-001
    title: Completar o contrato outputs e scopeBoundary
    summary: Completar o contrato outputs e scopeBoundary
    weight: 1
    description: "Expandir o backstop mínimo de F0/T-001 para o contrato completo lintSpec-decompose-schema-implement: `tasks[].outputs[].path` são targets, `scopeBoundary[]` é DO-NOT e verifier/acceptance permanecem materializados. verified_by: `docs/audits/project-implement-audit-2026-07-10.md:70-106`."
    status: done
    lastUpdated: 2026-07-16T17:10:12.567Z
    scopeBoundary:
      - não introduzir a propriedade inválida `Files` no schema e não interpretar exclusões como allowlist
    acceptance:
      - fixture lintSpec-decompose-schema produz outputs, exclusions, acceptance e verifier; implement aceita targets dentro de outputs e bloqueia qualquer path listado em scopeBoundary
    verifier:
      kind: shell
      command: node --test tests/decompose.test.js tests/phase-materialization/implement-backstop.test.js tests/implement-ready-contract.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: src/decompose.js
      - kind: file
        path: meta/schemas/initiative.schema.json
      - kind: file
        path: tests/decompose.test.js
      - kind: file
        path: tests/phase-materialization/implement-backstop.test.js
      - kind: file
        path: tests/implement-ready-contract.test.js
    closedAt: 2026-07-16T17:10:12.567Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T17:10:12.567Z
      passed: true
      exitCode: 0
      outputSummary: F3 T-001 implemented
  - id: T-002
    title: Resolver target e worktree antes do resume gate
    summary: Resolver target e worktree antes do resume gate
    weight: 1
    description: "Interpretar `implement plan-b` e `implement atomic-skills/plan-b`, selecionar initiative/branch/worktree e só então avaliar dirty state; reutilizar branch existente sem `-b`. verified_by: `docs/audits/project-implement-audit-2026-07-10.md:140-153,241-250`."
    status: done
    lastUpdated: 2026-07-16T17:10:12.567Z
    scopeBoundary:
      - não escrever plan state na árvore chamadora depois de criar outra worktree e não escolher implicitamente outro plano ativo
    acceptance:
      - repo com dois planos roteia plan-b para sua árvore antes do dirty gate, branch existente é reusada, e materialização escreve somente na worktree declarada no frontmatter
    verifier:
      kind: shell
      command: node --test tests/implement.test.js tests/worktree-plan-routing.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
      - kind: file
        path: skills/shared/worktree-isolation.md
      - kind: file
        path: src/project-target-resolver.js
      - kind: file
        path: tests/implement.test.js
      - kind: file
        path: tests/worktree-plan-routing.test.js
    closedAt: 2026-07-16T17:10:12.567Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T17:10:12.567Z
      passed: true
      exitCode: 0
      outputSummary: F3 T-002 implemented
  - id: T-003
    title: Carregar closure authority e checkpoint completo
    summary: Carregar closure authority e checkpoint completo
    weight: 1
    description: "Fazer `implement` carregar explicitamente `project-transitions.md` e `verifier-exec.md`, e preparar handoff antes do único checkpoint de `done`. verified_by: `docs/audits/project-implement-audit-2026-07-10.md:176-185,230-240`."
    status: done
    lastUpdated: 2026-07-16T17:10:12.567Z
    scopeBoundary:
      - não reimplementar `done` dentro de implement e não deixar handoff dirty após o checkpoint
    acceptance:
      - skill instalada resolve ambos os assets, closure delega ao fluxo canônico e fixture de done contém status, evidence e handoff no mesmo commit
    verifier:
      kind: shell
      command: node --test tests/implement.test.js tests/implement-closure-authority.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/project-assets/verifier-exec.md
      - kind: file
        path: tests/implement.test.js
      - kind: file
        path: tests/implement-closure-authority.test.js
    closedAt: 2026-07-16T17:10:12.567Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T17:10:12.567Z
      passed: true
      exitCode: 0
      outputSummary: F3 T-003 implemented
  - id: T-004
    title: Unificar políticas de verifier, concorrência e resolução
    summary: Unificar políticas de verifier, concorrência e resolução
    weight: 1
    description: "Exigir executor e expectativa em query, limitar degraded mode a ad-hoc explícito, declarar um writer por worktree com integração serial e compartilhar resolução/gates entre verbos. verified_by: `docs/audits/project-implement-audit-2026-07-10.md:264-273,282-310,317-323`."
    status: done
    lastUpdated: 2026-07-16T17:10:12.567Z
    scopeBoundary:
      - não admitir query sem runner/expected result, não usar degraded mode para task de plano e não manter listas duplicadas de mutation verbs
    acceptance:
      - schema/lint rejeitam query incompleta, only-ad-hoc bypass é explícito, todos os verbos resolvem ambiguidades igual, adopt bloqueia placeholders e persiste supersedes
    verifier:
      kind: shell
      command: node --test tests/validate-state.test.js tests/implement.test.js tests/project.test.js tests/lint-source.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: meta/schemas/common.schema.json
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/core/project.md
      - kind: file
        path: skills/shared/mode2-codex-lane.md
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/project-assets/project-materialize.md
      - kind: file
        path: skills/shared/project-assets/project-dependencies.md
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
      - kind: file
        path: src/project-target-resolver.js
      - kind: file
        path: tests/validate-state.test.js
      - kind: file
        path: tests/implement.test.js
      - kind: file
        path: tests/project.test.js
      - kind: file
        path: tests/lint-source.test.js
    closedAt: 2026-07-16T17:10:12.567Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T17:10:12.567Z
      passed: true
      exitCode: 0
      outputSummary: F3 T-004 implemented
  - id: T-005
    title: Exercitar o ciclo implement-ready em consumidor temporário
    summary: Exercitar o ciclo implement-ready em consumidor temporário
    weight: 1
    description: "Executar source lint, decompose, schema, target resolution, verifier, done e resume usando a skill instalada e um Git repo temporário. verified_by: `docs/audits/project-implement-audit-2026-07-10.md:354-383`."
    status: done
    lastUpdated: 2026-07-16T17:10:12.567Z
    scopeBoundary:
      - não fabricar `evidence.passed` diretamente e não editar state fora dos comandos públicos exercitados
    acceptance:
      - fixture percorre lintSpec-decompose-implement-done-resume, executa verifier real, grava um evento e termina com worktree limpa
    verifier:
      kind: shell
      command: node --test tests/project-implement-e2e.test.js tests/worktree-plan-routing.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: tests/project-implement-e2e.test.js
      - kind: file
        path: tests/fixtures/implement-ready/source.md
      - kind: file
        path: tests/fixtures/implement-ready/package.json
      - kind: file
        path: scripts/decompose-plan.js
      - kind: file
        path: scripts/validate-state.js
    closedAt: 2026-07-16T17:10:12.567Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T17:10:12.567Z
      passed: true
      exitCode: 0
      outputSummary: F3 T-005 implemented
parked: []
emerged: []
planTitle: Remediação integral de segurança, lifecycle e distribuição
planActive: true
current: true

---
# F3 initiative

Materialized after F4 close with successor barrier.
