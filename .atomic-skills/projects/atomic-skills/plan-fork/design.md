# plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada

Design ratificado pelo usuário em 2026-06-19. Aprovação estratégica (Opção C —
relação pai/filho distinta de `supersedes`, com **ambos** os ciclos de vida) e o
interior (D1 = âncora na fase + task opcional; D6 = handoff ao aiDeck) fechados via
duas rodadas de `AskUserQuestion` nesta sessão. Brainstorm front-half (frame →
diverge → ratify) feito interativamente; este arquivo é o sink.

## Contexto / Problema

Durante a execução de um Plano P (ex.: fase F2 parcialmente feita), surge um
realinhamento grande demais para `new-phase` (degrau 6) ou `split-phase` (degrau 7),
mas que **não substitui** P — P continua válido e deve retomar depois. A emergence
ladder (`skills/core/project.md:110-121`) pula de "split-phase" (degrau 7, dentro do
mesmo plano) direto para "adopt/supersedes" (degrau 8 = substituição). Não existe
relação plano→plano de **pai/filho**: `meta/schemas/plan.schema.json:98` só tem
`supersedes` (substituição, scope full|partial), e `parentPlan`
(`meta/schemas/initiative.schema.json:38`) é fase→plano, não plano→plano. Hoje o
usuário pausa P na cabeça, cria um plano solto, e nada o traz de volta ao ponto de
inserção.

## Decisions

- **D1 — Âncora do elo (ratificado: fase + task opcional).** Back-link canônico na
  fase do pai: `phases[<id>].spawnedPlans[]` (array de slugs). O filho grava
  `spawnedFrom: {plan, phaseId, taskId?, mode}` — `taskId` opcional, preenchido só
  quando o gatilho foi uma task concreta de F2. A unidade que pausa/retoma é a FASE,
  casando com o modelo mental "como se a fase implementasse o plano".
- **D2 — Estado do pai (ratificado: ambos os modos, escolhidos no fork).**
  `--mode pause`: P→`paused`, F2→`paused` (reusa o cascade-pause já existente,
  `project-transitions.md:170,232`), filho→`active`; ao concluir o filho, oferta de
  retomada. `--mode parallel`: P fica `active` na sua worktree, filho nasce `active`
  em worktree própria (reusa `parallelismAllowed` + o enforcer worktree-por-plano que
  `multiplan-focus-resolution` entrega).
- **D3 — Verbo + degrau.** Novo verbo
  `fork-plan <child-slug> --from <phaseId> --mode pause|parallel [--task <T>]` e um
  **degrau 7.5** residente na ladder. `fork-plan` = (1) ratifica o elo no pai (gate
  `context`: solves/trigger/assumesStillValid, igual aos outros itens emergentes) +
  (2) entrega ao fluxo `new plan` — o filho passa pelo DESIGN gate (R-ORCH-09) como
  qualquer plano. Dois invariantes preservados: o *porquê* do fork é ratificado, e o
  filho ganha seu próprio `design.md`.
- **D4 — Loop de retomada.** Na conclusão/`archive` do filho, o propagador
  (`project-transitions.md:208-223`) detecta `spawnedFrom` e oferece: "plano-filho
  concluído — retomar P em F2?" (un-pause P, F2→`active`, `currentPhase=F2`). Opt-in
  (intrusive-actions rule).
- **D5 — Guardas.** Detecção de ciclo (filho não pode forkar um ancestral); aviso ao
  arquivar P com filho vivo; `spawnedPlans[]` é array (vários filhos por fase); o
  focus resolver trata P(paused)+C(active) como **hierarquia**, não como ambiguidade
  `⧉` multi-active.
- **D6 — Dashboard (ratificado: handoff, não código).** O aiDeck está em refatoração
  agora. Este plano **não** toca código do aiDeck; em vez disso produz um handoff em
  `~/aideck/docs/handoffs/atomic-skills-plan-fork.md` documentando a estrutura de
  estado nova (campos, semântica pai/filho, expectativa de render aninhado do filho
  sob a fase do pai) para a refatoração consumir lá.

