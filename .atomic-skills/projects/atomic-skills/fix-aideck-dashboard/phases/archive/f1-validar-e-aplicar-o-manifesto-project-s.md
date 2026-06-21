---
schemaVersion: "0.1"
slug: fix-aideck-dashboard-f1-validar-e-aplicar-o-manifesto-project-s
title: Consertar o cliente do dashboard (dados, live-refresh e filtro de lista)
goal: Consertar o cliente do dashboard (src/dashboard/) para falar com o
  consumer por-projeto que o aiDeck registra (id = projectId) em vez do consumer
  fixo `project-status`, assinar o evento SSE `data_changed` (renomeado de
  `state-change` no hard-cut b3fad45 do aiDeck), reconciliar o layout universal
  annotations/highlights/inbox sob `.atomic-skills/<projectId>/`, e filtrar da
  lista de planos os concluídos (done/archived) por padrão. Sem tocar no aiDeck
  — a correção vive no cliente do atomic-skills.
status: active
branch: plan/fix-aideck-dashboard
started: 2026-06-16T11:57:08.891Z
lastUpdated: 2026-06-16T14:12:13Z
nextAction: "RE-ESCOPAR F1 (decisão do usuário) — re-planejar para incluir a
  migração do cliente v1 state API → v2 dataSource API (ver D-4). Rodar
  brainstorm/decompose; implement está PAUSADO. T-004 blocked; T-001/002/003 a
  reavaliar no re-plano."
summary: Faz o cliente do dashboard falar com o consumer por-projeto, assinar o
  evento data_changed e ocultar planos concluídos da lista — sem tocar no
  aiDeck.
parentPlan: fix-aideck-dashboard
phaseId: F1
tasksDone: 3
tasksTotal: 4
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: "`GET /api/consumers` lista o consumer do projeto (id = projectId)
      e editar um plano dispara o evento `data_changed`, que faz o dashboard
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
    title: Consertar o cliente do dashboard (dados, live-refresh e filtro de lista)
    type: task
    openedAt: 2026-06-16T11:57:08.891Z
