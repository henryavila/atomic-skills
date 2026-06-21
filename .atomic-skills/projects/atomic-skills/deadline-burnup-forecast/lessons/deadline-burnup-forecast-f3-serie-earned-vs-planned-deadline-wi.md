---
schemaVersion: "0.2"
slug: deadline-burnup-forecast-f3-serie-earned-vs-planned-deadline-wi
projectId: atomic-skills
parentPlan: deadline-burnup-forecast
lessons:
  - id: L-001
    statement: >-
      Uma métrica cumulativa sobre um log append-only que mistura eventos
      por-task (`task-done`) e agregados (`phase-done`) faz double-count se somar
      todos os eventos — no fechamento de fase o `phase-done` agregado (taskId
      null, weight default 1/count) coexiste com os N `task-done` por-task do
      bulk-close, então somar ambos infla o earned (SPI/burn-up acima da
      realidade). O spec original de buildSeries dizia "somar earned-weight de
      todos os eventos".
    corrective: >-
      Ao consumir um log de eventos multi-tipo para uma métrica cumulativa,
      enumerar explicitamente o(s) tipo(s) earned-bearing e FILTRAR por eles
      (`event === 'task-done'`, que cobre done + reconcile + bulk-close por-task e
      exclui o agregado phase-done); nunca especificar "somar todos os eventos".
      Travar com teste + mutation-kill (reverter o filtro → RED). Aplicar em F4
      (actuals crus leem o mesmo completions.jsonl).
    scope: reusable
    appliesTo:
      - F4
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-19-1721-code-deadline-burnup-forecast-f3.md
    createdAt: 2026-06-19T17:29:17Z
    validatedAt: 2026-06-19T17:29:17Z
  - id: L-002
    statement: >-
      Sob a restrição "aiDeck não agrega" (consumer sem engine de compute), uma
      série pré-computada self-sufficient precisa carregar TODOS os parâmetros
      derivados que o render usa — os endpoints da linha planejada
      (started/deadline/weightTotal) — não bastam os pontos da série. Assumir que
      o render relê o frontmatter da fonte deixa entidades sem-eventos
      não-renderizáveis: o estado emitido (plans.json) omitia deadline + totais
      plan-wide, então a linha planejada não era reconstruível para planos sem
      conclusões.
    corrective: >-
      Ao emitir uma série pré-computada para um consumer sem-compute,
      co-localizar no próprio registro emitido todo parâmetro que o consumer
      precisa para desenhá-la (aqui: started/deadline/weightTotal/tasksTotal no
      spi.json). "Não agrega" se estende a "não re-deriva da fonte". Aplicar em F5
      (render do burn-up/SPI) ao ligar widgets aos dataSources.
    scope: reusable
    appliesTo:
      - F5
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-19-1721-code-deadline-burnup-forecast-f3.md
    createdAt: 2026-06-19T17:29:17Z
    validatedAt: 2026-06-19T17:29:17Z
---

# Lessons — deadline-burnup-forecast F3 (Série earned-vs-planned + deadline + wiring de recompute)

Distiladas no phase-done de F3, ratificadas pelo operador. Sinais de falha reais:

- **L-001** veio do finding CRITICAL do review local (Claude, contexto limpo): `buildSeries` somava o weight de TODOS os eventos; o contrato do produtor (`project-transitions.md:138`, `lint-transition-emits.js:31`) emite no phase-done N `task-done` por-task MAIS 1 `phase-done` agregado → double-count. Corrigido na fase (filtro `event === 'task-done'`, commit 41641bf) + teste-lock com mutation-kill. Forward-looking: F4 grava actuals lendo o mesmo log.
- **L-002** veio do finding major F-003 do pass codex cross-model (gpt-5-codex), disjunto do review local — o cross-model se pagou (confirma a lição L-001 de design-brief: `--mode=both` em contrato de mão-única mesmo com diff aditivo). Remediado na fase estendendo spi.json com os params da linha planejada (commit 12edc01). Forward-looking: F5 renderiza o burn-up.

Dispostas no gate de início da próxima fase via `node scripts/list-lessons.js --phase F4` (L-001) e `--phase F5` (L-002).
