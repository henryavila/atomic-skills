# Pedido ao aiDeck — runtime do manifest v2.0

> **Para:** o agente que trabalha em `/home/henry/aideck` (fonte de verdade).
> **De:** o consumer atomic-skills. Eu (atomic-skills) **não** implemento no aiDeck —
> este doc é o contrato que preciso que o runtime do aiDeck passe a suportar.
> **Referência viva:** `manifest.sample.yaml` (nesta pasta) é o alvo de compilação;
> `prompts/11-widgets-extension.md` (projeto de design `aiDeck DS`) já especifica os
> **visuais** dos 7 widgets novos + 3 enhancements. Este doc cobre o que falta no
> **runtime/schema**, não o visual.

## 0. TL;DR do delta

O aiDeck hoje é `schemaVersion: '0.1'` (`src/server/manifest-schema.ts`): `dataSources[]`
(array), binding por `widget:`, `source.{ref,filter,param}`, layouts `sections|grid|single`,
status definido inline por-widget. O sample do design é `schemaVersion: "2.0"` e precisa de
**7 capacidades de runtime novas** + os **7 widgets**. Os widgets o design entrega; as 7
capacidades abaixo são o pedido central.

| # | Capacidade de runtime | Hoje (v0.1) | Alvo (v2.0) |
|---|---|---|---|
| R1 | `sources` como **mapa** `{id: {path, schema}}` + JSON Schema por fonte | `dataSources[]` array | mapa + `schema:` ref a `schemas/*.json` |
| R2 | **`statusMap`** top-level (status do consumer → tom do DS) | status inline por-widget | mapa único, todo widget herda |
| R3 | **`chrome`**: `trustSignal`, `commandPalette`, `help` | `nav` só | bloco `chrome` (ver §R3) |
| R4 | **Agregação no binding**: `agg: count\|ratio`, `where`, `of`, operadores (`gt`) | só `filter` igualdade | ver §R4 |
| R5 | **Interpolação reativa**: `$scope`, `$param.x`, `$record.x`, `$<var>` + page `scope: project` + `emits.onSelect.set` | só `param.match` de rota | ver §R5 |
| R6 | **Layout `master-detail`** (+ `home: true`) | `sections\|grid\|single` | adicionar `master-detail` |
| R7 | **Slots-preset compostos** no `card`/`container` (header/stepper/progress/callout/footer/tasks/gates/metrics) + coluna com `render:` inline | `slots` genérico existe | nomear/normalizar presets (§R7) |

> **Compatibilidade:** o consumer atomic-skills vai **migrar inteiro para v2.0** — não preciso
> que o v0.1 continue válido. Se for mais limpo cortar o v0.1, corte. O único consumer real
> hoje é o atomic-skills; o `src/demo/consumer` pode ser reescrito junto.

---

## R1 · `sources` como mapa + JSON Schema

```yaml
sources:
  plans:   { path: state/plans.json,   schema: schemas/plan.json }
  catalog: { path: meta/catalog.json,  schema: schemas/catalog-entry.json }
```

- `sources` é um **objeto** keyed por id (não `dataSources[]`). `source.ref` continua casando a key.
- Cada fonte aponta um arquivo JSON **denormalizado** (não mais frontmatter nested). O **emitter do
  atomic-skills** escreve esses arquivos já com os campos `# ⬅ DERIVED` calculados — o aiDeck só
  **lê, valida contra `schema`, e renderiza** (nada de cálculo no servidor).
- `schema` aponta um JSON Schema que o atomic-skills também emite. Validação na leitura, com erro
  estruturado (fato + sugestão) no estado de erro do widget.
- **Pergunta de design pro aiDeck:** onde esses arquivos vivem? Proposta: o emitter os escreve no
  **consumer dir** (`~/.aideck/consumers/<projectId>/{state,meta,schemas}/`) e o provision do
  atomic-skills dispara o emitter. Confirme se prefere `root: project` lendo de um diretório
  git-tracked no repo. (Isso afeta o §R-SSE abaixo.)