## Chosen approach

Mudança **aditiva**, reusando a maquinaria existente em vez de criar paralelos:

- **Schema (aditivo, opcional):** `spawnedFrom` no Plano + `phases[].spawnedPlans[]`
  no `phaseDescriptor`. Diff concreto na seção "Schema diff".
- **Verbo `fork-plan` + degrau 7.5 residente** para o gatilho ambiente.
- **Pausa/retomada:** reuso de `switch`/cascade-pause + propagador de `archive`.
- **Paralelo:** reuso de `parallelismAllowed` + worktree-por-plano
  (`multiplan-focus-resolution`).
- **Ratify gate:** o fork grava `context`/`provenance` como todo item emergente.
- **Dashboard:** handoff ao aiDeck (sem código cross-repo neste plano).

Zero mudança em `supersedes` ou na ladder existente — só uma inserção (7.5) e campos
novos opcionais.

## Schema diff (proposta — revisar antes de codar)

```jsonc
// meta/schemas/plan.schema.json — adicionar em phaseDescriptor.properties:
"spawnedPlans": {
  "type": "array",
  "items": { "$ref": "common.schema.json#/$defs/slug" },
  "description": "Slugs de planos-filho forkados desta fase (plan-fork). Back-link escrito por fork-plan."
}

// meta/schemas/plan.schema.json — adicionar em properties (top-level Plan):
"spawnedFrom": {
  "type": "object",
  "additionalProperties": false,
  "required": ["plan", "phaseId", "mode"],
  "properties": {
    "plan":    { "$ref": "common.schema.json#/$defs/slug" },
    "phaseId": { "type": "string", "minLength": 1 },
    "taskId":  { "type": "string" },
    "mode":    { "type": "string", "enum": ["pause", "parallel"] }
  }
}
// provenance/context do fork reusam common.schema.json#/$defs/{provenance,context}.
```

**Verificar (não assumir):** `plan.schema.json` é `additionalProperties:false` e
declara espelhar `aideck/src/schemas/project-status.ts:Plan` (`plan.schema.json:5`).
Confirmar contra o contrato **publicado** (`node_modules/@henryavila/aideck`) se o
Plan é `.strict()` — se for, os campos novos precisam ser tolerados/espelhados lá
antes de o atomic-skills emiti-los, senão o card inteiro do projeto dá
`⊘ failed to load` (mesma classe do invariante de gate, `project.md:100`). Esse
requisito vai explícito no handoff (D6).

## Blast radius

- `meta/schemas/plan.schema.json` (+ `src/validate-state.js` e seus testes).
- `skills/core/project.md` (ladder residente — degrau 7.5).
- `skills/shared/project-assets/project-emergence.md` (procedure `fork-plan`).
- `skills/shared/project-assets/project-transitions.md` (retomada no
  archive-propagation; `switch` já cobre a pausa).
- `scripts/emit-focus.js` + `scripts/reconcile-focus.js` (consciência pai/filho no
  foco, para não disparar `⧉` falso).
- **Externo (handoff, não código):** `~/aideck` — render aninhado pai/filho durante
  a refatoração do dashboard.
- **Reversível:** campos opcionais, sem migração de dados existentes. Não é
  one-way-door.

## Fases propostas (decompõem no plano)

- **F0** — Schema + validação do elo (`spawnedFrom`/`spawnedPlans` +
  cycle-detection + tests RED→GREEN).
- **F1** — Verbo `fork-plan` + degrau 7.5 (ratify do elo + handoff ao `new plan`;
  modos pause/parallel).
- **F2** — Loop de retomada (archive-propagation oferece retomar o pai na âncora).
- **F3** — Focus-resolver consciente de pai/filho (P paused + C active ≠ `⧉`).
- **F4** — Handoff ao aiDeck + docs (estrutura de estado + verificação do contrato
  publicado).
