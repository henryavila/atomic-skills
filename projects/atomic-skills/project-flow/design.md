# Design: project-flow

## Context

O process-map obrigatório (`process/process.yaml` + `process/map.html`) não expressa fluxo operacional. O HTML é uma lista linear de cards; `edges[]` existem no schema e o layout não os usa. verified_by: `scripts/lib/render-process-map.js` (`validateProcessMap` exige `stages` não-vazio; layout não consome `edges`); Iron Law P1 em `skills/core/project.md` e `CLAUDE.md`.

O modelo que substitui já está ratificado em `docs/design/project-flow/LEDGER.md` + `MODEL.md` (2026-08-13): um grafo SoT (`flow/flow.json`) com três superfícies (sequência, fluxo BPM, máquinas com efeitos). Este design fecha o **como implementar** esse modelo no monorepo — um plano, sem v1/v2 de produto.

No disco hoje existe uma semente PR1 (`c317edf5`): `meta/schemas/flow.schema.json` const `"1.0"` com `sequence|decision|end` e um objeto `states`; `scripts/lib/validate-flow.js` (AJV 2020). O dogfood `docs/design/project-flow/dogfood/fluxo-sugestao.json` passa nesse validador e **não** passa no MODEL (sem `machines[]`, tipos velhos). `render-flow.js`, `find-missing-flow.js` e o comando `project flow` estão ausentes no tip. `skills/core/implement.md` Step 1 só corre `find-plans-missing-ground-truth.js`. verified_by: `projects/atomic-skills/project-flow/research-digest.md`.

## Interview

**Ratificado** na sessão `project new plan project-flow` (2026-08-13). Spine do LEDGER §8, atualizada porque o done-when antigo (“modelo ratificado”) já ocorreu.

| Campo | Conteúdo |
|-------|----------|
| **Problema** | Plano AS não vira fluxo operacional que o humano navega e valida (negócio + conversa + estados). O modelo está ratificado; falta o plano que implementa schema + painel 3 camadas + dentes. |
| **In-scope** | Plano → grafo (fonte design/source/`businessIntent`, nunca `phases[]`); 3 superfícies; planos complexos; UI de validação (painel, não editor); schema que substitui o shape 1.0 atual e **mantém** a string `"1.0"` (nada publicado); dentes (`project flow` + detector `--strict` + `implement` HARD); Arch só evidência. Um plano, sem v1/v2. |
| **Out-of-scope** | Copiar PoC Arch; editor visual no browser; BPMN-norma; derivar nós de `phases[]`; pacote npm agora; PR2 Mermaid; mergear `86c1c2d4`. |
| **Done-when (design)** | Este `design.md` canônico captura LEDGER+MODEL + recorte F0→F1→F2, passa lint/critic, e o operador aprova. Não é o produto pronto. |
| **Stakes** | Recorte estreito mente o produto. Norma BPMN prende o visual. Tratar o schema 1.0-como-modelo-fechado impede N FSMs. Mergear Mermaid-PR2 reabre um produto morto. Número `"2.0"` sem publicação é vanity. |
| **Fontes** | `docs/design/project-flow/LEDGER.md`; `MODEL.md`; `IMPLEMENTATION.md`; `design.md` histórico (D1/D2/D4/D6/D7; D3/D5 mortos); `alignment-2026-08-13.md`; PR1 no disco; dogfood como fixture. |

Ajustes do operador nesta sessão: `schemaVersion` permanece `"1.0"` (nada publicado); F1 nasce feio e **termina impecável**.

## Decisions

### D1 — Um SoT, três camadas, path `flow/`

Arquivo canônico por plano:

```
.atomic-skills/projects/<project-id>/<plan-slug>/flow/flow.json   # L1 SoT
.atomic-skills/projects/<project-id>/<plan-slug>/flow/flow.html   # gerado; nunca map.html
```

Foreign: `dirname(plan.md)/flow/` via o mesmo `flowPathsForPlan(planMd)`. Ad-hoc sem plan file = gate N/A.

SoT = `actors[]` + `graph` (atividade / xor / and / join / subprocess / event / end) + `node.messages[]?` + `machines[]` com `transition.effects[]` (`kind` + `label` + `target`). verified_by: `docs/design/project-flow/MODEL.md`.

Proibido derivar nós de `phases[]`. Draft a partir de design/source/`businessIntent`. verified_by: LEDGER R1, alignment 2026-08-13.

### D2 — Core ≠ domínio

`validate-flow` usa AJV 2020 + regras de grafo (padrão `src/app-map/validate.js`). Sem regras PDTI (`D1`, status 10, 3 decisões) no core. Dogfood é fixture. Não copiar `validateProcessMap` (if-manual, sem Ajv). verified_by: `scripts/lib/validate-flow.js` L4–12; `scripts/lib/render-process-map.js` L68–93; `src/app-map/validate.js` L5–12.

### D3 — schemaVersion permanece `"1.0"`; o shape muda

