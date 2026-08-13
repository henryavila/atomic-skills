# Design — Project Flow (grafo + UI determinística)

**Status:** ratificado pelo operador 2026-08-12 (sessão noite) — process-map **descartado**, não dual-read. Código ainda não implementado.  
**Substitui:** process map L1/L2 (`docs/kb/process-map.md`) — descarte completo na PR4.  
**Dogfood fixture:** `docs/design/project-flow/dogfood/fluxo-sugestao.json`  
**Data:** 2026-08-12  
**Implementação:** cascata PR1→PR5; próxima sessão começa na PR1. Ver `HANDOFF.md`.

---

## Context

Todo plano multi-phase AS é obrigado a carregar um **process map** (Iron Law P1): `process/process.yaml` + HTML gerado por script determinístico. Na prática o L2 é uma **lista vertical de cards**; `edges[]` existem no schema mas **não são renderizados**. Isso basta para narrativa de marcos; **não** basta para validar com o PO um fluxo de interface com mensagens, portões XOR, loops e máquina de status.

Durante a feature `sugestao-necessidade-pdti` (repo arch-legacy) nasceu um segundo artefato: grafo JSON + viewer HTML com três projeções Mermaid (Sequência, Fluxo do processo, Estados). Esse protótipo prova o valor de produto — e prova que o process map atual não cobre o caso.

O produto **Project Flow** **substitui** o process-map (operador, 2026-08-12: *“é um lixo, descarte completamente”*). Não há dual-read de produto nem aba de cards. O modelo é o grafo do protótipo (sequence / xor / end + Sequência / Fluxo / Estados). O código e fixtures de referência migram para cá; o repo da feature deixa de ser dono do viewer.

---

## Interview (spine ratificada na análise com o operador)

| Campo | Conteúdo |
|-------|----------|
| **Problema** | Process map obrigatório não expressa nem renderiza grafo operacional; protótipo útil está acoplado a um plano de feature e fora do AS. |
| **In-scope** | Schema de flow genérico; validação determinística; render self-contained (seq+fluxo+estados); skill `/project flow` (comando, não stage de criação); hard-gate inicial do `implement`; descarte do process-map; fixture dogfood PDTI; ports de context/design/plan de referência. |
| **Out-of-scope** | Fills/níveis de aninhamento visual de `alt` (adiado); AND-gateway/join paralelos (v1); i18n multi-locale completo; Filament/app-map; implementar a feature PDTI em si; editor visual no browser; aba/cards de journey (process-map); stage `flow` inescapável no `new plan`. |
| **Done-when** | `implement` recusa sem artefato de flow ratificado; `project flow` gera/atualiza/exibe/ratifica a qualquer momento; process-map removido do write path e da obrigação P1; dogfood fixture passa sem regras PDTI no core. Ready sem flow é legal. |
| **Stakes** | Iron Law nova: **NO IMPLEMENT WITHOUT VALIDATED FLOW**; DX do `new plan` (sem cerimônia extra); planos existentes bloqueiam no primeiro `implement` até o comando ratificar. |
| **Fontes** | process-map (pipeline a copiar, schema de cards a jogar fora); dogfood JSON+HTML; `src/app-map/validate.js` (padrão AJV); project router. |

---

## Decisions

### D1 — Um SoT de flow com camadas opcionais

Arquivo canônico por plano:

```
.atomic-skills/projects/<project-id>/<plan-slug>/flow/
  flow.json     # L1 SoT
  flow.html     # HTML gerado (não editar à mão; **não** se chama map)
```

Camadas no mesmo JSON (`schemaVersion: "1.0"`):

