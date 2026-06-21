---
schemaVersion: "0.2"
slug: plan-fork-f5-handoff-aideck-docs-e-migracao-inline
projectId: atomic-skills
parentPlan: plan-fork
lessons:
  - id: L-001
    statement: >-
      Numa migração que troca o FORMATO de um dado persistido (elo fork sidecar→inline)
      consumido pelos installs da ferramenta em outros repos, o pass local mesmo-modelo
      achou só 2 minors e marcou os itens relevantes do checklist (caller-compat,
      migrate data-loss) como PASS. O codex cross-model pegou 1 critical + 2 major
      TODOS disjuntos — incluindo a dimensão de upgrade/compat que o mesmo-modelo é
      cego porque raciocina sobre o repo atual, não sobre installs já no formato velho.
    corrective: >-
      Migração de formato one-way-door (schema/formato persistido consumido por
      installs) ⇒ review-code --mode=both obrigatório, e perguntar explicitamente "o
      que quebra no upgrade a partir do formato antigo?". Recorrência forte de F2 L-004
      / F3 L-001 / F4 L-002: o mesmo-modelo é sistematicamente cego ao próprio ponto
      cego em contratos caros de reverter.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-21-0305-plan-fork-f5.md
    createdAt: 2026-06-21T03:22:06Z
    validatedAt: 2026-06-21T03:22:06Z
  - id: L-002
    statement: >-
      Trocar os readers pro formato novo "inline-only" silenciosamente abandona os
      dados que ainda estão no formato antigo — qualquer repo já com a aresta só no
      links.json legado perderia a relação pai/filho no upgrade, sem erro.
    corrective: >-
      Ao mudar um formato persistido, SEMPRE prover um read-fallback pro formato
      antigo (ou uma migração auto-wired no refresh/upgrade); nunca assumir que todas
      as instâncias já migraram. O inline tem precedência; o fallback é a rede de
      segurança da transição. Locus getSpawnedFrom/getSpawnedPlans (F-001 do review).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-21-0305-plan-fork-f5.md
    createdAt: 2026-06-21T03:22:06Z
    validatedAt: 2026-06-21T03:22:06Z
  - id: L-003
    statement: >-
      Quando um write path é substituído (sidecar via writeLinks→assertValidLinks
      trocado por escrita inline no plan.md), a fronteira de validação ANTIGA (Ajv no
      writeLinks) foi perdida: o novo setSpawnedFrom/addSpawnedPlan só checava
      truthiness, deixando entrar edge wrong-typed; e migrateSidecarToInline copiava o
      sidecar sem validar (spawnedPlans string viraria slugs por-caractere).
    corrective: >-
      Ao substituir um write path, re-estabelecer o MESMO validador de schema no
      boundary novo (reusar assertValidLinks/o Ajv existente) antes de persistir; e
      validar a fonte legada antes de migrá-la. Uma migração que larga a validação no
      write só falha depois, no validate-state. Locus assertValidLinks em
      setSpawnedFrom/addSpawnedPlan/migrateSidecarToInline (F-002/F-003 do review).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-21-0305-plan-fork-f5.md
    createdAt: 2026-06-21T03:22:06Z
    validatedAt: 2026-06-21T03:22:06Z
---

# Lessons — F5 (handoff aiDeck, docs e migração inline)

Distiladas no phase-done da F5 (review-code --mode=both). Ratificadas pelo usuário.
F5 é a última fase do plan-fork; estas lessons servem projetos futuros (a migração de
formato + a recorrência do valor cross-model são padrões gerais).
