# 10 — Vue foundation

## Objetivo

Skeleton Vue 3 real: `main.ts`/`App.vue`/`router.ts` substituem placeholders, pinia configurado, SSE client conectado ao store, dark-theme CSS variables aplicadas sem FOUC, TopChrome (Logo + Breadcrumb + Help/Highlights/Menu buttons) presente em toda view, rotas registradas mas com views placeholder (preenchidas em 11-14).

## Pré-requisitos

- Etapa 05 concluída (server responde REST + SSE).
- Etapa 09 concluída (CLI pode subir tudo via `aideck serve` ou `demo`).

## Gates F1-F13 cobertos

- **F9** (Dark theme) — baseline (CSS vars + no FOUC + tokens). Acessibilidade WCAG AA validada na etapa 15.
- **F2** (SSE) — wire client.

## Arquivos a criar/editar

- `src/client/main.ts` — substituir placeholder; criar app, instalar pinia + router, mount.
- `src/client/App.vue` — substituir; layout root com `<TopChrome />` + `<RouterView />` + `<AnnotationPanel />` (drawer, etapa 14).
- `src/client/router.ts` — substituir; rotas `/`, `/plans/:slug`, `/initiatives/:slug`, `/help`, `/demo`.
- `src/client/stores/state.ts` — pinia store: `consumers`, `currentConsumer`, `state` (cache por consumer/slug), actions `loadState`, `loadInbox`, etc.
- `src/client/stores/sse.ts` — pinia store: gerencia EventSource, parseia eventos, despacha para `state` store.
- `src/client/stores/highlights.ts` — store de highlights ativos (count por target).
- `src/client/stores/annotations.ts` — store de annotations carregadas.
- `src/client/styles/theme.css` — CSS variables completas de [ui-layouts.md](../ui-layouts.md).
- `src/client/styles/base.css` — reset + tipografia base + tokens aplicados em `body`/`html`.
- `src/client/components/TopChrome.vue`
- `src/client/components/Logo.vue`
- `src/client/components/Breadcrumb.vue` — deriva texto da rota atual
- `src/client/components/HelpButton.vue`
- `src/client/components/HighlightsButton.vue` — mostra count, clicar abre panel filtrado
- `src/client/components/MenuButton.vue` — slide menu (themes/settings/demo toggle/version)
- `src/client/components/DemoBanner.vue` — renderiza topo se `health.demo === true`
- `src/client/views/HomeView.vue` — placeholder mostra lista de consumers + entrypoints
- `src/client/views/PlanView.vue` — placeholder (etapa 11)
- `src/client/views/InitiativeView.vue` — placeholder (etapa 12)
- `src/client/views/HelpView.vue` — placeholder (etapa 13)
- `src/client/views/DemoView.vue` — placeholder (igual a HomeView mas com banner forçado)
- `src/client/composables/useApi.ts` — wrapper de fetch para `/api/*`
- `tests/unit/client/stores/state.test.ts`
- `tests/unit/client/stores/sse.test.ts`
- `tests/unit/client/components/TopChrome.test.ts`

## Passos

1. `theme.css`:
   - `:root { --bg-canvas: #0d1117; --bg-surface: #161b22; ... }` (todos os tokens de ui-layouts.md).
   - `html, body { background: var(--bg-canvas); color: var(--fg-default); }`.
   - Carregar `theme.css` antes de qualquer outra coisa no `index.html` (link tag inline na `<head>` ou inline `<style>`) — evita FOUC.
2. `base.css`:
   - Reset minimal (box-sizing, margin/padding 0 em body).
   - Fonte: `system-ui, sans-serif`. Mono: `ui-monospace, "SF Mono", monospace`.
   - Variáveis aplicadas em headings/text.
3. `main.ts`:
   - Importa `theme.css` + `base.css`.
   - `createApp(App)` → `app.use(createPinia())` → `app.use(router)` → `app.mount('#app')`.
4. `router.ts`:
   - Routes:
     - `/` → HomeView
     - `/demo` → DemoView
     - `/plans/:slug` → PlanView (props: `slug`)
     - `/initiatives/:slug` → InitiativeView
     - `/help` → HelpView
   - **`createWebHistory()`** — URLs limpas (`/plans/v3-redesign` em vez de `/#/plans/v3-redesign`), alinhadas com o smoke da etapa 15. O fallback SPA (qualquer GET fora de `/api/*` e `/sse` → `dist/client/index.html`) é configurado no Hono na etapa 05.
5. `stores/state.ts`:
   - State: `consumers: Consumer[]`, `currentConsumer: string | null`, `cache: Map<string, Plan | Initiative | ProjectStatusState>` (chave `consumer:slug?`).
   - Actions: `loadConsumers()`, `loadState(consumer, slug?)`, `applyStateChange(consumer, slug, entity)` (chamada por SSE).
   - Getters: `getCached(consumer, slug?)`.
