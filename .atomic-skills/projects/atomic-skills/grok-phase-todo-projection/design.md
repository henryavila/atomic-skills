# Design: Projeção de fases do project no TODO do Grok

## Context

Durante sessões longas no Grok Build, o agente perde o mapa macro do plan (`project`):
fases, progresso de tasks e o que a fase corrente faz. O Grok oferece `todo_write`
(checklist de sessão no scrollback + disciplina de turn-end) e um Tasks pane (`Ctrl+G`)
para runtime (subagents/background) — superfícies distintas do backlog canônico em
`.atomic-skills/`.

O package já emite um digest de foco (`scripts/refresh-state.js` → `emit-focus` →
`.atomic-skills/focus.json`) com `phase.id/title/slug` e `tasks.done/total`, pensado
para statusline/claudebar. Não existe bridge formal para o `todo_write` do Grok.
Skills bundled do Grok (`/implement`, `/pr-babysit`) usam Todo Scaffold de **processo**;
dogfood de `implement` no Atomic Skills espelhou passos de maestro, não fases do plan.

**verified_by:** `scripts/emit-focus.js` (`phaseInfo`, `taskCounts`);
`meta/schemas/focus.schema.json`; `meta/schemas/plan.schema.json` `$defs/phaseDescriptor`
(`id`, `slug`, `title`, `goal` required; `summary` optional);
`docs/design/statusline-focus-integration.md`; conversa de análise 2026-07-24 (ratificada).

## Decisions

1. **Granularidade do TODO Grok = só fases do plan ativo (tree-relative), não tasks `T-00N`.**  
   O checklist de sessão mostra o trilho do plan. Tasks continuam só no SoT + aiDeck +
   handoff. Evita SoT duplo e competição com GATE-R2.

2. **Label obrigatório com identidade semântica da fase, não só `F0 (x/y)`.**  
   Formato canônico:
   `F0 (2/12) — <summary || title>`  
   - `F0` = `phase.id`  
   - `(2/12)` = `tasksDone/tasksTotal` da initiative materializada (não `phase.index/total`)  
   - após o travessão = o que a fase faz (`summary` preferido; fallback `title`)  
   Descriptor-only: `F2 (—) — <title> · not materialized` (nunca inventar total).

3. **Fonte de identidade: campos já existentes — não criar schema novo de “phase identity”.**  
   - `title` (required no descriptor)  
   - `summary` (optional, ideal; detector `find-missing-summaries.js`)  
   - `goal` só como último fallback truncado  
   Slug longo **não** é o texto principal do content (pode ser o `id` estável do todo).

4. **SoT imutável: só a skill `project` (e `implement` via `done`/`phase-done`) muta
   `.atomic-skills/`.**  
   `todo_write` é projeção de sessão, read-only em relação ao plan. Ordem:
   mutar YAML → `refresh-state` → helper de projeção → `todo_write`.  
   Nunca: marcar TODO completed e daí fechar fase/task.

5. **Todo status da fase deriva do status canônico da fase, não só do ratio de tasks.**  
   - `completed` ⇔ phase/initiative `done|archived`  
   - `in_progress` ⇔ fase corrente/`active` (mesmo com 12/12 tasks se gates abertos)  
   - `pending` ⇔ demais  
   Content `(n/N)` é informativo.

6. **Projeção host-local skill-level (sem fork do core Grok / painel nativo).**  
   Não escrever em `~/.grok/sessions/.../plan.json` por script. O agente aplica
   `todo_write` a partir de payload determinístico do helper.

7. **Harden do emit em duas frentes (digest fresco + espelho Grok).**  
   (a) Garantir `refresh-state` nos caminhos de mutação (prosa + lint estrutural).  
   (b) Helper determinístico + obrigação skill de aplicar o payload nos momentos certos
   + reseed pós-compaction e no start de sessão/implement.

8. **Scaffold de processo (`proc:*`) não compete com scaffold de fases** quando há
   plan ancorado: o default sob `project`/`implement` é o scaffold de fases.

## Chosen approach

**Abordagem escolhida: projeção unidirecional fase-escopada via helper + skill wire-up
sobre `refresh-state` / rollups / identity fields existentes.**

Componentes:

