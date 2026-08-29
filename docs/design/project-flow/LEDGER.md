# LEDGER — Project Flow

**Ler isto para não se perder.** Única lista de decisões / regras / etapas.  
Outros arquivos (`design.md`, `HANDOFF.md`, `alignment-2026-08-13.md`) são histórico ou detalhe; se conflitar, **este ledger vence** na coluna LOCKED.

| | |
|--|--|
| **Atualizado** | 2026-08-13 |
| **Fase** | Modelo **ratificado** (`MODEL.md`). Próximo = plano de implementação. Sem código ainda. |
| **Aprovado** | Operador, alinhamento visual + este recorte de trabalho |

---

## 1. Pipeline (LOCKED)

```
plano AS  →  grafo (SoT, IA edita)  →  UI navega e valida
```

- Fonte do draft: `design.md` / source / `businessIntent`.
- **Proibido** derivar nós de `phases[]`.
- Planos **complexos** no escopo.
- UI do produto = **painel com as três camadas** (sequência, fluxo, estados) para navegar e validar. Não é PNG estático. Não é editor visual.
- “Fluxo sem UI” = as **etapas do BPM não narram tela**. Não quer dizer “o painel não tem UI” nem “não existe vista de sequência”.

## 2. Três superfícies (LOCKED)

Mesmo SoT. Três projeções.

| # | Superfície | É | Não é |
|---|------------|---|--------|
| 1 | **Sequência** | Conversa (quem fala com quem). Estilizada para leitura. **Pode ter UI.** | Dump Mermaid/PlantUML/Graphviz. |
| 2 | **Fluxo operacional** | Processo **rodando**. BPM do **negócio** (atividades, decisões, ramos). PO lê negócio. **Etapas não detalham interação de UI** (sem clique/modal/tela). | Jornada de tela *como conteúdo das etapas*. BPMN 2.0 como produto. |
| 3 | **Máquinas de estado** | **Todas** as FSMs do plano. Em cada transição: o que dispara (`pendente → ativo` → e-mail, …). | Uma FSM isolada sem efeitos. |

Arch = **evidência abstrata** do job. PoC **não se copia**.

## 3. Regras operacionais (LOCKED)

| ID | Regra |
|----|--------|
| R1 | Process-map descartado. Sem dual-read. `process.yaml` / `map.html` **nunca** cumprem flow. |
| R2 | Obrigação = hard-gate **inicial do `implement`**. `ready` sem flow é legal. Sem stage `flow` inescapável. |
| R3 | Humano valida com `atomic-skills:project flow` (alias `process`). Chat “ok” não carimba. |
| R4 | Só `buildFlowRatification` escreve `ratifiedAt` + `ratifiedGraphSha`. |
| R5 | `implement` **não** roda show+ratify. Só o detector. Sem `operatorSkip`. |
| R6 | Vale para todo plano que `implement` aceita (AS multi/1-phase, foreign). Ad-hoc sem plan file = N/A. |
| R7 | Core de validação ≠ domínio. Sem regras PDTI (`D1`, status 10) no core. |
| R8 | Sem editor visual no browser. Editável = reescrever o SoT + re-mostrar. |
| R9 | Nome `map.html` abolido. Path L1: `<planDir>/flow/flow.json`. |
| R10 | Pacote npm só no 2º consumidor real. Não agora. |
| R11 | Não mergear o tip Mermaid (`execute-plan/…-pr-4`, `86c1c2d4`). Banco de peças, não PR. |

## 4. Etapas de trabalho (LOCKED a ordem)

```
0 consolidar (este ledger)          feito
1 modelo do grafo                   feito — MODEL.md ratificado
2 plano de implementação            ← AQUI
3 implementar (schema → painel → dentes), um plano, sem v1/v2
4 (depois) extração de pacote, se houver 2º consumidor
```

## 5. O que o disco tem