tasks:
  - id: T-001
    title: Resolver o consumer id por-projeto no cliente do dashboard
    summary: Substitui o consumer hardcoded `project-status` pelo projectId
      resolvido em todos os call-sites de api.ts.
    status: done
    lastUpdated: 2026-06-16T13:42:50Z
    closedAt: 2026-06-16T13:42:50Z
    description: src/dashboard/lib/api.ts linha 18 fixa `const CONSUMER =
      'project-status'`, usado em /api/projects/${projectId}/state/${CONSUMER}
      (39), /api/projects/${projectId}/state/${CONSUMER}/${slug} (44),
      /api/state/${CONSUMER} (101), /api/state/${CONSUMER}/${slug} (112) e
      /api/inbox?consumer=${CONSUMER} (133). O aiDeck pós-hard-cut registra um
      consumer por-projeto (id = projectId, ex. `atomic-skills`), então essas
      rotas resolvem para um consumer inexistente e retornam estado vazio.
      Resolver o consumer id a partir do projectId (já disponível via
      /api/projects) e usá-lo nos 5 call-sites. `bootstrap-drafts` (linha 138)
      permanece um consumer distinto e não muda.
    acceptance:
      - api.ts não contém mais o literal `project-status` como consumer id
      - os 5 call-sites usam o projectId resolvido como consumer
      - GET /api/projects/<projectId>/state/<projectId> retorna os registros de
        plano
    verifier:
      kind: shell
      command: "! grep -q \"'project-status'\" src/dashboard/lib/api.ts"
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/dashboard/lib/api.ts
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T13:42:50Z
      passed: true
      exitCode: 0
      outputSummary: "`! grep -q \"'project-status'\" src/dashboard/lib/api.ts` → exit
        0 (literal ausente). typecheck:dashboard (tsc --noEmit) exit 0. As rotas
        project-scoped usam consumer=projectId; as legacy resolvem o projectId
        default via /api/projects (match com health.rootDir)."
  - id: T-002
    title: Migrar a assinatura SSE para o evento data_changed
    summary: Troca o evento SSE `state-change` por `data_changed` e re-busca
      filtrando por consumer === projectId; remove os campos mortos do payload.
    status: done
    lastUpdated: 2026-06-16T13:46:53Z
    closedAt: 2026-06-16T13:46:53Z
    description: src/dashboard/lib/api.ts subscribeToEvents (238-251) assina
      ['state-change','error','health-tick']; o tipo RuntimeEvent carrega
      `entityKind`/`slug`/`changeType` (225-228). O hard-cut b3fad45 do aiDeck
      removeu `state-change`/`EntityKind` e passou a emitir `data_changed` com
      payload `{consumer, projectId, dataSourceId}`. Atualizar o listener para
      `data_changed`, ajustar RuntimeEvent ao novo payload e disparar o re-fetch
      quando `event.consumer === projectId` atual. Remover os campos mortos.
    acceptance:
      - subscribeToEvents assina o evento `data_changed`
      - RuntimeEvent reflete o payload {consumer, projectId, dataSourceId}
      - editar um plano faz o dashboard re-buscar o estado (live-refresh)
    verifier:
      kind: shell
      command: grep -q data_changed src/dashboard/lib/api.ts && ! grep -q
        "'state-change'" src/dashboard/lib/api.ts
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/dashboard/lib/api.ts
      - kind: file
        path: src/dashboard/lib/hooks.ts
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T13:46:53Z
      passed: true
      exitCode: 0
      outputSummary: "`grep -q data_changed … && ! grep -q \"'state-change'\" …` →
        exit 0. typecheck:dashboard (tsc --noEmit) exit 0. RuntimeEvent alinhado
        ao contrato real do aiDeck (events/types.ts): kind data_changed|error|
        health-tick, payload {file,dataSourceHint?,dataSourceId?}. hooks.ts
        useStateChangeSubscription filtra data_changed e invalida por prefixo
        (state/plan/initiative/projects) — entityKind/slug não existem mais."
  - id: T-003
    title: Reconciliar o layout universal annotations/highlights/inbox
    summary: Confirma que o layout universal resolve sob .atomic-skills/<projectId>/
      e documenta que não há escrita flat legada a migrar.
    status: done
    lastUpdated: 2026-06-16T14:12:13Z
    closedAt: 2026-06-16T14:12:13Z
    description: O aiDeck resolve o layout universal via consumerRoot(rootDir,
      consumerId) = <rootDir>/.atomic-skills/<consumerId>/ (paths.ts:22-25), com
      consumerId = projectId; as MCP write tools (aideck_annotate/highlight/
      record_decision) escrevem nesse caminho. O handoff antigo citava
      `.atomic-skills/project-status/` — obsoleto agora que o consumer é o
      projectId. Verificar que nenhuma skill escreve num layout flat
      `.atomic-skills/{annotations,highlights,inbox}/` nem em
      `.atomic-skills/project-status/`; o inbox do discover usa o consumer
      separado `bootstrap-drafts`. Documentar a conclusão (no-op ou migração
      concreta) no body desta iniciativa.
    acceptance:
      - grep não encontra writer para layout flat nem para `project-status/`
      - conclusão (no-op vs migração) registrada na seção Decisions desta
        iniciativa
    verifier:
      kind: manual
      description: Conferir a conclusão documentada com o usuário no phase-done.
    evidence:
      verifierKind: manual
      verifiedAt: 2026-06-16T14:12:13Z
      passed: true
      outputSummary: "NO-OP confirmado pelo usuário. Grep (src scripts skills .husky)
        não acha writer p/ layout flat .atomic-skills/{annotations,
        highlights,inbox}/ nem p/ .atomic-skills/project-status/; no disco esses
        dirs não existem. Layout universal escrito só pelo aiDeck em
        .atomic-skills/<projectId>/. Conclusão registrada em Decisions D-2.
        Bônus D-3: corrigido o label de display do card (project-status →
        projectId), autorizado pelo usuário."
  - id: T-004
    title: Filtrar da lista os planos done e archived
    summary: "Código escrito (Roadmap.tsx: lanes shipped/parked ocultas por padrão
      + toggle ConcludedToggle; typecheck exit 0) mas BLOCKED — não verificável
      ao vivo porque o cliente ainda fala v1 e o dashboard mostra vazio (D-4)."
    status: blocked
    blockedBy:
      - "D-4: dashboard precisa migrar v1→v2 antes da lista mostrar planos"
    lastUpdated: 2026-06-16T14:12:13Z
    description: A lista de planos é renderizada em
      src/dashboard/components/home/Roadmap.tsx, que distribui os planos em
      lanes (inflight/blocked/upnext/parked/shipped) sem um controle para
      ocultar os concluídos. Ocultar por padrão os planos com status done e
      archived (lane shipped + archived) e expor um filtro/toggle explícito para
      revê-los. O live-refresh dessas mudanças vem de T-002 (evento
      data_changed), não desta task.
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

