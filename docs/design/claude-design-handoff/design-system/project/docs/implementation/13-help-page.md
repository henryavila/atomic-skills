# 13 — Help page (F7)

## Objetivo

Renderizar `/help` lendo `/api/help` (etapa 05 projection). Grid de SkillCards com nome/purpose/whenToUse/example, search/filter real-time, expand para detalhes completos com related-skills cross-link, copy-command para `/atomic-skills:<name>`. Fallback gracioso quando frontmatter de skill estiver ausente.

## Pré-requisitos

- Etapa 05 concluída (`/api/help` retornando lista).
- Etapa 10 concluída (Vue foundation).

## Gates F1-F13 cobertos

- **F7** (Help page) — todos os bullets.

## Arquivos a criar/editar

- `src/client/views/HelpView.vue` — substituir placeholder
- `src/client/components/help/SkillGrid.vue`
- `src/client/components/help/SkillCard.vue`
- `src/client/components/help/SkillCardExpanded.vue` (modal ou inline expand)
- `src/client/components/help/SearchBar.vue`
- `src/client/components/help/FilterControls.vue`
- `src/client/components/help/CopyCommandButton.vue`
- `src/client/components/help/ActiveIndicator.vue` (● in repo / ○ available)
- `src/client/stores/help.ts` — pinia store carrega skills + estado de filter/search
- `tests/unit/client/components/help/*.test.ts`

## Passos

1. `stores/help.ts`:
   - State: `skills: Skill[]`, `loaded: boolean`, `searchQuery: string`, `filter: 'all' | 'in-repo' | 'available'`.
   - Action `load()` → `apiGet('/api/help')` → popula `skills`.
   - Getter `filtered`: filter por `filter` (in-repo = `activeInRepo: true`) + search por `name`/`purpose`/`whenToUse` (case-insensitive substring).

2. `HelpView.vue`:
   - `onMounted` → `helpStore.load()`.
   - Template: `<SearchBar v-model="helpStore.searchQuery" />` + `<FilterControls v-model="helpStore.filter" />` + `<SkillGrid :skills="helpStore.filtered" />`.
   - Loading: spinner ou "Loading skills...". Empty: "No skills match your filters."

3. `SearchBar.vue`:
   - Input com placeholder "🔍 Search skills...". Debounce 50ms (gate F7: filter < 50ms para 12 items — atingível trivialmente).
   - Limpar com `[×]` button.

4. `FilterControls.vue`:
   - Dropdown "All / In repo / Available". Aplicado via store.

5. `SkillGrid.vue`:
   - CSS Grid responsiva: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`.
   - Renderiza `<SkillCard v-for="skill in skills" :skill />`.

6. `SkillCard.vue`:
   - Container card (border + padding + bg `--bg-surface`).
   - Header: `<h3>{{ skill.name }}</h3>` + `<ActiveIndicator :active="skill.activeInRepo" />`.
   - Body: `<p>{{ skill.purpose }}</p>`.
   - "When: " primeiro item de `whenToUse[0]`. "When NOT: " primeiro de `whenNotToUse[0]` se houver.
   - Footer: `<CopyCommandButton :command="`/atomic-skills:${skill.name}`" />`.
   - Click no card (não no botão) → abre `<SkillCardExpanded>` modal.

7. `SkillCardExpanded.vue`:
   - Modal centered.
   - Full `purpose`, all `whenToUse[]`, all `whenNotToUse[]`, all `examples[]` (em `<pre>` para preservar formatação), `related[]` (cada chip clicável navega para a expanded view daquela skill — gerencia via store local).
   - Botão close.

8. `CopyCommandButton.vue`:
   - Mostra `📋 copy`. Click → `navigator.clipboard.writeText(command)` + toast "Copied!".
   - Toast minimal: setTimeout 1500ms removendo.

9. `ActiveIndicator.vue`:
   - `● active in repo` (verde) ou `○ available` (cinza).

10. Fallback de frontmatter ausente (delegado à etapa 05 backend):
    - Backend retorna skill com apenas `name`, `purpose` (primeiro parágrafo extraído), sem `whenToUse[]` etc.
    - Frontend renderiza: card mostra purpose + badge "📝 metadata incomplete" + ainda permite copy command.

11. Testes:
    - Snapshot SkillGrid com 12 skills.
    - Search: input "review" → grid filtra para skills com "review" no nome/purpose.
    - Filter: "in repo" → só cards com activeInRepo: true.
    - Click card → expanded modal aparece com todos detalhes.
    - Copy button → mock clipboard, verifica `writeText` chamado.
    - Skill com metadata incompleto renderiza sem crash.

## Testes a escrever

~8 testes.

## Definition of Done

- [ ] 12 skills listados (assumindo backend retorna 12)
- [ ] Cada card mostra name, purpose, when-to-use (1), example (1)
- [ ] Search filtra em tempo real < 50ms (medido)
- [ ] Filter por status funciona
- [ ] Copy command escreve clipboard correto
- [ ] Related skill click navega para target
- [ ] Skill sem frontmatter renderiza com fallback graceful
- [ ] Help page acessível mesmo sem consumer state (renderiza standalone)
- [ ] Coverage ≥ 60% em `src/client/components/help/**`
- [ ] Commit: `feat(client): Help page with skill grid, search, filters, copy command`

## Notas/decisões

- **Lista hardcoded de 12 skills no backend (etapa 05 fallback)**: usamos como source-of-truth em v0.1. Backend tenta ler do `~/.claude/skills/` (frontmatter de cada skill), mas se ausente, usa lista hardcoded com purpose extraído de primeiro parágrafo da descrição.
- **Debounce 50ms**: gate exige < 50ms. Sem debounce, cada keystroke filtra; com 50ms é praticamente instantâneo. Usar `requestAnimationFrame` ou `setTimeout(50)`.
- **`SkillCardExpanded` como modal vs inline**: modal mais limpo, evita reflow do grid. Usar `<dialog>` HTML nativo (excelente accessibility por default).
- **`related[]` chips**: cada chip mostra outro skill name; click troca a expanded view (ou abre nova modal — decidir: trocar in-place é menos disruptivo).
- **Sem skill activeInRepo nada na repo de demo**: aceitar empty state — show all 12 como "available". Demo não exige skill instalada.
- **Toast "Copied!"**: implementação 10-linhas (state global `toast: string | null`, App.vue renderiza overlay). Não importar lib.
