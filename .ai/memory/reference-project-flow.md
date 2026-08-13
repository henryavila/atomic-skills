# Project Flow — decisões 2026-08-12

Produto: `/atomic-skills:project flow` substitui o process-map. Pacote: `docs/design/project-flow/`. Entrada: `HANDOFF.md`.

**Operador (sessão noite):** process-map é lixo — descarte completo, sem dual-read. Day-2 generate/update/show a qualquer momento. Editável = `flow.json` + Ajustar, não editor no browser. Implementação em cascata PR1→PR5.

**Override (mesma data, sessão seguinte):** obrigação **não** é ready/reviews. É hard-gate **inicial do `implement`** (automático, não-skippável). Sem artefato é impossível implementar **qualquer plano** (AS ou foreign; ad-hoc sem plan file = N/A). Validação = comando `project flow`. Implement não roda a cerimônia. Sem stage `flow` inescapável. Ready sem flow é legal.

**Q8-A (operador aprovou):** classe ground-truth. Artefato = graph válido + `flow.html` sha + `ratifiedAt` + `ratifiedGraphSha` == sha atual. Só `buildFlowRatification` no comando escreve o stamp. Sem receipt extra. Sem re-Ask no implement.

**Nome do HTML:** `flow/flow.html`. **Abolido** o nome `map` (`map.html` do process-map não migra).

**Não copiar:** `validateProcessMap` (não usa AJV). Copiar: `src/app-map/validate.js`.  
**Não usar:** prompt de 17 arquivos / glossário “FATIA”. Recortes = PR1–PR5.  
**Dogfood** `fluxo-sugestao.json` é `version: 2` — PR1 envelopa para schema 1.0. Status 10/1/11 e 3 decisões = instância PDTI, não regra de core.
