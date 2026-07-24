---
schemaVersion: "0.1"
slug: grok-phase-todo-projection-f0-contrato-de-projecao-e-wire-up-de
title: Contrato de projeção e wire-up de prosa
goal: "Congelar em KB greppable: label F0 (n/N)—summary|title, SoT order,
  paused, merge/reseed, anti-proc, Grok-local; SessionStart = hint only."
status: done
branch: plan/grok-phase-todo-projection
started: 2026-07-24T18:38:57.644Z
lastUpdated: 2026-07-24T19:42:03.616Z
nextAction: present phase-start package for F1 validate-only
parentPlan: grok-phase-todo-projection
phaseId: F0
businessIntent:
  value: Em sessões Grok o agente mantém no checklist nativo o trilho de fases do
    plan com progresso e o que cada fase faz, sem duplicar SoT nem fechar task
    via TODO.
  workflow: Contrato em prosa → helper determinístico a partir do YAML → lint de
    transitions → wire implement/reseed → dogfood.
  rules: SoT só em .atomic-skills; label F0 (n/N) — summary|title; um in_progress
    = fase corrente; reseed pós-compact; projeção só Grok; nunca todo completed
    sem phase done.
  outOfScope: Tasks T-00N no TODO; painel nativo Grok; write em plan.json da
    sessão; multi-IDE mirror; MCP project-state.
  doneWhen: KB+compat com contrato greppable e Henry PASS no gate manual F0-G2.
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
weightDone: 2
weightTotal: 2
exitGates:
  - id: F0-G1
    description: KB freezes label summary|title, SoT order, paused, anti-proc, Grok-local
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

        6:`refresh-state` / `emit-focus` — this doc is the **Grok session-todo
        consumer**

        10:producer+consumer); `docs/kb/grok-build-compatibility.md` (Grok-local
        install and

        21:| **anti-proc**: phase scaffold vs `proc:*` while plan anchored |
        Multi-IDE mirror (Claude/Codex/Cursor todos) |

        22:| Reseed / merge rules for session checklist tool | Using todo
        completion to close phase/task (GATE-R2 stays) |

        24:**Grok-local only.
    verifierLabel: "shell: test -f docs/kb/grok-phase-todo-projection.md && rg -n 'sum…"
    evidenceSummary: passed · 2026-07-24
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
    verifierLabel: manual
    evidenceSummary: passed · 2026-07-24
stack:
  - id: 1
    title: Contrato de projeção e wire-up de prosa
    type: task
    openedAt: 2026-07-24T18:38:57.644Z
tasks:
  - id: T-001
    title: Contrato em KB e design receipt
    description: Documentar o contrato (fases-only, label, SoT, paused, reseed,
      merge rules) e cross-link no design de statusline.
    status: done
    lastUpdated: 2026-07-24T19:25:38.510Z
    scopeBoundary:
      - do not implement scripts/project-session-todos.js; do not change
        meta/schemas/plan.schema.json; do not claim host auto-reads focus.json
    acceptance:
      - KB names canonical label with summary or title fallback; KB states SoT
        order mutate then refresh-state then helper then todo_write; KB states
        paused maps to pending with suffix; statusline-focus-integration.md
        cross-links Grok session-todo consumer
    verifier:
      kind: shell
      command: rg -n 'summary|title|refresh-state|todo_write|paused'
        docs/kb/grok-phase-todo-projection.md && rg -n
        'grok-phase-todo|session.todo|todo_write'
        docs/design/statusline-focus-integration.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/kb/grok-phase-todo-projection.md
      - kind: file
        path: docs/design/statusline-focus-integration.md
    summary: KB do contrato de projeção + link no statusline design
    weight: 1
    closedAt: 2026-07-24T19:25:38.510Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T19:25:38.510Z
      verifiedCommit: b13fcb694e66963b04381077a55d1590a441f623
      passed: true
      exitCode: 0
      outputSummary: |
        mmary` / `title` fallback; descriptor-only `(—)` + `not materialized`
        136:- order: mutate → `refresh-state` → helper → `todo_write`
        137:- `paused` → todo `pending` + suffix ` · paused`
        302:## 6. Related consumer — Grok session-todo projection
        306:**session todos** via the agent tool `todo_write` (phase scaffold only — not tasks
        311:- [`docs/kb/grok-phase-todo-projection.md`](../kb/grok-phase-todo-projection.md)
        314:(`scripts/project-session-todos.js`); it does **not** replace the claudebar chip
  - id: T-002
    title: Wire-up Grok em compat e project note
    description: Registrar projeção Grok-local e ponteiro no router project.
    status: done
    lastUpdated: 2026-07-24T19:27:08.433Z
    scopeBoundary:
      - do not implement helper or lint changes; do not add Claude or Codex todo
        tools; do not dump full procedure into resident router
    acceptance:
      - grok-build-compatibility.md documents phase scaffold as Grok-local;
        project.md points to helper or detail contract; text forbids proc
        scaffold competing with phase scaffold while plan anchored
    outputs:
      - kind: file
        path: docs/kb/grok-build-compatibility.md
      - kind: file
        path: skills/core/project.md
    summary: Nota Grok-compat e ponteiro no project router
    weight: 1
    verifier:
      kind: shell
      command: rg -n 'Grok-local|phase scaffold|todo_write|session.todo'
        docs/kb/grok-build-compatibility.md && rg -n
        'project-session-todos|session.todo|phase scaffold|todo_write'
        skills/core/project.md
      expectExitCode: 0
    closedAt: 2026-07-24T19:27:08.433Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T19:27:08.433Z
      verifiedCommit: a474923ffa62383097fc826e96c4d0cf1448447f
      passed: true
      exitCode: 0
      outputSummary: >
        affold (session todos):** after focus-moving mutations, follow SoT order
        in `docs/kb/grok-phase-todo-projection.md` — mutate → `refresh-state` →
        helper `scripts/project-session-todos.js` → `todo_write`. Session todos
        are a **Grok-local** phase scaffold only (not `T-00N`). While a plan is
        anchored, a process scaffold (`proc:*`) must **not** compete with the
        phase scaffold; reseed details live in that KB +
        `docs/kb/grok-build-compatibility.md` §8 — do not dump the full
        procedure into this router.
parked: []
emerged: []
summary: "Contrato greppable: label, SoT, paused, reseed skill-level,
  SessionStart só hint"
planTitle: Projeção de fases do project no TODO do Grok
planActive: true
---

# Narrative / notes

Initiative for phase **F0 — Contrato de projeção e wire-up de prosa**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F0 closed via pure-maestro: tasks done, evaluationGate+decisionReview passed, review-code both + fix1 merged, exit gates met. Plan advanced to F1 descriptor-only. Automate forbids blank-form materialize — next is phase-start package for F1.
- **Decision log:** executionMode automate; T-002 re-spec; package ratify; claim exclusive SHAs; both-review fix1 (anti-proc, helper F1-only pointer, merge/paused policy).
- **Single nextAction:** present phase-start package for F1 validate-only
- **Verbatim state:** currentPhase=F1; F0 status=done; reviewGate.mode=both reviewFile=.atomic-skills/reviews/2026-07-24-f0-grok-phase-todo-projection-both.md; lease missing.
- **Uncommitted changes:** (checkpoint pending)


## Self-review against code-quality gates

- **G1 read-before-claim**: 2 tasks closed with GATE-R2 evidence + post-merge re-verify.
- **G2 soft-language**: completion claims are passed:true evidence.
- **G6 reference-or-strike**: handoff literals are paths/commands.
- **G10 gate-must-be-able-to-fail**: F0-G1 fails if KB missing tokens; F0-G2 fails without operator PASS.
- **CROSS-MODEL REVIEW**: mode both local+codex; receipt .atomic-skills/reviews/2026-07-24-f0-grok-phase-todo-projection-both.md; fix1 merged ae26897.
- **Review gate (G2)**: reviewGate status=passed mode=both at=9cba1ffa27b10da0c9a7646456545510ccbf87eb.
- **Lessons (G1)**: no lessons distilled — clean phase after fix1 (lessonsState: none).