| Peça | Papel |
|---|---|
| `scripts/project-session-todos.js` (nome final no implement) | Lê plan ativo (pickFocus tree-relative) + `phases[]` + rollups/initiatives; emite JSON `{ merge, todos[] }` com ids estáveis `<planSlug>:F0` e content no formato canônico |
| Extensão de `lint-transition-emits` (ou lint irmão) | Exige `refresh-state` (+ menção ao helper de projeção) nos blocos `done` / `reconcile` / `phase-done` / `phase-reopen` / `switch` / `unblock` |
| Prosa `project-transitions` + `implement` | Após close/advance: refresh → helper → `todo_write`; reseed no start e pós-compaction |
| Opcional F+ | Incluir `summary` no `focus.json` se o helper quiser um único arquivo; **não** é pré-requisito se o helper ler plan+initiatives |

**Alternativas pesadas e rejeitadas** — ver § Rejected alternatives.

**Por que esta ganhou:** reutiliza rollups + `title`/`summary` já no SoT; zero mudança de
schema de Task/Plan para identidade; zero dependência de fork do Grok; alinha com o
padrão Todo Scaffold nativo (um `in_progress`, reseed pós-compact); fecha o gap
“só F0 (x/y)” com o campo semântico já autorado no decompose.

## Non-goals

- Substituir aiDeck, handoff, ou Iron Law do `project`.
- Projetar tasks `T-00N` no TODO do Grok nesta entrega.
- Painel nativo no chrome do Grok / leitura automática de `focus.json` pelo host.
- Escrever `plan.json` da sessão por shell.
- Tornar `todo_write` autoridade de close (GATE-R2 permanece).
- MCP project-state server / marketplace (D10 package).
- Multi-IDE: a projeção é **só Grok**; Claude/Codex/Cursor não recebem este espelho
  (SoT em `.atomic-skills/` continua portátil).

## Open questions

1. Nome final do script helper (`project-session-todos.js` vs `emit-session-todos.js`)
   — decidir na Fase 0 de contrato sem bloquear design.  
2. Soft Grok sem hooks-trust: reseed no SessionStart do **plugin** pode falhar-open;
   a skill path de `implement`/`project` start deve reseed independentemente.  
3. Incluir `gates met/total` no content da fase (`F0 (2/12 tasks · 0/3 gates)`) —
   default **não** nesta v1; só tasks, para não poluir a linha.

## Critic resolutions (post-approve questions)

Resolved for PLAN without reopening the approach:

1. **Process vs phase scaffold:** on reseed after `refresh-state` / implement start /
   phase scaffold write, the helper payload is applied with `merge: false` (full
   replace) so only phase todos remain. Mid-flight content updates for the same
   plan use `merge: true` on stable `<planSlug>:Fn` ids only. A concurrent
   `proc:*` scaffold is **forbidden** while a plan is anchored; if process steps
   are needed, they live as narrative in handoff, not as competing todos.
2. **`paused` mapping:** a phase with status `paused` projects as todo
   `pending` with content suffix ` · paused` (not `completed`, not omitted). A
   paused plan is not the pickFocus winner on another tree; if the current tree’s
   focus plan is paused, emit empty scaffold (same empty-focus discipline as
   `emit-focus`).

## Rejected alternatives

1. **Tasks individuais no TODO** — granula demais; compete com `done`/verifier; lista
   explode. Rejeitado na análise ratificada.  
2. **Só `F0 (x/y)` sem title/summary** — insuficiente para “não se perder no que a
   fase faz”. Rejeitado.  
3. **Criar campo schema novo de identidade** — `title`/`summary`/`goal` já cobrem;
   detector de summary existe. Rejeitado.  
4. **Tasks pane (`Ctrl+G`) como work items do plan** — runtime ≠ backlog. Rejeitado.  
5. **Dual authority (TODO fecha task)** — reabre completion drift. Rejeitado.  
6. **Fork do core Grok / painel product** — fora do alcance do package; non-goal v1.  
7. **Escrever `plan.json` por script** — path opaco, race com TUI. Rejeitado.

## Self-review against code-quality gates

- G1 read-before-claim: applied — claims sobre emit/schema/summaries amarradas a
  `emit-focus.js`, `focus.schema.json`, `plan.schema.json` phaseDescriptor,
  `find-missing-summaries.js`, `statusline-focus-integration.md`.
- G2 soft-language: applied — decisões em imperativo / formato canônico; sem
  “should/probably works”.
- G6 reference-or-strike: applied — assertions de código existente com
  `verified_by` no Context; decisões de produto marcadas como ratificadas na
  conversa 2026-07-24.
