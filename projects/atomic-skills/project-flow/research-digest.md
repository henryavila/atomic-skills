# Research digest — project-flow

**Data:** 2026-08-13  
**Método:** repo-only (sem web). Entrevista ratificada nesta sessão.  
**Não substitui:** `docs/design/project-flow/LEDGER.md` (SSOT de decisões) nem `MODEL.md`.

## Scope (from Interview)

- **Problema:** plano AS não vira fluxo operacional navegável (negócio + conversa + estados). Modelo já ratificado; este plano implementa schema + painel 3 camadas + dentes.
- **In-scope:** plano → grafo (nunca `phases[]`); 3 superfícies; planos complexos; UI de validação (não editor); schema que substitui 1.0; dentes (`project flow` + detector `--strict` + `implement` HARD); Arch só evidência. Um plano, sem v1/v2.
- **Out-of-scope:** copiar PoC Arch; editor visual; BPMN-norma; derivar de `phases[]`; pacote npm agora; PR2 Mermaid; mergear `86c1c2d4`.
- **Fontes nomeadas:** `docs/design/project-flow/LEDGER.md`, `MODEL.md`, `IMPLEMENTATION.md`, `design.md` (D1/D2/D4/D6/D7; D3/D5 mortos), `alignment-2026-08-13.md`, PR1 no disco, dogfood como fixture.

## Findings

- **`docs/design/project-flow/LEDGER.md` (SSOT):** etapa 2 = plano de implementação. R1–R11 travadas: process-map descartado; obrigação = hard-gate inicial do `implement`; `ready` sem flow é legal; sem stage `flow` inescapável; só `buildFlowRatification` carimba; `implement` não roda show+ratify; path L1 = `<planDir>/flow/flow.json`; não mergear `86c1c2d4`. M4: detector/`implement` exigem grafo + ≥1 `messages[]` + ≥1 machine. M5: efeito = `kind` + `label` + `target` (`email` \| `notify` \| `write` \| `other`).

- **`docs/design/project-flow/MODEL.md` (ratificado):** SoT = um JSON `flow/flow.json` com `actors[]`, `graph` (`activity` \| `xor` \| `and` \| `join` \| `subprocess` \| `event` \| `end`), `node.messages[]?`, `machines[]` com `transition.effects[]`. Schema 1.0 no disco **não** é o modelo final — `type: sequence` vira `activity`; um `states` vira `machines[]`; `effects` saem do nó sequence e vão para a transição.

- **`docs/design/project-flow/IMPLEMENTATION.md`:** recorte F0 schema → F1 painel → F2 dentes. Reusar do worktree: `flowPathsForPlan`, `buildFlowRatification`, grammar do comando, alias `process`, ideia do detector `--strict`, HARD no entry do `implement`. **Não** reusar `render-flow.js` nem pin Mermaid. Formalizar via `project new plan` a partir deste recorte + `MODEL.md`.

- **`meta/schemas/flow.schema.json` (PR1, `c317edf5`):** `schemaVersion` const `"1.0"`; `graph.nodes[].type` enum `["sequence", "decision", "end"]`; `decision.kind` const `"xor"`; um objeto `states` (não `machines[]`); `effect` exige só `label` e permite `statusTo` numérico — **não** tem `kind`/`target`. `additionalProperties: false` no root. **verified_by:** linhas 8–20, 117–120, 217–225, 243–263.

- **`scripts/lib/validate-flow.js`:** AJV 2020 (`import Ajv from 'ajv/dist/2020.js'`) + regras de grafo (`entryExists`, `nextExists`, `actorRef`, `xorMinBranches`, `uniqueWhen`). Vizinhos só para `type === 'sequence'` e `type === 'decision'` — sem `activity`/`and`/`join`/`subprocess`/`event`. Importa `IMPLEMENTATION_TOKEN_RE` de `render-process-map.js`. **verified_by:** linhas 4–12, 56–64, 113–157.

- **`src/app-map/validate.js`:** padrão a copiar (AJV compile + erros pós-schema no mesmo shape). Process-map **não** usa esse padrão: `validateProcessMap` em `scripts/lib/render-process-map.js:68` é if-manual (`errors.push('stages must be a non-empty array')`) — nunca chama Ajv. **Não copiar** `validateProcessMap` como “validate”.

