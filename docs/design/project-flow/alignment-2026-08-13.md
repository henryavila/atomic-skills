# Alinhamento — Project Flow (2026-08-13)

**Status:** aprovado pelo operador nesta data. Incorporado em `LEDGER.md` (SSOT).  
**Substitui, no produto visual/modelo:** Mermaid-como-produto; premissa “o requisito é `sequence | xor | end`”; copiar o PoC do Arch.

O design 2026-08-12 (descarte process-map, gate no `implement`, comando `project flow`, grafo como SoT) **permanece**. Esta nota trava *o que o humano valida* e *de onde veio a ideia*.

## Pipeline

Atomic Skills cria o plano → vira **grafo de fluxo operacional** → UI para o humano **navegar e validar visualmente**.

- Planos **complexos** estão no escopo (não colapsar num treezinho).
- Não derivar o grafo de `phases[]`.
- Grafo = SoT editável (IA). UI = navegação + validação, não PNG estático.

## Três superfícies (mesmo grafo)

| # | Superfície | O que é | O que não é |
|---|------------|---------|-------------|
| 1 | **Diagrama de sequência** | Conversa (quem fala com quem). Estilizado para leitura. Pode ter UI, porque o assunto é mensagem. | Dump de ferramenta (Mermaid/PlantUML cru). |
| 2 | **Fluxo operacional** | Processo **rodando**, mapeado em **BPM** (trabalho de mapa de processo: atividades, decisões, ramos). O PO vê o **negócio**. Sem conceito de UI. | Jornada de tela, clique, formulário. BPMN 2.0 (losango/XML/piscinas) como produto — não aprovado. |
| 3 | **Máquinas de estado** | Camada visual de **todas** as máquinas e estados **do plano**. Em cada transição: o que acontece (`pendente → ativo` dispara e-mail, …). | Uma FSM isolada sem efeitos. |

## Arch

O Arch **iniciou a ideia** e tem um PoC. É **evidência abstrata** do job (ver sequência + processo + estados e validar com o PO). **Não copiar** HTML/JSON/stack de lá.

## Fora deste alinhamento (ainda aberto)

- Vocabulário exato do grafo para plano complexo (XOR, ciclo, AND, subprocesso, eventos…).
- Como desenhar (render próprio vs compilador) — Mermaid/Graphviz **não** são o produto.
- Pacote npm / extração: só no segundo consumidor real; não agora.
- Cascata PR2–PR4 no worktree assume render Mermaid — **não continuar essa PR2** sem novo recorte.

## Entrevista (spine aprovada)

| Campo | Conteúdo |
|-------|----------|
| **Problema** | Plano AS não vira um fluxo operacional que o humano consegue navegar e validar (negócio + conversa + estados). Process-map e Mermaid-como-produto não cobrem isso. |
| **In-scope** | Plano → grafo; UI de navegação/validação; três superfícies acima; planos complexos; Arch só como evidência. |
| **Out-of-scope** | Copiar PoC Arch; editor visual no browser; BPMN-norma como produto; derivar de `phases[]`. |
| **Done-when (deste alinhamento)** | Spine acima aprovada (esta data). Modelo do grafo e recorte de implementação vêm depois. |
| **Stakes** | Recorte estreito (`sequence \| xor \| end` = requisito) barra plano complexo e mente o render. Recorte BPMN-norma prende o visual a uma norma. |
| **Fontes** | `docs/design/project-flow/` (design 2026-08-12); dogfood PDTI como fixture, não como regra de core; PoC Arch como evidência abstrata. |
