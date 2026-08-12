# Design — Project Flow (grafo + UI determinística)

**Status:** draft de handoff para implementação no monorepo atomic-skills  
**Substitui / evolui:** process map L1/L2 (`docs/kb/process-map.md`)  
**Dogfood fixture:** `docs/design/project-flow/dogfood/fluxo-sugestao.json`  
**Data:** 2026-08-12  

---

## Context

Todo plano multi-phase AS é obrigado a carregar um **process map** (Iron Law P1): `process/process.yaml` + HTML gerado por script determinístico. Na prática o L2 é uma **lista vertical de cards**; `edges[]` existem no schema mas **não são renderizados**. Isso basta para narrativa de marcos; **não** basta para validar com o PO um fluxo de interface com mensagens, portões XOR, loops e máquina de status.

Durante a feature `sugestao-necessidade-pdti` (repo arch-legacy) nasceu um segundo artefato: grafo JSON + viewer HTML com três projeções Mermaid (Sequência, Fluxo do processo, Estados). Esse protótipo prova o valor de produto — e prova que o process map atual não cobre o caso.

O produto **Project Flow** unifica a obrigação de mapa de processo com a capacidade do protótipo, como artefato de primeira classe do monorepo atomic-skills. O código e fixtures de referência migram para cá; o repo da feature deixa de ser dono do viewer.

---

## Interview (spine ratificada na análise com o operador)

| Campo | Conteúdo |
|-------|----------|
| **Problema** | Process map obrigatório não expressa nem renderiza grafo operacional; protótipo útil está acoplado a um plano de feature e fora do AS. |
| **In-scope** | Schema de flow genérico; validação determinística; render self-contained (seq+fluxo+estados); skill `/project flow` + stage de criação; migração do process map; fixture dogfood PDTI; ports de context/design/plan de referência. |
| **Out-of-scope** | Fills/níveis de aninhamento visual de `alt` (adiado); AND-gateway/join paralelos (v1); i18n multi-locale completo; Filament/app-map; implementar a feature PDTI em si. |
| **Done-when** | Qualquer plano multi-phase pode ter `flow/flow.json` validado + HTML gerado offline byte-estável; `project flow --check` verde; dogfood fixture passa; process-map legado dual-read ou migrado; docs/Iron Law atualizados. |
| **Stakes** | Iron Law P1 de todo plano; scripts/gates de criação; DX do `new plan`; compat com planos existentes só com process.yaml. |
| **Fontes** | process-map schema/render/detector; dogfood JSON+HTML; KB process-map; project router. |

---

## Decisions

### D1 — Um SoT de flow com camadas opcionais

Arquivo canônico por plano:

```
.atomic-skills/projects/<project-id>/<plan-slug>/flow/
  flow.json     # L1 SoT
  map.html      # L2 gerado (não editar à mão)
```

Camadas no mesmo JSON (`schemaVersion: "1.0"`):

| Camada | Obrigatória? | Conteúdo | Projeção UI |
|--------|--------------|----------|-------------|
| **Lifecycle** | sim (plan multi-phase) | `planSlug`, `scenario`, `actor`, `audience`, `ratifiedAt`, `youAreHere?` | chrome / gates |
| **journey** (L0) | recomendada | stages dual-copy + edges (o que o process map era) | aba ou modo “Jornada” / compat map cards |
| **graph** (L1) | se há UI/branching a validar | actors, entry, nodes sequence/decision/end | Sequência + Fluxo |
| **states** (L2) | se há máquina de status | entry, nodes, transitions com `via` | Estados |

Planos só-tooling podem ser **journey-only** (equivalente ao map atual). Feature com interface deve autorar **graph**; **states** quando existirem códigos de status de domínio.

### D2 — Validação core ≠ validação de domínio

- **Core (sempre no script):** schema AJV; refs de actor; `entry` existe; reachability; sequence tem `next` e messages válidas; decision xor ≥2 branches; `when` único por decisão; branch `next` existe; `states.via` ↔ branch id; dual copy se journey presente; lint anti-implementation-token no layperson (reuso do process-map).
- **Domínio (nunca no core):** “3 decisões”, ids `D1`/`D2`, `statusTo === 10`, etc. O dogfood PDTI é **fixture de dados**; regras de status da feature ficam no plano da feature, não no produto AS.
- Remover do protótipo `fluxo-completo.html` qualquer `validateModel` domain-hardcoded ao productizar.

