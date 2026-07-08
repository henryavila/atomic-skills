---
schemaVersion: "0.2"
slug: phase-materialization-f3-verbo-materialize-gate-de-validacao-de
projectId: atomic-skills
parentPlan: phase-materialization
lessons:
  - id: L-001
    statement: Transition verbs that can be called both directly and internally can
      regress when one contract is validated but the other call shape is not
      covered.
    corrective: Locus - project transition/materialization docs and static tests.
      For each transition verb, guard direct invocation, internal caller
      invocation, existing-file reuse, and parallel activation paths in the same
      focused test.
    scope: reusable
    appliesTo: []
    status: closed
    confidence: 2
    evidence: .atomic-skills/reviews/2026-07-01-1225-phase-materialization-f3.md
    createdAt: 2026-07-01T12:35:00.000Z
    validatedAt: 2026-07-01T12:35:00.000Z
---

# Lessons - F3 Verbo materialize + gate de validacao de negocio

Distilada no phase-done da F3 a partir de quatro findings major do review-code
local em contexto limpo. A lesson foi ratificada pelo usuario e aplicada na
entrada da F4 adicionando cobertura esperada ao T-010: fire points precisam
cobrir chamada direta, chamada interna, reuse de initiative existente e ativacao
paralela.
