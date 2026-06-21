---
schemaVersion: "0.2"
slug: design-brief-briefing-rework-f0-refazer-reescrever-o-modelo-de
projectId: atomic-skills
parentPlan: design-brief-briefing-rework
lessons:
  - id: L-001
    statement: Reescrever um conceito load-bearing (a autoridade de camada-2 — banda
      vincula / valor exato é calibração melhorável) só nas seções óbvias deixou o
      enquadramento antigo de pé em quatro lugares paralelos — a tabela de 3 camadas
      ("Especificar, concreto" / owner=produto), a frase-líder de R2 ("os carrega como
      requisito"), a lista de enumeração da mineração (ainda nomeando "debounces") e o
      §6 canônico do spec (que ficou sem o gate mecânica/copy que o §6 do asset ganhou).
      O review gate adversarial achou 6 contradições assim (3 critical, 2 major, 1 minor).
    corrective: Num refactor conceitual sobre um CONJUNTO de docs, antes de fechar a fase
      faça um sweep por TODOS os lugares que afirmam o enquadramento antigo — grep pelos
      termos-chave do modelo velho (ex. requisito/binding/requirement/debounce/specify) em
      todos os arquivos do conjunto, não só na seção que você editou; reconcilie tabelas e
      checklists paralelos (mesmo em arquivos diferentes) na mesma passada.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: "commit 236d65b6 — F0 review-gate fixes (6 contradições reconciliadas nos 5 docs)"
    createdAt: 2026-06-19T15:08:33.619Z
    validatedAt: 2026-06-19T15:08:33.619Z
  - id: L-002
    statement: Os 5 verifiers grep de presença das tasks da F0 ("contém axis-lock",
      "contém calibra", "contém proveni", etc.) passaram verdes em todas as tasks mesmo
      com 6 contradições internas vivas — grep prova presença de um token, nunca a
      coerência entre seções. Foi o review gate adversarial (review-code) que pegou as
      contradições cruzadas.
    corrective: Em tasks de edição de doc/spec, trate o verifier grep como gate de
      presença mínimo (o token existe), não como prova de coerência; não pule o review
      gate adversarial em fases de doc-refactor — é ele, e não o grep, que valida a
      coerência cruzada entre as seções e os arquivos.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: "commit 236d65b6 — F0 review-gate fixes (6 contradições reconciliadas nos 5 docs)"
    createdAt: 2026-06-19T15:08:33.619Z
    validatedAt: 2026-06-19T15:08:33.619Z
---

# Lessons — F0 Refazer (reescrever o modelo de autoridade)

Distiladas no phase-done da F0 a partir dos achados do review gate local (`review-code --mode=local` sobre `b32ada5..HEAD`). Ratificadas pelo operador. A fase-start da F1 dispõe as reusáveis+open via `node scripts/list-lessons.js --phase F1`.