- **D-1 (T-001) — Resolução do consumer id.** Pós-hard-cut `b3fad45` do aiDeck, o
  consumer id É o projectId (provision-consumer registra um consumer por projeto
  keyed por projectId; o diretório vira `<rootDir>/.atomic-skills/<projectId>/`).
  Decisão: as rotas project-scoped (`getProjectState`, `getProjectEntityBySlug`)
  usam `consumer = projectId` (o argumento). As rotas legacy `/api/state/:consumer`
  (`getState`, `getEntityBySlug`, `getInbox`) operam no projeto default (rootDir)
  do aiDeck (handler `src/server/routes/api.ts:175` "uses rootDir / default
  project") e não têm projectId no escopo — resolvem o projectId default via
  `/api/projects` casando `rootDir === /api/health.rootDir` (fallback `projects[0]`),
  cacheado por sessão (`resolveDefaultConsumer`, cache limpo em falha p/ retry).
  Mantém a mudança inteira em `api.ts` sem alterar assinaturas → sem ripple para
  `hooks.ts`. `DISCOVER_CONSUMER = 'bootstrap-drafts'` permanece distinto e não muda.

- **D-2 (T-003) — Reconciliação do layout universal: NO-OP.** Grep no repo
  (`src scripts skills .husky`) não encontra **nenhum** writer para o layout flat
  `.atomic-skills/{annotations,highlights,inbox}/` (grupo A vazio) nem para um
  diretório de consumer `.atomic-skills/project-status/`. No disco: não existem
  `.atomic-skills/project-status/`, nem `.atomic-skills/{annotations,highlights,
  inbox}/`, nem ainda `.atomic-skills/atomic-skills/` (provisionado lazy pelo
  aiDeck no primeiro annotate/highlight). O layout universal é escrito
  **exclusivamente** pelas MCP write tools do aiDeck em
  `<rootDir>/.atomic-skills/<consumerId=projectId>/` (`paths.ts:22-25`
  `consumerRoot`); o repo atomic-skills nunca escreve esse layout. Logo **não há
  migração a fazer** — a reconciliação é um no-op confirmado.
  As referências a `'project-status'` que o grep achou NÃO são writers de layout:
  `src/install.js:285` (lista de skills removidas), `hooks.ts:16,31` (cache keys
  do TanStack — invalidadas por prefixo `['state']` em T-002), `types.ts:199`
  (literal de tipo) e `adapters.ts:458-459` (label de display do card no Home).

- **D-3 (emergente, autorizado pelo usuário) — Card do Home mostra o projectId.**
  Achado durante T-003: o card do Home exibia o label fixo `'project-status'`
  (`adapters.ts:adaptStateForHome`). Causa raiz: o projection de estado do aiDeck
  **hardcoda** `state.consumer = 'project-status'` na wire (`state.ts:87`, lado
  aiDeck — não tocado, P1), então o type literal `types.ts:199 consumer:
  'project-status'` está correto quanto à wire e foi **mantido**. Fix do lado do
  cliente: `adaptStateForHome(state, consumerId = state.consumer)` passa a aceitar
  o projectId real, e os 3 call-sites o fornecem — `HomePage` ProjectCardWrapper
  (`project.projectId`), `HomePage` SingleProjectHome (projectId derivado do
  rootDir) e `ProjectDetailPage` (param de rota). `UIConsumer.id` é só React
  `key` e `name`/`path` são só display (sem routing) → mudança segura.
  `typecheck:dashboard` exit 0. Fora dos verifiers de T-001..T-004 (display
  polish), registrado aqui por rastreabilidade.

- **D-4 (ACHADO CRÍTICO — premissa de F1 incompleta) — Dashboard na geração de
  API errada (v1 legacy) enquanto os dados vivem na v2 manifest-driven.**
  Verificado ao vivo contra o aiDeck pós-hard-cut (`/home/henry/aideck/dist/cli.js`,
  b3fad45) servindo `rootDir=/home/henry/atomic-skills`:
  - **v1 state API** (que `api.ts` usa: `/api/state/:consumer` e
    `/api/projects/:projectId/state/:consumer` → `buildAllForConsumer` →
    `consumerRoot = .atomic-skills/<consumer>/{plans,initiatives}/`): retorna
    `{"error":{"code":"consumer_unknown","message":"consumer \"atomic-skills\"
    has no plans or initiatives","suggestion":"Create files under
    .atomic-skills/atomic-skills/plans/..."}}`. O layout flat não existe.
  - **v2 dataSource API** (`/api/consumers/atomic-skills/projects/atomic-skills/data/plans`):
    retorna `{records:[...], count:13}` — planos active/paused/archived reais. O
    manifest define `plans: .atomic-skills/projects/*/*/plan.md` (root:project,
    captures projectId/planSlug), `initiatives: …/phases/*.md`,
    `initiatives_archive: …/phases/archive/*.md`. Casa o layout NESTED.
  Conclusão: o hard-cut moveu a leitura de dados para a v2; a v1 state API ficou
  legacy lendo só o layout flat antigo. **T-001/T-002 (consumer literal + evento
  SSE) eram necessárias mas NÃO suficientes** — o cliente inteiro está na v1.
  O exit-gate **G-1** (dados vivos + live-refresh) **FALHA** hoje.
  **Decisão do usuário (2026-06-16): re-escopar F1** para incluir a migração
  `api.ts`+`adapters.ts`+`types.ts` da v1 state API → v2 dataSource API
  (endpoints E shape de resposta diferentes: `records[]` com `data` de
  frontmatter, dataSources project-scoped). Implementação PAUSADA; re-plano via
  brainstorm/decompose. T-004 fica `blocked` (não verificável até o cliente
  consumir v2). T-001/T-002/T-003 permanecem `done` (verifiers passaram), mas
  serão reavaliados no re-plano (T-002 `data_changed` provavelmente sobrevive;
  T-001 resolução de consumer v1 provavelmente é substituída).

- **D-5 (re-escopo ratificado pelo usuário — PIVÔ DE PLANO) — Descartar o
  dashboard React v1; adotar o cliente Vue do aiDeck dirigido por manifest.**
  Painel de design (Aria/Uma/Iris, gate-mode) + ratificação do usuário. Fato
  load-bearing: o aiDeck JÁ entrega um cliente Vue que renderiza o manifest
  declarativo (`/home/henry/aideck/src/client/`, build `dist/client/`, widgets
  `PhaseTimelineWidget.vue`/`CalloutWidget.vue`/`TabsWidget.vue`/`AccordionWidget.vue`/
  `DrawerWidget.vue`…). Decisões do usuário:
  - **Q1 = B (forte):** DESCARTAR completamente o dashboard React v1 (`src/dashboard`).
    Isso **reverte o P3 do plano** ("o dashboard é o nosso cliente React próprio")
    e **reshape a F2** (o redesign deixa de ser "redesenhar o cliente React" e passa
    a ser "configurar o manifest + tematizar/estender o DS do cliente Vue do aiDeck").
  - **P1 ajustado:** posso **PROPOR** ajustes no aiDeck, **nunca IMPLEMENTAR** lá.
  - **Objetivo do redesign:** o aiDeck já tem "Claude design", mas a tela atual está
    confusa; o redesign deve **representar o uso correto dos componentes** (widgets/DS).
  - **T-002 sobrevive em qualquer cenário** (o aiDeck emite `data_changed` via SSE
    `/sse`; Aria errou ao dizer que v2 não tem SSE). T-001 (resolução de consumer v1)
    e todo o `src/dashboard` viram descarte.
  - **Próximo passo:** produzir, via `atomic-skills:design-brief`, a estrutura
    hierárquica dos dados (modelo v2) + fixtures reais (~4 projetos: arch,
    atomic-skills, dispatch-test, lekto) como brief para o design agent.
  Síntese do painel + dissent preservados acima na narrativa desta sessão.

## Links

- Plano: `.atomic-skills/projects/atomic-skills/fix-aideck-dashboard/plan.md`
- Cliente Vue do aiDeck (renderer do manifest): `/home/henry/aideck/src/client/` (build `dist/client/`)
- API v2 (dados reais): `GET /api/consumers/<id>/projects/<projectId>/data/<dataSourceId>` — aiDeck `src/server/routes/api-v2.ts`
- API v1 (legacy, usada hoje pelo cliente): `GET /api/state/:consumer` — aiDeck `src/server/routes/api.ts:175` + `projections/state.ts:85` (`consumerRoot` flat)
- Contrato aiDeck: hard-cut `b3fad45` + `/home/henry/aideck/docs/handoffs/atomic-skills-manifest.md`
- Handler legacy: `/home/henry/aideck/src/server/routes/api.ts:175` (`/api/state/:consumer`)

## Session handoff

- **Narrative:** Fase F1 **PAUSADA para re-escopo** (decisão do usuário). T-001 ✓,
  T-002 ✓, T-003 ✓ (verifiers passaram); D-3 (label do card) feito. PORÉM o
  achado **D-4** mostrou que o objetivo da fase não é alcançado: o dashboard fala
  a **v1 state API** (legacy, layout flat → `consumer_unknown`) enquanto os dados
  vivem na **v2 dataSource API** (manifest, layout nested → 13 records reais). O
  conserto real é migrar `api.ts`+`adapters.ts`+`types.ts` para a v2 — bem maior
  que as 4 tasks de F1. T-004 está `blocked` (código em Roadmap.tsx pronto +
  typecheck verde, mas não verificável até o cliente consumir v2).
- **Decision log:** D-1 (consumer), D-2 (T-003 no-op), D-3 (label do card), **D-4
  (achado v1→v2 + decisão de re-escopo)**. Verificação ao vivo feita contra o
  aiDeck sibling `/home/henry/aideck/dist/cli.js` (b3fad45) já rodando no :7777
  (rootDir `/home/henry/atomic-skills`). Meu `serve` em background falhou por
  colisão de porta — usei o servidor existente para sondar.
- **Single nextAction:** RE-ESCOPAR F1 — rodar `atomic-skills:brainstorm` /
  re-decompose para adicionar as tasks da migração v1→v2 (ver D-4); reavaliar
  T-001/T-002/T-003 e desbloquear T-004 sob a nova decomposição. implement
  permanece pausado até haver tasks admitidas para a migração.
- **Verbatim state:**
  - v1 (cliente usa, vazio): `curl /api/state/atomic-skills` → `consumer_unknown` "Create files under .atomic-skills/atomic-skills/plans/"
  - v2 (dados reais): `curl /api/consumers/atomic-skills/projects/atomic-skills/data/plans` → `{records:[…], count:13}`
  - Typecheck gate: `npm run typecheck:dashboard` (tsc -p tsconfig.dashboard.json --noEmit) — exit 0
  - Build: `npm run build:dashboard` (exit 0; bundle em dist/dashboard + ~/.atomic-skills/dashboard)
  - aiDeck vivo no :7777 (processo pré-existente, NÃO meu) — meu serve falhou: "port 7777 in use".
  - Validate: `node scripts/validate-state.js .atomic-skills/projects/atomic-skills/fix-aideck-dashboard/phases/f1-validar-e-aplicar-o-manifesto-project-s.md` → exit 0
  - Rollups: `node scripts/compute-rollups.js` (sem arg, scan default `.atomic-skills`)
- **Uncommitted changes (`git status --porcelain` @ snapshot):**
  - `M src/dashboard/lib/api.ts` (T-001 consumer + T-002 SSE)
  - `M src/dashboard/lib/hooks.ts` (T-002 invalidação por prefixo)
  - `M src/dashboard/lib/adapters.ts` (D-3 label do card)
  - `M src/dashboard/pages/HomePage.tsx` (D-3 passa projectId — 2 call-sites)
  - `M src/dashboard/pages/ProjectDetailPage.tsx` (D-3 passa projectId)
  - `M src/dashboard/components/home/Roadmap.tsx` (T-004 toggle — código pronto, task blocked)
  - `M .atomic-skills/.../phases/f1-...md` (T-001/002/003 done + T-004 blocked + evidence + D-1..D-4 + handoff)
  - Recomendo commitar este checkpoint antes do re-plano (deixa o tree limpo p/ o resume gate).
