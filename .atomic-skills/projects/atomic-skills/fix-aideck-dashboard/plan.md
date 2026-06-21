---
schemaVersion: "0.1"
slug: fix-aideck-dashboard
title: "fix-aideck-dashboard: corrigir a integração com aiDeck"
version: "2.0"
status: active
started: 2026-06-16T11:57:08.891Z
lastUpdated: 2026-06-19T14:45:00Z
branch: plan/fix-aideck-dashboard
currentPhase: F1
parallelismAllowed: false
principles:
  - id: P1
    title: A correção é cross-repo (aiDeck + atomic-skills), não só do nosso lado
    body: A causa raiz do "dashboard errado" é a TOPOLOGIA DE NAVEGAÇÃO do cliente
      aiDeck (consumer-centric), que nenhum manifest resolve. Logo a correção toca
      o ../aideck (shell/nav) E o atomic-skills (manifest). Supera o antigo P1
      "não tocar no aiDeck".
  - id: P2
    title: O DS (aiDeck) é a fonte de verdade em 3 dimensões
    body: Auditar SEMPRE contra o aiDeck REAL — (1) catálogo de widgets, (2)
      gramática do manifest, (3) shell/chrome/nav — lendo source/registry/schema,
      nunca contra a referência ui_kit/.dc.html (que driftou) nem suposição. O
      campo widget é z.string (false-green); um guardrail de CI deve validar todo
      widget/feature do manifest contra o registry instalado.
  - id: P3
    title: O dashboard É o cliente Vue declarativo do aiDeck
    body: O cliente React próprio (src/dashboard/) foi REMOVIDO (38cf2a9). O
      dashboard é o cliente Vue do aiDeck, dirigido pelo manifest + estado emitido.
      Nada renderiza que não esteja no contrato publicado do aiDeck.
