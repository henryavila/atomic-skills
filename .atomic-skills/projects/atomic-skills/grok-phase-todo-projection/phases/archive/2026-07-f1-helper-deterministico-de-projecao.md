---
schemaVersion: "0.1"
slug: grok-phase-todo-projection-f1-helper-deterministico-de-projecao
title: Helper determinístico de projeção
goal: Script zero-token que, dado o repo, emite o array de session todos das
  fases do plan pickFocus com label canônico e statuses corretos.
status: done
branch: plan/grok-phase-todo-projection
started: 2026-07-24T19:44:51.577Z
lastUpdated: 2026-07-24T20:06:56.316Z
nextAction: present phase-start package for F2 validate-only
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
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
weightDone: 2
weightTotal: 2
exitGates:
  - id: F1-G1
    description: Helper tests pass
    status: met
    verifier:
      kind: shell
      command: node --test tests/project-session-todos.test.js
      expectExitCode: 0
    metAt: 2026-07-24T20:06:56.316Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T20:06:56.316Z
      verifiedCommit: 5fbdf9551dd8f2f610742713ebac83bb458dd34d
      passed: true
      exitCode: 0
      outputSummary: >-
        ✔ formatPhaseContent: materialized uses done/total and summary
        (1.227542ms)

        ✔ formatPhaseContent: descriptor-only uses em-dash total + not
        materialized (0.082083ms)

        ✔ formatPhaseContent: paused suffix (0.074875ms)

        ✔ mapPhaseTodoStatus: paused wins → pending + paused flag (0.5855ms)

        ✔ mapPhaseTodoStatus: current → in_progress; done → completed; else
        pending (0.173667ms)

        ✔ mapPhaseTodoStatus: done|archived beats stale currentPhase → completed
        (0.107708ms)

        ✔ stableTodoId is planSlug colon phase id 
    verifierLabel: "shell: node --test tests/project-session-todos.test.js"
    evidenceSummary: passed · 2026-07-24
  - id: F1-G2
    description: CLI json on repo root exits 0 and prints todos array
    status: met
    verifier:
      kind: shell
      command: node scripts/project-session-todos.js --json . | node -e "let
        d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const
        j=JSON.parse(d); if(!Array.isArray(j.todos)) process.exit(1);
        process.exit(0)})"
      expectExitCode: 0
    metAt: 2026-07-24T20:06:56.316Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T20:06:56.316Z
      verifiedCommit: 5fbdf9551dd8f2f610742713ebac83bb458dd34d
      passed: true
      exitCode: 0
      outputSummary: ""
    verifierLabel: 'shell: node scripts/project-session-todos.js --json . | node -e "l…'
    evidenceSummary: passed · 2026-07-24
stack:
  - id: 1
    title: Helper determinístico de projeção
    type: task
    openedAt: 2026-07-24T19:44:51.577Z
tasks:
  - id: T-001
    title: Implementar helper e CLI
    description: Implementar helper e CLI
    status: done
    lastUpdated: 2026-07-24T19:56:19.186Z
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
    closedAt: 2026-07-24T19:51:38.683Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T20:06:56.316Z
      verifiedCommit: 5fbdf9551dd8f2f610742713ebac83bb458dd34d
      passed: true
      exitCode: 0
      outputSummary: re-anchored post fix2
  - id: T-002
    title: Testes golden do helper
    description: Testes golden do helper
    status: done
    lastUpdated: 2026-07-24T19:56:19.186Z
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
    closedAt: 2026-07-24T19:51:41.414Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T20:06:56.316Z
      verifiedCommit: 5fbdf9551dd8f2f610742713ebac83bb458dd34d
      passed: true
      exitCode: 0
      outputSummary: re-anchored post fix2
parked: []
emerged: []
summary: Helper + testes do contrato canônico (id, label, status, paused, merge)
planTitle: Projeção de fases do project no TODO do Grok
planActive: true
---

# Narrative / notes

Initiative for phase **F1 — Helper determinístico de projeção**.

## Session handoff
- **Narrative:** F1 closed after review-code both + fix2 (empty-focus merge:true no-wipe; status done before current). Plan advances to F2 descriptor-only. Automate: no blank-form materialize.
- **Decision log:** decision-review PASS; fix1 archive; fix2 empty-focus; evaluationGate pass.
- **Single nextAction:** present phase-start package for F2 validate-only
- **Verbatim state:** currentPhase=F2; F1 done; reviewGate.mode=both; HEAD=5fbdf9551dd8f2f610742713ebac83bb458dd34d
- **Uncommitted changes:** (pending)
