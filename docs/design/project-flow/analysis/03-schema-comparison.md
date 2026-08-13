# Análise 03 — Comparação de schemas

> **Nota 2026-08-12:** journey/cards não é produto. O unificado canônico é lifecycle + **graph** + states opcional. Campo `covers` nesta nota **não** entrou no schema (`stage` no design). Ver `HANDOFF.md`.

## Lado a lado

| Concern | process.yaml | fluxo-sugestao.json |
|---------|--------------|---------------------|
| Unidade | stages (milestones) | nodes (passos UI / XOR / end) |
| Branching | edges solid/dashed (não desenhados) | decision.branches + when |
| Messages | não | messages[] |
| Actors multi | string única `actor` | actors[] + from/to |
| Status machine | prosa em copy | states + effects + statusTo |
| Dual audience | copy.layperson/developer | processLabel único |
| Lifecycle | ratifiedAt, audience, youAreHere | fraco / ausente |
| Render | offline cards | Mermaid CDN + fetch |

## Exemplo: decisão D2 (aceite/recusa)

No dogfood JSON: `type: decision`, branches `D2.accept` / `D2.refuse`, statusTo 1 e 11, next S4a/S4b.

No process.yaml: stage `lider-decide` com prosa — **sem** estrutura de ramos.

## Schema unificado (ver design.md)

- lifecycle + journey ← process map  
- graph + actors ← fluxo  
- states ← fluxo.states  
- links stage↔nodes via `covers` / `stage` fields  

## Por que map “não funciona” vs fluxo “funciona”

Jobs diferentes + renderer do map ignora edges + ausência de decision/message no schema. Ambos HTML válidos; fidelidade de processo só no fluxo.
