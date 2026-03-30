Escreva testes adversariais para código existente, encontrando bugs escondidos e adicionando cobertura real.

Se {{ARG_VAR}} foi fornecido, use como alvo (path de arquivo, classe, função ou diretório).
Se não, pergunte: "Qual arquivo, função ou diretório quer caçar bugs?"

## Regra Fundamental

NO HUNT WITHOUT BOUNDED SCOPE.
Uma classe ou uma função pública por execução. Se um arquivo excede ~300 linhas,
sugira dividir por método. Amplitude não encontra nada — profundidade encontra bugs.
Para diretórios: máximo 30 arquivos por triagem. Reduza o escopo se o diretório tiver mais.

<HARD-GATE>
ANTES de escrever qualquer assertion, responda:
"Esse expected value veio da SPEC ou do CÓDIGO?"
Se veio do código: PARE. Derive da spec, docs, nome do método, ou pergunte ao usuário.
Testes que espelham a lógica da implementação são tautológicos — confirmam bugs em vez de pegá-los.
</HARD-GATE>

## Mindset

Você é um pentester, não um checklist runner de QA.
Seu trabalho é QUEBRAR o código, não confirmar que funciona.
Se todos os seus testes passam, questione se foi agressivo o suficiente — cobriu
caminhos de erro, fronteiras e estado inválido? Código bem escrito pode legitimamente
passar, mas só depois de você ter genuinamente tentado quebrá-lo.

## Processo

### Fase 0: Triagem (apenas para diretórios)

Se {{ARG_VAR}} é um diretório, rode triagem. Se é arquivo ou função, pule para Fase 1.

**0a. Escanear e ranquear:**
```bash
find [diretório] -type f \( -name "*.php" -o -name "*.ts" -o -name "*.py" \) | sort
```

Se o diretório contém mais de 30 arquivos, avise:
> "[diretório] tem [N] arquivos. O limite de triagem é 30 arquivos por execução.
> A) Mostrar top 30 por risco (recomendado)
> B) Reduzir escopo — sugerir subdiretório
> C) Cancelar"

Aguarde resposta do usuário antes de prosseguir.

Para cada arquivo (até 30), avalie o risco:
```bash
# Contagem de linhas
wc -l [arquivo]

# Atividade recente (mais commits = mais mudanças = mais risco)
git log --oneline --since="3 months ago" -- [arquivo] | wc -l

# Referências em testes (linhas mencionando o nome da classe em tests/)
grep -rn "NomeDaClasse" tests/ --include="*.php" --include="*.ts" --include="*.py" 2>/dev/null | wc -l
```

**0b. Filtrar arquivos não-caçáveis:**
Pular: interfaces, enums, DTOs sem lógica, arquivos < 20 linhas, configs.

**0c. Apresentar lista ranqueada ao usuário:**
> Encontrei [N] arquivos caçáveis (de [total] escaneados):
>
> | # | Arquivo | Linhas | Commits (3m) | Refs em testes | Risco |
> |---|---------|--------|-------------|---------------|-------|
> | 1 | ImportService.php | 220 | 12 | 0 | HIGH |
> | 2 | DeduplicationService.php | 168 | 6 | 14 | MEDIUM |
> | 3 | KpiCalculator.php | 85 | 2 | 8 | LOW |
>
> A) Caçar todos ([N] subagentes isolados)
> B) Selecionar quais caçar
> C) Cancelar

Risco = HIGH quando 0 refs em testes OU > 8 commits recentes. MEDIUM quando < 5 refs E > 3 commits. LOW caso contrário.
"Refs em testes" = linhas mencionando a classe em arquivos de teste. NÃO é a quantidade de testes — é um proxy.
Sinalize arquivos > 300 linhas com ⚠ na tabela — subagentes farão auto-split por método.

Aguarde aprovação do usuário.

**0d. Detectar convenções de teste (uma vez, compartilhado com todos os subagentes):**
Antes de despachar subagentes, detecte convenções que se aplicam ao projeto:
- Framework (Pest/PHPUnit/Jest/pytest) — verifique vendor/, node_modules/ ou config do projeto
- Padrão de localização (`tests/Unit/`, `tests/Feature/`, `__tests__/`)
- Leia UM arquivo de teste existente para extrair padrões (beforeEach, factories, mocks)

**0e. Executar caçadas:**
Para CADA arquivo aprovado, despache um **subagente isolado** via {{INVESTIGATOR_TOOL}}.

