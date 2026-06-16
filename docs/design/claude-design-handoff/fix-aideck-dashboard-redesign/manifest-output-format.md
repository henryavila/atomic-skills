# O formato de saída — no que o design vira (manifest)

> Este documento descreve **a gramática e o vocabulário** em que o design final será compilado —
> para o design agent saber **o que será gerado no fim**. **Fluxo:** o design agent desenha as
> telas do zero → nós pegamos esse desenho e **geramos o manifest YAML** correspondente.
>
> **Importante:** isto **não** é o layout atual nem uma tela a copiar. É só o *idioma de saída* —
> as peças disponíveis e como elas se ligam aos dados. **Quais peças usar, onde, e a forma
> visual continuam sendo decisão do design.** O catálogo é **extensível**: se nenhuma peça
> existente expressar bem algo, **proponha uma nova** (componente novo do DS).

## 1. Estrutura do manifest

O dashboard é descrito declarativamente. A árvore é:

```
manifest
└── pages[]            uma "tela"/aba — tem slug, título, ícone, layout
    └── sections[]     um agrupamento dentro da página (título opcional, grid de colunas)
        └── widgets[]  as peças visuais; cada widget liga-se a um dataSource e tem um config
```

Cada **widget** tem o formato:

```yaml
- widget: <tipo>                      # uma peça do catálogo (§3) — ou um tipo novo proposto
  colSpan: <1..12>                    # largura no grid de 12 colunas
  responsive: { sm: { colSpan: 12 } } # variação por breakpoint (opcional)
  source:                             # de onde vêm os dados (§2)
    ref: <dataSourceId>               #   qual coleção (plans, initiatives, tasks, …)
    filter: { <campo>: <valor> }      #   recorte (ex.: { status: active } ou { current: true })
    param: { match: [...] }           #   p/ páginas de detalhe: casa a rota com o registro
  repeat: <campo>                     # repete o widget uma vez por grupo (ex.: por plano)
  config: { ... }                     # campos a exibir, rótulos, links, etc.
  slots: { ... }                      # composição: sub-widgets dentro de células/cards
```

Isto é o que **nós** preenchemos a partir do seu design. O design não precisa escrever YAML — só
precisa saber que cada elemento da tela acaba virando um widget ligado a um dado.

## 2. Ligação com os dados (os dataSources vêm do modelo de dados)

`source.ref` aponta para uma das coleções descritas em `dashboard-purpose-and-data-model.md`:
`plans`, `initiatives`, `phases`, `tasks`, `exit_gates`, `stack_frames`, `parked_items`,
`emerged_items` (+ `discover`, `inbox`).

- **`filter`** recorta a coleção: por status (`{ status: active }`), por foco (`{ current: true }`,
  `{ planActive: true }`), etc.
- **`param.match`** liga uma página de detalhe ao registro certo (ex.: casar `projectId` + `slug`
  da rota com o plano/iniciativa).
- **`repeat`** desenha o mesmo bloco uma vez por grupo (ex.: um bloco por plano ativo) — é como o
  layout lida com a cardinalidade "N" (ver as cardinalidades no doc de dados).
- **`slots`** compõe: um widget dentro de uma célula ou de um card de outro (ex.: uma barra de
  progresso dentro de cada card).

O design **não precisa** decidir isso — mas ajuda saber que **qualquer recorte/agrupamento dos
dados é expressável** (por status, por foco, por projeto, por plano, detalhe de 1 registro).

## 3. Catálogo de peças disponíveis (extensível — proponha novas)

As peças que o renderer já conhece hoje, agrupadas pelo que **expressam** (não como aparecem — a
forma é sua). Use as que servirem; **proponha uma nova** quando faltar.

- **Um valor / medida:** `stat`, `gauge`, `progress-bar`, `sparkline`, `badge`.
- **Uma coleção de itens:** `table`, `list`, `card-grid`, `kanban-board` (agrupado por status),
  `log-feed`.
- **Estrutura / relações:** `phase-timeline` (sequência de fases), `timeline`, `tree-view`
  (hierarquia), `graph-dag` (grafo de dependências), `breadcrumb`.
- **Um registro / texto:** `key-value`, `callout`, `panel`, `card`, `markdown`, `code-block`.
- **Séries / gráficos:** `line-chart`, `bar-chart`.
- **Navegação / contêineres / controles:** `header-nav`, `tabs`, `accordion`, `drawer`,
  `container`, `grid-columns`, `search-filter`, `tag-chip`.

> Estes nomes são o **alvo de compilação**, não uma prescrição de quais usar. Se o melhor desenho
> pedir uma peça que não existe, **sinalize-a** — ela vira um componente novo do DS.

## 4. Vocabulário de status (o consumer "dona" as suas palavras)

Os 6 status do modelo de dados (`active`, `pending`, `paused`, `blocked`, `done`, `archived`) —
mais os de gate (`met`, `deferred`) — são mapeados pelo consumer a um tom + glifo. O design
**decide** como o status se comunica visualmente; o que importa para a saída é que **o status é um
eixo que qualquer peça pode refletir**.

## 5. O que isto NÃO é

Não há aqui nenhuma página, seção ou arranjo do dashboard atual — de propósito. O design das
telas é do zero (ver `dashboard-purpose-and-data-model.md` para propósito + dados). Este doc só
garante que o resultado seja **expressável e gerável** como manifest — e mostra que o vocabulário
é rico e extensível o bastante para não limitar o desenho.
