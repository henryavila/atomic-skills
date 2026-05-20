# 14 — Annotation panel + highlight indicators (F11 + F12)

## Objetivo

Slide drawer AnnotationPanel à direita (toggleable em qualquer view), com filter por target/author/resolved, botão resolve que escreve via REST (delega para MCP por dentro). HighlightBadge inline next to entity title em Plan/Initiative views, severity-colored, hover-tooltip, acknowledge button. SSE-driven updates aparecem < 200ms (annotation-added / highlight-added).

## Pré-requisitos

- Etapa 08 concluída (MCP annotate/highlight + JSONL writers + event bus).
- Etapa 10 concluída (SSE store no client).
- Etapas 11/12 concluídas (HighlightBadge placeholder existe em phases/tasks).

## Gates F1-F13 cobertos

- **F11** (Annotation panel) — UI side completo.
- **F12** (Highlight indicators) — UI side completo.

## Arquivos a criar/editar

- `src/client/components/AnnotationPanel.vue` — drawer principal
- `src/client/components/annotation/AnnotationFilter.vue`
- `src/client/components/annotation/AnnotationEntry.vue`
- `src/client/components/annotation/HighlightEntry.vue`
- `src/client/components/atoms/HighlightBadge.vue` — atualizar de placeholder (etapa 11) para versão funcional
- `src/client/components/atoms/Toast.vue` — toast simples (também usado pela etapa 13 copy button)
- `src/client/stores/annotations.ts` — atualizar (carrega + agrupa por target + resolve)
- `src/client/stores/highlights.ts` — atualizar (filtra por entity, retorna count por target)
- `src/client/stores/ui.ts` — `annotationPanelOpen: boolean`, `panelFilter: { target?, author?, resolved? }`
- `tests/unit/client/components/annotation/*.test.ts`
- `tests/integration/client/sse-updates.test.ts` — fluxo end-to-end (mock SSE → store → component re-renders)

## Passos

1. `stores/ui.ts`:
   - State: `annotationPanelOpen: false`, `panelFilter: {}`.
   - Actions: `togglePanel()`, `openPanel(filter?)`, `closePanel()`.
   - HighlightsButton (TopChrome, etapa 10) chama `openPanel({ filter: 'highlights' })` (extender filter).

2. `stores/annotations.ts`:
   - State: `byTarget: Map<targetKey, Annotation[]>` (key = `${consumer}:${slug}:${path}`).
   - Action `loadInbox(consumer?, since?)` chama `apiGet('/api/inbox')`, agrupa. O endpoint inbox já agrega `Resolution` JSONL com a annotation original (etapa 05).
   - Action `add(annotation)` chamada por SSE.
   - Action `resolve(id)` chama `POST /api/annotation/:id/resolve` (endpoint definido na etapa 05). O backend append `Resolution { kind: 'resolution', refId, by, resolvedAt }` ao JSONL via writer da etapa 04. Schema `Resolution` está em `src/schemas/validators/common.ts` (etapa 02).
   - Getter `forTarget(targetKey)`.

3. `stores/highlights.ts`:
   - Análogo. Cada highlight tem `acknowledged?: boolean`. Acknowledge segue mesma estratégia (append-only resolution).
   - Getter `countForTarget(targetKey, includeAcknowledged = false)`.

4. `AnnotationPanel.vue`:
   - Drawer fixo right side, width 360px. Toggleable via `ui.annotationPanelOpen`.
   - Header: "Annotations" + `[×]` close.
   - `<AnnotationFilter />`.
   - Lista: para cada target group, accordion: `<h4>{targetPath}</h4>` + `<AnnotationEntry v-for="a in annotations" />`.
   - Filtro highlights: se `filter.kind === 'highlights'`, mostra `HighlightEntry[]` em vez de annotations.
   - Empty state: "No annotations yet" / "No highlights yet".

5. `AnnotationFilter.vue`:
   - Pills: `[all] [human] [ai] [resolved]`. Multi-select.

6. `AnnotationEntry.vue`:
   - Author badge (👤 human / 🤖 ai).
   - Timestamp relative (`2 hrs ago`).
   - Body em `<blockquote>`.
   - Botão `[Resolve]` (se não resolved). Click → store action → após confirm, fade out (CSS transition opacity).