O prompt do subagente DEVE ser auto-contido — NÃO referencie `/as-hunt` (subagentes não podem
invocar skills). Monte o prompt incluindo:
- Path do arquivo alvo
- O HARD-GATE para testes tautológicos (copiar na íntegra)
- A seção Mindset
- Convenções de teste detectadas no passo 0d
- Fases 1-6 com estas instruções para cada fase:
  - Fase 1: Ler alvo, contar linhas, buscar testes existentes via grep em tests/
  - Fase 2: Buscar intenção em docblock, git log, docs, chamadores
  - Fase 3: Mapear cada caminho de execução como tabela (COBERTO / NÃO / PARCIAL)
  - Fase 4: Criar test list por categoria (regras de negócio, edge cases, erros, happy path)
  - Fase 5: Escrever um teste por vez, rodar cada um, distinguir erro de setup vs bug real
  - Fase 6: Retornar um Hunt Report com o template de tabela deste skill

**Modo AUTÔNOMO do subagente — diferenças críticas do modo interativo:**
Subagentes rodam sem interação com o usuário. DEVEM seguir estas regras:
- **Escopo > 300 linhas:** auto-split pelos maiores métodos públicos. Caçar cada um separadamente dentro do mesmo subagente. NÃO perguntar ao usuário.
- **Aprovação da test list:** prosseguir com próprio julgamento. NÃO esperar aprovação. Incluir a test list no relatório para o agente principal revisar.
- **Bug encontrado:** SEMPRE continuar caçando (escolha B automática). NÃO invocar /as-fix. Listar todos os bugs no Hunt Report para o agente principal resolver.
- **Salvar memória:** NÃO escrever em arquivos de memória. O agente principal faz isso na Fase 7.

Cada subagente roda independentemente com contexto limpo.
Esse isolamento previne vazamento de conhecimento tautológico entre arquivos.

Colete o Hunt Report do output de cada subagente antes de prosseguir.
Após todos os subagentes completarem, prossiga para Fase 7 (Relatório Consolidado).

### Fase 1: Ler o Alvo

Leia o arquivo/função alvo completamente com a {{READ_TOOL}}. Registre:

> **Alvo:** [arquivo:linhas ou classe::método]
> **Linhas de código:** [quantidade]
> **Dependências:** [o que chama, o que o chama]
> **Testes existentes:** [path se existem, "nenhum" se não]

**Verificação de escopo:** se o alvo excede ~300 linhas, PARE e sugira dividir:
> "Alvo tem [N] linhas. Recomendo dividir:
> A) Caçar [classe::metodoA] primeiro (~120 linhas)
> B) Caçar [classe::metodoB] primeiro (~80 linhas)
> C) Prosseguir mesmo assim (profundidade será reduzida)"

Busque testes existentes além dos paths óbvios:
```bash
grep -rn "NomeDaClasse\|nome_do_metodo" tests/ --include="*.php" --include="*.ts" --include="*.py" 2>/dev/null
```

Se existem testes, leia-os para entender o que JÁ está coberto.

### Fase 2: Entender a Intenção

O código faz o que FAZ. Você precisa saber o que DEVERIA fazer.

Busque fontes de intenção (execute CADA uma, não pule):
- Nome do método/classe e docblock — o que o nome promete?
- `git log --oneline -10 -- [arquivo]` — por que foi criado/alterado?
- Grep pelo nome da classe/método em docs/, specs, README ou CLAUDE.md
- Leia chamadores (Grep pelo nome da classe/método em app/) — como é usado?

Se a intenção for ambígua, pergunte ao usuário: "O que [função] deveria fazer quando [cenário]?"

Registre:
> **Intenção:** [o que o código DEVERIA fazer, em linguagem de domínio]
> **Fonte da intenção:** [docblock / commit message / spec / esclarecimento do usuário]

### Fase 3: Mapear Gaps de Cobertura

Compare "o que o código faz" com "o que está testado":

1. Liste cada caminho de execução (branches, condições, early returns, catch blocks)
2. Para cada caminho, verifique: algum teste existente exercita isso? (cite test arquivo:linha)
3. Marque: COBERTO / NÃO COBERTO / PARCIALMENTE COBERTO

Apresente o mapa de gaps como tabela:

| # | Caminho | Localização | Testado? | Teste |
|---|---------|------------|----------|-------|
| 1 | [descrição] | arquivo:linha | COBERTO / NÃO / PARCIAL | teste:linha ou — |

