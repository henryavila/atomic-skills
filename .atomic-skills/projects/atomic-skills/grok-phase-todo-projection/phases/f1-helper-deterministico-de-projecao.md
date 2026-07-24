---
schemaVersion: "0.1"
slug: grok-phase-todo-projection-f1-helper-deterministico-de-projecao
title: Helper determinístico de projeção
goal: Script zero-token que, dado o repo, emite o array de session todos das
  fases do plan pickFocus com label canônico e statuses corretos.
status: active
branch: plan/grok-phase-todo-projection
started: 2026-07-24T19:44:51.577Z
lastUpdated: 2026-07-24T19:51:43.220Z
nextAction: Run evaluation agent for F1 then stamp evaluationGate; await
  decision-review operator PASS before phase-done
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
gatesMet: 0
gatesTotal: 2
weightDone: 2
weightTotal: 2
exitGates:
  - id: F1-G1
    description: Helper tests pass
    status: pending
    verifier:
      kind: shell
      command: node --test tests/project-session-todos.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/project-session-todos.test.js"
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
    verifierLabel: 'shell: node scripts/project-session-todos.js --json . | node -e "l…'
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
    lastUpdated: 2026-07-24T19:51:38.683Z
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
    closedAt: 2026-07-24T19:51:38.683Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T19:51:38.683Z
      verifiedCommit: ae49792ea496c770499bf22e8c4c7f96b5216348
      passed: true
      exitCode: 0
      outputSummary: >
        1042ms)

        ✔ no active plan emits empty list (5.770208ms)

        ✔ bare repo (no .atomic-skills) emits empty list (0.74875ms)

        ✔ paused phase maps to pending with · paused suffix (6.246458ms)

        ✔ paused current phase is pending (not in_progress) with suffix
        (5.560709ms)

        ✔ runCli --json prints payload shape (32.461875ms)

        ✔ CLI smoke: node scripts/project-session-todos.js --json <fixture> exit
        0 (309.311125ms)

        ℹ tests 13

        ℹ suites 0

        ℹ pass 13

        ℹ fail 0

        ℹ cancelled 0

        ℹ skipped 0

        ℹ todo 0

        ℹ duration_ms 705.298875
  - id: T-002
    title: Testes golden do helper
    description: Testes golden do helper
    status: done
    lastUpdated: 2026-07-24T19:51:41.414Z
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
    closedAt: 2026-07-24T19:51:41.414Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T19:51:41.414Z
      verifiedCommit: b56e4fac38fd09424cfbc50d51a4a3ca4ffd5c3b
      passed: true
      exitCode: 0
      outputSummary: >
        98584ms)

        ✔ no active plan emits empty list (2.510458ms)

        ✔ bare repo (no .atomic-skills) emits empty list (0.355958ms)

        ✔ paused phase maps to pending with · paused suffix (9.582166ms)

        ✔ paused current phase is pending (not in_progress) with suffix
        (3.727875ms)

        ✔ runCli --json prints payload shape (36.650583ms)

        ✔ CLI smoke: node scripts/project-session-todos.js --json <fixture> exit
        0 (297.6905ms)

        ℹ tests 13

        ℹ suites 0

        ℹ pass 13

        ℹ fail 0

        ℹ cancelled 0

        ℹ skipped 0

        ℹ todo 0

        ℹ duration_ms 665.794458
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
- **Narrative:** F1 T-001 and T-002 both closed after post-merge node --test (13/13). Helper+tests on plan branch. Awaiting evaluation + decision-review before phase-done.
- **Decision log:** exclusive SHAs; merge writer; GATE-R2 evidence on both tasks.
- **Single nextAction:** Run evaluation agent for F1 then stamp evaluationGate; await decision-review operator PASS before phase-done
- **Verbatim state:** T-002 verifiedCommit=b56e4fac38fd09424cfbc50d51a4a3ca4ffd5c3b; node --test tests/project-session-todos.test.js exit 0
- **Uncommitted changes:** (checkpoint pending)