### D3 — Script determinístico, HTML self-contained

Padrão idêntico ao process-map:

- `scripts/lib/render-flow.js` — pure: validate → normalize → HTML string  
- `scripts/render-flow.js` — CLI (`-o`, `--check`, `--stdout`)  
- `scripts/find-missing-flow.js` — detector de planos  
- Inline CSS (DS `site/assets/ds.css` + CSS do viewer)  
- **Modelo embutido** no HTML (sem `fetch('*.json')`)  
- Mermaid: versão **pinada** e preferencialmente **vendored** (offline); determinismo de contrato = Mermaid source estável + content-sha do L1; SVG pode variar levemente entre versões — documentar pin  
- `data-flow-content-sha` no `<html>` como `data-pm-content-sha`

### D4 — Comando e Iron Law

- Comando day-2: **`/atomic-skills:project flow`** (`--check`, `--open`, opcional `--audience` se journey dual).  
- Alias **`process`** por um minor: re-render flow se existir; senão legado process-map.  
- Stage de criação: renomear semanticamente para flow; manter id de gate `process-map` **ou** alias `flow` com migração de `creation-gates` (preferir **novo id `flow`** + dual accept no detector por 1 release).  
- Atualizar Iron Law: **NO PLAN WITHOUT FLOW** (journey e/ou graph conforme política abaixo).  
- **HARD:** wire `find-missing-flow` em `project verify` e gate de `implement` (o map prometia e não cumpria).

Política mínima de “tem flow suficiente”:

| Tipo de plano | Mínimo |
|---------------|--------|
| Multi-phase qualquer | `flow.json` com lifecycle + **journey** ratificado **ou** legacy `process.yaml` (janela de migração) |
| Plano com UI/branching material (agent julga; humano ratifica) | + **graph** |

### D5 — Projeções da UI L2

Sempre a partir do mesmo `flow.json`:

1. **Sequência** — se `graph` presente: `sequenceDiagram` contínuo, `alt`/`else` por XOR, notes de phase/effects; polish leve (◇, lifelines) sem fills de nível.  
2. **Fluxo do processo** — flowchart com `processLabel` / `processWho`.  
3. **Estados** — se `states` presente; senão aba oculta.  
4. **Jornada** (opcional v1.1) — cards dual-lens a partir de `journey` (substitui map.html legado visualmente).

Zoom default **100%**; pan/zoom; tabs. Chrome a partir de `title` / meta — zero copy N2 hardcoded.

### D6 — Origem do grafo (agente + humano)

- Agente **draft** a partir de `design.md` / source / businessIntent — **proibido** colapsar `phases[]` em stages/nodes 1:1 (P2).  
- Show na superfície escolhida → ratify → `ratifiedAt`.  
- Day-2: reabrir, ajustar JSON, re-render; HTML nunca é SoT.

### D7 — Migração process-map

1. Dual-read: detector aceita `flow/flow.json` **ou** `process/process.yaml` ratificado.  
2. Migrator: `process.yaml` → `flow.json` com só `journey` + lifecycle.  
3. Fixture: copiar dogfood JSON → align schema 1.0 (adicionar lifecycle fields; strip nada de graph se já válido).  
4. Deprecate write path de `process.yaml` na criação.  
5. Docs KB: `process-map.md` → supersede / redirect para `flow.md`.

### D8 — Destino do protótipo arch-legacy

- Cópias canônicas: **esta pasta** `docs/design/project-flow/dogfood/`.  
- Após PRs verdes, o plano PDTI no arch-legacy **remove** `docs/fluxo-*` e aponta para o produto AS (ou para `flow/` gerado no plan se ainda precisar de artefato local).  
- `process/` do plano PDTI permanece até migrator; depois opcional.

---

## Chosen approach

**Abordagem escolhida: substituir process-map por Flow unificado em camadas, com cut-over dual-read** (não “só embelezar map.html”, não “segundo comando eterno paralelo”).

Razões:

1. O monorepo já tem o **padrão de produto** certo (schema + pure render + detector + stage + content-sha).  
2. O protótipo dogfood tem o **modelo de grafo** certo (sequence/decision/end + states).  
3. Fundir sem camadas misturaria marcos de valor com mensagens de UI.  
4. Paralelo eterno (`process` + `flow`) dobra Iron Laws e confunde agentes.

### Rejected alternatives

