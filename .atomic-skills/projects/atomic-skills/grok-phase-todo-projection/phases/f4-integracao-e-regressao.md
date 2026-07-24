---
schemaVersion: "0.1"
slug: grok-phase-todo-projection-f4-integracao-e-regressao
title: Integração e regressão
goal: Suite de regressão verde; parity de install intacta; checklist dogfood.
status: active
branch: plan/grok-phase-todo-projection
started: 2026-07-24T21:01:28.301Z
lastUpdated: 2026-07-24T21:11:29.494Z
nextAction: operator decision-review PASS and F4-G2 dogfood PASS (then phase-done)
parentPlan: grok-phase-todo-projection
phaseId: F4
businessIntent:
  value: A entrega fecha com regressão determinística verde e dogfood documentado
    (seed → after-done → phase-done → reseed pós-compact), sem segundo SoT e sem
    PASS inventado de gate manual.
  workflow: T-001 endurece/expõe regressão package (unit + path de install/render
    se no escopo) → T-002 documenta checklist dogfood no KB → F4-G1 shell +
    F4-G2 PASS manual do operador.
  rules: Não inventar PASS sem run do operador; checklist só no KB (sem segundo
    helper); não mutar journal de install salvo se arquivo instalado novo exigir
    reverse; preferir scripts em package-root sem superfície de install.
  outOfScope: Novo helper de projeção; multi-IDE mirror; write em plan.json da
    sessão; fechar task via TODO; painel nativo Grok; T-00N no scaffold.
  doneWhen: node --test nos testes de sessão/transitions (e parity install/render
    se no G1) exit 0; checklist dogfood no KB com labels de identidade; Henry
    PASS em F4-G2.
startedCommit: 243a7ffcaaf72d1716e9fc7cca494e43a5d2b374
tasksDone: 2
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 2
weightTotal: 2
exitGates:
  - id: F4-G1
    description: New unit tests pass in isolation
    status: pending
    verifier:
      kind: shell
      command: node --test tests/project-session-todos.test.js
        tests/transition-emits.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/project-session-todos.test.js tests/trans…"
  - id: F4-G2
    description: Manual HARD Henry confirms dogfood checklist completed once on Grok
    status: pending
    verifier:
      kind: manual
      description: Operator PASS after one real session saw phase scaffold update
    verifierLabel: manual
stack:
  - id: 1
    title: Integração e regressão
    type: task
    openedAt: 2026-07-24T21:01:28.301Z
tasks:
  - id: T-001
    title: Regressão package
    description: Regressão package
    status: done
    lastUpdated: 2026-07-24T21:09:06.859Z
    scopeBoundary:
      - do not change install journal effects unless new installed file requires
        reverse; prefer package-root scripts with no install surface change
    acceptance:
      - new tests run under node --test; install-uninstall-roundtrip green when
        no new install files; existing suite not broken by prose pointers
    verifier:
      kind: shell
      command: node --test tests/project-session-todos.test.js
        tests/transition-emits.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: package.json
      - kind: file
        path: tests/project-session-todos.test.js
      - kind: file
        path: tests/transition-emits.test.js
    summary: Regressão package
    weight: 1
    closedAt: 2026-07-24T21:09:06.859Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T21:09:06.859Z
      verifiedCommit: dcedd05be977cf5d9dd1a4020ddb2b2c8a968c2f
      passed: true
      exitCode: 0
      outputSummary: >-
        ✔ formatPhaseContent: materialized uses done/total and summary
        (0.80225ms)

        ✔ formatPhaseContent: descriptor-only uses em-dash total + not
        materialized (0.096ms)

        ✔ formatPhaseContent: paused suffix (0.084ms)

        ✔ mapPhaseTodoStatus: paused wins → pending + paused flag (0.485708ms)

        ✔ mapPhaseTodoStatus: current → in_progress; done → completed; else
        pending (0.103875ms)

        ✔ mapPhaseTodoStatus: done|archived beats stale currentPhase → completed
        (0.129416ms)

        ✔ stableTodoId is planSlug colon phase id (0.08
    signal: verifier
  - id: T-002
    title: Dogfood checklist e close
    description: Dogfood checklist e close
    status: done
    lastUpdated: 2026-07-24T21:09:08.685Z
    scopeBoundary:
      - do not invent PASS without operator run; checklist only no second helper
    acceptance:
      - checklist lists seed after-done counter bump phase-done advance and
        reseed after compact; documents expected label with identity text not
        only counts
    verifier:
      kind: shell
      command: rg -n 'seed|after-done|phase-done|reseed|compact'
        docs/kb/grok-phase-todo-projection.md && rg -n 'summary|title|F0 \('
        docs/kb/grok-phase-todo-projection.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/kb/grok-phase-todo-projection.md
    summary: Dogfood checklist e close
    weight: 1
    closedAt: 2026-07-24T21:09:08.685Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T21:09:08.685Z
      verifiedCommit: dcedd05be977cf5d9dd1a4020ddb2b2c8a968c2f
      passed: true
      exitCode: 0
      outputSummary: >-
        22:| Reseed / merge rules for session checklist tool | Using todo
        completion to close phase/task (GATE-R2 stays) |

        82:   `done` / `phase-done` — the only writers of plan SoT).

        90:to the plan; GATE-R2 stays on verifiers / `done` / `phase-done`.

        104:## Reseed and merge rules

        108:| Reseed when pickFocus has a **winner** (anchored active plan)
        after `refresh-state` / implement start / full phase-scaffold write |
        `merge: false` | **Full replace** so only phase todos remain |

        109:| Empty focus / pause
    signal: verifier
parked: []
emerged: []
summary: Regressão unit + install parity Grok + dogfood checklist
planTitle: Projeção de fases do project no TODO do Grok
planActive: true
current: true
---
# F4

## Session handoff
- **Narrative:** F4 T-001/T-002 done; evaluationGate passed; plan F4-G1 full suite exit 0. Lease cleared.
- **Decision log:** evaluation pass; medium plan-vs-initiative G1 drift mitigated by full suite green.
- **Single nextAction:** operator decision-review PASS and F4-G2 dogfood PASS (then phase-done)
- **Verbatim state:** HEAD=b43a83c0482f7f0871e60693c01b21274c9fc7d4; evaluationGate at b43a83c0482f7f0871e60693c01b21274c9fc7d4; lease missing; F4-G2 pending
- **Uncommitted changes:** evaluationGate + decisions + handoff