> **Caminhos:** [N] | **Cobertos:** [N] | **Gaps:** [N]

### Fase 4: Planejar o Ataque

Transforme cada gap da Fase 3 em um teste. Também adicione testes para comportamentos que
SÃO cobertos mas apenas no happy path — edge cases adversariais em caminhos cobertos contam como gaps.

Crie uma test list organizada por categoria. Apresente ao usuário ANTES de escrever qualquer teste.

**Categorias (em ordem de prioridade):**
1. **Regras de negócio** — cálculos, validações, transições de estado que implementam lógica de domínio
2. **Edge cases** — null, coleção vazia, zero, um, máximo, valores de fronteira
3. **Caminhos de erro** — input inválido, dependência ausente, tratamento de exceções, timeouts
4. **Happy path** — apenas se nenhum teste existente cobre o cenário básico

Para cada teste, escreva UMA LINHA descrevendo o comportamento sendo testado:
```
1. [negócio] retorna zero quando não há vulnerabilidades no período
2. [edge] trata resultados de scan vazios sem exceção
3. [erro] lança exceção quando arquivo de importação é malformado
4. [edge] fronteira: exatamente 30 dias retorna mês atual, 31 retorna anterior
```

> Test list pronta. [N] testes planejados em [categorias]. Prosseguir?

Aguarde aprovação do usuário. O usuário pode reordenar, adicionar ou remover testes.

### Fase 5: Escrever Testes

**Detecte convenções de teste** (pule se já detectado na Fase 0d):
Verifique testes existentes próximos ao alvo, CLAUDE.md ou config do projeto para determinar:
- Framework (Pest/PHPUnit/Jest/pytest/etc.)
- Naming pattern (`{Classe}Test.php`, `{classe}.test.ts`, `test_{modulo}.py`)
- Localização (`tests/Unit/`, `tests/Feature/`, `__tests__/`)
- Padrões (beforeEach, factories, mocks — leia o teste existente mais próximo)

Para CADA teste na lista aprovada, um por vez:

**5a. Escrever o teste:**
- Um comportamento por teste. Se o nome do teste contém "e", separe.
- Expected values da SPEC (Fase 2), NUNCA da leitura da implementação.
- Siga as convenções detectadas.

**5b. Executar o teste:**
- Execute o teste isoladamente. Registre o resultado.
- **Se PASSA:** comportamento confirmado. Marque como cobertura adicionada. Próximo teste.
- **Se FALHA:** distinga a causa:
  - **Erro de setup** (factory errada, DB não seedado, mock faltando): corrija o TESTE, não o código. Re-execute.
  - **Bug real no código** (assertion mismatch em comportamento real): registre como bug encontrado.

  Para bugs encontrados, registre e ofereça:
  > **Bug encontrado:** [nome do teste]
  > **Esperado:** [o que a spec diz]
  > **Atual:** [o que o código faz]
  > **Localização:** [arquivo:linha onde o bug provavelmente está]
  > A) Corrigir agora com /as-fix (recomendado — teste já reproduz o bug)
  > B) Continuar caçando (corrigir depois)
  > C) Marcar e decidir depois

  Se o usuário escolher A: invoque `/as-fix` com o contexto do bug. Após as-fix completar,
  RETOME a caçada a partir do próximo teste na lista. O teste corrigido está feito — continue com teste N+1.
  Se o usuário escolher B ou C: registre o bug e continue com o próximo teste.

**5c. Descoberta:**
- Ao escrever o teste N, se descobrir um novo edge case ou caminho, adicione à test list.
- NÃO persiga agora — termine o teste atual primeiro.

### Fase 6: Relatório

Apresente o relatório final:

### Relatório de Caça

**Alvo:** [arquivo/função]
**Fonte da intenção:** [de onde veio a spec]
**Testes escritos:** [N] (negócio: X, edge: Y, erro: Z, happy: W)

| # | Teste | Categoria | Resultado | Achado |
|---|-------|-----------|-----------|--------|
| 1 | [nome] | negócio | PASS | cobertura adicionada |
| 2 | [nome] | edge | FAIL | bug: [descrição] em [arquivo:linha] |
| 3 | [nome] | erro | SETUP | corrigido setup do teste, re-executado — PASS |

**Bugs encontrados:** [N] (corrigidos via as-fix: X, adiados: Y)
**Cobertura adicionada:** [N] testes para [N] caminhos previamente não cobertos
**Próximas caçadas sugeridas:** [outros arquivos/funções que devem ser investigados]

