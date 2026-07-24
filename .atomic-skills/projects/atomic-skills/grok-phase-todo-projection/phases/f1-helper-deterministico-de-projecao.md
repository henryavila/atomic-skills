---
schemaVersion: "0.1"
slug: grok-phase-todo-projection-f1-helper-deterministico-de-projecao
title: Helper determinístico de projeção
goal: Script zero-token que, dado o repo, emite o array de session todos das
  fases do plan pickFocus com label canônico e statuses corretos.
status: active
branch: plan/grok-phase-todo-projection
started: 2026-07-24T19:44:51.577Z
lastUpdated: 2026-07-24T19:44:51.577Z
nextAction: "Start T-001: Implementar helper e CLI"
parentPlan: grok-phase-todo-projection
phaseId: F1
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
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 2
exitGates:
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
stack:
  - id: 1
    title: Helper determinístico de projeção
    type: task
    openedAt: 2026-07-24T19:44:51.577Z
tasks:
  - id: T-001
    title: Implementar helper e CLI
    description: Implementar helper e CLI
    status: pending
    lastUpdated: 2026-07-24T19:44:51.577Z
    scopeBoundary:
      - do not call todo_write or write under ~/.grok/sessions; do not mutate
        plan or initiative frontmatter; do not invent tasksDone or total for
        descriptor-only phases
    acceptance:
      - emits todos with stable id planSlug colon phase id; content uses
        done/total and summary or title when rollups exist and em-dash when
        descriptor-only; only current active phase is in_progress; empty focus
        emits empty array; CLI prints JSON exit 0
    verifier:
      kind: shell
      command: node --test tests/project-session-todos.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/project-session-todos.js
    summary: Implementar helper e CLI
    weight: 1
    signal: verifier
  - id: T-002
    title: Testes golden do helper
    description: Testes golden do helper
    status: pending
    lastUpdated: 2026-07-24T19:44:51.577Z
    scopeBoundary:
      - do not depend on a live Grok session; do not use the network
    acceptance:
      - fixture F0 2 of 5 active and F1 pending produces correct content and
        statuses; descriptor-only F2 uses em-dash total; no active plan emits
        empty list; paused phase maps to pending with paused suffix
    verifier:
      kind: shell
      command: node --test tests/project-session-todos.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: tests/project-session-todos.test.js
    summary: Testes golden do helper
    weight: 1
    signal: verifier
parked: []
emerged: []
summary: Helper + testes do contrato canônico (id, label, status, paused, merge)
planTitle: Projeção de fases do project no TODO do Grok
planActive: true
current: true
---
# Narrative / notes

Initiative for phase **F1 — Helper determinístico de projeção**.

## Session handoff
- **Narrative:** F1 phase-start package ratified with BI spine; materialize Mode B publishing initiative. Automate host will build work-order and spawn fresh phase writer.
- **Decision log:** Operator ratify F1 + T-002 verifier re-spec (node --test tests/project-session-todos.test.js).
- **Single nextAction:** spawn fresh writer after ratify (work-order + lease)
- **Verbatim state:** initiative .atomic-skills/projects/atomic-skills/grok-phase-todo-projection/phases/f1-helper-deterministico-de-projecao.md; tasks T-001 T-002 SPEC with verifiers; businessIntent complete.
- **Uncommitted changes:** (post-materialize)
