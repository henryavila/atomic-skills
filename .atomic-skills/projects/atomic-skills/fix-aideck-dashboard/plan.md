---
schemaVersion: "0.1"
slug: fix-aideck-dashboard
title: "fix-aideck-dashboard: corrigir a integração com aiDeck"
version: "1.0"
status: active
started: 2026-06-16T11:57:08.891Z
lastUpdated: 2026-06-16T12:40:58Z
branch: plan/fix-aideck-dashboard
currentPhase: F1
parallelismAllowed: false
principles:
  - id: P1
    title: Não tocar no aiDeck
    body: A correção vive inteiramente no lado do atomic-skills (manifesto do
      consumer, layout de annotations/highlights/inbox, scripts e skills). O
      código do aiDeck permanece intocado — ele é domain-agnostic por contrato.
  - id: P2
    title: O contrato do handoff é a fonte de verdade
    body: O handoff /home/henry/aideck/docs/handoffs/atomic-skills-manifest.md
      define o contrato do consumer v2; os ajustes seguem esse contrato e são
      validados contra ele, nunca contra suposição.
  - id: P3
    title: O dashboard é o nosso cliente React, servido pelo aiDeck
    body: O dashboard é o cliente React próprio do atomic-skills (src/dashboard/),
      buildado para dist/dashboard/ e servido pelo aiDeck via --static-dir. O
      aiDeck é o backend (API + SSE); o redesenho evolui esse cliente com o
      Claude design, sem forkar um cliente paralelo e preservando o contrato de
      dados do consumer.
glossary: []
phases:
  - id: F1
    slug: fix-aideck-dashboard-f1-validar-e-aplicar-o-manifesto-project-s
    title: "Consertar o cliente do dashboard (dados, live-refresh e filtro de lista)"
    goal: "Consertar o cliente do dashboard (src/dashboard/) para falar com o
      consumer por-projeto que o aiDeck registra (id = projectId) em vez do
      consumer fixo `project-status`, assinar o evento SSE `data_changed`
      (renomeado de `state-change` no hard-cut do aiDeck), reconciliar o layout
      universal annotations/highlights/inbox sob `.atomic-skills/<projectId>/`, e
      filtrar da lista os planos concluídos (done/archived) por padrão. Sem tocar
      no aiDeck."
    dependsOn: []
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: "`GET /api/consumers` lista o consumer do projeto (id = projectId)
            e editar um plano dispara o evento `data_changed`, que faz o
            dashboard re-buscar o estado (live-refresh end-to-end)."
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
        - id: G-2
          description: A lista de planos do dashboard oculta os planos done e archived por
            padrão e os expõe via um filtro explícito.
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: active
    summary: Faz o cliente do dashboard falar com o consumer por-projeto, assinar o
      evento data_changed e ocultar planos concluídos da lista — sem tocar no aiDeck.
  - id: F2
    slug: fix-aideck-dashboard-f2-repensar-o-dashboard-com-o-claude-desig
    title: Repensar o dashboard com o Claude design
    goal: Redesenhar o cliente React próprio do atomic-skills (src/dashboard/,
      servido pelo aiDeck via --static-dir) com o Claude design, preservando o
      contrato de dados do consumer por-projeto consertado em F1.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: Existe um design aprovado do cliente React próprio (src/dashboard)
            redesenhado com o Claude design, validado com o usuário.
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: pending
    summary: Redesenha o cliente React próprio (src/dashboard) com o Claude design,
      preservando o contrato de dados do consumer.
references:
  - kind: file
    path: /home/henry/aideck/docs/handoffs/atomic-skills-manifest.md
    label: Handoff aiDeck — contrato do consumer project-status (manifesto + layout
      + live-refresh)
planActive: true
planTitle: "fix-aideck-dashboard: corrigir a integração com aiDeck"
---

# fix-aideck-dashboard: corrigir a integração com aiDeck

## 1. Context

O aiDeck aplicou o hard-cut (`b3fad45 refactor(watcher): manifest-driven file classification`) que removeu do runtime genérico o conhecimento embutido de `project-status`: o consumer fixo `DEFAULT_CONSUMER` deixou de existir, o watcher passou a classificar arquivos pelos globs de cada consumer registrado e o evento SSE `state-change` foi renomeado para `data_changed` (payload `{consumer, projectId, dataSourceId}`). O `provision-consumer.js` já provisiona o consumer **por-projeto** (id = projectId) corretamente — mas o cliente do dashboard (`src/dashboard/lib/api.ts`) ainda fixa `CONSUMER = 'project-status'` e assina o evento removido `state-change`, então o dashboard busca um consumer inexistente (estado vazio) e nunca recebe live-refresh.

Esta frente conserta a integração inteiramente do lado do atomic-skills, sem tocar no aiDeck: **F1** alinha o cliente ao consumer por-projeto + evento `data_changed`, reconcilia o layout universal annotations/highlights/inbox e filtra os planos concluídos da lista; **F2** redesenha o cliente React próprio com o Claude design. Contrato-fonte: o hard-cut do aiDeck (`b3fad45`) + `/home/henry/aideck/docs/handoffs/atomic-skills-manifest.md` (cuja referência literal a um consumer `project-status` está superada — o consumer é o projectId). O commit do hard-cut é local, ainda não publicado no npm.

## 2. Inviolable principles

- **P1 Não tocar no aiDeck** — A correção vive inteiramente no lado do atomic-skills (manifesto do consumer, layout de annotations/highlights/inbox, scripts e skills). O código do aiDeck permanece intocado — ele é domain-agnostic por contrato.
- **P2 O contrato do handoff é a fonte de verdade** — O handoff /home/henry/aideck/docs/handoffs/atomic-skills-manifest.md define o contrato do consumer v2; os ajustes seguem esse contrato e são validados contra ele, nunca contra suposição.
- **P3 O dashboard é o nosso cliente React, servido pelo aiDeck** — O dashboard é o cliente React próprio do atomic-skills (`src/dashboard/`), buildado para `dist/dashboard/` e servido pelo aiDeck via `--static-dir`. O aiDeck é o backend (API + SSE); o redesenho evolui esse cliente com o Claude design, sem forkar um cliente paralelo e preservando o contrato de dados do consumer.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_
