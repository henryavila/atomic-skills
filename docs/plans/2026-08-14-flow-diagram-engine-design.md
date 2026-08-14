# Design — engine de diagrama do flow (SVG)

**Status:** ratificado pelo operador (2026-08-14), seções 1–3 + recorte das faixas XOR.  
**Abordagem:** B (engine própria, sem mermaid).  
**Não muda:** schema 1.0, `validate-flow`, brief, carimbo, `serve-flow` HTTP, gate do `implement`.  
**Substitui:** a projeção L2 em lista/card (`<ol class="fl-messages">`, cards de nó, pills de estado).

---

## Interview

| Campo | Conteúdo |
|---|---|
| **Problema** | O painel que o humano usa para validar o trabalho é lista/tabela. Isso é o process-map. Não dá para ver sequência, XOR nem BPM. |
| **In-scope** | Layout determinístico + SVG das 3 superfícies; chrome de abas + pan/zoom; reescrever `render-flow` e os testes da vista. |
| **Out-of-scope** | Editor visual; BPMN 2.0 (piscinas, XML, norma); mermaid/graphviz/d2; dagre; mudar schema; ficha; finalize F0–F2. |
| **Done-when** | `flow.html` mostra diagrama de sequência, diagrama de processo e diagrama de estados. Sem lista como vista. Sem mermaid. Mesmo JSON = mesmo HTML. |
| **Stakes** | Sem isto o cadeado do `implement` trava um JSON que o PO não consegue ler como fluxo. |
| **Fontes** | LEDGER §2 (3 superfícies); HANDOFF/PDTI `fluxo-completo.html` (modo, não a lib); MODEL.md (tipos); este recorte seções 1–3. |

---

## Context

F1 entregou `scripts/lib/render-flow.js` como listas e cards, e os testes **proibiram** mermaid/SVG. O LEDGER já tinha matado “mermaid como produto”; o plano AS superinterpretou isso como “não desenhe”. O HANDOFF e o viewer PDTI pediam o **modo** diagrama. O operador (2026-08-14): a view atual é inaceitável; o diagrama do PDTI precisa ser refeito; o modo (sequência + fluxo BPM + estados) é o produto.

Pipeline lockado: `flow.json` → validate → normalize → HTML self-contained. Só a última seta muda.

---

## Decisions

1. **Modo = diagrama.** Sequência, fluxo de processo, máquinas. Lista/tabela/card não são vista.
2. **Engine própria em SVG.** Sem mermaid, graphviz, d2, CDN, `fetch` de JSON. Layout no Node; o browser só mostra.
3. **Faixas XOR existem; a caixa `alt`/`else` não.** Trilho esquerdo + fio entre ramos + pastilha de condição. Sem as palavras `alt`/`else`. Sem retângulo em volta das lifelines. XOR aninhado = trilho interno recuado, não moldura em moldura.
4. **Chrome do PDTI, desenho novo.** Abas + uma viewport + pan/zoom. Zoom default 100%.
5. **Determinismo.** Mesmo JSON + mesmo `ds.css` = mesmo HTML/SVG. `data-fl-content-sha` continua hash do L1, não do SVG.
6. **SoT e dentes intactos.** Schema, brief, `buildFlowRatification`, `find-missing-flow --strict`, `serve-flow --up` não mudam.

### Rejected

| Alternativa | Por que rejeitada |
|---|---|
| **A — extrair mermaid do PDTI** | LEDGER §6; operador pediu redo do diagrama. |
| **C — mermaid + polish do SVG** | Já é o PDTI (`polishSequenceSvg`). Frágil e ainda é mermaid. |

---

## Seção 1 — Contrato

Três peças puras:

1. **Layout** (`scripts/lib/flow-layout.js`) — walk do grafo MODEL (`activity` `xor` `and` `join` `subprocess` `event` `end`) + posições. Sem DOM. Portar a ideia de `walkLayout` / `collectBranchChain` do PDTI, não os tipos velhos `sequence`/`decision`.
2. **Desenho** (`scripts/lib/flow-draw.js`) — posições → SVG string.
3. **Chrome** (`render-flow.js`) — HTML com abas, viewport, SVG embutido, JS só de aba + pan/zoom.

