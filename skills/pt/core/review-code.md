Revise o diff atual do git com uma mentalidade adversarial para encontrar defeitos funcionais.

## Regra Fundamental

SEM NITS DE ESTILO.
Se não for um defeito funcional, vulnerabilidade de segurança ou problema de integridade de dados, NÃO reporte.
Foque no que pode QUEBRAR, não em como o código parece.

## Mentalidade

{{READ_TOOL}} o diff como se o autor estivesse tentando esconder um bug.
Seu papel é encontrar onde a mudança falha, não confirmar que ela é boa.
Se você não encontrar nada, realize uma segunda passada especificamente nas fronteiras
entre o código alterado e o não alterado (impact slicing).

## Processo

### 1. Coletar Contexto
- Use {{BASH_TOOL}} com `git diff {{#if ARG_VAR}}{{ARG_VAR}}{{else}}HEAD{{/if}}` para obter as mudanças.
- Identifique arquivos e funções alterados.
- Para cada função alterada, identifique:
    - **Callers (1-hop)**: Quem chama isso? Eles lidam com o novo comportamento/retorno/exceções?
    - **Callees (1-hop)**: O que isso chama? É usado corretamente sob a nova lógica?
- Use {{GREP_TOOL}} e {{GLOB_TOOL}} para encontrar esses vizinhos.
- Use {{READ_TOOL}} para ler o contexto completo dos arquivos alterados e seus vizinhos.

### 2. Análise Adversarial (3 Níveis)
Analise o diff e seus vizinhos em relação a estes níveis. Você DEVE abordar todos os níveis.

#### N1: Bloqueadores (P0) - CORREÇÃO OBRIGATÓRIA
- **Corretude**: Erros de lógica, off-by-one, algoritmos incorretos, condições de corrida.
- **Segurança**: Injeção (SQL/Comando), XSS, autenticação quebrada, vazamento de credenciais, padrões inseguros.
- **Integridade de Dados**: Potencial perda de dados, estado corrompido, gravações parciais sem transações.

#### N2: Deve-corrigir (P1) - ALTAMENTE RECOMENDADO
- **Casos de Borda**: Nulls/undefined não tratados, coleções vazias, valores de contorno, tipos inesperados.
- **Tratamento de Erros**: Exceções silenciadas, falta de lógica de retry, mensagens de erro ruins para depuração.
- **Performance**: N+1 queries, O(n^2) em caminhos críticos, vazamentos de memória, bloqueio do event loop.

#### N3: Considerar (P2) - MELHORIAS
- **Manutenibilidade**: Complexidade ciclomática extrema, violação de padrões arquiteturais principais.
- **Cobertura de Testes**: Caminhos críticos introduzidos sem os testes correspondentes.
- **Contratos**: Violação de contratos de API documentada ou de funções internas.

### 3. Gerar Relatório
- Limite a aproximadamente 7 descobertas no total para garantir alto sinal.
- Se um nível estiver limpo, declare explicitamente "Nenhuma encontrada".
- Cada descoberta DEVE incluir:
    - **Gravidade**: P0, P1 ou P2.
    - **Confiança**: 0.0 a 1.0.
    - **Evidência**: Caminho do arquivo e números de linha.
    - **Impacto**: O que acontece se for ignorado.
    - **Sugestão de Correção**: Snippet de código literal.

## Formato de Saída

### Revisão de Código: [Breve Descrição das Mudanças]

**Nível 1: Bloqueadores (P0)**
- [Descoberta 1] (Confiança: X.X)
  - **Evidência**: `caminho/do/arquivo.ext:L123`
  - **Impacto**: [Descrição]
  - **Correção**:
    ```[linguagem]
    [código]
    ```
- (Se não houver) Nenhuma encontrada.

**Nível 2: Deve-corrigir (P1)**
- ...

**Nível 3: Considerar (P2)**
- ...

## Racionalização

| Tentação | Realidade |
|----------|-----------|
| "O código parece limpo" | Código limpo é onde bugs de lógica sutis se escondem |
| "Mudança pequena, baixo risco" | Mudanças pequenas em auth/dados = raio de explosão máximo |
| "Os testes passaram, então está correto" | Testes só provam o que eles testam, não o que não testam |
| "É um problema pré-existente" | Se a mudança o toca ou o piora, ele deve ser revisado |
| "Vou mencionar o estilo de nomeação" | PARE. Estilo não é um defeito funcional. Delete a descoberta |

## Sinais de Alerta
- Reportar indentação, espaços em branco ou nomeação de variáveis (a menos que seja enganosa).
- Aprovar uma mudança em um caminho crítico sem verificar seus chamadores.
- Terminar a revisão em menos de 2 minutos para um diff grande.
- Encontrar 0 problemas em uma mudança lógica complexa (leia novamente!).