glossary: []
phases:
  - id: F0
    slug: fix-aideck-dashboard-f0-auditoria-design-vs-contrato-aideck
    title: "Auditoria do design contra o contrato real do aiDeck (3D)"
    goal: "O agente de design audita o template do dashboard contra o contrato
      REAL do aiDeck (widgets + gramática + shell/nav) e devolve um GAP report em
      3 partes (B widgets, C gramática, D shell/nav). Prompt 3D já entregue ao
      usuário; aguardando o retorno do agente de design."
    dependsOn: []
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: "Gap report 3D recebido e revisado: cada item
            (widget/feature/shell) classificado existe / precisa-extensão /
            não-expressável, com spec acionável."
          status: met
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: done
    summary: "F0 DONE: gap report 3D recebido e validado contra o source do aiDeck
      (3 gaps de gramática eram falsos — linkTo/cell-slots/record-switcher já existem).
      Escopo real = D shell nav.style:'projects' + B publicar v2.1."
  - id: F1
    slug: fix-aideck-dashboard-f1-shell-project-centric-no-aideck
    title: "Shell project-centric no aiDeck (nav.style: projects)"
    goal: "No ../aideck/src/client, adicionar um modo de nav NOMEADO project-centric:
      Panorama fixo como landing no topo + lista de PROJETOS na sidebar (em vez de
      CONSUMERS), single consumer, header de página alinhado. Shell customizável
      por MODO nomeado, não free-form. É a correção dominante — o manifest sozinho
      não resolve."
    dependsOn:
      - F0
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: "A sidebar renderiza Panorama no topo + lista PROJETOS
            (atomic-skills/arch/lekto) sob UM consumer, validado por captura CDP
            comparada à imagem de referência do design."
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: active
    summary: "Shell nav.style:'projects' IMPLEMENTADO E COMMITADO no aiDeck (validado
      2026-06-19: commit 1610a10 em feat/ds-v2.1-widgets — schema+Sidebar+landing+testes
      de fixture neutra + gate domain-agnostic). G-1 (render vs imagem #2 via CDP)
      PENDENTE: validar LOCALMENTE do build/source (a v2.1 já roda local — NÃO precisa
      npm). page.showInNav (Ajuda fora da sidebar) é cosmético, não bloqueia. Publicar é
      o último passo, só depois da validação. Handoff: ../aideck/docs/handoffs/aideck-consolidated-remaining-work.md."
  - id: F2
    slug: fix-aideck-dashboard-f2-realinhar-manifest-ao-design
    title: "Realinhar o manifest ao design"
    goal: "Realinhar assets/aideck-consumer/manifest.yaml ao manifest.sample do
      design: foco-agora/visão-geral (não foco/planos), headline-banner no Foco,
      dobrar a página phase no detalhe do plano, ajuda via botão ? (não item de
      sidebar). Gerado a partir do mapa-por-tela (parte A da auditoria)."
    dependsOn:
      - F0
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: "O manifest corresponde ao design (páginas/widgets/bindings)
            e o render validado (CDP, 0 unknown widgets) bate com as imagens de
            referência."
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: active
    summary: "Manifest realinhado ao design (Track 2, paralelo a F1): foco→foco-agora,
      planos→visao-geral (6 stats por-projeto + Frentes vivas), headline-banner no
      Foco agora (contrato REAL do widget: laneStatusField + title/sub literais),
      page phase DOBRADA no plan (callout PRÓXIMA AÇÃO + Backlog da fase via bus
      selectedPhase), commandPalette só plans. VALIDADO contra o engine source
      (parseManifest OK, 0 unknown widgets, todos refs resolvem, 47 testes verdes).
      G-1 (render vs imagens de referência via CDP) PENDENTE do shell F1."
  - id: F3
    slug: fix-aideck-dashboard-f3-higiene-consumers-e-guardrail
    title: "Higiene: consumers legados + guardrail CI"
    goal: "Remover os consumers legados (arch/lekto/dispatch-test em
      ~/.aideck/consumers/) → UM consumer atomic-skills + repos como PROJETOS. Add
      teste CI: todo widget/feature do manifest ∈ registry do aiDeck instalado
      (mata o false-green do widget z.string)."
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: "A sidebar mostra UM consumer (atomic-skills) com
            arch/lekto/atomic-skills como PROJETOS; nenhum consumer legado."
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
        - id: G-2
          description: "Existe um teste que falha (RED) quando o manifest referencia
            um widget/feature ausente no registry do aiDeck instalado."
          status: met
          verifier:
            kind: command
            description: "node --test tests/aideck-manifest-widget-registry.test.js —
              gate (widget ∈ registry) + RED-bite provado (stat-bogus → flagged) +
              drift-check vs WidgetRenderer.vue widgetMap (38 keys)."
    status: active
    summary: "G-2 MET: guardrail vendoriza o widgetMap do source (meta/aideck-widget-registry.json,
      regen via npm run build:aideck-widget-registry), gateia o manifest (widget ∈
      registry) e RED-bita num widget inexistente — fecha o false-green widget:z.string.
      NB: registry vem do SOURCE, não do bundle npm 0.1.0 (que é pré-v2.1). G-1:
      consumers legados arch/lekto/dispatch-test REMOVIDOS de ~/.aideck/consumers/
      (sobra só atomic-skills; provisioning já era single-consumer); validação visual
      (1 consumer + projetos na sidebar) pendente do shell F1."
references:
  - kind: file
    path: /home/henry/aideck/src/client/components/shell/Sidebar.vue
    label: aiDeck client sidebar (consumer-centric) — onde vive a causa raiz da nav topology
  - kind: file
    path: /home/henry/aideck/src/server/manifest-schema.ts
    label: Gramática do manifest (nav.style ∈ {tabs,sidebar}; widget z.string = false-green)
planActive: true
planTitle: "fix-aideck-dashboard: corrigir a integração com aiDeck"
---

# fix-aideck-dashboard: corrigir a integração com aiDeck

## 1. Context

**Causa raiz (descoberta 2026-06-19, verificada no source do aiDeck):** o dashboard sai
"completamente errado / mistura do antigo com o novo" por um **mismatch de TOPOLOGIA DE
NAVEGAÇÃO entre o design e o CLIENTE aiDeck**, não por bug de manifest/dados. O design
(claude.ai/design "Atomic Skills") especifica nav **project-centric** — Panorama como landing
cross-project no topo + lista de **PROJETOS** na sidebar, sob UM consumer. O cliente aiDeck 0.1.1
só implementa nav **consumer-centric** (`Sidebar.vue` lista CONSUMERS; `HomePage` é grid de
consumers; `nav.style ∈ {tabs,sidebar}`; troca de projeto por `<select>`). **Nenhum manifest
produz o design** — a topologia é hardcoded no Vue. As ~4 sessões anteriores falharam por editar
o manifest/dados (camada errada). Os widgets novos do DS (collection-grid, stepper, status-list,
record-switcher, headline-banner, catalog) JÁ existem e renderizam — o que falta é o SHELL/NAV.

