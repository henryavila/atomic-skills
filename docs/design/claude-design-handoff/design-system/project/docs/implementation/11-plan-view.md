# 11 — Plan bird's-eye view (F5)

## Objetivo

Renderizar a rota `/plans/:slug` exatamente conforme o wireframe da seção 2 de [ui-layouts.md](../ui-layouts.md). Plan header com metadados, principles/glossary colapsáveis, phase tree agrupado por track, parallel pairs lado-a-lado, dependency overlay via Mermaid (lazy-loaded), references modal, narrative collapsible. Click em phase navega para Initiative.

## Pré-requisitos

- Etapa 10 concluída (Vue foundation pronto, store de state cacheável).
- Etapa 03/05 prontos (parser + REST devolvendo Plan correto).

## Gates F1-F13 cobertos

- **F5** (Plan bird's-eye view) — todos os bullets.

## Arquivos a criar/editar

- `src/client/views/PlanView.vue` — substituir placeholder
- `src/client/components/plan/PlanHeader.vue`
- `src/client/components/plan/PrinciplesPanel.vue`
- `src/client/components/plan/GlossaryPanel.vue`
- `src/client/components/plan/TrackHeader.vue`
- `src/client/components/plan/PhaseTree.vue`
- `src/client/components/plan/PhaseCard.vue`
- `src/client/components/plan/ParallelGroup.vue`
- `src/client/components/plan/DependencyOverlay.vue` (lazy import de mermaid)
- `src/client/components/plan/ReferencesModal.vue`
- `src/client/components/plan/NarrativePanel.vue`
- `src/client/components/atoms/ExitGateBadge.vue` (reutilizado em 12)
- `src/client/components/atoms/TaskCountBadge.vue` (mostra `<done>/<total>`)
- `src/client/components/atoms/HighlightBadge.vue` (placeholder; etapa 14 conecta)
- `src/client/components/atoms/ArtifactLink.vue` (renderiza ArtifactRef com gitignored marker)
- `src/client/components/atoms/MarkdownBody.vue` (lazy `marked`)
- `tests/unit/client/components/plan/*.test.ts` — snapshots dos principais

## Passos

1. `PlanView.vue`:
   - Props `slug: string` (do router).
   - `onMounted` → `stateStore.loadState(consumer, slug)`. Loading state simples.
   - Template: `<PlanHeader :plan="plan" />`, `<PrinciplesPanel v-if="plan.principles" />`, `<GlossaryPanel v-if="plan.glossary" />`, `<PhaseTree :plan="plan" />`, `<DependencyOverlay v-if="showDeps" :plan="plan" />`, `<NarrativePanel :narrative="plan.narrative" />`, `<ReferencesModal v-if="showRefs" :refs="plan.references" />`.
   - Toolbar com botões `[Open narrative ▼]` `[Refs]` `[⌬]` que togglam estados locais.

2. `PlanHeader.vue`:
   - Render: `<h1>{{ plan.title }}</h1>`, sublinha: `v{{ plan.version }} · {{ plan.status }} · started {{ formatDate(plan.started) }} · branch {{ plan.branch ?? '—' }} · current: {{ plan.currentPhase ?? '—' }}`.
   - `current: F0` deve ter ícone/badge visualmente forte (cor `--accent-cyan`).

3. `PrinciplesPanel.vue` / `GlossaryPanel.vue`:
   - Collapsible (`<details>` HTML nativo OK).
   - Cabeçalho: "▾ 6 Principles" / "▾ 8 Glossary terms".
   - Conteúdo: lista de cards (`{{ p.title }}` + body).

4. `PhaseTree.vue`:
   - Agrupar `plan.phases` por `track` (lookup em `plan.tracks`).
   - Para cada track: `<TrackHeader :track="track" />` + lista de `<PhaseCard>` ou `<ParallelGroup>` (se duas+ phases compartilham `parallelWith`).
   - Algoritmo de grupo paralelo: scan phases na ordem; se phase tem `parallelWith` apontando para próxima(s), agrupa em ParallelGroup.

5. `PhaseCard.vue`:
   - Render: id (F0), status icon (StatusIcon átomo a reusar — copiar do ui-layouts atoms), title, audience, scope (resumido), exit gate summary, current `Next:` se for `currentPhase`.
   - `<TaskCountBadge :done="N" :total="M" />` (numbers derivados de fetching initiative se cached, ou só renderizar `subPhaseCount` sem progress se não cached).
   - `<ExitGateBadge :met="X" :total="Y" />` para mostrar `0/3 gates met`.
   - `<HighlightBadge :count="N" />` se houver.
   - Click → `router.push(/initiatives/${phase.slug})`.
   - Visual: cores diferentes por `exitGateType` (`standard` / `ui-gate` / `custom`).
   - Tracking de `externalImports` mostrado como badge "imports: <label>".

6. `ParallelGroup.vue`:
   - Render lado-a-lado (CSS grid 2-col) com label "∥ parallel allowed" entre as cards.

7. `DependencyOverlay.vue`:
   - Lazy import: `const mermaid = await import('mermaid')`.
   - Gera definição mermaid:
     ```
     graph TD
       F0 --> F1
       F1 --> F2
       F2 --> F3
       F3 --> F4
       F3 --> F5
       F4 --> F6
       F5 --> F6
       ...
     ```
   - Aplica theme dark do mermaid (`mermaid.initialize({ theme: 'dark' })`).
   - Render como SVG inline.

8. `ReferencesModal.vue`:
   - Modal centered. Lista de `ArtifactLink` por reference.
   - `ArtifactLink` átomo: renderiza ícone por `kind`, label, path; se `gitignored`: badge "⚠ gitignored"; se `inside_repo: false`: badge "↗ external".

9. `NarrativePanel.vue`:
   - Toggle expand/collapse (default colapsado para não dominar a viewport).
   - Usa `MarkdownBody` que faz `marked.parse(plan.narrative)` com sanitização básica (marked já escapa HTML por default em v14+; permitir code blocks).

10. Smoke renderizando fixture `v3-redesign.demo.md`:
    - 9 phases visíveis
    - 8 tracks agrupando (na demo só A-H; cada track tem 1+ phases)
    - F4 ∥ F5 lado-a-lado
    - F0 destacado como `currentPhase`
    - Click em F1 navega para `/initiatives/v3-f1-filament-redesign`
    - Tempo total render < 500ms (medir com `performance.now()` no `onMounted`)

11. Testes:
    - Snapshot do PlanView com fixture v3-redesign
    - PhaseCard click chama router.push correto
    - DependencyOverlay lazy-loads (verifica que mermaid não está no bundle inicial — checar via `npm run build` size analysis)
    - ParallelGroup detecta corretamente

## Testes a escrever

~10 testes (snapshots + interações principais).

## Definition of Done

- [ ] Renderiza fixture v3-redesign sem overflow/truncamento
- [ ] 9 phases visíveis, 8 tracks agrupando
- [ ] F4 ∥ F5 lado-a-lado com label
- [ ] currentPhase visualmente destacado
- [ ] DependencyOverlay carrega via dynamic import (verificar com `npm run build` que mermaid sai em chunk separado)
- [ ] Click em phase navega para Initiative
- [ ] References modal lista refs; gitignored badged
- [ ] Render < 500ms (medido com fixture real)
- [ ] Coverage ≥ 60% em `src/client/components/plan/**`
- [ ] Commit: `feat(client): Plan bird's-eye view with phase tree, tracks, parallel, deps overlay`

## Notas/decisões

- **`StatusIcon` átomo**: definir em `src/client/components/atoms/StatusIcon.vue` agora (será reusado na etapa 12). Glifos: `✓` done, `◉` active, `·` pending, `⊘` blocked. Color via CSS var.
- **`TaskCountBadge` sem dados de initiative**: se a initiative correspondente à phase ainda não está cached, mostrar `?/N` (N = subPhaseCount). Pre-fetch das initiatives da phase atual seria nice-to-have; em v0.1 aceitar lazy load (clicar carrega).
- **Mermaid lazy chunk size**: confirmar via `vite build` que mermaid sai em chunk próprio `~600KB`. Se vier no main, ajustar import strategy.
- **`ArtifactLink` para `repo-path` externo**: NÃO faz hyperlink HTTP (pode ser path absoluto). Mostra como texto monospace + ícone. v0.2 pode abrir no editor local via `vscode://`.
- **Performance**: 500ms é generoso. Em pratica, Vue 3 + 9 cards renderiza em < 50ms. O risco é Mermaid (~200ms primeiro render).
- **Estado de loading**: componente top mostra "Loading…" enquanto fetch. Após fetch, render full. Skeleton elaborado é v0.2.
- **Empty plan (zero phases)**: renderizar placeholder "No phases defined" — defensivo.
