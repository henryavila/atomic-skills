---
schemaVersion: "0.1"
slug: skills-restructuring-f0-pente-fino-de-consistencia
title: Pente fino de consistência
goal: corrigir resíduo e drift documental de baixo risco nas skills, sem mudar comportamento.
status: active
branch: null
started: 2026-06-15T13:37:12.477Z
lastUpdated: 2026-06-16T12:22:09Z
nextAction: "All 7 tasks done + F0-G1 met. Run phase-done (review-code phase-diff gate + advance to F1) on user opt-in."
parentPlan: skills-restructuring
phaseId: F0
tasksDone: 7
tasksTotal: 7
gatesMet: 1
gatesTotal: 1
exitGates:
  - id: F0-G1
    description: Suite de validação de skills passa após as correções de pente fino.
    status: met
    metAt: 2026-06-16T12:22:09Z
    verifier:
      kind: shell
      command: npm run validate-skills
      expectExitCode: 0
    verifierLabel: "shell: npm run validate-skills"
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T12:22:09Z
      passed: true
      exitCode: 0
      outputSummary: "✓ All 15 skills valid (schema_version 0.2)"
stack:
  - id: 1
    title: Pente fino de consistência
    type: task
    openedAt: 2026-06-15T13:37:12.477Z
tasks:
  - id: T0.1
    title: Corrigir contagem de stages no create-plan
    status: done
    lastUpdated: 2026-06-16T12:22:09Z
    closedAt: 2026-06-16T12:22:09Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T12:22:09Z
      passed: true
      exitCode: 0
      outputSummary: "grep '9 stages' present + '7 stages' absent in project-create-plan.md"
    summary: "Heading do create-plan: 7→9 stages"
    description: 'Trocar o heading "7 stages" por "9 stages" em project-create-plan.md, que roda Stage 1 a 9. Arquivos: skills/shared/project-assets/project-create-plan.md'
    scopeBoundary:
      - não alterar o corpo dos Stages 1-9, apenas o heading da contagem.
    acceptance:
      - o heading lê "9 stages"
      - nenhuma ocorrência de "7 stages" resta no arquivo.
    verifier:
      kind: shell
      command: grep -q '9 stages' skills/shared/project-assets/project-create-plan.md && ! grep -q '7 stages' skills/shared/project-assets/project-create-plan.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
  - id: T0.2
    title: Completar cheat-sheet de Task com summary e evidence
    status: done
    lastUpdated: 2026-06-16T12:22:09Z
    closedAt: 2026-06-16T12:22:09Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T12:22:09Z
      passed: true
      exitCode: 0
      outputSummary: "Task Optional line cites summary + evidence in skills/core/project.md"
    summary: Cheat-sheet de Task ganha summary e evidence
    description: "Adicionar `summary` e `evidence` à lista de opcionais de Task no Schema quick-reference do router. Arquivos: skills/core/project.md"
    scopeBoundary:
      - apenas a linha de opcionais de Task; não tocar PhaseDescriptor nem ExitCriterion.
    acceptance:
      - a linha de opcionais de Task cita summary e evidence.
    verifier:
      kind: shell
      command: grep -qE 'Task.*Optional:.*summary.*evidence' skills/core/project.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/project.md
  - id: T0.3
    title: Completar cheat-sheet de PhaseDescriptor
    status: done
    lastUpdated: 2026-06-16T12:22:09Z
    closedAt: 2026-06-16T12:22:09Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T12:22:09Z
      passed: true
      exitCode: 0
      outputSummary: "PhaseDescriptor Optional line cites summary, provenance, context"
    summary: Cheat-sheet de PhaseDescriptor ganha summary/provenance/context
    description: "Adicionar `summary`, `provenance`, `context` aos opcionais de PhaseDescriptor no router. Arquivos: skills/core/project.md"
    scopeBoundary:
      - apenas a linha de opcionais de PhaseDescriptor.
    acceptance:
      - a linha de PhaseDescriptor cita summary, provenance e context.
    verifier:
      kind: shell
      command: grep -qE 'PhaseDescriptor.*Optional:.*summary.*provenance.*context' skills/core/project.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/project.md
  - id: T0.4
    title: Anotar campos 0.2 do verifier manual
    status: done
    lastUpdated: 2026-06-16T12:22:09Z
    closedAt: 2026-06-16T12:22:09Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T12:22:09Z
      passed: true
      exitCode: 0
      outputSummary: "manual verifier branch cites demoCommand + fallbackKind"
    summary: Verifier manual anotado com os campos 0.2
    description: "Anotar o branch manual do ExitCriterionVerifier com os opcionais 0.2 (demoCommand, fallbackKind, steps, expected, data). Arquivos: skills/core/project.md"
    scopeBoundary:
      - apenas o branch manual do oneOf de ExitCriterionVerifier.
    acceptance:
      - o branch manual cita demoCommand e fallbackKind.
    verifier:
      kind: shell
      command: grep -q 'demoCommand' skills/core/project.md && grep -q 'fallbackKind' skills/core/project.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/project.md
  - id: T0.5
    title: Corrigir caminho morto do review-code no drift
    status: done
    lastUpdated: 2026-06-16T12:22:09Z
    closedAt: 2026-06-16T12:22:09Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T12:22:09Z
      passed: true
      exitCode: 0
      outputSummary: "no skills/en/ in project-drift.md; atomic-skills:review-code present"
    summary: Caminho morto do review-code no drift vira slug
    description: "Trocar o caminho morto skills/en/core/review-code.md pelo slug atomic-skills:review-code. Arquivos: skills/shared/project-assets/project-drift.md"
    scopeBoundary:
      - apenas a linha que cita o caminho do review-code.
    acceptance:
      - nenhuma ocorrência de "skills/en/" no arquivo
      - o slug atomic-skills:review-code está presente.
    verifier:
      kind: shell
      command: "! grep -q 'skills/en/' skills/shared/project-assets/project-drift.md && grep -q 'atomic-skills:review-code' skills/shared/project-assets/project-drift.md"
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-drift.md
  - id: T0.6
    title: Registrar o gate G9 no registry canônico
    status: done
    lastUpdated: 2026-06-16T12:22:09Z
    closedAt: 2026-06-16T12:22:09Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T12:22:09Z
      passed: true
      exitCode: 0
      outputSummary: "'## G9' heading present in docs/kb/code-quality-gates.md"
    summary: Gate G9 registrado no code-quality-gates
    description: "Adicionar a entrada G9 mutation-kill em code-quality-gates.md, espelhando a definição inline de project-transitions.md. Arquivos: docs/kb/code-quality-gates.md"
    scopeBoundary:
      - apenas adicionar a seção G9; não reescrever G1-G8.
    acceptance:
      - o registry contém um heading G9 mutation-kill.
    verifier:
      kind: shell
      command: grep -qE '^##+ G9' docs/kb/code-quality-gates.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/kb/code-quality-gates.md
  - id: T0.7
    title: Remover referência dangling AIDECK_STATE_DOMAIN
    status: done
    lastUpdated: 2026-06-16T12:22:09Z
    closedAt: 2026-06-16T12:22:09Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T12:22:09Z
      passed: true
      exitCode: 0
      outputSummary: "AIDECK_STATE_DOMAIN absent in project-view.md; AIDECK_BIN present"
    summary: Referência dangling AIDECK_STATE_DOMAIN removida
    description: "Remover AIDECK_STATE_DOMAIN da prosa do project-view.md, mantendo AIDECK_BIN e DASHBOARD_DIR. Arquivos: skills/shared/project-assets/project-view.md"
    scopeBoundary:
      - apenas a frase do step 1 que cita as variáveis; não tocar o bloco CONTRACT.
    acceptance:
      - nenhuma ocorrência de AIDECK_STATE_DOMAIN
      - AIDECK_BIN permanece.
    verifier:
      kind: shell
      command: "! grep -q 'AIDECK_STATE_DOMAIN' skills/shared/project-assets/project-view.md && grep -q 'AIDECK_BIN' skills/shared/project-assets/project-view.md"
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-view.md
parked: []
emerged: []
summary: "Quick-wins de consistência: contagem de stages, caminhos mortos, cheat-sheets e gates."
planTitle: Reestruturação das skills atomic-skills
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Pente fino de consistência**.

