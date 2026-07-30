---
schemaVersion: "0.1"
slug: brainstorm-hardening-f0-skill-rewrite-and-lazy-assets
title: Skill rewrite and lazy assets
summary: "Reescreve brainstorm com entrevista, research e debate always + assets lazy"
goal: Multi-phase brainstorm always runs interview then repo research digest
  then debate --gate then user ratify then write then critic; kill skip ladder;
  thin skill body plus brainstorm-assets.
status: active
branch: plan/brainstorm-hardening
started: 2026-07-30T13:42:45.458Z
lastUpdated: 2026-07-30T13:42:45.458Z
nextAction: "Start T-001: — Author brainstorm-assets lazy pack"
parentPlan: brainstorm-hardening
phaseId: F0
businessIntent:
  value: "Operador e agente não pulam entrevista/debate: multi-phase brainstorm
    deixa de convergir cedo e materializa design com escopo ratificado"
  workflow: T-001 templates lazy; T-002 brainstorm.md always
    interview+research+debate; T-003 project-create-plan Stage 2 + tests
  rules: Sem always-debate no adopt/ad-hoc; skill thin + assets; não implementar
    detectors F2 nesta fase
  outOfScope: "Fora: expandir lint-design REQUIRED, design-gates JSON,
    find-missing/weak, Stage 8 review-plan, research web, technique BMAD"
  doneWhen: brainstorm sem skip-ladder + debate --gate + brainstorm-assets existe;
    project.test.js e Stage 2 text verdes
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-F0-1
    description: brainstorm.md has no skip-ladder phrase and always-debate plus
      interview plus research steps are present; brainstorm-assets dir exists
    status: pending
    verifier:
      kind: shell
      command: "! rg -q 'Run a panel ONLY when|skip the panel|skip straight to B2|skip straight to B3' skills/core/brainstorm.md && rg -q 'debate --gate' skills/core/brainstorm.md && rg -q 'Interview|entrevista' skills/core/brainstorm.md && rg -q 'research-digest|B0b' skills/core/brainstorm.md && test -d skills/shared/brainstorm-assets && test -f skills/shared/brainstorm-assets/interview.md"
  - id: G-F0-2
    description: project-create-plan Stage 2 text matches always-debate contract and project tests assert it
    status: pending
    verifier:
      kind: shell
      command: "! rg -q 'only when ≥2 viable approaches AND|Run a panel ONLY when' skills/shared/project-assets/project-create-plan.md && rg -q 'debate --gate|Interview|interview' skills/shared/project-assets/project-create-plan.md && rg -q 'always|Interview|debate --gate|brainstorm' tests/project.test.js && node --test tests/project.test.js"
stack:
  - id: 1
    title: Skill rewrite and lazy assets
    type: task
    openedAt: 2026-07-30T13:42:45.458Z
tasks:
  - id: T-001
    title: Author brainstorm-assets lazy pack
    summary: "Cria templates lazy de entrevista, research e process-receipt"
    weight: 1
    status: pending
    lastUpdated: 2026-07-30T13:42:45.458Z
    scopeBoundary:
      - do not rewrite skills/core/brainstorm.md process body in this task; do
        not touch review-plan or debate gate-mode beyond cross-links
    acceptance:
      - interview.md has HALT questions and proof-of-work ban on bare ok/yes;
        research.md names research-digest.md path and weak-digest bars;
        process-receipt.md names interviewAccepted field
    verifier:
      kind: shell
      command: test -f skills/shared/brainstorm-assets/interview.md && test -f
        skills/shared/brainstorm-assets/research.md && test -f
        skills/shared/brainstorm-assets/process-receipt.md && rg -q
        'proof-of-work|Interview|entrevista'
        skills/shared/brainstorm-assets/interview.md && rg -q 'research-digest'
        skills/shared/brainstorm-assets/research.md && rg -q 'interviewAccepted'
        skills/shared/brainstorm-assets/process-receipt.md
    outputs:
      - kind: file
        path: skills/shared/brainstorm-assets/interview.md
      - kind: file
        path: skills/shared/brainstorm-assets/research.md
      - kind: file
        path: skills/shared/brainstorm-assets/process-receipt.md
  - id: T-002
    title: Rewrite brainstorm.md process (always interview + research + debate)
    summary: "Reescreve brainstorm.md: interview → research → debate always"
    weight: 3
    status: pending
    lastUpdated: 2026-07-30T13:42:45.458Z
    scopeBoundary:
      - do not implement find-missing-design-process.js here; do not change
        Stage 8 review-plan; do not force debate on adopt or ad-hoc
    acceptance:
      - B0 Interview HARD before research/debate; B0b research-digest required;
        B1 always debate --gate; skip-ladder phrase Run a panel ONLY when is
        gone; red-flags cover skip-interview and empty digest;
        docs/skills/brainstorm.md summarizes new flow
    verifier:
      kind: shell
      command: rg -q 'Interview|entrevista|B0' skills/core/brainstorm.md && rg -q
        'debate --gate|debate.*--gate' skills/core/brainstorm.md && ! rg -q 'Run
        a panel ONLY when' skills/core/brainstorm.md && rg -q
        'research-digest|B0b' skills/core/brainstorm.md && rg -q
        'brainstorm-assets' skills/core/brainstorm.md && rg -q
        'Interview|debate|lint-design' docs/skills/brainstorm.md
    outputs:
      - kind: file
        path: skills/core/brainstorm.md
      - kind: file
        path: docs/skills/brainstorm.md
  - id: T-003
    title: Point create-plan Stage 2 at new brainstorm contract
    summary: "Atualiza Stage 2 do create-plan e testes de contrato"
    weight: 2
    status: pending
    lastUpdated: 2026-07-30T13:42:45.458Z
    scopeBoundary:
      - do not implement Stage 4 receipt scripts in this task (F2 owns that);
        only Stage 2 DESIGN wording and tests that pin the contract
    acceptance:
      - Stage 2 no longer says debate only when two viable approaches AND
        expensive-to-reverse; describes interview plus research plus always
        debate --gate; tests/project.test.js still assert
        atomic-skills:brainstorm and lint-design.js and reject
        superpowers:brainstorm
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
      - kind: file
        path: tests/project.test.js
parked: []
emerged: []
---

# Narrative / notes

Initiative for phase **F0 — Skill rewrite and lazy assets**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
