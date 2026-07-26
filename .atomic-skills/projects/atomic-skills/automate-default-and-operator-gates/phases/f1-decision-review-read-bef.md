---
schemaVersion: "0.1"
slug: automate-default-and-operator-gates-f1-decision-review-read-bef
title: Decision-review present-before-PASS + AskUserQuestion-only hardgates
goal: Operator always sees the decision package before PASS/FAIL; under automate
  every operator hardgate uses AskUserQuestion options only — free-text token
  recovery is forbidden; decline re-Asks or STOPs.
summary: Package present-before-PASS + canal AskUserQuestion-only em hardgates.
status: active
branch: plan/automate-default-and-operator-gates
started: 2026-07-26T22:31:25.506Z
lastUpdated: 2026-07-26T23:17:54.195Z
nextAction: Re-open decision-review AskUserQuestion F1 WITH package body in same
  turn (PASS|FAIL), then phase-done
parentPlan: automate-default-and-operator-gates
phaseId: F1
businessIntent:
  value: Package present-before-PASS + canal AskUserQuestion-only (sem free-text)
    para hardgates de operador sob automate.
  workflow: TDD package builder → gate machine present evidence →
    prosa/antipatterns AskUserQuestion-only + decline re-Ask → matriz
    continue/ratify/disposition/stamp; greps F1-G*.
  rules: Agents never write PASS; present package body no mesmo turno do
    AskUserQuestion PASS|FAIL; decline re-Ask (bounded) ou STOP (nunca
    free-text); session default + stamp alimentam gates; host-thin Iron Law
    intact.
  outOfScope: F2 intent-vs-delivered; F3 dogfood checklist full; F4 authenticity
    floors; Lekto product; forçar widget fora de AskUserQuestion.
  doneWhen: tests package green; present-before-PASS machine; AskUserQuestion-only
    + free-text ban greppable; F1-G1/G2/G3 met.
tasksDone: 4
tasksTotal: 4
gatesMet: 3
gatesTotal: 3
weightDone: 8
weightTotal: 8
exitGates:
  - id: F1-G1
    description: Decision package unit tests pass.
    status: met
    verifier:
      kind: shell
      command: node --test tests/decision-review-package.test.js
      expectExitCode: 0
    metAt: 2026-07-26T22:46:27.662Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-26T22:46:27.662Z
      verifiedCommit: 8879297ae66517a51f9c5af952b67aed95b8ddb3
      passed: true
      exitCode: 0
      outputSummary: F1-G1 green after F1 merge re-verify
    verifierLabel: "shell: node --test tests/decision-review-package.test.js"
    evidenceSummary: passed · 2026-07-26
  - id: F1-G2
    description: Present-before-PASS + package evidence mandated in prose/gates.
    status: met
    verifier:
      kind: shell
      command: rg -n 'read-before-PASS|packagePresented|decision package'
        skills/shared/implement-decision-log.md
        skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    metAt: 2026-07-26T22:46:27.662Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-26T22:46:27.662Z
      verifiedCommit: 8879297ae66517a51f9c5af952b67aed95b8ddb3
      passed: true
      exitCode: 0
      outputSummary: F1-G2 green after F1 merge re-verify
    verifierLabel: "shell: rg -n 'read-before-PASS|packagePresented|decision package' …"
    evidenceSummary: passed · 2026-07-26
  - id: F1-G3
    description: AskUserQuestion-only + free-text ban + decline path greppable.
    status: met
    verifier:
      kind: shell
      command: rg -n 'AskUserQuestion|free-text|re-Ask|operator-continue'
        skills/shared/implement-decision-log.md
        skills/shared/implement-automate-maestro.md
        skills/shared/implement-antipatterns.md skills/core/implement.md
      expectExitCode: 0
    metAt: 2026-07-26T22:46:27.662Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-26T22:46:27.662Z
      verifiedCommit: 8879297ae66517a51f9c5af952b67aed95b8ddb3
      passed: true
      exitCode: 0
      outputSummary: F1-G3 green after F1 merge re-verify
    verifierLabel: "shell: rg -n 'AskUserQuestion|free-text|re-Ask|operator-continue' …"
    evidenceSummary: passed · 2026-07-26
