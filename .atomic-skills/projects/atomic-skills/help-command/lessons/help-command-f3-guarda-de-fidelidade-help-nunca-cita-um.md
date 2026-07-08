---
schemaVersion: "0.1"
slug: help-command-f3-guarda-de-fidelidade-help-nunca-cita-um
projectId: atomic-skills
parentPlan: help-command
lessons:
  - id: L-001
    statement: A compactacao de texto residente para satisfazer byte-budget pode
      remover sem querer parte normativa do contrato, mesmo quando os testes
      estruturais continuam verdes.
    corrective: Em skills/core/project.md e nos testes de contrato do router, ao
      compactar texto residente, preservar explicitamente os dois lados de
      politicas normativas (por exemplo, aceitar 0.1/0.2 e emitir 0.1) e rodar o
      teste de contrato que procura esse marcador.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-07-08-1146-help-command-f3-local.md
    createdAt: 2026-07-08T12:06:00Z
    validatedAt: 2026-07-08T12:06:00Z
---

# Lessons - F3 (Guarda de fidelidade)

Distilada no phase-done da F3 (2026-07-08) e ratificada pelo usuario. Nasce do review-code local do diff da fase, que encontrou uma perda normativa no contrato do router durante a compactacao de byte-budget.

- **L-001** (reusable): compactacao de router precisa preservar explicitamente os dois lados das politicas normativas.
