---
schemaVersion: "0.2"
slug: plan-fork-f4-focus-resolver-pai-filho-pause-e-paralle
projectId: atomic-skills
parentPlan: plan-fork
lessons:
  - id: L-001
    statement: >-
      Um Edit inseriu um NUL byte literal no separador de chave de planKey em
      emit-focus.js, fazendo as chaves geradas por supersededParentSlugs (separador
      espaço) divergirem das de planKey (separador NUL). O colapso de fork nunca
      disparava — dois testes ficaram vermelhos sem erro óbvio, e o Read mostrava o
      NUL como um espaço. grep tratou o arquivo como binário (binary file matches) e
      sumiu com o output, mascarando a busca.
    corrective: >-
      Rode o teste específico do fix após CADA Edit (o Edit ter "aplicado" não prova
      correção). Se um grep retorna "binary file matches", escaneie por NUL via
      offset (python3 open(f,'rb').read().count(b'\x00')) e corrija. Um caractere
      não-imprimível quebra igualdade de string silenciosamente e é lido como espaço.
      Locus emit-focus.js planKey (corrigido em 9b96ab2).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-21-0024-plan-fork-f4.md
    createdAt: 2026-06-21T00:40:11Z
    validatedAt: 2026-06-21T00:40:11Z
  - id: L-002
    statement: >-
      O pass codex cross-model pegou um caminho disjoint — pai com exact-branch match
      mais filho unbranched, onde o filho-survivor fica fora do pool (que o exact
      narrowing reduziu ao pai) — que nem o pass local mesmo-modelo nem os testes
      locais exercitavam. O fix do fallback já o cobria por sorte, mas estava
      não-testado: um buraco de cobertura latente.
    corrective: >-
      Para um resolver com MÚLTIPLAS dimensões de input (aqui contexto de branch ×
      topologia de fork), enumere o produto cruzado nas dimensões nos testes; um fix
      que "por acaso trata" um ramo não-testado é regressão latente. Reforça F2 L-004
      e F3 L-001 (cross-model fecha os buracos de cobertura do mesmo-modelo). Locus
      emit-focus.js pickFocus, fallback survivorPool→survivors.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-21-0024-plan-fork-f4.md
    createdAt: 2026-06-21T00:40:11Z
    validatedAt: 2026-06-21T00:40:11Z
  - id: L-003
    statement: >-
      A regra de hierarquia pai/filho lia o sidecar mas chaveava por slug nu, então
      um filho no projeto X colapsava (emit) ou deferia o current (reconcile) de um
      plano homônimo no projeto Y. O comentário "fork é intra-project, slugs únicos
      por projeto" não era enforcement — o mapa não era particionado por projeto.
    corrective: >-
      Todo mapa cross-entity chaveado por slug numa árvore multi-project deve ser
      escopado por projId+slug, usando o projId da própria entidade para resolver o
      alvo no MESMO projeto. Liga a branch-ne-plan-atomic-skills (a mesma slug recorre
      entre projetos/branches). Locus emit-focus.js supersededParentSlugs +
      reconcile-focus.js collectForkDeferrals.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-21-0024-plan-fork-f4.md
    createdAt: 2026-06-21T00:40:11Z
    validatedAt: 2026-06-21T00:40:11Z
---

# Lessons — F4 (focus-resolver pai/filho)

Distiladas no phase-done da F4 a partir do review-code --mode=both (local + codex).
Ratificadas pelo usuário. O phase-start gate da F5 dispõe as reusable+open via
`node scripts/list-lessons.js --phase F5`.
