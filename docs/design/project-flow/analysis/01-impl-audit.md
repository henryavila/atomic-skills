# Análise 01 — Implementação dogfood (JSON + HTML)

**Fonte:** `docs/design/project-flow/dogfood/`  
**Origem:** plan arch-legacy `sugestao-necessidade-pdti`

## Arquitetura

```
fluxo-sugestao.json
        │
   loadModel + validateModel
        │
   walkLayout / collectBranchChain
        │
   ┌────┼────────────┐
   ▼    ▼            ▼
 buildSequence  buildFlow  buildStates
   Mermaid 11 CDN → SVG → polish (◇, lifelines)
   tabs + pan/zoom
```

## Já genérico (extrair para lib)

- Node types sequence | decision | end  
- `walkLayout`, `collectBranchChain`  
- Builders Mermaid (estrutura)  
- Tones palette  
- Pan/zoom, tabs, mmdLabel/esc  
- Validação estrutural: actors, next, xor≥2, reachability, via↔branch  

## Domain coupling (remover do produto)

| Item | Onde (aprox. no HTML copiado) |
|------|--------------------------------|
| Exatamente 3 decisões | `validateModel` |
| Nodes D1, D_edit, D2 obrigatórios | idem |
| when lider_aceita / lider_recusa + status 1/11 | idem |
| S1ok effect status 10; states.pendente=10 | idem |
| fetch `fluxo-sugestao.json` | `loadModel` |
| noteSpan prefere L/G + App | helpers |
| Terminais states `nova`/`recusada` | `buildStatesMermaid` |
| Copy N2, links partes A/B/C | header chrome |
| Loop label `revalida` PT fixo | buildFlow |

## Não productizar como SoT

- `fluxos-bpmn-interface.html`  
- `fluxos-usuario-sistema.html`  

## Gaps para qualquer fluxo

schemaVersion formal; meta/tabs; N decisions; terminals declarados; states opcional; i18n chrome; HTML embed (sem fetch); pin Mermaid; content-sha.
