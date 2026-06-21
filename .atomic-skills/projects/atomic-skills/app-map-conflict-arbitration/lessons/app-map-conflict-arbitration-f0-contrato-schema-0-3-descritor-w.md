---
schemaVersion: "0.2"
slug: app-map-conflict-arbitration-f0-contrato-schema-0-3-descritor-w
projectId: atomic-skills
parentPlan: app-map-conflict-arbitration
lessons:
  - id: L-001
    statement: O gating por-versão do schema 0.3 (allOf if/then ramificando o shape de
      conflict por schemaVersion) foi testado só numa direção — o ramo 0.3 rejeita os
      slots legacy artefactValue/codeValue. A direção reversa (um catálogo 0.1/0.2
      carregando o novo witnesses[] deve ser rejeitado pelo additionalProperties:false
      do conflict legacy) ficou SEM teste e só foi pega no review-code da fase. Passou
      verde porque os testes cobriam o caminho novo-rejeita-antigo e os happy-paths, não
      a fronteira inversa.
    corrective: Ao adicionar um ramo de schema gated por versão (allOf if/then que troca
      o shape conforme a versão), escrever teste de fronteira nas DUAS direções — o ramo
      novo rejeita a forma antiga E o ramo antigo rejeita a forma nova (via
      additionalProperties:false). Um gate só está verificado quando ambos os lados da
      porta são exercidos; testar uma direção deixa o vazamento inverso invisível. Locus
      type test/<dominio>/schema.test.js.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-16-1939-app-map-conflict-arbitration-f0.md
    createdAt: 2026-06-16T19:39:09Z
    validatedAt: 2026-06-16T19:39:09Z
---

# Lessons — F0 (Contrato: schema 0.3 + descritor witnesses)

Distiladas no phase-done da F0 a partir do finding do review-code local (gating
por-versão testado em direção única). Ratificadas pelo operador (reusable).
