---
schemaVersion: "0.2"
slug: design-brief-source-of-truth-f2-integracao-no-design-brief
projectId: atomic-skills
parentPlan: design-brief-source-of-truth
lessons:
  - id: L-001
    statement: O conflictForField (que monta o descritor de conflito persistido no
      catálogo) atribuía artefactValue/codeValue por POSIÇÃO alfabética dos valores,
      fabricando uma testemunha de "código" que nunca existiu — o code-scan não emite
      audience/accessTier, então todo valor vinha de doc. Passou verde porque os
      testes da F2 eram estruturais (asseram âncoras de integração na prosa) e nenhum
      exercia a proveniência do conflicts[] gravado.
    corrective: Quando um bridge RE-DERIVA uma estrutura que carrega proveniência (qual
      fonte afirmou o quê), um teste deve asserir a proveniência honesta (codeValue=null
      sem testemunha de código), não só que o campo está populado. Posição (ordem
      alfabética/de chegada) NÃO é proveniência.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-16-1702-design-brief-source-of-truth-f2.md
    createdAt: 2026-06-16T17:02:00Z
    validatedAt: 2026-06-16T17:02:00Z
  - id: L-002
    statement: O descritor de conflito do schema app-map 0.2 tem 2 slots posicionais
      (artefactValue/codeValue); ao montar um conflito de N testemunhas, o 3º+ valor era
      silenciosamente descartado dos campos estruturados — uma violação do P2 (nunca
      escolher no silêncio) ASSADA no formato binário do schema, não um bug de código.
    corrective: Um descritor cujo objetivo é levar TODOS os candidatos ao operador deve
      carregar um CONJUNTO de candidatos (ex candidates[]), não 2 slots fixos; campos
      binários codificam a premissa "exatamente 2 testemunhas" que o domínio não garante.
      Revisitar o shape ao desfreezar o schema (bump 0.2→0.3).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-16-1702-design-brief-source-of-truth-f2.md
    createdAt: 2026-06-16T17:02:00Z
    validatedAt: 2026-06-16T17:02:00Z
---

# Lessons — F2 Integração no design-brief

Distiladas no phase-done da F2 a partir de sinais reais de falha: 2 majors achados pelo review-code
local de contexto-limpo sobre o diff da fase (`dc7a9c3..HEAD`, review `2026-06-16-1702`). L-001
(atribuição de conflito por posição, não proveniência) foi **corrigida na própria F2** (commit
`f265aff`) + coberta por teste novo; o aprendizado fica registrado porque generaliza. L-002 (descritor
binário descarta a N-ésima testemunha) foi **deferida** — exige evoluir o schema `0.2` frozen — e
capturada como idea #3 no inbox. Ratificadas pelo operador. As `scope: reusable` + `status: open` são
dispostas no início de cada fase futura via `node scripts/list-lessons.js --phase <id>`.
