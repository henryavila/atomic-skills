---
schemaVersion: "0.2"
slug: deadline-burnup-forecast-f0-fonte-de-fluxo-evento-done-emitido
projectId: atomic-skills
parentPlan: deadline-burnup-forecast
lessons:
  - id: L-001
    statement: O writer append-completion validava os escalares (event/escopo/weight)
      mas passava o sub-objeto opcional `actuals` (pré-declarado para F4) verbatim, então
      podia gravar no log append-only (nunca reescrito) uma linha que o próprio schema
      rejeita — um dado imutável incorrigível só detectado pelo review.
    corrective: Um writer de log append-only/imutável deve validar o registro COMPLETO —
      incluindo sub-objetos opcionais pré-declarados para uma fase futura — contra seu
      próprio schema ANTES de escrever (enums fechados, additionalProperties:false,
      ranges numéricos), não só os campos required escalares. Adicionar o teste de
      validação do campo pré-declarado JÁ, mesmo sem caller que o popule.
    scope: reusable
    appliesTo:
      - F4
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-17-1938-code-deadline-burnup-forecast-f0.md
    createdAt: 2026-06-17T19:14:53Z
    validatedAt: 2026-06-17T19:14:53Z
  - id: L-002
    statement: O schema e o writer modelaram taskId como uniformemente nullable para
      todos os eventos, então um 'task-done' sem taskId (sem atribuição de task) era
      silenciosamente aceito como válido.
    corrective: Quando a validade de um campo depende de um discriminador (tipo de
      evento), acoplá-los — schema `if/then` no discriminador + guard no writer + teste
      negativo — em vez de um nullable uniforme que aceita um registro sem sentido.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-17-1938-code-deadline-burnup-forecast-f0.md
    createdAt: 2026-06-17T19:14:53Z
    validatedAt: 2026-06-17T19:14:53Z
---

# Lessons — deadline-burnup-forecast F0 (Fonte de fluxo)

Distiladas no phase-done de F0 a partir dos findings do review-code (local) sobre o diff da fase. Ratificadas pelo operador. Dispostas no gate de início da próxima fase via `node scripts/list-lessons.js --phase <id>`.
