# Design — engine de diagrama do flow (SVG)

**Status:** ratificado pelo operador (2026-08-14), seções 1–3 + recorte das faixas XOR + **§4 Look A · Linha**.  
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
7. **Look A · Linha.** Operador (2026-08-14). B e C rejeitados. Tabela na §4.

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

**Sequência (TB).** Colunas = `actors[]` na ordem do JSON. Cabeçalho no topo e na base. Lifeline pontilhada `--fg-faint` atrás. Cada mensagem na ordem do walk = fileira; seta sólida ou tracejada (`async`); **sem** número de fileira. XOR = ramos **em sequência vertical** (exclusivos), não lado a lado. Loop (`next` ancestral) = um arco tracejado `--status-warning` da última mensagem **em direção ao ◇ da decisão**, ponta com vão curto (~5px, não encostar no ◇). Sem pastilha «volta», sem nota solta.

**Fluxo (TB, não LR).** Tronco numa coluna. `activity` retângulo arredondado; `xor` losango; `and`/`join` barra; `event` círculo fino; `end` círculo cheio; `subprocess` retângulo com marca. Ramos XOR/AND = colunas irmãs abaixo do portão. Rótulo de negócio. Sem id técnico (`S1`, `D2`) no desenho.

**Estados (LR).** Uma máquina = um diagrama. Estado = pílula; `entry` marcado; `terminal` com anel. Transição = seta + `label`. Efeitos = segunda linha (`kind · label → target`). N machines = N diagramas empilhados.

**Medidas fixas:** ator 196px; fileira 36px; nó BPM 200×48; rank 56px; ramo 36px. Cor e tipo só de `ds.css`. Sem timestamp no SVG.

---

## Seção 3 — Chrome, arquivos, prova

**Chrome.** App de página inteira (grid `auto 1fr`, viewport no 1fr). Abas Sequência / Fluxo / Estados (`data-tab=machines` permanece). Teclas `1` `2` `3` alternam as abas (hint `kbd` na pílula). Aba vazia some (0 messages ou 0 machines). Fluxo BPM sempre existe. `+` `−` `100%`; o botão de ajuste **alterna** entre caber na altura e caber na largura (`À altura` / `À largura`). Pan arrastando; `Ctrl`+roda. Sizer cresce com o zoom para explorar X e Y. Hint curto, sem jargão de domínio.

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

## Seção 4 — Look A · Linha (ratificado 2026-08-14)

Operador escolheu **A · Linha** na prévia `docs/plans/2026-08-14-flow-diagram-engine-style-preview.html`. B · Bloco e C · Quadro ficam rejeitados.

Não inventar paleta, sombra de nó, fill semântico azul/amber, nem “quadro só-linha”. Cor e tipo só de `ds.css`.

| Peça | Fill | Stroke | Tipo |
|------|------|--------|------|
| Ator (topo + base) | `--bg-elevated` | `--border-default` 1px, rx 8 | mesmo chip 168×26, 11px. Sticky com `STICK_PAD` 8px (não colar na borda). O topo pode parecer um pouco maior que o rodapé — aceito. |
| Lifeline | — | `--fg-faint` 1px dash 3 5 | Pintada **depois** da faixa XOR (a wash não tapa a torre). Hover na linha mostra o nome do ator. |
| Seta sync | — | `--fg-muted` 1.25, cabeça cheia | mensagem 12 `--fg-default`; sem número de fileira |
| Seta async | — | idem + dash 5 4 | — |
| Faixa XOR | wash **só no XOR de profundidade 0**, `color-mix(in srgb, var(--bg-elevated) 18%, transparent)`, **sem** stroke. XOR aninhado = trilho + pastilha, sem segunda wash (10 níveis não escurecem). | trilho esquerdo `--status-warning-line` 2px | `◇ {pergunta}` 12 semibold `--status-warning`. Folga `BLOCK_LEAD` 18px acima de pergunta / ramo / join (não há caixa divisor). |
| Pastilha de ramo | `--bg-sunken` | `--status-warning-line` 1px, rx pill | 11 semibold `--status-warning` |
| Loop | — | arco tracejado `--status-warning` da última msg rumo ao ◇, ponta com vão curto (~5px) | sem pastilha, sem texto «volta» |
| Activity / subprocess | `--bg-elevated` | `--border-default` `--node-sw` 1.25, rx 8; subprocess + marca interna 5px | 12 medium `--fg-default`; `who` mono 10 `--fg-subtle` |
| XOR losango | warning 10% sobre `--bg-surface` | `--status-warning-line` 1.25 | 12 semibold; sem id técnico |
| AND / join | `--fg-muted` | — | barra 36×8 |
| Event | `--bg-canvas` | `--status-error-line` 1.5 | círculo oco |
| End ok (sucesso) | `--status-success` | `--status-success` | disco cheio r=10 |
| End outro | `--status-error` + furo `--bg-canvas` | `--status-error` | anel |
| Estado | `--bg-sunken` | `--border-default`; entry `--status-info` 1.75; terminal anel duplo `--status-success` | pílula 12 medium |
| Aresta BPM / máquina | — | `--fg-faint` 1.15, cabeça preenchida no sentido | rótulo 11 `--fg-subtle` (pintado por cima do nó, halo da superfície); efeito mono 10. Volta = tracejado warning. |

Chrome: **app de página inteira** (modo `fluxo-completo.html` do HANDOFF, não documento com `max-width`). `html, body { height:100%; overflow:hidden }`. `.app` = grid `auto 1fr`. Topo compacto: título + cenário numa linha, tabs pílula Sequência / Fluxo / Estados (`1` `2` `3`), `+` `−` `100%`, botão que alterna `À altura` / `À largura`, **PDF** (baixa `{slug}-fluxo.pdf`: Sequência + Fluxo + Estados, papel claro, uma página por superfície; anexo a requisito). Switch de tema. Viewport (`#fl-viewport`) ocupa o resto; fundo pontilhado; cartão `.sheet` com o SVG. `#fl-sizer` cresce com o conteúdo. Zoom muda `width`/`height` do SVG (viewBox × fator) — vetor nítido; **proibido** `transform: scale` no stage (embaça). Zoom persiste **por processo** em `localStorage` (`as-flow-zoom:<data-fl-slug>`). Reabrir o mesmo fluxo restaura o fator; outro slug tem o seu. Não entra no HTML gerado / content-sha. SVG `max-width: none`. Explora X e Y (scroll + arrastar). Sem attrs o cartão inline-block colapsa a 0. Zoom default 100%. Sem picker B/C. Sem segundo painel de lista. Sem footer de documento.

**Dados de validação:** o grafo PDTI `docs/design/project-flow/dogfood/fluxo-sugestao.json` (já schema 1.0 / MODEL) é só L1 — um fluxo real para o olho. O desenho e o chrome vêm da engine (`flow-layout` + `flow-draw` + `render-flow`). Sem drawer paralelo. Sem reescrever tipos. Sem copiar mermaid/walk do HTML PDTI.

**Tema (2026-08-14):** Sistema / Claro / Escuro. Default = `prefers-color-scheme` (`data-theme` ausente). Override = `html[data-theme=light|dark]` + `localStorage.as-color-scheme`. Switch no header (`scripts/lib/color-scheme.js`). Look A usa **nomes** de token, não hex — a paleta light em `site/assets/ds.css` (`--bg-canvas: #f4f6fa`, `--fg-default: #12161d`) re-pinta o mesmo SVG. HTML gerado permanece determinístico (o tema é runtime).

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