**Modelo acordado (DS = contrato 3D):** o aiDeck (DS) é a fonte de verdade em 3 dimensões —
(1) widgets, (2) gramática do manifest, (3) shell/chrome/nav. O shell deve ser customizável por
**modos NOMEADOS** (ex.: `nav.style: 'projects'`), não free-form. Loop: o agente de design audita
o template contra o contrato REAL do aiDeck → gap report 3D → aiDeck implementa + bumpa versão →
congela o design naquela versão → Claude Code gera o manifest → valida render + guardrail CI.
(Memória: `aideck-dashboard-nav-topology-mismatch`, `aideck-ds-three-dimensional-contract`.)

**Superado:** o contexto v1 (CONSUMER fixo `project-status`, evento `state-change`, cliente React
`src/dashboard/`) está obsoleto — o cliente React foi removido (38cf2a9); o dashboard é o cliente
Vue do aiDeck dirigido por manifest + estado emitido.

## 2. Inviolable principles

- **P1 A correção é cross-repo (aiDeck + atomic-skills)** — A causa raiz (nav topology
  consumer-centric do cliente aiDeck) não se resolve só com manifest; toca o ../aideck (shell/nav)
  E o atomic-skills (manifest). Supera o antigo "não tocar no aiDeck".
- **P2 O DS (aiDeck) é a fonte de verdade em 3 dimensões** — Auditar contra o aiDeck REAL
  (widgets + gramática + shell/nav), lendo source/registry/schema; nunca contra a referência
  ui_kit/.dc.html (que driftou) nem suposição. Guardrail de CI valida widget/feature ∈ registry.
- **P3 O dashboard É o cliente Vue declarativo do aiDeck** — O cliente React (`src/dashboard/`) foi
  removido; o dashboard é o cliente Vue do aiDeck (manifest + estado emitido). Nada renderiza fora
  do contrato publicado.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

F0 (active) Auditoria design vs contrato aiDeck → F1 Shell project-centric no aiDeck →
F2 Realinhar o manifest ao design → F3 Higiene consumers legados + guardrail CI.

## 4. Descobertas & validações (2026-06-19)

- **Causa raiz verificada no source:** `Sidebar.vue:8-12,44-52` (consumer-centric), `App.vue`,
  `HomePage.vue` (grid de consumers), `manifest-schema.ts:344` (`nav.style ∈ {tabs,sidebar}`),
  `ConsumerPage.vue` (projeto via `<select>`+`?project=`).
- **Comparação com o design (exigida pelo usuário):** o `chrome.jsx` genérico do DS TAMBÉM é
  consumer-centric e o aiDeck o replica quase 1:1; o project-centric (Panorama+PROJETOS) existe SÓ
  no `.dc.html` bespoke — aiDeck nunca portou.
- **Validação local sem publicar:** `node ../aideck/dist/cli.js serve --port=7777
  --static-dir=../aideck/dist/client`; emit por repo + `POST /api/projects/register`; captura via
  chrome-headless-shell por CDP. Render dos widgets DS OK (0 "Unknown widget"), dados reais de
  atomic-skills/arch/lekto na Panorama, scoping por `?project=` OK.
- **Em andamento:** prompt de auditoria 3D entregue ao usuário; agente de design gerando o gap
  report. Próximo passo após o retorno: F1 (shell project-centric no aiDeck).

## 5. F2/F3 executados (Track 2, 2026-06-19) + achados para o F1

