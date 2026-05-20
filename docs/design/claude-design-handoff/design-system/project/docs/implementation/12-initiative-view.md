# 12 — Initiative zoom view (F6)

## Objetivo

Renderizar `/initiatives/:slug` exatamente como wireframe seção 3 de [ui-layouts.md](../ui-layouts.md). Breadcrumb `F0/9 · plan: v3-redesign`, exit gates com verifier badges, stack tree, task table com linhas expansíveis + status icons + tags, parked/emerged side-by-side, references + cross-refs como links in-app, markdown body via `marked`.

## Pré-requisitos

- Etapa 11 concluída (átomos compartilhados: StatusIcon, MarkdownBody, ArtifactLink, HighlightBadge placeholder).

## Gates F1-F13 cobertos

- **F6** (Initiative zoom view) — todos os bullets.

## Arquivos a criar/editar

- `src/client/views/InitiativeView.vue` — substituir placeholder
- `src/client/components/initiative/InitiativeHeader.vue`
- `src/client/components/initiative/ExitGateList.vue`
- `src/client/components/initiative/ExitGateRow.vue`
- `src/client/components/initiative/VerifierBadge.vue` (átomo — usado também em 11 se houver)
- `src/client/components/initiative/StackTree.vue`
- `src/client/components/initiative/StackFrame.vue`
- `src/client/components/initiative/TaskTable.vue`
- `src/client/components/initiative/TaskRow.vue`
- `src/client/components/initiative/TaskExpanded.vue`
- `src/client/components/atoms/TagChip.vue`
- `src/client/components/initiative/ParkedEmergedPanel.vue`
- `src/client/components/initiative/ReferencesList.vue`
- `src/client/components/initiative/CrossRefList.vue`
- `tests/unit/client/components/initiative/*.test.ts`

## Passos

1. `InitiativeView.vue`:
   - Props `slug: string`.
   - `onMounted` → `stateStore.loadState(consumer, slug)`; também `stateStore.loadState(consumer, initiative.parentPlan)` (para breadcrumb mostrar título do plan).
   - Template:
     ```
     <InitiativeHeader :initiative :plan />
     <ExitGateList :gates="initiative.exitGates" />
     <StackTree :stack="initiative.stack" />
     <TaskTable :tasks="initiative.tasks" />
     <ParkedEmergedPanel :parked :emerged />
     <ReferencesList :refs="initiative.references" />
     <CrossRefList :crossRefs="initiative.crossTaskRefs" />
     <MarkdownBody :content="initiative.body" />
     ```

2. `InitiativeHeader.vue`:
   - Breadcrumb: se `initiative.parentPlan` existir, derivar `phaseIndex` (1-based) e `total` (`plan.phases.length`). Render: `{phaseId}/{total} · plan: {parentPlan}`. Standalone: "standalone initiative".
   - Linha 2: `{slug} · {status} · {started} → ...`.
   - Linha 3: "Goal: {goal}".
   - Linha 4: "Branch: {branch ?? '—'} · Scope: {scope.paths.join(' + ')}".
   - Linha 5: "Next: {nextAction ?? '—'}" destacado.

3. `ExitGateList.vue` + `ExitGateRow.vue`:
   - Para cada criterion: `<StatusIcon :status="criterion.status" />` `{criterion.id}  {description}` `<VerifierBadge :verifier="criterion.verifier" />`.
   - Status icons: `[·]` pending, `[✓]` met (verde), `[⊘]` deferred (amber com tooltip = `deferredReason`).
   - Click em row → modal com `verifierOutput` history (em v0.1, só mostra o verifier description + último `evidence` se existir).
   - Trigger via `aideck_verify_exit_gate` (botão "Run" para shell/manual — manual abre dialog pra usuário inputar resultado). Em v0.1 essa interação é **read-only** no client (gate F11 nota: "write via MCP in v0.1"). Botão pode existir mas chamar `POST /api/...` que delega para MCP — OK como conveniência. Decisão: **incluir botão "Run" só para shell**, manual deixar visual estático até v0.2.

4. `VerifierBadge.vue`:
   - Pill colorida por kind: shell (verde), query (azul), test (roxo), manual (cinza).
   - Texto: `[shell]` / `[query]` / `[test]` / `[manual]`.
   - Tooltip mostra `command` / `sql` / `pattern` / `description`.

5. `StackTree.vue` + `StackFrame.vue`:
   - Tree indentado: depth visual via padding-left.
   - Cada frame: `<icon> {{ frame.title }} ({{ frame.type }})`. Top frame com label "◉ HERE".
   - Cor por type: `task` cyan, `research` purple, `validation` green, `discussion` muted.