Nada foi publicado. A string `"1.0"` fica. O enum e os defs **substituem** o shape atual (`sequence|decision|end` + um `states` + `effect.label/statusTo`) pelo MODEL. Um schema vivo. Sem dual-validator. Sem bump `"2.0"`.

Aceite de F0: `tests/validate-flow.test.js` que hoje passa dogfood/`minimal-xor` no shape velho **falha** até o dogfood ser reescrito. Caso explícito: documento com tipos `sequence` ou chave `states` (objeto único) é inválido. verified_by: `meta/schemas/flow.schema.json` L20 (`const: "1.0"`) e L117–120 (enum velho).

### D4 — Painel = render próprio; F1 nasce feio e termina impecável

Sem Mermaid, Graphviz ou D2 como motor (visível ou invisível). HTML/CSS/SVG no repo. Três superfícies distintas na mesma leitura:

1. Sequência — conversa; clique/modal/tela vive aqui.
2. Fluxo BPM — atividade de negócio; rótulo sem clique/modal/tela.
3. Máquinas — todas as FSMs; cada transição mostra efeitos (`kind`+`label`+`target`).

F1 **primeiro incremento**: 3 camadas separadas e validáveis, visualmente tosco aceito. F1 **exit gate**: UI impecável. O rito `project flow` (F2) mostra o painel já polido. O humano não carimba protótipo.

Nome do HTML: `flow/flow.html`. Editável = reescrever `flow.json` + re-render. Sem editor no browser.

### D5 — Obrigação no `implement`, não no `new plan`

Sem stage `flow` inescapável. Stage `process-map` sai do write path na F2 (`CREATION_STAGES`: `summaries` → `reviews`). `ready` sem flow é legal.

Comando `/atomic-skills:project flow` (alias `process` só chama flow): generate / update / show / ratify / `--check`. Único escritor de `ratifiedAt` + `ratifiedGraphSha` = `buildFlowRatification` depois de show + AskUserQuestion. Chat “ok” não carimba.

`implement` Step 1 (mesmo sítio do ground-truth): `find-missing-flow <plan.md> --strict` exit 0. Non-zero → REFUSE (não code, não spawn). Sem `operatorSkip`. `implement` não roda show+ratify. F2 também liga o mesmo detector em `assert-automate-gate --gate spawn` (espelha o fence JS do ground-truth).

Vale para todo plano que `implement` aceita (AS multi/1-phase, foreign). Planos velhos com só `process.yaml`: ready permanece; o primeiro `implement` recusa até `project flow` draftar + ratificar.

Iron Law nova (texto em CLAUDE.md / project.md) troca na F2: **NO IMPLEMENT WITHOUT VALIDATED FLOW**.

### D6 — `--strict` = M4 + artefato gerado

Detector `--strict` exit 0 exige:

| Peça | Exigência |
|------|-----------|
| `flow/flow.json` | schema `"1.0"` novo + grafo válido (AJV + regras core) |
| camadas | ≥1 nó com `messages[]`; ≥1 machine com ≥1 estado |
| stamp | `ratifiedAt` + `ratifiedGraphSha` == sha atual do documento exigido |
| `flow/flow.html` | existe; content-sha casa com o L1 |

`effects` é key obrigatória em cada transição; array vazio é dado válido (“nada dispara”). Key ausente falha schema. `--strict` **não** exige efeito não-vazio. Machine `{}` sem nós falha schema (`minProperties`).

Stamp cobre o documento que o detector exige (grafo + messages + machines), não só `graph`. verified_by: LEDGER M4/M5; debate Devon (key ≠ `[]`).

### D7 — Um plano, três fases, ordem travada

| Fase | Entrega | Done-when |
|------|---------|-----------|
| **F0 Modelo no disco** | Schema `"1.0"` com tipos MODEL; `validate-flow` para activity/xor/and/join/subprocess/event/end, messages, `machines[]`, effects kind+label+target; fixture PDTI reescrita (BPM sem UI nos labels; cliques só em messages; ≥1 machine); testes. | `node --test tests/validate-flow.test.js` verde no modelo novo. Dogfood valida. Shape velho (`type: sequence`, `states` único) **não** passa. |
| **F1 Painel** | Render próprio das 3 camadas. Primeiro incremento pode ser feio. Exit = UI impecável. Artefato `flow/flow.html`. Sem editor. Sem Mermaid. | Abrir o dogfood: 3 camadas distintas; PO lê negócio no fluxo; sequência mostra conversa; estados mostram transições+efeitos; visual no padrão do DS do repo. |
| **F2 Comando + dentes** | `project flow`; detector `--strict`; `implement` REFUSE; process-map sai do write path; Iron Law nova. Reusar do worktree só contrato: `flowPathsForPlan`, `buildFlowRatification`. | `project flow --check` no dogfood = 0. Plano sem as 3 camadas = implement recusa. |

Ordem: F0 → F1 → F2. Sem inverter. Sem fatia Mermaid. Sem v1/v2 de produto.

## Chosen approach