- **F2 manifest realinhado** (`assets/aideck-consumer/manifest.yaml`, schemaVersion 0.1): páginas
  `panorama · foco-agora · visao-geral · plan(dobra phase) · concluidos · help`. Mudanças: rename
  foco→foco-agora / planos→visao-geral; `headline-banner` no topo do Foco agora; visao-geral = 6
  stats por-projeto (count + 2 ratios `of:'status==done'`/`'status==met'`) + tabela Frentes vivas;
  página `phase` DOBRADA no `plan` (callout PRÓXIMA AÇÃO + seção "Backlog da fase" stack/parked/
  emerged, tudo escopado pelo bus `phaseId==selectedPhase`); commandPalette só `plans` (sem rota
  /phase). **Validado** contra `parseManifest` do engine SOURCE (não só YAML), 0 unknown widgets,
  todos os refs resolvem, 47 testes aideck verdes.
- **⚠️ Trap confirmado** ([[aideck-bind-published-not-imagined-contract]]): o npm INSTALADO
  `@henryavila/aideck@0.1.0` tem o schema ANTIGO — `source` só `{ref,filter,param}` (sem agg/
  where/scope), `repeat` só string, sem statusMap/help/commandPalette/emits no schema, nav só
  {tabs,sidebar}, e o bundle client é PRÉ-v2.1 (collection-grid/status-list/catalog ausentes). O
  manifest (e o reference do design) bindam o engine SOURCE/v2.1 — a publicação dele é **Track 1**.
  Por isso o guardrail F3 tira o registry do SOURCE (WidgetRenderer.vue), não do bundle npm.
- **🔴→✅ Gap de shell "Ajuda fora da sidebar" — agora NO PROMPT do F1:** NÃO há flag de hide-from-nav
  em nenhum schema (navSchema = style/showIcons/projectsLabel/landingPage; page schema sem hidden).
  O `?` já abre help (`help: help`), mas o runtime renderiza TODA página declarada na sidebar.
  **Embutido de fato no Track 1**: `nav-style-projects-impl.md` §6 especifica `page.showInNav?: boolean`
  (default true; flag GENÉRICO de shell, vale p/ tabs/sidebar/projects). O manifest já PRÉ-CABEIA
  `showInNav: false` na page help (forward-compat: o engine 0.1 ignora a key até o Track 1 shipar).
- **Gotcha headline-banner:** `config.title`/`sub`/`tone` são TEXTO LITERAL no HeadlineBannerWidget
  (não field-ref); o `count` vem de `config.value` (source.agg) ou `source.length`; as faixas (lanes)
  são 1 por record via `laneStatusField`. O manifest.sample do design escreveu `title: bannerTitle`
  (campo) — renderizaria a string literal "bannerTitle". Bindei ao contrato REAL.
- **Validação de render (CDP vs imagem #2):** DEFERIDA — rodar junto quando o Track 1 aterrissar o
  shell, pelo harness `node ../aideck/dist/cli.js serve --static-dir=../aideck/dist/client`.

## 6. Validação do Track 1 + handoff consolidado (2026-06-19)

Validei o estado do aiDeck (HEAD `1610a10`, branch `feat/ds-v2.1-widgets`). **6/8 itens prontos e
commitados:** nav.style:'projects' (schema+Sidebar+landing), gramática v2.1 completa, 13 widgets,
fixture neutra + gate domain-agnostic. **A v2.1 JÁ RODA do código local** (é o que o harness usa) —
o próximo passo de verdade é **B: validar LOCALMENTE** o render do manifest no shell projects (harness
CDP vs imagem #2). Publicar no npm é o **ÚLTIMO** passo, **só depois** da validação local passar —
GATE explícito do owner ("não subo pro npm antes de validar"). Único item de código pendente: (A)
`page.showInNav` (cosmético: tira a Ajuda da sidebar; não bloqueia a validação do core). Consolidei
tudo num handoff único: **`../aideck/docs/handoffs/aideck-consolidated-remaining-work.md`** (tabela
✅/✗ + ordem B→A→C). Supera os handoffs antigos.

**Validação 2026-06-19 (aiDeck terminou o item A = showInNav):** GREEN determinístico — `page.showInNav`
implementado no aiDeck (schema 3 page-schemas + Sidebar navPages/navProjectPages + tab bar + PageMeta +
testes reais de esconder); 682 testes unit aiDeck passam (zero regressão) + gate domain-agnostic OK;
`tsc --noEmit` limpo; nosso manifest parseia no schema fresco com `help.showInNav=false` reconhecido (não
stripado). Pendente: validação VISUAL de render (owner, vs imagem #2) → depois publicar (último passo).
