---
schemaVersion: "0.2"
slug: design-brief-briefing-rework-f1-validar-regenerar-o-briefing-le
projectId: atomic-skills
parentPlan: design-brief-briefing-rework
lessons:
  - id: L-001
    statement: A 1a tentativa de regen v2 (o gate de nao-reincidencia da F1) re-ingeriu
      os prompts contaminados de 16/jun + a .claude/memory co-localizados no repo Lekto
      e produziu um copy-update do prompt antigo — os 4 contaminantes reapareceram COM
      citacao de constante (SWIPE_THRESHOLD=80, STEP_MS, etc.). A instrucao de cegueira
      ("nao leia os priors") nao vinculou um gerador trabalhando dentro do repo; so foi
      cego de verdade apos gerar de uma copia limpa.
    corrective: Para qualquer geracao que DEVA ser cega/independente (gate de
      nao-reincidencia, regeneracao de validacao), isole a entrada ESTRUTURALMENTE em
      vez de instruir — gere de uma copia que contenha so os insumos-de-registro (o
      codigo do app), sem .claude/, CLAUDE.md, docs/, nem memoria; verifique a copia (0
      prompts anteriores, 0 framing de prompt) ANTES de gerar.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: "f1/recurrence-verdict-v1.md (recaida v1) + commit do achado 'regen v2 falhou a cegueira' + copia limpa /home/henry/lekto-blind-regen (239 arq, 0 prompts)"
    createdAt: 2026-06-19T20:06:21.000Z
    validatedAt: 2026-06-19T20:06:21.000Z
  - id: L-002
    statement: O band-pin (D5) listava "counts" no escopo mas o unico EXEMPLO de
      calibracao em todos os emissores era um tempo (~8s). O gerador cego (v1)
      generalizou mal e cravou a contagem de onboarding ("3 passos") como requisito — a
      recaida A4 — band-pinando o tempo mas nao a contagem vizinha.
    corrective: Quando uma regra cobre uma CATEGORIA de valores (tempos / contagens /
      comprimentos), de um exemplo trabalhado por classe — ou declare explicitamente
      "toda grandeza quantitativa igual" — em vez de um unico exemplo de uma classe. Um
      exemplo so de tempo ensina so tempo. Aplicado em T-006 nos dois emissores.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: "T-006 (skills/core/design-brief.md + skills/shared/design-brief-assets/screens-prompt.md); v1 recaida A4 -> v2 NAO-REINCIDENTE"
    createdAt: 2026-06-19T20:06:21.000Z
    validatedAt: 2026-06-19T20:06:21.000Z
  - id: L-003
    statement: O range do review gate de fase calculado por `git log --before=<phase.started>`
      capturou a cauda da F0 (three-layer-briefing, anti-contamination, fixtures-recipe)
      porque o started da F1 (09:32) precedia os commits de fechamento da F0 (~15:xx) —
      o range largo dbb64c2..HEAD em vez do real acc3141..HEAD.
    corrective: Para o range do review gate, ancore no COMMIT de phase-done da fase
      anterior (ex. acc3141), nao no timestamp wall-clock started da fase — uma fase pode
      iniciar (started) antes de a anterior fechar seus commits, e ai o heuristico
      by-timestamp inclui a cauda ja revisada da fase anterior.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: "phase-done F1 — range corrigido de dbb64c2..HEAD (largo, incluia caudas F0) para acc3141..HEAD"
    createdAt: 2026-06-19T20:06:21.000Z
    validatedAt: 2026-06-19T20:06:21.000Z
---

# Lessons — F1 Validar (regenerar o briefing Lekto + gate de não-reincidência)

Distiladas no phase-done da F1 a partir dos sinais reais de falha: a recaída A4 do v1 (band-pin só exemplificava tempo), a falha de cegueira do v2 (priors contaminados co-localizados re-ingeridos), e o range largo do heurístico de review. Ratificadas pelo operador. Fases futuras dispõem as reusáveis+open via `node scripts/list-lessons.js`.