## R2 · `statusMap` top-level

```yaml
statusMap: { active: info, pending: neutral, paused: warning, blocked: error, done: success, archived: neutral, met: success, deferred: warning }
```

- Um mapa só, no topo. Todo widget que recebe um `status` resolve o tom por aqui — **sem** repetir
  `statuses:` por widget (como no v0.1). Regra de tom: §0.2 do `prompts/11` (fill `color-mix(<tom> 14%)`,
  borda `42%`, dot sólido). O widget **nunca** conhece o vocabulário de domínio.

## R3 · `chrome`

```yaml
chrome:
  trustSignal: "127.0.0.1"
  commandPalette:
    shortcut: "mod+k"
    search:
      - { ref: plans, fields: [title, slug, branch, status], scopeBy: projectId, navigate: { page: plan, param: slug } }
      - { kind: pages, navigate: { page: "$id" } }
    order: [record, page]
  help: { button: "?", opens: help }
```

- **`trustSignal`** sempre visível no header (iron law). **`commandPalette`** (⌘K, overlay glass-thick) busca
  registros de N coleções + páginas, `order` prioriza grupos. **`help`** = botão `?` que abre uma página do
  consumer (id `help`) com estado ativo enquanto aberta. Visual já specado (`prompts/11` enhancements +
  `component-command-palette`).

## R4 · Agregação no binding

O `stat`/`headline-banner`/`collection-grid` precisam expressar contagens/razões **sem** um campo pré-derivado:

```yaml
source: { ref: plans, agg: count, where: { status: active } }
source: { ref: tasks, agg: ratio, of: { status: done }, where: { projectId: "$scope" } }   # → "5/12" + pct
source: { ref: projects, agg: count, where: { activeCount: { gt: 1 } } }                    # operador gt
```

- `agg`: `count` | `ratio`. `where`: filtro (igualdade, lista `[a,b]` = OR, e operadores `{gt,gte,lt,lte,ne}`).
- `ratio` usa `of:` (numerador) sobre o conjunto filtrado por `where:` (denominador); o widget recebe
  `{value, max, pct, text}`.
- Onde o valor **não** é agregável (texto de foco, tempo relativo, `mode`), o atomic-skills pré-deriva e
  o binding lê o campo direto — ver o "Contrato DERIVED" no rodapé do `manifest.sample.yaml`.

## R5 · Interpolação reativa + estado de página

```yaml
- id: foco-agora
  scope: project                 # página repetida por projeto; injeta $scope = projectId selecionado
- id: plan
  scope: project
  param: { match: [slug] }        # /plan/:slug → $param.slug
```

Tokens resolvidos em `where`/`source`/`fieldMap`:
- **`$scope`** — o projeto selecionado (página `scope: project`).
- **`$param.<x>`** — param de rota (`param.match`).
- **`$record.<x>`** — o registro do `repeat`/card pai (ex.: `nested.where.projectId: "$record.id"`).
- **`$<var>`** — estado reativo de página setado por um widget. Ex.: o `stepper` selecionável emite
  `onSelect: { set: selectedPhase }`, e o `container` ao lado lê `where: { phaseId: "$selectedPhase" }`.
  Default do var = o `currentId`. Idem `record-switcher` → `set: "$param.slug"` (re-roteia).

Isto é o coração da v2.0: **um widget muda estado, outro re-consulta** — sem código de página.

## R6 · Layout `master-detail` + `home: true`

- `home: true` numa página = default ao abrir sem rota (o Panorama cross-project).
- `layout: master-detail` = lista buscável (master) + painel de detalhe; usado pela página `help` com o
  widget `catalog`. (Pode ser um layout fino que só hospeda o `catalog`, que já é master-detail internamente.)

## R7 · Slots-preset compostos

O `card` (preset **record-card**) e o `container` (preset **record-detail**) compõem por slots **nomeados**
que o runtime resolve para sub-widgets (visual em `prompts/11` §Presets):

