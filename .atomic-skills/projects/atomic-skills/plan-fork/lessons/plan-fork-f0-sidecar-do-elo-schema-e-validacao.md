---
schemaVersion: "0.2"
slug: plan-fork-f0-sidecar-do-elo-schema-e-validacao
projectId: atomic-skills
parentPlan: plan-fork
lessons:
  - id: L-001
    statement: readLinks fazia JSON.parse(readFileSync()) sem try/catch e sem checar
      shape, então um links.json vazio ou truncado lançava um SyntaxError opaco sem o
      path, e um arquivo presente-porém-não-objeto (null/array/primitivo) era devolvido
      verbatim — violando o contrato documentado "or {} when absent" e alimentando os
      setters com um valor que eles mutariam como primitivo sob ESM strict.
    corrective: Em qualquer reader novo sobre um sidecar JSON, envolver o parse num
      rethrow contextual com o path no texto e rejeitar/coagir não-objeto antes de
      retornar; cobrir vazio, malformado e não-objeto com testes. Locus
      src/links-sidecar.js readLinks, corrigido em 52ea43f.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-19-1553-plan-fork-f0.md
    createdAt: 2026-06-19T18:53:49Z
    validatedAt: 2026-06-19T18:53:49Z
  - id: L-002
    statement: Ao tornar reachable iterativo por terminação, a função-irmã hasCycle no
      mesmo módulo ficou recursiva e estoura a pilha numa cadeia acíclica profunda
      (~20k nós). Um export sem caller ainda é um footgun latente.
    corrective: Ao endurecer uma função de grafo por terminação, varrer as irmãs do
      mesmo módulo e torná-las iterativas também, ou remover o export não-usado. Locus
      src/spawn-graph.js hasCycle linhas 73-98.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-19-1553-plan-fork-f0.md
    createdAt: 2026-06-19T18:53:49Z
    validatedAt: 2026-06-19T18:53:49Z
---

# Lessons — plan-fork F0 (Sidecar do elo, schema e validação)

Destiladas no phase-done da F0, a partir dos achados confirmados do `review-code`
(local) sobre `6e5a4f2..e0bdfd1` — ver `.atomic-skills/reviews/2026-06-19-1553-plan-fork-f0.md`.
Ratificadas pelo operador (L1+L2). O achado #3 (write não-atômico) não virou lesson:
é convenção da casa e o hardening de L1 já mitiga.
