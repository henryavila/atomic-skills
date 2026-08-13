# Project Flow — decisões 2026-08-12

Produto: `/atomic-skills:project flow` substitui o process-map. Pacote: `docs/design/project-flow/`. Entrada: `HANDOFF.md`.

**Operador (sessão noite):** process-map é lixo — descarte completo, sem dual-read. Day-2 generate/update/show a qualquer momento. Editável = `flow.json` + Ajustar, não editor no browser. Implementação em cascata PR1→PR5.

**Override (mesma data, sessão seguinte):** obrigação **não** é ready/reviews. É hard-gate **inicial do `implement`** (automático, não-skippável). Sem artefato é impossível implementar **qualquer plano** (AS ou foreign; ad-hoc sem plan file = N/A). Validação = comando `project flow`. Implement não roda a cerimônia. Sem stage `flow` inescapável. Ready sem flow é legal.

**Q8-A (operador aprovou):** classe ground-truth. Artefato = graph válido + `flow.html` sha + `ratifiedAt` + `ratifiedGraphSha` == sha atual. Só `buildFlowRatification` no comando escreve o stamp. Sem receipt extra. Sem re-Ask no implement.

**PR1 (2026-08-13):** `meta/schemas/flow.schema.json` + `scripts/lib/validate-flow.js` + `tests/validate-flow.test.js`. Dogfood envelopado (`schemaVersion: "1.0"` + lifecycle + `graph`). Fixture `dogfood/minimal-xor.json`. Sem skill/HTML/detector.

**PR2 (2026-08-13):** `scripts/lib/render-flow.js` + `scripts/render-flow.js` + `tests/render-flow.test.js`. HTML self-contained (`flow.html`, nunca `map.html`). Mermaid 11.12.0 vendored em `assets/flow/` (offline, inlined). Tabs Sequência/Fluxo; Estados só se `states` existir. Sem domínio PDTI no renderer. Próxima sessão = **PR3** (comando + detector).

**Nome do HTML:** `flow/flow.html`. **Abolido** o nome `map` (`map.html` do process-map não migra).

**Não copiar:** `validateProcessMap` (não usa AJV). Copiar: `src/app-map/validate.js`.  
**Não usar:** prompt de 17 arquivos / glossário “FATIA”. Recortes = PR1–PR5.  
**Dogfood** `fluxo-sugestao.json` já é schema 1.0. Status 10/1/11 e os 3 ids XOR permanecem dados de instância PDTI, não regras de core.
