---
schemaVersion: "0.1"
slug: grok-phase-todo-projection
title: Projeção de fases do project no TODO do Grok
version: "1.0"
status: active
started: 2026-07-24T18:38:57.644Z
lastUpdated: 2026-07-24T18:38:57.644Z
branch: plan/grok-phase-todo-projection
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: SoT único
    body: só a skill `project`/`done` muta estado canônico; TODO é projeção de
      sessão.
  - id: P2
    title: Fases, não tasks
    body: checklist Grok = trilho de fases; `T-00N` fica no YAML/aiDeck.
  - id: P3
    title: Identidade semântica
    body: content sempre inclui o que a fase faz (`summary` || `title`), nunca só
      `F0 (x/y)`.
  - id: P4
    title: Write-through
    body: mutação → `refresh-state` → helper → `todo_write` (nessa ordem).
  - id: P5
    title: Reseed honesto
    body: pós-compaction e no start; harness Grok não devolve snapshot de todos.
  - id: P6
    title: Host-local Grok
    body: zero fork do core Grok; zero write em `plan.json` da sessão por shell.
glossary:
  - term: session todo
    definition: Item do `todo_write` / checklist de sessão do Grok
  - term: phase scaffold
    definition: Conjunto de session todos = uma linha por fase do plan ativo
  - term: helper
    definition: Script zero-token que emite o payload JSON de `todo_write` a partir do SoT
  - term: label canônico
    definition: "`F{id} (done/total) — summary ou title`"
  - term: refresh-state
    definition: Chokepoint rollups + focus markers + focus.json + aiDeck series