| Camada | Obrigatória? | Conteúdo | Projeção UI |
|--------|--------------|----------|-------------|
| **Lifecycle** | sim no artefato (quando o flow existe) | `planSlug`, `scenario`, `actor`, `audience`, `ratifiedAt`, `ratifiedGraphSha`, `youAreHere?` | chrome / gates |
| **graph** (L1) | **obrigatório** para `implement` de **qualquer plano** (operador 2026-08-12) | `entry` + `nodes` sequence/decision/end. **`actors[]` é raiz do JSON** (dogfood v2), não dentro de `graph`. | Sequência + Fluxo |
| **states** (L2) | se há máquina de status | entry, nodes, transitions com `via` | Estados |
| **journey** (L0) | **não é produto** | residual opcional no schema; sem UI de cards | — |

Tooling-only também leva **graph** (pode ser curto: sequences + xor se houver). Não existe **implement** com cards de process-map. `states` só se a chave existir no JSON (Q7). `ready` sem flow é legal.

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

### D4 — Comando + hard-gate de implement (não stage de criação)

Operador 2026-08-12 (override): validar o fluxo **não** é obrigação do fim do `new plan`. É gate **automático, inicial e não-skippável** do `implement`. A validação humana é o comando.

- Comando: **`/atomic-skills:project flow`** — generate / update / show / ratify / `--check` / `--open`. Único escritor de `ratifiedAt` (AskUserQuestion depois do show; chat “ok” não conta).  
- Alias **`process`**: só chama flow. Sem fallback para cards.  
- **Sem** stage `flow` inescapável. PR3 **remove** o stage `process-map` da criação (`summaries` → `reviews`). Agente **pode** draftar `flow.json` no `new plan`; não é gate.  
- Iron Law (PR4): **NO IMPLEMENT WITHOUT VALIDATED FLOW**. Vale para **todo plano** que o `implement` aceita (AS multi-phase, AS 1-phase, foreign). `process.yaml` não cumpre. `ready` sem flow é legal. Ad-hoc sem arquivo de plano = sem gate (não é plano).  
- **HARD no entry do implement** (mesmo sítio do ground-truth, Step 1): `find-missing-flow <plan.md> --strict` exit 0. Non-zero → REFUSE (não code, não spawn). Mensagem: corre `atomic-skills:project flow`. Sem `operatorSkip`, sem chat waiver. `assert-automate-gate --gate spawn` também enforce em JS (AS). Foreign: mesmo detector no `plan.md` fonte (não tem `assert-automate-gate` de inventário).  
- `implement` **não** roda show+ratify. Só checa o artefato.  
- `project verify`: backstop read-only (como ground-truth).

**Artefato que prova validação** (detector `--strict` exit 0):

| Peça | Exigência |
|------|-----------|
| `flow/flow.json` | schema 1.0 + lifecycle + **graph** válido (AJV + regras core) |
| `ratifiedAt` | ISO8601 escrito **só** por `buildFlowRatification` no comando, após show + AskUserQuestion. Chat “ok” não conta. |
| `ratifiedGraphSha` | sha do `graph` no momento do stamp. Detector: deve == sha atual do graph. |
| `flow/flow.html` | existe; content-sha casa com o L1. Nome **flow**, nunca `map.html`. |
| Grafo mudou depois do stamp | `ratifiedGraphSha` diverge → falha → re-ratify |

Política mínima de “tem flow suficiente” (para o detector / implement):

| Tipo de plano | Path do artefato | Mínimo |
|---------------|------------------|--------|
| AS (multi-phase ou 1-phase) | `<planDir>/flow/flow.json` + `flow.html` | artefato acima |
| Foreign (`path/to/plan.md`) | `dirname(plan.md)/flow/flow.json` + `flow.html` — **mesmo** `flowPathsForPlan(planMd)`; **não** misturar no `.implement.yaml` | artefato acima |
| Ad-hoc / sem plan file | — | gate N/A |
| JSON já tem chave `states` | (mesmo path) | + **states** válido (Q7) |

### D5 — Projeções da UI L2

Sempre a partir do mesmo `flow.json`:

1. **Sequência** — se `graph` presente: `sequenceDiagram` contínuo, `alt`/`else` por XOR, notes de phase/effects; polish leve (◇, lifelines) sem fills de nível.  
2. **Fluxo do processo** — flowchart com `processLabel` / `processWho`.  
3. **Estados** — se `states` presente; senão aba oculta.  
4. **Jornada / cards** — **cancelado**. Process-map descartado; não reimplementar.

Zoom default **100%**; pan/zoom; tabs. Chrome a partir de `title` / meta — zero copy N2 hardcoded.

### D6 — Origem do grafo (agente + humano)

- Agente **draft** a partir de `design.md` / source / businessIntent — **proibido** colapsar `phases[]` em stages/nodes 1:1 (P2). Draft pode ser no `new plan` (opcional) ou no primeiro `project flow`.  
- **`project flow`** show (`--open` / TUI) → AskUserQuestion → `ratifiedAt`. Não é stage de criação; não há picker de surface inescapável no `new plan`.  
- Day-2: reabrir, ajustar JSON, re-render; HTML nunca é SoT.

### D7 — Descarte process-map (sem dual-read de produto)

Operador 2026-08-12: descarte completo. `process.yaml` **nunca** cumpre o detector de flow / implement.

1. PR3: comando `project flow` + detector; **tirar** stage `process-map` da criação (sem nascer stage `flow` inescapável). Alias `process` → flow.  
2. PR4: implement HARD no entry + verify backstop; apagar write path do process-map (stage, detector, KB, grammar P1).  
3. Planos existentes com só `process.yaml`: **ready pode ficar**; o **primeiro `implement` recusa**. Primeiro `project flow` drafta **graph** a partir do design/source (pode copiar `actor`/`scenario` do yaml se existir; **não** promover stages de cards a nós).  
4. Fixture dogfood: envelopar JSON v2 → schema 1.0 (`graph` + `states` + lifecycle).  
5. KB: `flow.md` canônico; `process-map.md` status superseded → redirect.

### D8 — Destino do protótipo arch-legacy

- Cópias canônicas: **esta pasta** `docs/design/project-flow/dogfood/`.  
- Após PRs verdes, o plano PDTI no arch-legacy **remove** `docs/fluxo-*` e aponta para o produto AS (ou para `flow/` gerado no plan se ainda precisar de artefato local).  
- `process/` do plano PDTI permanece até migrator; depois opcional.

---

## Chosen approach

**Abordagem escolhida: substituir process-map por Flow (grafo), descarte completo, cascata PR1→PR5** (não “só embelezar map.html”, não dual-read, não “segundo comando eterno paralelo”).

Razões:

1. O monorepo já tem o **padrão de produto** certo (schema + pure render + detector + content-sha). Sem stage de criação.  
2. O protótipo dogfood tem o **modelo de grafo** certo (sequence/decision/end + states).  
3. Fundir sem camadas misturaria marcos de valor com mensagens de UI.  
4. Paralelo eterno (`process` + `flow`) dobra Iron Laws e confunde agentes.

### Rejected alternatives

| Alternativa | Por que rejeitada |
|-------------|-------------------|
| Só melhorar CSS do map.html | edges já existem e não são desenhados; sem schema de decision/messages |
| Manter process.yaml e gerar Mermaid a partir dele | expressividade insuficiente; seria inventar dados na render |
| Dual-read `process.yaml` **ou** `flow.json` por um release | operador descartou; cards não cumprem a obrigação |
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
  "ratifiedGraphSha": "hex?",
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

**Extração do dogfood:** `fluxo-sugestao.json` v2 ≈ `graph` + `states` + actors; falta envelopar com lifecycle. **Não** projetar `process.yaml` → `journey` como entrega — journey não é produto.

---

## Surface de skill (arquivos a tocar)