| Alternativa | Por que rejeitada |
|-------------|-------------------|
| Só melhorar CSS do map.html | edges já existem e não são desenhados; sem schema de decision/messages |
| Manter process.yaml e gerar Mermaid a partir dele | expressividade insuficiente; seria inventar dados na render |
| `/project flow` para sempre ao lado de process | dual SoT permanente; dogfood já mostrou a dor |
| HTML client-only com fetch+CDN como contrato L2 | quebra file://, offline e determinismo (process-map já resolveu) |
| Validação domain no core | impede “qualquer fluxo” |

---

## Schema mínimo (normativo para v1)

```jsonc
{
  "schemaVersion": "1.0",
  "planSlug": "string",
  "title": "string?",
  "scenario": "string",
  "description": "string?",
  "actor": "string",
  "audience": "layperson|developer|both",
  "youAreHere": "stageId|null",
  "ratifiedAt": "ISO8601?",
  "ratifiedBy": "string?",
  "actors": [{ "id": "string", "label": "string", "kind": "actor|participant" }],
  "journey": {
    "stages": [/* process-map stage shape */],
    "edges": [{ "from", "to", "style": "solid|dashed" }]
  },
  "graph": {
    "entry": "nodeId",
    "nodes": {
      "S1": {
        "type": "sequence",
        "processLabel": "string",
        "processWho": "string?",
        "title": "string?",
        "tone": "blue|sky|violet|green|rose|slate|…",
        "messages": [{ "from", "to", "text", "async": false }],
        "effects": [{ "statusTo": 10, "label": "string" }],
        "next": "nodeId",
        "loop": false,
        "stage": "journeyStageId?"
      },
      "D1": {
        "type": "decision",
        "kind": "xor",
        "processLabel": "string",
        "actor": "actorId",
        "question": "string?",
        "branches": [{
          "id": "string",
          "when": "string",
          "label": "string",
          "next": "nodeId",
          "tone": "string?",
          "hint": "string?",
          "statusTo": "number?"
        }]
      },
      "end_ok": { "type": "end", "processLabel": "string", "tone": "green" }
    }
  },
  "states": {
    "entry": "stateId",
    "nodes": {
      "pendente": { "label": "string", "status": 10, "description": "string?", "terminal": false }
    },
    "transitions": [{
      "id": "string",
      "from": "stateId",
      "to": "stateId",
      "when": "string",
      "label": "string",
      "via": "branchId",
      "statusTo": "number?"
    }]
  },
  "invariants": ["string?"]
}
```

**Extração do dogfood:** `fluxo-sugestao.json` v2 ≈ `graph` + `states` + actors; falta envelopar com lifecycle + opcionalmente `journey` a partir de `process.yaml` do mesmo plano (já em `dogfood/`).

---

## Surface de skill (arquivos a tocar)

| Área | Arquivos (monorepo) |
|------|---------------------|
| Schema | `meta/schemas/flow.schema.json` |
| Scripts | `scripts/lib/render-flow.js`, `scripts/render-flow.js`, `scripts/find-missing-flow.js`, migrator opcional |
| Tests | `tests/render-flow.test.js`, `tests/find-missing-flow.test.js`, golden em `docs/design/project-flow/` ou `docs/design/flow-sketches/` |
| Skills | `skills/core/project.md` grammar; `project-flow.md`; `new-plan/stage-flow.md`; create-plan stage list; verify; implement HARD-GATE |
| KB | `docs/kb/flow.md`; supersede `process-map.md` |
| Plugin mirror | `~/.grok/plugins/atomic-skills` via install (não editar só o mirror) |

---

## Blast radius (migration / one-way doors)

| Porta | Risco | Contenção |
|-------|-------|-----------|
| Mudar Iron Law / stage id | Planos mid-creation; gates JSON | Dual stage accept; dual-read detector 1+ release |
| HTML gerado diferente | Diffs barulhentos em plans | content-sha; não commitar map.html em todos os plans se política for generate-on-open (alinhar com process-map atual: **HTML no disk**) |
| Quebrar `project process` | Operadores treinados | Alias → flow ou legado |
| Fixture domain vaza para core | Produto não-genérico | Testes com **segunda** fixture mínima (2 actors, 1 xor, sem status) |

---

## Non-goals

- Visual de profundidade/fills em fragmentos `alt` (explícito: outro dia).  
- BPMN export completo / pools formais.  
- Gateway paralelo + join.  
- Editar grafo no browser (SoT continua JSON/YAML no disco).  
- Substituir app-map / design-brief.  
- Implementar sugestão PDTI (domínio arch-legacy).

