---
schemaVersion: "0.2"
slug: plan-fork-f1-verbo-fork-plan-degrau-7-5-pause-only-at
projectId: atomic-skills
parentPlan: plan-fork
lessons:
  - id: L-001
    statement: A rejeição de `--mode parallel` vivia só na prosa "Mode semantics" (um
      forward-ref do step 7), não num step numerado; um executor andando os Steps do
      procedure top-to-bottom parseava parallel como válido (está no enum), passava o
      cycle-check, ratificava e chegava ao write do sidecar — exatamente o "edge
      parallel stranded" que o doc dizia nunca poder acontecer.
    corrective: Toda guarda que protege uma mutação num procedure numerado deve ser um
      STEP NUMERADO no ponto em que se aplica, nunca um forward-ref para prosa abaixo
      do procedure — um executor literal pula a prosa. Locus
      skills/shared/project-assets/project-emergence.md fork-plan step 2 (corrigido em
      4e23baf).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-19-1956-plan-fork-f1.md
    createdAt: 2026-06-19T19:56:59Z
    validatedAt: 2026-06-19T19:56:59Z
  - id: L-002
    statement: O write do elo (setSpawnedFrom) fazia mkdirSync mais escrita do
      links.json antes do plano-filho ser materializado pelo handoff new plan; um abort
      do handoff (DESIGN gate HARD-BLOCK ou cancel do usuário) deixava um links.json
      órfão mais um back-edge addSpawnedPlan apontando pra um filho que nunca existiu,
      sem rollback.
    corrective: Escreva um elo/back-edge DEPOIS que a entidade dependente que ele
      aponta está materializada, ou pareie o write adiantado com rollback explícito no
      abort do passo que materializa. Locus
      skills/shared/project-assets/project-emergence.md fork-plan steps 7-8 (corrigido
      em 4e23baf).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-19-1956-plan-fork-f1.md
    createdAt: 2026-06-19T19:56:59Z
    validatedAt: 2026-06-19T19:56:59Z
  - id: L-003
    statement: O doc dizia "reusa cascade-pause" pra pausar a fase-âncora nomeada
      (--from), mas cascade-pause demota a fase que está active POR STATUS, não a
      nomeada; como --from era validado só por existência, um âncora diferente da fase
      ativa pausaria a fase errada.
    corrective: Ao reusar um mecanismo existente, confira que o predicado de seleção
      dele bate com o seu alvo; pause/aja sobre o alvo NOMEADO explicitamente, ou
      constranja o input pra coincidir (aqui --from foi constrangido a == currentPhase).
      Locus skills/shared/project-assets/project-emergence.md fork-plan step 1 e step 6.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-19-1956-plan-fork-f1.md
    createdAt: 2026-06-19T19:56:59Z
    validatedAt: 2026-06-19T19:56:59Z
  - id: L-004
    statement: Um Edit cujo old_string ERA um heading de seção usado como anchor de
      inserção consumiu o heading sem re-anexá-lo no new_string; o heading sumiu, a
      seção seguinte ficou órfã, e o grep verifier ainda passou (presença de token não
      é integridade estrutural). Foi um own-goal de T-001 corrigido em T-004.
    corrective: Quando o old_string de um Edit É um heading (ou qualquer anchor
      estrutural) usado como ponto de inserção, inclua-o de volta no new_string; após
      um Edit que move/insere seção, rode `grep -n '^#' <arquivo>` e confira a lista de
      headings. Locus skills/shared/project-assets/project-emergence.md.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-19-1956-plan-fork-f1.md
    createdAt: 2026-06-19T19:56:59Z
    validatedAt: 2026-06-19T19:56:59Z
  - id: L-005
    statement: O gate F1-G1 são greps de presença de token (verifier fraco); o review
      local mesmo-modelo achou 5 defeitos procedurais reais que nenhum grep pegaria.
      Tratar grep verde como "procedure correto" teria fechado a fase com os 5 bugs.
    corrective: Uma fase de autoria editorial (gate por grep de token) carrega a
      qualidade no REVIEW gate, não no verifier; rode o review-code sobre o diff da
      fase sempre e não trate o grep verde como suficiente. Reforça a L-001 da F0
      (review pega o que o verifier de admissão não pega).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-19-1956-plan-fork-f1.md
    createdAt: 2026-06-19T19:56:59Z
    validatedAt: 2026-06-19T19:56:59Z
---

# Lessons — plan-fork F1 (Verbo fork-plan + degrau 7.5)

Destiladas no phase-done da F1, a partir dos 5 achados confirmados do `review-code`
(local, envelope selado) sobre `d11705c..HEAD` — ver
`.atomic-skills/reviews/2026-06-19-1956-plan-fork-f1.md`. Ratificadas pelo operador
(L-001..L-005). Os 5 achados (2 critical, 2 major, 1 minor) foram todos corrigidos em
`4e23baf` antes do gate F1-G1 ser marcado `met`.