| Área | Arquivos (monorepo) |
|------|---------------------|
| Schema | `meta/schemas/flow.schema.json` |
| Scripts | `scripts/lib/validate-flow.js` (PR1), `scripts/lib/render-flow.js`, `scripts/render-flow.js`, `scripts/find-missing-flow.js` |
| Tests | `tests/validate-flow.test.js` (PR1), `tests/render-flow.test.js`, `tests/find-missing-flow.test.js`, golden em `docs/design/project-flow/` |
| Skills | `skills/core/project.md` grammar; `project-flow.md`; create-plan + `stage-7`/`stage-8`/`stage-9` (**remove** process-map, **não** criar `stage-flow.md`); verify backstop; implement Step 1 HARD-GATE |
| KB | `docs/kb/flow.md`; supersede `process-map.md` |
| Plugin mirror | `~/.grok/plugins/atomic-skills` via install (não editar só o mirror) |

---

## Blast radius (migration / one-way doors)

| Porta | Risco | Contenção |
|-------|-------|-----------|
| Mudar Iron Law / stage id | Planos mid-creation no `process-map`; `assertCanAdvance` **proíbe skip** | PR3 **remove** o stage do enum; **remap** one-shot `process-map` → `reviews`; new plan: `summaries` → `reviews` |
| HTML gerado diferente | Diffs barulhentos em plans | content-sha; HTML no disk como `flow.html` (nunca `map.html`) |
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
| Q2 | Path no plan | `flow/flow.json` + `flow/flow.html` (**não** `map.html`) |
| Q3 | Journey-only / ready sem flow? | **Ready sem flow é legal.** Implement exige **graph** ratificado (artefato). Process-map descartado — cards nunca cumprem o gate. |
| Q4 | Mermaid vendor vs CDN | Vendor/pin no bundle do render (offline) |
| Q5 | Dual copy layperson/dev | **Morto com journey.** Graph usa `processLabel` único (língua do plano). Sem UI de audience no comando v1. |
| Q6 | Gate de implement em 1-phase / foreign / ad-hoc? | **Travada 2026-08-12:** **todo e qualquer plano** (AS multi/1-phase + foreign). Ad-hoc sem plan file = N/A. |
| Q7 | Como o detector sabe que o plano “tem máquina de status”? | **Escalado.** Default temporário: `states` só obrigatório se a chave `states` existir; não inferir do domínio. |
| Q8 | `ratifiedAt` sozinho prova show+AskUserQuestion? | **Travada 2026-08-12 (opção A):** classe ground-truth. Artefato = graph válido + HTML sha + `ratifiedAt` + `ratifiedGraphSha` == sha atual. Só o comando (`buildFlowRatification`) escreve o stamp. Sem receipt extra. Sem re-Ask no implement. Não é atestado de clique humano. |

Q1–Q4, Q6, Q8 travadas. Q5 morta. Q7 default temporário.

---

## Key Decisions

1. **Graph flow** substitui process-map. Cards/journey não são produto.  
2. **Core validation genérica**; domínio só em dados de fixture/plan.  
3. **Render determinístico self-contained** (pipeline: pure lib + CLI + content-sha; padrão AJV = app-map, não `validateProcessMap`).  
4. **Comando `project flow`** (ratify) + detector + **implement HARD no entry**. Sem stage de criação. Alias `process` só aponta para flow.  
5. **Descarte process-map** (sem dual-read). Dogfood PDTI é fixture, não regra.  
6. **Produto e handoff só neste monorepo**; arch-legacy deixa de carregar o viewer.  
7. **Impossível implementar sem o artefato.** Validação = comando, a qualquer momento. Editável = JSON + Ajustar, não canvas.

---

## PR Plan

### PR1 — Schema + validate core + fixture

- **Title:** `feat(flow): schema 1.0 + core validator + dogfood fixture`  
- **Touches:** `meta/schemas/flow.schema.json` (inclui `ratifiedGraphSha`), `scripts/lib/validate-flow.js` (padrão `src/app-map/validate.js` / `ajv/dist/2020.js` — **não** fundir em render-flow nesta PR), `tests/validate-flow.test.js`, envelopar `docs/design/project-flow/dogfood/fluxo-sugestao.json` (`schemaVersion: "1.0"` + lifecycle + `actors` raiz + `graph{entry,nodes}`)  
- **Deps:** none  
- **Done when:** AJV + regras core passam no dogfood envelopado e na fixture mínima (2 actors, 1 xor, sem status 10/1/11); erros: next quebrado, xor 1 branch, actor inválido; `ratifiedGraphSha` no schema (opcional até haver stamp); domínio PDTI **não** está no validator

