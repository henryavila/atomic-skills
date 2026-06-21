---
schemaVersion: "0.2"
slug: skills-restructuring-f4-feature-project-review
projectId: atomic-skills
parentPlan: skills-restructuring
lessons:
  - id: L-001
    statement: >-
      O contrato "não-interativo / read-only" de uma skill que COMPÕE outra só vale
      se TODOS os prompts interativos do delegado tiverem guarda não-interativa — não
      só o primeiro/óbvio. review-plan tinha guarda non-interactive só no mode picker
      (Step 0a), não no cross-ref picker (Step 0b). A 1ª versão de `project review`
      (leg 4) delegava `review-plan --mode=<local|both>` sem flag de cross-ref e teria
      travado num `{{ASK_USER_QUESTION_TOOL}}` — agravado pela seedagem de cross-ref via
      references/supersedes da T4.2, que faz a opção "detected artifacts" aparecer mais.
    corrective: >-
      Ao escrever uma leg de composição que invoca outra skill, enumerar TODOS os prompts
      interativos do delegado e passar a flag que curto-circuita cada um (ex.: `--no-cross-ref`
      além de `--mode=local`). Antes de fechar a task, verificar no arquivo do delegado que
      cada `{{ASK_USER_QUESTION_TOOL}}`/picker ou tem short-circuit por flag ou um
      non-interactive abort — e que a leg de composição aciona esse short-circuit.
      Locus: skills/shared/project-assets/project-review.md leg 4.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      review local .atomic-skills/reviews/2026-06-16-2016-skills-restructuring-f4.md
      (finding F-001 major); fix no commit ecaae5b (leg 4 passa --no-cross-ref).
    createdAt: 2026-06-16T20:51:13.900Z
    validatedAt: 2026-06-16T20:51:13.900Z
---

# Lessons — F4 Feature: project review

Distilled at phase-done (ratified by the user). One reusable lesson from the
local review's major finding (composition skills must short-circuit every
interactive prompt of the skill they delegate to).
