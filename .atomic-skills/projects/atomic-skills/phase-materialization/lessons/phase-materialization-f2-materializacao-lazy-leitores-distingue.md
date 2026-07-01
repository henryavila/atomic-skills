---
schemaVersion: "0.2"
slug: phase-materialization-f2-materializacao-lazy-leitores-distingue
projectId: atomic-skills
parentPlan: phase-materialization
lessons:
  - id: L-001
    statement: Flat legacy scanners that key materialized phase records only by
      `phaseId` can cross-match unrelated plans when several flat plans share
      common ids such as `F0`, turning a descriptor-only phase into a false
      materialized phase.
    corrective: Locus - flat legacy plan/initiative joins. Key by `(parentPlan,
      phaseId)` first; use phaseId-only fallback only for a single unscoped
      legacy initiative; add a cross-plan regression whenever a detector
      supports both nested and flat layouts.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-07-01-1029-phase-materialization-f2.md
    createdAt: 2026-07-01T10:29:08Z
    validatedAt: 2026-07-01T12:35:00.000Z
---

# Lessons - F2 Materializacao lazy + leitores distinguem descriptor-only

Distilada no phase-done da F2 a partir de um finding real do review-code local:
o detector `find-missing-business-intent.js` tinha um falso positivo na
convivencia com layouts flat legados quando outro plano compartilhava o mesmo
`phaseId`. A correcao foi aplicada e coberta por regressao antes da fase avancar.
Esta lesson fica aberta para todas as fases futuras que toquem leitores/detectores
com suporte simultaneo a layout nested e flat.
