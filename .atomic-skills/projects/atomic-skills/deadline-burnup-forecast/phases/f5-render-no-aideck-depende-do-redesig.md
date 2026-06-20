---
schemaVersion: "0.1"
slug: deadline-burnup-forecast-f5-render-no-aideck-depende-do-redesig
title: Render no aiDeck (depende do redesign do dashboard)
goal: "registrar os dataSources burnup/spi no manifest e uma página com
  line-chart (2 séries) + stat SPI, usando só widgets publicados. DEPENDÊNCIA
  EXTERNA: bloqueada até o redesign do dashboard (plano fix-aideck-dashboard,
  F2) aterrissar — o forecast só renderiza sobre o dashboard refeito; por isso é
  a última fase. As fases F0–F4 (instrumentação de tracking) são independentes e
  implementáveis já."
status: pending
branch: plan/deadline-burnup-forecast
started: 2026-06-17T12:06:57.781Z
lastUpdated: 2026-06-17T16:06:30Z
nextAction: "BLOQUEADA — aguarda o redesign do dashboard (fix-aideck-dashboard F2); handoff em docs/handoffs/forecast-render-requirements.md. Não iniciar T-001 até o manifest refeito aterrissar."
parentPlan: deadline-burnup-forecast
phaseId: F5
tasksDone: 0
tasksTotal: 1
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 1
exitGates:
  - id: G-1
    description: a página de ritmo renderiza com widgets reais ligados a
      burnup.json/spi.json, sobre o dashboard refeito.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/aideck-consumer-manifest.test.js
    verifierLabel: "shell: node --test tests/aideck-consumer-manifest.test.js"
externalImports:
  - kind: repo-path
    path: .atomic-skills/projects/atomic-skills/fix-aideck-dashboard/plan.md
    label: "BLOQUEANTE: o redesign do dashboard (fix-aideck-dashboard, F2) deve
      aterrissar antes do render — F5 não inicia sem o manifest refeito
      presente."
    inside_repo: true
stack:
  - id: 1
    title: Render no aiDeck (depende do redesign do dashboard)
    type: task
    openedAt: 2026-06-17T12:06:57.781Z
tasks:
  - id: T-001
    title: — dataSources + página burn-up no manifest
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
parked: []
emerged: []
summary: Renderiza o burn-up/SPI no dashboard — bloqueada até o redesign do
  dashboard aterrissar.
planTitle: Deadline Burn-up Forecast (Earned Value / SPI)
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F5 — Render no aiDeck (depende do redesign do dashboard)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F5 (`Render no aiDeck`) continua `pending` — T-001 NÃO iniciada. Investigação read-only (3 agentes) concluída e o handoff `docs/handoffs/forecast-render-requirements.md` foi REESCRITO para o estado verificado. **Premissa corrigida:** o redesign do dashboard NÃO tem trabalho de render a fazer pelo F5 — o cliente React (`src/dashboard/`) foi removido (`38cf2a9`, ancestral comum), o dashboard é 100% manifest-driven (cliente Vue do aiDeck) e os widgets que o F5 precisa (`line-chart` multi-série, `stat`, `gauge`) JÁ existem no runtime publicado. O F5 é, portanto, uma tarefa pura de manifest + emitter (o emitter `buildSeries` já está nesta branch via F0–F4).
- **Decision log:** (a) Não iniciar T-001. (b) O gate real do F5 deixou de ser "o dashboard implementar algo" e passou a ser **integração de branch**: minha branch tem o manifest VELHO (`nav.style:tabs`, sem `meta/aideck-widget-registry.json`, sem guardrail `tests/aideck-manifest-widget-registry.test.js`); o manifest redesenhado + registry + guardrail estão em `plan/fix-aideck-dashboard` (8 commits à frente, NÃO mergeados). F5 não pode construir sobre o manifest velho (seria clobberado). (c) Contratos aterrados na fonte (não imaginados): paths/schemas de `burnup`/`spi`, gramática do `line-chart` (`config.series: string[]`), scoping `param.match [projectId, {field: planSlug, param: slug}]`.
- **Single nextAction:** Decisão do usuário sobre o caminho de integração (recomendado: merge `plan/fix-aideck-dashboard` → `plan/deadline-burnup-forecast`, depois implementar T-001 do F5 aqui). NÃO implementar F5 antes da integração.
- **Verbatim state:** redesign em `plan/fix-aideck-dashboard` (commits ausentes aqui: `16e7e91 nav.style:projects`, `a8e17fe guardrail`); minha branch manifest `assets/aideck-consumer/manifest.yaml` = `nav.style: tabs`, sem burnup/spi; emitter `scripts/emit-consumer-state.js` (`buildSeries`); verifier F5 `node --test tests/aideck-consumer-manifest.test.js` (passa 12/0 no manifest atual); handoff `docs/handoffs/forecast-render-requirements.md` (reescrito); pré-req de dado: o plano precisa declarar `deadline` antes do F5.
- **Uncommitted changes:** `phases/f5-render-no-aideck-depende-do-redesig.md` (este bloco) + `docs/handoffs/forecast-render-requirements.md` (reescrito); resto da árvore limpo.
