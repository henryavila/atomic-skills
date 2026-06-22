---
schemaVersion: "0.2"
slug: app-map-conflict-arbitration-f1-produtor-consumidores-e-prosa
projectId: atomic-skills
parentPlan: app-map-conflict-arbitration
lessons:
  - id: L-001
    statement: >-
      O review local de mesmo-modelo passou limpo (0 findings) no diff da F1, mas o
      pass codex cross-model achou 2 majors no renderer operador-facing
      (mirrorMarkdown). (1) witness.value/witness.source são PERMISSIVOS no schema 0.3
      (objeto/array/string), mas o mirror coagia por template-string, virando
      "[object Object]" e escondendo valor/proveniência. (2) Um conflito RESOLVIDO
      (objeto resolution.choice) ainda era contado como "unresolved" e a escolha
      omitida — o .md contradizia o JSON. Os testes locais exercitavam só a forma
      comum (witnesses string, estado pending).
    corrective: >-
      Um renderer/derivado operador-facing que consome um campo PERMISSIVO
      (value any, source string ou objeto) ou um estado com ciclo de vida
      (pending para resolved) deve cobrir, em teste, a forma ESTRUTURADA e CADA
      estado que o schema admite — não só a string/estado mais comum; formatar
      não-strings por serialização determinística, nunca coerção implícita.
      Além disso, rodar review-code --mode=both para artefatos operador-facing —
      a lesson L-001 da F0 de design-brief-source-of-truth generaliza (contratos e
      consumidores caros de reverter merecem o pass cross-model, mesmo com diff aditivo).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-16-2014-app-map-conflict-arbitration-f1.md
    createdAt: 2026-06-16T20:14:47Z
    validatedAt: 2026-06-16T20:14:47Z
---

# Lessons — F1 (Produtor, consumidores e prosa)

Distilada no phase-done da F1 a partir dos 2 findings major do review cross-model
(codex) que o pass local de mesmo-modelo não pegou. Ratificada pelo operador (reusable).
