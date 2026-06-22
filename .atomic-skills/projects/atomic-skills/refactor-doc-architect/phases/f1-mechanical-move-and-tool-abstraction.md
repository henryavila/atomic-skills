---
schemaVersion: "0.1"
slug: refactor-doc-architect-f1-mechanical-move-and-tool-abstraction
title: Mechanical move and tool abstraction
goal: Copy the proven pipeline into the new skill location and convert it to
  atomic-skills conventions, changing structure and tool references only — not
  prompt substance.
status: pending
branch: main
started: 2026-05-31T20:37:21.595Z
lastUpdated: 2026-05-31T20:37:21.595Z
nextAction: "Start T-001: Copy the pipeline assets"
parentPlan: refactor-doc-architect
phaseId: F1
tasksDone: 0
tasksTotal: 4
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 4
exitGates:
  - id: G-1
    description: the skill loads under atomic-skills conventions with zero remaining
      hardcoded tool literals of ANY class (all 8 project tool variables, not
      just the 4 read/search ones), every retained source file present per the
      F1/T-001 manifest, and no dangling BMAD frontmatter.
    status: pending
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
stack:
  - id: 1
    title: Mechanical move and tool abstraction
    type: task
    openedAt: 2026-05-31T20:37:21.595Z
tasks:
  - id: T-001
    title: Copy the pipeline assets
    description: "Enumerate and copy EVERY retained source markdown file, not a
      partial list (codex F-001). Pipeline: `steps/` (step-01..step-07f, 5-D
      review 07a-e intact). References: `findings-schema.md`,
      `verification-checklist.md`, `documentation-standard-template.md`,
      `memory-system.md`, all `extraction-*.md`. Entrypoints/workflows:
      `discover-architecture.md`, `init.md`, `module-status.md`,
      `update-module.md`, `verify-module.md`, `save-memory.md`. Output adapters:
      `adapter-*.md`. For any source file deliberately NOT copied, record it in
      an explicit drop list with its replacement task — F2/F3 must not audit or
      reference a file F1 never created. `verified_by: a post-copy file-count or
      manifest diff against the source tree confirms full coverage`."
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
  - id: T-002
    title: Run the tool-literal abstraction sweep
    description: "Exhaustive sweep against the FULL project variable set (codex
      F-002), not only four literals: `{{BASH_TOOL}}`, `{{READ_TOOL}}`,
      `{{WRITE_TOOL}}`, `{{REPLACE_TOOL}}`, `{{GREP_TOOL}}`, `{{GLOB_TOOL}}`,
      `{{INVESTIGATOR_TOOL}}`, `{{ASK_USER_QUESTION_TOOL}}` (per CLAUDE.md).
      Catch write/edit/replace/ask-user tool names too, not just read/search.
      Verify zero remaining hardcoded tool literals of ANY class before the gate
      passes. `verified_by: grep for each disallowed literal class returns 0
      across the moved files`."
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
  - id: T-003
    title: Rewrite SKILL.md frontmatter
    description: 'Convert to atomic-skills namespace and registry-style
      name/description; remove the BMAD `--headless` autonomous-mode block (or
      re-express it via atomic conventions if the user wants headless).
      `verified_by: source SKILL.md frontmatter is name+description only and
      body has an "Activation Mode Detection" --headless block`.'
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
  - id: T-004
    title: Relocate output adapters
    description: Move `adapter-gh-issues`, `adapter-html-report`,
      `adapter-findings-report` into `references/adapters/` as pluggable output
      targets and variable-swap them.
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
parked: []
emerged: []
summary: Move o pipeline provado pro novo local + converte às convenções
  atomic-skills (estrutura/ferramentas, não a lógica).
planTitle: Refactor doc-architect into an atomic-skill
---

# Narrative / notes

Initiative for phase **F1 — Mechanical move and tool abstraction**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
