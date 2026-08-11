# Process Map — visão macro do plano (Atomic Skills)

**Status:** canônico · 2026-08-10  
**Escopo:** todo plano multi-phase criado por `atomic-skills:project` (não um produto específico).

---

## Iron Laws

### Iron Law P1 — NO PLAN WITHOUT PROCESS MAP

> **Nenhum plano multi-phase está `ready` sem process map ratificado + HTML gerado.**  
> Criação da estrutura do mapa e exibição HTML são **integrais e inescapáveis** do bootstrap do plano.  
> Skip, “depois a gente faz”, ou derivar o mapa só de `phases[]` é **violação**.

### Iron Law P2 — MAP IS NOT THE PHASE TREE

> O process map é o **processo do objetivo** (marcos de valor/confiança do ator),  
> **não** a árvore F0/T-00x.  
> `mapsToPhases` é ligação opcional e fraca — nunca o gerador do grafo.

### Iron Law P3 — TWO LAYERS, ONE SoT

| Camada | Artefato | Quem escreve | Quem lê |
|--------|----------|--------------|---------|
| **L1 · Estrutura** | `process/process.yaml` | Skill `project` na criação (draft + ratify) | HTML, gates, humanos |
| **L2 · Exibição** | `process/map.html` | `scripts/render-process-map.js` (determinístico) | Browser / `project process` |

- L2 **nunca** inventa etapas. Só renderiza L1 + DS.  
- L1 **nunca** é gerado a partir do HTML.  
- Mesmo YAML + mesmo `site/assets/ds.css` → HTML byte-idêntico.

### Iron Law P4 — AUDIENCE IS A LENS

> AskUserQuestion na criação: **leigo** | **dev abstraído** | **ambos**.  
> Dev = domínio de alto nível, **não** implementação.  
> Grafo único; `copy.layperson` / `copy.developer` só mudam texto.

### Iron Law P5 — SHOW BEFORE RATIFY (surface is chosen, not assumed)

> Antes de ratificar, o operador **vê** o mapa.  
> AskUserQuestion **não skippable**: **browser** | **TUI** | **ambos**.  
> Chat livre (“ok”, “abre aí”, “tanto faz”) **não** conta.  
> Ratificar sem exibir o mapa na superfície escolhida é **violação**.

---

## Paths canônicos (nested)

```
.atomic-skills/projects/<project-id>/<plan-slug>/
  plan.md
  process/
    process.yaml     # L1 SoT (schema process-map)
    map.html         # L2 gerado (não editar à mão)
  phases/…
```

Frontmatter do plano (opcional, espelho):

```yaml
processMap:
  path: process/process.yaml
  htmlPath: process/map.html
  ratifiedAt: <ISO>
  audience: both
  contentSha: <hex>
```

---

## Duas camadas em detalhe

### L1 — Criação da estrutura (inescapável)

Na criação do plano (`new plan` / `adopt`), **depois** de materializar + summaries e **antes** de reviews/`ready`:

1. **AskUserQuestion — audiência** (leigo / dev / ambos) — **não skippable**.  
2. **Draft** do grafo canônico a partir de:
   - `design.md` + source narrative (objetivo, valor, gates de negócio)
   - **não** copiar cegamente `phases[].title`
   - opcionais / always quando o design os contiver  
3. Preencher `copy.layperson` e `copy.developer` (ambas as lentes se `both` ou a pedida + rascunho da outra se `both`).  
4. Escrever draft L1 **sem** `ratifiedAt` + render L2.  
5. **AskUserQuestion — superfície de exibição** (browser / TUI / ambos) — **não skippable**.  
6. **Mostrar** o mapa na(s) superfície(s) escolhida(s).  
7. **Ratify** via AskUserQuestion (Aprovar / Ajustar / Cancelar) — **não skippable**.  
   Generic “ok” **não** conta. Só depois: stamp `ratifiedAt`, re-render L2.  
8. Validar com schema + lint + `find-missing-process-map --strict-html`.  
9. Avançar creation-gate → `process-map`.

### L2 — Exibição (inescapável na criação)

1. `node scripts/render-process-map.js <process.yaml> -o <map.html> --audience <…>`  
2. Superfície escolhida: abrir no browser e/ou mapa completo no TUI (transcript).  
3. `contentSha` do HTML deve casar com L1 após ratify.  
4. `--check` em CI / verify. Dia-a-dia: `project process` reabre o HTML.

---

## Creation-gates (monotônico)

```
slug → design → source → decompose-confirm → bi-ratified →
materialized → summaries → process-map → reviews → ready
```

- Declarar `ready` **sem** `process-map` = HARD-BLOCK (`assert-creation-stage`).  
- Detector: `scripts/find-missing-process-map.js` (exit ≠ 0 se YAML/HTML/ratify ausentes).  
- `implement` HARD-BLOCK se o detector falhar no plano ativo (mesmo padrão BI / ground-truth).

---

## O que o mapa **é** e **não** é

| É | Não é |
|---|--------|
| Visão macro do **objetivo** | Grafo de implementação |
| Marcos de confiança / valor | Lista de tasks |
| Optional / always de processo | Só `outOfScope` de engenharia |
| SoT em YAML no tree do plano | Markdown solto fora do lifecycle |
| HTML view gerada | Monólito hand-edited |

**Exemplo genérico (qualquer domínio):**  
“Definir o que é pronto → provar em amostra → opcional reforço externo → assinar release”  
— **não** “F0 contrato → F1 helper → F2 render”.

---

## Comandos

```
/atomic-skills:project process              # regenera se preciso + abre map.html
/atomic-skills:project process --check      # drift L1↔L2
/atomic-skills:project process --audience=… # troca lente e re-render
```

Detail: `project-process-map.md`. CLI: `scripts/render-process-map.js`.

---

## Relação com businessIntent

| | businessIntent | process map |
|--|----------------|-------------|
| Quando | Por **fase** no materialize | Por **plano** no bootstrap |
| Escopo | value/workflow/rules/outOfScope/doneWhen da fase | Jornada ponta-a-ponta do objetivo |
| UI | Texto / gates | HTML + lentes |

Complementares. Nenhum substitui o outro.

---

## Anti-padrões (red flags)

- “Pulo o mapa, o phase tree no aiDeck basta”  
- “Gero o YAML a partir de phases[] renomeadas”  
- “HTML escrito à mão com etapas que não estão no YAML”  
- “Confirmo no TUI sem mostrar o mapa (browser ou TUI completo)”  
- “Default browser / skip da pergunta de superfície”  
- “Mapa só para planos de produto; tooling AS não precisa” — **não**: todo multi-phase  
- “Adopt isento” — **não**: adopt também HARD-BLOCK sem mapa  

---

## Implementação de referência

| Peça | Path |
|------|------|
| Schema | `meta/schemas/process-map.schema.json` |
| Validate + render | `scripts/lib/render-process-map.js` |
| CLI | `scripts/render-process-map.js` |
| Detector | `scripts/find-missing-process-map.js` |
| Stage | `skills/shared/project-assets/new-plan/stage-process-map.md` |
| Detail comando | `skills/shared/project-assets/project-process-map.md` |
| DS | `site/assets/ds.css` (inline no HTML) |
