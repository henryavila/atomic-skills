Receba uma descrição de tarefa e gere um prompt otimizado, autocontido e pronto para execução.

Se $ARGUMENTS foi fornecido, use como descrição da tarefa.
Se não, pergunte ao usuário: "O que você quer que a IA faça?"

## Regra Fundamental

NO PROMPT WITHOUT CODEBASE ANALYSIS.
Não gere o prompt sem antes ter explorado o codebase e identificado os arquivos
relevantes. Prompt sem file paths exatos é prompt genérico — e prompts genéricos falham.

## Processo

### 1. Entender a tarefa

Leia a descrição fornecida. Identifique:
- **Objetivo:** o que deve ser feito (1 frase)
- **Tipo:** fix, feature, refactor, migration, review, docs, outro
- **Escopo estimado:** quantos arquivos provavelmente serão tocados

Apresente ao usuário para confirmar:
> **Objetivo:** [descrição]
> **Tipo:** [tipo]
> Correto?

### 2. Explorar o codebase

Usando as ferramentas Glob e Grep, encontre os arquivos relevantes para a tarefa:
- Execute Glob para encontrar arquivos por padrão (ex: `src/auth/**/*.ts`)
- Execute Grep para encontrar referências por conteúdo (ex: `function login`)
- Leia os arquivos mais relevantes com a ferramenta Read (max 5 arquivos)
- Identifique dependências e arquivos relacionados

Registre:
> **Arquivos principais:** [lista com paths exatos]
> **Arquivos relacionados:** [lista com paths exatos]
> **Estrutura relevante:** [resumo de 2-3 linhas sobre como o código está organizado]

### 3. Gerar o prompt otimizado

Crie um prompt seguindo esta estrutura:

```
[Descrição direta da tarefa em 1-2 frases]

## Regra Fundamental

NO [AÇÃO PROIBIDA] WITHOUT [PRÉ-CONDIÇÃO].
[Explicação de 1 linha]

## Contexto

[Resumo do codebase relevante — estrutura, padrões, arquivos principais]

Arquivos relevantes:
- `[path exato]` — [o que contém, por que é relevante]
- `[path exato]` — [idem]

## Processo

### 1. [Primeiro passo]
[Ação concreta com ferramenta nomeada]
[Prova exigida: "cite line numbers" / "liste o output"]

### 2. [Segundo passo]
...

### N. Verificar resultado
[Comando exato para verificar que funcionou]
[Critério de sucesso claro]

## Red Flags

- "[pensamento perigoso específico para esta tarefa]"
- "[outro pensamento perigoso]"

Se pensou qualquer item acima: PARE. Volte ao passo que estava pulando.

## Racionalização

| Tentação | Realidade |
|----------|-----------|
| "[racionalização específica para esta tarefa]" | "[por que é uma armadilha]" |
```

**Regras para o prompt gerado:**
- Ferramentas nomeadas (Read, Grep, Glob, Bash) — nunca verbos vagos
- Prova exigida em cada passo (line numbers, output)
- File paths exatos e completos
- Iron Law no topo — específica para a tarefa
- Red Flags — antecipe as racionalizações mais prováveis para esta tarefa
- Tabela de Racionalização — antecipe os atalhos mentais mais perigosos para esta tarefa específica
- Autocontido — quem ler o prompt sem contexto deve conseguir executar
- Nada além do necessário — YAGNI aplicado ao prompt

### 4. Apresentar e decidir

Apresente o prompt gerado em bloco de código para fácil cópia.

Ofereça as opções:

> Prompt gerado. Como deseja executar?
> A) Copiar para sessão limpa (recomendado para tarefas complexas)
> B) Executar agora via subagent (contexto limpo, sem sair da sessão)
> C) Ajustar antes de executar

### 5. Executar (se opção B)

Despache um subagent com o prompt gerado como instrução completa.
O subagent recebe APENAS o prompt — sem contexto desta sessão.

## Red Flags

- "A tarefa é simples, não preciso explorar o codebase"
- "Já sei quais arquivos são, não preciso de Glob/Grep"
- "Vou gerar um prompt genérico e o agente descobre o resto"
- "Não preciso de Iron Law para essa tarefa"
- "Vou incluir contexto desta sessão no subagent"

Se pensou qualquer item acima: PARE. Volte ao passo que estava pulando.

## Racionalização

| Tentação | Realidade |
|----------|-----------|
| "Tarefa simples não precisa de prompt otimizado" | Tarefas simples com prompts vagos geram resultados vagos |
| "O agente já sabe onde ficam os arquivos" | Sabe? Prove — execute Glob e confirme |
| "Explorar o codebase é perda de tempo" | 2 minutos de exploração evitam 20 minutos de retrabalho |
| "Red Flags genéricos servem" | Red Flags devem ser específicos para a tarefa — genéricos são ignorados |

## Encerramento

Reporte:
- Tarefa: [descrição]
- Arquivos encontrados: [quantidade]
- Prompt gerado: [sim/não, tamanho em linhas]
- Execução: [copiado / subagent despachado / ajustado]
