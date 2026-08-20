# Design — plano → grafo (ficha + lints)

**Status:** ratificado pelo operador (2026-08-13), seções 1–3.  
**Não é** o design do produto Project Flow (`docs/design/project-flow/`). Este recorte é só a camada de **autoria**: como qualquer agente chega num grafo de qualidade.

---

## Interview

| Campo | Conteúdo |
|---|---|
| **Problema** | “Drafta do desenho, não das fases” não é procedimento. Cada agente inventa um grafo diferente. Schema válido ≠ trabalho de verdade. |
| **In-scope** | Ficha curta no disco; procedimento fixo no `project flow`; detector de rascunho fraco (rastreio ficha↔grafo); humano só vê o painel. |
| **Out-of-scope** | Gerador 1:1 ficha→nós; ficha dentro do schema do grafo; segunda pergunta de ratify; stage de criação `flow`; mudar `--strict` / implement gate; editor visual. |
| **Done-when** | Qualquer agente, no `project flow`, preenche a ficha, deriva o grafo só dela, o detector recusa os 7 lixos conhecidos, e o humano só é perguntado se o desenho é novo ou mudou. Plano carimbado sem ficha continua executável. |
| **Stakes** | Sem isso o cadeado do implement trava um JSON bonito e o PO não reconhece o trabalho. |
| **Fontes** | LEDGER §1 (fonte = design/source/BI, proibido `phases[]`); `project-flow.md` (draft + show + ratify); `find-weak-business-intent.js` (padrão detector de texto fraco); `flow.schema.json` `additionalProperties: false` nos nós. |

---

## Context

O pipeline lockado é `plano → grafo (IA edita) → UI navega e valida`. A seta da direita existe (`render-flow.js`). A da esquerda é uma frase na skill.

O padrão que já funciona no repo é o do `businessIntent`: o agente escreve, um script barato recusa forma fraca, o humano julga o sentido. Este desenho copia esse padrão para o grafo.

---

## Decisions

1. **Qualidade = lint + humano.** Detector recusa rascunho ruim antes do show. Só o humano diz se o desenho é o trabalho de verdade.
2. **Ficha antes do primeiro nó.** Quatro campos: `actor`, `scenario`, `decisions[]`, `stateChanges[]`. Nós só nascem da ficha.
3. **Ficha é só do agente.** Arquivo no disco para o próximo agente e para o lint. Sem pergunta extra. Sem mostrar a ficha no painel.
4. **Ficha fora do MODEL.** `flow/brief.json` ao lado de `flow.json`. `schemaVersion` do grafo permanece `"1.0"`. Sem campo `brief:` nos nós (`additionalProperties: false` em `activityNode` / `xorNode` / … — `meta/schemas/flow.schema.json`).
5. **Rastreio por ids iguais.** `graph.nodes` xor id = `decisions[].id`. `machines[].id` = `stateChanges[].id`. Estados da machine = `stateChanges[].states`. Sem sujar o schema.
6. **Ficha não é cadeado de execução.** `--strict` e o entry do `implement` não exigem `brief.json`. Plano velho carimbado sem ficha continua válido.
7. **Pergunta de carimbo inalterada.** Só quando o desenho é novo ou mudou. Texto: “é assim que o trabalho acontece?” Sem jargão.

---

## Chosen approach

**A — Ficha + lints + painel.**

Ciclo no `project flow` (sem flag):

1. Resolve o plano.
2. Sem ficha → agente escreve `flow/brief.json` de design / source / `businessIntent` (nunca `phases[]`).
3. Sem grafo, ou grafo desalinhado da ficha → agente escreve `flow.json` só a partir da ficha.
4. `find-weak-flow-draft` exit ≠ 0 → agente corrige. Sem show, sem pergunta.
5. Render + show.
6. Pergunta de carimbo só se o desenho é novo ou mudou.

### Rejected alternatives

| Alternativa | Por que rejeitada |
|---|---|
| **B — ficha no `flow.json`** | Mistura autoria com o MODEL. Não sobe qualidade em relação ao A. Envelope, não produto. |
| **C — script gera esqueleto 1:1** | Mesmo vício de colapsar `phases[]`: consistência de forma, grafo raso. |

---

## Non-goals

- Motor que “analisa o plan.md” e inventa o grafo.
- Campo novo no schema 1.0 do grafo.
- Exigir ficha para `implement` / `--strict`.
- Segunda parada (ratify da ficha).
- Stage `flow` no `new plan`.

---

## Blast radius

Nenhuma porta de uma via no disco do consumidor: `brief.json` é aditivo. Planos sem ficha não quebram. Reverter = parar de chamar o detector no comando e apagar o script. O MODEL e o carimbo não mudam.

---

## Detector — sete recuses

`scripts/find-weak-flow-draft.js` (nome de produto). Entrada: path do `plan.md` (mesmo `flowPathsForPlan`). Lê `flow/brief.json` + `flow/flow.json`.

| # | Recusa quando |
|---|---|
| 1 | Ficha ausente, JSON inválido, ou `actor` / `scenario` / `decisions` / `stateChanges` vazio |
| 2 | Nó do grafo cujo id não é `decisions[].id`, `stateChanges[].id`, nem um id de atividade derivável do `scenario` (ver regra de atividade abaixo) |
| 3 | `decisions[]` sem nó `xor` com o mesmo id e as mesmas saídas (`branches[].when` ou `.label` cobrem `outcomes[]`) |
| 4 | Id ou label casa com fase/task (`/^F\d+$/i`, `/^T-\d+/i`) |
| 5 | Label de nó BPM casa com `\b(clique|click|modal|tela)\b` (case-insensitive). Mensagens podem narrar UI. |
| 6 | Algum `xor` com `< 2` branches (redundante com `validate-flow`; o detector ainda aponta) |
| 7 | Zero `messages` no documento ou zero `machines[]` com ≥1 estado |

**Atividades:** pelo menos um nó `activity` cujo `who` casa com `brief.actor` (trim, case-insensitive) **ou** cujo `label` não viola 4 e 5. Não exigimos 1:1 cenário→um nó (isso seria C).

Exit 0 = ficha+grafo passam. Exit 1 = recusa. Exit 2 = IO.

O comando **não** chama este detector em plano que já tem carimbo válido e grafo inalterado (show e para). Chama quando vai *escrever* ou *re-escrever* o grafo.

---

## Testes

- Fixture boa (ficha do dogfood project-flow + grafo atual alinhado por ids) → exit 0.
- Sete fixtures mínimas, uma por recusa → exit 1 e mensagem da regra.
- `plan.md` com `phases: [F0]` e grafo sem `F0` → não falha por ter fases no plano.
- `validateFlow` num `flow.json` sem campos novos → ainda válido.
- `find-missing-flow --strict` num plano carimbado **sem** `brief.json` → exit 0.

---

## Open questions

Nenhuma que bloqueie o recorte. Se o id-alinhado for frágil na prática (agente quer `D_aceite` vs `aceite`), o ajuste é convenção na skill (`xor` id = `decisions[].id` literal), não schema.

---

## Self-review against code-quality gates

- G1 read-before-claim: applied — nós do MODEL têm `additionalProperties: false` (`flow.schema.json` `activityNode` / `xorNode`); por isso o rastreio é por id, não por campo `brief:`. Fonte do draft já é LEDGER §1 / `project-flow.md` L52.
- G2 soft-language: applied — 0 ocorrências da ban list EN no corpo normativo.
- G6 reference-or-strike: applied — claims de schema e de procedimento apontam arquivos acima.
