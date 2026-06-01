---
schemaVersion: '0.1'
slug: REPLACE_SLUG
title: 'REPLACE_INITIATIVE_TITLE'
goal: 'REPLACE_INITIATIVE_GOAL'
status: active
branch: REPLACE_BRANCH_OR_NULL
started: REPLACE_ISO_TIMESTAMP
lastUpdated: REPLACE_ISO_TIMESTAMP
nextAction: 'REPLACE_INITIAL_NEXT_ACTION'

# === plan-membership-block (delete entire block + sentinels if standalone) ===
parentPlan: REPLACE_PARENT_PLAN_SLUG
phaseId: REPLACE_PHASE_ID
# === /plan-membership-block ===

# audience: 'REPLACE_AUDIENCE'  # uncomment if known (e.g. Developer, Admin user)

# Standalone initiatives MUST end with the reserved, non-deferrable final manual-validation
# gate (G-MANUAL). `atomic-skills:project-plan new` injects it for standalone initiatives;
# IN-PLAN phase initiatives OMIT it (the plan's terminal phase owns the gate). It blocks
# `archive` until a human validates. See project-plan §"Mandatory final manual-validation gate".
exitGates: []
# exitGates:   # ← standalone shape: replace the empty `[]` above with this block
#   - id: G-MANUAL
#     description: 'Final manual validation — a human has personally verified the delivered work meets the goal before close.'
#     verifier:
#       kind: manual
#       description: 'Demonstrate the completed work to the user and obtain explicit sign-off. This is the LAST gate; the initiative does not close until the user confirms.'
#     status: pending

# scope:
#   paths:
#     - .  # narrow once known; use `npm run detect-scope` to suggest

stack:
  - { id: 1, title: 'REPLACE_INITIATIVE_TITLE', type: task, openedAt: REPLACE_ISO_TIMESTAMP }

tasks: []

parked: []

emerged: []
---

# Narrative / notes

Free-form Markdown below. The skill does NOT mutate this region automatically.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs, etc. — for structured references use `references:` in frontmatter)_