stack:
  - id: 1
    title: Decision-review present-before-PASS + AskUserQuestion-only hardgates
    type: task
    openedAt: 2026-07-26T22:31:25.506Z
tasks:
  - id: T-001
    title: Decision package builder
    summary: Helper puro que monta o package do decision log para o host apresentar.
    status: done
    lastUpdated: 2026-07-26T22:45:39.054Z
    scopeBoundary:
      - Do not stamp decisionReview PASS from this helper. No network I/O.
    acceptance:
      - it - Helper builds package with phaseId path entries empty flag and
        summaryMarkdown from listDecisions input.; it - Each entry exposes
        category decision why impact evidencePath.; it - Empty log yields empty
        true and explicit no-decisions banner text.; it - Unit tests cover
        non-empty and empty packages.
    verifier:
      kind: shell
      command: node --test tests/decision-review-package.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/decision-review-package.js
      - kind: file
        path: tests/decision-review-package.test.js
      - kind: file
        path: src/decision-log.js
    weight: 2
    closedAt: 2026-07-26T22:45:39.054Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-26T22:45:39.054Z
      verifiedCommit: 8879297ae66517a51f9c5af952b67aed95b8ddb3
      passed: true
      exitCode: 0
      outputSummary: node --test tests/decision-review-package.test.js → pass 6/6
  - id: T-002
    title: Hardgate present then PASS (machine evidence)
    summary: Gate machine exige package apresentado antes do PASS; fail-closed sem
      evidência.
    status: done
    lastUpdated: 2026-07-26T22:45:39.054Z
    scopeBoundary:
      - Agents still never write PASS. Do not auto-PASS on empty package.
    acceptance:
      - it - Fixed order requires host render decision package before PASS ask.;
        it - decisionReview records packagePresentedAt or package present
        evidence under automate.; it - decisionReviewAllowsPhaseDone or
        canRunPhaseDone fails closed without present evidence when automate
        active including no-stamp session default.; it - Antipattern documents
        Ask PASS without listing decisions.
      - it - Dogfood evidence ask-without-package-body
        (reviews/2026-07-26-f0-decision-review-ask-without-package-body.md) is
        treated as FAIL present-before-PASS until package body is in the same
        hardgate turn as PASS/FAIL AskUserQuestion.
    verifier:
      kind: shell
      command: node --test tests/decision-review-gate.test.js && rg -n
        'read-before-PASS|packagePresented|decision package|present'
        skills/shared/implement-decision-log.md
        skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/implement-decision-log.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: src/decision-review-gate.js
      - kind: file
        path: src/automate-orchestrator-gates.js
      - kind: file
        path: tests/decision-review-gate.test.js
    weight: 2
    closedAt: 2026-07-26T22:45:39.054Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-26T22:45:39.054Z
      verifiedCommit: 8879297ae66517a51f9c5af952b67aed95b8ddb3
      passed: true
      exitCode: 0
      outputSummary: node --test tests/decision-review-gate.test.js → pass 28/28 + rg
        present-before-PASS
  - id: T-003
    title: AskUserQuestion-only decision-review + ban free-text recovery
    summary: PASS/FAIL só via AskUserQuestion; decline re-Ask ou STOP; proibido
      pedir digitar PASS no chat.
    status: done
    lastUpdated: 2026-07-26T22:45:39.054Z
    scopeBoundary:
      - Do not force a specific IDE widget beyond AskUserQuestion where
        available.
      - Do not stamp PASS from agent. Do not invent free-text chat recovery
        after decline.
    acceptance:
      - "it - UX documents two-step: present package body then AskUserQuestion
        PASS|FAIL options in the same hardgate turn.; it - Free-text recovery
        (e.g. host asks operator to type decision-review PASS) is forbidden in
        prose and antipatterns.; it - Decline/cancel of AskUserQuestion re-opens
        the same question (bounded) or STOPs with nextAction to re-open
        AskUserQuestion — never chat typing.; it - Single-click PASS without
        package body in the same turn is forbidden."
      - it - Claiming package apresentado without rendering package body in the
        same AskUserQuestion turn is forbidden (dogfood 2026-07-26 screenshot +
        evidence file).
    verifier:
      kind: shell
      command: rg -n 'AskUserQuestion|free-text|type .*PASS|re-Ask|decline'
        skills/shared/implement-decision-log.md
        skills/shared/implement-automate-maestro.md
        skills/shared/implement-antipatterns.md skills/core/implement.md && rg
        -n 'read-before-PASS|packagePresented|decision package'
        skills/shared/implement-decision-log.md
        skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/implement-decision-log.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/shared/implement-antipatterns.md
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: docs/kb/implement-phase-agents-dogfood.md
    weight: 2
    closedAt: 2026-07-26T22:45:39.054Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-26T22:45:39.054Z
      verifiedCommit: 8879297ae66517a51f9c5af952b67aed95b8ddb3
      passed: true
      exitCode: 0
      outputSummary: rg AskUserQuestion|free-text|re-Ask|operator-continue → exit 0
  - id: T-004
    title: Operator hardgate matrix (continue/ratify/disposition/stamp)
    summary: Mesma lei de canal AskUserQuestion-only para continue, ratify,
      disposition e stamp.
    status: done
    lastUpdated: 2026-07-26T22:45:39.054Z
    scopeBoundary:
      - Do not implement product UI outside skill prose + helpers already in
        plan.
      - Do not change durable token semantics (operator-continue, ratify,
        accept|defer|fix, y/N stamp).
    acceptance:
      - it - Maestro lists operator hardgates continue ratify disposition
        decision-review stamp as AskUserQuestion-only.; it - Each maps options
        to durable tokens without free-text recovery.; it - Antipattern exists
        for type token in chat after decline.; it - Dogfood checklist row covers
        exclusive AskUserQuestion channel.
    verifier:
      kind: shell
      command: rg -n 'AskUserQuestion|operator-continue|disposition|free-text|stamp'
        skills/shared/implement-automate-maestro.md
        skills/shared/implement-antipatterns.md skills/core/implement.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/shared/implement-antipatterns.md
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: docs/kb/implement-phase-agents-dogfood.md
    weight: 2
    closedAt: 2026-07-26T22:45:39.054Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-26T22:45:39.054Z
      verifiedCommit: 8879297ae66517a51f9c5af952b67aed95b8ddb3
      passed: true
      exitCode: 0
      outputSummary: rg AskUserQuestion|operator-continue|disposition|free-text|stamp → exit 0
parked: []
emerged: []
planTitle: Automate default + operator gates (decision-review + plan-end intent)
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — present-before-PASS + AskUserQuestion-only**.

## Session handoff

- **Narrative:** F1 code complete (T-001..T-004 done, gates met, eval/lessons/review stamped). Blocked on decision-review PASS with package in same AskUserQuestion turn (declined once — re-ask, no free-text).
- **Decision log:** 5 entries in decisions/F1.jsonl including dogfood + merge + eval/lessons/review.
- **Single nextAction:** Re-open decision-review AskUserQuestion F1 WITH package body in same turn (PASS|FAIL), then phase-done
- **Verbatim state:** HEAD $(git rev-parse --short HEAD 2>/dev/null); cursor G; canRunPhaseDone needs decisionReview with packagePresentedAt.
- **Uncommitted changes:** checkpoint after this save.


## Dogfood evidence

- `.atomic-skills/reviews/2026-07-26-f0-decision-review-ask-without-package-body.md`