---

## Open questions

Resolvidas por default neste design (operador pode override):

| # | Questão | Default no design |
|---|---------|-------------------|
| Q1 | Nome do comando | `flow` (`process` alias) |
| Q2 | Path no plan | `flow/flow.json` + `flow/map.html` |
| Q3 | Journey-only suficiente para “ready”? | Sim, durante e após migração; graph exigido só quando o stage/humano ratifica necessidade de UI flow |
| Q4 | Mermaid vendor vs CDN | Vendor/pin no bundle do render (offline) |
| Q5 | Manter dual copy layperson/dev | Sim em `journey`; graph usa `processLabel` único (língua do plano) |

Se o operador discordar de Q1–Q5 antes do PR1, ajustar só `design.md` e seguir.

---

## Key Decisions

1. **Flow unificado em camadas** substitui process-map como SoT de processo do plano.  
2. **Core validation genérica**; domínio só em dados de fixture/plan.  
3. **Render determinístico self-contained** no padrão process-map.  
4. **Comando `project flow`** + stage + detector + verify/implement.  
5. **Cut-over dual-read**; dogfood PDTI é fixture, não regra.  
6. **Produto e handoff só neste monorepo**; arch-legacy deixa de carregar o viewer.

---

## PR Plan

### PR1 — Schema + validate core + fixture

- **Title:** `feat(flow): schema 1.0 + core validator + dogfood fixture`  
- **Touches:** `meta/schemas/flow.schema.json`, `scripts/lib/validate-flow.js` (ou parte de render-flow), tests, move/align `docs/design/project-flow/dogfood/fluxo-sugestao.json` → fixture de teste  
- **Deps:** none  
- **Done when:** AJV valida dogfood envelopado; fixture mínima genérica valida; domínio PDTI **não** está no validator

### PR2 — Render L2 (Sequência + Fluxo + Estados)

- **Title:** `feat(flow): deterministic render-flow HTML (mermaid projections)`  
- **Touches:** `scripts/lib/render-flow.js`, `scripts/render-flow.js`, CSS/JS shell extraído de `dogfood/fluxo-completo.html`, mermaid pin, golden test content-sha / mermaid source snapshot  
- **Deps:** PR1  
- **Done when:** `node scripts/render-flow.js dogfood.json -o /tmp/x.html` offline; tabs seq/fluxo/estados; sem fetch de JSON externo

### PR3 — Detector + skill day-2 + stage criação

- **Title:** `feat(project): flow command, creation stage, find-missing-flow`  
- **Touches:** `find-missing-flow.js`, `project-flow.md`, `stage-flow.md`, router grammar, creation-gates stage id, dual-read com process-map  
- **Deps:** PR2  
- **Done when:** `project flow --check` documentado; stage show-before-ratify; process alias

### PR4 — Verify/implement gates + KB + migrator

- **Title:** `feat(flow): verify/implement HARD path + process.yaml migrator + kb`  
- **Touches:** project-verify, implement.md, `docs/kb/flow.md`, migrator script, deprecate notes on process-map  
- **Deps:** PR3  
- **Done when:** verify lista flow; migrator process→journey; KB canônico

### PR5 — Cleanup dogfood no arch-legacy (repo externo)

- **Title:** (no arch-legacy) remove `docs/fluxo-*` / apontar para AS  
- **Deps:** PR2+ no mínimo; idealmente PR4  
- **Done when:** feature repo sem viewer product orphan

---

## Self-review against code-quality gates

- **G1 read-before-claim:** applied — process-map KB, render-process-map behavior (edges unused), dogfood validateModel domain rules, package-root scripts layout — ver `research-digest.md` e `analysis/*`.  
- **G2 soft-language:** applied — defaults explícitos; sem “talvez depois” em decisões de produto.  
- **G6 reference-or-strike:** applied — claims de monorepo verificados na sessão de análise 2026-08-12; paths listados em `references/monorepo-paths.md`.

---

## Handoff for implementers

1. Comece por **PR1** com fixture em `dogfood/`.  
2. Extraia builders de `dogfood/fluxo-completo.html` (`walkLayout`, `buildSequenceMermaid`, `buildFlowMermaid`, `buildStatesMermaid`) **sem** domain validate.  
3. Não reabra experimento de fill de nível.  
4. Leia `migration.md` antes de tocar Iron Law / creation-gates.
