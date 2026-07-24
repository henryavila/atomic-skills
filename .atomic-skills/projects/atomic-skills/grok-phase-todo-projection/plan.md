---
schemaVersion: "0.1"
slug: grok-phase-todo-projection
title: Projeção de fases do project no TODO do Grok
version: "1.0"
status: active
started: 2026-07-24T18:38:57.644Z
lastUpdated: 2026-07-24T19:56:19.186Z
branch: plan/grok-phase-todo-projection
currentPhase: F1
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
    goal: "Congelar em KB greppable: label F0 (n/N)—summary|title, SoT order,
      paused, merge/reseed, anti-proc, Grok-local; SessionStart = hint only."
    dependsOn: []
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F0-G1
          description: KB freezes label summary|title, SoT order, paused, anti-proc,
            Grok-local
          status: met
          verifier:
            kind: shell
            command: test -f docs/kb/grok-phase-todo-projection.md && rg -n
              'summary|title|refresh-state|todo_write|paused|anti-proc|Grok-local|merge'
              docs/kb/grok-phase-todo-projection.md
            expectExitCode: 0
          metAt: 2026-07-24T19:42:03.616Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-24T19:42:03.616Z
            verifiedCommit: 9cba1ffa27b10da0c9a7646456545510ccbf87eb
            passed: true
            exitCode: 0
            outputSummary: >-
              4:checklist via the Grok session checklist tool (`todo_write`).
              Prose-only here;

              6:`refresh-state` / `emit-focus` — this doc is the **Grok
              session-todo consumer**

              10:producer+consumer); `docs/kb/grok-build-compatibility.md`
              (Grok-local install and

              21:| **anti-proc**: phase scaffold vs `proc:*` while plan anchored
              | Multi-IDE mirror (Claude/Codex/Cursor todos) |

              22:| Reseed / merge rules for session checklist tool | Using todo
              completion to close phase/task (GATE-R2 stays) |

              24:**Grok-local only.
        - id: F0-G2
          description: Manual HARD operator confirms label format and SoT order match
            approved design
          status: met
          verifier:
            kind: manual
            description: Henry acks F0 contract in chat or gate-signoff with explicit PASS
          metAt: 2026-07-24T19:42:03.616Z
          evidence:
            verifierKind: manual
            verifiedAt: 2026-07-24T19:42:03.616Z
            verifiedCommit: 9cba1ffa27b10da0c9a7646456545510ccbf87eb
            passed: true
            outputSummary: Operator F0-G2 PASS + decision-review PASS
    status: done
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
    summary: "Contrato greppable: label, SoT, paused, reseed skill-level,
      SessionStart só hint"
    evaluationGate:
      status: passed
      verdict: pass
      verifiedAt: 2026-07-24T19:29:13.834Z
      at: e886730817273eba9a2ce80b855e35e75691635b
    decisionReview:
      status: passed
      verifiedAt: 2026-07-24T19:32:34.509Z
    reviewGate:
      status: passed
      at: 9cba1ffa27b10da0c9a7646456545510ccbf87eb
      mode: both
      reviewFile: .atomic-skills/reviews/2026-07-24-f0-grok-phase-todo-projection-both.md
      verifiedAt: 2026-07-24T19:42:03.616Z
    lessonsState: none
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
          description: Helper unit tests cover label IDs status paused descriptor-only
            empty focus
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project-session-todos.test.js
            expectExitCode: 0
        - id: F1-G2
          description: "CLI json contract: merge field + todos with id content status shape"
          status: pending
          verifier:
            kind: shell
            command: node scripts/project-session-todos.js --json . | node -e "let
              d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const
              j=JSON.parse(d); if(typeof
              j.merge!=='boolean'||!Array.isArray(j.todos)) process.exit(1);
              for(const t of j.todos){ if(!t.id||!t.content||!t.status)
              process.exit(2);} process.exit(0)})"
            expectExitCode: 0
    status: active
    summary: Helper + testes do contrato canônico (id, label, status, paused, merge)
    businessIntent:
      value: Agente e skills obtêm payload determinístico de session todos (fases do
        plan ativo) sem inventar rollups nem tocar o SoT.
      workflow: Implementar scripts/project-session-todos.js + CLI JSON → testes
        golden (label, status, paused, descriptor-only, empty focus) → F1-G1/G2.
      rules: Ids estáveis <planSlug>:Fn; content F0 (n/N) — summary|title ou (—)
        descriptor-only; um in_progress = fase corrente; paused → pending + ·
        paused; empty focus → [] sem wipe; zero write em ~/.grok/sessions /
        frontmatter.
      outOfScope: Chamar todo_write; mutar plan/initiative; inventar totals
        descriptor-only; rede; helper em Claude/Codex mirror.
      doneWhen: node --test tests/project-session-todos.test.js exit 0 e CLI --json
        emite {merge,todos[]} com shape válido.
    evaluationGate:
      status: passed
      verdict: pass
      verifiedAt: 2026-07-24T19:56:19.186Z
      at: 6c53407fe154b122a6b1b15dfd92d49840062427
  - id: F2
    slug: grok-phase-todo-projection-f2-harden-do-emit-lint-estrutural
    title: Harden do emit lint estrutural
    goal: Lint estrutural exige refresh-state + helper em done/reconcile/phase-done
      e mutadores de foco phase-reopen/switch/unblock/archive.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: lint-transition-emits requires refresh-state+helper on close and
            focus mutators
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
    summary: "Lint transitions: closes + phase-reopen/switch/unblock/archive"
  - id: F3
    slug: grok-phase-todo-projection-f3-wire-implement-e-reseed-grok
    title: Wire implement e reseed Grok
    goal: implement + maestro reseed scaffold via helper+todo_write;
      SessionStart/help only hint; anti-proc; compaction reseed documented.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F3-G1
          description: implement + maestro mention project-session-todos, reseed,
            compaction, anti-proc separately
          status: pending
          verifier:
            kind: shell
            command: rg -n 'project-session-todos' skills/core/implement.md
              skills/shared/implement-automate-maestro.md && rg -n
              'reseed|compaction' skills/core/implement.md && rg -n 'proc'
              skills/core/implement.md && rg -n
              'project-session-todos|todo_write|hint'
              skills/shared/project-assets/project-help.md
              skills/shared/project-assets/hooks/session-start.sh
            expectExitCode: 0
        - id: F3-G2
          description: Manual HARD dogfood implement start sees phase scaffold labels with
            titles
          status: pending
          verifier:
            kind: manual
            description: Henry runs implement or helper plus todo_write once and acks labels
              show F0 n/N with title or summary
    status: pending
    summary: Implement reseeds scaffold; SessionStart só hint; anti-proc
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
          description: New unit tests plus install-uninstall-roundtrip and render
            compatibility pass
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project-session-todos.test.js
              tests/transition-emits.test.js
              tests/install-uninstall-roundtrip.test.js tests/render.test.js
            expectExitCode: 0
        - id: F4-G2
          description: Manual HARD Henry confirms dogfood checklist completed once on Grok
          status: pending
          verifier:
            kind: manual
            description: Operator PASS after one real session saw phase scaffold update
    status: pending
    summary: Regressão unit + install parity Grok + dogfood checklist
references:
  - kind: file
    label: design.md critic-approved
    path: .atomic-skills/projects/atomic-skills/grok-phase-todo-projection/design.md
planActive: true
planTitle: Projeção de fases do project no TODO do Grok
executionMode: automate
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

## Reviews

- internal: clean — 2026-07-24 — Stage 8a self-loop
- cross-model (codex): fail→applied — 2026-07-24 — provider gpt-5.5; 2 critical + 5 major applied into plan gates/prose; review file .atomic-skills/reviews/2026-07-24-1859-grok-phase-todo-projection.md
