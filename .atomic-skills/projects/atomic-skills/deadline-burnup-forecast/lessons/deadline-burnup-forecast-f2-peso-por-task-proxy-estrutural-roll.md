---
schemaVersion: "0.2"
slug: deadline-burnup-forecast-f2-peso-por-task-proxy-estrutural-roll
projectId: atomic-skills
parentPlan: deadline-burnup-forecast
lessons:
  - id: L-001
    statement: >-
      Números não-finitos (NaN, Infinity) passam por uma guarda `typeof x ===
      'number'` (ambos SÃO typeof number), mas `JSON.stringify` os serializa como
      null — o que quebra a constraint de tipo numérico do schema do consumidor
      quando o valor flui para a projeção emitida (validada por
      validateAideckState). Um Infinity em `tasks[].weight` produziria weightTotal
      Infinity, emitido como null, gerando drift de validação.
    corrective: >-
      Guardar TODO campo numérico que pode chegar à projeção emitida com
      `Number.isFinite(x) && x >= 0` (não apenas `typeof === number`), antes que o
      valor seja somado/projetado. Aplicar em F3 (série earned/planned + SPI —
      novos números no emit) e F4 (actuals crus) ao introduzir cada novo escalar
      numérico no estado emitido.
    scope: reusable
    appliesTo:
      - F3
      - F4
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-19-1233-code-deadline-burnup-forecast-f2.md
    createdAt: 2026-06-19T12:33:22Z
    validatedAt: 2026-06-19T12:33:22Z
---

# Lessons — deadline-burnup-forecast F2 (Peso por task: proxy estrutural + rollups)

Distilada no phase-done de F2 a partir do finding minor m2 do review-code (local) sobre o diff da fase: `weightOf` usava `typeof t.weight === 'number' && t.weight >= 0`, deixando Infinity passar (JSON.stringify o torna null, quebrando o tipo numérico do schema). Corrigido na própria fase (predicado endurecido para Number.isFinite, commit ee960c9) + teste negative/NaN/Infinity. Review APPROVED 0B/0C/0M/2m (ambos minors aplicados). Ratificada pelo operador. A lição é forward-looking: F3 e F4 adicionam novos escalares numéricos (SPI, série, actuals) ao estado emitido. Disposta no gate de início via `node scripts/list-lessons.js --phase F3`.