### PR2 — Render `flow.html` (Sequência + Fluxo + Estados)

- **Title:** `feat(flow): deterministic render-flow HTML (mermaid projections)`  
- **Touches:** `scripts/lib/render-flow.js`, `scripts/render-flow.js`, CSS/JS shell extraído de `dogfood/fluxo-completo.html`, mermaid pin, golden test content-sha / mermaid source snapshot. Output canônico: `flow/flow.html`.  
- **Deps:** PR1  
- **Done when:** `node scripts/render-flow.js dogfood.json -o /tmp/flow.html` offline; tabs seq/fluxo/estados; sem fetch de JSON externo; **não** emite `map.html`

### PR3 — Detector + skill day-2; process-map sai da criação

- **Title:** `feat(project): flow command + find-missing-flow; drop process-map stage`  
- **Touches:** `scripts/find-missing-flow.js` + test; `project-flow.md`; `skills/core/project.md` grammar; `project-create-plan.md` (enum + passo 11 adopt); `new-plan/stage-7.md`, `stage-8.md` (precondition hoje é `process-map`), `stage-9.md`; **`scripts/creation-gates.js` `CREATION_STAGES`** + `tests/creation-gates.test.js` (hoje afirma `process-map` antes de `reviews`); `tests/find-missing-process-map.test.js` (contrato do stage — atualizar ou aposentar). **Não** adicionar `stage-flow.md`.  
- **Deps:** PR2  
- **Done when:** `project flow --check` / generate / update / show / ratify (`buildFlowRatification` escreve `ratifiedAt` + `ratifiedGraphSha`); detector `--strict` falha se sha diverge; alias `process` só chama flow; `new plan` vai `summaries` → `reviews` sem cards e sem bloquear ready; mid-creation parado em `process-map` é **remapado** para `reviews` (advance direto é skip ilegal no enum atual)

### PR4 — Implement HARD no entry + KB + remoção process-map

- **Title:** `feat(flow): implement entry HARD + remove process-map obligation`  
- **Touches:** `skills/core/implement.md` Step 1 (junto do ground-truth); `implement-antipatterns.md`; `scripts/assert-automate-gate.js` spawn (espelho JS do ground-truth, não prosa-only); `src/automate-orchestrator-gates.js` se o fence entrar no helper; `project-verify.md`; `docs/kb/flow.md`; delete write path process-map; `CLAUDE.md` / `project.md` Iron Law. Texto P1 **não** muda antes desta PR (PR3 só tira o stage).  
- **Deps:** PR3  
- **Done when:** implement recusa **qualquer plano** (AS ou foreign) sem artefato (inclui `ratifiedGraphSha` casado); comando é o unblock; foreign usa `dirname(plan.md)/flow/` (não o sidecar); KB canônico `flow.md`; `process.yaml` não passa o detector; stage/detector/render de cards fora do write path. Ad-hoc sem plan file não entra.

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

Cold-start operacional: `HANDOFF.md` (não um prompt de 17 arquivos).

1. **PR1** — schema + validate + envelope dogfood + fixture mínima. Padrão AJV = `src/app-map/validate.js`.  
2. **PR2** — extrair builders de `dogfood/fluxo-completo.html` **sem** `validateModel` de domínio.  
3. Não reabra fill de nível. Não reimplemente cards.  
4. `migration.md` antes de tocar Iron Law / creation-gates (PR3+).  
5. Não editar `CLAUDE.md` / texto P1 até a **PR4**. PR3 só tira o stage.