6. `TaskTable.vue` + `TaskRow.vue` + `TaskExpanded.vue`:
   - Header: "ID | Title | Status | Updated".
   - Cada `TaskRow`:
     - Cells: `task.id` (mono), `{title}` com `<TagChip v-for="t in task.tags" :tag="t" />`, `<StatusIcon />`, `formatRelativeTime(task.lastUpdated)`.
     - Botão expand (`[▾]`). Click revela `<TaskExpanded :task="task" />` inline.
   - `TaskExpanded`:
     - `{description}`, `<outputs>` lista (cada `<output>` chip com `kind` ícone + path/command), `<VerifierBadge v-if="task.verifier" />`, blockedBy chips linking para outras tasks.
   - HighlightBadge inline se task tem highlights ativos (etapa 14 conecta).

7. `TagChip.vue` átomo:
   - Cor por convenção: `critical` red, `gap-legacy` purple, default muted.

8. `ParkedEmergedPanel.vue`:
   - Two-column: "Parked (N)" | "Emerged (N)".
   - Cada item: `<⌂ {title}> surfaced {time}` (parked) / `<⇥ {title}> surfaced {time} · {promoted ? 'promoted' : 'not promoted'}` (emerged).

9. `ReferencesList.vue`:
   - Lista compacta: `→ {path} § {section ?? '—'}  {label}`.
   - Cada ref usa átomo `ArtifactLink`.

10. `CrossRefList.vue`:
    - Cada `crossTaskRefs[]`: `↗ {fromTaskId} {relation} {toInitiativeSlug} {toTaskId}` com `note` tooltip.
    - Link clicável → router.push para target initiative + scroll-to-task (use URL hash `#task-T-002`).

11. `MarkdownBody.vue` átomo:
    - `marked.parse(content, { breaks: false, gfm: true })`. Sanitização básica (marked já escapa HTML).
    - Code blocks com `prism.js`? Não — fica para v0.2. Em v0.1, `<pre><code>` cru com cor de fundo `--bg-elevated`.

12. Smoke renderizando `v3-f0-foundation-repair.demo.md`:
    - 3 exit gates listados, todos pending
    - 8 tasks renderizadas (T-001 done com ✓, T-002 active com ◉, T-005 blocked com ⊘ e badges "critical", "gap-legacy")
    - Stack mostra 1 frame com "HERE"
    - 0 parked + 1 emerged
    - References (2) + crossTaskRefs (1) renderizados
    - Body markdown renderizado

13. Testes:
    - Snapshot InitiativeView com fixture.
    - Expandir TaskRow → TaskExpanded visível.
    - CrossRef click navega para target.
    - VerifierBadge renderiza cada kind corretamente.

## Testes a escrever

~10 testes (snapshots + interações: expand task, click cross-ref, exit gate row click).

## Definition of Done

- [ ] Renderiza fixture v3-f0-foundation-repair com tudo conforme wireframe
- [ ] Breadcrumb mostra `F0/9 · plan: v3-redesign`
- [ ] Status icons + tags + verifier badges visíveis
- [ ] Stack frame top tem label "HERE" + cor por tipo
- [ ] Parked/Emerged side-by-side, contadores corretos
- [ ] CrossRef click navega para `v3-f1-filament-redesign#task-T-002`
- [ ] Body markdown renderizado (headings, listas, code)
- [ ] Coverage ≥ 60% em `src/client/components/initiative/**`
- [ ] Commit: `feat(client): Initiative zoom view with exit gates, stack, tasks, refs, body`

## Notas/decisões

- **VerifierBadge "Run" só para shell**: manual exige input estruturado (custo de UI design); query/test não funcionam em v0.1. Limitar shell evita criar formulários incompletos.
- **`<details>` HTML nativo para expansão**: simples, acessível, sem estado adicional.
- **`formatRelativeTime`**: implementar helper simples (`'30 min ago'`, `'2 hrs ago'`, `'5 days ago'`). Não importar `date-fns` (peso desnecessário); 20 linhas de código resolvem.
- **URL hash `#task-T-002`**: `scroll-margin-top` em `.task-row` para offset do TopChrome fixo.
- **`MarkdownBody` sem syntax highlighting em v0.1**: Prism/highlight.js pesam. Aceitar pre/code monocromático.
- **Lista de scope.paths longa**: se > 5 paths, mostrar primeiros 3 + "and N more (click)" que expande.
- **Standalone initiative**: breadcrumb fica `(standalone)` em vez de `F0/9 · plan: ...`. Goal/Scope/etc. renderizados igual.
- **Tasks sem `outputs`/`tags`/`description`**: renderizar TaskExpanded com mensagem "No additional details".