```yaml
type: card
slots:
  header:   { title: title, caption: branch, link: { to: plan, param: slug } }
  stepper:  { type: stepper, orientation: horizontal, source: {...}, currentId: { field: currentPhase } }
  progress: { type: progress, label: "...", value: { field: focusTasksPct }, valueText: { field: focusTasksText } }
  callout:  { type: callout, tone: info, fieldMap: { eyebrow: "PRÓXIMA AÇÃO", body: nextText } }
  footer:   { field: updatedRel }
```

- Slots reconhecidos no record-card: `header, stepper, progress, metrics, callout, footer`.
- Slots no record-detail (`container`): `callout, metrics, tasks (status-list), gates (status-list/checklist)`.
- **Coluna de tabela com widget inline:** `{ field: phasesStepper, render: stepper, dense: true }` — uma célula
  renderiza um widget (stepper denso). Generalize `render:` para qualquer widget atômico.

---

## Widgets novos (visual = design; binding = aqui)

O design entrega os 7 widgets + 3 enhancements (`prompts/11`, specimens em `preview/`). O runtime precisa
ligar cada um ao binding do sample. Contrato de binding por widget (campos que o manifest passa):

| Widget | Binding-chave (do sample) |
|---|---|
| `stepper` | `orientation: horizontal\|vertical`, `selectable`, `showDependencies`, `source`, `fieldMap{id,label,status,dependsOn,metric}`, `currentId{field}`, `emits.onSelect.set`, `dense` (coluna), `header{label}` |
| `status-list` | `source`, `groupBy: <campo>`, `groupOrder: [...]`, `variant: checklist`, `fieldMap{id,label,status,annotation,meta}` |
| `callout` (átomo) | `tone`, `fieldMap{eyebrow,body}` ou `bodyField`+`title` |
| `collection-grid` | `source`, `minColWidth`, `attention{when,gt,tone}`, `live{when}`, `card{title,badge,live,metrics[],nested{source,show,onItem},overflow,footer}` |
| `record-switcher` | `trigger: title`, `source`, `fieldMap{id,title,status,caption}`, `emits.onSelect.set` |
| `catalog` | `source`, `list{search,facets{field},denseBadge{field,as}}`, `detail{identifier{field,prefix},sections[kind...]}`, `fieldMap{...}` |
| `headline-banner` | `source`, `count{agg,where}`, `tone{from:<campo>}`, `lanes{perRecord,tone}`, `config{title,sub}` |
| `progress` (enh.) | `label`, `valueText`, `caption`, `tone`, `value`, `segmented?` |
| `card` (enh.) | composição por slots (R7) |
| `header-nav` (enh.) | command-palette + ação `?` (R3) |

---

## Bloco SSE / live (R-SSE)

`T-002` já confirmou que o aiDeck emite `data_changed` via `/sse`. Para o v2.0 com emitter:
quando o estado `.atomic-skills/` muda → o atomic-skills re-emite os `state/*.json` → o aiDeck observa
o arquivo do `source.path` e re-renderiza (`.is-live` nos widgets com `live:`). **Confirme** que o watcher
do aiDeck observa o `path` de cada `source` (no consumer dir ou no repo, conforme a resposta de R1).

## O que eu (atomic-skills) entrego em paralelo

1. **Emitter** (estende `scripts/compute-rollups.js`): lê o tree `.atomic-skills/` → escreve `state/*.json`,
   `meta/catalog.json` e `schemas/*.json` com todos os campos `# ⬅ DERIVED` (contrato no rodapé do sample).
2. **`assets/aideck-consumer/manifest.yaml`** reescrito para v2.0, do nosso domínio (o sample é genérico
   "project-tracker"; eu aterro nos nomes reais: projectId/planSlug/phaseId/status reais).
3. **Remoção do dashboard React** (`src/dashboard`) + wiring de build/test/install.
4. Provisionador (`src/provision-consumer.js`) e testes atualizados para o novo manifest + emitter.

Pendências de R1/R-SSE (onde os arquivos vivem) bloqueiam a forma final do emitter — por isso a pergunta
está marcada acima.
