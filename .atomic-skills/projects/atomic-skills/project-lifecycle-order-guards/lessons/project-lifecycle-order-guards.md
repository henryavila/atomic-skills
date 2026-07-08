---
schemaVersion: "0.1"
slug: project-lifecycle-order-guards
projectId: atomic-skills
parentPlan: project-lifecycle-order-guards
lessons:
  - id: L-001
    statement: >-
      Sentinel values like `pr.state: NONE` must be classified before
      truthy string checks; otherwise lifecycle guards can recommend the wrong
      recovery path.
    corrective: >-
      For lifecycle guard and verify/help classifiers that treat
      external enum states as publication or integration evidence, add explicit
      sentinel tests for NONE/null/OPEN/MERGED before using generic non-empty
      string checks.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/project-lifecycle-order-guards-F0-local-review.md;
      fix 5c5167b
    createdAt: 2026-07-08T13:15:00.466Z
    validatedAt: 2026-07-08T13:15:00.466Z
---


# Lessons - project-lifecycle-order-guards F0

Distilada no `phase-done` da F0 e ratificada pelo usuario em 2026-07-08.
Nasce do review local registrado em
`.atomic-skills/reviews/project-lifecycle-order-guards-F0-local-review.md`, que
encontrou um bug real no tratamento de `pr.state: NONE`.

- **L-001** (reusable): enums externos que usam sentinela (`NONE`, `null`,
  `OPEN`, `MERGED`) precisam de testes explicitos antes de checks genericos de
  string nao vazia.
