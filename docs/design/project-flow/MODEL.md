# Modelo do grafo — Project Flow

**Status:** **ratificado** pelo operador (2026-08-13).  
**Depende de:** `LEDGER.md` M1–M5.  
**Não é** o schema 1.0. Substitui.

## SoT

Um JSON por plano: `flow/flow.json`.

```
actors[]
graph          ← BPM (atividades de negócio)
  nodes        atividade | xor | and | join | subprocess | event | end
  node.messages[]?   ← sequência (pode UI)
machines[]     ← todas as FSMs
  transition.effects[]   kind + label + target
```

Três camadas **obrigatórias** no detector/`implement` (M4).

## Tipos de nó (grafo)

| type | Papel | Encadeia com |
|------|--------|----------------|
| `activity` | Passo de negócio. `label` sem clique/modal/tela. `who` opcional. | `next` |
| `xor` | Decisão exclusiva. `branches[]` ≥2, `when` único. | cada `branch.next` |
| `and` | Fork paralelo. `branches[]` ≥2. | cada `branch.next` |
| `join` | Junta um `and`. `of` = id do fork. | `next` |
| `subprocess` | Processo nomeado. `ref` = id em `subgraphs`. | `next` (ao sair) |
| `event` | Tempo ou falha. `kind`: `timer` \| `error`. | `next` |
| `end` | Término. Sem `next`. | — |

Ciclo = qualquer `next` que volte a um ancestral (ex.: reenvio). Sem tipo extra.

`subgraphs` = mapa id → `{ entry, nodes }` no mesmo arquivo. Mesmos tipos de nó. Sem recuo infinito no detector (profundidade máxima a fixar na impl).

## Mensagens (sequência)

No nó (tipicamente `activity`; permitidas em `xor`/`event` se a conversa nascer ali):

```json
{ "from": "G", "to": "App", "text": "Abre o formulário", "async": false }
```

`from`/`to` ∈ `actors[].id`. Texto pode narrar UI. A vista sequência só lê isto.

## Máquinas (M5)

```json
"machines": [
  {
    "id": "sugestao",
    "label": "Sugestão PDTI",
    "entry": "rascunho",
    "nodes": {
      "rascunho": { "label": "Rascunho" },
      "pendente": { "label": "Pendente da área" },
      "ativo": { "label": "Ativa", "terminal": false },
      "recusada": { "label": "Recusada", "terminal": true }
    },
    "transitions": [
      {
        "id": "T_aceita",
        "from": "pendente",
        "to": "ativo",
        "when": "lider_aceita",
        "label": "Líder aceita",
        "via": "X_decisao.accept",
        "effects": [
          { "kind": "email", "label": "Avisa a GETIN", "target": "GETIN" }
        ]
      }
    ]
  }
]
```

| Campo do efeito | É |
|-----------------|---|
| `kind` | `email` \| `notify` \| `write` \| `other` |
| `label` | O que o PO lê |
| `target` | Quem recebe / o que é gravado |

`via` (opcional) aponta para `branch.id` de um `xor`. Se presente, tem que existir.

Mínimo M4: `machines.length ≥ 1` e ≥1 transição com ≥1 efeito? **Proposta:** ≥1 machine com ≥1 estado; transição/efeito podem existir depois — **não.** Alinhamento pediu efeito na transição. **Proposta dura:** ≥1 machine, ≥1 transição, cada transição com `effects[]` (pode ser vazio só se o PO disser “nada dispara”). Default: `effects` obrigatório, array pode ser vazio.

## Lifecycle (inalterado na ideia)

`planSlug`, `scenario`, `actor`, `audience`, `ratifiedAt`, `ratifiedGraphSha`.  
Stamp cobre o documento que o detector exige (grafo + messages + machines), não só `graph`.

## O que o 1.0 perde

| 1.0 | Destino |
|-----|---------|
| `type: sequence` | `activity` |
| um `states` | `machines[]` |
| `effects` no nó sequence | `transition.effects` |
| `kind: xor` const | `type: xor` + `type: and` |
| journey | continua fora (não produto) |

Fixture PDTI reescreve: labels de negócio no BPM; cliques só em `messages[]`; uma machine `sugestao` com efeitos nas transições.

## Fora do modelo (passo 2)

Como o painel desenha. Tokens visuais. Mermaid/Graphviz não entram.
