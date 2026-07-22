---
schemaVersion: "0.1"
slug: materialize-spec-quality-guards-f0-spine-quality-lint-skill-ux
title: Spine quality lint + skill UX (P0)
goal: Detector HARD de qualidade da spine + wiring em materialize e new-plan F0
  + skill proof-of-work; golden tests PT/EN.
status: active
branch: plan/materialize-spec-quality-guards
started: 2026-07-22T10:42:01.913Z
lastUpdated: 2026-07-22T10:49:52.589Z
nextAction: Run phase-done for F0 (exit gates), then materialize F1 with
  businessIntent + dogfood quality detector
parentPlan: materialize-spec-quality-guards
phaseId: F0
businessIntent:
  value: Fechar R1 com lint HARD de qualidade da spine e UX proof-of-work para que
    materialize e new-plan F0 nao ativem fase com intencao generica.
  workflow: Operador preenche spine → detector de presenca → detector de qualidade
    → fase ativa para implement.
  rules: Zero LLM no path critico; presenca e qualidade sao gates separados; fail
    closed; operador e autoridade da spine.
  outOfScope: Fingerprint R3, SPEC smoke/overlap/age R2, e analytics D9 — entregas
    das fases F1–F3, nao desta F0.
  doneWhen: find-weak-business-intent testes verdes e skills
    materialize/create-plan citam o detector e o proof-of-work
    anti-preenchimento.
tasksDone: 3
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: F0-G1
    description: find-weak-business-intent golden tests pass
    status: pending
    verifier:
      kind: shell
      command: node --test tests/find-weak-business-intent.test.js
  - id: F0-G2
    description: materialize and create-plan wire quality detector
    status: pending
    verifier:
      kind: shell
      command: rg -n 'find-weak-business-intent'
        skills/shared/project-assets/project-materialize.md
        skills/shared/project-assets/project-create-plan.md
stack:
  - id: 1
    title: Spine quality lint + skill UX (P0)
    type: task
    openedAt: 2026-07-22T10:42:01.913Z
tasks:
  - id: T-001
    title: Detector find-weak-business-intent
    status: done
    lastUpdated: 2026-07-22T10:48:54.715Z
    scopeBoundary:
      - Do not change presence-only contract of find-missing-business-intent.js
        beyond clear composition. Do not call LLM. Do not mutate state files.
    acceptance:
      - it - script reports first quality failure per surface plan descriptor
        and initiative.; it - exit 0 on strong-spine fixtures and exit 1 on
        documented weak-spine fixtures.; it - ban-list includes soft-language
        tokens aligned with docs/kb/code-quality-gates.md G2.
    verifier:
      kind: shell
      command: node --test tests/find-weak-business-intent.test.js
    outputs:
      - kind: file
        path: scripts/find-weak-business-intent.js
      - kind: file
        path: tests/find-weak-business-intent.test.js
    summary: Script detector de spine fraca com fixtures strong/weak
    weight: 3
    closedAt: 2026-07-22T10:48:54.715Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-22T10:48:54.715Z
      passed: true
      command: node --test tests/find-weak-business-intent.test.js
      outputSummary: 9/9 pass; dogfood find-weak on own plan exit 0
  - id: T-002
    title: Wire quality lint into materialize and new plan F0
    status: done
    lastUpdated: 2026-07-22T10:49:52.589Z
    scopeBoundary:
      - Do not auto-fill businessIntent. Do not make quality lint WARN-only. Do
        not edit materialize-state.js in this task.
    acceptance:
      - it - project-materialize invokes find-weak-business-intent after
        presence detector.; it - project-create-plan Stage 6 F0 gate cites the
        same detector.; it - failure message tells operator to rewrite fields
        not approve-anyway without test override.
    verifier:
      kind: shell
      command: rg -n 'find-weak-business-intent'
        skills/shared/project-assets/project-materialize.md
        skills/shared/project-assets/project-create-plan.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-materialize.md
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
      - kind: file
        path: skills/core/project.md
    summary: Encaixa find-weak-business-intent no fluxo materialize e create-plan
    weight: 2
    closedAt: 2026-07-22T10:49:52.589Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-22T10:49:52.589Z
      passed: true
      command: rg -n 'find-weak-business-intent'
        skills/shared/project-assets/project-materialize.md
        skills/shared/project-assets/project-create-plan.md
      outputSummary: grep hits present; quality HARD + proof-of-work prose landed
  - id: T-003
    title: Skill UX proof-of-work anti-prefill
    status: done
    lastUpdated: 2026-07-22T10:49:52.589Z
    scopeBoundary:
      - Do not add LLM detector. Do not change businessIntent schema keys.
    acceptance:
      - it - BusinessIntent Gate states agent must not paste draft values into
        the five user fields.; it - generic ok/yes/do-it re-prompts like
        ratify.; it - derived array remains ungated.
    verifier:
      kind: shell
      command: rg -n 'proof-of-work|pre-fill|approve-anyway'
        skills/shared/project-assets/project-materialize.md
        skills/shared/project-assets/project-create-plan.md
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-materialize.md
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
    summary: Documenta anti-preenchimento e ok-generico != aceite da spine
    weight: 2
    closedAt: 2026-07-22T10:49:52.589Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-22T10:49:52.589Z
      passed: true
      command: rg -n 'proof-of-work|pre-fill|approve-anyway'
        skills/shared/project-assets/project-materialize.md
        skills/shared/project-assets/project-create-plan.md
      outputSummary: grep hits present; quality HARD + proof-of-work prose landed
parked: []
emerged: []
summary: Lint HARD de qualidade da spine + UX proof-of-work no materialize/new-plan F0
---
# Narrative / notes

Initiative for phase **F0 — Spine quality lint + skill UX (P0)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_


## Session handoff
- **Narrative:** F0 complete (T-001..T-003). Detector + skill wiring + proof-of-work UX. Dogfood: own F0 spine passes find-weak-business-intent.
- **Decision log:** Quality is HARD after presence; no approve-anyway; agent must not pre-fill spine fields.
- **Single nextAction:** phase-done F0 (run exit gate verifiers + review), then materialize F1.
- **Verbatim state:** `rg -n find-weak-business-intent skills/shared/project-assets/project-materialize.md skills/shared/project-assets/project-create-plan.md` hits; T-001 tests 9/9.
- **Uncommitted changes:** clean after state checkpoint.