### Opções pesadas (debate `--gate`, 2026-08-13)

| # | Abordagem | Destino |
|---|-----------|---------|
| A | Render próprio + F0 schema → F1 painel (feio→impecável) → F2 dentes + `"1.0"` in-place + `--strict` M4 | **Escolhida** (operador) |
| B | Compilador invisível (Mermaid/Graphviz/D2) | Rejeitada — Uma: o PO carimba a figura; Aria: ferramenta vira SoT de layout |
| C | Dentes antes do painel (Aria/Flynn: F0 schema → F1 comando+HARD → F2 painel) | Rejeitada — LEDGER §4 trava schema → painel → dentes; F2 ratifica no painel já impecável |
| D | Bump `schemaVersion` `"2.0"` | Rejeitada — operador: nada publicado; número novo é vanity |
| E | `--strict` exige efeito não-vazio + “humano viu” além do stamp | Rejeitada em parte — HTML+sha entra (D6); efeito não-vazio não (M4/MODEL) |
| F | Mergear `86c1c2d4` / PR2 Mermaid | Rejeitada — LEDGER R11 |

Recomendação do orquestrador após o painel: A, com `"1.0"` (override do operador sobre Devon/Flynn) e F1 exit impecável (override sobre “nasce feio e fica feio”).

## Non-goals

- Editor visual no browser.
- BPMN 2.0 (losango/XML/piscinas) como produto.
- Copiar HTML/JSON/stack do PoC Arch.
- Derivar o grafo de `phases[]`.
- Dual-read permanente `process.yaml` **ou** `flow.json`.
- Stage `flow` inescapável no `new plan`.
- Pacote npm / `@henryavila/flow` neste plano.
- Mergear o tip Mermaid (`86c1c2d4`).
- Fills/níveis de aninhamento visual de `alt`.
- Implementar a feature PDTI em si.

## Blast radius

One-way doors deste plano:

1. **Troca do shape 1.0 no disco.** `additionalProperties: false` + enum novo invalida todo JSON no shape PR1 (dogfood incluso) no mesmo PR de F0. Contenção: um PR, dogfood migrado junto, testes do shape velho viram casos negativos. Sem dual-read.
2. **F2 remove `process-map` de `CREATION_STAGES`.** Mid-creation parado em `process-map` remapeia para `reviews` (advance direto no enum atual é skip ilegal). Planos já `ready` com só `process.yaml` **não** são reescritos; quebram no primeiro `implement`.
3. **Iron Law nova no `implement`.** Sem artefato ratificado, nenhum plano AS/foreign implementa. Contenção: comando day-2 `project flow` drafta+ratifica; ad-hoc sem plan file fica N/A.
4. **Painel próprio.** Sem motor de grafo pinado. Contenção: golden de HTML/CSS/SVG no repo; F1 não fecha feio.

Reversível com custo: F0 sozinho (reverter o schema). Caro de reverter: F2 no implement + texto da Iron Law.

## Open questions

- Profundidade máxima de `subgraphs` (MODEL deixou para a impl). Fechar em F0 com constante no validador + teste de recuo.
- Default de `effects: []` vs omitir na prosa do PO — schema já exige a key; o agente preenche `[]` quando o PO diz “nada dispara”.
- Tokens visuais exatos do DS (`site/assets/ds.css`) no painel impecável — F1, não agora.

## Rejected alternatives

- **Compilador invisível** (Flynn). Mesmo cadáver com o capô fechado (Uma). Pin/vendor/drift (Aria, Devon).
- **Dentes antes do painel** (Aria, Flynn). Inverte LEDGER §4. O rito F2 mostraria (ou pularia) um painel que ainda não existe ou ainda é protótipo. O operador fechou: F1 termina impecável; F2 dentes.
- **`schemaVersion: "2.0"`** (Devon, Flynn). Nada publicado; o operador manteve `"1.0"`. Um schema vivo permanece — sem dual-validator.
- **`--strict` exige efeito não-vazio** (Uma). Relitiga M4. Roteamento sem side-effect é modelo válido (Aria). Key obrigatória + `[]` legal (Devon).
- **Mermaid-como-produto / D3+D5 do design 2026-08-12.** LEDGER §6.
- **Journey/cards / dual-read process-map.** Operador 2026-08-12.

## Self-review against code-quality gates

- **G1 read-before-claim:** claims sobre process-map, schema 1.0, validate-flow, implement Step 1 e dogfood apontam paths + linhas no Context / Decisions / digest. Shape MODEL = `MODEL.md` ratificado.
- **G2 soft-language:** varrido contra a ban-list EN (`should`/`probably`/`typically`/`usually`/`I think`/`it seems`/`in theory`/`tends to`/`maybe`/`perhaps`). 0 ocorrências nestas seções.
- **G6 reference-or-strike:** asserções de disco carregam `verified_by:`. Decisões de produto (D4 exit impecável, D3 string `"1.0"`) = ratify do operador nesta sessão, não evidência de código.