7. `HighlightEntry.vue`:
   - Severity dot (cor por severity).
   - Reason text.
   - Source badge.
   - Botão `[Acknowledge]`.

8. `HighlightBadge.vue` (atualizar):
   - Props: `targetKey` (string).
   - Computa `count = highlightsStore.countForTarget(targetKey)`.
   - Render: `<span v-if="count > 0" class="badge" :class="severityClass">⚑{count}</span>`.
   - Cor por highest severity (critical > warn > info).
   - Hover → tooltip mostrando primeiro reason (ou "<N> highlights — click for details").
   - Click → `ui.openPanel({ kind: 'highlights', target: targetKey })`.

9. Wiring SSE → UI:
   - `sseStore` já dispara `annotationStore.add()` / `highlightStore.add()` (etapa 10). Garantir que stores são reativos e components re-renderizam.
   - Latency: medir performance.now() entre `add()` chamado e DOM atualizado. Target < 200ms (CSS layout/paint).

10. PlanView/InitiativeView wiring:
    - PhaseCard: `<HighlightBadge :targetKey="`project-status:${plan.slug}:phases.${phase.id}`" />`.
    - TaskRow: `<HighlightBadge :targetKey="`project-status:${initiative.slug}:tasks.${task.id}`" />`.
    - ExitGateRow: `<HighlightBadge :targetKey="`project-status:${initiative.slug}:exitGates.${criterion.id}`" />`.

11. Testes:
    - AnnotationPanel render com fixtures (3 annotations carregadas).
    - Filter `[ai]` only → só annotations author ai.
    - Resolve button → store action chamada, entry visualmente marcado resolved.
    - HighlightBadge severity color: criar 3 highlights de severities distintas → assert classe CSS.
    - SSE round-trip: simular `annotation-added` event → AnnotationPanel renderiza dentro de < 200ms (medido com fake timers + perf API).

## Testes a escrever

~10 testes.

## Definition of Done

- [ ] AnnotationPanel toggleable de qualquer view via HighlightsButton ou hotkey
- [ ] Filter por target/author/resolved funciona
- [ ] Resolve action persiste (verificar JSONL contém resolution line após chamada)
- [ ] HighlightBadge inline em PhaseCard, TaskRow, ExitGateRow
- [ ] Severity color correto
- [ ] Hover tooltip mostra reason
- [ ] Acknowledge atualiza badge (remove de count se sem highlights restantes)
- [ ] SSE atualiza UI < 200ms (medido)
- [ ] Coverage ≥ 65% em `src/client/components/annotation/**`
- [ ] Commit: `feat(client): annotation panel + highlight indicators with SSE live updates`

## Notas/decisões

- **Resolutions como append-only (não muta linha original)**: preserva Iron Law 1 (append-only) e evita race conditions. Schema, parser, agregação e endpoint REST estão em etapas 02/03/05; etapa 14 apenas consome. Custo: leitura agrega resolutions em-memory (Map por id). JSONL típico tem <100 linhas/dia — barato.
- **Schemas `Resolution` e `Acknowledgement`**: residem em `src/schemas/validators/common.ts` desde a etapa 02. Etapa 14 não introduz schema novo, só wiring de UI.
- **Endpoints**: `POST /api/annotation/:id/resolve` e `POST /api/highlight/:id/acknowledge` já existem desde a etapa 05.
- **`<dialog>` ou drawer custom**: drawer custom (CSS transform/transition) — mais natural para slide. `<dialog>` é mais usado para modal centered.
- **Hotkey para abrir panel**: `?` ou `]` (estilo Notion). Implementar minimal listener global em App.vue. Não bloquear se omitir.
- **Empty state visual**: ilustração simples ou apenas texto centralizado.
- **Performance de re-render**: Vue 3 reactivity é rápido; com < 100 annotations não há problema. Se algum dia for 10k, virtualize (v0.2+).
- **Panel posição persistida em localStorage?**: não em v0.1. Aceitar default closed em cada page load.
