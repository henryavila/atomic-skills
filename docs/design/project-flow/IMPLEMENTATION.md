# Plano de implementação — Project Flow

**Status:** recorte (2026-08-13). Ainda **não** é um `plan.md` AS.  
**Fonte:** `LEDGER.md` + `MODEL.md` ratificados.  
**Um plano, tudo.** Sem fatia Mermaid. Sem v1/v2.

## Não fazer

- Mergear `86c1c2d4` / PR2 Mermaid.
- Copiar PoC Arch.
- Extrair npm agora.
- Tratar schema 1.0 como fechado.

## Reusar (banco de peças, worktree)

`flowPathsForPlan`, `buildFlowRatification`, grammar do comando, alias `process`, ideia do detector `--strict`, HARD no entry do `implement`. **Não** reusar `render-flow.js` nem o pin Mermaid.

## Fases

| Fase | Entrega | Done-when |
|------|---------|-----------|
| **F0 Modelo no disco** | Schema novo (substitui 1.0). `validate-flow` para atividade/xor/and/join/subprocess/event/end, messages, `machines[]`, effects kind+label+target. Fixture PDTI reescrita (BPM sem UI nos labels; cliques só em messages; 1+ machine com efeitos). Testes. | `node --test tests/validate-flow.test.js` verde no modelo novo. Dogfood valida. 1.0 `type: sequence` / `states` **não** passam. |
| **F1 Painel** | UI de navegação/validação: sequência estilizada + fluxo BPM + todas as FSMs com efeitos. Sem Mermaid. Sem editor. Artefato gerado a partir do JSON (nome a fixar; não `map.html`). | Abrir o dogfood: 3 camadas; PO lê negócio no fluxo; sequência mostra conversa; estados mostram transições+efeitos. |
| **F2 Comando + dentes** | `project flow` (show/ratify/`--check`). Detector `--strict` = grafo + ≥1 messages + ≥1 machine + stamp. `implement` REFUSE se falhar. Process-map sai do write path. Iron Law nova. | `project flow --check` no dogfood = 0. Plano sem as 3 camadas = implement recusa. |

Ordem: F0 → F1 → F2. Não inverter (o painel e o detector leem o schema novo).

## Formalizar

Quando o operador pedir: `atomic-skills:project new plan` a partir deste recorte + `MODEL.md`. Até lá este arquivo é o mapa.