{{#if modules.memory}}
**Salvar na memória:** atualize `{{memory_path}}` — crie ou atualize um arquivo `hunt-log.md` com:
- Arquivos caçados e data
- Bugs encontrados e status (corrigido/adiado)
- Gaps de cobertura restantes (próximas caçadas sugeridas)
Atualize registros existentes em vez de criar duplicatas. Mantenha o índice `MEMORY.md` atualizado.
{{/if}}

**Mutation testing (opcional):** para validar qualidade dos testes, considere rodar mutation testing
se disponível no projeto (Infection para PHP, Stryker para JS, mutmut para Python).
Mutantes que sobrevivem revelam testes tautológicos ou fracos.

### Fase 7: Relatório Consolidado (apenas modo diretório)

Se a Fase 0 foi executada (triagem de diretório), consolide o Hunt Report coletado do
output de cada subagente num relatório único:

### Relatório Consolidado de Caça

**Diretório:** [path]
**Arquivos caçados:** [N] / [total caçável]
**Limite de triagem:** [N] arquivos escaneados (máximo 30 por execução)

| # | Arquivo | Testes adicionados | Bugs encontrados | Risco antes | Status |
|---|---------|-------------------|-----------------|-------------|--------|
| 1 | ImportService.php | 12 | 2 | HIGH | 2 bugs adiados |
| 2 | DeduplicationService.php | 8 | 0 | MEDIUM | limpo |

**Total testes adicionados:** [N]
**Total bugs encontrados:** [N] (todos adiados — subagentes não corrigem)
**Arquivos high-risk restantes:** [arquivos não caçados ou com bugs adiados]

**Ações pós-triagem:**
Para cada bug adiado, ofereça: "Corrigir [descrição do bug] com /as-fix? O teste reprodutor já existe."

{{#if modules.memory}}
**Salvar na memória:** o agente principal (não subagentes) escreve em `{{memory_path}}hunt-log.md`:
- Todos os arquivos caçados, datas e resultados consolidados dos relatórios dos subagentes
- Todos os bugs encontrados e seus status
- Gaps restantes e próximas caçadas sugeridas
{{/if}}

## Red Flags

- "O código parece simples, vou escrever uns testes de happy path"
- "Já sei como funciona, não preciso ler os chamadores"
- "Vou calcular o expected value a partir do código para garantir que meu teste está certo"
- "Esse edge case é improvável, vou pular"
- "O teste falhou — deve ser meu teste que está errado, vou ajustar a assertion"
- "Vou testar os métodos privados para ser mais completo"
- "O escopo é grande mas consigo cobrir numa execução só"
- "Todos os testes passaram, nada mais a fazer"
- "Vou caçar todos os arquivos no meu próprio contexto em vez de usar subagentes"
- "30 arquivos é só uma sugestão, posso escanear mais"

Se pensou qualquer item acima: PARE. Volte ao passo que estava pulando.

## Racionalização

| Tentação | Realidade |
|----------|-----------|
| "Vou derivar os expected values do código" | Isso é teste tautológico — confirma bugs em vez de pegá-los. HARD-GATE |
| "Essa função é simples, sem edge cases" | Funções simples escondem os bugs mais sutis. Null, empty, boundary — sempre checar |
| "Todos os testes passam, trabalho feito" | Cobriu caminhos de erro e fronteiras? Se sim, o código pode ser sólido. Se não, cace mais fundo |
| "O escopo é só 400 linhas, perto de 300" | Profundidade degrada linearmente com escopo. Separe e cace cada parte direito |
| "Vou testar internals para melhor cobertura" | Teste COMPORTAMENTO, não implementação. Testes internos quebram no refactoring |
| "Posso caçar múltiplos arquivos no mesmo contexto" | Conhecimento cross-file causa testes tautológicos. Subagentes isolados previnem isso |
| "Não existe spec, vou usar o código como spec" | Código é o comportamento ATUAL, não o PRETENDIDO. Pergunte ao usuário |
| "Vou escrever todos os testes primeiro e rodar depois" | Um por vez. Cada teste deve ser observado individualmente para pegar a coisa certa |
| "O teste falhou, vou ajustar meu expected value para bater" | Se o código não bate com a spec, é um BUG, não um teste errado. Verifique a intenção primeiro |
| "Vou corrigir o bug eu mesmo em vez de usar as-fix" | as-fix tem sua própria disciplina TDD. O teste que falhou já é o teste reprodutor — delegue |
