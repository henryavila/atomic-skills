---
schemaVersion: "0.1"
slug: fix-aideck-dashboard
title: "fix-aideck-dashboard: corrigir a integração com aiDeck"
version: "1.0"
status: active
started: 2026-06-16T11:57:08.891Z
lastUpdated: 2026-06-16T11:57:08.891Z
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
    title: Redesenho consome os componentes do aiDeck
    body: O redesenho do dashboard consome os componentes do aiDeck e o Claude
      design; não reimplementa um cliente paralelo.
glossary: []
phases:
  - id: F1
    slug: fix-aideck-dashboard-f1-validar-e-aplicar-o-manifesto-project-s
    title: Validar e aplicar o manifesto project-status (nosso lado)
    goal: "Ler /home/henry/aideck/docs/handoffs/atomic-skills-manifest.md, validar
      contra o estado atual do repo e aplicar os ajustes do lado do
      atomic-skills: publicar o consumer manifest em
      ~/.aideck/consumers/project-status/manifest.yaml e migrar
      annotations/highlights/inbox para o layout explícito
      `.atomic-skills/project-status/`, sem tocar no aiDeck."
    dependsOn: []
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: "`GET /api/consumers` lista o consumer `project-status` e editar um
            plano dispara o evento de live-refresh no dashboard."
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: active
    summary: Publica o consumer manifest e migra annotations/highlights/inbox para o
      layout explícito, sem tocar no aiDeck.
  - id: F2
    slug: fix-aideck-dashboard-f2-lista-de-planos-filtrar-os-concluidos
    title: "Lista de planos: filtrar os concluídos"
    goal: Na lista de planos do dashboard, filtrar da visão padrão os planos já
      concluídos (status done e archived), mantendo-os acessíveis sob um filtro
      explícito.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: A lista de planos do dashboard oculta os planos done e archived por
            padrão e os expõe via um filtro explícito.
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: pending
    summary: Ajusta a lista de planos do dashboard — oculta concluídos por padrão e
      corrige o live-refresh das mudanças de projeto (lado atomic-skills).
  - id: F3
    slug: fix-aideck-dashboard-f3-repensar-o-dashboard-com-o-claude-desig
    title: Repensar o dashboard com o Claude design
    goal: Redesenhar o dashboard inteiro com o Claude design, consumindo os
      componentes do aiDeck, preservando o contrato de dados do consumer
      project-status.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: Existe um design aprovado do dashboard redesenhado sobre os
            componentes do aiDeck, validado com o usuário.
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: pending
    summary: Redesenha o dashboard com o Claude design sobre os componentes do
      aiDeck, preservando o contrato de dados.
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

O aiDeck aplicou o hard-cut que removeu do runtime genérico o conhecimento embutido de `project-status`. Sem o manifesto do consumer publicado, o dashboard de project-status fica sem live-refresh e `/api/state` não retorna o layout. Esta frente conserta a integração inteiramente do lado do atomic-skills, sem tocar no código do aiDeck, depois melhora a lista de planos e redesenha o dashboard com o Claude design sobre os componentes do aiDeck. Contrato-fonte: /home/henry/aideck/docs/handoffs/atomic-skills-manifest.md. Esqueleto criado com DESIGN deferido (R-ORCH-03): a decomposição em tasks acontece na sessão paralela que adotar esta frente, via brainstorm/implement.

## 2. Inviolable principles

- **P1 Não tocar no aiDeck** — A correção vive inteiramente no lado do atomic-skills (manifesto do consumer, layout de annotations/highlights/inbox, scripts e skills). O código do aiDeck permanece intocado — ele é domain-agnostic por contrato.
- **P2 O contrato do handoff é a fonte de verdade** — O handoff /home/henry/aideck/docs/handoffs/atomic-skills-manifest.md define o contrato do consumer v2; os ajustes seguem esse contrato e são validados contra ele, nunca contra suposição.
- **P3 Redesenho consome os componentes do aiDeck** — O redesenho do dashboard consome os componentes do aiDeck e o Claude design; não reimplementa um cliente paralelo.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_
