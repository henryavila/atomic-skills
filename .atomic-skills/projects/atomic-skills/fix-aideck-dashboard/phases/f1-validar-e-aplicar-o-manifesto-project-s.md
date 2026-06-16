---
schemaVersion: "0.1"
slug: fix-aideck-dashboard-f1-validar-e-aplicar-o-manifesto-project-s
title: "Consertar o cliente do dashboard (dados, live-refresh e filtro de lista)"
goal: "Consertar o cliente do dashboard (src/dashboard/) para falar com o
  consumer por-projeto que o aiDeck registra (id = projectId) em vez do consumer
  fixo `project-status`, assinar o evento SSE `data_changed` (renomeado de
  `state-change` no hard-cut b3fad45 do aiDeck), reconciliar o layout universal
  annotations/highlights/inbox sob `.atomic-skills/<projectId>/`, e filtrar da
  lista de planos os concluídos (done/archived) por padrão. Sem tocar no aiDeck —
  a correção vive no cliente do atomic-skills."
status: active
branch: plan/fix-aideck-dashboard
started: 2026-06-16T11:57:08.891Z
lastUpdated: 2026-06-16T12:40:58Z
nextAction: Tornar o consumer id dinâmico em src/dashboard/lib/api.ts (remover o
  literal `project-status`, resolver projectId) nos 5 call-sites; depois migrar
  a assinatura SSE para `data_changed`.
summary: Faz o cliente do dashboard falar com o consumer por-projeto, assinar o
  evento data_changed e ocultar planos concluídos da lista — sem tocar no aiDeck.
parentPlan: fix-aideck-dashboard
phaseId: F1
tasksDone: 0
tasksTotal: 4
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: "`GET /api/consumers` lista o consumer do projeto (id = projectId) e
      editar um plano dispara o evento `data_changed`, que faz o dashboard
      re-buscar o estado (live-refresh end-to-end)."
    status: pending
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
  - id: G-2
    description: A lista de planos do dashboard oculta os planos done e archived por
      padrão e os expõe via um filtro explícito.
    status: pending
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
stack:
  - id: 1
    title: "Consertar o cliente do dashboard (dados, live-refresh e filtro de lista)"
    type: task
    openedAt: 2026-06-16T11:57:08.891Z
tasks:
  - id: T-001
    title: Resolver o consumer id por-projeto no cliente do dashboard
    summary: Substitui o consumer hardcoded `project-status` pelo projectId resolvido
      em todos os call-sites de api.ts.
    status: pending
    lastUpdated: 2026-06-16T12:40:58Z
    description: "src/dashboard/lib/api.ts linha 18 fixa `const CONSUMER =
      'project-status'`, usado em /api/projects/${projectId}/state/${CONSUMER}
      (39), /api/projects/${projectId}/state/${CONSUMER}/${slug} (44),
      /api/state/${CONSUMER} (101), /api/state/${CONSUMER}/${slug} (112) e
      /api/inbox?consumer=${CONSUMER} (133). O aiDeck pós-hard-cut registra um
      consumer por-projeto (id = projectId, ex. `atomic-skills`), então essas
      rotas resolvem para um consumer inexistente e retornam estado vazio.
      Resolver o consumer id a partir do projectId (já disponível via
      /api/projects) e usá-lo nos 5 call-sites. `bootstrap-drafts` (linha 138)
      permanece um consumer distinto e não muda."
    acceptance:
      - api.ts não contém mais o literal `project-status` como consumer id
      - os 5 call-sites usam o projectId resolvido como consumer
      - "GET /api/projects/<projectId>/state/<projectId> retorna os registros de plano"
    verifier:
      kind: shell
      command: "! grep -q \"'project-status'\" src/dashboard/lib/api.ts"
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/dashboard/lib/api.ts
  - id: T-002
    title: Migrar a assinatura SSE para o evento data_changed
    summary: Troca o evento SSE `state-change` por `data_changed` e re-busca filtrando
      por consumer === projectId; remove os campos mortos do payload.
    status: pending
    lastUpdated: 2026-06-16T12:40:58Z
    description: "src/dashboard/lib/api.ts subscribeToEvents (238-251) assina
      ['state-change','error','health-tick']; o tipo RuntimeEvent carrega
      `entityKind`/`slug`/`changeType` (225-228). O hard-cut b3fad45 do aiDeck
      removeu `state-change`/`EntityKind` e passou a emitir `data_changed` com
      payload `{consumer, projectId, dataSourceId}`. Atualizar o listener para
      `data_changed`, ajustar RuntimeEvent ao novo payload e disparar o re-fetch
      quando `event.consumer === projectId` atual. Remover os campos mortos."
    acceptance:
      - subscribeToEvents assina o evento `data_changed`
      - RuntimeEvent reflete o payload {consumer, projectId, dataSourceId}
      - editar um plano faz o dashboard re-buscar o estado (live-refresh)
    verifier:
      kind: shell
      command: "grep -q data_changed src/dashboard/lib/api.ts && ! grep -q
        \"'state-change'\" src/dashboard/lib/api.ts"
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/dashboard/lib/api.ts
  - id: T-003
    title: Reconciliar o layout universal annotations/highlights/inbox
    summary: Confirma que o layout universal resolve sob .atomic-skills/<projectId>/ e
      documenta que não há escrita flat legada a migrar.
    status: pending
    lastUpdated: 2026-06-16T12:40:58Z
    description: "O aiDeck resolve o layout universal via consumerRoot(rootDir,
      consumerId) = <rootDir>/.atomic-skills/<consumerId>/ (paths.ts:22-25), com
      consumerId = projectId; as MCP write tools (aideck_annotate/highlight/
      record_decision) escrevem nesse caminho. O handoff antigo citava
      `.atomic-skills/project-status/` — obsoleto agora que o consumer é o
      projectId. Verificar que nenhuma skill escreve num layout flat
      `.atomic-skills/{annotations,highlights,inbox}/` nem em
      `.atomic-skills/project-status/`; o inbox do discover usa o consumer
      separado `bootstrap-drafts`. Documentar a conclusão (no-op ou migração
      concreta) no body desta iniciativa."
    acceptance:
      - grep não encontra writer para layout flat nem para `project-status/`
      - conclusão (no-op vs migração) registrada na seção Decisions desta iniciativa
    verifier:
      kind: manual
      description: Conferir a conclusão documentada com o usuário no phase-done.
  - id: T-004
    title: Filtrar da lista os planos done e archived
    summary: Oculta planos done/archived da lista por padrão, com filtro explícito
      para revê-los.
    status: pending
    lastUpdated: 2026-06-16T12:40:58Z
    description: "A lista de planos é renderizada em
      src/dashboard/components/home/Roadmap.tsx, que distribui os planos em lanes
      (inflight/blocked/upnext/parked/shipped) sem um controle para ocultar os
      concluídos. Ocultar por padrão os planos com status done e archived (lane
      shipped + archived) e expor um filtro/toggle explícito para revê-los. O
      live-refresh dessas mudanças vem de T-002 (evento data_changed), não desta
      task."
    acceptance:
      - planos done e archived ficam ocultos na visão padrão da lista
      - um filtro/toggle explícito os exibe novamente
    verifier:
      kind: manual
      description: Conferir o comportamento de filtro na lista de planos com o usuário.
parked: []
emerged: []
planTitle: "fix-aideck-dashboard: corrigir a integração com aiDeck"
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Validar e aplicar o manifesto project-status (nosso lado)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
