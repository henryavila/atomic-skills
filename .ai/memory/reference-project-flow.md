# Project Flow — decisões 2026-08-12

Produto: `/atomic-skills:project flow` substitui o process-map. Pacote: `docs/design/project-flow/`. Entrada: `HANDOFF.md`.

**Operador (sessão noite):** process-map é lixo — descarte completo, sem dual-read. Day-2 generate/update/show a qualquer momento. Editável = `flow.json` + Ajustar, não editor no browser. Implementação em cascata PR1→PR5.

**Override (mesma data, sessão seguinte):** obrigação **não** é ready/reviews. É hard-gate **inicial do `implement`** (automático, não-skippável). Sem artefato é impossível implementar **qualquer plano** (AS ou foreign; ad-hoc sem plan file = N/A). Validação = comando `project flow`. Implement não roda a cerimônia. Sem stage `flow` inescapável. Ready sem flow é legal.

**Q8-A (operador aprovou):** classe ground-truth. Artefato = graph válido + `flow.html` sha + `ratifiedAt` + `ratifiedGraphSha` == sha atual. Só `buildFlowRatification` no comando escreve o stamp. Sem receipt extra. Sem re-Ask no implement.

**PR1 (2026-08-13):** `meta/schemas/flow.schema.json` + `scripts/lib/validate-flow.js` + `tests/validate-flow.test.js`. Dogfood envelopado (`schemaVersion: "1.0"` + lifecycle + `graph`). Fixture `dogfood/minimal-xor.json`. Sem skill/HTML/detector. Próxima sessão = **PR2** (`render-flow.js`).

**Cascata PR1–PR4 (2026-08-13, execute-plan `fa94153b`):** empilhada localmente em `execute-plan/fa94153b-pr-4-featflow-implement-entry-hard-remove-process-map-ob` (`86c1c2d4`). Worktree: `.worktrees/execute-plan-fa94153b-pr-4`. Sem push/PR GitHub. PR5 (arch-legacy) fora. `develop` NÃO tem o stack. Validar nesse branch; Iron Law no tip = NO IMPLEMENT WITHOUT VALIDATED FLOW.

**SSOT 2026-08-13:** `docs/design/project-flow/LEDGER.md` — decisões, regras, etapas. Alinhamento visual no ledger §1–§2. Fase = desenho do modelo. Mermaid-PR2 morta. Não mergear `86c1c2d4`.

**Plano AS (2026-08-13):** `plan/project-flow` em `.worktrees/project-flow`. F0–F2 implementadas em automate (review local). HEAD `025269ca`. Plano **active**, `proposeAdvance` = `plan-done`. **Não finalizar** até o operador gravar `userValidatedAt` + plan-end `external-both` / `intentVsDelivered`. `decisionReview` das três fases ficou `pending` (operador avalia no final).

**Day-2 ≠ incompleto.** “Day-2” no produto = o comando `project flow` roda a qualquer momento depois que o plano existe (não é stage de `new plan`). F0–F2 já entregaram schema, painel e dentes. O que faltava neste plano era a *instância* `flow/flow.json` (ready sem flow é legal). Dogfood 2026-08-13: grafo do objetivo (carimbar antes de executar), sem nós F0/F1/F2; operador Aprovar → `buildFlowRatification` `ratifiedAt=2026-08-13T23:05:08.452Z` sha `4d7f75f0…`; `--strict` exit 0.

**Dogfood pergunta vazia (2026-08-13):** segundo `/project flow` perguntou de novo com jargão (`--strict`, recarimbar). Operador: se não há o que validar, a pergunta não existe. A pergunta só vale quando há desenho novo/mudado: “é assim que o trabalho acontece?”. Já carimbado + grafo igual → mostra e para. Cerimônia corrigida em `project-flow.md`.

**Plano→grafo (2026-08-13):** A implementado. `flowPathsForPlan.flowBrief`; `scripts/find-weak-flow-draft.js` (7 regras); skill rascunha ficha→grafo e linta antes do show; `--strict` sem ficha ainda passa. Dogfood: `project-flow/flow/brief.json` alinhado aos xor do grafo carimbado.

**Ground-truth Flow E (2026-08-13):** `complete-with-findings` `fp=62300106c524` premises=18 (false=1: `ds-`) impacts=6. G-F1-2 corrigido para `--bg-canvas|--fg-default`. Materialize: T-006 `ds-`; T-010 write-path extra; `IMPLEMENTATION_TOKEN_RE` em validate-flow.

**Show = HTTP (2026-08-14):** `project flow` sempre sobe `scripts/serve-flow.js --up` e abre `http://127.0.0.1:<port>/flow.html`. Never `file://`. `--check` não sobe servidor. `--up` tem de dar `process.exit(0)` depois do handshake — stdout piped do `--fg` segura o event loop do pai. Não commitar `.atomic-skills/status/automate/*-{prepare.json,sealed-brief.md}` (lease).

**Nome do HTML:** `flow/flow.html`. **Abolido** o nome `map` (`map.html` do process-map não migra).

**Engine de diagrama (plano 2026-08-14):** `docs/plans/2026-08-14-flow-diagram-engine.md`. L2 = SVG. **Look A · Linha**. Base da engine = `docs/plans/gen-flow-diagram-preview.mjs` (não o HTML/mermaid do PDTI). **PDTI = só o grafo** (`fluxo-sugestao.json`). Chrome = app página inteira (grid `auto 1fr`, sizer+stage). Zoom = `width`/`height` do SVG (nunca `transform: scale`); persiste por processo (`as-flow-zoom:<slug>`). Ajuste alterna **À altura** / **À largura**. **PDF** = `{slug}-fluxo.pdf` (3 páginas, papel claro, anexo a requisito).

**Sequência FECHADA (2026-08-14, operador):** wash XOR só no xor de fora (18%); `BLOCK_LEAD` 18px acima de ◇/ramo/join; wash atrás das lifelines; atores sticky + hover; chip 168×26 (topo pode parecer maior — aceito) com `STICK_PAD` 8px; loop-ref arco ~5px; sem número de fileira; sem popover. **Próxima sessão:** refinar **Fluxo (BPM)** e **Máquinas** na prévia; depois extrair TDD para `flow-layout` / `flow-draw` / `render-flow`. `machines.minItems: 1`; `--strict` = sha do atributo. Não commitar automate `prepare.json` / `sealed-brief.md`.

**Não copiar:** `validateProcessMap` (não usa AJV). Copiar: `src/app-map/validate.js`.  
**Não usar:** prompt de 17 arquivos / glossário “FATIA”. Recortes = PR1–PR5.  
**Dogfood** `fluxo-sugestao.json` é `version: 2` — PR1 envelopa para schema 1.0. Status 10/1/11 e 3 decisões = instância PDTI, não regra de core.