## Decisions

- **Routing:** batch opted OUT to Mode 1 (single-threaded inline). Codex lane is ON and all 7 tasks are spec-ready w/ deterministic verifiers, so Mode 2 was the default — but these are one-line doc-consistency edits with pure-`grep` verifiers, and T0.2/T0.3/T0.4 all touch the same file `skills/core/project.md` (non-parallelizable in worktrees). Worktree dispatch overhead would dwarf the work. Operator's prerogative to opt a batch OUT.
- **T0.6 G9 scope:** added only the `## G9 — Mutation-kill` section, mirroring the inline `evidence.mutation` shape from `skills/shared/project-assets/project-transitions.md`. Did NOT touch the rule×skill matrix (scopeBoundary: "apenas adicionar a seção G9") — consistent with how G8 is handled (note, no matrix column).

## Session handoff
- **Narrative:** Phase **F0 — Pente fino de consistência** complete. All 7 tasks (T0.1–T0.7) coded single-threaded inline (Mode 1) and closed through verify-on-done: each task's `grep` verifier ran and passed (exit 0), evidence written. Exit gate **F0-G1** (`npm run validate-skills`) re-run and passing (`✓ All 15 skills valid`). `validate-state` (GATE-R2) green. Phase status still `active` pending the user's `phase-done` opt-in (review-code phase-diff gate + advance to F1 are intrusive — not auto-run).
- **Decision log:** see `## Decisions` above — Mode-1 opt-out rationale; G9 added without matrix edit.
- **Single nextAction:** Run `phase-done` for F0 on user opt-in — it runs the mandatory `atomic-skills:review-code` phase-diff gate over the F0 diff, then advances `plan.md` `currentPhase` F0→F1.
- **Verbatim state:** `npm run validate-skills` → exit 0, `✓ All 15 skills valid (schema_version 0.2)`. `npm run validate-state` → exit 0. Per-task verifiers all exit 0 (T0.1–T0.7). Files changed: `skills/shared/project-assets/project-create-plan.md` (7→9 stages), `skills/core/project.md` (Task/PhaseDescriptor/ExitCriterionVerifier cheat-sheets), `skills/shared/project-assets/project-drift.md` (`atomic-skills:review-code` slug), `docs/kb/code-quality-gates.md` (`## G9 — Mutation-kill`), `skills/shared/project-assets/project-view.md` (dropped `AIDECK_STATE_DOMAIN`).
- **Uncommitted changes:**
  ```
   M .atomic-skills/projects/atomic-skills/skills-restructuring/phases/f0-pente-fino-de-consistencia.md
   M docs/kb/code-quality-gates.md
   M skills/core/project.md
   M skills/shared/project-assets/project-create-plan.md
   M skills/shared/project-assets/project-drift.md
   M skills/shared/project-assets/project-view.md
  ```

## Self-review against gates
- G1 read-before-claim: applied — each closed task links the source edit + the verifier run (exit 0) that closed it; verifier outputs captured verbatim.
- G2 soft-language: applied — completion claims are `passed: true` evidence; handoff narrative scanned for the ban list (no should/probably/works/looks done).
- G6 reference-or-strike: applied — handoff literals are verbatim paths/commands/exit codes.

## Links

_(plan doc, external refs)_