| Aba | Olho vê | Lê de |
|-----|---------|--------|
| **Sequência** | Coluna por ator, lifeline, setas numeradas, faixa XOR elegante | `actors` + `messages[]` |
| **Fluxo** | Caixa / losango / barra / círculo / seta com rótulo de ramo | `graph` (`label` / `who`) |
| **Estados** | Uma máquina por diagrama; efeito na aresta | `machines[]` |

Acessibilidade: `<title>` / `<desc>` no SVG. Testes: `data-*` no SVG. Sem segundo painel de lista.

**Faixa XOR (sequência):**

- Antes: nota `◇ pergunta` (quem decide).
- Esquerda: trilho fino `--status-warning-line` do primeiro ao último passo do XOR.
- Entre ramos: fio `--border-subtle`. Sem barra “else”.
- Condição: pastilha no trilho (`label` do branch).
- Fundo: nenhum, ou wash `--bg-elevated` ~8%. Sem caixa aninhada.
- XOR em XOR: trilho interno recuado.

---

## Seção 2 — Cálculo

Tudo no render. Sem layout no cliente.

**Sequência (TB).** Colunas = `actors[]` na ordem do JSON. Cabeçalho no topo e na base. Lifeline pontilhada `--fg-faint` atrás. Cada mensagem na ordem do walk = fileira; seta sólida ou tracejada (`async`); número à esquerda. XOR = ramos **em sequência vertical** (exclusivos), não lado a lado. Loop (`next` ancestral) = nota `↺ volta a …`.

**Fluxo (TB, não LR).** Tronco numa coluna. `activity` retângulo arredondado; `xor` losango; `and`/`join` barra; `event` círculo fino; `end` círculo cheio; `subprocess` retângulo com marca. Ramos XOR/AND = colunas irmãs abaixo do portão. Rótulo de negócio. Sem id técnico (`S1`, `D2`) no desenho.

**Estados (LR).** Uma máquina = um diagrama. Estado = pílula; `entry` marcado; `terminal` com anel. Transição = seta + `label`. Efeitos = segunda linha (`kind · label → target`). N machines = N diagramas empilhados.

**Medidas fixas:** ator 196px; fileira 36px; nó BPM 200×48; rank 56px; ramo 36px. Cor e tipo só de `ds.css`. Sem timestamp no SVG.

---

## Seção 3 — Chrome, arquivos, prova

**Chrome.** Uma viewport. Abas Sequência / Fluxo / Estados. Aba vazia some (0 messages ou 0 machines). Fluxo BPM sempre existe. `+` `−` `100%` `ajustar`; pan arrastando; `Ctrl`+roda. Hint curto, sem jargão de domínio.

**Arquivos.**

- Create: `scripts/lib/flow-layout.js`
- Create: `scripts/lib/flow-draw.js`
- Modify: `scripts/lib/render-flow.js` (monta chrome; deixa de emitir listas)
- Modify: `tests/render-flow.test.js`
- Create: `tests/flow-layout.test.js`, `tests/flow-draw.test.js`
- Re-render: dogfood HTML se existir no disco; `flow/flow.html` do plano vivo
- Docs: `docs/kb/flow.md` (L2 = diagrama, não lista); nota no LEDGER

**Testes (TDD).**

- Sem mermaid / graphviz / d2 / `<ol class="fl-messages">` como vista
- Sequência: `svg[data-surface=sequence]` com atores, lifelines, setas `from→to`, trilho XOR sem `alt`/`else`
- Fluxo: shapes; rótulo de negócio; sem clique/modal/tela
- Máquinas: estado + aresta + `kind`/`label`/`target`
- Mesmo JSON = mesmo HTML; mudar `next` muda o SVG
- Tokens `--bg-canvas` / `--fg-default`

**Erros.** JSON inválido = throw (não desenha). Loop = nota `↺`, não overflow.

---

## Non-goals

- Editor no browser.
- BPMN-norma.
- Auto-layout genérico (dagre).
- AND visual além de barra fork/join.
- Fills de “nível” que o PDTI já rejeitou.
- Mudar schema / brief / `--strict` / finalize F0–F2.

---

## Blast radius

Reverter = restaurar `render-flow.js` de lista e os testes velhos. Consumidor só vê HTML novo no próximo `project flow` / `render-flow`. `ratifiedGraphSha` não muda (hash do L1). Re-render do `flow.html` vivo é obrigatório para o content-sha do L2 continuar casando depois de qualquer mudança de markup.
