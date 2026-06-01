---
schemaVersion: '0.1'
slug: REPLACE_SLUG
title: 'REPLACE_PLAN_TITLE'
version: '1.0'
status: active
started: REPLACE_ISO_TIMESTAMP
lastUpdated: REPLACE_ISO_TIMESTAMP
# branch: REPLACE_BRANCH  # uncomment if this plan is anchored to a specific branch
currentPhase: REPLACE_INITIAL_PHASE_ID
parallelismAllowed: false

principles: []

glossary: []

# tracks:  # uncomment + populate when the plan groups phases by domain
#   - { id: A, title: 'Data', domain: 'data' }
#   - { id: B, title: 'UI', domain: 'ui' }

phases:
  - id: REPLACE_INITIAL_PHASE_ID
    slug: REPLACE_INITIAL_PHASE_SLUG
    title: 'REPLACE_INITIAL_PHASE_TITLE'
    goal: 'REPLACE_INITIAL_PHASE_GOAL'
    dependsOn: []
    subPhaseCount: 0
    status: active
    exitGate:
      summary: 'REPLACE_INITIAL_PHASE_EXIT_SUMMARY'
      # The plan's TERMINAL phase (last in `phases:` order) MUST end its criteria with the
      # reserved, non-deferrable final manual-validation gate (G-MANUAL). project-plan injects
      # it; it is enforced at phase-done→plan-done. Exactly one G-MANUAL per plan, on the
      # terminal phase only. See project-plan §"Mandatory final manual-validation gate".
      criteria: []
      # criteria:   # ← terminal-phase shape: replace the empty `[]` above with this block
      #   - id: G-MANUAL
      #     description: 'Final manual validation — a human has personally verified the delivered work meets the goal before close.'
      #     verifier:
      #       kind: manual
      #       description: 'Demonstrate the completed work to the user and obtain explicit sign-off. This is the LAST gate; the plan does not close until the user confirms.'
      #     status: pending

# interPhaseGates: []  # populate when phases have hard handoff gates

# supersedes:
#   path: 'docs/old-plan.md'
#   supersedeScope: partial
#   partialAreas: []
#   remainsValid: []

references: []
---

# REPLACE_PLAN_TITLE

> Replace this body with the plan narrative — context, motivation, full decomposition,
> what stays valid from before. The frontmatter `phases:` field is the canonical machine-readable
> list; this body is the human-readable elaboration.

## 1. Context

(why this plan exists; what failure or opportunity motivates it)

## 2. Inviolable principles

(elaborate on each principle from the `principles:` frontmatter array)

## 3. Phase tree

(human-readable map of phases. Canonical list lives in frontmatter `phases:`.
 aiDeck renders this tree visually when `aideck` is running.)

## 4. What stays valid (from prior work)

(items NOT in scope of this plan — explicitly preserved from previous work)
