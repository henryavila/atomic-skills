# Project Flow — decisões 2026-08-12

Produto: `/atomic-skills:project flow` substitui o process-map. Pacote: `docs/design/project-flow/`. Entrada: `HANDOFF.md`.

**Operador (sessão noite):** process-map é lixo — descarte completo, sem dual-read. Day-2 generate/update/show a qualquer momento. Editável = `flow.json` + Ajustar, não editor no browser. Implementação em cascata PR1→PR5.

**Override (mesma data, sessão seguinte):** obrigação **não** é ready/reviews. É hard-gate **inicial do `implement`** (automático, não-skippável). Sem artefato é impossível implementar **qualquer plano** (AS ou foreign; ad-hoc sem plan file = N/A). Validação = comando `project flow`. Implement não roda a cerimônia. Sem stage `flow` inescapável. Ready sem flow é legal.

**Q8-A (operador aprovou):** classe ground-truth. Artefato = graph válido + `flow.html` sha + `ratifiedAt` + `ratifiedGraphSha` == sha atual. Só `buildFlowRatification` no comando escreve o stamp. Sem receipt extra. Sem re-Ask no implement.

**PR1 (2026-08-13):** `meta/schemas/flow.schema.json` + `scripts/lib/validate-flow.js` + `tests/validate-flow.test.js`. Dogfood envelopado (`schemaVersion: "1.0"` + lifecycle + `graph`). Fixture `dogfood/minimal-xor.json`. Sem skill/HTML/detector. Próxima sessão = **PR2** (`render-flow.js`).

**Cascata PR1–PR4 (2026-08-13, execute-plan `fa94153b`):** empilhada localmente em `execute-plan/fa94153b-pr-4-featflow-implement-entry-hard-remove-process-map-ob` (`86c1c2d4`). Worktree: `.worktrees/execute-plan-fa94153b-pr-4`. Sem push/PR GitHub. PR5 (arch-legacy) fora. `develop` NÃO tem o stack. Validar nesse branch; Iron Law no tip = NO IMPLEMENT WITHOUT VALIDATED FLOW.

**SSOT 2026-08-13:** `docs/design/project-flow/LEDGER.md` — decisões, regras, etapas. Alinhamento visual no ledger §1–§2. Fase = desenho do modelo. Mermaid-PR2 morta. Não mergear `86c1c2d4`.

**Plano AS (2026-08-13):** `plan/project-flow` em `.worktrees/project-flow`. `projects/atomic-skills/project-flow/{design,source,research-digest}.md`. Estado: `.atomic-skills/projects/atomic-skills/project-flow/plan.md`. F0 ativa (schema MODEL, string 1.0). F1 painel feio→impecável. F2 dentes. `audit-delivery-hardening` pausado.

**Ground-truth Flow E (2026-08-13):** `complete-with-findings` `fp=e9944180413a` premises=18 (false=1: `ds-`) impacts=6. Plano AS = render próprio (P4/D4); **não** é PR2 Mermaid/`86c1c2d4`. G-F1-1 falha se HTML tiver `sequenceDiagram`/`mermaid`. Implementar só `projects/atomic-skills/project-flow/design.md` — o `docs/design/project-flow/design.md` de 2026-08-12 é histórico.

**Nome do HTML:** `flow/flow.html`. **Abolido** o nome `map` (`map.html` do process-map não migra).

**Não copiar:** `validateProcessMap` (não usa AJV). Copiar: `src/app-map/validate.js`.  
**Não usar:** prompt de 17 arquivos / glossário “FATIA”. Recortes = PR1–PR5.  
**Dogfood** `fluxo-sugestao.json` é `version: 2` — PR1 envelopa para schema 1.0. Status 10/1/11 e 3 decisões = instância PDTI, não regra de core.