| Peça | Onde | Destino |
|------|------|---------|
| Design 2026-08-12 (gate, comando, SoT) | `design.md` | Vale o que o §3 não contradiz |
| Alinhamento visual | `alignment-2026-08-13.md` | Incorporado no §1–§2 |
| PR1 schema 1.0 + `validate-flow` | `develop` `c317edf5` | **Semente.** Não é o modelo final |
| Fixture PDTI | `dogfood/` | Evidência / fixture. Não regra de core |
| PR2 Mermaid | worktree | **Morta** |
| PR3 comando + drop stage | worktree | Reusar **contrato** depois do modelo |
| PR4 implement HARD | worktree | Reusar **dentes** depois do modelo |
| PR5 limpar Arch | — | Não copiar PoC |

## 6. Superado (não reabrir como produto)

- Mermaid / Graphviz / PlantUML / D2 **como o produto**. Painel nativo SVG (sequência / fluxo / máquinas) é a vista; lista/card não é.
- `map.html` / process-map como L2 de produto.
- Premissa “requisito = `sequence \| xor \| end`” e “layout é árvore, render é aritmética”.
- D3/D5 de `design.md` (HTML Mermaid, tabs `sequenceDiagram` / `flowchart` / `stateDiagram`).
- Um único objeto `states` sem efeitos de transição e sem N máquinas — como destino.
- Copiar viewer/JSON do Arch.
- Cascata “próxima sessão = PR2 Mermaid”.
- Extrair `@henryavila/flow` agora.

`design.md` D3/D5 ficam no arquivo como história; **não implementar**.

## 7. Modelo — fechado vs aberto

### Fechado agora (M1)

**Um grafo + mensagens + N FSMs.**

- Nó = atividade / decisão / fim de **negócio** (rótulo sem clique/modal/tela).
- `messages[]` no nó (opcional) = conversa → vista sequência (pode UI).
- `machines[]` = todas as FSMs do plano; cada transição declara **efeitos** (dispara e-mail, …).
- Painel sempre oferece as 3 camadas. Camada vazia (sem messages, sem machines) some ou fica oca — detalhe de UI (passo 2).

### Fechado agora (M2 + M3)

**Sem fatiar v1/v2.** Um plano implementa o modelo **inteiro**.

Vocabulário do SoT (M3):

| Peça | Contém |
|------|--------|
| Grafo | atividade de negócio, XOR, AND (fork/join), ciclo, subprocesso, evento (tempo/falha) |
| Mensagens | no nó; alimentam a sequência; podem narrar UI |
| Máquinas | `machines[]` — todas as FSMs; transição com **efeitos** |
| Painel | 3 camadas (sequência, fluxo BPM, estados) |
| Dentes | comando `project flow` + detector + `implement` HARD |

Schema 1.0 no disco **substitui** (não “1.x compatível”). PR1 é semente.

### Fechado agora (M4)

**As três camadas são obrigatórias** para `implement` / detector `--strict`:

- grafo BPM válido e ratificado
- pelo menos um nó com `messages[]` (sequência)
- pelo menos uma machine em `machines[]` (estados + efeitos)

Plano sem FSM **não** implementa. Camada vazia no painel não existe nesse gate — ou está no SoT, ou recusa.

### Fechado agora (M5)

Efeito de transição: **`kind` + `label` + `target`**.  
`kind`: `email` \| `notify` \| `write` \| `other`.

Estrutura: `MODEL.md` **ratificado**.

Como desenhar pixels (render próprio vs compilador) é **passo 2**, não agora.

## 8. Entrevista vigente

| Campo | Conteúdo |
|-------|----------|
| **Problema** | Plano AS não vira fluxo operacional que o humano navega e valida (negócio + conversa + estados). |
| **In-scope** | Plano → grafo; 3 superfícies; planos complexos; UI de validação; Arch só evidência. |
| **Out-of-scope** | Copiar PoC Arch; editor visual; BPMN-norma; derivar de `phases[]`; pacote agora; PR2 Mermaid. |
| **Done-when (agora)** | Modelo do grafo ratificado (decisões do §7). |
| **Stakes** | Recorte estreito mente o produto. Norma BPMN prende o visual. Schema 1.0-como-fechado impede N FSMs e BPM sem UI. |
| **Fontes** | Este ledger; `design.md` (D1/D2/D4/D6/D7); `alignment-2026-08-13.md`; PR1 no disco; dogfood como fixture. |
