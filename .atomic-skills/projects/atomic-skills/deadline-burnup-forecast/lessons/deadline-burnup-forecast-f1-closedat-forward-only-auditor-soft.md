---
schemaVersion: "0.2"
slug: deadline-burnup-forecast-f1-closedat-forward-only-auditor-soft
projectId: atomic-skills
parentPlan: deadline-burnup-forecast
lessons:
  - id: L-001
    statement: Um campo de projeção emitido sob `additionalProperties:false` que o
      emitter SEMPRE popula (via `?? null`) fica admitido em `properties` mas fora de
      `required` — o schema aceita silenciosamente uma futura omissão do campo, justo
      a lacuna que a instrumentação de closedAt existe para prevenir.
    corrective: Ao endurecer closedAt de soft→hard (F4/T-003), adicionar `closedAt` e
      `lastUpdated` ao array `tasks.required` de `meta/schemas/aideck-state.schema.json`
      e regenerar o bundle (`npm run build:aideck-schema`), deixando o contrato do campo
      tão estrito quanto o resto do registro emitido — não apenas admitido.
    scope: reusable
    appliesTo:
      - F4
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-19-0920-code-deadline-burnup-forecast-f1.md
    createdAt: 2026-06-19T09:20:00Z
    validatedAt: 2026-06-19T09:20:00Z
---

# Lessons — deadline-burnup-forecast F1 (closedAt forward-only: auditor soft + emissão)

Distilada no phase-done de F1 a partir do finding m2 (LOW/advisory) do review-code (local) sobre o diff da fase. Fase limpa (verifier-clean, review APPROVED 0B/0C/0M/3m, 0 fixes); a única lesson é a percepção forward-looking de m2, acionável exatamente em F4 (onde closedAt endurece soft→hard). Ratificada pelo operador. Disposta no gate de início da próxima fase relevante via `node scripts/list-lessons.js --phase F4`.
