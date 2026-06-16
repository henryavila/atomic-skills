---
schemaVersion: "0.2"
slug: design-brief-source-of-truth-f0-schema-e-validacao-do-catalogo
projectId: atomic-skills
parentPlan: design-brief-source-of-truth
lessons:
  - id: L-001
    statement: O review local (mesmo modelo) não pegou nenhum dos 2 majors de rigor do
      contrato (schemaVersion livre, id de página não-único); o pass codex cross-model
      pegou ambos.
    corrective: Para uma fase que produz um contrato/schema porta-de-mão-única, rodar
      review-code --mode=both mesmo quando o sinal destrutivo é falso (diff aditivo). O
      custo cross-model se paga quando o artefato é caro de reverter.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-16-0749-design-brief-source-of-truth-f0.md
    createdAt: 2026-06-16T10:51:14Z
    validatedAt: 2026-06-16T10:51:14Z
  - id: L-002
    statement: O schema do app-map declarava schemaVersion como string não-vazia,
      aceitando "999"/qualquer versão — um false-green num contrato versionado.
    corrective: Ao declarar um contrato versionado, constranger schemaVersion com um enum
      das versões suportadas (espelhar common.schema.json#/$defs/schemaVersion) e adicionar
      um teste negativo — no decompose/SPEC, não esperar o review pegar.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-16-0749-design-brief-source-of-truth-f0.md
    createdAt: 2026-06-16T10:51:14Z
    validatedAt: 2026-06-16T10:51:14Z
  - id: L-003
    statement: Os testes da fase ficaram em test/ (singular) mas npm test faz glob de
      tests/*.test.js (plural, flat), então não gateavam no CI; o verifier explícito
      node --test test/app-map/... passava e mascarava o gap.
    corrective: Quando uma task adiciona testes, confirmar que npm test os descobre (o
      verifier explícito passar é necessário mas não suficiente). Usar a convenção tests/
      do repo OU ampliar o glob na mesma task que cria os testes.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-16-0749-design-brief-source-of-truth-f0.md
    createdAt: 2026-06-16T10:51:14Z
    validatedAt: 2026-06-16T10:51:14Z
  - id: L-004
    statement: A unicidade de um sub-campo de array (pages[].id) não é expressável em JSON
      Schema draft 2020-12 (uniqueItems compara itens inteiros).
    corrective: Para unicidade de sub-campo em array, adicionar uma checagem pós-schema no
      validador compartilhado (não tentar expressá-la no .json schema), retornando o erro
      no mesmo formato para todos os consumidores.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-16-0749-design-brief-source-of-truth-f0.md
    createdAt: 2026-06-16T10:51:14Z
    validatedAt: 2026-06-16T10:51:14Z
---

# Lessons — F0 Schema e validação do catálogo (design-brief-source-of-truth)

Distiladas no phase-done da F0 a partir de sinais reais: 2 majors do codex cross-model que o
pass local não pegou (L-001, L-002, L-004) e 1 major do pass local (L-003). Ratificadas pelo
operador. As `scope: reusable` + `status: open` são dispostas no início de cada fase futura via
`node scripts/list-lessons.js --phase <id>`.