phases:
  - id: F0
    slug: grok-phase-todo-projection-f0-contrato-de-projecao-e-wire-up-de
    title: Contrato de projeção e wire-up de prosa
    goal: Congelar o contrato de label, mapeamento de status, ordem SoT→espelho,
      reseed e anti-competição proc em prosa e docs, greppable, sem o helper
      completo ainda.
    dependsOn: []
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F0-G1
          description: KB contract file exists and states label plus SoT order
          status: pending
          verifier:
            kind: shell
            command: test -f docs/kb/grok-phase-todo-projection.md && rg -n
              'refresh-state|todo_write' docs/kb/grok-phase-todo-projection.md
            expectExitCode: 0
        - id: F0-G2
          description: Manual HARD operator confirms label format and SoT order match
            approved design
          status: pending
          verifier:
            kind: manual
            description: Henry acks F0 contract in chat or gate-signoff with explicit PASS
    status: active
    businessIntent:
      value: Em sessões Grok o agente mantém no checklist nativo o trilho de fases do
        plan com progresso e o que cada fase faz, sem duplicar SoT nem fechar
        task via TODO.
      workflow: Contrato em prosa → helper determinístico a partir do YAML → lint de
        transitions → wire implement/reseed → dogfood.
      rules: SoT só em .atomic-skills; label F0 (n/N) — summary|title; um in_progress
        = fase corrente; reseed pós-compact; projeção só Grok; nunca todo
        completed sem phase done.
      outOfScope: Tasks T-00N no TODO; painel nativo Grok; write em plan.json da
        sessão; multi-IDE mirror; MCP project-state.
      doneWhen: KB+compat com contrato greppable e Henry PASS no gate manual F0-G2.
    summary: Congela contrato de label F0 (n/N)—summary|title, SoT e reseed em
      prosa/docs
  - id: F1
    slug: grok-phase-todo-projection-f1-helper-deterministico-de-projecao
    title: Helper determinístico de projeção
    goal: Script zero-token que, dado o repo, emite o array de session todos das
      fases do plan pickFocus com label canônico e statuses corretos.
    dependsOn:
      - F0
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: Helper tests pass
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project-session-todos.test.js
            expectExitCode: 0
        - id: F1-G2
          description: CLI json on repo root exits 0 and prints todos array
          status: pending
          verifier:
            kind: shell
            command: node scripts/project-session-todos.js --json . | node -e "let
              d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const
              j=JSON.parse(d); if(!Array.isArray(j.todos)) process.exit(1);
              process.exit(0)})"
            expectExitCode: 0
    status: pending
    summary: Helper zero-token project-session-todos com label canônico e statuses
  - id: F2
    slug: grok-phase-todo-projection-f2-harden-do-emit-lint-estrutural
    title: Harden do emit lint estrutural
    goal: Garantir na prosa de transitions que refresh-state e o helper de projeção
      estão nos blocos de mutação de status via detector estrutural.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: lint-transition-emits passes on project-transitions.md
          status: pending
          verifier:
            kind: shell
            command: node scripts/lint-transition-emits.js
              skills/shared/project-assets/project-transitions.md
            expectExitCode: 0
        - id: F2-G2
          description: transition-emits unit tests pass
          status: pending
          verifier:
            kind: shell
            command: node --test tests/transition-emits.test.js
            expectExitCode: 0
    status: pending
    summary: Lint estrutural exige refresh-state e helper nos closes de transition
  - id: F3
    slug: grok-phase-todo-projection-f3-wire-implement-e-reseed-grok
    title: Wire implement e reseed Grok
    goal: implement Atomic Skills e cues de sessão reseedam o scaffold de fases;
      anti-proc; pós-compaction.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F3-G1
          description: implement assets mention helper reseed and anti-proc
          status: pending
          verifier:
            kind: shell
            command: rg -n 'project-session-todos' skills/core/implement.md && rg -n
              'compaction|reseed|proc' skills/core/implement.md
            expectExitCode: 0
        - id: F3-G2
          description: Manual HARD operator dogfoods one implement start sees phase
            scaffold labels with titles
          status: pending
          verifier:
            kind: manual
            description: Henry runs implement or helper plus todo_write once and acks labels
              show F0 n/N with title or summary
    status: pending
    summary: Implement e SessionStart reseedam scaffold de fases no Grok
  - id: F4
    slug: grok-phase-todo-projection-f4-integracao-e-regressao
    title: Integração e regressão
    goal: Suite de regressão verde; parity de install intacta; checklist dogfood.
    dependsOn:
      - F3
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F4-G1
          description: New unit tests pass in isolation
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project-session-todos.test.js
              tests/transition-emits.test.js
            expectExitCode: 0
        - id: F4-G2
          description: Manual HARD Henry confirms dogfood checklist completed once on Grok
          status: pending
          verifier:
            kind: manual
            description: Operator PASS after one real session saw phase scaffold update
    status: pending
    summary: Regressão package + checklist dogfood do scaffold
references: []
planActive: true
planTitle: Projeção de fases do project no TODO do Grok
---

# Projeção de fases do project no TODO do Grok

## 1. Context

Projeção unidirecional skill-level: fases do plan ativo no `todo_write` do Grok com
label `F0 (n/N) — summary|title`, SoT em `.atomic-skills/`, helper determinístico e
harden de `refresh-state` nos closes. Não inventa identidade de fase (usa
`title`/`summary` existentes). Não fecha task via TODO.

## 2. Inviolable principles

- **P1 SoT único** — só a skill `project`/`done` muta estado canônico; TODO é projeção de sessão.
- **P2 Fases, não tasks** — checklist Grok = trilho de fases; `T-00N` fica no YAML/aiDeck.
- **P3 Identidade semântica** — content sempre inclui o que a fase faz (`summary` || `title`), nunca só `F0 (x/y)`.
- **P4 Write-through** — mutação → `refresh-state` → helper → `todo_write` (nessa ordem).
- **P5 Reseed honesto** — pós-compaction e no start; harness Grok não devolve snapshot de todos.
- **P6 Host-local Grok** — zero fork do core Grok; zero write em `plan.json` da sessão por shell.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_
