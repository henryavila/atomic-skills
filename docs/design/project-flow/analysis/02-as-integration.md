# Análise 02 — Integração Atomic Skills

> **SUPERSEDED (2026-08-12 noite):** o operador descartou process-map e dual-read. A tabela “substituir + dual-read temporário” abaixo é histórica. Canônico: `HANDOFF.md` + `design.md` D7 + `migration.md`.

## Lifecycle process-map atual

```
new plan stages: … → summaries → process-map → reviews → ready
```

- L1: `process/process.yaml`  
- L2: `node scripts/render-process-map.js`  
- Day-2: `/project process [--check] [--audience] [--open]`  
- Stage: AskUserQuestion audience → draft → render → display surface → show → ratify  

## O que “não funciona”

1. UI sem grafo real (edges não desenhados)  
2. Sem sequence/XOR/states  
3. Verify/implement não enforce (só criação)  
4. Dual stack no dogfood (map + fluxo custom)  

## Integração recomendada

**Substituir** process-map por flow unificado + dual-read temporário.

| Peça nova | Path monorepo |
|-----------|---------------|
| Schema | `meta/schemas/flow.schema.json` |
| Render | `scripts/lib/render-flow.js`, `scripts/render-flow.js` |
| Detector | `scripts/find-missing-flow.js` |
| Day-2 | `skills/shared/project-assets/project-flow.md` |
| Stage | `…/new-plan/stage-flow.md` |
| KB | `docs/kb/flow.md` |
| Router | grammar `flow` + alias `process` |

## Validação “do plano”

- Script: schema + grafo + sha HTML  
- Humano: labels de negócio, cobertura do design, ratify  
- Wire: creation + **verify** + **implement**  

## Não confundir

- `app-map` = páginas IA (design-brief)  
- Flow = jornada + interação + (opcional) status  
