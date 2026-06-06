---
schemaVersion: "0.1"
slug: refactor-doc-architect-f2-drop-and-replace-bmad-coupling
title: Drop and replace BMAD coupling
goal: Remove BMAD-specific scaffolding and re-point config, memory, and output
  paths to atomic-skills / target-repo conventions.
status: pending
branch: main
started: 2026-05-31T20:37:21.595Z
lastUpdated: 2026-05-31T20:37:21.595Z
nextAction: "Start T-001: Delete BMAD scaffolding"
parentPlan: refactor-doc-architect
phaseId: F2
tasksDone: 0
tasksTotal: 4
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: no path or variable in the skill references `_bmad`,
      `_bmad-output`, or a BMAD manifest.
    status: pending
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
stack:
  - id: 1
    title: Drop and replace BMAD coupling
    type: task
    openedAt: 2026-05-31T20:37:21.595Z
tasks:
  - id: T-001
    title: Delete BMAD scaffolding
    description: "Remove `_memory-template/`, `module.yaml`, `bmad-manifest.json`,
      `bmad-skill-manifest.yaml`. `verified_by: source tree lists
      _memory-template/, module.yaml, workflows/.../bmad-manifest.json,
      bmad-skill-manifest.yaml`."
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
  - id: T-002
    title: Replace language-config indirection
    description: "The `{communication_language}` / `{generated_docs_language}`
      variables and the `_bmad/...config.yaml` loads resolve to the
      atomic-skills language convention; use `{{#if ...}}` conditionals where
      IDE-specific. `verified_by: source SKILL.md loads
      _bmad/bmad-doc-architect/config.yaml and _bmad/bmm/config.yaml and
      references {communication_language}/{generated_docs_language}`."
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
  - id: T-003
    title: Re-point memory and output paths
    description: "Memory `_bmad/_memory/doc-architect-sidecar/` maps to
      `.ai/memory/`; output `_bmad-output/doc-architect/<module>/` maps to a
      target-repo-relative docs path aligned with the 6-files-per-module output.
      `verified_by: source step-01 frontmatter appArchitecture points at
      _bmad/_memory/doc-architect-sidecar/; findings-schema snapshot path is
      _bmad-output/doc-architect/<module-slug>/`."
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
  - id: T-004
    title: Reconcile documentation standard into target repo's house standard
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
    description: "Execute principle P5, which no prior task delivered (codex F-005).
      Recording the D1 tie-break and copying
      `documentation-standard-template.md` is NOT reconciliation. Locate the
      target repo's house documentation standard, map every source-template
      field to it, flag unmapped fields, and define conflict handling per D1
      (house wins on structure, template wins on extraction depth). Output: a
      reconciled standard the renderer consumes, plus a gap list. F5 gates
      generated docs on conformance to this reconciled standard. `verified_by: a
      reconciled standard file exists with a documented field map + gap list
      before F5 runs`."
    provenance:
      surfacedAt: 2026-05-31T20:59:00.000Z
      surfacedDuring: refactor-doc-architect-f2/codex-review-F-005
      surfacedBy: ai
    context:
      solves: P5 (standard reconciliation) had no covering task; generated docs could
        preserve the source template while failing the target house shape with
        no gate catching it.
      trigger: codex cross-model review F-005 (2026-05-31).
      assumesStillValid:
        - The target repo has a discoverable house documentation standard
          distinct from doc-architect's template.
      ratifiedAt: 2026-05-31T20:59:00.000Z
      ratifiedBy: human
      lastReviewedAt: 2026-05-31T20:59:00.000Z
parked: []
emerged: []
summary: Remove o acoplamento BMAD e re-aponta config/memória/saída pras
  convenções atomic-skills / target-repo.
planTitle: Refactor doc-architect into an atomic-skill
---

# Narrative / notes

Initiative for phase **F2 — Drop and replace BMAD coupling**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