- **`tests/validate-flow.test.js`:** aceita dogfood envelopado 1.0 e `minimal-xor.json`; rejeita next quebrado, xor de 1 ramo, actor fantasma; fixture mínima **proíbe** `statusTo` e status `10|1|11` no blob. 15/15 era o número da PR1; o arquivo agora tem 20 `describe|it` hits. Domínio PDTI fica fora do validador.

- **`docs/design/project-flow/dogfood/fluxo-sugestao.json`:** `schemaVersion: "1.0"`; 8 `sequence` + 3 `decision` + 2 `end`; tem `states` (entry `rascunho`, 6 transições); **não** tem `machines`. Labels de BPM (`processLabel`) são negócio (`Criar sugestão`, `Envio válido?`); cliques vivem em `messages[].text` (`"Clica em Sugerir necessidade"` L51, `"Clica Aceitar"` L291). Fixture serve; o JSON 1.0 **não** passa no modelo ratificado.

- **`scripts/lib/render-flow.js`, `scripts/render-flow.js`, `scripts/find-missing-flow.js`:** **ausentes** no tip `develop`. Comando `project flow` não existe no grammar vivo.

- **`scripts/creation-gates.js:38-49`:** `CREATION_STAGES` ainda é `slug → … → summaries → process-map → reviews → ready`. Este próprio `new plan` **ainda** é obrigado a gerar process-map antes de reviews. Iron Law P1 em `skills/core/project.md` e `CLAUDE.md` ainda diz `process/process.yaml` + `process/map.html`.

- **`scripts/find-missing-process-map.js`:** detector vivo; paths `process/process.yaml` + `process/map.html`; `--strict-html` exige content-sha. `project process` day-2 ainda aponta para `project-process-map.md`.

- **`skills/core/implement.md` Step 1:** hard-gate atual = `find-plans-missing-ground-truth.js` (L123–148). **Zero** chamada a `find-missing-flow`. HARD-GATE de flow no implement **não está no tip**. Classe a espelhar: detector no entry, sem `operatorSkip`, sem chat waiver.

- **Worktree `86c1c2d4`:** tip `fix: address review feedback for implement flow HARD` em `.worktrees/execute-plan-fa94153b-pr-4`. Stack contém `render-flow` Mermaid + comando + implement HARD. LEDGER R11: banco de peças, **não** PR a mergear. `IMPLEMENTATION.md` autoriza reusar contrato (`flowPathsForPlan`, `buildFlowRatification`), não o HTML Mermaid.

- **`docs/design/project-flow/alignment-2026-08-13.md`:** pipeline plano → grafo → UI navega/valida. Aberto ainda: como desenhar o painel (render próprio vs compilador). Mermaid/Graphviz **não** são o produto. Vocabulário do grafo complexo foi fechado depois em `MODEL.md`.

- **`docs/design/project-flow/design.md` D3/D5:** HTML Mermaid + tabs `sequenceDiagram`/`flowchart`/`stateDiagram`. LEDGER §6: **não implementar**. Vale D1 (path `flow/`), D2 (core ≠ domínio), D4 (gate no implement, não stage), D6 (draft de design/source/BI, nunca `phases[]`), D7 (`process.yaml` não cumpre).

## Open risks / seams

- **Dois mundos no disco:** schema 1.0 + dogfood passam `validateFlow` hoje; o modelo ratificado os rejeitaria (`sequence`/`states`/effect sem `kind`). F0 tem que quebrar os testes 1.0 de propósito.
- **Este bootstrap ainda exige process-map** (stage inescapável). O produto que o plano constrói mata esse stage só na F2. Até lá, o plano `project-flow` carrega `process/map.html` — não é dual-read de produto; é dívida do tip.
- **Seam do implement:** copiar o sítio do ground-truth (Step 1 + `assert-automate-gate --gate spawn`). Não inventar stage de criação.
- **Render do painel ainda aberto** (alignment): F1 precisa decidir render próprio vs compilador *antes* de escrever pixels. Não reabrir Mermaid-como-produto.
- **Nome do HTML:** LEDGER/design dizem `flow/flow.html`; `IMPLEMENTATION.md` ainda diz “nome a fixar”. Debate deve fechar isso.
- **Efeitos vazios:** MODEL propõe `effects` obrigatório, array pode ser vazio se o PO disser “nada dispara”. Detector M4 exige ≥1 machine; não está escrito se ≥1 efeito não-vazio é hard.
- **Profundidade de `subgraphs`:** MODEL deixa “máximo a fixar na impl”.