6. `stores/sse.ts`:
   - State: `connected: boolean`, `lastEventId: string | null`.
   - Action `connect()`: `new EventSource('/sse')`; addEventListener para cada kind:
     - `state-change` → `stateStore.applyStateChange(...)`.
     - `annotation-added` → `annotationStore.add(...)`.
     - `highlight-added` → `highlightStore.add(...)`.
     - `error` → toast (etapa 14 incluirá toast simples; aqui só `console.warn`).
     - `health-tick` → atualiza `connected: true` + last seen.
   - Reconnect handled by EventSource automaticamente; on open, `lastEventId` é enviado pelo browser.
7. `composables/useApi.ts`:
   - `async function apiGet<T>(path): Promise<Result<T, ErrorResponse>>` (mesmo `Result` da etapa 02).
   - `async function apiPost<T>(path, body): Promise<Result<T, ErrorResponse>>`.
   - Em erro HTTP, parsea `ErrorResponse` body. Em falha de rede, retorna `err({ code: 'io_error', message: 'Network error' })`.
8. `App.vue`:
   - Template: `<DemoBanner v-if="isDemo" /> <TopChrome /> <main><RouterView /></main> <AnnotationPanel />` (panel implementado em 14; placeholder mínimo aqui).
   - `onMounted`: `stateStore.loadConsumers()`, `sseStore.connect()`.
9. `TopChrome.vue`:
   - Layout horizontal (`display: flex; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--border-default)`).
   - Left: `<Logo>aiDeck</Logo>` link to `/`.
   - Center: `<Breadcrumb />`.
   - Right: `<HelpButton />` `<HighlightsButton />` `<MenuButton />`.
10. `Breadcrumb.vue`:
    - Watch `useRoute()`. Mapear `/plans/:slug` → `<slug>`; `/initiatives/:slug` → busca initiative cached para extrair `phaseId` + `parentPlan` e mostrar `<plan> · <phase> · <slug>`.
11. `HighlightsButton.vue`:
    - Conta highlights ativos (não acknowledged). Mostra badge se > 0.
    - Click → abre AnnotationPanel filtrado em highlights (etapa 14 conecta).
12. `MenuButton.vue`:
    - Mínimo: dropdown estático mostrando version + "Settings (v0.2)" disabled. Refinar em closeout.
13. `DemoBanner.vue`:
    - Visível só se `state.health.demo === true`. Estilo `background: var(--accent-amber); color: var(--bg-canvas); padding: 8px 20px; text-align: center`. Texto: "⚠ DEMO MODE — seeded fixtures, not your data. Quit (Ctrl+C) to clean."
14. Testes:
    - `state.test.ts`: `loadState` chama fetch correto, cacheia, `applyStateChange` invalida/atualiza.
    - `sse.test.ts`: mock `EventSource`, simular eventos, store responde.
    - `TopChrome.test.ts`: snapshot.
15. Verificação manual: `aideck demo` → browser abre → vê banner + TopChrome + Home com lista de consumers.

## Testes a escrever

~8 testes. Vue components via `@vue/test-utils` + `happy-dom`.

## Definition of Done

- [ ] `npm run dev` levanta server + Vite; browser em `http://localhost:5173` mostra TopChrome + Home
- [ ] Tema dark aplicado sem FOUC (background carrega antes do JS)
- [ ] SSE conecta automaticamente; `health-tick` recebido a cada 30s
- [ ] Routing funciona (clicar em links navega sem reload)
- [ ] Banner DEMO aparece em `aideck demo`, ausente em `aideck serve`
- [ ] Highlights count atualiza em tempo real (testar postando `/api/highlight` via curl)
- [ ] Coverage ≥ 60% em stores; componentes têm pelo menos snapshot
- [ ] Commit: `feat(client): Vue foundation + router + pinia + SSE + dark theme + TopChrome`

## Notas/decisões

- **`createWebHistory`**: URLs limpas. Requer SPA fallback no Hono (configurado na etapa 05). Em dev (`vite`), Vite já trata o fallback nativamente para rotas SPA; em produção, Hono serve `dist/client/index.html` para qualquer GET fora de `/api/*` e `/sse`.
- **`theme.css` inline na head** — eliminar FOUC. Vite injeta CSS depois do JS por padrão, causando flash branco. Inlinear apenas a regra `body { background: #0d1117 }` em `index.html` `<style>` resolve.
- **SSE reconnect**: `EventSource` reconecta sozinho. `lastEventId` browser-managed. Não precisa código extra.
- **`useApi` retorna `Result`**: mesmo padrão do server. Caller sempre destructura `if (result.ok)`. Sem try/catch.
- **`MenuButton` é stub**: settings reais ficam para closeout / v0.2. Aceitar mock minimal.
- **Não criar testes E2E aqui** — Playwright/Cypress fora do escopo v0.1. Verificação visual manual na DoD é suficiente.
- **`AnnotationPanel` em App.vue**: aparece como placeholder vazio até etapa 14. Não bloquear progresso.
